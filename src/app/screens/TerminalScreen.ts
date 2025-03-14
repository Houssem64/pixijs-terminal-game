import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { FileSystem } from "../../utils/FileSystem";
import { MissionPanel } from "../components/MissionPanel";
import { MissionManager } from "../utils/MissionManager";
import { MissionCompletionPopup } from "../components/MissionCompletionPopup";
import { PlayerStatusBar } from "../components/PlayerStatusBar";
import { WiFiPenTestMission } from "../missions/WiFiPenTest";

enum TerminalState {
    NORMAL = "normal",
    PASSWORD = "password",
    FTP = "ftp",
    FTP_PASSWORD = "ftp_password",
    NANO = "nano"
}

interface TerminalTheme {
    background: number;
    foreground: number;
    prompt: number;
    error: number;
    selection: number;
    cursor: number;
    link: number;
    commandHighlight: number;
    name: string;
}

const THEMES: {[key: string]: TerminalTheme} = {
    dracula: {
        name: 'Dracula',
        background: 0x282a36,
        foreground: 0xf8f8f2,
        prompt: 0x50fa7b,
        error: 0xff5555,
        selection: 0x44475a, 
        cursor: 0xf8f8f2,
        link: 0x8be9fd,
        commandHighlight: 0xff79c6
    },
    solarizedDark: {
        name: 'Solarized Dark',
        background: 0x002b36,
        foreground: 0x839496,
        prompt: 0x859900,
        error: 0xdc322f,
        selection: 0x073642,
        cursor: 0x839496,
        link: 0x268bd2,
        commandHighlight: 0xd33682
    },
    monokai: {
        name: 'Monokai',
        background: 0x272822,
        foreground: 0xf8f8f2,
        prompt: 0xa6e22e,
        error: 0xf92672,
        selection: 0x49483e,
        cursor: 0xf8f8f2,
        link: 0x66d9ef,
        commandHighlight: 0xe6db74
    },
    ubuntu: {
        name: 'Ubuntu',
        background: 0x300a24,
        foreground: 0xffffff,
        prompt: 0x26a269,
        error: 0xcc0000,
        selection: 0x3a3a3a,
        cursor: 0xffffff,
        link: 0x0000ff,
        commandHighlight: 0xe95420
    }
};

interface NanoState {
    content: string;
    filename: string;
    lines: string[];
    cursorY: number;
    cursorX: number;
    message: string;
    modified: boolean;
    selection: {
        startY: number;
        startX: number;
        endY: number;
        endX: number;
    } | null;
    scrollY: number;
    linesToShow: number;
    syntaxHighlighting: boolean;
    searchTerm: string;
    searchResults: {line: number, column: number}[];
    currentSearchIndex: number;
}

interface FTPState {
    host: string;
    username: string;
    authenticated: boolean;
    password: string;
}

export class TerminalScreen extends Container {
    /** Assets bundles required by this screen */
    public static assetBundles: string[] = [];

    private background: Graphics = new Graphics();
    private outputContainer: Container = new Container();
    private cursorGraphics: Graphics = new Graphics();
    private currentInput: Text = new Text("");
    private output: Text[] = [];
    private cursorBlinkInterval!: ReturnType<typeof setInterval>;
    private state: TerminalState = TerminalState.NORMAL;
    private currentCommand: string = "";
    private passwordAttempts: number = 0;
    private maxPasswordAttempts: number = 3;
    private sudoPassword: string = "admin";
    private fileSystem: FileSystem;
    private ftpState: FTPState | null = null;
    private nanoState: NanoState | null = null;
    private currentTheme: TerminalTheme = THEMES.dracula; // Default theme
    private showLineNumbers: boolean = false; // For nano editor
    private environmentVariables: {[key: string]: string} = {};
    private aliases: {[key: string]: string} = {};
    private missionManager: MissionManager;
    private playerStatusBar: PlayerStatusBar;

    // Add padding constants
    private PADDING_X = 12;
    private PADDING_Y = 12;
    private LINE_HEIGHT = 20;
    private FONT_SIZE = 16;
    private CURSOR_BLINK_SPEED = 530;
    private HISTORY_SIZE = 1000;
    private commandHistory: string[] = [];
    private historyIndex: number = -1;
    private terminalWidth = 0;
    private terminalHeight = 0;
    private MISSION_PANEL_WIDTH = 350; // Updated from 300 to 350

