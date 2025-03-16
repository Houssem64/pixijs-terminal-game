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
    private inputAreaHeight: number = 60; // Increased height reserved for input area
    private bottomPadding: number = 40; // Increased additional padding below input
    private themeManager: TerminalThemeManager;
    private scrollManager: TerminalScrollManager;
    private lastOutputY: number = 0;
    
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
        
        // Scroll to show bottom content with padding for input area
        this.scrollToShowInputArea();
    }

    // Ensure there's enough space at the bottom to keep the input area visible
    private scrollToShowInputArea(): void {
        // Use significantly larger padding to ensure input visibility
        const totalPadding = this.inputAreaHeight + this.bottomPadding;
        
        // Use the scrollToBottomWithPadding method to ensure input visibility
        this.scrollManager.scrollToBottomWithPadding(totalPadding);
        
        // Force another update after a short delay to ensure scrolling applied
        setTimeout(() => {
            this.scrollManager.scrollToBottomWithPadding(totalPadding);
        }, 10);
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
        
        // Ensure input area is visible after clearing
        this.scrollToShowInputArea();
    }
    
    /**
     * Clears terminal output but preserves welcome messages
     * @param preserveLines Number of initial lines to preserve (default: 3 for welcome message)
     */
    public partialClear(preserveLines: number = 3): void {
        // Check if we have any lines to clear
        if (this.outputHistory.length === 0) {
            return;
        }
        
        // Find welcome message lines
        const welcomeLines = this.findWelcomeLines();
        const numLinesToPreserve = Math.max(preserveLines, welcomeLines.length);
        
        // If there's nothing to clear, just return
        if (this.outputHistory.length <= numLinesToPreserve) {
            return;
        }
        
        // Keep the welcome lines
        const preservedTexts = welcomeLines.length > 0 ? welcomeLines : 
                               this.outputHistory.slice(0, numLinesToPreserve);
        
        // Get Y position of the last line we want to preserve
        let lastPreservedY = 0;
        preservedTexts.forEach(text => {
            lastPreservedY = Math.max(lastPreservedY, text.y + text.height);
        });
        
        // Remember all other output lines to be removed
        const linesToRemove = this.outputHistory.filter(text => !preservedTexts.includes(text));
        
        // Remove only the non-preserved lines without clearing the entire container
        linesToRemove.forEach(text => {
            if (text.parent) {
                text.parent.removeChild(text);
            }
        });
        
        // Update history to only contain preserved texts
        this.outputHistory = preservedTexts;
        
        // Set the next output position after the preserved content with a small gap
        this.lastOutputY = lastPreservedY + this.lineHeight;
        
        // Update scrollbars but don't force scrolling to bottom
        // We want to stay at the top where the welcome message is
        this.scrollManager.updateContentAdded(false);
    }
    
    // Get the full content height to calculate proper positions
    private getContentHeight(): number {
        if (this.outputHistory.length === 0) {
            return this.paddingY;
        }
        
        let maxY = 0;
        this.outputHistory.forEach(text => {
            maxY = Math.max(maxY, text.y + text.height);
        });
        
        return maxY + this.paddingY;
    }
    
    /**
     * Find the welcome message lines in the output history
     * @returns Array of Text objects that make up the welcome message
     */
    private findWelcomeLines(): Text[] {
        const welcomeLines: Text[] = [];
        const welcomeTexts = ["Welcome to Terminal OS", "Type 'help' to see available commands", ""];
        
        // Simple pattern matching for welcome messages
        let lastFoundIndex = -1;
        
        for (let i = 0; i < this.outputHistory.length; i++) {
            const text = this.outputHistory[i];
            const displayText = text.text || "";
            
            // Check if this is part of the welcome message sequence
            const expectedIndex = welcomeTexts.findIndex(
                (welcomeText, idx) => idx > lastFoundIndex && displayText.includes(welcomeText)
            );
            
            if (expectedIndex !== -1 && expectedIndex === lastFoundIndex + 1) {
                welcomeLines.push(text);
                lastFoundIndex = expectedIndex;
                
                // If we found all welcome texts, we're done
                if (lastFoundIndex === welcomeTexts.length - 1) {
                    break;
                }
            }
        }
        
        return welcomeLines;
    }
    
    // Handle resize events to maintain proper padding
    public resize(width: number, height: number): void {
        // Ensure input area is visible after resize
        this.scrollToShowInputArea();
    }
} 