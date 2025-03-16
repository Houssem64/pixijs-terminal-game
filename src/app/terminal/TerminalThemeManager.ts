import { TextStyle } from "pixi.js";

export interface TerminalTheme {
    background: number;
    foreground: number;
    prompt: number;
    error: number;
    selection: number;
    cursor: number;
    link: number;
    commandHighlight: number;
    name: string;
}

// Built-in terminal themes
export const THEMES: Record<string, TerminalTheme> = {
    dracula: {
        background: 0x282a36,
        foreground: 0xf8f8f2,
        prompt: 0x50fa7b,
        error: 0xff5555,
        selection: 0x44475a,
        cursor: 0xf8f8f2,
        link: 0x8be9fd,
        commandHighlight: 0xffb86c,
        name: "Dracula"
    },
    monokai: {
        background: 0x272822,
        foreground: 0xf8f8f2,
        prompt: 0xa6e22e,
        error: 0xf92672,
        selection: 0x49483e,
        cursor: 0xf8f8f2,
        link: 0x66d9ef,
        commandHighlight: 0xfd971f,
        name: "Monokai"
    },
    solarized: {
        background: 0x002b36,
        foreground: 0x839496,
        prompt: 0x859900,
        error: 0xdc322f,
        selection: 0x073642,
        cursor: 0x839496,
        link: 0x268bd2,
        commandHighlight: 0xcb4b16,
        name: "Solarized Dark"
    }
};

export class TerminalThemeManager {
    private currentTheme: TerminalTheme;
    private textStyle!: TextStyle;
    private promptStyle!: TextStyle;
    private errorStyle!: TextStyle;

    constructor(initialTheme: string = 'dracula') {
        this.currentTheme = THEMES[initialTheme] || THEMES.dracula;
        this.updateStyles();
    }

    public getTheme(): TerminalTheme {
        return this.currentTheme;
    }

    public setTheme(themeName: string): void {
        if (THEMES[themeName]) {
            this.currentTheme = THEMES[themeName];
            this.updateStyles();
        }
    }

    public getTextStyle(): TextStyle {
        return this.textStyle;
    }

    public getPromptStyle(): TextStyle {
        return this.promptStyle;
    }

    public getErrorStyle(): TextStyle {
        return this.errorStyle;
    }

    public getDarkerColor(color: number, factor: number): number {
        const r = ((color >> 16) & 0xFF) * factor;
        const g = ((color >> 8) & 0xFF) * factor;
        const b = (color & 0xFF) * factor;
        return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
    }

    private updateStyles(): void {
        // Common text style
        this.textStyle = new TextStyle({
            fontFamily: "Fira Code, monospace",
            fontSize: 16,
            fill: this.currentTheme.foreground,
            fontWeight: "400",
            letterSpacing: 0,
            padding: 5
        });

        // Prompt style
        this.promptStyle = new TextStyle({
            fontFamily: "Fira Code, monospace",
            fontSize: 16,
            fill: this.currentTheme.prompt,
            fontWeight: "500",
            letterSpacing: 0,
            padding: 5
        });

        // Error style
        this.errorStyle = new TextStyle({
            fontFamily: "Fira Code, monospace",
            fontSize: 16,
            fill: this.currentTheme.error,
            fontWeight: "400",
            letterSpacing: 0,
            padding: 5
        });
    }

    public getAllThemeNames(): string[] {
        return Object.keys(THEMES);
    }
} 