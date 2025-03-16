import { Container, Graphics, FederatedPointerEvent, Rectangle } from "pixi.js";
import { TerminalTheme } from "./TerminalThemeManager";

export class TerminalScrollManager {
    private scrollbar: Graphics;
    private scrollbarTrack: Graphics;
    private scrollbarVisible: boolean = false;
    private scrollbarWidth: number = 8;
    private scrollPosition: number = 0;
    private maxScrollPosition: number = 0;
    private isDragging: boolean = false;
    private lastMouseY: number = 0;
    
    private contentContainer: Container;
    private viewportMask: Graphics;
    private terminalWidth: number = 0;
    private terminalHeight: number = 0;
    private paddingX: number = 12;
    private paddingY: number = 12;
    
    constructor(
        private parentContainer: Container,
        private theme: TerminalTheme
    ) {
        // Initialize scrollbar components
        this.scrollbarTrack = new Graphics();
        this.scrollbarTrack.visible = false;
        parentContainer.addChild(this.scrollbarTrack);
        
        this.scrollbar = new Graphics();
        this.scrollbar.visible = false;
        parentContainer.addChild(this.scrollbar);
        
        // Set up events
        this.scrollbar.eventMode = 'static';
        this.scrollbar.cursor = 'grab';
        this.scrollbar.on('pointerdown', this.startDragging.bind(this));
        
        // Create viewport mask to constrain content
        this.viewportMask = new Graphics();
        this.drawViewportMask();
        parentContainer.addChild(this.viewportMask);
        
        // Create content container for scrollable content
        this.contentContainer = new Container();
        // Apply the mask to the content container
        this.contentContainer.mask = this.viewportMask;
        parentContainer.addChild(this.contentContainer);
        
        // Set initial dimensions
        this.resize(window.innerWidth, window.innerHeight);
        
        // Set up wheel event
        parentContainer.eventMode = 'static';
        parentContainer.on('wheel', this.handleWheel.bind(this));
    }
    
    private drawViewportMask(): void {
        this.viewportMask.clear();
        this.viewportMask.beginFill(0xFFFFFF);
        // Create mask that accounts for the mission panel width
        const missionPanelWidth = 350; // Same as MISSION_PANEL_WIDTH in TerminalScreen
        const maskWidth = window.innerWidth - missionPanelWidth;
        this.viewportMask.drawRect(0, 0, maskWidth, window.innerHeight);
        this.viewportMask.endFill();
    }
    
    public getContentContainer(): Container {
        return this.contentContainer;
    }
    
    public resize(width: number, height: number): void {
        this.terminalWidth = width;
        this.terminalHeight = height;
        
        // Update viewport mask when resizing
        this.drawViewportMask();
        
        this.updateScrollbarVisibility();
    }
    
    private startDragging(event: FederatedPointerEvent): void {
        this.isDragging = true;
        this.lastMouseY = event.global.y;
        document.body.style.cursor = 'grabbing';
        
        // Capture pointer to improve drag experience
        this.scrollbar.addEventListener('pointermove', this.dragScrollbar.bind(this));
        document.addEventListener('pointerup', this.stopDragging.bind(this));
    }
    
    private stopDragging(): void {
        this.isDragging = false;
        document.body.style.cursor = 'auto';
        
        // Release pointer capture
        this.scrollbar.removeEventListener('pointermove', this.dragScrollbar.bind(this));
        document.removeEventListener('pointerup', this.stopDragging.bind(this));
    }
    
    private dragScrollbar(event: FederatedPointerEvent): void {
        if (!this.isDragging) return;
        
        const deltaY = event.global.y - this.lastMouseY;
        this.lastMouseY = event.global.y;
        
        const visibleHeight = this.terminalHeight - this.paddingY * 2;
        const contentHeight = this.getContentHeight();
        
        // Calculate scroll ratio
        const scrollRatio = this.maxScrollPosition / (visibleHeight - this.scrollbar.height);
        
        // Apply movement with ratio
        const newPosition = Math.max(0, Math.min(this.maxScrollPosition, 
                                               this.scrollPosition + deltaY * scrollRatio));
        
        if (newPosition !== this.scrollPosition) {
            this.scrollPosition = newPosition;
            this.updateScrollbar();
        }
    }
    
    public scrollToBottom(): void {
        if (!this.scrollbarVisible) return;
        
        this.scrollPosition = this.maxScrollPosition;
        this.updateScrollbar();
    }
    
    // Scroll to a position that keeps the bottom content visible with padding
    public scrollToBottomWithPadding(paddingHeight: number): void {
        // Always ensure the scrollbar is visible when using padding
        this.updateScrollbarVisibility();
        
        // Calculate visible height and total content height
        const visibleHeight = this.terminalHeight - this.paddingY * 2;
        const contentHeight = this.getContentHeight();
        
        // Ensure we always have enough room for content + padding
        if (contentHeight + paddingHeight > visibleHeight) {
            // Make sure scrollbar is shown even if content alone wouldn't require it
            this.scrollbarVisible = true;
            this.scrollbar.visible = true;
            this.scrollbarTrack.visible = true;
            
            // Force the max scroll position to account for padding
            this.maxScrollPosition = Math.max(this.maxScrollPosition, contentHeight + paddingHeight - visibleHeight);
            
            // Set scroll position to show the bottom content with padding
            this.scrollPosition = this.maxScrollPosition;
            
            // Apply the scroll immediately
            this.updateScrollbar();
        }
    }
    
