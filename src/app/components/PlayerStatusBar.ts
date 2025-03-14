import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { MissionManager, PlayerProgress } from "../utils/MissionManager";

/**
 * A component that displays player status (level, rank, ELO) at the top of sidebar 
 * with a stylish cyberpunk design.
 */
export class PlayerStatusBar extends Container {
    private background: Graphics;
    private levelText: Text;
    private rankText: Text;
    private eloText: Text;
    private xpBar: Graphics;
    private xpBarBackground: Graphics;
    private xpText: Text;
    
    private manager: MissionManager;
    private playerData: PlayerProgress;
    
    private barWidth: number = 350; // Match the sidebar width
    private barHeight: number = 100; // Increased height for better spacing
    
    constructor() {
        super();
        
        this.manager = MissionManager.getInstance();
        this.playerData = this.manager.getPlayerProgress();
        
        // Create background with cyberpunk style
        this.background = new Graphics();
        this.addChild(this.background);
        
        // Text styles
        const levelStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 18,
            fill: 0x00ffff,
            fontWeight: "700",
        });
        
        const rankStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 18, // Increased size for better visibility
            fill: 0xffff00,
            fontWeight: "700", // Made bold
        });
        
        const eloStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 16, // Increased size for better visibility
            fill: 0xff9900,
            fontWeight: "500", // Made more bold
        });
        
        const xpStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 10,
            fill: 0xaaaaaa,
            fontWeight: "400",
        });
        
        // Create text elements - Changed order to put rank and ELO first
        this.rankText = new Text(`RANK: ${this.playerData.rank}`, rankStyle);
        this.rankText.x = 20; // More padding
        this.rankText.y = 15; // More padding
        this.addChild(this.rankText);
        
        this.eloText = new Text(`ELO: ${this.playerData.elo.toLocaleString()}`, eloStyle);
        this.eloText.x = 20;
        this.eloText.y = 45; // Increased spacing
        this.addChild(this.eloText);
        
        this.levelText = new Text(`LEVEL ${this.playerData.level}`, levelStyle);
        this.levelText.x = 20;
        this.levelText.y = 75; // Increased spacing
        this.addChild(this.levelText);
        
        // XP bar background
        this.xpBarBackground = new Graphics();
        this.xpBarBackground.beginFill(0x333333);
        this.xpBarBackground.drawRect(0, 0, this.barWidth - 40, 6); // Adjusted width
        this.xpBarBackground.endFill();
        this.xpBarBackground.x = 20;
        this.xpBarBackground.y = 105; // Adjusted position
        this.addChild(this.xpBarBackground);
        
        // XP progress bar
        this.xpBar = new Graphics();
        this.addChild(this.xpBar);
        
        // XP text
        this.xpText = new Text("", xpStyle);
        this.xpText.x = 20;
        this.xpText.y = 115; // Adjusted position
        this.addChild(this.xpText);
        
        // Draw the component
        this.draw();
        
        // Listen for progress changes
        this.manager.on('level-up', () => this.updatePlayerData());
        this.manager.on('rank-up', () => this.updatePlayerData());
        this.manager.on('rewards-granted', () => this.updatePlayerData());
    }
    
    /**
     * Update internal player data and redraw
     */
    private updatePlayerData(): void {
        this.playerData = this.manager.getPlayerProgress();
        this.draw();
    }
    
    /**
     * Draw the component with updated data
     */
    private draw(): void {
        // Draw background with cyberpunk style
        this.background.clear();
        
        // Main background
        this.background.beginFill(0x111111, 0.9); // More opaque
        this.background.lineStyle(2, 0x00ffff);
        this.background.drawRect(0, 0, this.barWidth, this.barHeight);
        this.background.endFill();
        
        // Accent lines
        this.background.lineStyle(1, 0xff00ff, 0.7);
        this.background.moveTo(0, 4);
        this.background.lineTo(this.barWidth * 0.7, 4);
        this.background.moveTo(this.barWidth - 4, 0);
        this.background.lineTo(this.barWidth - 4, this.barHeight * 0.6);
        
        // Update text content
        this.rankText.text = `RANK: ${this.playerData.rank}`;
        this.eloText.text = `ELO: ${this.playerData.elo.toLocaleString()}`;
        this.levelText.text = `LEVEL ${this.playerData.level}`;
        
        // Calculate XP progress percentage
        const totalXpForLevel = this.playerData.xp + this.playerData.xpToNextLevel;
        const currentXpInLevel = totalXpForLevel - this.playerData.xpToNextLevel;
        const progressPercentage = currentXpInLevel / totalXpForLevel;
        
        // Update XP bar
        this.xpBar.clear();
        this.xpBar.beginFill(0x00ff00);
        this.xpBar.drawRect(20, 105, (this.barWidth - 40) * progressPercentage, 6); // Adjusted position
        this.xpBar.endFill();
        
        // Update XP text
        this.xpText.text = `XP: ${currentXpInLevel}/${totalXpForLevel} (${Math.round(progressPercentage * 100)}%)`;
    }
    
    /**
     * Resize the component
     * No longer need to position it as this is handled by TerminalScreen
     */
    public resize(width: number, height: number): void {
        // Simply redraw to ensure proper appearance
        this.draw();
    }
} 