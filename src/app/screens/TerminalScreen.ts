import { Container, Graphics, Text, Ticker, TextStyle } from "pixi.js";
import { FileSystem } from "../../utils/FileSystem";
import { Scrollbar } from "../components/Scrollbar";
import { MissionPanel } from "../components/MissionPanel";

enum TerminalState {
    NORMAL = "normal",
    PASSWORD = "password",
    FTP = "ftp",
    FTP_PASSWORD = "ftp_password",
    NANO = "nano"
}

interface NanoState {
    content: string;
    filename: string;
    lines: string[];
    cursorY: number;
    cursorX: number;
    message: string;
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

    private terminal: Container = new Container();
    private background: Graphics = new Graphics();
    private outputContainer: Container = new Container();
    private inputLine: Container = new Container();
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
        fill: 0xb4e1fd,  // Light blue color similar to modern terminals
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: this.LINE_HEIGHT,
        align: 'left'
    });

    private promptStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0x50fa7b,  // Green color for prompt
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: this.LINE_HEIGHT,
        align: 'left'
    });

    private errorStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0xff5555,  // Red color for errors
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: this.LINE_HEIGHT,
        align: 'left'
    });

    private innerBackground: Graphics;
    private scrollbar: Scrollbar;
    private missionPanel: MissionPanel;
    private promptText: Text;

    constructor() {
        super();
        
        // Initialize file system
        this.fileSystem = FileSystem.getInstance();

        // Create backgrounds
        this.background = new Graphics();
        this.innerBackground = new Graphics();
        this.addChild(this.background);
        this.addChild(this.innerBackground);

        // Create output container
        this.outputContainer = new Container();
        this.addChild(this.outputContainer);

        // Create scrollbar
        this.scrollbar = new Scrollbar(
            window.innerWidth - this.MISSION_PANEL_WIDTH - this.PADDING_X * 2,
            window.innerHeight - this.PADDING_Y * 2,
            this.outputContainer
        );
        this.addChild(this.scrollbar);

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
        this.cursorGraphics.beginFill(0xb4e1fd, 0.8);
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

    private drawBackground(): void {
        // Main background
        this.background.clear();
        this.background.beginFill(0x282a36); // Dracula theme background
        this.background.drawRect(0, 0, this.terminalWidth, this.terminalHeight);
        this.background.endFill();

        // Inner background with subtle darker shade
        this.innerBackground.clear();
        this.innerBackground.beginFill(0x282a36, 1); // Base color
        this.innerBackground.drawRect(
            this.PADDING_X,
            this.PADDING_Y,
            this.terminalWidth - this.MISSION_PANEL_WIDTH - this.PADDING_X * 2,
            this.terminalHeight - this.PADDING_Y * 2
        );
        this.innerBackground.endFill();

        // Add a slight shadow overlay at the bottom
        this.innerBackground.beginFill(0x1d1f27, 0.2);
        this.innerBackground.drawRect(
            this.PADDING_X,
            this.PADDING_Y + (this.terminalHeight - this.PADDING_Y * 2) / 2,
            this.terminalWidth - this.MISSION_PANEL_WIDTH - this.PADDING_X * 2,
            (this.terminalHeight - this.PADDING_Y * 2) / 2
        );
        this.innerBackground.endFill();
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
            { cmd: "clear", desc: "Clear the terminal screen" },
            { cmd: "ls", desc: "List files in current directory" },
            { cmd: "cd <dir>", desc: "Change directory" },
            { cmd: "pwd", desc: "Print working directory" },
            { cmd: "mkdir <dir>", desc: "Create a new directory" },
            { cmd: "touch <file>", desc: "Create a new file" },
            { cmd: "echo <text>", desc: "Print text to terminal" },
            { cmd: "echo <text> > <file>", desc: "Write text to file" },
            { cmd: "cat <file>", desc: "Display file contents" },
            { cmd: "neofetch", desc: "Display system information" },
            { cmd: "sudo <command>", desc: "Run command with admin privileges" },
            { cmd: "nano <file>", desc: "Text editor" },
            { cmd: "ftp <host>", desc: "Connect to FTP server" },
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
        const args = command.trim().split(' ');
        const cmd = args[0].toLowerCase();

        try {
            switch (cmd) {
                case 'help':
                    this.showHelp();
                    break;
                case 'clear':
                    this.clearOutput();
                    break;
                case 'ls':
                    const files = this.fileSystem.listFiles();
                    this.addOutput(files.length ? files.join('\n') : 'Directory is empty');
                    this.missionPanel.completeMission('intro');
                    break;
                case 'cd':
                    const path = args[1] || '';
                    try {
                        this.fileSystem.changePath(path);
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
                        this.fileSystem.createDirectory(args[1]);
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
                    if (args.length < 2) {
                        this.addOutput('');
                        return;
                    }
                    if (args.includes('>')) {
                        const redirectIndex = args.indexOf('>');
                        const fileName = args[redirectIndex + 1];
                        if (!fileName) {
                            this.addOutput('echo: no file specified for redirection', true);
                            return;
                        }
                        const content = args.slice(1, redirectIndex).join(' ');
                        try {
                            this.fileSystem.writeFile(fileName, content);
                            this.missionPanel.completeMission('files');
                        } catch (err: any) {
                            this.addOutput(`echo: ${err?.message || 'Unknown error'}`, true);
                        }
                    } else {
                        this.addOutput(args.slice(1).join(' '));
                    }
                    break;
                case 'cat':
                    if (args.length < 2) {
                        this.addOutput('cat: missing file operand', true);
                        return;
                    }
                    try {
                        const content = this.fileSystem.readFile(args[1]);
                        if (content !== null) {
                            this.addOutput(content || '');
                            this.missionPanel.completeMission('files');
                        } else {
                            this.addOutput(`cat: ${args[1]}: No such file or directory`, true);
                        }
                    } catch (err: any) {
                        this.addOutput(`cat: ${err?.message || 'Unknown error'}`, true);
                    }
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
                        // Try to read the file first
                        let content = "";
                        try {
                            content = this.fileSystem.readFile(args[1]) || "";
                        } catch (err) {
                            // If file doesn't exist, we'll create it when saving
                        }
                        
                        this.addOutput(`\x1b[1m  GNU nano 6.2                    ${args[1]}                                \x1b[0m`);
                        this.addOutput(`\x1b[36m${content || "[New File]"}\x1b[0m`);
                        
                        // Show nano bottom controls
                        const controlsText = [
                            "\x1b[30;47m^G\x1b[0m Get Help  \x1b[30;47m^O\x1b[0m Write Out \x1b[30;47m^W\x1b[0m Where Is  \x1b[30;47m^K\x1b[0m Cut Text  \x1b[30;47m^J\x1b[0m Justify",
                            "\x1b[30;47m^X\x1b[0m Exit      \x1b[30;47m^R\x1b[0m Read File \x1b[30;47m^\\\x1b[0m Replace   \x1b[30;47m^U\x1b[0m Paste Text\x1b[30;47m^T\x1b[0m To Spell"
                        ].join("\n");
                        
                        this.addOutput(controlsText);
                        
                        // Start nano mode
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
                default:
                    this.addOutput(`${cmd}: command not found`, true);
                    break;
            }
        } catch (err: any) {
            this.addOutput(`Error: ${err?.message || 'An unknown error occurred'}`, true);
        }
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

        // Ensure the new output is visible by scrolling if needed
        if (this.outputContainer.height > this.terminalHeight - this.PADDING_Y * 2) {
            const overflow = this.outputContainer.height - (this.terminalHeight - this.PADDING_Y * 2);
            this.outputContainer.y = -overflow;
            
            // Update scrollbar when implemented
            // this.scrollbar.update();
        }

        // Update input position
        this.updateInputPosition();
    }

    private updateInputPosition(): void {
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

        // Position scrollbar
        this.scrollbar.x = this.terminalWidth - this.MISSION_PANEL_WIDTH - this.PADDING_X - 8;
        this.scrollbar.y = this.PADDING_Y;

        // Position mission panel
        this.missionPanel.x = this.terminalWidth - this.MISSION_PANEL_WIDTH;
        this.missionPanel.y = 0;
    }

    private startNano(filename: string): void {
        const content = this.fileSystem.readFile(filename) || "";
        this.state = TerminalState.NANO;
        this.nanoState = {
            filename,
            content,
            lines: content.split("\n"),
            cursorX: 1,
            cursorY: 1,
            message: "^X Exit | ^O Save"
        };
        this.clearOutput();
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
                this.addOutput("Save modified buffer (ANSWERING \"No\" WILL DESTROY CHANGES) ? ");
                this.addOutput("      Y Yes");
                this.addOutput("      N No");
                this.addOutput("      ^C Cancel");
                
                // For simplicity, we'll just exit without saving
                this.state = TerminalState.NORMAL;
                this.nanoState = null;
                this.clearOutput();
                this.addOutput("File closed.");
            } else if (event.key === "o" && event.ctrlKey) {
                // Save file
                if (this.nanoState) {
                    try {
                        this.fileSystem.writeFile(this.nanoState.filename, this.nanoState.content);
                        this.addOutput(`Saved ${this.nanoState.filename}`);
                    } catch (err: any) {
                        this.addOutput(`Error writing ${this.nanoState.filename}: ${err?.message || 'Unknown error'}`);
                    }
                }
            } else {
                // In a real implementation, we would handle keyboard input to edit the file
                // For simplicity, we'll just acknowledge the key press
                if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                    if (this.nanoState) {
                        this.nanoState.content += event.key;
                    }
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
        
        // Resize scrollbar and mission panel
        this.scrollbar.resize(
            width - this.MISSION_PANEL_WIDTH - this.PADDING_X * 2,
            height - this.PADDING_Y * 2
        );
        this.missionPanel.resize(this.MISSION_PANEL_WIDTH, height);
        
        // Reposition input
        this.updateInputPosition();
        
        // Ensure content is visible
        if (this.outputContainer.height > this.terminalHeight - this.PADDING_Y * 2) {
            const overflow = this.outputContainer.height - (this.terminalHeight - this.PADDING_Y * 2);
            this.outputContainer.y = -overflow;
        }
    }

    public destroy(): void {
        this.scrollbar.destroy();
        super.destroy();
    }
} 