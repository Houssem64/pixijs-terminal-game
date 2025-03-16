import { FileSystem } from "../../utils/FileSystem";
import { MissionManager, MissionData } from "../utils/MissionManager";
import { TerminalOutput } from "./TerminalOutput";

export enum TerminalState {
    NORMAL = "normal",
    PASSWORD = "password",
    FTP = "ftp",
    FTP_PASSWORD = "ftp_password",
    NANO = "nano"
}

export interface EnvironmentVariables {
    [key: string]: string;
}

export interface CommandAliases {
    [key: string]: string;
}

export class TerminalCommandProcessor {
    private state: TerminalState = TerminalState.NORMAL;
    private environmentVariables: EnvironmentVariables = {};
    private aliases: CommandAliases = {};
    private missionManager: MissionManager;
    private fileSystem: FileSystem;
    private output: TerminalOutput;
    
    constructor(
        output: TerminalOutput,
        fileSystem: FileSystem,
        missionManager: MissionManager
    ) {
        this.output = output;
        this.fileSystem = fileSystem;
        this.missionManager = missionManager;
        
        // Initialize environment variables and aliases
        this.initEnvironmentVariables();
        this.initAliases();
    }
    
    private initEnvironmentVariables(): void {
        this.environmentVariables = {
            "PATH": "/bin:/usr/bin:/usr/local/bin",
            "HOME": "/home/user",
            "USER": "user",
            "PWD": this.fileSystem.getCurrentPath(),
            "TERM": "xterm-256color",
            "SHELL": "/bin/bash",
            "EDITOR": "nano"
        };
    }
    
    private initAliases(): void {
        this.aliases = {
            "ll": "ls -l",
            "la": "ls -a",
            "l": "ls",
            "..": "cd ..",
            "c": "clear"
        };
    }
    
    public getState(): TerminalState {
        return this.state;
    }
    
    public setState(state: TerminalState): void {
        this.state = state;
    }
    
    public processCommand(command: string): void {
        // Handle different terminal states
        switch (this.state) {
            case TerminalState.NORMAL:
                this.handleNormalCommand(command);
                break;
                
            case TerminalState.PASSWORD:
                this.handlePasswordCommand(command);
                break;
                
            case TerminalState.FTP:
                this.handleFTPCommand(command);
                break;
                
            case TerminalState.FTP_PASSWORD:
                this.handleFTPPasswordCommand(command);
                break;
                
            case TerminalState.NANO:
                this.handleNanoCommand(command);
                break;
        }
    }
    
    private handleNormalCommand(command: string): void {
        // Process command for pipes and redirections
        const pipeCommands = this.processPipesAndRedirections(command);
        if (pipeCommands.length > 1) {
            // Handle piped commands (future implementation)
            this.output.addOutput("Pipe functionality not fully implemented yet.", true);
            return;
        }

        // Process environment variables in the command
        command = this.processEnvironmentVariables(command);

        // Check for aliases
        command = this.processAliases(command);
        
        const args = command.trim().split(' ');
        const cmd = args[0].toLowerCase();

        try {
            switch (cmd) {
                case '':
                    // Empty command, just show a new prompt
                    break;
                    
                case 'help':
                    this.showHelp();
                    break;
                    
                case 'clear':
                case 'cls':
                    this.output.clear();
                    break;
                    
                case 'ls':
                    this.handleLsCommand(args);
                    break;
                    
                case 'cd': {
                    const path = args[1] || '';
                    try {
                        this.fileSystem.changePath(path);
                        // Update PWD environment variable
                        this.environmentVariables["PWD"] = this.fileSystem.getCurrentPath();
                        // Don't output anything on successful cd, like real terminals
                    } catch (err: unknown) {
                        const error = err as Error;
                        this.output.addOutput(`cd: ${error?.message || 'Unknown error'}`, true);
                    }
                    break;
                }
                
                case 'pwd':
                    this.output.addOutput(this.fileSystem.getCurrentPath());
                    break;
                    
                case 'echo':
                    this.handleEchoCommand(args);
                    break;
                    
                case 'cat':
                    this.handleCatCommand(args);
                    break;
                    
                case 'mkdir':
                    if (args.length < 2) {
                        this.output.addOutput('mkdir: missing operand', true);
                        return;
                    }
                    try {
                        const recursive = args.includes('-p') || args.includes('--parents');
                        this.fileSystem.createDirectory(args[args.indexOf('-p') !== -1 ? args.indexOf('-p') + 1 : 1], recursive);
                    } catch (err: unknown) {
                        const error = err as Error;
                        this.output.addOutput(`mkdir: ${error?.message || 'Unknown error'}`, true);
                    }
                    break;
                    
                case 'touch':
                    if (args.length < 2) {
                        this.output.addOutput('touch: missing file operand', true);
                        return;
                    }
                    try {
                        this.fileSystem.createFile(args[1], '');
                    } catch (err: unknown) {
                        const error = err as Error;
                        this.output.addOutput(`touch: ${error?.message || 'Unknown error'}`, true);
                    }
                    break;
                    
                case 'rm':
                    if (args.length < 2) {
                        this.output.addOutput('rm: missing operand', true);
                        return;
                    }
                    try {
                        const recursive = args.includes('-r') || args.includes('--recursive');
                        const force = args.includes('-f') || args.includes('--force');
                        
                        const path = args[args.length - 1];
                        const result = this.fileSystem.removeFile(path, { recursive, force });
                        
                        if (!result && !force) {
                            this.output.addOutput(`rm: cannot remove '${path}': No such file or directory`, true);
                        }
                    } catch (err: unknown) {
                        const error = err as Error;
                        this.output.addOutput(`rm: ${error?.message || 'Unknown error'}`, true);
                    }
                    break;
                    
                case 'mission':
                    this.handleMissionCommand(args);
                    break;
                    
                default:
                    this.output.addOutput(`Command not found: ${cmd}`, true);
                    break;
            }
        } catch (error: unknown) {
            const err = error as Error;
            this.output.addOutput(`Error executing command: ${err?.message || 'Unknown error'}`, true);
            console.error("Command error:", error);
        }
    }
    
