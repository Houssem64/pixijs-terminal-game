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
     * Find the welcome message lines in the output history
     * @returns Array of Text objects that make up the welcome message
     */
    private findWelcomeLines(): Text[] {
        const welcomeLines: Text[] = [];
        const welcomeTexts = ["Welcome to Terminal OS", "Type 'help' to see available commands", ""];
        
        // Only check the very first few lines
        const maxLinesToCheck = Math.min(10, this.outputHistory.length);
        const candidates: Text[] = [];
        
        // First, gather all exact matches from the first few lines
        for (let i = 0; i < maxLinesToCheck; i++) {
            const text = this.outputHistory[i];
            const textContent = text.text;
            
            // Check for exact match with welcome texts
            if (welcomeTexts.includes(textContent)) {
                candidates.push(text);
            }
        }
        
        // If we don't have enough candidates, return empty
        if (candidates.length < welcomeTexts.length) {
            return [];
        }
        
        // Find exact welcome messages in order
        let lastFoundIndex = -1;
        for (const welcomeText of welcomeTexts) {
            let found = false;
            
            for (const candidate of candidates) {
                // Skip candidates that are already used
                if (welcomeLines.includes(candidate)) continue;
                
                // Check for exact match with this welcome text
                if (candidate.text === welcomeText) {
                    welcomeLines.push(candidate);
                    found = true;
                    break;
                }
            }
            
            // If we couldn't find this welcome text, return empty
            if (!found) {
                return [];
            }
        }
        
        // Check that welcome lines are roughly in order by Y position
        for (let i = 1; i < welcomeLines.length; i++) {
            const prevLine = welcomeLines[i-1];
            const currLine = welcomeLines[i];
            
            // If lines are out of order by more than a small amount, return empty
            if (currLine.y < prevLine.y) {
                return [];
            }
        }
        
        return welcomeLines;
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
        
        // Define the welcome texts that should be preserved
        const welcomeTexts = ["Welcome to Terminal OS", "Type 'help' to see available commands", ""];
        
        // Find welcome message lines with exact pattern matching
        const welcomeLines = this.findWelcomeLines();
        
        // ONLY preserve the exact welcome message lines - no fallback
        let preservedTexts: Text[] = welcomeLines;
        
        // If we couldn't find all welcome messages, then fallback to clear everything
        if (preservedTexts.length < welcomeTexts.length) {
            preservedTexts = [];
        }
        
        // Find the input field elements to preserve - we need to do this before clearing
        const contentContainer = this.scrollManager.getContentContainer();
        const inputElements: any[] = [];
        
        // Identify all input container elements to preserve (they won't be in outputHistory)
        contentContainer.children.forEach(child => {
            // Check if this is likely part of the input (by checking if it's not in output history)
            if (!this.outputHistory.includes(child as any)) {
                inputElements.push(child);
            }
        });
        
        // Get Y position of the last line we want to preserve
        let lastPreservedY = 0;
        preservedTexts.forEach(text => {
            lastPreservedY = Math.max(lastPreservedY, text.y + text.height);
        });
        
        // Temporarily remove input elements to prevent them from being cleared
        inputElements.forEach(input => {
            if (input.parent) {
                input.parent.removeChild(input);
            }
        });
        
        // Clear all text
        this.outputContainer.removeChildren();
        
        // Add back just the preserved lines
        preservedTexts.forEach(text => {
            this.outputContainer.addChild(text);
        });
        
        // Add back input elements
        inputElements.forEach(input => {
            this.outputContainer.addChild(input);
        });
        
        // Update history to only contain preserved texts
        this.outputHistory = preservedTexts;
        
        // Set the next output position after the preserved content with a gap
        this.lastOutputY = preservedTexts.length > 0 ? lastPreservedY + this.lineHeight : this.paddingY + 5;
        
        // Reset scrolling state to fix issues when scrollbar was present
        this.scrollManager.resetScroll();
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
    
    // Handle resize events to maintain proper padding
    public resize(width: number, height: number): void {
        // Ensure input area is visible after resize
        this.scrollToShowInputArea();
    }
    
    /**
     * Returns a copy of the current output history array
     * This can be used for analyzing what's currently displayed
     */
    public getOutputHistory(): Text[] {
        return [...this.outputHistory];
    }
} 