    public updateContentAdded(): void {
        this.updateScrollbarVisibility();
        // Instead of just scrolling to bottom, we'll scroll with padding by default
        // This ensures content is properly positioned for input visibility
        // We use a small default padding in case the specific method isn't called
        this.scrollToBottomWithPadding(30);
    }
    
    private updateScrollbarVisibility(): void {
        if (this.contentContainer.children.length === 0) {
            this.scrollbarVisible = false;
            this.scrollbar.visible = false;
            this.scrollbarTrack.visible = false;
            return;
        }

        // Find the total height of all text
        const contentHeight = this.getContentHeight();
        const visibleHeight = this.terminalHeight - this.paddingY * 2;
        
        // Only show scrollbar if content exceeds visible area
        this.scrollbarVisible = contentHeight > visibleHeight;
        this.scrollbar.visible = this.scrollbarVisible;
        this.scrollbarTrack.visible = this.scrollbarVisible;

        if (this.scrollbarVisible) {
            this.maxScrollPosition = Math.max(0, contentHeight - visibleHeight);
            
            // Keep scroll position in bounds
            if (this.scrollPosition > this.maxScrollPosition) {
                this.scrollPosition = this.maxScrollPosition;
            }
            
            this.updateScrollbar();
        } else {
            // Reset scroll position when not needed
            this.scrollPosition = 0;
            this.updateScrollbar();
        }
    }
    
    private updateScrollbar(): void {
        if (!this.scrollbarVisible) return;

        // Calculate scrollbar height and position based on content
        const visibleHeight = this.terminalHeight - this.paddingY * 2;
        const contentHeight = this.getContentHeight();
        
        // Handle case where content is shorter than visible area
        if (contentHeight <= visibleHeight) {
            this.scrollbar.visible = false;
            this.scrollbarTrack.visible = false;
            return;
        }

        // Ensure scrollPosition is within valid range
        this.scrollPosition = Math.max(0, Math.min(this.scrollPosition, this.maxScrollPosition));

        // Calculate scrollbar size and position
        const scrollbarHeight = Math.max(30, (visibleHeight / contentHeight) * visibleHeight);
        const scrollbarY = (this.scrollPosition / this.maxScrollPosition) * (visibleHeight - scrollbarHeight);
        
        // Update scrollbar graphics
        this.scrollbar.clear();
        this.scrollbar.beginFill(this.theme.foreground, 0.5);
        this.scrollbar.drawRoundedRect(0, 0, this.scrollbarWidth, scrollbarHeight, 3);
        this.scrollbar.endFill();
        
        // Position scrollbar
        this.scrollbar.x = this.terminalWidth - this.scrollbarWidth - 5;
        this.scrollbar.y = this.paddingY + scrollbarY;
        
        // Update scrollbar track
        this.scrollbarTrack.clear();
        this.scrollbarTrack.beginFill(this.theme.background, 0.3);
        this.scrollbarTrack.drawRoundedRect(0, 0, this.scrollbarWidth, visibleHeight, 3);
        this.scrollbarTrack.endFill();
        this.scrollbarTrack.x = this.terminalWidth - this.scrollbarWidth - 5;
        this.scrollbarTrack.y = this.paddingY;
        
        // Make sure both are visible
        this.scrollbar.visible = true;
        this.scrollbarTrack.visible = true;
        
        // Apply scroll position to content
        this.contentContainer.y = -this.scrollPosition;
    }
    
    private getContentHeight(): number {
        if (this.contentContainer.children.length === 0) return 0;
        
        let maxHeight = 0;
        this.contentContainer.children.forEach(child => {
            maxHeight = Math.max(maxHeight, child.y + child.height);
        });
        
        return maxHeight;
    }
    
    private handleWheel(event: WheelEvent): void {
        if (!this.scrollbarVisible) return;
        
        event.preventDefault();
        
        // Calculate the scroll amount with scaling for smoother scrolling
        const scrollSpeed = 0.5; // Adjust speed factor
        let scrollDelta = event.deltaY * scrollSpeed;
        
        // Calculate new position with bounds checking
        const newPosition = Math.max(0, Math.min(this.maxScrollPosition, this.scrollPosition + scrollDelta));
        
        // Only update if position actually changed
        if (newPosition !== this.scrollPosition) {
            this.scrollPosition = newPosition;
            this.updateScrollbar();
        }
    }
    
    public setTheme(theme: TerminalTheme): void {
        this.theme = theme;
        this.updateScrollbar();
    }
    
    // Add method to set a minimum content height
    // This ensures there's always enough space at the bottom for the input prompt
    public setMinimumContentHeight(minHeight: number): void {
        // Get the current actual content height
        const actualContentHeight = this.getContentHeight();
        
        // If the content is already taller than the minimum height, do nothing
        if (actualContentHeight >= minHeight) return;
        
        // Otherwise, update the scrollbar to account for the minimum height
        this.updateScrollbarVisibility();
        
        // Set maxScrollPosition based on the minimum height if it's larger
        const visibleHeight = this.terminalHeight - this.paddingY * 2;
        if (minHeight > visibleHeight) {
            this.maxScrollPosition = Math.max(this.maxScrollPosition, minHeight - visibleHeight);
            this.updateScrollbar();
        }
    }
} 