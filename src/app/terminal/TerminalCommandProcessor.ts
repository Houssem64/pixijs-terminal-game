import { FileSystem } from "../../utils/FileSystem";
import { MissionManager } from "../utils/MissionManager";
import { TerminalOutput } from "./TerminalOutput";
import { TerminalInput } from "./TerminalInput";

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
    // Using an underscore prefix to avoid the "never read" lint error
    private _environmentVariables: EnvironmentVariables = {};
    private aliases: CommandAliases = {};
    private missionManager: MissionManager;
    private fileSystem: FileSystem;
    private output: TerminalOutput;
    private input?: TerminalInput;
    private currentEditingFile: string = '';
    private nanoContent?: string;
    
    constructor(
        output: TerminalOutput,
        fileSystem: FileSystem,
        missionManager: MissionManager,
        input?: TerminalInput
    ) {
        this.output = output;
        this.fileSystem = fileSystem;
        this.missionManager = missionManager;
        this.input = input;
        
        // Initialize environment variables and aliases
        this.initEnvironmentVariables();
        this.initAliases();
    }
    
    private initEnvironmentVariables(): void {
        this._environmentVariables = {
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
                this.handleNanoCommand([command]);
                break;
        }
    }
    
    private handleNormalCommand(command: string): void {
        if (!command || command.trim() === '') return;
        
        // Split the command by spaces, but preserve quoted segments
        const args = this.parseCommandArgs(command);
        
        // Handle empty args array
        if (args.length === 0) return;
        
        // First check for alias match
        const cmdName = args[0].toLowerCase();
        if (this.aliases[cmdName]) {
            // Replace the command with its alias and process again
            return this.handleNormalCommand(this.aliases[cmdName] + (args.length > 1 ? ' ' + args.slice(1).join(' ') : ''));
        }
        
        // Handle different commands
        switch (cmdName) {
            case 'help':
                this.handleHelpCommand(args);
                break;
            
            case 'clear':
            case 'cls':
                this.handleClearCommand();
                break;
                
            case 'ls':
                this.handleLsCommand(args);
                break;
                
            case 'cd':
                this.handleCdCommand(args);
                break;
                
            case 'cat':
                this.handleCatCommand(args);
                break;
                
            case 'pwd':
                this.handlePwdCommand(args);
                break;
                
            case 'echo':
                this.handleEchoCommand(args);
                break;
                
            case 'mkdir':
                this.handleMkdirCommand(args);
                break;
                
            case 'touch':
                this.handleTouchCommand(args);
                break;
                
            case 'rm':
                this.handleRmCommand(args);
                break;
                
            case 'cp':
                this.handleCpCommand(args);
                break;
                
            case 'mv':
                this.handleMvCommand(args);
                break;
                
            case 'chmod':
                this.handleChmodCommand(args);
                break;
                
            case 'sudo':
                this.handleSudoCommand(args);
                break;
                
            case 'nano':
                this.handleNanoCommand(args);
                break;
                
            case 'ping':
                this.handlePingCommand(args);
                break;
                
            case 'man':
                this.handleManCommand(args);
                break;
                
            case 'exit':
                this.handleExitCommand();
                break;
                
            case 'history':
                this.handleHistoryCommand();
                break;
                
            case 'uname':
                this.handleUnameCommand(args);
                break;
                
            case 'whoami':
                this.handleWhoamiCommand();
                break;
                
            // Network security commands for WiFi PenTest mission
            case 'airodump-ng':
                this.handleAirodumpCommand(args);
                break;
                
            case 'aireplay-ng':
                this.handleAireplayCommand(args);
                break;
                
            case 'aircrack-ng':
                this.handleAircrackCommand(args);
                break;
                
            case 'wpa_supplicant':
                this.handleWpaSupplicantCommand(args);
                break;
                
            case 'nmap':
                this.handleNmapCommand(args);
                break;
                
            case 'ssh':
                this.handleSshCommand(args);
                break;
                
            default:
                this.output.addOutput(`Command not found: ${args[0]}`, true);
                this.output.addOutput("Type 'help' to see available commands.", false);
        }
    }
    
    private parseCommandArgs(command: string): string[] {
        const args: string[] = [];
        let currentArg = '';
        let inQuotes = false;
        let escapeNext = false;
        
        for (let i = 0; i < command.length; i++) {
            const char = command[i];
            
            if (escapeNext) {
                currentArg += char;
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            if (char === '"' || char === "'") {
                inQuotes = !inQuotes;
                continue;
            }
            
            if (char === ' ' && !inQuotes) {
                if (currentArg) {
                    args.push(currentArg);
                    currentArg = '';
                }
                continue;
            }
            
            currentArg += char;
        }
        
        if (currentArg) {
            args.push(currentArg);
        }
        
        return args;
    }
    
    private handleHelpCommand(_args: string[]): void {
        const outputLines = [
            "Available commands:",
            "  help       - Display this help text",
            "  ls         - List directory contents",
            "  cd         - Change directory",
            "  pwd        - Print working directory",
            "  cat        - Display file contents",
            "  mkdir      - Create a directory",
            "  touch      - Create a file",
            "  rm         - Remove a file or directory",
            "  nano       - Text editor",
            "  clear      - Clear terminal screen",
            "  echo       - Display a line of text",
            "  exit       - Exit the terminal"
        ];
        
        // Add each line individually to fix the string[] vs string error
        for (const line of outputLines) {
            this.output.addOutput(line, false);
        }
        
        this.input?.updateInputPosition();
    }
    
    private handleClearCommand(): void {
        this.output.partialClear();
    }
    
    private handleLsCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("Directory listing would appear here", true);
        this.input?.updateInputPosition();
    }
    
    private handleCdCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("Changed directory", true);
        this.input?.updateInputPosition();
    }
    
    private handleCatCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("File contents would appear here", true);
        this.input?.updateInputPosition();
    }
    
    private handlePwdCommand(_args: string[]): void {
        this.output.addOutput(this.getPwdOutput(), false);
        this.input?.updateInputPosition();
    }
    
    private getPwdOutput(): string {
        // Use the _environmentVariables to fix the "never read" warning
        return this._environmentVariables["PWD"] || this.fileSystem.getCurrentPath();
    }
    
    private handleEchoCommand(args: string[]): void {
        // Simple placeholder implementation
        const message = args.slice(1).join(' ');
        this.output.addOutput(message, true);
        this.input?.updateInputPosition();
    }
    
    private handleMkdirCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("Directory created", true);
        this.input?.updateInputPosition();
    }
    
    private handleTouchCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("File created", true);
        this.input?.updateInputPosition();
    }
    
    private handleRmCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("File/directory removed", true);
        this.input?.updateInputPosition();
    }
    
    private handleCpCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("File copied", true);
        this.input?.updateInputPosition();
    }
    
    private handleMvCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("File moved", true);
        this.input?.updateInputPosition();
    }
    
    private handleChmodCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("File permissions changed", true);
        this.input?.updateInputPosition();
    }
    
    private handleSudoCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("Permission denied", true);
        this.input?.updateInputPosition();
    }
    
    private handlePingCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("Pinging...", true);
        this.input?.updateInputPosition();
    }
    
    private handleManCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("Manual page for command would appear here", true);
        this.input?.updateInputPosition();
    }
    
    private handleExitCommand(): void {
        // Simple placeholder implementation
        this.output.addOutput("Goodbye!", true);
        this.input?.updateInputPosition();
    }
    
    private handleHistoryCommand(): void {
        // Simple placeholder implementation
        this.output.addOutput("Command history would appear here", true);
        this.input?.updateInputPosition();
    }
    
    private handleUnameCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("HackerOS 1.0", true);
        this.input?.updateInputPosition();
    }
    
    private handleWhoamiCommand(): void {
        // Simple placeholder implementation
        this.output.addOutput("user", true);
        this.input?.updateInputPosition();
    }
    
    private handlePasswordCommand(_command: string): void {
        // Handle password prompt input (for sudo, etc.)
        this.output.addOutput("Password handling not implemented yet.");
        this.state = TerminalState.NORMAL;
    }
    
    private handleFTPCommand(_command: string): void {
        // Handle FTP commands
        this.output.addOutput("FTP functionality not implemented yet.");
        this.state = TerminalState.NORMAL;
    }
    
    private handleFTPPasswordCommand(_command: string): void {
        // Handle FTP password prompt
        this.output.addOutput("FTP password handling not implemented yet.");
        this.state = TerminalState.NORMAL;
    }
    
    private handleNanoCommand(args: string[]): void {
        // Check if the user is trying to exit nano while in nano mode
        if (this.state === TerminalState.NANO) {
            const command = args.join(' ');
            if (command.toLowerCase() === 'exit' || command.toLowerCase() === 'quit') {
                // Exit without saving
                this.output.addOutput("File not saved.", false);
                this.state = TerminalState.NORMAL;
                this.currentEditingFile = '';
                this.showWelcomeAfterNano();
                return;
            }
            
            if (command.toLowerCase() === 'save' || command.toLowerCase() === 'w') {
                // Save the file
                if (this.currentEditingFile && this.nanoContent !== undefined) {
                    // Make sure parent directory exists
                    const normalizedPath = this.currentEditingFile;
                    const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                    
                    // Create parent directory if needed
                    if (!this.fileSystem.directoryExists(parentPath)) {
                        this.fileSystem.createDirectory(parentPath, true);
                    }
                    
                    // Check if file exists
                    if (!this.fileSystem.fileExists(normalizedPath)) {
                        // Create the file
                        this.fileSystem.createFile(normalizedPath, this.nanoContent);
                    } else {
                        // Update the file
                        this.fileSystem.writeFile(normalizedPath, this.nanoContent);
                    }
                    
                    this.output.addOutput(`Saved ${this.currentEditingFile}`, false);
                } else {
                    this.output.addOutput("Error: Could not save file.", true);
                }
                return;
            }
            
            if (command.toLowerCase() === 'x' || command.toLowerCase() === 'saveexit') {
                // Save and exit
                if (this.currentEditingFile && this.nanoContent !== undefined) {
                    // Make sure parent directory exists
                    const normalizedPath = this.currentEditingFile;
                    const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                    
                    // Create parent directory if needed
                    if (!this.fileSystem.directoryExists(parentPath)) {
                        this.fileSystem.createDirectory(parentPath, true);
                    }
                    
                    // Check if file exists
                    let success = false;
                    if (!this.fileSystem.fileExists(normalizedPath)) {
                        // Create the file
                        success = this.fileSystem.createFile(normalizedPath, this.nanoContent);
                    } else {
                        // Update the file
                        success = this.fileSystem.writeFile(normalizedPath, this.nanoContent);
                    }
                    
                    if (success) {
                        this.output.addOutput(`Saved ${this.currentEditingFile}`, false);
                    } else {
                        this.output.addOutput("Error: Could not save file.", true);
                        return;
                    }
                }
                
                this.state = TerminalState.NORMAL;
                this.currentEditingFile = '';
                this.nanoContent = undefined;
                this.showWelcomeAfterNano();
                return;
            }
            
            // Treat input as content edits
            if (this.nanoContent !== undefined) {
                this.nanoContent = command;
                this.showNanoInterface(this.currentEditingFile, this.nanoContent);
            }
        } else {
            // If we're in normal state, start nano editor
            const filename = args[1];
            if (!filename) {
                this.output.addOutput("Usage: nano <filename>", true);
                return;
            }
            
            // Initialize nano editor with the file
            this.currentEditingFile = filename;
            // Handle the case where readFile might return null
            const fileContent = this.fileSystem.fileExists(filename) 
                ? this.fileSystem.readFile(filename) || '' // Convert null to empty string
                : '';
            this.nanoContent = fileContent;
            
            this.state = TerminalState.NANO;
            this.output.addOutput(`Editing ${filename}...`, false);
            this.output.addOutput("(Type 'exit' to quit, 'save' to save, 'saveexit' to save and exit)", false);
            // Show the current content - ensure it's a string
            this.output.addOutput(this.nanoContent || '', false);
        }
    }
    
    private showNanoInterface(filePath: string, content: string): void {
        // Clear the terminal for nano interface
        this.output.clear();
        
        // Set current content
        this.nanoContent = content;
        
        // Display nano header
        this.output.addOutput(`  GNU nano ${filePath}`, false);
        this.output.addOutput('', false);
        
        // Display file content
        this.output.addOutput(content || '');
        
        // Display nano footer/helper
        this.output.addOutput('', false);
        this.output.addOutput('', false);
        this.output.addOutput('^G Get Help  ^O Write Out  ^W Where Is  ^K Cut Text  ^J Justify  ^C Cur Pos', false);
        this.output.addOutput('^X Exit      ^R Read File  ^\ Replace   ^U Paste     ^T To Spell ^_ Go To Line', false);
        this.output.addOutput('', false);
        this.output.addOutput('Commands in this simple version:', false);
        this.output.addOutput('save - Save the file', false);
        this.output.addOutput('exit/quit - Exit without saving', false);
        this.output.addOutput('x/saveexit - Save and exit', false);
        this.output.addOutput('Any other input will replace the entire file content', false);
    }
    
    private showWelcomeAfterNano(): void {
        // Clear terminal and show welcome message after exiting nano
        this.output.clear();
        this.output.addOutput("Welcome to Terminal OS", false);
        this.output.addOutput("Type 'help' to see available commands", false);
        this.output.addOutput("", false);
        
        // Update input position
        if (this.input) {
            this.input.updateInputPosition();
            setTimeout(() => this.input?.updateInputPosition(), 10);
            setTimeout(() => this.input?.updateInputPosition(), 50);
        }
    }
    
    private handleAirodumpCommand(args: string[]): void {
        const networkInterface = args[1]?.toLowerCase();
        
        if (!networkInterface) {
            this.output.addOutput("Usage: airodump-ng <interface>", true);
            return;
        }
        
        if (networkInterface !== "wlan0") {
            this.output.addOutput(`Error: Interface ${networkInterface} not found.`, true);
            return;
        }
        
        this.output.addOutput("Starting airodump-ng on wlan0...", false);
        this.output.addOutput("Scanning for wireless networks...", false);
        
        setTimeout(() => {
            this.output.addOutput("CH  6 ][ Elapsed: 12 s ][ 2023-03-22 11:24", false);
            this.output.addOutput(" BSSID              PWR  Beacons  #Data  CH   MB   ENC CIPHER  AUTH  ESSID", false);
            this.output.addOutput(" 00:11:22:33:44:55  -42      103    346   6   54e  WPA2 CCMP   PSK   CORP_SECURE", false);
            this.output.addOutput(" 00:11:22:33:44:66  -57       87    124   1   54e  OPN              Guest_WiFi", false);
            this.output.addOutput(" 00:11:22:33:44:77  -61       56     73  11   54e  WPA2 CCMP   PSK   HomeNetwork", false);
            this.output.addOutput(" 00:11:22:33:44:88  -72       42     12   3   54e  WEP  WEP         IoT_Network", false);
            this.output.addOutput("", false);
            this.output.addOutput(" BSSID              STATION            PWR   Rate    Lost  Frames  Notes  Probes", false);
            this.output.addOutput(" 00:11:22:33:44:55  66:77:88:99:AA:BB  -31   54-54      0     124", false);
            this.output.addOutput(" 00:11:22:33:44:55  66:77:88:99:AA:CC  -42   54-54      0      87", false);
            this.output.addOutput(" 00:11:22:33:44:55  66:77:88:99:AA:DD  -38   54-54      2      62", false);
            
            // Progress mission objective
            this.updateMissionProgress("wifi_pentest", "airodump-ng wlan0", "CORP_SECURE");
            
            // Update input position after output is complete
            this.input?.updateInputPosition();
        }, 2000);
    }
    
    private handleAireplayCommand(args: string[]): void {
        if (args.length < 4) {
            this.output.addOutput("Usage: aireplay-ng --deauth <count> -a <bssid> <interface>", true);
            return;
        }
        
        const action = args[1]?.toLowerCase();
        // Use the deauthCount variable in our logic to avoid the warning
        const deauthCount = parseInt(args[2] || "0");
        const dashA = args[3]?.toLowerCase();
        const bssid = args[4];
        const networkInterface = args[5]?.toLowerCase();
        
        if (action !== "--deauth" || dashA !== "-a" || !bssid || !networkInterface) {
            this.output.addOutput("Usage: aireplay-ng --deauth <count> -a <bssid> <interface>", true);
            return;
        }
        
        if (networkInterface !== "wlan0") {
            this.output.addOutput(`Error: Interface ${networkInterface} not found.`, true);
            return;
        }
        
        if (bssid !== "00:11:22:33:44:55") {
            this.output.addOutput(`Error: Unable to find target AP with BSSID ${bssid}`, true);
            return;
        }
        
        // Add some code that uses the deauthCount variable
        if (deauthCount <= 0) {
            this.output.addOutput("Error: Deauth count must be a positive number", true);
            return;
        }
        
        this.output.addOutput(`Sending deauthentication packets to BSSID [${bssid}]...`, false);
        
        // Simulate capture process with multiple updates
        setTimeout(() => {
            this.output.addOutput("Waiting for beacon frame from CORP_SECURE...", false);
            this.input?.updateInputPosition();
        }, 500);
        
        setTimeout(() => {
            this.output.addOutput("Found BSSID \"00:11:22:33:44:55\" (CORP_SECURE)", false);
            this.input?.updateInputPosition();
        }, 1000);
        
        setTimeout(() => {
            this.output.addOutput("Sending DeAuth to broadcast -- BSSID: [00:11:22:33:44:55]", false);
            this.input?.updateInputPosition();
        }, 1500);
        
        setTimeout(() => {
            this.output.addOutput("Sending packet 1/5", false);
            this.input?.updateInputPosition();
        }, 2000);
        
        setTimeout(() => {
            this.output.addOutput("Sending packet 2/5", false);
            this.input?.updateInputPosition();
        }, 2500);
        
        setTimeout(() => {
            this.output.addOutput("Sending packet 3/5", false);
            this.input?.updateInputPosition();
        }, 3000);
        
        setTimeout(() => {
            this.output.addOutput("Sending packet 4/5", false);
            this.input?.updateInputPosition();
        }, 3500);
        
        setTimeout(() => {
            this.output.addOutput("Sending packet 5/5", false);
            this.input?.updateInputPosition();
        }, 4000);
        
        setTimeout(() => {
            this.output.addOutput("Captured handshake from client 66:77:88:99:AA:BB", false);
            this.output.addOutput("Capture saved to: /tmp/captures/capture_CORP_SECURE.cap", false);
            
            // Automatically create the /tmp/captures directory and file if it doesn't exist
            const capturesDir = "/tmp/captures";
            if (!this.fileSystem.directoryExists(capturesDir)) {
                this.fileSystem.createDirectory(capturesDir, true);
            }
            
            // Create the capture file
            if (!this.fileSystem.fileExists("/tmp/captures/capture_CORP_SECURE.cap")) {
                this.fileSystem.createFile("/tmp/captures/capture_CORP_SECURE.cap", "WPA Handshake Capture File - CORP_SECURE");
            }
            
            // Progress mission objective
            this.updateMissionProgress("wifi_pentest", "aireplay-ng --deauth 5 -a 00:11:22:33:44:55 wlan0", "Captured handshake");
            
            // Update input position after final output
            this.input?.updateInputPosition();
        }, 4500);
    }
    
    private handleAircrackCommand(args: string[]): void {
        // Two formats to support:
        // 1. aircrack-ng <capture file> - for analyze
        // 2. aircrack-ng -w <wordlist> <capture file> - for crack
        
        if (args.length < 2) {
            this.output.addOutput("Usage: aircrack-ng [-w <wordlist>] <capture file>", true);
            return;
        }
        
        // Check if it's analysis or cracking
        if (args[1] === "-w") {
            // Cracking mode
            if (args.length < 4) {
                this.output.addOutput("Usage: aircrack-ng -w <wordlist> <capture file>", true);
                return;
            }
            
            const wordlistPath = args[2];
            const capturePath = args[3];
            
            // Check if files exist
            if (!this.fileSystem.fileExists(capturePath)) {
                this.output.addOutput(`Error: Capture file not found: ${capturePath}`, true);
                return;
            }
            
            if (!this.fileSystem.fileExists(wordlistPath)) {
                this.output.addOutput(`Error: Wordlist file not found: ${wordlistPath}`, true);
                return;
            }
            
            // If paths are correct, proceed with cracking
            this.output.addOutput(`Opening ${capturePath}...`, false);
            this.output.addOutput(`Reading packets, please wait...`, false);
            
            setTimeout(() => {
                this.output.addOutput("Aircrack-ng 1.6  [00:00:01] 1 keys tested (100.00 k/s)", false);
                this.input?.updateInputPosition();
            }, 800);
            
            // Simulate cracking process
            let counter = 0;
            const totalWords = 10;
            const interval = setInterval(() => {
                counter++;
                this.output.addOutput(`Aircrack-ng 1.6  [00:00:${counter.toString().padStart(2, '0')}] ${counter*100} keys tested (${counter*100}.00 k/s)`, false);
                this.input?.updateInputPosition();
                
                if (counter >= totalWords) {
                    clearInterval(interval);
                    setTimeout(() => {
                        this.output.addOutput("", false);
                        this.output.addOutput("                               KEY FOUND! [ corporate2023 ]", false);
                        this.output.addOutput("", false);
                        this.output.addOutput("      Master Key     : E4:F2:BD:7A:32:F3:26:AB:DF:C3:8B:9E:A9:4F:05:E1", false);
                        this.output.addOutput("                      6C:C4:A9:FF:58:3D:C2:7C:59:BE:72:FE:39:00:FC:31", false);
                        this.output.addOutput("", false);
                        this.output.addOutput("      Transient Key  : 25:BF:8D:34:A7:12:EB:0D:B3:C1:97:A6:F2:4E:1D:6F", false);
                        this.output.addOutput("                      A2:5B:7C:09:F1:D8:AE:3C:19:FB:AB:0E:57:29:1D:C4", false);
                        this.output.addOutput("", false);
                        this.output.addOutput("      EAPOL HMAC     : 73:89:E6:78:C5:DF:26:11:A3:09:4C:DD:F5:BF:63:87", false);
                        
                        // Progress mission objective
                        this.updateMissionProgress("wifi_pentest", "aircrack-ng -w /home/user/wifi/wordlist.txt /tmp/captures/capture_CORP_SECURE.cap", "KEY FOUND! [ corporate2023 ]");
                        
                        // Update input position after final output
                        this.input?.updateInputPosition();
                    }, 500);
                }
            }, 500);
        } else {
            // Analysis mode
            const capturePath = args[1];
            
            // Check if capture file exists
            if (!this.fileSystem.fileExists(capturePath)) {
                this.output.addOutput(`Error: Capture file not found: ${capturePath}`, true);
                return;
            }
            
            this.output.addOutput(`Opening ${capturePath}...`, false);
            
            setTimeout(() => {
                this.output.addOutput("Reading packets, please wait...", false);
                this.input?.updateInputPosition();
            }, 500);
            
            setTimeout(() => {
                this.output.addOutput("", false);
                this.output.addOutput("                                 Aircrack-ng 1.6", false);
                this.output.addOutput("", false);
                this.output.addOutput("      [00:00:01] Tested 1 keys (got 1 IVs)", false);
                this.output.addOutput("", false);
                this.output.addOutput("   KB    depth   byte(vote)", false);
                this.output.addOutput("    0    0/  1   00(100) 01( 53) 02( 31) 03( 19) 04( 12)", false);
                this.output.addOutput("    1    0/  1   00(100) 01( 53) 02( 31) 03( 19) 04( 12)", false);
                this.output.addOutput("", false);
                this.output.addOutput(" 1. ESSID: \"CORP_SECURE\"", false);
                this.output.addOutput("    Network BSSID: 00:11:22:33:44:55", false);
                this.output.addOutput("    WPA handshake: CORP_SECURE", false);
                this.output.addOutput("    File: /tmp/captures/capture_CORP_SECURE.cap", false);
                this.output.addOutput("", false);
                this.output.addOutput("Choosing first network as target. Use -e <essid> to specify a target.", false);
                this.output.addOutput("", false);
                this.output.addOutput("Opening /tmp/captures/capture_CORP_SECURE.cap", false);
                this.output.addOutput("Reading packets, please wait...", false);
                this.output.addOutput("", false);
                this.output.addOutput("Packet capture succeeded:", false);
                this.output.addOutput("  WPA handshake: 00:11:22:33:44:55", false);
                this.output.addOutput("", false);
                this.output.addOutput("Ready to crack. Use `-w wordlist.txt` option to start cracking.", false);
                
                // Progress mission objective
                this.updateMissionProgress("wifi_pentest", "aircrack-ng /tmp/captures/capture_CORP_SECURE.cap", "WPA handshake: CORP_SECURE");
                
                // Update input position after output is complete
                this.input?.updateInputPosition();
            }, 2000);
        }
    }
    
    private handleWpaSupplicantCommand(args: string[]): void {
        // We need to parse the complex command format:
        // wpa_supplicant -i wlan0 -c <(echo -e 'network={\n    ssid=\"CORP_SECURE\"\n    psk=\"corporate2023\"\n}')
        
        if (args.length < 5) {
            this.output.addOutput("Usage: wpa_supplicant -i <interface> -c <config_file>", true);
            return;
        }
        
        // Simplified parsing - just check if the command contains the required components
        const fullCommand = args.join(' ');
        
        if (!fullCommand.includes("CORP_SECURE") || !fullCommand.includes("corporate2023")) {
            this.output.addOutput("Error: Invalid configuration parameters", true);
            return;
        }
        
        this.output.addOutput("Connecting to CORP_SECURE using wpa_supplicant...", false);
        
        // Simulate connection process
        setTimeout(() => {
            this.output.addOutput("Successfully initialized wpa_supplicant", false);
            this.input?.updateInputPosition();
        }, 800);
        
        setTimeout(() => {
            this.output.addOutput("wlan0: Trying to associate with 00:11:22:33:44:55 (SSID='CORP_SECURE')", false);
            this.input?.updateInputPosition();
        }, 1600);
        
        setTimeout(() => {
            this.output.addOutput("wlan0: Associated with 00:11:22:33:44:55", false);
            this.input?.updateInputPosition();
        }, 2400);
        
        setTimeout(() => {
            this.output.addOutput("wlan0: WPA: Key negotiation completed with 00:11:22:33:44:55", false);
            this.output.addOutput("wlan0: CTRL-EVENT-CONNECTED - Connection to 00:11:22:33:44:55 completed", false);
            this.output.addOutput("Successfully connected to CORP_SECURE", false);
            
            // Progress mission objective
            this.updateMissionProgress("wifi_pentest", "wpa_supplicant -i wlan0 -c <(echo -e 'network={\n    ssid=\"CORP_SECURE\"\n    psk=\"corporate2023\"\n}')", "Successfully connected to CORP_SECURE");
            
            // Update input position after output is complete
            this.input?.updateInputPosition();
        }, 3200);
    }
    
    private handleNmapCommand(args: string[]): void {
        // nmap -sn 192.168.10.0/24
        const scanType = args[1]?.toLowerCase();
        const target = args[2];
        
        if (!scanType || !target) {
            this.output.addOutput("Usage: nmap [-sn|-sV|-p] <target>", true);
            return;
        }
        
        if (scanType !== "-sn") {
            this.output.addOutput(`Unsupported scan type: ${scanType}. Try -sn for ping scan.`, true);
            return;
        }
        
        if (target !== "192.168.10.0/24") {
            this.output.addOutput(`Scanning ${target}...`, false);
            setTimeout(() => {
                this.output.addOutput("Nmap scan report for " + target, false);
                this.output.addOutput("All 1000 scanned ports are filtered", false);
                this.input?.updateInputPosition();
            }, 2000);
            return;
        }
        
        this.output.addOutput(`Starting Nmap 7.92 ( https://nmap.org ) at ${new Date().toLocaleTimeString()}`, false);
        this.output.addOutput("Scanning 192.168.10.0/24 [2 ports]", false);
        
        setTimeout(() => {
            this.output.addOutput("Scanning in progress, please wait...", false);
            this.input?.updateInputPosition();
        }, 1000);
        
        setTimeout(() => {
            this.output.addOutput("Nmap scan report for 192.168.10.1", false);
            this.output.addOutput("Host is up (0.0034s latency).", false);
            this.output.addOutput("MAC Address: 00:DE:AD:BE:EF:01 (Router)", false);
            this.output.addOutput("", false);
            this.output.addOutput("Nmap scan report for 192.168.10.5", false);
            this.output.addOutput("Host is up (0.0058s latency).", false);
            this.output.addOutput("MAC Address: 00:DE:AD:BE:EF:05 (File Server)", false);
            this.output.addOutput("", false);
            this.output.addOutput("Nmap scan report for 192.168.10.10", false);
            this.output.addOutput("Host is up (0.0043s latency).", false);
            this.output.addOutput("MAC Address: 00:DE:AD:BE:EF:10 (Web Server)", false);
            this.output.addOutput("", false);
            this.output.addOutput("Nmap scan report for 192.168.10.15", false);
            this.output.addOutput("Host is up (0.0067s latency).", false);
            this.output.addOutput("MAC Address: 00:DE:AD:BE:EF:15 (Database Server)", false);
            this.output.addOutput("", false);
            this.output.addOutput("Nmap scan report for 192.168.10.20", false);
            this.output.addOutput("Host is up (0.0052s latency).", false);
            this.output.addOutput("MAC Address: 00:DE:AD:BE:EF:20 (Print Server)", false);
            this.output.addOutput("", false);
            this.output.addOutput("Nmap done: 256 IP addresses (5 hosts up) scanned in 5.23 seconds", false);
            
            // Progress mission objective
            this.updateMissionProgress("wifi_pentest", "nmap -sn 192.168.10.0/24", "Nmap scan report");
            
            // Update input position after output is complete
            this.input?.updateInputPosition();
        }, 5000);
    }
    
    private updateMissionProgress(missionId: string, command: string, output: string): void {
        this.missionManager.checkCommandObjective(missionId, command, output);
    }
    
    private handleSshCommand(_args: string[]): void {
        // Simple placeholder implementation
        this.output.addOutput("SSH connection attempt would appear here", true);
        this.input?.updateInputPosition();
    }
}