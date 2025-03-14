import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { MissionData, MissionReward } from "../utils/MissionManager";

/**
 * A popup that appears when a mission is completed, displaying reward information
 * with a stylish animation.
 */
export class MissionCompletionPopup extends Container {
    private background: Graphics;
    private titleText: Text;
    private rewardTitleText: Text;
    private rewardTexts: Text[] = [];
    private closeButton: Container;
    private mission: MissionData;
    
    private popupWidth: number = 400;
    private popupHeight: number = 300;
    
    constructor(mission: MissionData) {
        super();
        
        this.mission = mission;
        
        // Initially set alpha to 0 for fade-in animation
        this.alpha = 0;
        
        // Position in the center of the screen (will be updated in resize)
        this.x = window.innerWidth / 2 - this.popupWidth / 2;
        this.y = window.innerHeight / 2 - this.popupHeight / 2;
        
        // Create semi-transparent overlay that covers the whole screen
        const overlay = new Graphics();
        overlay.beginFill(0x000000, 0.7);
        overlay.drawRect(-5000, -5000, 10000, 10000); // Large enough to cover the screen
        overlay.endFill();
        this.addChild(overlay);
        
        // Create popup background
        this.background = new Graphics();
        this.addChild(this.background);
        
        // Text styles
        const titleStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 24,
            fill: 0x00ff00,
            fontWeight: "700",
            align: "center"
        });
        
        const rewardTitleStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 18,
            fill: 0xffff00,
            fontWeight: "700",
            align: "center"
        });
        
        const rewardTextStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 16,
            fill: 0xffffff,
            fontWeight: "400",
            align: "left"
        });
        
        // Create text elements
        this.titleText = new Text(`MISSION COMPLETE: ${mission.title}`, titleStyle);
        this.titleText.x = this.popupWidth / 2;
        this.titleText.y = 30;
        this.titleText.anchor.set(0.5, 0);
        this.addChild(this.titleText);
        
        this.rewardTitleText = new Text("REWARDS EARNED:", rewardTitleStyle);
        this.rewardTitleText.x = this.popupWidth / 2;
        this.rewardTitleText.y = 80;
        this.rewardTitleText.anchor.set(0.5, 0);
        this.addChild(this.rewardTitleText);
        
        // Add reward texts
        this.createRewardTexts(mission.reward, rewardTextStyle);
        
        // Create close button
        this.closeButton = this.createCloseButton();
        this.closeButton.x = this.popupWidth / 2;
        this.closeButton.y = this.popupHeight - 40;
        this.addChild(this.closeButton);
        
        // Draw the popup
        this.draw();
        
        // Start animation
        this.animateIn();
    }
    
    /**
     * Create text elements for each reward
     */
    private createRewardTexts(reward: MissionReward, style: TextStyle): void {
        let y = 120;
        
        // XP reward
        const xpText = new Text(`+ ${reward.xp} XP`, style);
        xpText.x = this.popupWidth / 2 - 100;
        xpText.y = y;
        this.addChild(xpText);
        this.rewardTexts.push(xpText);
        y += 30;
        
        // Skill points rewards
        if (reward.skillPoints) {
            Object.entries(reward.skillPoints).forEach(([skill, points]) => {
                const skillText = new Text(`+ ${points} ${this.formatSkillName(skill)} skill points`, style);
                skillText.x = this.popupWidth / 2 - 100;
                skillText.y = y;
                this.addChild(skillText);
                this.rewardTexts.push(skillText);
                y += 30;
            });
        }
        
        // Item rewards
        if (reward.items && reward.items.length > 0) {
            const itemsText = new Text(`+ Items: ${reward.items.join(", ")}`, style);
            itemsText.x = this.popupWidth / 2 - 100;
            itemsText.y = y;
            this.addChild(itemsText);
            this.rewardTexts.push(itemsText);
            y += 30;
        }
        
        // Unlocked missions
        if (reward.unlocks && reward.unlocks.length > 0) {
            const unlocksText = new Text(`+ Unlocked: ${reward.unlocks.length} new mission(s)`, style);
            unlocksText.x = this.popupWidth / 2 - 100;
            unlocksText.y = y;
            this.addChild(unlocksText);
            this.rewardTexts.push(unlocksText);
        }
    }
    
    /**
     * Format skill name for display
     */
    private formatSkillName(skillId: string): string {
        return skillId
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Create a close button
     */
    private createCloseButton(): Container {
        const container = new Container();
        
        const buttonBg = new Graphics();
        buttonBg.beginFill(0x333333);
        buttonBg.lineStyle(2, 0x00ff00);
        buttonBg.drawRoundedRect(-75, -20, 150, 40, 5);
        buttonBg.endFill();
        container.addChild(buttonBg);
        
        const buttonText = new Text("CONTINUE", new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 16,
            fill: 0x00ff00,
            fontWeight: "700",
            align: "center"
        }));
        buttonText.anchor.set(0.5);
        container.addChild(buttonText);
        
        // Make button interactive
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.on('pointerdown', () => this.close());
        
        // Add hover effect
        container.on('pointerover', () => {
            buttonBg.tint = 0x444444;
        });
        
        container.on('pointerout', () => {
            buttonBg.tint = 0xffffff;
        });
        
        return container;
    }
    
    /**
     * Draw the popup
     */
    private draw(): void {
        this.background.clear();
        
        // Cyberpunk-style background with neon border
        this.background.lineStyle(3, 0x00ff00);
        this.background.beginFill(0x111111, 0.95);
        this.background.drawRect(0, 0, this.popupWidth, this.popupHeight);
        this.background.endFill();
        
        // Accent lines
        this.background.lineStyle(1, 0xff00ff);
        this.background.moveTo(20, 0);
        this.background.lineTo(20, 20);
        this.background.lineTo(0, 20);
        
        this.background.moveTo(this.popupWidth - 20, 0);
        this.background.lineTo(this.popupWidth - 20, 20);
        this.background.lineTo(this.popupWidth, 20);
        
        this.background.moveTo(20, this.popupHeight);
        this.background.lineTo(20, this.popupHeight - 20);
        this.background.lineTo(0, this.popupHeight - 20);
        
        this.background.moveTo(this.popupWidth - 20, this.popupHeight);
        this.background.lineTo(this.popupWidth - 20, this.popupHeight - 20);
        this.background.lineTo(this.popupWidth, this.popupHeight - 20);
    }
    
    /**
     * Animate the popup coming into view
     */
    private animateIn(): void {
        // Scale animation
        this.scale.set(0.5);
        
        // Use GSAP or similar animation library if available
        // For now, using simple animation with requestAnimationFrame
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / 500, 1); // 500ms animation
            
            this.alpha = progress;
            this.scale.set(0.5 + progress * 0.5);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    /**
     * Close the popup
     */
    public close(): void {
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / 300, 1); // 300ms animation
            
            this.alpha = 1 - progress;
            this.scale.set(1 - progress * 0.3);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Remove from parent when animation is complete
                if (this.parent) {
                    this.parent.removeChild(this);
                }
            }
        };
        
        animate();
    }
    
    /**
     * Resize the popup to center in screen
     */
    public resize(width: number, height: number): void {
        this.x = width / 2 - this.popupWidth / 2;
        this.y = height / 2 - this.popupHeight / 2;
    }
} 