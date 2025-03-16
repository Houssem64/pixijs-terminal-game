import { Container, Text, TextStyle } from "pixi.js";
import { TerminalScrollManager } from "./TerminalScrollManager";
import { TerminalThemeManager } from "./TerminalThemeManager";

export class TerminalOutput {
    private outputContainer: Container;
    private outputHistory: Text[] = [];
    private maxHistorySize: number = 1000;
    private lineHeight: number = 20;
    private paddingX: number = 12;
    private paddingY: number = 12;
    private themeManager: TerminalThemeManager;
    private scrollManager: TerminalScrollManager;
    private lastOutputY: number = 0; // Reset to 0, we'll calculate proper position
    
    constructor(
        parentContainer: Container, 
        scrollManager: TerminalScrollManager,
        themeManager: TerminalThemeManager
    ) {
        this.themeManager = themeManager;
        this.scrollManager = scrollManager;
        this.outputContainer = this.scrollManager.getContentContainer();
        
        // Initialize starting position
        this.resetOutputPosition();
    }
    
    // Reset output position to safe initial value
    private resetOutputPosition(): void {
        const safeTopMargin = 5; // Small margin from the top of the viewport
        this.lastOutputY = safeTopMargin + this.paddingY;
    }
    
    public addOutput(text: string, isError: boolean = false, color?: number): void {
        // Split text into lines
        const lines = text.split('\n');
        
        // Start from the last output position or safe default
        let currentY = this.lastOutputY || (this.paddingY + 5);
        
        lines.forEach((line) => {
            // Process ANSI escape codes using unicode escape sequence
            const parts = line.split(/(\u001b\[\d+(?:;\d+)*m)/);
            let currentX = this.paddingX;
            let lineHeight = 0;
            const lineTexts: Text[] = [];
            
            parts.forEach(part => {
                if (part.startsWith('\u001b[')) {
                    // Handle ANSI code (future implementation)
                    return;
                }
                
                if (part.length === 0) return;

                // Determine which style to use
                let style;
                if (isError) {
                    style = this.themeManager.getErrorStyle();
                } else if (color !== undefined) {
                    style = new TextStyle({
                        ...this.themeManager.getTextStyle(),
                        fill: color
                    });
                } else {
                    style = this.themeManager.getTextStyle();
                }

                const outputText = new Text(part, style);
                outputText.resolution = Math.max(window.devicePixelRatio || 1, 2);
                outputText.x = Math.round(currentX);
                outputText.y = Math.round(currentY);
                
                lineHeight = Math.max(lineHeight, outputText.height);
                currentX += outputText.width;
                lineTexts.push(outputText);
            });
            
            // Add all text pieces for this line to the container
            lineTexts.forEach(text => {
                this.outputContainer.addChild(text);
                this.outputHistory.push(text);
            });
            
            // Move to next line
            currentY += lineHeight || this.lineHeight;
        });
        
        // Store the last Y position for next output
        this.lastOutputY = currentY;
        
        // Trim history if it exceeds the maximum size
        this.trimHistory();
        
        // Notify scroll manager that content was added
        this.scrollManager.updateContentAdded();
    }

    public setNextOutputPosition(y: number): void {
        // Ensure minimum safe position
        const safeTopMargin = 5; // Small margin from the top
        this.lastOutputY = Math.max(y, safeTopMargin + this.paddingY);
    }
    
    private trimHistory(): void {
        // Remove old lines if history exceeds maximum size
        if (this.outputHistory.length > this.maxHistorySize) {
            const linesToRemove = this.outputHistory.length - this.maxHistorySize;
            for (let i = 0; i < linesToRemove; i++) {
                const oldText = this.outputHistory.shift();
                if (oldText && oldText.parent) {
                    oldText.parent.removeChild(oldText);
                }
            }
        }
    }
    
    public clear(): void {
        // Remove all text from the container
        this.outputContainer.removeChildren();
        this.outputHistory = [];
        
        // Reset position after clearing
        this.resetOutputPosition();
        
        // Update scroll after clearing
        this.scrollManager.updateContentAdded();
    }
} 