    private handlePasswordCommand(command: string): void {
        // Handle password prompt input (for sudo, etc.)
        this.output.addOutput("Password handling not implemented yet.");
        this.state = TerminalState.NORMAL;
    }
    
    private handleFTPCommand(command: string): void {
        // Handle FTP commands
        this.output.addOutput("FTP functionality not implemented yet.");
        this.state = TerminalState.NORMAL;
    }
    
    private handleFTPPasswordCommand(command: string): void {
        // Handle FTP password prompt
        this.output.addOutput("FTP password handling not implemented yet.");
        this.state = TerminalState.NORMAL;
    }
    
    private handleNanoCommand(command: string): void {
        // Handle nano editor commands
        this.output.addOutput("Nano editor not implemented yet.");
        this.state = TerminalState.NORMAL;
    }
    
    private processPipesAndRedirections(command: string): string[] {
        // Simple split by pipe, more complex parsing can be added later
        return command.split('|').map(cmd => cmd.trim());
    }
    
    private processEnvironmentVariables(command: string): string {
        // Replace $VAR or ${VAR} with environment variable values
        const regex = /\$(\w+)|\${(\w+)}/g;
        return command.replace(regex, (match, varName1, varName2) => {
            const varName = varName1 || varName2;
            return this.environmentVariables[varName] || match;
        });
    }
    
    private processAliases(command: string): string {
        // Check if the command is an alias and replace it
        const parts = command.trim().split(' ');
        const cmd = parts[0];
        
        if (this.aliases[cmd]) {
            return this.aliases[cmd] + ' ' + parts.slice(1).join(' ');
        }
        
        return command;
    }
    
    private handleLsCommand(args: string[]): void {
        const showHidden = args.includes('-a') || args.includes('--all');
        const longFormat = args.includes('-l') || args.includes('--long');
        
        // Find the target path (last non-option argument, or current directory)
        let targetPath = '.';
        for (let i = args.length - 1; i >= 1; i--) {
            if (!args[i].startsWith('-')) {
                targetPath = args[i];
                break;
            }
        }
        
        try {
            const files = this.fileSystem.listFiles(targetPath, { showHidden, longFormat });
            
            if (files.length > 0) {
                this.output.addOutput(files.join('\n'));
            }
        } catch (error: unknown) {
            const err = error as Error;
            this.output.addOutput(`ls: ${err?.message || 'Unknown error'}`, true);
        }
    }
    
    private handleEchoCommand(args: string[]): void {
        // Join all arguments after "echo"
        const text = args.slice(1).join(' ')
            // Handle quotes
            .replace(/(^"|"$|^'|'$)/g, '');
            
        this.output.addOutput(text);
    }
    
    private handleCatCommand(args: string[]): void {
        if (args.length < 2) {
            this.output.addOutput('cat: missing file operand', true);
            return;
        }
        
        try {
            const filePath = args[1];
            const content = this.fileSystem.readFile(filePath);
            
            if (content === null) {
                this.output.addOutput(`cat: ${filePath}: No such file or directory`, true);
            } else {
                this.output.addOutput(content);
            }
        } catch (error: unknown) {
            const err = error as Error;
            this.output.addOutput(`cat: ${err?.message || 'Unknown error'}`, true);
        }
    }
    
