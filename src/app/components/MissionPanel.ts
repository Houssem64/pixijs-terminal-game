import { Container, Graphics, Text, TextStyle } from "pixi.js";

interface Mission {
    id: string;
    title: string;
    description: string;
    steps: string[];
    completed: boolean;
}

export class MissionPanel extends Container {
    private background: Graphics;
    private contentContainer: Container;
    private missions: Mission[];
    private currentMissionIndex = 0;

    private titleStyle: TextStyle;
    private textStyle: TextStyle;
    private stepStyle: TextStyle;

    constructor() {
        super();

        this.background = new Graphics();
        this.contentContainer = new Container();
        this.addChild(this.background);
        this.addChild(this.contentContainer);

        // Initialize text styles
        this.titleStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 20,
            fill: 0x00ff00,
            fontWeight: "700",
            letterSpacing: 0,
            padding: 4
        });

        this.textStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: 0x00ff00,
            fontWeight: "400",
            letterSpacing: 0,
            padding: 4,
            wordWrap: true,
            wordWrapWidth: 280
        });

        this.stepStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: 0xaaffaa,
            fontWeight: "400",
            letterSpacing: 0,
            padding: 4,
            wordWrap: true,
            wordWrapWidth: 260
        });

        // Initialize missions
        this.missions = [
            {
                id: "intro",
                title: "Welcome to Terminal",
                description: "Learn the basics of using the terminal interface.",
                steps: [
                    "Type 'help' to see available commands",
                    "Try using 'ls' to list files",
                    "Use 'cd' to change directories"
                ],
                completed: false
            },
            {
                id: "files",
                title: "File Management",
                description: "Learn how to manage files and directories.",
                steps: [
                    "Create a directory with 'mkdir'",
                    "Create a file with 'touch'",
                    "Write to a file using 'echo'",
                    "Read a file using 'cat'"
                ],
                completed: false
            },
            {
                id: "advanced",
                title: "Advanced Features",
                description: "Explore advanced terminal features.",
                steps: [
                    "Try the 'neofetch' command",
                    "Use 'sudo' for admin commands",
                    "Edit files with 'nano'",
                    "Connect to FTP with 'ftp'"
                ],
                completed: false
            }
        ];

        this.draw();
    }

    private draw(): void {
        // Clear previous content
        this.contentContainer.removeChildren();

        // Draw background
        this.background.clear();
        this.background.beginFill(0x111111);
        this.background.drawRect(0, 0, 300, window.innerHeight);
        this.background.endFill();

        // Draw header
        const header = new Text("MISSIONS", this.titleStyle);
        header.x = 20;
        header.y = 20;
        this.contentContainer.addChild(header);

        // Draw current mission
        const mission = this.missions[this.currentMissionIndex];
        
        const title = new Text(mission.title, this.titleStyle);
        title.x = 20;
        title.y = 60;
        this.contentContainer.addChild(title);

        const description = new Text(mission.description, this.textStyle);
        description.x = 20;
        description.y = 100;
        this.contentContainer.addChild(description);

        // Draw steps
        let stepY = 150;
        mission.steps.forEach((step, index) => {
            const bullet = new Text(`${index + 1}. `, this.stepStyle);
            bullet.x = 20;
            bullet.y = stepY;
            this.contentContainer.addChild(bullet);

            const stepText = new Text(step, this.stepStyle);
            stepText.x = 45;
            stepText.y = stepY;
            this.contentContainer.addChild(stepText);

            stepY += stepText.height + 10;
        });

        // Draw navigation dots
        const dotY = stepY + 30;
        this.missions.forEach((_, index) => {
            const dot = new Graphics();
            dot.beginFill(index === this.currentMissionIndex ? 0x00ff00 : 0x333333);
            dot.drawCircle(0, 0, 4);
            dot.endFill();
            dot.x = 20 + index * 20;
            dot.y = dotY;
            this.contentContainer.addChild(dot);
        });
    }

    public nextMission(): void {
        if (this.currentMissionIndex < this.missions.length - 1) {
            this.currentMissionIndex++;
            this.draw();
        }
    }

    public previousMission(): void {
        if (this.currentMissionIndex > 0) {
            this.currentMissionIndex--;
            this.draw();
        }
    }

    public completeMission(id: string): void {
        const mission = this.missions.find(m => m.id === id);
        if (mission) {
            mission.completed = true;
            this.draw();
        }
    }

    public resize(width: number, height: number): void {
        this.background.clear();
        this.background.beginFill(0x111111);
        this.background.drawRect(0, 0, width, height);
        this.background.endFill();
    }
} 