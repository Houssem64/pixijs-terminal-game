import { Container, Graphics, Text, Ticker, TextStyle } from "pixi.js";
import { FileSystem } from "../../utils/FileSystem";

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

    private textStyle: TextStyle = new TextStyle({
        fontFamily: "Fira Code",
        fontSize: 16,
        fill: 0x00ff00,
        fontWeight: "500",
        letterSpacing: 0,
        padding: 4
    });

    constructor() {
        super();
        this.addChild(this.terminal);
        this.fileSystem = FileSystem.getInstance();
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
        const parts = command.trim().split(/\s+/);
        if (parts.length === 0 || parts[0] === "") return;

        if (this.state === TerminalState.FTP) {
            this.handleFTPCommand(command);
            return;
        }

        if (parts[0] === "sudo") {
            this.currentCommand = command;
            this.state = TerminalState.PASSWORD;
            return;
        }

        switch (parts[0]) {
            case "clear":
                this.clearOutput();
                break;
            case "neofetch":
                this.showNeofetch();
                break;
            case "pwd":
                this.addOutput(this.fileSystem.getCurrentPath());
                break;
            case "ls":
                const files = this.fileSystem.listFiles(parts[1]);
                this.addOutput(files.join("  "));
                break;
            case "cd":
                if (this.fileSystem.changePath(parts[1] || "/home/user")) {
                    // Success, no output needed
                } else {
                    this.addOutput(`cd: ${parts[1]}: No such file or directory`);
                }
                break;
            case "mkdir":
                if (!parts[1]) {
                    this.addOutput("mkdir: missing operand");
                } else if (this.fileSystem.createDirectory(parts[1])) {
                    // Success, no output needed
                } else {
                    this.addOutput(`mkdir: cannot create directory '${parts[1]}': File exists`);
                }
                break;
            case "touch":
                if (!parts[1]) {
                    this.addOutput("touch: missing file operand");
                } else if (this.fileSystem.createFile(parts[1])) {
                    // Success, no output needed
                } else {
                    this.addOutput(`touch: cannot create file '${parts[1]}': File exists`);
                }
                break;
            case "echo":
                const outputFile = parts.indexOf(">");
                if (outputFile !== -1) {
                    const content = parts.slice(1, outputFile).join(" ");
                    const filename = parts[outputFile + 1];
                    if (this.fileSystem.writeFile(filename, content)) {
                        // Success, no output needed
                    } else {
                        this.addOutput(`echo: cannot write to '${filename}'`);
                    }
                } else {
                    this.addOutput(parts.slice(1).join(" "));
                }
                break;
            case "cat":
                if (!parts[1]) {
                    this.addOutput("cat: missing file operand");
                } else {
                    const content = this.fileSystem.readFile(parts[1]);
                    if (content !== null) {
                        this.addOutput(content);
                    } else {
                        this.addOutput(`cat: ${parts[1]}: No such file`);
                    }
                }
                break;
            case "nano":
                if (!parts[1]) {
                    this.addOutput("nano: missing file operand");
                } else {
                    this.startNano(parts[1]);
                }
                break;
            case "help":
                this.showHelp();
                break;
            default:
                this.addOutput(`Command not found: ${parts[0]}`);
        }
    }

    private showHelp(): void {
        const helpText = [
            "╭─── Terminal Command Reference ─────────────────────────────╮",
            "│  System Information:                                       │",
            "│    neofetch  - Display system information and logo         │",
            "│    whoami    - Show current user                           │",
            "│  File System Navigation:                                   │",
            "│    pwd       - Show current working directory              │",
            "│    ls        - List directory contents                     │",
            "│    cd        - Change directory                            │",
            "│  File Operations:                                          │",
            "│    mkdir     - Create a new directory                      │",
            "│    touch     - Create a new empty file                     │",
            "│    cat       - Display file contents                       │",
            "│    nano      - Text editor                                 │",
            "│  Terminal Control:                                         │",
            "│    clear     - Clear terminal screen                       │",
            "│    echo      - Display a line of text                      │",
            "│    sudo      - Execute command as superuser                │",
            "╰────────────────────────────────────────────────────────────╯"
        ];

        helpText.forEach(line => this.addOutput(line));
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
        outputText.x = 10;
        outputText.y = this.output.length * 20;
        this.output.push(outputText);
        this.outputContainer.addChild(outputText);
        this.updateInputPosition();
    }

    private updateInputPosition(): void {
        this.inputLine.y = (this.output.length + 1) * 20;
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

    public async show(): Promise<void> {
        // Create full-screen black background
        this.background.beginFill(0x000000);
        this.background.drawRect(0, 0, window.innerWidth, window.innerHeight);
        this.background.endFill();
        this.terminal.addChild(this.background);

        // Container for output text
        this.terminal.addChild(this.outputContainer);

        // Create input line
        this.terminal.addChild(this.inputLine);

        // Add prompt text
        const promptText = new Text(this.getCurrentPrompt(), this.textStyle);
        promptText.resolution = window.devicePixelRatio || 1;
        this.inputLine.addChild(promptText);

        // Add input text
        this.currentInput = new Text("", this.textStyle);
        this.currentInput.resolution = window.devicePixelRatio || 1;
        this.currentInput.x = promptText.width;
        this.inputLine.addChild(this.currentInput);

        // Add blinking cursor
        this.cursorGraphics.beginFill(0x00ff00);
        this.cursorGraphics.drawRect(0, 0, 8, 16);
        this.cursorGraphics.endFill();
        this.cursorGraphics.x = promptText.width;
        this.inputLine.addChild(this.cursorGraphics);

        // Position input line
        this.inputLine.y = 10;
        this.inputLine.x = 10;

        // Setup event listeners
        window.addEventListener("keydown", this.handleKeyPress.bind(this));
        window.addEventListener("resize", this.handleResize.bind(this));

        // Start cursor blinking
        this.cursorBlinkInterval = setInterval(() => {
            this.cursorGraphics.visible = !this.cursorGraphics.visible;
        }, 500);

        // Welcome message
        this.addOutput("Welcome to PixiJS Terminal v1.0");
        this.addOutput("Type 'help' for available commands");
        this.addOutput("");
    }

    public async hide(): Promise<void> {
        clearInterval(this.cursorBlinkInterval);
        window.removeEventListener("keydown", this.handleKeyPress);
        window.removeEventListener("resize", this.handleResize);
        this.destroy();
    }

    private handleKeyPress(event: KeyboardEvent): void {
        if (event.key === "Enter") {
            if (this.state === TerminalState.PASSWORD) {
                if (this.currentInput.text === this.sudoPassword) {
                    this.state = TerminalState.NORMAL;
                    this.passwordAttempts = 0;
                    this.handleCommand(this.currentCommand);
                } else {
                    this.passwordAttempts++;
                    if (this.passwordAttempts >= this.maxPasswordAttempts) {
                        this.addOutput("sudo: too many incorrect password attempts");
                        this.state = TerminalState.NORMAL;
                        this.passwordAttempts = 0;
                    }
                }
            } else {
                this.handleCommand(this.currentInput.text);
            }
            this.currentInput.text = "";
            this.cursorGraphics.x = this.currentInput.x;
        } else if (event.key === "Backspace") {
            this.currentInput.text = this.currentInput.text.slice(0, -1);
            this.cursorGraphics.x = this.currentInput.x + this.currentInput.width;
        } else if (event.key.length === 1) {
            this.currentInput.text += event.key;
            this.cursorGraphics.x = this.currentInput.x + this.currentInput.width;
        }
    }

    private handleResize(): void {
        this.background.clear();
        this.background.beginFill(0x000000);
        this.background.drawRect(0, 0, window.innerWidth, window.innerHeight);
        this.background.endFill();
    }

    private handleFTPCommand(command: string): void {
        // FTP command handling implementation
    }
} 