import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { FileSystem } from "../../utils/FileSystem";
import { MissionPanel } from "../components/MissionPanel";

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

    // Add padding constants
    private PADDING_X = 12;
    private PADDING_Y = 12;
    private LINE_HEIGHT = 20;
    private FONT_SIZE = 14;
    private CURSOR_BLINK_SPEED = 530;
    private HISTORY_SIZE = 1000;
    private commandHistory: string[] = [];
    private historyIndex: number = -1;
    private terminalWidth = 0;
    private terminalHeight = 0;
    private MISSION_PANEL_WIDTH = 300;

    private textStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0xf8f8f2,  // Will be updated from theme
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: this.LINE_HEIGHT,
        align: 'left'
    });

    private promptStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0x50fa7b,  // Will be updated from theme
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: this.LINE_HEIGHT,
        align: 'left'
    });

    private errorStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0xff5555,  // Will be updated from theme
        fontWeight: "400",
        letterSpacing: 0,
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

        // Create mission panel
        this.missionPanel = new MissionPanel();
        this.addChild(this.missionPanel);

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
        const commands = [
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
            { cmd: "grep <pattern> <file>", desc: "Search for pattern in files" },
            { cmd: "find <path> [expression]", desc: "Search for files" },
            { cmd: "rm <file>", desc: "Remove files or directories" },
            { cmd: "cp <source> <dest>", desc: "Copy files or directories" },
            { cmd: "mv <source> <dest>", desc: "Move files or directories" },
            { cmd: "chmod <mode> <file>", desc: "Change file permissions" },
            { cmd: "chown <owner> <file>", desc: "Change file owner" },
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
            { cmd: "ftp <host>", desc: "Connect to FTP server" },
            { cmd: "theme <theme>", desc: "Change terminal theme" },
            { cmd: "next", desc: "Show next mission" },
            { cmd: "prev", desc: "Show previous mission" }
        ];
        
        // Find the longest command to align descriptions
        const longestCmd = Math.max(...commands.map(cmd => cmd.cmd.length));
        const helpText = ["\x1b[1mAvailable commands:\x1b[0m"];
        
        commands.forEach(({ cmd, desc }) => {
            // Pad command with spaces to align all descriptions
            const paddedCmd = cmd.padEnd(longestCmd + 2);
            helpText.push(`  \x1b[36m${paddedCmd}\x1b[0m ${desc}`);
        });
        
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
                        this.missionPanel.completeMission('intro');
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
                        this.missionPanel.completeMission('files');
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
                        this.missionPanel.completeMission('files');
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
                        this.missionPanel.completeMission('advanced');
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
                    this.missionPanel.completeMission('advanced');
                    break;
                case 'nano':
                    if (args.length < 2) {
                        this.addOutput('nano: missing file operand', true);
                        return;
                    }
                    
                    try {
                        this.startNano(args[1]);
                        this.missionPanel.completeMission('advanced');
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
                    this.missionPanel.completeMission('advanced');
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
                // New commands
                case 'grep':
                    this.handleGrepCommand(args);
                    break;
                case 'find':
                    this.handleFindCommand(args);
                    break;
                case 'rm':
                    this.handleRmCommand(args);
                    break;
                case 'cp':
                    this.handleCpCommand(args);
                    break;
                case 'mv':
                    this.handleMvCommand(args);
                    break;
                case 'chmod':
                    this.handleChmodCommand(args);
                    break;
                case 'chown':
                    this.handleChownCommand(args);
                    break;
                case 'history':
                    this.showCommandHistory();
                    break;
                case 'ps':
                    this.handlePsCommand();
                    break;
                case 'df':
                    this.handleDfCommand(args);
                    break;
                case 'date':
                    this.addOutput(new Date().toString());
                    break;
                case 'uname':
                    this.handleUnameCommand(args);
                    break;
                case 'alias':
                    this.handleAliasCommand(args);
                    break;
                case 'theme':
                    if (args.length > 1) {
                        this.setTheme(args[1]);
                    } else {
                        this.addOutput(`Current theme: ${this.currentTheme.name}`);
                        this.addOutput(`Available themes: ${Object.keys(THEMES).join(', ')}`);
                    }
                    break;
                case 'whoami':
                    this.addOutput(this.environmentVariables["USER"] || "user");
                    break;
                case 'env':
                case 'printenv':
                    this.printEnvironmentVariables();
                    break;
                case 'export':
                    this.handleExportCommand(args);
                    break;
                case 'man':
                    this.handleManCommand(args);
                    break;
                case 'less':
                    this.handleLessCommand(args);
                    break;
                default:
                    // Check if it's an executable in the path
                    if (this.fileSystem.isExecutable(cmd)) {
                        this.addOutput(`Executing ${cmd}...`);
                        this.addOutput(`${cmd} executed successfully.`);
                    } else {
                        this.addOutput(`${cmd}: command not found`, true);
                    }
                    break;
            }
        } catch (err: any) {
            this.addOutput(`Error: ${err?.message || 'An unknown error occurred'}`, true);
        }
    }

    private processPipesAndRedirections(command: string): string[] {
        // Basic implementation - just split by pipes
        // In a real implementation, this would handle quotes, escapes, etc.
        return command.split('|');
    }

    private processEnvironmentVariables(command: string): string {
        // Replace environment variables in the command
        // e.g. echo $HOME becomes echo /home/user
        return command.replace(/\$([A-Za-z0-9_]+)/g, (_, varName) => {
            return this.environmentVariables[varName] || '';
        });
    }

    private processAliases(command: string): string {
        // Check if the command matches an alias
        const parts = command.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        
        if (this.aliases[cmd]) {
            // Replace the alias with its definition
            const aliasDefinition = this.aliases[cmd];
            const args = parts.slice(1).join(' ');
            return `${aliasDefinition} ${args}`.trim();
        }
        
        return command;
    }

    private handleLsCommand(args: string[]): void {
        // Parse ls command options
        let showHidden = false;
        let longFormat = false;
        let targetPath = '.';
        
        for (let i = 1; i < args.length; i++) {
            if (args[i].startsWith('-')) {
                if (args[i].includes('a')) showHidden = true;
                if (args[i].includes('l')) longFormat = true;
            } else {
                targetPath = args[i];
            }
        }
        
        try {
            const files = this.fileSystem.listFiles(targetPath, { 
                showHidden, 
                longFormat 
            });
            
            if (longFormat) {
                // In long format, each file is on its own line
                this.addOutput(files.join('\n') || 'Directory is empty');
            } else {
                // In normal format, files are in columns
                this.addOutput(files.length ? files.join('  ') : 'Directory is empty');
            }
            
            this.missionPanel.completeMission('intro');
        } catch (err: any) {
            this.addOutput(`ls: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private handleEchoCommand(args: string[]): void {
        if (args.length < 2) {
            this.addOutput('');
            return;
        }
        
        // Check for redirection
        const commandText = args.join(' ');
        
        if (commandText.includes('>')) {
            const redirectIndex = commandText.indexOf('>');
            const isAppend = commandText.charAt(redirectIndex + 1) === '>';
            const outputStartIndex = isAppend ? redirectIndex + 2 : redirectIndex + 1;
            
            // Extract the file name after the redirection
            const parts = commandText.slice(outputStartIndex).trim().split(' ');
            const fileName = parts[0];
            
            if (!fileName) {
                this.addOutput('echo: no file specified for redirection', true);
                return;
            }
            
            // Extract the content before the redirection
            const content = commandText.slice(4, redirectIndex).trim();
            
            try {
                if (isAppend) {
                    // Append to file
                    const existingContent = this.fileSystem.readFile(fileName) || '';
                    this.fileSystem.writeFile(fileName, existingContent + '\n' + content);
                } else {
                    // Overwrite file
                    this.fileSystem.writeFile(fileName, content);
                }
                this.missionPanel.completeMission('files');
            } catch (err: any) {
                this.addOutput(`echo: ${err?.message || 'Unknown error'}`, true);
            }
        } else {
            // Just echo to terminal
            this.addOutput(args.slice(1).join(' '));
        }
    }

    private handleCatCommand(args: string[]): void {
        if (args.length < 2) {
            this.addOutput('cat: missing file operand', true);
            return;
        }
        
        try {
            // Support for multiple files
            for (let i = 1; i < args.length; i++) {
                const content = this.fileSystem.readFile(args[i]);
                if (content !== null) {
                    this.addOutput(content || '');
                    this.missionPanel.completeMission('files');
                } else {
                    this.addOutput(`cat: ${args[i]}: No such file or directory`, true);
                }
            }
        } catch (err: any) {
            this.addOutput(`cat: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private handleGrepCommand(args: string[]): void {
        if (args.length < 3) {
            this.addOutput('Usage: grep [OPTION]... PATTERN [FILE]...', true);
            return;
        }
        
        const pattern = args[1];
        const filenames = args.slice(2);
        
        try {
            for (const filename of filenames) {
                const content = this.fileSystem.readFile(filename);
                if (content === null) {
                    this.addOutput(`grep: ${filename}: No such file or directory`, true);
                    continue;
                }
                
                const lines = content.split('\n');
                const matchingLines = lines.filter(line => line.includes(pattern));
                
                if (matchingLines.length > 0) {
                    if (filenames.length > 1) {
                        // If multiple files, prefix each match with filename
                        for (const line of matchingLines) {
                            this.addOutput(`${filename}:${line}`);
                        }
                    } else {
                        // Just show matching lines for single file
                        for (const line of matchingLines) {
                            this.addOutput(line);
                        }
                    }
                }
            }
        } catch (err: any) {
            this.addOutput(`grep: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private handleFindCommand(args: string[]): void {
        if (args.length < 2) {
            this.addOutput('Usage: find [path] [expression]', true);
            return;
        }
        
        // Very simple implementation, just list all files recursively
        try {
            const path = args[1] === '.' ? this.fileSystem.getCurrentPath() : args[1];
            const results = this.fileSystem.findFiles(path);
            
            for (const file of results) {
                this.addOutput(file);
            }
        } catch (err: any) {
            this.addOutput(`find: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private handleRmCommand(args: string[]): void {
        if (args.length < 2) {
            this.addOutput('rm: missing operand', true);
            return;
        }
        
        const recursive = args.includes('-r') || args.includes('-R') || args.includes('--recursive');
        const force = args.includes('-f') || args.includes('--force');
        
        // Get the file/directory name (last argument)
        let target = args[args.length - 1];
        
        try {
            const success = this.fileSystem.removeFile(target, { recursive, force });
            if (!success && !force) {
                this.addOutput(`rm: cannot remove '${target}': Permission denied`, true);
            }
        } catch (err: any) {
            this.addOutput(`rm: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private handleCpCommand(args: string[]): void {
        if (args.length < 3) {
            this.addOutput('Usage: cp [OPTION]... SOURCE DEST', true);
            return;
        }
        
        const source = args[args.length - 2];
        const destination = args[args.length - 1];
        const recursive = args.includes('-r') || args.includes('-R') || args.includes('--recursive');
        
        try {
            this.fileSystem.copyFile(source, destination, { recursive });
        } catch (err: any) {
            this.addOutput(`cp: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private handleMvCommand(args: string[]): void {
        if (args.length < 3) {
            this.addOutput('Usage: mv [OPTION]... SOURCE DEST', true);
            return;
        }
        
        const source = args[args.length - 2];
        const destination = args[args.length - 1];
        
        try {
            this.fileSystem.moveFile(source, destination);
        } catch (err: any) {
            this.addOutput(`mv: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private handleChmodCommand(args: string[]): void {
        if (args.length < 3) {
            this.addOutput('Usage: chmod [OPTION]... MODE FILE...', true);
            return;
        }
        
        const mode = args[1];
        const files = args.slice(2);
        
        try {
            for (const file of files) {
                this.fileSystem.changePermissions(file, mode);
            }
        } catch (err: any) {
            this.addOutput(`chmod: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private handleChownCommand(args: string[]): void {
        if (args.length < 3) {
            this.addOutput('Usage: chown [OPTION]... OWNER[:GROUP] FILE...', true);
            return;
        }
        
        const owner = args[1];
        const files = args.slice(2);
        
        try {
            for (const file of files) {
                this.fileSystem.changeOwner(file, owner);
            }
        } catch (err: any) {
            this.addOutput(`chown: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private showCommandHistory(): void {
        // Display command history with line numbers
        this.commandHistory.forEach((cmd, index) => {
            this.addOutput(` ${this.commandHistory.length - index}\t${cmd}`);
        });
    }

    private handlePsCommand(): void {
        // Simulate a basic ps output
        this.addOutput('  PID TTY          TIME CMD');
        this.addOutput('    1 tty1     00:00:01 init');
        this.addOutput('  123 tty1     00:00:00 bash');
        this.addOutput('  456 tty1     00:00:00 terminal-game');
    }

    private handleDfCommand(args: string[]): void {
        const humanReadable = args.includes('-h') || args.includes('--human-readable');
        
        // Simulate a basic df output
        this.addOutput('Filesystem     Size  Used Avail Use% Mounted on');
        if (humanReadable) {
            this.addOutput('/dev/sda1       50G   15G   35G  30% /');
            this.addOutput('tmpfs           4.0G     0  4.0G   0% /dev/shm');
        } else {
            this.addOutput('/dev/sda1       52428800  15728640  36700160  30% /');
            this.addOutput('tmpfs           4194304       0     4194304   0% /dev/shm');
        }
    }

    private handleUnameCommand(args: string[]): void {
        if (args.includes('-a') || args.includes('--all')) {
            this.addOutput('TerminalOS 1.0 #1 SMP Terminal Game 5.10.0 x86_64 GNU/Linux');
        } else {
            this.addOutput('TerminalOS');
        }
    }

    private handleAliasCommand(args: string[]): void {
        if (args.length === 1) {
            // Display all aliases
            for (const [alias, command] of Object.entries(this.aliases)) {
                this.addOutput(`alias ${alias}='${command}'`);
            }
        } else if (args.length >= 2) {
            if (args[1].includes('=')) {
                // Define a new alias
                const parts = args[1].split('=');
                const alias = parts[0];
                let command = parts[1] || '';
                
                // Handle quoted command with spaces
                if (command.startsWith("'") && !command.endsWith("'")) {
                    // Find the closing quote
                    for (let i = 2; i < args.length; i++) {
                        command += ' ' + args[i];
                        if (args[i].endsWith("'")) break;
                    }
                }
                
                // Remove quotes
                command = command.replace(/^'|'$/g, '');
                
                this.aliases[alias] = command;
                this.addOutput(`Alias '${alias}' created.`);
            } else {
                // Show specific alias
                const alias = args[1];
                if (this.aliases[alias]) {
                    this.addOutput(`alias ${alias}='${this.aliases[alias]}'`);
                } else {
                    this.addOutput(`alias: ${alias}: not found`, true);
                }
            }
        }
    }

    private printEnvironmentVariables(): void {
        for (const [key, value] of Object.entries(this.environmentVariables)) {
            this.addOutput(`${key}=${value}`);
        }
    }

    private handleExportCommand(args: string[]): void {
        if (args.length < 2) {
            this.printEnvironmentVariables();
            return;
        }
        
        for (let i = 1; i < args.length; i++) {
            const arg = args[i];
            
            if (arg.includes('=')) {
                // Setting a variable
                const parts = arg.split('=');
                const name = parts[0];
                const value = parts[1].replace(/^"|"$/g, '').replace(/^'|'$/g, '');
                
                this.environmentVariables[name] = value;
            } else {
                // Exporting a variable without setting it
                if (!this.environmentVariables[arg]) {
                    this.environmentVariables[arg] = '';
                }
            }
        }
    }

    private handleManCommand(args: string[]): void {
        if (args.length < 2) {
            this.addOutput('What manual page do you want?', true);
            return;
        }
        
        const command = args[1];
        
        // Very basic man page simulation
        this.addOutput(`\x1b[1mNAME\x1b[0m`);
        this.addOutput(`       ${command} - brief description`);
        this.addOutput(`\x1b[1mSYNOPSIS\x1b[0m`);
        this.addOutput(`       ${command} [OPTION]...`);
        this.addOutput(`\x1b[1mDESCRIPTION\x1b[0m`);
        this.addOutput(`       This is a simulated man page for ${command}.`);
        this.addOutput(`       For detailed help, type 'help ${command}'.`);
    }

    private handleLessCommand(args: string[]): void {
        if (args.length < 2) {
            this.addOutput('missing filename', true);
            return;
        }
        
        try {
            const content = this.fileSystem.readFile(args[1]);
            if (content === null) {
                this.addOutput(`less: ${args[1]}: No such file or directory`, true);
                return;
            }
            
            // Simple implementation just outputs the content like cat
            // A real less implementation would handle pagination
            this.addOutput(content);
        } catch (err: any) {
            this.addOutput(`less: ${err?.message || 'Unknown error'}`, true);
        }
    }

    private startNano(filename: string): void {
        const content = this.fileSystem.readFile(filename) || "";
        const lines = content.split("\n");
        
        // Calculate how many lines can be shown based on terminal height
        const linesToShow = Math.floor((this.terminalHeight - this.PADDING_Y * 4) / this.LINE_HEIGHT) - 4; // Space for controls
        
        this.state = TerminalState.NANO;
        this.nanoState = {
            filename,
            content,
            lines,
            cursorX: 0,
            cursorY: 0,
            message: "",
            modified: false,
            selection: null,
            scrollY: 0,
            linesToShow,
            syntaxHighlighting: true,
            searchTerm: "",
            searchResults: [],
            currentSearchIndex: -1
        };
        
        this.clearOutput();
        this.renderNanoEditor();
    }

    private renderNanoEditor(): void {
        if (!this.nanoState) return;
        
        this.clearOutput();
        
        // Header
        this.addOutput(`\x1b[1;30;47m  GNU nano ${this.nanoState.filename}${this.nanoState.modified ? " (modified)" : ""}   \x1b[0m`);
        
        // Display line numbers and content
        const startLine = this.nanoState.scrollY;
        const endLine = Math.min(startLine + this.nanoState.linesToShow, this.nanoState.lines.length);
        
        for (let i = startLine; i < endLine; i++) {
            let lineText = this.nanoState.lines[i] || "";
            
            // Add line numbers if enabled
            let lineOutput = "";
            if (this.showLineNumbers) {
                const lineNum = (i + 1).toString().padStart(4, " ");
                lineOutput += `\x1b[90m${lineNum} \x1b[0m`;
            }
            
            // Highlight current line
            if (i === this.nanoState.cursorY) {
                lineOutput += `\x1b[7m${lineText}\x1b[0m`;
            } else if (this.nanoState.syntaxHighlighting) {
                // Very basic syntax highlighting
                lineOutput += this.applySyntaxHighlighting(lineText);
            } else {
                lineOutput += lineText;
            }
            
            this.addOutput(lineOutput);
        }
        
        // Fill remaining space with empty lines denoted by ~
        for (let i = endLine; i < startLine + this.nanoState.linesToShow; i++) {
            this.addOutput("\x1b[90m~\x1b[0m");
        }
        
        // Status bar
        const positionInfo = `line ${this.nanoState.cursorY + 1}/${this.nanoState.lines.length}, col ${this.nanoState.cursorX + 1}`;
        this.addOutput(`\x1b[30;46m  ${this.nanoState.message || positionInfo}  \x1b[0m`);
        
        // Controls
        const controlsText = [
            "\x1b[30;47m^G\x1b[0m Help  \x1b[30;47m^O\x1b[0m WriteOut \x1b[30;47m^W\x1b[0m Where Is \x1b[30;47m^K\x1b[0m Cut Text \x1b[30;47m^J\x1b[0m Justify",
            "\x1b[30;47m^X\x1b[0m Exit  \x1b[30;47m^R\x1b[0m Read File \x1b[30;47m^\\\x1b[0m Replace  \x1b[30;47m^U\x1b[0m Paste Text\x1b[30;47m^T\x1b[0m To Spell"
        ].join("\n");
        
        this.addOutput(controlsText);
        
        // Position cursor appropriately
        this.updateNanoCursor();
    }

    private applySyntaxHighlighting(text: string): string {
        // Very basic syntax highlighting
        // Keywords
        text = text.replace(/\b(if|else|for|while|function|return|var|let|const|class|import|export)\b/g, "\x1b[36m$1\x1b[0m");
        
        // Strings
        text = text.replace(/"([^"]*)"/g, "\x1b[32m\"$1\"\x1b[0m");
        text = text.replace(/'([^']*)'/g, "\x1b[32m'$1'\x1b[0m");
        
        // Numbers
        text = text.replace(/\b(\d+)\b/g, "\x1b[33m$1\x1b[0m");
        
        // Comments
        text = text.replace(/\/\/(.*?)$/g, "\x1b[90m//$1\x1b[0m");
        
        return text;
    }

    private updateNanoCursor(): void {
        // Just a stub for now - in a real implementation we would update the cursor position
        // This would depend on how you're handling the cursor in the nano editor
    }

    public async hide(): Promise<void> {
        clearInterval(this.cursorBlinkInterval);
        window.removeEventListener("keydown", this.handleKeyPress);
        window.removeEventListener("resize", this.handleResize);
        this.destroy();
    }

    private handleKeyPress(event: KeyboardEvent): void {
        // Handle different terminal states
        if (this.state === TerminalState.FTP) {
            if (event.key === "Enter") {
                const command = this.currentInput.text;
                if (command.trim()) {
                    this.addOutput("ftp> " + command);
                    this.handleFTPCommand(command);
                } else {
                    this.addOutput("ftp> ");
                }
                this.currentInput.text = "";
            } else if (event.key === "Backspace") {
                if (this.currentInput.text.length > 0) {
                    this.currentInput.text = this.currentInput.text.slice(0, -1);
                }
            } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                this.currentInput.text += event.key;
            }
            
            // Update cursor position
            this.cursorGraphics.x = Math.round(this.currentInput.x + this.currentInput.width);
            return;
        }
        
        if (this.state === TerminalState.FTP_PASSWORD) {
            if (event.key === "Enter") {
                const password = this.currentInput.text;
                this.addOutput("*".repeat(password.length)); // Show asterisks for password
                this.handleFTPCommand(password);
                this.currentInput.text = "";
            } else if (event.key === "Backspace") {
                if (this.currentInput.text.length > 0) {
                    this.currentInput.text = this.currentInput.text.slice(0, -1);
                }
            } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                this.currentInput.text += event.key;
            }
            
            // Update cursor position, but don't show password
            this.cursorGraphics.x = Math.round(this.currentInput.x + this.currentInput.width);
            return;
        }
        
        if (this.state === TerminalState.PASSWORD) {
            if (event.key === "Enter") {
                const password = this.currentInput.text;
                this.addOutput("*".repeat(password.length)); // Show asterisks for password
                
                if (password === this.sudoPassword) {
                    this.addOutput("Password correct.");
                    this.state = TerminalState.NORMAL;
                    // Execute the stored command
                    if (this.currentCommand) {
                        this.handleCommand(this.currentCommand);
                        this.currentCommand = "";
                    }
                } else {
                    this.passwordAttempts++;
                    if (this.passwordAttempts >= this.maxPasswordAttempts) {
                        this.addOutput("sudo: 3 incorrect password attempts");
                        this.state = TerminalState.NORMAL;
                        this.passwordAttempts = 0;
                    } else {
                        this.addOutput("[sudo] password for user: ");
                    }
                }
                this.currentInput.text = "";
            } else if (event.key === "Backspace") {
                if (this.currentInput.text.length > 0) {
                    this.currentInput.text = this.currentInput.text.slice(0, -1);
                }
            } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                this.currentInput.text += event.key;
            }
            
            // Update cursor position, but don't show password
            this.cursorGraphics.x = Math.round(this.currentInput.x + this.currentInput.width);
            return;
        }
        
        if (this.state === TerminalState.NANO) {
            if (event.key === "x" && event.ctrlKey) {
                // Exit nano
                if (this.nanoState && this.nanoState.modified) {
                    this.addOutput("Save modified buffer (ANSWERING \"No\" WILL DESTROY CHANGES) ? ");
                    this.addOutput("      Y Yes");
                    this.addOutput("      N No");
                    this.addOutput("      ^C Cancel");
                    
                    // For now, we'll implement a crude dialog state
                    this.nanoState.message = "Exit without saving? (Y/N)";
                    this.renderNanoEditor();
                    
                    // handleKeyPress will need to check for Y/N/^C responses
                    // For now, just exit without saving
                    this.state = TerminalState.NORMAL;
                    this.nanoState = null;
                    this.clearOutput();
                    this.addOutput("File closed without saving.");
                } else {
                    this.state = TerminalState.NORMAL;
                    this.nanoState = null;
                    this.clearOutput();
                    this.addOutput("File closed.");
                }
            } else if (event.key === "o" && event.ctrlKey) {
                // Save file
                if (this.nanoState) {
                    try {
                        this.fileSystem.writeFile(this.nanoState.filename, this.nanoState.lines.join('\n'));
                        this.nanoState.modified = false;
                        this.nanoState.message = `Saved ${this.nanoState.filename}`;
                        this.renderNanoEditor();
                    } catch (err: any) {
                        this.nanoState.message = `Error writing ${this.nanoState.filename}: ${err?.message || 'Unknown error'}`;
                        this.renderNanoEditor();
                    }
                }
            } else if (event.key === "g" && event.ctrlKey) {
                // Show help
                if (this.nanoState) {
                    this.nanoState.message = "Help: ^X Exit, ^O Save, ^W Search, Arrow keys to navigate";
                    this.renderNanoEditor();
                }
            } else if (event.key === "w" && event.ctrlKey) {
                // Search
                if (this.nanoState) {
                    this.nanoState.message = "Search: ";
                    this.nanoState.searchTerm = "";
                    this.renderNanoEditor();
                    // We would need additional state to handle search input
                }
            } else if (event.key === "k" && event.ctrlKey) {
                // Cut line
                if (this.nanoState) {
                    this.nanoState.lines.splice(this.nanoState.cursorY, 1);
                    if (this.nanoState.lines.length === 0) {
                        this.nanoState.lines = [""];
                    }
                    this.nanoState.modified = true;
                    this.nanoState.message = "Line cut";
                    if (this.nanoState.cursorY >= this.nanoState.lines.length) {
                        this.nanoState.cursorY = this.nanoState.lines.length - 1;
                    }
                    this.nanoState.cursorX = Math.min(this.nanoState.cursorX, this.nanoState.lines[this.nanoState.cursorY].length);
                    this.renderNanoEditor();
                }
            } else if (event.key === "ArrowUp") {
                // Move cursor up
                if (this.nanoState && this.nanoState.cursorY > 0) {
                    this.nanoState.cursorY--;
                    // Adjust horizontal position if necessary
                    this.nanoState.cursorX = Math.min(this.nanoState.cursorX, this.nanoState.lines[this.nanoState.cursorY].length);
                    
                    // Scroll if necessary
                    if (this.nanoState.cursorY < this.nanoState.scrollY) {
                        this.nanoState.scrollY = this.nanoState.cursorY;
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "ArrowDown") {
                // Move cursor down
                if (this.nanoState && this.nanoState.cursorY < this.nanoState.lines.length - 1) {
                    this.nanoState.cursorY++;
                    // Adjust horizontal position if necessary
                    this.nanoState.cursorX = Math.min(this.nanoState.cursorX, this.nanoState.lines[this.nanoState.cursorY].length);
                    
                    // Scroll if necessary
                    if (this.nanoState.cursorY >= this.nanoState.scrollY + this.nanoState.linesToShow) {
                        this.nanoState.scrollY = this.nanoState.cursorY - this.nanoState.linesToShow + 1;
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "ArrowLeft") {
                // Move cursor left
                if (this.nanoState && this.nanoState.cursorX > 0) {
                    this.nanoState.cursorX--;
                    this.renderNanoEditor();
                } else if (this.nanoState && this.nanoState.cursorY > 0) {
                    // Move to end of previous line
                    this.nanoState.cursorY--;
                    this.nanoState.cursorX = this.nanoState.lines[this.nanoState.cursorY].length;
                    
                    // Scroll if necessary
                    if (this.nanoState.cursorY < this.nanoState.scrollY) {
                        this.nanoState.scrollY = this.nanoState.cursorY;
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "ArrowRight") {
                // Move cursor right
                if (this.nanoState && this.nanoState.lines[this.nanoState.cursorY] !== undefined && 
                    this.nanoState.cursorX < this.nanoState.lines[this.nanoState.cursorY].length) {
                    this.nanoState.cursorX++;
                    this.renderNanoEditor();
                } else if (this.nanoState && this.nanoState.cursorY < this.nanoState.lines.length - 1) {
                    // Move to beginning of next line
                    this.nanoState.cursorY++;
                    this.nanoState.cursorX = 0;
                    
                    // Scroll if necessary
                    if (this.nanoState.cursorY >= this.nanoState.scrollY + this.nanoState.linesToShow) {
                        this.nanoState.scrollY = this.nanoState.cursorY - this.nanoState.linesToShow + 1;
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "Enter") {
                // Insert new line
                if (this.nanoState) {
                    const currentLine = this.nanoState.lines[this.nanoState.cursorY];
                    const lineBeforeCursor = currentLine.substring(0, this.nanoState.cursorX);
                    const lineAfterCursor = currentLine.substring(this.nanoState.cursorX);
                    
                    this.nanoState.lines[this.nanoState.cursorY] = lineBeforeCursor;
                    this.nanoState.lines.splice(this.nanoState.cursorY + 1, 0, lineAfterCursor);
                    
                    this.nanoState.cursorY++;
                    this.nanoState.cursorX = 0;
                    this.nanoState.modified = true;
                    
                    // Scroll if necessary
                    if (this.nanoState.cursorY >= this.nanoState.scrollY + this.nanoState.linesToShow) {
                        this.nanoState.scrollY = this.nanoState.cursorY - this.nanoState.linesToShow + 1;
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "Backspace") {
                // Delete character before cursor
                if (this.nanoState) {
                    if (this.nanoState.cursorX > 0) {
                        // Delete character in current line
                        const currentLine = this.nanoState.lines[this.nanoState.cursorY];
                        this.nanoState.lines[this.nanoState.cursorY] = 
                            currentLine.substring(0, this.nanoState.cursorX - 1) + 
                            currentLine.substring(this.nanoState.cursorX);
                        
                        this.nanoState.cursorX--;
                        this.nanoState.modified = true;
                    } else if (this.nanoState.cursorY > 0) {
                        // Join with previous line
                        const previousLine = this.nanoState.lines[this.nanoState.cursorY - 1];
                        const currentLine = this.nanoState.lines[this.nanoState.cursorY];
                        
                        this.nanoState.cursorX = previousLine.length;
                        this.nanoState.lines[this.nanoState.cursorY - 1] = previousLine + currentLine;
                        this.nanoState.lines.splice(this.nanoState.cursorY, 1);
                        
                        this.nanoState.cursorY--;
                        this.nanoState.modified = true;
                        
                        // Scroll if necessary
                        if (this.nanoState.cursorY < this.nanoState.scrollY) {
                            this.nanoState.scrollY = this.nanoState.cursorY;
                        }
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "Delete") {
                // Delete character at cursor
                if (this.nanoState) {
                    const currentLine = this.nanoState.lines[this.nanoState.cursorY];
                    
                    if (this.nanoState.cursorX < currentLine.length) {
                        // Delete character in current line
                        this.nanoState.lines[this.nanoState.cursorY] = 
                            currentLine.substring(0, this.nanoState.cursorX) + 
                            currentLine.substring(this.nanoState.cursorX + 1);
                        
                        this.nanoState.modified = true;
                    } else if (this.nanoState.cursorY < this.nanoState.lines.length - 1) {
                        // Join with next line
                        const nextLine = this.nanoState.lines[this.nanoState.cursorY + 1];
                        
                        this.nanoState.lines[this.nanoState.cursorY] += nextLine;
                        this.nanoState.lines.splice(this.nanoState.cursorY + 1, 1);
                        
                        this.nanoState.modified = true;
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "PageUp") {
                // Move up a page
                if (this.nanoState) {
                    this.nanoState.cursorY = Math.max(0, this.nanoState.cursorY - this.nanoState.linesToShow);
                    this.nanoState.scrollY = Math.max(0, this.nanoState.scrollY - this.nanoState.linesToShow);
                    
                    // Adjust horizontal position if necessary
                    if (this.nanoState.lines[this.nanoState.cursorY] !== undefined) {
                        this.nanoState.cursorX = Math.min(this.nanoState.cursorX, this.nanoState.lines[this.nanoState.cursorY].length);
                    } else {
                        this.nanoState.cursorX = 0;
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "PageDown") {
                // Move down a page
                if (this.nanoState) {
                    this.nanoState.cursorY = Math.min(this.nanoState.lines.length - 1, this.nanoState.cursorY + this.nanoState.linesToShow);
                    
                    // Adjust scroll position
                    if (this.nanoState.cursorY >= this.nanoState.scrollY + this.nanoState.linesToShow) {
                        this.nanoState.scrollY = Math.min(
                            this.nanoState.lines.length - this.nanoState.linesToShow,
                            this.nanoState.cursorY - this.nanoState.linesToShow + 1
                        );
                        this.nanoState.scrollY = Math.max(0, this.nanoState.scrollY);
                    }
                    
                    // Adjust horizontal position if necessary
                    if (this.nanoState.lines[this.nanoState.cursorY] !== undefined) {
                        this.nanoState.cursorX = Math.min(this.nanoState.cursorX, this.nanoState.lines[this.nanoState.cursorY].length);
                    } else {
                        this.nanoState.cursorX = 0;
                    }
                    
                    this.renderNanoEditor();
                }
            } else if (event.key === "Home") {
                // Move to beginning of line
                if (this.nanoState) {
                    this.nanoState.cursorX = 0;
                    this.renderNanoEditor();
                }
            } else if (event.key === "End") {
                // Move to end of line
                if (this.nanoState) {
                    this.nanoState.cursorX = this.nanoState.lines[this.nanoState.cursorY].length;
                    this.renderNanoEditor();
                }
            } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                // Insert character
                if (this.nanoState) {
                    const currentLine = this.nanoState.lines[this.nanoState.cursorY];
                    
                    this.nanoState.lines[this.nanoState.cursorY] = 
                        currentLine.substring(0, this.nanoState.cursorX) + 
                        event.key + 
                        currentLine.substring(this.nanoState.cursorX);
                    
                    this.nanoState.cursorX++;
                    this.nanoState.modified = true;
                    
                    this.renderNanoEditor();
                }
            }
            return;
        }
        
        // Normal state - handle special keys
        switch (event.key) {
            case "Enter":
                const command = this.currentInput.text;
                if (command.trim()) {
                    // Add to history
                    this.commandHistory.unshift(command);
                    if (this.commandHistory.length > this.HISTORY_SIZE) {
                        this.commandHistory.pop();
                    }
                    this.historyIndex = -1;

                    // Execute command
                    this.addOutput(this.getCurrentPrompt() + command);
                    this.handleCommand(command);
                } else {
                    // Just add a new prompt on empty enter
                    this.addOutput(this.getCurrentPrompt());
                }
                this.currentInput.text = "";
                break;

            case "ArrowUp":
                event.preventDefault();
                if (this.historyIndex < this.commandHistory.length - 1) {
                    this.historyIndex++;
                    this.currentInput.text = this.commandHistory[this.historyIndex];
                }
                break;

            case "ArrowDown":
                event.preventDefault();
                if (this.historyIndex > -1) {
                    this.historyIndex--;
                    this.currentInput.text = this.historyIndex === -1 ? "" : this.commandHistory[this.historyIndex];
                }
                break;

            case "Tab":
                event.preventDefault();
                // Simple tab completion for files and commands
                if (this.currentInput.text.trim()) {
                    const parts = this.currentInput.text.trim().split(' ');
                    if (parts.length === 1) {
                        // Command completion
                        const commands = ["help", "clear", "ls", "cd", "pwd", "mkdir", "touch", "echo", "cat", "neofetch", "sudo", "nano", "ftp"];
                        const matches = commands.filter(cmd => cmd.startsWith(parts[0]));
                        if (matches.length === 1) {
                            this.currentInput.text = matches[0] + " ";
                        } else if (matches.length > 1) {
                            this.addOutput(this.getCurrentPrompt() + this.currentInput.text);
                            this.addOutput(matches.join("  "));
                        }
                    } else {
                        // File/directory completion
                        try {
                            const files = this.fileSystem.listFiles();
                            const partial = parts[parts.length - 1];
                            const matches = files.filter(file => file.startsWith(partial));
                            if (matches.length === 1) {
                                parts[parts.length - 1] = matches[0];
                                this.currentInput.text = parts.join(' ') + " ";
                            } else if (matches.length > 1) {
                                this.addOutput(this.getCurrentPrompt() + this.currentInput.text);
                                this.addOutput(matches.join("  "));
                            }
                        } catch (err) {
                            // Silently fail
                        }
                    }
                }
                break;

            case "Backspace":
                if (this.currentInput.text.length > 0) {
                    this.currentInput.text = this.currentInput.text.slice(0, -1);
                }
                break;

            case "c":
                if (event.ctrlKey) {
                    // Handle Ctrl+C
                    this.addOutput(this.getCurrentPrompt() + this.currentInput.text);
                    this.addOutput("^C");
                    this.currentInput.text = "";
                    this.historyIndex = -1;
                } else if (event.key.length === 1) {
                    this.currentInput.text += event.key;
                }
                break;

            case "l":
                if (event.ctrlKey) {
                    // Handle Ctrl+L (clear screen)
                    this.clearOutput();
                } else if (event.key.length === 1) {
                    this.currentInput.text += event.key;
                }
                break;

            default:
                if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                    this.currentInput.text += event.key;
                }
                break;
        }
        
        // Update cursor position after any key press
        this.cursorGraphics.x = Math.round(this.currentInput.x + this.currentInput.width);
    }

    private handleResize(): void {
        this.resize(window.innerWidth, window.innerHeight);
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

    private addOutput(text: string, isError: boolean = false): void {
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

                const outputText = new Text(part, isError ? this.errorStyle : this.textStyle);
                outputText.resolution = window.devicePixelRatio || 1;
                outputText.x = currentX;
                outputText.y = currentY;
                
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
} 