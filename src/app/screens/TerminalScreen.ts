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
    private PADDING_X = 20;
    private PADDING_Y = 20;
    private LINE_HEIGHT = 24;
    private terminalWidth = 0;
    private terminalHeight = 0;
    private MISSION_PANEL_WIDTH = 300;
    private FONT_SIZE = 16;

    private textStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: this.FONT_SIZE,
        fill: 0x00ff00,
        fontWeight: "500",
        letterSpacing: 0,
        align: 'left',
        padding: 4
    });

    private innerBackground: Graphics;
    private scrollbar: Scrollbar;
    private missionPanel: MissionPanel;
    private promptText: Text;

    constructor() {
        super();
        
        // Initialize text style
        this.textStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: this.FONT_SIZE,
            fill: 0x00ff00,
            fontWeight: "500",
            letterSpacing: 0,
            padding: 4
        });

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
        this.promptText = new Text(this.getCurrentPrompt(), this.textStyle);
        this.currentInput = new Text("", this.textStyle);
        this.promptText.resolution = window.devicePixelRatio || 1;
        this.currentInput.resolution = window.devicePixelRatio || 1;
        this.addChild(this.promptText);
        this.addChild(this.currentInput);

        // Create cursor
        this.cursorGraphics = new Graphics();
        this.cursorGraphics.beginFill(0x00ff00, 0.8);
        this.cursorGraphics.drawRect(0, 0, 2, this.FONT_SIZE); // Make cursor thinner
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
        }, 530); // Slightly longer interval for better visibility

        // Add welcome message
        this.addOutput("Welcome to the Terminal Game!");
        this.addOutput("Type 'help' for a list of available commands.");

        // Update positions
        this.updateInputPosition();
    }

    private drawBackground(): void {
        // Main background
        this.background.clear();
        this.background.beginFill(0x000000);
        this.background.drawRect(0, 0, this.terminalWidth, this.terminalHeight);
        this.background.endFill();

        // Inner background with padding
        this.innerBackground.clear();
        this.innerBackground.beginFill(0x111111);
        this.innerBackground.drawRect(
            this.PADDING_X,
            this.PADDING_Y,
            this.terminalWidth - this.MISSION_PANEL_WIDTH - this.PADDING_X * 2,
            this.terminalHeight - this.PADDING_Y * 2
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

        ascii_art.forEach((line, i) => {
            const text = new Text(line + (system_info[i] ? "    " + system_info[i] : ""), this.textStyle);
            text.resolution = window.devicePixelRatio || 1;
            this.output.push(text);
            this.outputContainer.addChild(text);
            text.x = 10;
            text.y = this.output.length * 20;
        });
    }

    private handleCommand(command: string): void {
        const args = command.trim().split(' ');
        const cmd = args[0].toLowerCase();

        switch (cmd) {
            case 'help':
                this.showHelp();
                break;
            case 'clear':
                this.clearOutput();
                break;
            case 'ls':
                const files = this.fileSystem.listFiles();
                this.addOutput(files.join('\n'));
                this.missionPanel.completeMission('intro');
                break;
            case 'cd':
                const path = args[1] || '';
                try {
                    this.fileSystem.changePath(path);
                    this.addOutput(`Changed directory to: ${this.fileSystem.getCurrentPath()}`);
                    this.missionPanel.completeMission('intro');
                } catch (err: any) {
                    this.addOutput(`Error: ${err?.message || 'Unknown error'}`);
                }
                break;
            case 'mkdir':
                if (args.length < 2) {
                    this.addOutput('Error: Please provide a directory name');
                    return;
                }
                try {
                    this.fileSystem.createDirectory(args[1]);
                    this.addOutput(`Created directory: ${args[1]}`);
                    this.missionPanel.completeMission('files');
                } catch (err: any) {
                    this.addOutput(`Error: ${err?.message || 'Unknown error'}`);
                }
                break;
            case 'touch':
                if (args.length < 2) {
                    this.addOutput('Error: Please provide a file name');
                    return;
                }
                try {
                    this.fileSystem.createFile(args[1], '');
                    this.addOutput(`Created file: ${args[1]}`);
                    this.missionPanel.completeMission('files');
                } catch (err: any) {
                    this.addOutput(`Error: ${err?.message || 'Unknown error'}`);
                }
                break;
            case 'echo':
                if (args.length < 2) {
                    this.addOutput('Error: Please provide text to echo');
                    return;
                }
                if (args.includes('>')) {
                    const redirectIndex = args.indexOf('>');
                    const fileName = args[redirectIndex + 1];
                    const content = args.slice(1, redirectIndex).join(' ');
                    try {
                        this.fileSystem.writeFile(fileName, content);
                        this.addOutput(`Wrote to file: ${fileName}`);
                        this.missionPanel.completeMission('files');
                    } catch (err: any) {
                        this.addOutput(`Error: ${err?.message || 'Unknown error'}`);
                    }
                } else {
                    this.addOutput(args.slice(1).join(' '));
                }
                break;
            case 'cat':
                if (args.length < 2) {
                    this.addOutput('Error: Please provide a file name');
                    return;
                }
                try {
                    const content = this.fileSystem.readFile(args[1]);
                    if (content !== null) {
                        this.addOutput(content);
                        this.missionPanel.completeMission('files');
                    } else {
                        this.addOutput('Error: File not found');
                    }
                } catch (err: any) {
                    this.addOutput(`Error: ${err?.message || 'Unknown error'}`);
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
                    this.addOutput('Error: Please provide a command to run with sudo');
                    return;
                }
                this.addOutput('Running with administrative privileges...');
                this.handleCommand(args.slice(1).join(' '));
                if (this.missionPanel) {
                    this.missionPanel.completeMission('advanced');
                }
                break;
            case 'nano':
                if (args.length < 2) {
                    this.addOutput('Error: Please provide a file name');
                    return;
                }
                // Nano editor implementation would go here
                this.addOutput('Opening nano editor...');
                if (this.missionPanel) {
                    this.missionPanel.completeMission('advanced');
                }
                break;
            case 'ftp':
                this.addOutput('Connecting to FTP server...');
                if (this.missionPanel) {
                    this.missionPanel.completeMission('advanced');
                }
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
                this.addOutput(`Command not found: ${cmd}`);
                break;
        }
    }

    private showHelp(): void {
        const helpText = [
            "Available commands:",
            "  help      - Show this help message",
            "  clear     - Clear the terminal screen",
            "  ls        - List files in current directory",
            "  cd <dir>  - Change directory",
            "  pwd       - Print working directory",
            "  mkdir     - Create a new directory",
            "  touch     - Create a new file",
            "  echo      - Print text or write to file (echo text > file)",
            "  cat       - Display file contents",
            "  neofetch  - Display system information",
            "  sudo      - Run command with admin privileges",
            "  nano      - Text editor",
            "  ftp       - Connect to FTP server",
            "  next      - Show next mission",
            "  prev      - Show previous mission"
        ].join('\n');
        this.addOutput(helpText);
    }

    private clearOutput(): void {
        this.output.forEach(text => text.destroy());
        this.output = [];
        this.outputContainer.removeChildren();
        this.updateInputPosition();
    }

    private addOutput(text: string): void {
        const outputText = new Text(text, this.textStyle);
        outputText.resolution = window.devicePixelRatio || 1;
        outputText.x = this.PADDING_X;
        outputText.y = this.outputContainer.height;
        this.outputContainer.addChild(outputText);

        // Update input position
        this.updateInputPosition();
    }

    private updateInputPosition(): void {
        const x = this.PADDING_X;
        const y = this.PADDING_Y + this.outputContainer.height + this.LINE_HEIGHT;

        // Update prompt
        this.promptText.text = this.getCurrentPrompt();
        this.promptText.x = Math.round(x);
        this.promptText.y = Math.round(y);

        // Update input
        this.currentInput.x = Math.round(x + this.promptText.width);
        this.currentInput.y = Math.round(y);

        // Update cursor position
        this.cursorGraphics.x = Math.round(this.currentInput.x + this.currentInput.width);
        this.cursorGraphics.y = Math.round(y + 2); // Slight offset to center the cursor vertically

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
        if (event.key === "Enter") {
            const command = this.currentInput.text;
            this.addOutput(this.getCurrentPrompt() + command);
            this.handleCommand(command);
            this.currentInput.text = "";
        } else if (event.key === "Backspace") {
            this.currentInput.text = this.currentInput.text.slice(0, -1);
        } else if (event.key.length === 1) {
            this.currentInput.text += event.key;
        }
        
        // Update cursor position after any key press
        this.cursorGraphics.x = Math.round(this.currentInput.x + this.currentInput.width);
    }

    private handleResize(): void {
        // Update main background
        this.background.clear();
        this.background.beginFill(0x000000);
        this.background.drawRect(0, 0, window.innerWidth, window.innerHeight);
        this.background.endFill();

        // Update inner background
        const innerBackground = new Graphics();
        innerBackground.beginFill(0x111111);
        innerBackground.drawRect(
            this.PADDING_X / 2,
            this.PADDING_Y / 2,
            window.innerWidth - this.PADDING_X,
            window.innerHeight - this.PADDING_Y
        );
        innerBackground.endFill();
    }

    private handleFTPCommand(command: string): void {
        // FTP command handling implementation
    }

    public resize(width: number, height: number): void {
        this.terminalWidth = width;
        this.terminalHeight = height;

        this.drawBackground();
        this.updateInputPosition();

        // Resize scrollbar and mission panel
        this.scrollbar.resize(
            width - this.MISSION_PANEL_WIDTH - this.PADDING_X * 2,
            height - this.PADDING_Y * 2
        );
        this.missionPanel.resize(this.MISSION_PANEL_WIDTH, height);
    }

    public destroy(): void {
        this.scrollbar.destroy();
        super.destroy();
    }
} 