import { Container } from "pixi.js";

export class Screen extends Container {
    public async show(): Promise<void> {
        // To be implemented by child classes
    }

    public async hide(): Promise<void> {
        // To be implemented by child classes
        this.destroy();
    }
} 