    private handleMissionCommand(args: string[]): void {
        if (args.length < 2) {
            this.output.addOutput('Usage: mission list | mission start <id> | mission info <id>', true);
            return;
        }
        
        const subcommand = args[1].toLowerCase();
        
        switch (subcommand) {
            case 'list':
                this.listMissions();
                break;
                
            case 'start':
                if (args.length < 3) {
                    this.output.addOutput('Usage: mission start <id>', true);
                    return;
                }
                this.startMission(args[2]);
                break;
                
            case 'info':
                if (args.length < 3) {
                    this.output.addOutput('Usage: mission info <id>', true);
                    return;
                }
                this.showMissionInfo(args[2]);
                break;
                
            default:
                this.output.addOutput(`Unknown mission subcommand: ${subcommand}`, true);
                this.output.addOutput('Available subcommands: list, start, info', false);
        }
    }
    
    private listMissions(): void {
        const missions = this.missionManager.getAllMissions();
        
        if (missions.length === 0) {
            this.output.addOutput('No missions available.', false);
            return;
        }
        
        this.output.addOutput('Available Missions:', false);
        
        // Group missions by category
        const categorizedMissions: { [category: string]: MissionData[] } = {};
        
        missions.forEach(mission => {
            if (!categorizedMissions[mission.category]) {
                categorizedMissions[mission.category] = [];
            }
            categorizedMissions[mission.category].push(mission);
        });
        
        // Display missions by category
        Object.entries(categorizedMissions).forEach(([category, missions]) => {
            this.output.addOutput(`\n${category}:`, false);
            
            missions.forEach(mission => {
                const status = mission.state === 'completed' ? '[✓]' :
                             mission.state === 'in_progress' ? '[…]' :
                             mission.state === 'available' ? '[!]' : '[x]';
                             
                this.output.addOutput(`  ${status} ${mission.id} - ${mission.title} (${mission.difficulty})`, false);
            });
        });
    }
    
    private startMission(missionId: string): void {
        const result = this.missionManager.startMission(missionId);
        
        if (result) {
            const mission = this.missionManager.getMission(missionId);
            if (mission) {
                this.output.addOutput(`Starting mission: ${mission.title}`, false);
                this.output.addOutput(`Difficulty: ${mission.difficulty}`, false);
                this.output.addOutput('\nObjectives:', false);
                
                mission.objectives.forEach((obj, index) => {
                    this.output.addOutput(`  ${index + 1}. ${obj.description}`, false);
                });
                
                this.output.addOutput('\nMission environment prepared. Good luck!', false);
            }
        } else {
            this.output.addOutput(`Failed to start mission: ${missionId}. It may be locked or already completed.`, true);
        }
    }
    
    private showMissionInfo(missionId: string): void {
        const mission = this.missionManager.getMission(missionId);
        
        if (!mission) {
            this.output.addOutput(`Mission not found: ${missionId}`, true);
            return;
        }
        
        this.output.addOutput(`Mission: ${mission.title}`, false);
        this.output.addOutput(`ID: ${mission.id}`, false);
        this.output.addOutput(`Category: ${mission.category}`, false);
        this.output.addOutput(`Difficulty: ${mission.difficulty}`, false);
        this.output.addOutput(`Status: ${mission.state}`, false);
        this.output.addOutput('\nDescription:', false);
        this.output.addOutput(`  ${mission.description}`, false);
        
        this.output.addOutput('\nObjectives:', false);
        mission.objectives.forEach((obj, index) => {
            const status = obj.completed ? '[✓]' : '[ ]';
            this.output.addOutput(`  ${status} ${index + 1}. ${obj.description}`, false);
        });
        
        this.output.addOutput('\nRewards:', false);
        this.output.addOutput(`  XP: ${mission.reward.xp}`, false);
        
        if (mission.reward.skillPoints) {
            this.output.addOutput('  Skill Points:', false);
            Object.entries(mission.reward.skillPoints).forEach(([skill, points]) => {
                this.output.addOutput(`    ${skill}: +${points}`, false);
            });
        }
        
        if (mission.reward.items && mission.reward.items.length > 0) {
            this.output.addOutput('  Items:', false);
            mission.reward.items.forEach(item => {
                this.output.addOutput(`    - ${item}`, false);
            });
        }
    }
    
    private showHelp(): void {
        this.output.addOutput("Terminal Help:", false);
        this.output.addOutput("-------------", false);
        this.output.addOutput("Basic Commands:", false);
        this.output.addOutput("  help     - Show this help message", false);
        this.output.addOutput("  clear    - Clear the terminal", false);
        this.output.addOutput("  ls       - List files in current directory", false);
        this.output.addOutput("  cd       - Change directory", false);
        this.output.addOutput("  pwd      - Print current directory", false);
        this.output.addOutput("  mkdir    - Create a directory", false);
        this.output.addOutput("  touch    - Create an empty file", false);
        this.output.addOutput("  cat      - Display file contents", false);
        this.output.addOutput("  rm       - Remove files or directories", false);
        this.output.addOutput("  echo     - Display text", false);
        this.output.addOutput("\nMission Commands:", false);
        this.output.addOutput("  mission list        - List available missions", false);
        this.output.addOutput("  mission start <id>  - Start a mission", false);
        this.output.addOutput("  mission info <id>   - Show mission details", false);
    }
} 