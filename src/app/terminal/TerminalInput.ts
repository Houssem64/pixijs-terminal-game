import { Container, Graphics, Text } from "pixi.js";
import { TerminalThemeManager } from "./TerminalThemeManager";
import { TerminalScrollManager } from "./TerminalScrollManager";

export class TerminalInput {
    private currentInput: Text;
    private promptText: Text;
    private cursorGraphics: Graphics;
    private inputContainer: Container;
    private commandHistory: string[] = [];
    private historyIndex: number = -1;
    private cursorBlinkInterval!: ReturnType<typeof setInterval>;
    private cursorPosition: number = 0;
    private lineHeight: number = 20;
    private paddingX: number = 12;
    private paddingY: number = 12;
    private themeManager: TerminalThemeManager;
    private boundHandleKeyPress!: (event: KeyboardEvent) => void;
    private scrollManager: TerminalScrollManager;
    
    constructor(
        parentContainer: Container,
        themeManager: TerminalThemeManager,
        scrollManager: TerminalScrollManager,
        private commandCallback: (command: string) => void
    ) {
        this.themeManager = themeManager;
        this.scrollManager = scrollManager;
        
        // Create a container for input components
        this.inputContainer = new Container();
        parentContainer.addChild(this.inputContainer);
        
        // Initialize the prompt
        this.promptText = new Text(this.getPrompt(), this.themeManager.getPromptStyle());
        this.promptText.resolution = Math.max(window.devicePixelRatio || 1, 2);
        this.inputContainer.addChild(this.promptText);
        
        // Initialize the input text
        this.currentInput = new Text("", this.themeManager.getTextStyle());
        this.currentInput.resolution = Math.max(window.devicePixelRatio || 1, 2);
        this.inputContainer.addChild(this.currentInput);
        
        // Initialize the cursor
        this.cursorGraphics = new Graphics();
        this.inputContainer.addChild(this.cursorGraphics);
        
        // Position the input components
        this.updateInputPosition();
        
        // Set up cursor blinking
        this.startCursorBlink();
        
        // Set up keyboard event listeners
        this.setupKeyboardEvents();
    }
    
    private startCursorBlink(): void {
        this.cursorBlinkInterval = setInterval(() => {
            this.cursorGraphics.visible = !this.cursorGraphics.visible;
        }, 530);
    }
    
    private stopCursorBlink(): void {
        clearInterval(this.cursorBlinkInterval);
        this.cursorGraphics.visible = true;
    }
    
    private setupKeyboardEvents(): void {
        this.boundHandleKeyPress = this.handleKeyPress.bind(this);
        document.addEventListener('keydown', this.boundHandleKeyPress);
    }
    
    public destroy(): void {
        document.removeEventListener('keydown', this.boundHandleKeyPress);
        clearInterval(this.cursorBlinkInterval);
    }
    
    private handleKeyPress(event: KeyboardEvent): void {
        // Reset cursor blink on any key press
        this.stopCursorBlink();
        this.startCursorBlink();
        
        // Handle special keys
        switch (event.key) {
            case 'Enter':
                this.handleEnterKey();
                break;
                
            case 'Backspace':
                this.handleBackspaceKey();
                break;
                
            case 'Delete':
                this.handleDeleteKey();
                break;
                
            case 'ArrowLeft':
                this.handleArrowLeftKey();
                break;
                
            case 'ArrowRight':
                this.handleArrowRightKey();
                break;
                
            case 'ArrowUp':
                this.handleArrowUpKey();
                break;
                
            case 'ArrowDown':
                this.handleArrowDownKey();
                break;
                
            case 'Home':
                this.handleHomeKey();
                break;
                
            case 'End':
                this.handleEndKey();
                break;
                
            default:
                // Handle printable characters
                if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                    this.handleCharacterKey(event.key);
                }
                break;
        }
        
