import { Container, Graphics, FederatedPointerEvent } from "pixi.js";

export class Scrollbar extends Container {
    private track!: Graphics;
    private thumb!: Graphics;
    private contentMask!: Graphics;
    private content: Container;
    
    private isDragging = false;
    private startY = 0;
    private thumbStartY = 0;

    constructor(
        protected viewWidth: number,
        protected viewHeight: number,
        content: Container,
        private trackColor = 0x222222,
        private thumbColor = 0x00ff00
    ) {
        super();

        this.content = content;
        this.setup();
    }

    private setup(): void {
        // Create track
        this.track = new Graphics();
        this.drawTrack();
        this.addChild(this.track);

        // Create thumb
        this.thumb = new Graphics();
        this.drawThumb();
        this.addChild(this.thumb);

        // Make thumb interactive
        this.thumb.interactive = true;
        this.thumb.cursor = 'pointer';
        this.thumb
            .on('pointerdown', this.onDragStart.bind(this))
            .on('pointerup', this.onDragEnd.bind(this))
            .on('pointerupoutside', this.onDragEnd.bind(this));

        // Add wheel listener to parent
        window.addEventListener('wheel', this.onWheel.bind(this));

        // Create mask for content
        this.contentMask = new Graphics();
        this.drawContentMask();
        this.content.mask = this.contentMask;
    }

    private drawTrack(): void {
        this.track.clear();
        this.track.beginFill(this.trackColor, 0.3);
        this.track.drawRect(0, 0, 8, this.viewHeight);
        this.track.endFill();
    }

    private drawThumb(): void {
        const contentRatio = Math.min(this.viewHeight / this.content.height, 1);
        const thumbHeight = Math.max(30, this.viewHeight * contentRatio);

        this.thumb.clear();
        this.thumb.beginFill(this.thumbColor, 0.5);
        this.thumb.drawRoundedRect(0, 0, 8, thumbHeight, 4);
        this.thumb.endFill();
    }

    private drawContentMask(): void {
        this.contentMask.clear();
        this.contentMask.beginFill(0xffffff);
        this.contentMask.drawRect(0, 0, this.viewWidth, this.viewHeight);
        this.contentMask.endFill();
    }

    private onDragStart(event: FederatedPointerEvent): void {
        this.isDragging = true;
        this.startY = event.global.y;
        this.thumbStartY = this.thumb.y;
        
        window.addEventListener('pointermove', this.onDragMove.bind(this));
    }

    private onDragEnd(): void {
        this.isDragging = false;
        window.removeEventListener('pointermove', this.onDragMove.bind(this));
    }

    private onDragMove(event: PointerEvent): void {
        if (!this.isDragging) return;

        const newY = this.thumbStartY + (event.clientY - this.startY);
        this.updateThumbPosition(newY);
    }

    private onWheel(event: WheelEvent): void {
        const scrollAmount = event.deltaY;
        const newY = this.thumb.y + scrollAmount * 0.1;
        this.updateThumbPosition(newY);
    }

    private updateThumbPosition(newY: number): void {
        const maxY = this.viewHeight - this.thumb.height;
        this.thumb.y = Math.max(0, Math.min(newY, maxY));

        // Update content position
        const scrollRatio = this.thumb.y / maxY;
        const contentY = -(this.content.height - this.viewHeight) * scrollRatio;
        this.content.y = contentY;
    }

    public resize(width: number, height: number): void {
        this.viewWidth = width;
        this.viewHeight = height;
        
        this.drawTrack();
        this.drawThumb();
        this.drawContentMask();
    }

    public destroy(): void {
        window.removeEventListener('wheel', this.onWheel.bind(this));
        super.destroy();
    }
} 