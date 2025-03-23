import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from "pixi.js";

interface Mission {
    id: string;
    title: string;
    description: string;
    category: MissionCategory;
    difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    steps: string[];
    completed: boolean;
    learningObjectives: string[];
    stepCommands?: string[]; // Terminal commands to complete each step
    completedSteps?: number[]; // Tracks which steps are completed
}

enum MissionCategory {
    BRUTE_FORCE = "Brute Force",
    PEN_TESTING = "Penetration Testing",
    SOCIAL_ENGINEERING = "Social Engineering",
    CRYPTOGRAPHY = "Cryptography",
    NETWORK_SECURITY = "Network Security",
    WEB_SECURITY = "Web Security",
    FORENSICS = "Digital Forensics",
    MALWARE_ANALYSIS = "Malware Analysis"
}

export class MissionPanel extends Container {
    private background: Graphics;
    private contentContainer: Container;
    private missions: Mission[];
    private currentMissionIndex = 0;
    private currentCategory: MissionCategory | null = null;
    private showingCategoryList = true;
    private activeMission: Mission | null = null;
    private PANEL_WIDTH = 350;

    private titleStyle: TextStyle;
    private textStyle: TextStyle;
    private stepStyle: TextStyle;
    private categoryStyle: TextStyle;
    private buttonStyle: TextStyle;
    private objectiveStyle: TextStyle;
    private difficultyStyle: TextStyle;

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
            padding: 6
        });

        this.textStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: 0x00ff00,
            fontWeight: "400",
            letterSpacing: 0,
            padding: 4,
            wordWrap: true,
            wordWrapWidth: this.PANEL_WIDTH - 40
        });

        this.stepStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: 0xaaffaa,
            fontWeight: "400",
            letterSpacing: 0,
            padding: 4,
            wordWrap: true,
            wordWrapWidth: this.PANEL_WIDTH - 60
        });

        this.categoryStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 16,
            fill: 0x00ffff,
            fontWeight: "500",
            letterSpacing: 0,
            padding: 4
        });

        this.buttonStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: 0xffff00,
            fontWeight: "400",
            letterSpacing: 0,
            padding: 4
        });

        this.objectiveStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: 0xff9900,
            fontWeight: "400",
            letterSpacing: 0,
            padding: 4,
            wordWrap: true,
            wordWrapWidth: this.PANEL_WIDTH - 60
        });

        this.difficultyStyle = new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: 0xff5555,
            fontWeight: "500",
            letterSpacing: 0,
            padding: 4
        });

        // Initialize missions
        this.missions = [
            // Brute Force Missions
            {
                id: "password-crack",
                title: "Password Cracker",
                description: "Learn to break weak passwords using basic brute force techniques.",
                category: MissionCategory.BRUTE_FORCE,
                difficulty: "Beginner",
                steps: [
                    "Use the 'crack' tool to attempt password recovery",
                    "Identify common password patterns",
                    "Apply dictionary-based attacks"
                ],
                completed: false,
                learningObjectives: [
                    "Understand password vulnerability",
                    "Learn common cracking methodologies",
                    "Recognize weak password patterns"
                ]
            },
            {
                id: "hash-breaker",
                title: "Hash Breaker",
                description: "Break through password hashes using rainbow tables and brute force methods.",
                category: MissionCategory.BRUTE_FORCE,
                difficulty: "Intermediate",
                steps: [
                    "Identify the hash algorithm used",
                    "Apply rainbow table lookups",
                    "Execute targeted brute force attacks"
                ],
                completed: false,
                learningObjectives: [
                    "Understand hash functions and their weaknesses",
                    "Learn rainbow table implementation",
                    "Practice efficient brute forcing with constraints"
                ]
            },
            
            // Penetration Testing Missions
            {
                id: "network-scan",
                title: "Network Reconnaissance",
                description: "Learn to map a network, identify hosts, and discover open ports.",
                category: MissionCategory.PEN_TESTING,
                difficulty: "Beginner",
                steps: [
                    "Use 'scan' to identify hosts on the network",
                    "Enumerate open ports with 'portscan'",
                    "Map network topology and services"
                ],
                completed: false,
                learningObjectives: [
                    "Understand network scanning techniques",
                    "Learn port enumeration methods",
                    "Practice identifying vulnerable services"
                ]
            },
            {
                id: "wifi_pentest",
                title: "WiFi Penetration Test",
                description: "Learn how to perform a complete penetration test on a WiFi network. You'll scan for networks, capture handshakes, analyze traffic, and crack WiFi passwords.",
                category: MissionCategory.PEN_TESTING,
                difficulty: "Intermediate",
                steps: [
                    "Scan for available wireless networks using 'wifi scan'",
                    "Capture network packets using 'wifi capture CORP_SECURE'",
                    "Analyze the captured packets with 'wifi analyze'",
                    "Create a wordlist file at '/home/user/wifi/wordlist.txt'",
                    "Crack the WiFi password using 'wifi crack CORP_SECURE /home/user/wifi/wordlist.txt'",
                    "Connect to the WiFi network with 'wifi connect CORP_SECURE corporate2023'",
                    "Scan for hosts on the network with 'nmap scan'",
                    "Create a penetration test report"
                ],
                completed: false,
                learningObjectives: [
                    "Learn WiFi reconnaissance techniques",
                    "Understand WPA2 authentication and vulnerabilities",
                    "Practice wireless packet capture and analysis",
                    "Learn dictionary-based password cracking"
                ]
            },
            {
                id: "privilege-escalation",
                title: "Privilege Escalation",
                description: "Exploit system vulnerabilities to gain higher access privileges.",
                category: MissionCategory.PEN_TESTING,
                difficulty: "Advanced",
                steps: [
                    "Identify system vulnerabilities",
                    "Exploit misconfigured permissions",
                    "Elevate your access to root/admin"
                ],
                completed: false,
                learningObjectives: [
                    "Learn Linux/Unix permission models",
                    "Understand common escalation vectors",
                    "Practice post-exploitation techniques"
                ]
            },
            
            // Social Engineering Missions
            {
                id: "phishing-campaign",
                title: "Phishing Campaign",
                description: "Create and analyze phishing attempts to understand social manipulation.",
                category: MissionCategory.SOCIAL_ENGINEERING,
                difficulty: "Intermediate",
                steps: [
                    "Craft convincing phishing emails",
                    "Set up credential harvesting",
                    "Analyze victim behavior patterns"
                ],
                completed: false,
                learningObjectives: [
                    "Understand psychological manipulation techniques",
                    "Learn to identify phishing indicators",
                    "Practice ethical social engineering"
                ]
            },
            {
                id: "pretexting",
                title: "Pretexting Operation",
                description: "Develop fictional scenarios to extract information from targets.",
                category: MissionCategory.SOCIAL_ENGINEERING,
                difficulty: "Advanced",
                steps: [
                    "Create a believable pretext/cover story",
                    "Extract information through conversation",
                    "Document and analyze obtained information"
                ],
                completed: false,
                learningObjectives: [
                    "Develop effective communication strategies",
                    "Learn to build rapport and trust",
                    "Practice information gathering techniques"
                ]
            },
            
            // Cryptography Missions
            {
                id: "cipher-break",
                title: "Classical Cipher Breaking",
                description: "Learn to break classical encryption methods through analysis.",
                category: MissionCategory.CRYPTOGRAPHY,
                difficulty: "Beginner",
                steps: [
                    "Identify encryption methods (Caesar, Vigenère, etc.)",
                    "Apply frequency analysis",
                    "Decrypt encoded messages"
                ],
                completed: false,
                learningObjectives: [
                    "Understand classical cryptography principles",
                    "Learn basic cryptanalysis techniques",
                    "Practice pattern recognition in encrypted text"
                ]
            },
            {
                id: "asymmetric-crypto",
                title: "Asymmetric Cryptography",
                description: "Explore public key infrastructure and its applications in security.",
                category: MissionCategory.CRYPTOGRAPHY,
                difficulty: "Advanced",
                steps: [
                    "Generate key pairs",
                    "Encrypt and decrypt messages",
                    "Establish secure communication channels"
                ],
                completed: false,
                learningObjectives: [
                    "Understand public/private key concepts",
                    "Learn practical applications of PKI",
                    "Practice implementing secure communication"
                ]
            }
        ];

        this.drawCategoryList();
    }

    private drawBackground() {
        this.background.clear();
        this.background.beginFill(0x1a1a1a);
        this.background.drawRoundedRect(0, 0, this.PANEL_WIDTH, window.innerHeight, 12);
        this.background.endFill();

        // Add gradient overlay
        const gradient = new Graphics();
        gradient.beginFill(0x000000, 0.6);
        gradient.drawRoundedRect(2, 2, this.PANEL_WIDTH - 4, window.innerHeight - 4, 10);
        gradient.endFill();
        this.background.addChild(gradient);
    }

    private drawCategoryList(): void {
        // Clear previous content
        this.contentContainer.removeChildren();
        this.showingCategoryList = true;

        this.drawBackground();

        // Draw header - Add top padding to account for PlayerStatusBar
        const header = new Text("MISSIONS", this.titleStyle);
        header.x = 20;
        header.y = 130; // Increased from 20 to give space for PlayerStatusBar
        this.contentContainer.addChild(header);

        // Get unique categories
        const categories = Object.values(MissionCategory);
        
        // Draw categories - Start lower to account for PlayerStatusBar
        let categoryY = 170; // Increased from 70
        categories.forEach(category => {
            const categoryText = new Text(category, this.categoryStyle);
            categoryText.x = 20;
            categoryText.y = categoryY;
            categoryText.eventMode = 'static';
            categoryText.cursor = 'pointer';
            categoryText.on('pointerdown', () => this.selectCategory(category as MissionCategory));
            
            // Count missions in this category
            const count = this.missions.filter(m => m.category === category).length;
            const countText = new Text(`(${count})`, this.textStyle);
            countText.x = this.PANEL_WIDTH - countText.width - 20;
            countText.y = categoryY;
            
            this.contentContainer.addChild(categoryText);
            this.contentContainer.addChild(countText);
            
            categoryY += 40;
        });
    }

    private selectCategory(category: MissionCategory): void {
        this.currentCategory = category;
        this.showingCategoryList = false;
        this.drawMissionList();
    }

    private drawMissionList(): void {
        // Clear previous content
        this.contentContainer.removeChildren();

        this.drawBackground();

        // Draw header and back button - Add top padding to account for PlayerStatusBar
        const backButton = new Text("<< Back", this.buttonStyle);
        backButton.x = 20;
        backButton.y = 120; // Increased from 20
        backButton.eventMode = 'static';
        backButton.cursor = 'pointer';
        backButton.on('pointerdown', () => this.drawCategoryList());
        this.contentContainer.addChild(backButton);

        const header = new Text(this.currentCategory || "", this.titleStyle);
        header.x = 20;
        header.y = 150; // Increased from 50
        this.contentContainer.addChild(header);

        // Filter missions by selected category
        const categoryMissions = this.missions.filter(m => m.category === this.currentCategory);
        
        // Draw mission list - Start lower to account for PlayerStatusBar
        let missionY = 190; // Increased from 90
        categoryMissions.forEach((mission) => {
            const container = this.createMissionCard(mission);
            container.y = missionY;
            this.contentContainer.addChild(container);

            missionY += 140;
        });
    }

    private createMissionCard(mission: Mission): Container {
        const card = new Container();
        const cardBackground = new Graphics();
        cardBackground.beginFill(0x2a2a2a);
        cardBackground.drawRoundedRect(0, 0, this.PANEL_WIDTH - 20, 120, 8);
        cardBackground.endFill();
        card.addChild(cardBackground);

        // Add hover effect
        card.eventMode = 'static';
        card.on('pointerover', () => {
            cardBackground.tint = 0x444444;
        });
        card.on('pointerout', () => {
            cardBackground.tint = 0xffffff;
        });

        const missionTitle = new Text(mission.title, this.categoryStyle);
        missionTitle.x = 20;
        missionTitle.y = 20;
        card.addChild(missionTitle);

        const difficulty = new Text(mission.difficulty, this.getDifficultyStyle(mission.difficulty));
        difficulty.x = 20;
        difficulty.y = 50;
        card.addChild(difficulty);

        const completionStatus = new Text(mission.completed ? "COMPLETED" : "INCOMPLETE", 
            mission.completed ? new TextStyle({...this.textStyle, fill: 0x00ff00}) : new TextStyle({...this.textStyle, fill: 0xaaaaaa}));
        completionStatus.x = this.PANEL_WIDTH - completionStatus.width - 20;
        completionStatus.y = 20;
        card.addChild(completionStatus);

        const startButton = new Graphics();
        startButton.beginFill(0x008800);
        startButton.drawRoundedRect(0, 90, this.PANEL_WIDTH - 40, 30, 5);
        startButton.endFill();
        startButton.x = 20;
        startButton.y = 90;
        startButton.eventMode = 'static';
        startButton.cursor = 'pointer';
        startButton.on('pointerdown', () => this.showMissionDetails(mission));
        
        const buttonText = new Text(mission.completed ? "REPLAY MISSION" : "START MISSION", new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: 0xffffff,
            fontWeight: "700",
            align: "center"
        }));
        buttonText.x = startButton.width / 2 - buttonText.width / 2;
        buttonText.y = startButton.height / 2 - buttonText.height / 2;
        startButton.addChild(buttonText);
        
        card.addChild(startButton);

        return card;
    }

    private showMissionDetails(mission: Mission): void {
        // Clear previous content
        this.contentContainer.removeChildren();

        this.drawBackground();

        // Create a content container that can be scrolled
        const scrollContent = new Container();
        this.contentContainer.addChild(scrollContent);

        // Draw header and back button - Add top padding to account for PlayerStatusBar
        const backButton = new Text("<< Back", this.buttonStyle);
        backButton.x = 20;
        backButton.y = 120; // Increased from 20
        backButton.eventMode = 'static';
        backButton.cursor = 'pointer';
        backButton.on('pointerdown', () => this.drawMissionList());
        scrollContent.addChild(backButton);

        // Draw mission details - Adjust all Y positions
        const title = new Text(mission.title, this.titleStyle);
        title.x = 20;
        title.y = 150; // Increased from 50
        scrollContent.addChild(title);

        const difficulty = new Text(mission.difficulty, this.getDifficultyStyle(mission.difficulty));
        difficulty.x = 20;
        difficulty.y = 180; // Increased from 80
        scrollContent.addChild(difficulty);

        // Ensure description text wraps properly
        const description = new Text(mission.description, this.textStyle);
        description.x = 20;
        description.y = 210; // Increased from 110
        description.style.wordWrap = true;
        description.style.wordWrapWidth = this.PANEL_WIDTH - 40; // Ensure proper wrapping
        scrollContent.addChild(description);

        // Calculate next vertical position based on description height
        let nextY = description.y + description.height + 20;

        // Draw learning objectives - Adjust Y position
        const objectivesTitle = new Text("Learning Objectives:", this.categoryStyle);
        objectivesTitle.x = 20;
        objectivesTitle.y = nextY;
        scrollContent.addChild(objectivesTitle);

        nextY += 30;
        let objectiveY = nextY;
        mission.learningObjectives.forEach((objective) => {
            const bullet = new Text(`• `, this.objectiveStyle);
            bullet.x = 20;
            bullet.y = objectiveY;
            scrollContent.addChild(bullet);

            const objectiveText = new Text(objective, this.objectiveStyle);
            objectiveText.x = 35;
            objectiveText.y = objectiveY;
            objectiveText.style.wordWrap = true;
            objectiveText.style.wordWrapWidth = this.PANEL_WIDTH - 55; // Tighter wrapping for indented text
            scrollContent.addChild(objectiveText);

            objectiveY += objectiveText.height + 10;
        });

        nextY = objectiveY + 10;

        // Draw steps with completion status
        const stepsTitle = new Text("Mission Steps:", this.categoryStyle);
        stepsTitle.x = 20;
        stepsTitle.y = nextY;
        scrollContent.addChild(stepsTitle);

        nextY += 30;
        let stepY = nextY;
        mission.steps.forEach((step, index) => {
            // Create step container
            const stepContainer = new Container();
            stepContainer.x = 20;
            stepContainer.y = stepY;
            
            // Add step checkbox/indicator
            const checkbox = new Graphics();
            const isCompleted = mission.completedSteps?.includes(index);
            checkbox.beginFill(isCompleted ? 0x00ff00 : 0x444444);
            checkbox.drawCircle(0, 0, 6);
            checkbox.endFill();
            checkbox.x = 0;
            checkbox.y = 8;
            stepContainer.addChild(checkbox);
            
            // Add step number and text
            const stepText = new Text(`${index + 1}. ${step}`, 
                isCompleted ? 
                new TextStyle({...this.stepStyle, fill: 0x00ff00}) : 
                this.stepStyle
            );
            stepText.x = 15;
            stepText.y = 0;
            stepText.style.wordWrap = true;
            stepText.style.wordWrapWidth = this.PANEL_WIDTH - 65;
            stepContainer.addChild(stepText);
            
            // Display command hint if this is active mission 
            if (this.activeMission === mission && mission.stepCommands?.[index]) {
                const commandHint = new Text(`Try: ${mission.stepCommands[index]}`, 
                    new TextStyle({
                        fontFamily: "Fira Code",
                        fontSize: 12,
                        fill: 0xffff00,
                        fontWeight: "400",
                        fontStyle: "italic"
                    })
                );
                commandHint.x = 15;
                commandHint.y = stepText.height + 5;
                stepContainer.addChild(commandHint);
            }
            
            scrollContent.addChild(stepContainer);
            stepY += stepText.height + (this.activeMission === mission && mission.stepCommands?.[index] ? 30 : 15);
        });

        // Start/continue mission button
        const startButton = new Graphics();
        startButton.beginFill(0x008800);
        startButton.drawRoundedRect(0, 0, this.PANEL_WIDTH - 40, 40, 5);
        startButton.endFill();
        startButton.x = 20;
        startButton.y = stepY + 20;
        startButton.eventMode = 'static';
        startButton.cursor = 'pointer';
        startButton.on('pointerdown', () => this.startMission(mission));
        
        let buttonLabel: string;
        if (mission.completed) {
            buttonLabel = "REPLAY MISSION";
        } else if (this.activeMission === mission) {
            buttonLabel = "CONTINUE MISSION";
        } else {
            buttonLabel = "START MISSION";
        }
        
        const buttonText = new Text(buttonLabel, new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 16,
            fill: 0xffffff,
            fontWeight: "700",
            align: "center"
        }));
        buttonText.x = startButton.width / 2 - buttonText.width / 2;
        buttonText.y = startButton.height / 2 - buttonText.height / 2;
        startButton.addChild(buttonText);
        
        scrollContent.addChild(startButton);
        
        // Add scroll functionality
        this.contentContainer.eventMode = 'static';
        let isDragging = false;
        let startY = 0;
        let startScrollY = 0;
        
        // Enable scrolling by adding mouse/touch events
        this.contentContainer.on('pointerdown', (e: FederatedPointerEvent) => {
            isDragging = true;
            startY = e.global.y;
            startScrollY = scrollContent.y;
            this.contentContainer.cursor = 'grabbing';
        });
        
        this.contentContainer.on('pointermove', (e: FederatedPointerEvent) => {
            if (isDragging) {
                const dy = e.global.y - startY;
                let newY = startScrollY + dy;
                
                // Calculate content height
                const contentHeight = stepY + startButton.height + 60; // Total content height + padding
                
                // Limit scrolling
                const minY = Math.min(0, window.innerHeight - contentHeight);
                newY = Math.max(minY, Math.min(0, newY));
                
                scrollContent.y = newY;
            }
        });
        
        this.contentContainer.on('pointerup', () => {
            isDragging = false;
            this.contentContainer.cursor = 'auto';
        });
        
        this.contentContainer.on('pointerupoutside', () => {
            isDragging = false;
            this.contentContainer.cursor = 'auto';
        });
        
        // Enable mouse wheel scrolling
        this.contentContainer.on('wheel', (e: WheelEvent) => {
            const contentHeight = stepY + startButton.height + 60;
            const minY = Math.min(0, window.innerHeight - contentHeight);
            
            let newY = scrollContent.y - e.deltaY;
            newY = Math.max(minY, Math.min(0, newY));
            scrollContent.y = newY;
        });
    }

    private getDifficultyStyle(difficulty: string): TextStyle {
        let color = 0x00ff00; // Default green for Beginner
        
        switch(difficulty) {
            case "Beginner":
                color = 0x00ff00; // Green
                break;
            case "Intermediate":
                color = 0xffff00; // Yellow
                break;
            case "Advanced":
                color = 0xff9900; // Orange
                break;
            case "Expert":
                color = 0xff0000; // Red
                break;
        }
        
        return new TextStyle({
            fontFamily: "Fira Code",
            fontSize: 14,
            fill: color,
            fontWeight: "500",
            letterSpacing: 0,
            padding: 4
        });
    }

    private startMission(mission: Mission): void {
        this.activeMission = mission;
        if (!mission.completedSteps) {
            mission.completedSteps = [];
        }
        
        // Extract commands from step descriptions
        this.extractCommandsFromSteps(mission);
        
        // Redraw the mission details with active state
        this.showMissionDetails(mission);
        
        // Notify game that this mission is now active
        this.emit('missionStarted', mission);
    }
    
    // Called from terminal service when a command is executed
    public processTerminalCommand(command: string): void {
        if (!this.activeMission) return;
        
        // Check if command matches any step command
        this.activeMission.stepCommands?.forEach((stepCommand, stepIndex) => {
            if (stepCommand && command.trim().toLowerCase().includes(stepCommand.toLowerCase())) {
                if (this.activeMission) {
                    this.completeStep(this.activeMission.id, stepIndex);
                }
            }
        });
    }
    
    private completeStep(missionId: string, stepIndex: number): void {
        const mission = this.missions.find(m => m.id === missionId);
        if (mission) {
            if (!mission.completedSteps) {
                mission.completedSteps = [];
            }
            
            if (!mission.completedSteps.includes(stepIndex)) {
                mission.completedSteps.push(stepIndex);
                
                // Check if all steps are completed
                if (mission.completedSteps.length === mission.steps.length) {
                    mission.completed = true;
                    this.emit('missionCompleted', mission);
                } else {
                    this.emit('stepCompleted', { mission, stepIndex });
                }
                
                // Redraw mission details to show updated progress
                this.showMissionDetails(mission);
            }
        }
    }

    public nextMission(): void {
        if (this.currentMissionIndex < this.missions.length - 1) {
            this.currentMissionIndex++;
            this.showMissionDetails(this.missions[this.currentMissionIndex]);
        }
    }

    public previousMission(): void {
        if (this.currentMissionIndex > 0) {
            this.currentMissionIndex--;
            this.showMissionDetails(this.missions[this.currentMissionIndex]);
        }
    }

    public completeMission(id: string): void {
        const mission = this.missions.find(m => m.id === id);
        if (mission) {
            mission.completed = true;
            if (!this.showingCategoryList && this.currentCategory) {
                this.drawMissionList();
            }
        }
    }

    public resize(width: number, height: number): void {
        this.background.clear();
        this.background.beginFill(0x1a1a1a);
        this.background.drawRoundedRect(0, 0, this.PANEL_WIDTH, height, 12);
        this.background.endFill();

        // Add gradient overlay
        const gradient = new Graphics();
        gradient.beginFill(0x000000, 0.6);
        gradient.drawRoundedRect(2, 2, this.PANEL_WIDTH - 4, height - 4, 10);
        gradient.endFill();
        this.background.addChild(gradient);
    }

    private extractCommandsFromSteps(mission: Mission): void {
        if (!mission.stepCommands) {
            mission.stepCommands = mission.steps.map((step) => {
                // Extract command names from step descriptions if they're enclosed in quotes
                const commandMatch = step.match(/'([^']+)'|"([^"]+)"/);
                return commandMatch ? (commandMatch[1] || commandMatch[2]) : "";
            });
        }
    }
}