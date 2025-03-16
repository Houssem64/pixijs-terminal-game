import { Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { FileSystem } from "../../utils/FileSystem";
import { MissionManager, MissionData } from "../utils/MissionManager";
import { MissionPanel } from "../components/MissionPanel";
import { PlayerStatusBar } from "../components/PlayerStatusBar";
import { WiFiPenTestMission } from "../missions/WiFiPenTest";

// Import our new modular components
import { TerminalThemeManager } from "../terminal/TerminalThemeManager";
import { TerminalScrollManager } from "../terminal/TerminalScrollManager";
import { TerminalOutput } from "../terminal/TerminalOutput";
import { TerminalInput } from "../terminal/TerminalInput";
import { TerminalCommandProcessor, TerminalState } from "../terminal/TerminalCommandProcessor";

// Define interface for errors from file system
interface FileSystemError {
    message: string;
}

export class TerminalScreen extends Container {
    public static assetBundles: string[] = [];

    // Terminal components
    private background: Graphics = new Graphics();
    private innerBackground: Graphics = new Graphics();
    private themeManager: TerminalThemeManager;
    private scrollManager: TerminalScrollManager;
    private outputManager: TerminalOutput;
    private inputManager: TerminalInput;
    private commandProcessor: TerminalCommandProcessor;
    
    // External components
    private fileSystem: FileSystem;
    private missionManager: MissionManager;
    private missionPanel: MissionPanel;
    private playerStatusBar: PlayerStatusBar;
    
    // Terminal dimensions
    private terminalWidth = 0;
    private terminalHeight = 0;
    private MISSION_PANEL_WIDTH = 350;
    
    constructor() {
        super();
        
        // Initialize file system and mission manager
        this.fileSystem = FileSystem.getInstance();
        this.missionManager = MissionManager.getInstance();
        
        // Register missions
        this.registerMissions();
        
        // Initialize theme manager
        this.themeManager = new TerminalThemeManager('dracula');
        
        // Draw terminal background
        this.drawBackground();
        
        // Initialize scroll manager
        this.scrollManager = new TerminalScrollManager(this, this.themeManager.getTheme());
        
        // Initialize output manager
        this.outputManager = new TerminalOutput(this, this.scrollManager, this.themeManager);
        
        // Initialize command processor
        this.commandProcessor = new TerminalCommandProcessor(
            this.outputManager,
            this.fileSystem,
            this.missionManager
        );
        
        // Initialize input manager with command callback
        this.inputManager = new TerminalInput(
            this,
            this.themeManager,
            this.scrollManager,
            this.handleCommand.bind(this)
        );
        
        // Add mission panel
        this.missionPanel = new MissionPanel();
        this.addChild(this.missionPanel);
        
        // Add player status bar
        this.playerStatusBar = new PlayerStatusBar();
        this.addChild(this.playerStatusBar);
        this.positionPlayerStatusBar();
        
        // Show welcome message
        this.showWelcomeMessage();
        
        // Add resize handler
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    private registerMissions(): void {
        // Register example mission
        this.missionManager.registerMission(WiFiPenTestMission);
    }
    
    private handleCommand(command: string): void {
        // Get current input position
        const inputY = this.inputManager.getCurrentY();
        
        // Set the output position to start at the input's position
        this.outputManager.setNextOutputPosition(inputY);
        
        // Add command to output
        this.outputManager.addOutput(`$ ${command}`);
        
        // Process the command
        this.commandProcessor.processCommand(command);
    }
    
    private showWelcomeMessage(): void {
        // Set initial output position with offset
        this.outputManager.setNextOutputPosition(100);
        
        this.outputManager.addOutput("Welcome to Terminal OS", false);
        this.outputManager.addOutput("Type 'help' to see available commands", false);
        this.outputManager.addOutput("", false);
    }
    
    private drawBackground(): void {
        // Draw outer background
        this.background.clear();
        this.background.beginFill(this.themeManager.getTheme().background);
        this.background.drawRect(0, 0, window.innerWidth, window.innerHeight);
        this.background.endFill();
        if (this.children.indexOf(this.background) === -1) {
            this.addChildAt(this.background, 0);
        } else {
            this.setChildIndex(this.background, 0);
        }
        
        // Draw inner background
        this.innerBackground.clear();
        this.innerBackground.beginFill(this.themeManager.getDarkerColor(this.themeManager.getTheme().background, 0.8));
        this.innerBackground.drawRect(0, 0, window.innerWidth - this.MISSION_PANEL_WIDTH, window.innerHeight);
        this.innerBackground.endFill();
        if (this.children.indexOf(this.innerBackground) === -1) {
            this.addChildAt(this.innerBackground, 1);
        } else {
            this.setChildIndex(this.innerBackground, 1);
        }
    }
    
    private handleResize(): void {
        // Resize the terminal when window size changes
        this.resize(window.innerWidth, window.innerHeight);
    }
    
    public resize(width: number, height: number): void {
        this.terminalWidth = width;
        this.terminalHeight = height;
        
        // Redraw background
        this.drawBackground();
        
        // Resize mission panel
        this.missionPanel.x = width - this.MISSION_PANEL_WIDTH;
        this.missionPanel.resize(this.MISSION_PANEL_WIDTH, height);
        
        // Position player status bar
        this.positionPlayerStatusBar();
        this.playerStatusBar.resize();
        
        // Update scroll manager
        this.scrollManager.resize(width - this.MISSION_PANEL_WIDTH, height);
        
        // Ensure output manager maintains proper padding
        this.outputManager.resize(width - this.MISSION_PANEL_WIDTH, height);
        
        // Update input position
        this.inputManager.updateInputPosition();
    }
    
    private positionPlayerStatusBar(): void {
        this.playerStatusBar.x = this.terminalWidth - this.MISSION_PANEL_WIDTH;
        this.playerStatusBar.y = 0;
    }
    
    public destroy(): void {
        super.destroy();
        
        // Clean up event listeners
        window.removeEventListener('resize', this.handleResize.bind(this));
        
        // Destroy input manager to clean up keyboard listeners
        this.inputManager.destroy();
    }
} 