    private textStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0xf8f8f2,  // Will be updated from theme
        fontWeight: "600",  // Increased from 500 for better clarity
        letterSpacing: 0.5,  // Added slight letter spacing
        lineHeight: this.LINE_HEIGHT,
        align: 'left'
    });

    private promptStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0x50fa7b,  // Will be updated from theme
        fontWeight: "600",  // Increased from 400 for better clarity
        letterSpacing: 0.5,  // Added slight letter spacing
        lineHeight: this.LINE_HEIGHT,
        align: 'left'
    });

    private errorStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0xff5555,  // Will be updated from theme
        fontWeight: "600",  // Increased from 400 for better clarity
        letterSpacing: 0.5,  // Added slight letter spacing
        lineHeight: this.LINE_HEIGHT,
        align: 'left'
    });

    private innerBackground: Graphics;
    private missionPanel: MissionPanel;
    private promptText: Text;

    constructor() {
        super();
        
        // Initialize file system
        this.fileSystem = FileSystem.getInstance();

        // Set up environment variables
        this.initEnvironmentVariables();
        
        // Initialize aliases
        this.initAliases();

        // Create backgrounds
        this.background = new Graphics();
        this.innerBackground = new Graphics();
        this.addChild(this.background);
        this.addChild(this.innerBackground);

        // Apply theme to text styles
        this.updateThemeStyles();

        // Create output container
        this.outputContainer = new Container();
        this.addChild(this.outputContainer);
        
        // Initialize the mission manager
        this.missionManager = MissionManager.getInstance();
        
        // Register available missions
        this.missionManager.registerMission(WiFiPenTestMission);

        // Create mission panel
        this.missionPanel = new MissionPanel();
        this.addChild(this.missionPanel);
        
        // Add player status bar
        this.playerStatusBar = new PlayerStatusBar();
        this.addChild(this.playerStatusBar);
        this.positionPlayerStatusBar(); // Call a new method to position the status bar correctly
        
        // Listen for mission completion events
        this.missionManager.on('missionCompleted', (missionId: string) => {
            this.showMissionCompletionPopup(missionId);
        });
        
        // Listen for objective completion events
        this.missionManager.on('objectiveCompleted', (missionId: string, objectiveId: string) => {
            const mission = this.missionManager.getMission(missionId);
            const objective = mission?.objectives.find(obj => obj.id === objectiveId);
            
            if (mission && objective) {
                this.addOutput(`Objective completed: ${objective.description}`, false, 0x00ff00);
                
                // Play a sound effect for objective completion
                // Sound.play('objective_complete');
            }
        });

        // Create prompt and input text
        this.promptText = new Text(this.getCurrentPrompt(), this.promptStyle);
        this.currentInput = new Text("", this.textStyle);
        this.promptText.resolution = window.devicePixelRatio || 1;
        this.currentInput.resolution = window.devicePixelRatio || 1;
        this.addChild(this.promptText);
        this.addChild(this.currentInput);

        // Create cursor
        this.cursorGraphics = new Graphics();
        this.cursorGraphics.beginFill(0xf8f8f2, 0.8);
        this.cursorGraphics.drawRect(0, 0, 2, this.FONT_SIZE);
        this.cursorGraphics.endFill();
        this.addChild(this.cursorGraphics);

        // Set initial sizes
        this.resize(window.innerWidth, window.innerHeight);

        // Setup event listeners
        window.addEventListener("keydown", this.handleKeyPress.bind(this));
        window.addEventListener("resize", this.handleResize.bind(this));

        // Start cursor blinking
        this.cursorBlinkInterval = setInterval(() => {
            this.cursorGraphics.alpha = this.cursorGraphics.alpha > 0 ? 0 : 1;
        }, this.CURSOR_BLINK_SPEED);

        // Add welcome message
        this.addOutput("\x1b[1mWelcome to the Terminal Game!\x1b[0m");
        this.addOutput("Type '\x1b[1mhelp\x1b[0m' for a list of available commands.\n");

        // Update positions
        this.updateInputPosition();
    }

    private initEnvironmentVariables(): void {
        this.environmentVariables = {
            "HOME": "/home/user",
            "USER": "user",
            "SHELL": "/bin/bash",
            "TERM": "xterm-256color",
            "EDITOR": "nano",
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "PWD": this.fileSystem.getCurrentPath(),
            "PS1": "\\u@\\h:\\w$ ",
            "LANG": "en_US.UTF-8"
        };
    }

    private initAliases(): void {
        this.aliases = {
            "ll": "ls -l",
            "la": "ls -la",
            "l": "ls -CF",
            "c": "clear",
            "h": "history"
        };
    }

    private updateThemeStyles(): void {
        // Update text styles based on current theme
        this.textStyle.fill = this.currentTheme.foreground;
        this.promptStyle.fill = this.currentTheme.prompt;
        this.errorStyle.fill = this.currentTheme.error;
        
        // Redraw background with theme colors
        this.drawBackground();
        
        // Make sure cursor exists
        if (!this.cursorGraphics) {
            this.cursorGraphics = new Graphics();
        }
        
        // Update cursor color
        this.cursorGraphics.clear();
        this.cursorGraphics.beginFill(this.currentTheme.cursor, 0.8);
        this.cursorGraphics.drawRect(0, 0, 2, this.FONT_SIZE);
        this.cursorGraphics.endFill();
    }

    private drawBackground(): void {
        // Make sure graphics objects exist before using them
        if (!this.background) {
            this.background = new Graphics();
        }
        if (!this.innerBackground) {
            this.innerBackground = new Graphics();
        }

        // Main background
        this.background.clear();
        this.background.beginFill(this.currentTheme.background); // Use theme color
        this.background.drawRect(0, 0, this.terminalWidth, this.terminalHeight);
        this.background.endFill();

        // Inner background with subtle darker shade
        this.innerBackground.clear();
        this.innerBackground.beginFill(this.currentTheme.background, 1); // Base color
        this.innerBackground.drawRect(
            this.PADDING_X,
            this.PADDING_Y,
            this.terminalWidth - this.MISSION_PANEL_WIDTH - this.PADDING_X * 2,
            this.terminalHeight - this.PADDING_Y * 2
        );
        this.innerBackground.endFill();

        // Add a slight shadow overlay at the bottom
        const darkerColor = this.getDarkerColor(this.currentTheme.background, 0.2);
        this.innerBackground.beginFill(darkerColor, 0.2);
        this.innerBackground.drawRect(
            this.PADDING_X,
            this.PADDING_Y + (this.terminalHeight - this.PADDING_Y * 2) / 2,
            this.terminalWidth - this.MISSION_PANEL_WIDTH - this.PADDING_X * 2,
            (this.terminalHeight - this.PADDING_Y * 2) / 2
        );
        this.innerBackground.endFill();
    }

    // Helper function to darken a color
    private getDarkerColor(color: number, factor: number): number {
        const r = ((color >> 16) & 0xFF) * (1 - factor);
        const g = ((color >> 8) & 0xFF) * (1 - factor);
        const b = (color & 0xFF) * (1 - factor);
        return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
    }

    // Function to change terminal theme
    private setTheme(themeName: string): void {
        if (THEMES[themeName]) {
            this.currentTheme = THEMES[themeName];
            this.updateThemeStyles();
            this.addOutput(`Theme changed to ${this.currentTheme.name}`);
        } else {
            this.addOutput(`Theme '${themeName}' not found. Available themes: ${Object.keys(THEMES).join(', ')}`, true);
        }
    }

    private getCurrentPrompt(): string {
        if (this.state === TerminalState.FTP) {
            return "ftp> ";
        } else if (this.state === TerminalState.FTP_PASSWORD) {
            return "Password: ";
        } else if (this.state === TerminalState.PASSWORD) {
            return "[sudo] password for user: ";
        } else {
            const path = this.fileSystem.getCurrentPath();
            const username = "user";
            let displayPath = path;
            
            if (path === `/home/${username}`) {
                displayPath = "~";
            } else if (path.startsWith(`/home/${username}/`)) {
                displayPath = "~" + path.slice(`/home/${username}`.length);
            }
            
            return `${username}@terminal:${displayPath}$ `;
        }
    }

    private showNeofetch(): void {
        const ascii_art = [
            "       _,met$$$$$gg.          ",
            "    ,g$$$$$$$$$$$$$$$P.      ",
            "  ,g$$P\"\"       \"\"\"Y$$.\".",
            " ,$$P'              `$$b:   ",
            "',$$P       ,ggs.     `$$b:  ",
            "`d$$'     ,$P\"'   .    $$$   ",
            " $$P      d$'     ,    $$P   ",
            " $$:      $$.   -    ,d$$'   ",
            " $$;      Y$b._   _,d$P'     ",
            " Y$$.    `.`\"Y$$$$P\"'        ",
            " `$$b      \"-.__             ",
            "  `Y$$                        ",
            "   `Y$$.                      ",
            "     `$$b.                    ",
            "       `Y$$b.                 ",
            "          `\"Y$b._            ",
            "              `\"\"\"           "
        ];

        const system_info = [
            "OS: PixiJS Terminal",
            "Host: Web Browser",
            "Terminal: Terminal v1.0",
            "Shell: web-shell",
            "Resolution: " + window.innerWidth + "x" + window.innerHeight,
            "Font: Fira Code"
        ];

        // Format neofetch output as a single string with proper alignment
        let neofetchOutput = "";
        
        ascii_art.forEach((line, i) => {
            neofetchOutput += line;
            if (system_info[i]) {
                // Add spacing between ASCII art and system info
                neofetchOutput += "    " + system_info[i];
            }
            // Add newline unless it's the last line
            if (i < ascii_art.length - 1) {
                neofetchOutput += "\n";
            }
        });
        
        // Add the formatted neofetch output
        this.addOutput(neofetchOutput);
    }

    private showHelp(): void {
        // Group commands by category for better organization
        const generalCommands = [
            { cmd: "help", desc: "Show this help message" },
            { cmd: "clear, cls", desc: "Clear the terminal screen" },
            { cmd: "ls", desc: "List files in current directory" },
            { cmd: "cd <dir>", desc: "Change directory" },
            { cmd: "pwd", desc: "Print working directory" },
            { cmd: "mkdir <dir>", desc: "Create a new directory" },
            { cmd: "touch <file>", desc: "Create a new file" },
            { cmd: "echo <text>", desc: "Print text to terminal" },
            { cmd: "echo <text> > <file>", desc: "Write text to file" },
            { cmd: "echo <text> >> <file>", desc: "Append text to file" },
            { cmd: "cat <file>", desc: "Display file contents" },
            { cmd: "rm <file>", desc: "Remove files or directories" },
            { cmd: "cp <source> <dest>", desc: "Copy files or directories" },
            { cmd: "mv <source> <dest>", desc: "Move files or directories" },
            { cmd: "chmod <mode> <file>", desc: "Change file permissions" },
            { cmd: "chown <owner> <file>", desc: "Change file owner" }
        ];
        
        const systemCommands = [
            { cmd: "history", desc: "Show command history" },
            { cmd: "ps", desc: "Report process status" },
            { cmd: "df", desc: "Report file system disk space usage" },
            { cmd: "date", desc: "Display the current date and time" },
            { cmd: "uname", desc: "Print system information" },
            { cmd: "alias", desc: "Define or display aliases" },
            { cmd: "whoami", desc: "Print effective user name" },
            { cmd: "env, printenv", desc: "Print environment variables" },
            { cmd: "export", desc: "Set export attribute for shell variables" },
            { cmd: "man <command>", desc: "Display manual pages" },
            { cmd: "less <file>", desc: "View file contents page by page" },
            { cmd: "neofetch", desc: "Display system information" },
            { cmd: "sudo <command>", desc: "Run command with admin privileges" },
            { cmd: "nano <file>", desc: "Text editor" },
            { cmd: "theme <theme>", desc: "Change terminal theme" }
        ];
        
        const missionCommands = [
            { cmd: "mission list", desc: "Show available missions" },
            { cmd: "mission start <id>", desc: "Start a specific mission" },
            { cmd: "mission status", desc: "Show current mission status" },
            { cmd: "next", desc: "Show next mission" },
            { cmd: "prev", desc: "Show previous mission" }
        ];
        
        const networkCommands = [
            { cmd: "nmap scan", desc: "Scan network for hosts" },
            { cmd: "nmap analyze", desc: "Analyze open ports on target" },
            { cmd: "ftp <host>", desc: "Connect to FTP server" }
        ];
        
        const wifiCommands = [
            { cmd: "wifi scan", desc: "Scan for wireless networks" },
            { cmd: "wifi capture <ssid>", desc: "Capture packets from a wireless network" },
            { cmd: "wifi analyze", desc: "Analyze captured packets" },
            { cmd: "wifi crack <ssid> <wordlist>", desc: "Attempt to crack a wireless password" },
            { cmd: "wifi connect <ssid> <password>", desc: "Connect to a wireless network" }
        ];
        
        // Find the longest command to align descriptions
        const allCommands = [
            ...generalCommands, 
            ...systemCommands, 
            ...missionCommands, 
            ...networkCommands, 
            ...wifiCommands
        ];
        const longestCmd = Math.max(...allCommands.map(cmd => cmd.cmd.length));
        
        // Helper to format and print commands
        const formatSection = (title: string, commands: { cmd: string, desc: string }[]) => {
            const output = [`\n\x1b[1m${title}:\x1b[0m`];
            commands.forEach(({ cmd, desc }) => {
                const paddedCmd = cmd.padEnd(longestCmd + 2);
                output.push(`  \x1b[36m${paddedCmd}\x1b[0m ${desc}`);
            });
            return output.join('\n');
        };
        
        // Build the help output
        const helpText = [
            "\x1b[1mTerminal Help\x1b[0m",
            "Type a command and press Enter to execute it. Use Up/Down arrows to navigate command history.",
            formatSection("Basic File System Commands", generalCommands),
            formatSection("System & Environment Commands", systemCommands),
            formatSection("Mission Commands", missionCommands),
            formatSection("Network Tools", networkCommands),
            formatSection("WiFi Hacking Tools (wifite)", wifiCommands)
        ];
        
        this.addOutput(helpText.join('\n'));
    }

    private handleCommand(command: string): void {
        // Process command for pipes and redirections
        const pipeCommands = this.processPipesAndRedirections(command);
        if (pipeCommands.length > 1) {
            // Handle piped commands (future implementation)
            this.addOutput("Pipe functionality not fully implemented yet.", true);
            return;
        }

        // Process environment variables in the command
        command = this.processEnvironmentVariables(command);

        // Check for aliases
        command = this.processAliases(command);
        
        const args = command.trim().split(' ');
        const cmd = args[0].toLowerCase();

        try {
            switch (cmd) {
                case 'help':
                    this.showHelp();
                    break;
                case 'clear':
                case 'cls':
                    this.clearOutput();
                    break;
                case 'ls':
                    this.handleLsCommand(args);
                    break;
                case 'cd':
                    const path = args[1] || '';
                    try {
                        this.fileSystem.changePath(path);
                        // Update PWD environment variable
                        this.environmentVariables["PWD"] = this.fileSystem.getCurrentPath();
                        // Don't output anything on successful cd, like real terminals
                        this.missionPanel.completeMission('password-crack');
                    } catch (err: any) {
                        this.addOutput(`cd: ${err?.message || 'Unknown error'}`, true);
                    }
                    break;
                case 'pwd':
                    this.addOutput(this.fileSystem.getCurrentPath());
                    break;
                case 'mkdir':
                    if (args.length < 2) {
                        this.addOutput('mkdir: missing operand', true);
                        return;
                    }
                    try {
                        const recursive = args.includes('-p') || args.includes('--parents');
                        this.fileSystem.createDirectory(args[args.indexOf('-p') !== -1 ? args.indexOf('-p') + 1 : 1], recursive);
                        this.missionPanel.completeMission('network-scan');
                    } catch (err: any) {
                        this.addOutput(`mkdir: ${err?.message || 'Unknown error'}`, true);
                    }
                    break;
                case 'touch':
                    if (args.length < 2) {
                        this.addOutput('touch: missing file operand', true);
                        return;
                    }
                    try {
                        this.fileSystem.createFile(args[1], '');
                        this.missionPanel.completeMission('phishing-campaign');
                    } catch (err: any) {
                        this.addOutput(`touch: ${err?.message || 'Unknown error'}`, true);
                    }
                    break;
                case 'echo':
                    this.handleEchoCommand(args);
                    break;
                case 'cat':
                    this.handleCatCommand(args);
                    break;
                case 'neofetch':
                    this.showNeofetch();
                    if (this.missionPanel) {
                        this.missionPanel.completeMission('asymmetric-crypto');
                    }
                    break;
                case 'sudo':
                    if (args.length < 2) {
                        this.addOutput('sudo: no command specified', true);
                        return;
                    }
                    // Store the command to run after password authentication
                    this.currentCommand = args.slice(1).join(' ');
                    this.state = TerminalState.PASSWORD;
                    this.passwordAttempts = 0;
                    this.addOutput('[sudo] password for user: ');
                    this.missionPanel.completeMission('privilege-escalation');
                    break;
                case 'nano':
                    if (args.length < 2) {
                        this.addOutput('nano: missing file operand', true);
                        return;
                    }
                    
                    try {
                        this.startNano(args[1]);
                        this.missionPanel.completeMission('cipher-break');
                    } catch (err: any) {
                        this.addOutput(`nano: ${err?.message || 'Unknown error'}`, true);
                    }
                    break;
                case 'ftp':
                    this.addOutput('Connected to ftp.example.com.');
                    this.addOutput('220 ProFTPD Server');
                    this.state = TerminalState.FTP;
                    this.ftpState = {
                        host: 'ftp.example.com',
                        username: 'anonymous',
                        password: '',
                        authenticated: false
                    };
                    this.missionPanel.completeMission('network-scan');
                    break;
                case 'next':
                    if (this.missionPanel) {
                        this.missionPanel.nextMission();
                    }
                    break;
                case 'prev':
                    if (this.missionPanel) {
                        this.missionPanel.previousMission();
                    }
                    break;
                case 'mission':
                    this.handleMissionCommand(args);
                    break;
                case 'mission list':
                    this.handleMissionCommand(args);
                    break;
                case 'wifi':
                    this.handleWifiCommand(args);
                    break;
                case 'wifi scan':
                    this.handleWifiCommand(args);
                    break;
                case 'wifi capture':
                    this.handleWifiCommand(args);
                    break;
                case 'wifi analyze':
                    this.handleWifiCommand(args);
                    break;
                case 'wifi crack':
                    this.handleWifiCommand(args);
                    break;
                case 'wifi connect':
                    this.handleWifiCommand(args);
                    break;
                case 'nmap':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap scan':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap analyze':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap crack':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap connect':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap list':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap help':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap version':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap update':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap status':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap start':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap stop':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap restart':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap reload':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap config':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap debug':
                    this.handleNmapCommand(args);
                    break;
                case 'nmap test':
                    this.handleNmapCommand(args);
                    break;
                default:
                    this.addOutput(`Command not found: ${cmd}`, true);
                    break;
            }
        } catch (error: any) {
            this.addOutput(`Error executing command: ${error?.message || 'Unknown error'}`, true);
            console.error("Command error:", error);
        }
    }

    private handleResize(): void {
        try {
            this.resize(window.innerWidth, window.innerHeight);
        } catch (error) {
            console.error("Error handling resize:", error);
        }
    }

    public resize(width: number, height: number): void {
        this.terminalWidth = width;
        this.terminalHeight = height;

        this.drawBackground();
        
        // Ensure mission panel exists
        if (!this.missionPanel) {
            console.warn('MissionPanel not initialized in resize');
            return;
        }
        
        // Resize mission panel
        this.missionPanel.resize(this.MISSION_PANEL_WIDTH, height);
        
        // Position mission panel at the right side
        this.missionPanel.x = this.terminalWidth - this.MISSION_PANEL_WIDTH;
        this.missionPanel.y = 0;
        
        // Reposition player status bar to be on top of the sidebar
        this.positionPlayerStatusBar();
        
        // Reposition input
        this.updateInputPosition();
    }

    public destroy(): void {
        super.destroy();
    }

    private handleFTPCommand(command: string): void {
        // Basic FTP command handling implementation
        const args = command.trim().split(' ');
        const cmd = args[0].toLowerCase();

        if (this.state === TerminalState.FTP_PASSWORD) {
            if (command) {
                if (this.ftpState) {
                    this.ftpState.password = command;
                    this.ftpState.authenticated = true;
                    this.state = TerminalState.FTP;
                    this.addOutput("Login successful.");
                    this.addOutput("Remote system type is UNIX.");
                    this.addOutput("Using binary mode to transfer files.");
                }
            }
            return;
        }

        switch (cmd) {
            case 'open':
                if (args.length < 2) {
                    this.addOutput("Usage: open hostname [port]");
                    return;
                }
                this.ftpState = {
                    host: args[1],
                    username: "anonymous",
                    password: "",
                    authenticated: false
                };
                this.addOutput(`Connecting to ${args[1]}...`);
                this.addOutput("Connected to server.");
                this.addOutput("220 ProFTPD Server");
                this.addOutput(`Name (${args[1]}:user): `);
                this.state = TerminalState.FTP_PASSWORD;
                break;
            
            case 'ls':
            case 'dir':
                this.addOutput("drwxr-xr-x  2 ftp ftp      4096 Jul 12 12:44 public");
                this.addOutput("-rw-r--r--  1 ftp ftp       843 Jul 10 11:33 README.txt");
                this.addOutput("-rw-r--r--  1 ftp ftp     14853 Jul 09 09:15 data.csv");
                break;
            
            case 'cd':
                this.addOutput(`250 CWD command successful. "/${args[1] || ''}" is current directory.`);
                break;
            
            case 'get':
                if (args.length < 2) {
                    this.addOutput("Usage: get remote-file [local-file]");
                    return;
                }
                this.addOutput(`local: ${args[1]} remote: ${args[1]}`);
                this.addOutput("227 Entering Passive Mode (127,0,0,1,36,12)");
                this.addOutput("150 Opening BINARY mode data connection for file transfer");
                this.addOutput("226 Transfer complete");
                this.addOutput(`${Math.floor(Math.random() * 10000)} bytes received in ${(Math.random() * 2).toFixed(2)} secs`);
                break;
            
            case 'put':
                if (args.length < 2) {
                    this.addOutput("Usage: put local-file [remote-file]");
                    return;
                }
                this.addOutput(`local: ${args[1]} remote: ${args[1]}`);
                this.addOutput("227 Entering Passive Mode (127,0,0,1,36,13)");
                this.addOutput("150 Opening BINARY mode data connection for file transfer");
                this.addOutput("226 Transfer complete");
                this.addOutput(`${Math.floor(Math.random() * 10000)} bytes sent in ${(Math.random() * 2).toFixed(2)} secs`);
                break;
            
            case 'help':
                this.addOutput("Commands may be abbreviated. Commands are:");
                this.addOutput("ls        dir       cd        get       put       ");
                this.addOutput("pwd       bin       ascii     binary    bye       ");
                this.addOutput("close     exit      help      ?         ");
                break;
            
            case 'bye':
            case 'quit':
            case 'exit':
                this.addOutput("221 Goodbye.");
                this.state = TerminalState.NORMAL;
                this.ftpState = null;
                break;
            
            default:
                this.addOutput(`?Invalid command: ${cmd}`);
                break;
        }
    }

    private clearOutput(): void {
        this.output.forEach(text => text.destroy());
        this.output = [];
        this.outputContainer.removeChildren();
        this.updateInputPosition();
    }

    private addOutput(text: string, isError: boolean = false, color?: number): void {
        // Split text into lines
        const lines = text.split('\n');
        
        // Find the last output's position
        const lastOutput = this.outputContainer.children[this.outputContainer.children.length - 1];
        let currentY = lastOutput ? lastOutput.y + this.LINE_HEIGHT : 0;
        
        lines.forEach((line) => {
            // Process ANSI escape codes
            const parts = line.split(/(\x1b\[[0-9;]*m)/);
            let currentX = this.PADDING_X;
            let lineHeight = 0;
            let lineTexts: Text[] = [];
            
            parts.forEach(part => {
                if (part.startsWith('\x1b[')) {
                    // Handle ANSI code (future implementation)
                    return;
                }
                
                if (part.length === 0) return;

                // Determine which style to use
                let style;
                if (isError) {
                    style = this.errorStyle;
                } else if (color !== undefined) {
                    // Create a custom style with the specified color
                    style = new TextStyle({
                        ...this.textStyle,
                        fill: color
                    });
                } else {
                    style = this.textStyle;
                }

                const outputText = new Text(part, style);
                outputText.resolution = Math.max(window.devicePixelRatio || 1, 2);  // Ensure minimum resolution of 2
                outputText.x = Math.round(currentX);  // Round to prevent subpixel rendering
                outputText.y = Math.round(currentY);  // Round to prevent subpixel rendering
                
                lineHeight = Math.max(lineHeight, outputText.height);
                currentX += outputText.width;
                lineTexts.push(outputText);
            });
            
            // Add all text pieces for this line to the container
            lineTexts.forEach(text => {
                this.outputContainer.addChild(text);
                this.output.push(text);
            });
            
            // Move to next line
            currentY += lineHeight || this.LINE_HEIGHT;
        });

        // Update input position
        this.updateInputPosition();
    }

    private updateInputPosition(): void {
        // Ensure objects exist before accessing them
        if (!this.outputContainer || !this.promptText || !this.currentInput || !this.cursorGraphics || 
            !this.missionPanel) {
            console.warn('Required objects not initialized in updateInputPosition');
            return;
        }
        
        // Find the last output text's position
        let lastY = 0;
        let maxHeight = 0;
        
        if (this.outputContainer.children.length > 0) {
            // Find the bottom-most text element
            for (let i = 0; i < this.outputContainer.children.length; i++) {
                const child = this.outputContainer.children[i];
                lastY = Math.max(lastY, child.y + child.height);
                maxHeight = Math.max(maxHeight, child.height);
            }
        }
        
        // Add spacing between the last output and the prompt
        const promptY = Math.round(this.PADDING_Y + lastY + (maxHeight > 0 ? this.LINE_HEIGHT/2 : 0));
        
        // Position the prompt and input with proper spacing
        const x = this.PADDING_X;

        // Update prompt
        this.promptText.text = this.getCurrentPrompt();
        this.promptText.x = Math.round(x);
        this.promptText.y = promptY;
        this.promptText.resolution = window.devicePixelRatio || 1;

        // Update input
        this.currentInput.x = Math.round(x + this.promptText.width);
        this.currentInput.y = promptY;
        this.currentInput.resolution = window.devicePixelRatio || 1;
        
        // Update cursor position
        this.cursorGraphics.x = Math.round(this.currentInput.x + this.currentInput.width);
        this.cursorGraphics.y = Math.round(promptY + 2); // Slight offset to center the cursor vertically

        // Position mission panel
        this.missionPanel.x = this.terminalWidth - this.MISSION_PANEL_WIDTH;
        this.missionPanel.y = 0;
    }

    private startMission(mission: any): void {
        // Create mission-specific setup based on mission category
        switch (mission.category) {
            case 'Brute Force':
                this.setupBruteForceEnvironment(mission);
                break;
            case 'Penetration Testing':
                this.setupPenTestingEnvironment(mission);
                break;
            case 'Social Engineering':
                this.setupSocialEngineeringEnvironment(mission);
                break;
            case 'Cryptography':
                this.setupCryptographyEnvironment(mission);
                break;
            default:
                this.addOutput(`Setting up environment for ${mission.title}...`);
                break;
        }
        
        // Also trigger the mission panel to show this mission
        this.missionPanel['showMissionDetails'](mission);
    }
    
    private setupBruteForceEnvironment(mission: any): void {
        // Setup for brute force missions
        this.addOutput(`Setting up environment for ${mission.title}...`);
        
        // Create relevant directories and files based on mission
        if (mission.id === 'password-crack') {
            try {
                // Create a directory for password files if it doesn't exist
                if (!this.fileSystem.fileExists('/home/user/secure')) {
                    this.fileSystem.createDirectory('/home/user/secure', true);
                }
                
                // Create a password file
                this.fileSystem.writeFile('/home/user/secure/passwd.txt', 'admin:x:0:0:Administrator:/home/admin:/bin/bash\nuser:x:1000:1000:Regular User:/home/user:/bin/bash\nguest:x:1001:1001:Guest User:/home/guest:/bin/bash');
                
                // Create a shadow file with hashed passwords
                this.fileSystem.writeFile('/home/user/secure/shadow.txt', 'admin:$6$salt$hashedpassword:18000:0:99999:7:::\nuser:$6$salt$weakpassword:18000:0:99999:7:::\nguest:$6$salt$guestpass:18000:0:99999:7:::');
                
                this.addOutput("Created password files in /home/user/secure/");
                this.addOutput("Try using the 'crack' command to attempt password recovery.");
            } catch (err: any) {
                this.addOutput(`Failed to set up environment: ${err?.message || 'Unknown error'}`, true);
            }
        } else if (mission.id === 'hash-breaker') {
            try {
                // Create hash files
                if (!this.fileSystem.fileExists('/home/user/hashes')) {
                    this.fileSystem.createDirectory('/home/user/hashes', true);
                }
                
                // Create sample hashed data
                this.fileSystem.writeFile('/home/user/hashes/md5_hashes.txt', '5f4dcc3b5aa765d61d8327deb882cf99\n7c6a180b36896a0a8c02787eeafb0e4c\ne10adc3949ba59abbe56e057f20f883e');
                this.fileSystem.writeFile('/home/user/hashes/README.txt', 'These are MD5 hashes of common passwords. Use the rainbow table technique to crack them.');
                
                this.addOutput("Created hash files in /home/user/hashes/");
                this.addOutput("Use analysis tools to identify and crack the hashes.");
            } catch (err: any) {
                this.addOutput(`Failed to set up environment: ${err?.message || 'Unknown error'}`, true);
            }
        }
    }
    
    private setupPenTestingEnvironment(mission: any): void {
        // Setup for penetration testing missions
        this.addOutput(`Setting up environment for ${mission.title}...`);
        
        if (mission.id === 'network-scan') {
            try {
                // Create network topology files
                if (!this.fileSystem.fileExists('/home/user/network')) {
                    this.fileSystem.createDirectory('/home/user/network', true);
                }
                
                this.fileSystem.writeFile('/home/user/network/hosts.txt', '192.168.1.1\n192.168.1.2\n192.168.1.100\n192.168.1.254');
                this.fileSystem.writeFile('/home/user/network/topology.txt', 'Network: 192.168.1.0/24\nGateway: 192.168.1.1\nDNS: 192.168.1.2\nServers: 192.168.1.100-105\nClients: 192.168.1.200-254');
                
                this.addOutput("Network information saved in /home/user/network/");
                this.addOutput("Use 'scan' and 'portscan' commands to investigate the network.");
            } catch (err: any) {
                this.addOutput(`Failed to set up environment: ${err?.message || 'Unknown error'}`, true);
            }
        } else if (mission.id === 'privilege-escalation') {
            try {
                // Create vulnerable system files
                if (!this.fileSystem.fileExists('/home/user/system')) {
                    this.fileSystem.createDirectory('/home/user/system', true);
                }
                
                this.fileSystem.writeFile('/home/user/system/passwd', 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:user:/home/user:/bin/bash');
                this.fileSystem.writeFile('/home/user/system/shadow', 'root:$6$salt$securepassword:18000:0:99999:7:::\nuser:$6$salt$userpassword:18000:0:99999:7:::');
                
                // Create a vulnerable SUID program
                this.fileSystem.writeFile('/home/user/system/backup.sh', '#!/bin/bash\n# This script runs as root\necho "Backing up system files..."\n# Vulnerability: This script can be manipulated');
                
                this.addOutput("System files created in /home/user/system/");
                this.addOutput("Find a way to escalate your privileges from user to root.");
            } catch (err: any) {
                this.addOutput(`Failed to set up environment: ${err?.message || 'Unknown error'}`, true);
            }
        }
    }
    
    private setupSocialEngineeringEnvironment(mission: any): void {
        // Setup for social engineering missions
        this.addOutput(`Setting up environment for ${mission.title}...`);
        
        if (mission.id === 'phishing-campaign') {
            try {
                // Create phishing templates directory
                if (!this.fileSystem.fileExists('/home/user/phishing')) {
                    this.fileSystem.createDirectory('/home/user/phishing', true);
                }
                
                this.fileSystem.writeFile('/home/user/phishing/template.html', '<!DOCTYPE html>\n<html>\n<head>\n  <title>Login</title>\n</head>\n<body>\n  <h1>Login to Your Account</h1>\n  <form>\n    <input type="text" placeholder="Email">\n    <input type="password" placeholder="Password">\n    <button>Login</button>\n  </form>\n</body>\n</html>');
                
                this.fileSystem.writeFile('/home/user/phishing/target_list.txt', 'john.doe@example.com\njanedoe@company.com\nsadmin@organization.org\nrandom.user@generic.net');
                
                this.addOutput("Phishing materials created in /home/user/phishing/");
                this.addOutput("Create a convincing phishing campaign targeting the users in the list.");
            } catch (err: any) {
                this.addOutput(`Failed to set up environment: ${err?.message || 'Unknown error'}`, true);
            }
        } else if (mission.id === 'pretexting') {
            try {
                // Create pretexting scenario files
                if (!this.fileSystem.fileExists('/home/user/pretexting')) {
                    this.fileSystem.createDirectory('/home/user/pretexting', true);
                }
                
                this.fileSystem.writeFile('/home/user/pretexting/company_info.txt', 'Company: Acme Corp\nEmployees: John Smith (CEO), Jane Doe (CTO), Sam Wilson (IT Admin)\nDepartments: IT, HR, Finance, Marketing\nPhone System: Extension format is 3 digits, starting with department code (1 for IT, 2 for HR, etc.)');
                
                this.fileSystem.writeFile('/home/user/pretexting/scenario.txt', 'Objective: Extract the quarterly financial report\nTarget: Finance Department\nConstraints: You cannot physically enter the building');
                
                this.addOutput("Pretexting scenario created in /home/user/pretexting/");
                this.addOutput("Develop a pretext to extract the information from the target.");
            } catch (err: any) {
                this.addOutput(`Failed to set up environment: ${err?.message || 'Unknown error'}`, true);
            }
        }
    }
    
    private setupCryptographyEnvironment(mission: any): void {
        // Setup for cryptography missions
        this.addOutput(`Setting up environment for ${mission.title}...`);
        
        if (mission.id === 'cipher-break') {
            try {
                // Create cipher files
                if (!this.fileSystem.fileExists('/home/user/crypto')) {
                    this.fileSystem.createDirectory('/home/user/crypto', true);
                }
                
                // Caesar cipher (shift by 3)
                this.fileSystem.writeFile('/home/user/crypto/caesar.txt', 'Wklv lv d Fdhvdu flskhu zlwk d vkliw ri 3.');
                
                // Vigenère cipher (key: "KEY")
                this.fileSystem.writeFile('/home/user/crypto/vigenere.txt', 'Drsc mw k Zmqcxovs gmtncp amdr dro uiw "IOC".');
                
                // Frequency analysis text
                this.fileSystem.writeFile('/home/user/crypto/frequency.txt', 'Hvs eimqy pfckb tcl xiadg cjsf hvs zonm rcuwgra smr');
                
                this.addOutput("Encrypted files created in /home/user/crypto/");
                this.addOutput("Use cryptanalysis techniques to decrypt the messages.");
            } catch (err: any) {
                this.addOutput(`Failed to set up environment: ${err?.message || 'Unknown error'}`, true);
            }
        } else if (mission.id === 'asymmetric-crypto') {
            try {
                // Create PKI materials
                if (!this.fileSystem.fileExists('/home/user/pki')) {
                    this.fileSystem.createDirectory('/home/user/pki', true);
                }
                
                this.fileSystem.writeFile('/home/user/pki/README.txt', 'In this directory, you will set up your own Public Key Infrastructure.\n1. Generate your key pair\n2. Share your public key\n3. Encrypt a message using a recipient\'s public key\n4. Decrypt a message using your private key');
                
                this.fileSystem.writeFile('/home/user/pki/encrypted_message.txt', 'This file contains an encrypted message that you will need to decrypt using the proper private key.');
                
                this.addOutput("PKI materials created in /home/user/pki/");
                this.addOutput("Set up your public/private key pair and practice encryption/decryption.");
            } catch (err: any) {
                this.addOutput(`Failed to set up environment: ${err?.message || 'Unknown error'}`, true);
            }
        }
    }

    /**
     * Handle mission-related commands
     */
    private handleMissionCommand(args: string[]): void {
        const activeMissionId = this.missionManager.getActiveMissionId();
        
        if (args.length === 1 || args[1] === 'list') {
            // List available missions
            this.addOutput("Available missions:", false);
            
            const missions = this.missionManager.getAllMissions();
            missions.forEach(mission => {
                const statusText = mission.state === 'completed' ? 
                    "[COMPLETED]" : 
                    (mission.state === 'in_progress' ? "[IN PROGRESS]" : "[AVAILABLE]");
                
                this.addOutput(`  ${mission.id} - ${mission.title} (${mission.difficulty}) ${statusText}`, false);
            });
            
            this.addOutput("\nUse 'mission start <id>' to start a mission.", false);
            
            if (activeMissionId) {
                const mission = this.missionManager.getMission(activeMissionId);
                if (mission) {
                    this.addOutput("\nCurrent mission:", false);
                    this.addOutput(`${mission.title} - ${mission.description}`, false);
                    
                    this.addOutput("\nObjectives:", false);
                    mission.objectives.forEach((objective, index) => {
                        const status = objective.completed ? "[✓]" : "[ ]";
                        this.addOutput(`${status} ${index + 1}. ${objective.description}`, false);
                    });
                }
            }
        } else if (args[1] === 'start' && args.length > 2) {
            // Start a mission
            const missionId = args[2];
            
            // Give special handling to wifi_pentest mission to ensure it's selectable
            if (missionId === "wifi_pentest") {
                const mission = this.missionManager.getMission(missionId);
                if (mission) {
                    this.missionManager.startMission(missionId);
                    this.addOutput(`Starting mission: ${mission.title}`, false);
                    this.addOutput(mission.description, false);
                    
                    this.addOutput("\nObjectives:", false);
                    mission.objectives.forEach((objective, index) => {
                        this.addOutput(`${index + 1}. ${objective.description}`, false);
                    });
                    
                    // Set up mission environment
                    this.setupWifiPenTestEnvironment();
                    
                    // Show message about using wifi commands
                    this.addOutput("\nUse 'wifi scan' command to begin the mission.", false);
                } else {
                    this.addOutput("WiFi Penetration Testing mission is not available. Please ensure the mission is properly registered.", true);
                }
                return;
            }
            
            // Handle other missions
            const success = this.missionManager.startMission(missionId);
            
            if (success) {
                const mission = this.missionManager.getMission(missionId);
                if (mission) {
                    this.addOutput(`Starting mission: ${mission.title}`, false);
                    this.addOutput(mission.description, false);
                    
                    this.addOutput("\nObjectives:", false);
                    mission.objectives.forEach((objective, index) => {
                        this.addOutput(`${index + 1}. ${objective.description}`, false);
                    });
                    
                    // Set up mission environment if needed
                    this.setupMissionEnvironment(mission);
                }
            } else {
                this.addOutput(`Could not start mission '${missionId}'. It may be unavailable or you don't meet the prerequisites.`, true);
            }
        } else if (args[1] === 'status') {
            // Show current mission status
            if (activeMissionId) {
                const mission = this.missionManager.getMission(activeMissionId);
                if (mission) {
                    this.addOutput(`Current mission: ${mission.title}`, false);
                    this.addOutput(mission.description, false);
                    
                    this.addOutput("\nObjectives:", false);
                    mission.objectives.forEach((objective, index) => {
                        const status = objective.completed ? "[✓]" : "[ ]";
                        this.addOutput(`${status} ${index + 1}. ${objective.description}`, false);
                    });
                }
            } else {
                this.addOutput("No active mission. Use 'mission start <id>' to begin a mission.", false);
            }
        } else {
            this.addOutput("Usage: mission list | mission start <id> | mission status", true);
        }
    }

    /**
     * Setup mission-specific environment
     */
    private setupMissionEnvironment(mission: any): void {
        if (mission.id === "wifi_pentest") {
            this.setupWifiPenTestEnvironment();
        }
    }

    /**
     * Setup environment for WiFi penetration testing mission
     */
    private setupWifiPenTestEnvironment(): void {
        try {
            // Create wifi directory if it doesn't exist
            if (!this.fileSystem.fileExists('/home/user/wifi')) {
                this.fileSystem.createDirectory('/home/user/wifi', true);
            }
            
            // Create initial environment files
            this.fileSystem.writeFile('/home/user/wifi/README.txt', 
                'WiFi Penetration Testing Mission\n\n' +
                'Your goal is to test the security of the target WiFi network.\n' +
                'Follow these steps:\n' +
                '1. Scan for available networks using "wifi scan"\n' +
                '2. Capture packets from the target network\n' +
                '3. Analyze the captured packets\n' +
                '4. Create a wordlist for password cracking\n' +
                '5. Attempt to crack the password\n' +
                '6. Connect to the network\n' +
                '7. Document your findings in a report\n\n' +
                'Good luck!'
            );
            
            this.addOutput("WiFi mission environment set up in /home/user/wifi/", false);
            this.addOutput("Use 'cd /home/user/wifi' to navigate to the mission directory.", false);
            this.addOutput("Read the README.txt file for instructions.", false);
        } catch (err: any) {
            this.addOutput(`Failed to set up mission environment: ${err?.message || 'Unknown error'}`, true);
        }
    }

    /**
     * Handle wifi-related commands
     */
    private handleWifiCommand(args: string[]): void {
        if (args.length === 1) {
            this.addOutput("Usage: wifi scan | wifi capture <ssid> | wifi analyze | wifi crack <ssid> <wordlist> | wifi connect <ssid> <password>", true);
            return;
        }
        
        const activeMissionId = this.missionManager.getActiveMissionId();
        const mission = activeMissionId ? this.missionManager.getMission(activeMissionId) : null;
        
        switch (args[1]) {
            case 'scan':
                this.addOutput("Scanning for wireless networks...", false);
                try {
                    setTimeout(() => {
                        this.addOutput("Found 5 wireless networks:", false);
                        this.addOutput("1. HOME_NETWORK (WPA2, Channel 1, BSSID: AA:BB:CC:DD:EE:FF)", false);
                        this.addOutput("2. xfinitywifi (Open, Channel 3, BSSID: FF:EE:DD:CC:BB:AA)", false);
                        this.addOutput("3. Target WiFi: CORP_SECURE (WPA2, Channel 6, BSSID: 00:11:22:33:44:55)", false);
                        this.addOutput("4. Guest_WiFi (WPA, Channel 11, BSSID: 55:44:33:22:11:00)", false);
                        this.addOutput("5. IoT_Network (WEP, Channel 9, BSSID: 12:34:56:78:90:AB)", false);
                        
                        // Check if this command satisfies a mission objective
                        if (mission) {
                            this.missionManager.checkCommandObjective(
                                mission.id, 
                                "wifi scan", 
                                "Target WiFi: CORP_SECURE (WPA2, Channel 6, BSSID: 00:11:22:33:44:55)"
                            );
                        }
                    }, 1500);
                } catch (error) {
                    this.addOutput(`Error scanning for networks: ${error}`, true);
                }
                break;
                
            case 'capture':
                if (args.length < 3) {
                    this.addOutput("Usage: wifi capture <ssid>", true);
                    return;
                }
                
                const targetNetwork = args[2];
                this.addOutput(`Starting packet capture on network: ${targetNetwork}...`, false);
                
                if (targetNetwork === "CORP_SECURE") {
                    try {
                        setTimeout(() => {
                            this.addOutput("Capturing packets... Waiting for handshake...", false);
                        }, 1000);
                        
                        setTimeout(() => {
                            this.addOutput("Captured handshake from client 66:77:88:99:AA:BB", false);
                            this.addOutput("Saved capture to /home/user/wifi/capture.cap", false);
                            
                            // Create the capture file
                            this.fileSystem.writeFile('/home/user/wifi/capture.cap', 
                                'BINARY_PACKET_DATA_WPA2_HANDSHAKE'
                            );
                            
                            // Check mission objective
                            if (mission) {
                                this.missionManager.checkCommandObjective(
                                    mission.id, 
                                    "wifi capture CORP_SECURE", 
                                    "Captured handshake from client 66:77:88:99:AA:BB"
                                );
                            }
                        }, 3000);
                    } catch (error) {
                        this.addOutput(`Error capturing packets: ${error}`, true);
                    }
                } else {
                    try {
                        setTimeout(() => {
                            this.addOutput(`No handshakes captured for network ${targetNetwork}. Try another network.`, false);
                        }, 2000);
                    } catch (error) {
                        this.addOutput(`Error during capture: ${error}`, true);
                    }
                }
                break;
                
            case 'analyze':
                if (!this.fileSystem.fileExists('/home/user/wifi/capture.cap')) {
                    this.addOutput("No capture file found. Use 'wifi capture <ssid>' to create one.", true);
                    return;
                }
                
                this.addOutput("Analyzing captured packets...", false);
                try {
                    setTimeout(() => {
                        this.addOutput("Analysis complete:", false);
                        this.addOutput("- Network: CORP_SECURE", false);
                        this.addOutput("- Encryption: WPA2-PSK (CCMP)", false);
                        this.addOutput("- WPA2 handshake found", false);
                        this.addOutput("- Clients connected: 3", false);
                        this.addOutput("- AP Manufacturer: Cisco Systems, Inc", false);
                        
                        // Create analysis results file
                        this.fileSystem.writeFile('/home/user/wifi/analysis.txt', 
                            'Network: CORP_SECURE\n' +
                            'Encryption: WPA2-PSK (CCMP)\n' +
                            'WPA2 handshake found\n' +
                            'Clients connected: 3\n' +
                            'AP Manufacturer: Cisco Systems, Inc'
                        );
                        
                        // Check mission objective
                        if (mission) {
                            this.missionManager.checkCommandObjective(
                                mission.id, 
                                "wifi analyze", 
                                "WPA2 handshake found"
                            );
                        }
                    }, 2000);
                } catch (error) {
                    this.addOutput(`Error analyzing capture: ${error}`, true);
                }
                break;
                
            case 'crack':
                if (args.length < 4) {
                    this.addOutput("Usage: wifi crack <ssid> <wordlist>", true);
                    return;
                }
                
                const networkToCrack = args[2];
                const wordlistPath = args[3];
                
                if (!this.fileSystem.fileExists('/home/user/wifi/capture.cap')) {
                    this.addOutput("No capture file found. Use 'wifi capture <ssid>' first.", true);
                    return;
                }
                
                if (!this.fileSystem.fileExists(wordlistPath)) {
                    this.addOutput(`Wordlist file not found: ${wordlistPath}`, true);
                    return;
                }
                
                this.addOutput(`Attempting to crack password for ${networkToCrack} using wordlist ${wordlistPath}...`, false);
                
                if (networkToCrack === "CORP_SECURE" && wordlistPath.includes("wordlist")) {
                    try {
                        // Simulate password cracking process
                        setTimeout(() => {
                            this.addOutput("Trying passwords... 10% complete", false);
                        }, 1000);
                        
                        setTimeout(() => {
                            this.addOutput("Trying passwords... 38% complete", false);
                        }, 2000);
                        
                        setTimeout(() => {
                            this.addOutput("Trying passwords... 64% complete", false);
                        }, 3000);
                        
                        setTimeout(() => {
                            this.addOutput("Trying passwords... 89% complete", false);
                        }, 4000);
                        
                        setTimeout(() => {
                            this.addOutput("Password found: corporate2023", false);
                            this.addOutput("Time taken: 00:04:35", false);
                            this.addOutput("Saved result to /home/user/wifi/cracked.txt", false);
                            
                            // Create the result file
                            this.fileSystem.writeFile('/home/user/wifi/cracked.txt', 
                                'SSID: CORP_SECURE\n' +
                                'Password: corporate2023\n' +
                                'Time taken: 00:04:35\n' +
                                'Method: Dictionary attack'
                            );
                            
                            // Check mission objective
                            if (mission) {
                                this.missionManager.checkCommandObjective(
                                    mission.id, 
                                    `wifi crack CORP_SECURE ${wordlistPath}`, 
                                    "Password found: corporate2023"
                                );
                            }
                        }, 5000);
                    } catch (error) {
                        this.addOutput(`Error during password cracking: ${error}`, true);
                    }
                } else {
                    try {
                        setTimeout(() => {
                            this.addOutput(`Could not crack password for ${networkToCrack}. Try a different wordlist or network.`, false);
                        }, 3000);
                    } catch (error) {
                        this.addOutput(`Error during password cracking: ${error}`, true);
                    }
                }
                break;
                
            case 'connect':
                if (args.length < 4) {
                    this.addOutput("Usage: wifi connect <ssid> <password>", true);
                    return;
                }
                
                const networkToConnect = args[2];
                const password = args[3];
                
                this.addOutput(`Attempting to connect to ${networkToConnect}...`, false);
                
                if (networkToConnect === "CORP_SECURE" && password === "corporate2023") {
                    try {
                        setTimeout(() => {
                            this.addOutput("Authentication successful", false);
                            this.addOutput("Successfully connected to CORP_SECURE", false);
                            this.addOutput("Assigned IP address: 192.168.1.105", false);
                            this.addOutput("Gateway: 192.168.1.1", false);
                            this.addOutput("DNS: 192.168.1.1", false);
                            
                            // Check mission objective
                            if (mission) {
                                this.missionManager.checkCommandObjective(
                                    mission.id, 
                                    "wifi connect CORP_SECURE corporate2023", 
                                    "Successfully connected to CORP_SECURE"
                                );
                            }
                        }, 2000);
                    } catch (error) {
                        this.addOutput(`Error connecting to network: ${error}`, true);
                    }
                } else {
                    try {
                        setTimeout(() => {
                            this.addOutput(`Failed to connect to ${networkToConnect}. Authentication failed.`, true);
                        }, 1500);
                    } catch (error) {
                        this.addOutput(`Error connecting to network: ${error}`, true);
                    }
                }
                break;
                
            default:
                this.addOutput(`Unknown wifi subcommand: ${args[1]}`, true);
                this.addOutput("Available subcommands: scan, capture, analyze, crack, connect", false);
        }
    }

    /**
     * Shows a mission completion popup
     * @param missionId The ID of the completed mission
     */
    private showMissionCompletionPopup(missionId: string): void {
        const mission = this.missionManager.getMission(missionId);
        if (!mission) return;
        
        // Create and show the mission completion popup
        const popup = new MissionCompletionPopup(mission);
        this.addChild(popup);
        
        // Center the popup
        popup.x = (this.width - popup.width) / 2;
        popup.y = (this.height - popup.height) / 2;
        
        // Update player stats
        // Note: These need to be implemented in PlayerStatusBar
        // this.playerStatusBar.updateExperience(mission.reward.xp);
        // this.playerStatusBar.updateSkillLevel(mission.reward.skillPoints);
        
        // Reset active mission
        // Note: This method needs to be implemented in MissionManager
        // this.missionManager.resetActiveMission();
        
        // Show a message in the terminal
        this.addOutput(`Mission completed: ${mission.title}`, false);
        this.addOutput(`Rewards: ${mission.reward.xp} XP`, false);
        this.addOutput("Type 'mission list' to see available missions", false);
    }

    /**
     * Handle keyboard input events
     */
    private handleKeyPress(event: KeyboardEvent): void {
        // Since this is just keyboard input, we process all keys
        // regardless of where the cursor is. The mission panel will
        // handle its own scrolling events separately.

        if (this.state === TerminalState.NORMAL) {
            switch (event.key) {
                case "Enter":
                    // Process the command
                    const input = this.currentInput.text;
                    if (input.trim()) {
                        this.addOutput(this.getCurrentPrompt() + input);
                        this.handleCommand(input);
                        
                        // Add to command history
                        this.commandHistory.unshift(input);
                        this.historyIndex = -1;
                    } else {
                        this.addOutput(this.getCurrentPrompt());
                    }
                    this.currentInput.text = "";
                    break;
                    
                case "Backspace":
                    if (this.currentInput.text.length > 0) {
                        this.currentInput.text = this.currentInput.text.slice(0, -1);
                    }
                    break;
                    
                case "c":
                    if ((event as KeyboardEvent).ctrlKey) {
                        // Handle Ctrl+C
                        this.addOutput(this.getCurrentPrompt() + this.currentInput.text);
                        this.addOutput("^C");
                        this.currentInput.text = "";
                        this.historyIndex = -1;
                    } else if ((event as KeyboardEvent).key.length === 1) {
                        this.currentInput.text += (event as KeyboardEvent).key;
                    }
                    break;
                
                case "l":
                    if ((event as KeyboardEvent).ctrlKey) {
                        // Handle Ctrl+L (clear screen)
                        this.clearOutput();
                    } else if ((event as KeyboardEvent).key.length === 1) {
                        this.currentInput.text += (event as KeyboardEvent).key;
                    }
                    break;
                    
                case "ArrowUp":
                    // Navigate command history
                    if (this.commandHistory.length > 0) {
                        this.historyIndex = Math.min(this.commandHistory.length - 1, this.historyIndex + 1);
                        this.currentInput.text = this.commandHistory[this.historyIndex];
                    }
                    break;
                    
                case "ArrowDown":
                    // Navigate command history
                    if (this.historyIndex > 0) {
                        this.historyIndex--;
                        this.currentInput.text = this.commandHistory[this.historyIndex];
                    } else if (this.historyIndex === 0) {
                        this.historyIndex = -1;
                        this.currentInput.text = "";
                    }
                    break;
                
                default:
                    if ((event as KeyboardEvent).key.length === 1 && 
                        !(event as KeyboardEvent).ctrlKey && 
                        !(event as KeyboardEvent).altKey && 
                        !(event as KeyboardEvent).metaKey) {
                        this.currentInput.text += (event as KeyboardEvent).key;
                    }
                    break;
            }
        }
    }

    /**
     * Process command for pipes and redirections
     */
    private processPipesAndRedirections(command: string): string[] {
        // For now, just split by pipe character
        const pipeCommands = command.split('|').map(cmd => cmd.trim());
        return pipeCommands;
    }

    /**
     * Process environment variables in the command
     */
    private processEnvironmentVariables(command: string): string {
        // Replace $VAR or ${VAR} with environment variable values
        const regex = /\$(\w+)|\$\{(\w+)\}/g;
        return command.replace(regex, (match, varName1, varName2) => {
            const varName = varName1 || varName2;
            return this.environmentVariables[varName] || match;
        });
    }

    /**
     * Process command aliases
     */
    private processAliases(command: string): string {
        const firstWord = command.split(' ')[0];
        if (this.aliases[firstWord]) {
            return command.replace(firstWord, this.aliases[firstWord]);
        }
        return command;
    }

    /**
     * Handle ls command to list files and directories
     */
    private handleLsCommand(args: string[]): void {
        const path = args[1] || this.fileSystem.getCurrentPath();
        const showAll = args.includes('-a') || args.includes('--all');
        const showLong = args.includes('-l') || args.includes('--long');
        
        try {
            const entries = this.fileSystem.listFiles(path);
            
            if (entries.length === 0) {
                return;
            }
            
            // Filter out hidden files (starting with .) unless -a is specified
            const filteredEntries = showAll ? entries : entries.filter(entry => !entry.startsWith('.'));
            
            if (showLong) {
                // Long format display
                this.addOutput("total " + filteredEntries.length);
                filteredEntries.forEach((entry: string) => {
                    // Simple display - we're using string entries from the FileSystem class
                    this.addOutput(entry);
                });
            } else {
                // Simple display format
                filteredEntries.forEach((item: string) => {
                    const isDir = item.endsWith('/');
                    const color = isDir ? 0x4682B4 : 0xFFFFFF;
                    this.addOutput(item, false, color);
                });
            }
        } catch (error) {
            this.addOutput(`ls: cannot access '${path}': No such file or directory`, true);
        }
    }
    
    /**
     * Handle echo command to display text
     */
    private handleEchoCommand(args: string[]): void {
        // Remove the 'echo' command itself
        args.shift();
        
        // Handle redirection
        let outputText = args.join(' ');
        let redirectToFile = false;
        let appendToFile = false;
        let fileName = '';
        
        // Check for redirection
        if (outputText.includes(' > ')) {
            redirectToFile = true;
            const parts = outputText.split(' > ');
            outputText = parts[0];
            fileName = parts[1].trim();
        } else if (outputText.includes(' >> ')) {
            redirectToFile = true;
            appendToFile = true;
            const parts = outputText.split(' >> ');
            outputText = parts[0];
            fileName = parts[1].trim();
        }
        
        // Remove quotes if present
        if ((outputText.startsWith('"') && outputText.endsWith('"')) || 
            (outputText.startsWith("'") && outputText.endsWith("'"))) {
            outputText = outputText.substring(1, outputText.length - 1);
        }
        
        if (redirectToFile) {
            try {
                if (appendToFile && this.fileSystem.fileExists(fileName)) {
                    const currentContent = this.fileSystem.readFile(fileName);
                    this.fileSystem.writeFile(fileName, currentContent + '\n' + outputText);
                } else {
                    this.fileSystem.writeFile(fileName, outputText);
                }
            } catch (error) {
                this.addOutput(`echo: ${error}`, true);
            }
        } else {
            this.addOutput(outputText);
        }
    }
    
    /**
     * Handle cat command to display file contents
     */
    private handleCatCommand(args: string[]): void {
        if (args.length < 2) {
            this.addOutput("Usage: cat <file>", true);
            return;
        }
        
        const filePath = args[1];
        
        try {
            const content = this.fileSystem.readFile(filePath);
            if (content !== null) {
                this.addOutput(content);
            } else {
                this.addOutput(`cat: ${filePath}: No such file or directory`, true);
            }
        } catch (error) {
            this.addOutput(`cat: ${filePath}: No such file or directory`, true);
        }
    }

    /**
     * Start nano editor for a file
     */
    private startNano(filename: string): void {
        const exists = this.fileSystem.fileExists(filename);
        const fileContent = exists ? this.fileSystem.readFile(filename) || '' : '';
        
        // Create a new nano state
        this.nanoState = {
            content: fileContent,
            filename: filename,
            lines: fileContent.split('\n'),
            cursorY: 0,
            cursorX: 0,
            message: exists ? '' : 'New File',
            modified: false,
            selection: null,
            scrollY: 0,
            linesToShow: Math.floor((this.height - 80) / this.LINE_HEIGHT),
            syntaxHighlighting: filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.json'),
            searchTerm: '',
            searchResults: [],
            currentSearchIndex: -1
        };
        
        // Set terminal state to nano
        this.state = TerminalState.NANO;
        
        // Hide cursor for terminal and set up nano display
        this.cursorGraphics.visible = false;
        this.currentInput.visible = false;
        
        // Draw nano interface
        this.drawNanoInterface();
    }

    /**
     * Handle nmap network scanning command
     */
    private handleNmapCommand(args: string[]): void {
        const subcommand = args.length > 1 ? args[1] : 'help';
        
        switch (subcommand) {
            case 'scan':
                // Simulate a network scan
                this.addOutput("Starting Nmap scan...", false);
                setTimeout(() => {
                    this.addOutput("Scanning for hosts on network...", false);
                    
                    setTimeout(() => {
                        this.addOutput("Found 5 hosts on the network:", false);
                        this.addOutput("192.168.1.1     router.local    (Router)", false);
                        this.addOutput("192.168.1.15    laptop.local    (User's Computer)", false);
                        this.addOutput("192.168.1.20    server.local    (Target Server)", false);
                        this.addOutput("192.168.1.25    printer.local   (Network Printer)", false);
                        this.addOutput("192.168.1.30    mobile.local    (Mobile Device)", false);
                        
                        // Check if this is part of a mission objective
                        const activeMissionId = this.missionManager.getActiveMissionId();
                        if (activeMissionId) {
                            const mission = this.missionManager.getMission(activeMissionId);
                            if (mission) {
                                this.missionManager.checkCommandObjective(
                                    activeMissionId,
                                    "nmap scan",
                                    "Found 5 hosts on the network"
                                );
                            }
                        }
                    }, 2000);
                }, 1000);
                break;
                
            case 'analyze':
                this.addOutput("Analyzing target server (192.168.1.20)...", false);
                setTimeout(() => {
                    this.addOutput("Port scanning target...", false);
                    
                    setTimeout(() => {
                        this.addOutput("Open ports on 192.168.1.20:", false);
                        this.addOutput("PORT     STATE  SERVICE       VERSION", false);
                        this.addOutput("22/tcp   open   ssh           OpenSSH 7.9", false);
                        this.addOutput("80/tcp   open   http          Apache 2.4.41", false);
                        this.addOutput("443/tcp  open   https         Apache 2.4.41", false);
                        this.addOutput("3306/tcp open   mysql         MySQL 5.7.32", false);
                        this.addOutput("8080/tcp open   http-proxy    Nginx 1.18.0", false);
                    }, 2000);
                }, 1000);
                break;
                
            case 'help':
            default:
                this.addOutput("Nmap Network Scanning Tool - Commands:", false);
                this.addOutput("  nmap scan           - Scan for hosts on the network", false);
                this.addOutput("  nmap analyze        - Analyze open ports on target server", false);
                this.addOutput("  nmap help           - Show this help message", false);
                break;
        }
    }
    
    /**
     * Draw nano editor interface (placeholder for actual implementation)
     */
    private drawNanoInterface(): void {
        if (!this.nanoState) return;
        
        // Clear terminal output first
        this.clearOutput();
        
        // Draw file content
        const visibleLines = this.nanoState?.lines.slice(
            this.nanoState?.scrollY || 0, 
            (this.nanoState?.scrollY || 0) + (this.nanoState?.linesToShow || 10)
        ) || [];
        
        visibleLines.forEach((line, index) => {
            // Highlight the current line
            const isCurrentLine = (this.nanoState?.scrollY || 0) + index === (this.nanoState?.cursorY || 0);
            this.addOutput(line, false, isCurrentLine ? 0xDDDDDD : 0xFFFFFF);
        });
        
        // Draw status bar at bottom
        const modified = this.nanoState?.modified ? "Modified" : "";
        const filename = this.nanoState?.filename;
        const position = `${(this.nanoState?.cursorY || 0) + 1},${(this.nanoState?.cursorX || 0) + 1}`;
        
        // Add some empty lines to push the status to the bottom
        const emptyLinesToAdd = (this.nanoState?.linesToShow || 10) - visibleLines.length;
        for (let i = 0; i < emptyLinesToAdd; i++) {
            this.addOutput("", false);
        }
        
        // Add status bar
        this.addOutput("^G Help    ^O Write Out    ^W Search    ^K Cut    ^T Execute", false, 0x000000);
        this.addOutput("^X Exit    ^R Read File    ^\ Replace   ^U Paste  ^J Justify", false, 0x000000);
        this.addOutput(`${filename} ${modified} ${position}`, false, 0x000000);
        
        // Show any message
        if (this.nanoState?.message) {
            this.addOutput(this.nanoState?.message || "", false, 0x00FF00);
        }
    }

    // New method to position the PlayerStatusBar at the top of the sidebar
    private positionPlayerStatusBar(): void {
        // Position the player status bar at the top-right (top of the sidebar)
        this.playerStatusBar.x = this.terminalWidth - this.MISSION_PANEL_WIDTH;
        this.playerStatusBar.y = 0;
    }
} 