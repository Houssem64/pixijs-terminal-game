import { Container, Graphics, Text, Ticker } from "pixi.js";

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
    private prompt = "user@linux:~$ ";

    constructor() {
        super();
        this.addChild(this.terminal);
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
        const promptText = new Text(this.prompt, {
            fontFamily: "Courier New",
            fontSize: 16,
            fill: 0x00ff00,
        });
        this.inputLine.addChild(promptText);

        // Add input text
        this.currentInput = new Text("", {
            fontFamily: "Courier New",
            fontSize: 16,
            fill: 0x00ff00,
        });
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
        this.addOutput("Welcome to Linux Terminal Emulator");
        this.addOutput("Type 'help' for available commands");
        this.addOutput("");
    }

    public async hide(): Promise<void> {
        clearInterval(this.cursorBlinkInterval);
        window.removeEventListener("keydown", this.handleKeyPress);
        window.removeEventListener("resize", this.handleResize);
        this.destroy();
    }

    public resize(width: number, height: number): void {
        this.background.clear();
        this.background.beginFill(0x000000);
        this.background.drawRect(0, 0, width, height);
        this.background.endFill();
    }

    public update(_time: Ticker): void {
        // Update logic if needed
    }

    private handleKeyPress(event: KeyboardEvent): void {
        if (event.key === "Enter") {
            this.processCommand(this.currentInput.text);
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

    private addOutput(text: string): void {
        const outputText = new Text(text, {
            fontFamily: "Courier New",
            fontSize: 16,
            fill: 0x00ff00,
        });
        
        outputText.x = 10;
        outputText.y = this.output.length * 20 + 10;
        
        this.output.push(outputText);
        this.outputContainer.addChild(outputText);
        
        // Update input line position
        this.inputLine.y = (this.output.length + 1) * 20 + 10;
    }

    private processCommand(command: string): void {
        this.addOutput(this.prompt + command);
        
        switch (command.toLowerCase()) {
            case "help":
                this.addOutput("Available commands:");
                this.addOutput("  help    - Show this help message");
                this.addOutput("  clear   - Clear the terminal");
                this.addOutput("  date    - Show current date and time");
                break;
            case "clear":
                this.output.forEach(text => text.destroy());
                this.output = [];
                this.inputLine.y = 10;
                break;
            case "date":
                this.addOutput(new Date().toString());
                break;
            default:
                if (command) {
                    this.addOutput(`Command not found: ${command}`);
                }
        }
        this.addOutput("");
    }

    private handleResize(): void {
        this.background.clear();
        this.background.beginFill(0x000000);
        this.background.drawRect(0, 0, window.innerWidth, window.innerHeight);
        this.background.endFill();
    }
} 