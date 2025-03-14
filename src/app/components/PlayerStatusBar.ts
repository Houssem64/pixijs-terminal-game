import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { MissionManager, PlayerProgress } from "../utils/MissionManager";

/**
 * A component that displays player status (level, rank, ELO) in the top right corner
 * of the screen, with a stylish cyberpunk design.
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
    
    private barWidth: number = 220;
    private barHeight: number = 80;
    
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
            fontSize: 14,
            fill: 0xffff00,
            fontWeight: "500",
        });
        
        const eloStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 12,
            fill: 0xff9900,
            fontWeight: "400",
        });
        
        const xpStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 10,
            fill: 0xaaaaaa,
            fontWeight: "400",
        });
        
        // Create text elements
        this.levelText = new Text(`LEVEL ${this.playerData.level}`, levelStyle);
        this.levelText.x = 10;
        this.levelText.y = 10;
        this.addChild(this.levelText);
        
        this.rankText = new Text(`RANK: ${this.playerData.rank}`, rankStyle);
        this.rankText.x = 10;
        this.rankText.y = 32;
        this.addChild(this.rankText);
        
        this.eloText = new Text(`ELO: ${this.playerData.elo.toLocaleString()}`, eloStyle);
        this.eloText.x = 10;
        this.eloText.y = 52;
        this.addChild(this.eloText);
        
        // XP bar background
        this.xpBarBackground = new Graphics();
        this.xpBarBackground.beginFill(0x333333);
        this.xpBarBackground.drawRect(0, 0, this.barWidth - 20, 6);
        this.xpBarBackground.endFill();
        this.xpBarBackground.x = 10;
        this.xpBarBackground.y = 70;
        this.addChild(this.xpBarBackground);
        
        // XP progress bar
        this.xpBar = new Graphics();
        this.addChild(this.xpBar);
        
        // XP text
        this.xpText = new Text("", xpStyle);
        this.xpText.x = 10;
        this.xpText.y = 70 + 8;
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
        this.background.beginFill(0x111111, 0.85);
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
        this.levelText.text = `LEVEL ${this.playerData.level}`;
        this.rankText.text = `RANK: ${this.playerData.rank}`;
        this.eloText.text = `ELO: ${this.playerData.elo.toLocaleString()}`;
        
        // Calculate XP progress percentage
        const totalXpForLevel = this.playerData.xp + this.playerData.xpToNextLevel;
        const currentXpInLevel = totalXpForLevel - this.playerData.xpToNextLevel;
        const progressPercentage = currentXpInLevel / totalXpForLevel;
        
        // Update XP bar
        this.xpBar.clear();
        this.xpBar.beginFill(0x00ff00);
        this.xpBar.drawRect(10, 70, (this.barWidth - 20) * progressPercentage, 6);
        this.xpBar.endFill();
        
        // Update XP text
        this.xpText.text = `XP: ${currentXpInLevel}/${totalXpForLevel} (${Math.round(progressPercentage * 100)}%)`;
    }
    
    /**
     * Resize the component
     */
    public resize(width: number, height: number): void {
        // Position in top right corner with some padding
        this.x = width - this.barWidth - 10;
        this.y = 10;
    }
} 