        // Update the input text and cursor position
        this.updateInputPosition();
    }
    
    private handleEnterKey(): void {
        const command = this.currentInput.text;
        const currentY = this.promptText.y;  // Store current Y position
        
        // Add to history if not empty
        if (command.trim() !== '') {
            this.commandHistory.push(command);
        }
        
        // Reset input and history index
        this.currentInput.text = '';
        this.cursorPosition = 0;
        this.historyIndex = -1;
        
        // Execute the command, passing the current Y position
        this.commandCallback(command);
        
        // Move input below the new output
        this.updateInputPosition();
    }
    
    private handleBackspaceKey(): void {
        if (this.cursorPosition > 0) {
            const text = this.currentInput.text;
            this.currentInput.text = text.substring(0, this.cursorPosition - 1) + text.substring(this.cursorPosition);
            this.cursorPosition--;
        }
    }
    
    private handleDeleteKey(): void {
        const text = this.currentInput.text;
        if (this.cursorPosition < text.length) {
            this.currentInput.text = text.substring(0, this.cursorPosition) + text.substring(this.cursorPosition + 1);
        }
    }
    
    private handleArrowLeftKey(): void {
        if (this.cursorPosition > 0) {
            this.cursorPosition--;
        }
    }
    
    private handleArrowRightKey(): void {
        if (this.cursorPosition < this.currentInput.text.length) {
            this.cursorPosition++;
        }
    }
    
    private handleArrowUpKey(): void {
        if (this.commandHistory.length > 0) {
            this.historyIndex = Math.min(this.commandHistory.length - 1, this.historyIndex + 1);
            this.currentInput.text = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
            this.cursorPosition = this.currentInput.text.length;
        }
    }
    
    private handleArrowDownKey(): void {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.currentInput.text = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
            this.cursorPosition = this.currentInput.text.length;
        } else if (this.historyIndex === 0) {
            this.historyIndex = -1;
            this.currentInput.text = '';
            this.cursorPosition = 0;
        }
    }
    
    private handleHomeKey(): void {
        this.cursorPosition = 0;
    }
    
    private handleEndKey(): void {
        this.cursorPosition = this.currentInput.text.length;
    }
    
    private handleCharacterKey(key: string): void {
        const text = this.currentInput.text;
        this.currentInput.text = text.substring(0, this.cursorPosition) + key + text.substring(this.cursorPosition);
        this.cursorPosition++;
    }
    
    public updateInputPosition(): void {
        if (!this.inputContainer.parent) return;
        
        // Get the content container from scroll manager
        const contentContainer = this.scrollManager.getContentContainer();
        
        // Calculate the bottom position of all output content
        let maxBottomY = 0;
        for (let i = 0; i < contentContainer.children.length; i++) {
            const child = contentContainer.children[i];
            // Skip the input container itself when calculating max Y
            if (child === this.inputContainer) continue;
            const bottomY = child.y + child.height;
            maxBottomY = Math.max(maxBottomY, bottomY);
        }
        
        // Add input to the content container to ensure proper scrolling
        if (this.inputContainer.parent !== contentContainer) {
            this.inputContainer.parent.removeChild(this.inputContainer);
            contentContainer.addChild(this.inputContainer);
        }
        
        // Get the visible viewport height (account for mission panel width)
        const viewportHeight = window.innerHeight - (this.paddingY * 2);
        
        // Position input below the last output with padding
        // Ensure it's within the visible viewport
        const safeTopMargin = 5; // Small margin from the top of the viewport
        const initialOffset = safeTopMargin + this.paddingY;
        const y = Math.max(maxBottomY + this.paddingY, initialOffset);
        
        // Update positions
        this.promptText.x = this.paddingX;
        this.promptText.y = y;
        
        this.currentInput.x = this.promptText.x + this.promptText.width;
        this.currentInput.y = y;
        
        // Position cursor
        const cursorX = this.currentInput.x + this.getCursorXOffset();
        this.cursorGraphics.clear();
        this.cursorGraphics.beginFill(this.themeManager.getTheme().cursor);
        this.cursorGraphics.drawRect(cursorX, y, 2, this.lineHeight);
        this.cursorGraphics.endFill();
        
        // Update scroll to ensure input is visible
        this.scrollManager.updateContentAdded();
    }
    
    private getCursorXOffset(): number {
        if (this.cursorPosition === 0) return 0;
        
        // Measure the width of text up to the cursor position
        const textUpToCursor = this.currentInput.text.substring(0, this.cursorPosition);
        const tempText = new Text(textUpToCursor, this.themeManager.getTextStyle());
        const width = tempText.width;
        tempText.destroy();
        
        return width;
    }
    
    private getPrompt(): string {
        return "$ ";
    }
    
    public resize(): void {
        this.updateInputPosition();
    }
    
    public getCurrentY(): number {
        return this.promptText.y;
    }
} 