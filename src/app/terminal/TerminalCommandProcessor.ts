import { FileSystem } from "../../utils/FileSystem";
import { MissionManager, MissionData } from "../utils/MissionManager";
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
    private environmentVariables: EnvironmentVariables = {};
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
                    // Use partialClear instead of clear to preserve welcome messages
                    this.output.partialClear(3); // Preserve first 3 lines (welcome message)
                    
                    // Update input position after clearing - use a delay to ensure DOM is updated
                    if (this.input) {
                        // Update immediately
                        this.input.updateInputPosition();
                        
                        // Multiple delayed updates to ensure proper rendering across frames
                        setTimeout(() => this.input?.updateInputPosition(), 10);
                        setTimeout(() => this.input?.updateInputPosition(), 50);
                        setTimeout(() => this.input?.updateInputPosition(), 100);
                    }
                    break;
                    
                case 'clearmsg':
                    // Custom command to only clear error messages
                    this.clearOnlyErrorMessages();
                    
                    // Update input position
                    if (this.input) {
                        this.input.updateInputPosition();
                        setTimeout(() => this.input?.updateInputPosition(), 50);
                    }
                    break;
                    
                case 'reset':
                    // Full clear - remove everything including welcome message
                    this.output.clear();
                    
                    // Show welcome message again
                    this.output.addOutput("Welcome to Terminal OS", false);
                    this.output.addOutput("Type 'help' to see available commands", false);
                    this.output.addOutput("", false);
                    
                    // Update input position after reset
                    if (this.input) {
                        // Multiple updates to ensure UI renders properly
                        this.input.updateInputPosition();
                        setTimeout(() => this.input?.updateInputPosition(), 10);
                        setTimeout(() => this.input?.updateInputPosition(), 50);
                        setTimeout(() => this.input?.updateInputPosition(), 100);
                    }
                    break;
                    
                case 'ls':
                    this.handleLsCommand(args);
                    break;
                    
                case 'cd': {
                    const path = args[1] || '';
                    try {
                        // Handle special case for .. when path is at root
                        if (path === '..' && this.fileSystem.getCurrentPath() === '/') {
                            // Already at root, do nothing
                            return;
                        }
                        
                        const success = this.fileSystem.changePath(path);
                        if (success) {
                            // Update PWD environment variable
                            this.environmentVariables["PWD"] = this.fileSystem.getCurrentPath();
                            // Don't output anything on successful cd, like real terminals
                        } else {
                            this.output.addOutput(`cd: ${path}: No such file or directory`, true);
                        }
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
                        this.output.addOutput('Try \'mkdir --help\' for more information.', false);
                        return;
                    }
                    
                    const recursive = args.includes('-p') || args.includes('--parents');
                    const showHelp = args.includes('--help');
                    const verboseMode = args.includes('-v') || args.includes('--verbose');
                    
                    if (showHelp) {
                        this.output.addOutput('Usage: mkdir [OPTION]... DIRECTORY...', false);
                        this.output.addOutput('Create the DIRECTORY(ies), if they do not already exist.', false);
                        this.output.addOutput('', false);
                        this.output.addOutput('  -p, --parents     no error if existing, make parent directories as needed', false);
                        this.output.addOutput('  -v, --verbose     print a message for each created directory', false);
                        this.output.addOutput('      --help        display this help and exit', false);
                        return;
                    }
                    
                    // Process all directory arguments (excluding flags)
                    const dirArgs = args.filter(arg => !arg.startsWith('-') && arg !== 'mkdir');
                    
                    if (dirArgs.length === 0) {
                        this.output.addOutput('mkdir: missing operand', true);
                        return;
                    }
                    
                    let hasErrors = false;
                    let createdCount = 0;
                    
                    // Create each directory requested
                    for (const dirPath of dirArgs) {
                        try {
                            const success = this.fileSystem.createDirectory(dirPath, recursive);
                            
                            if (success) {
                                createdCount++;
                                if (verboseMode) {
                                    this.output.addOutput(`mkdir: created directory '${dirPath}'`, false);
                                }
                            } else {
                                this.output.addOutput(`mkdir: cannot create directory '${dirPath}': File exists`, true);
                                hasErrors = true;
                            }
                        } catch (err: unknown) {
                            const error = err as Error;
                            this.output.addOutput(`mkdir: ${error?.message || 'Unknown error'}`, true);
                            hasErrors = true;
                        }
                    }
                    
                    // Provide feedback even in non-verbose mode if directories were created
                    if (!verboseMode && createdCount > 0 && !hasErrors) {
                        this.output.addOutput(`Created ${createdCount} director${createdCount > 1 ? 'ies' : 'y'}`, false);
                    }
                    
                    // Exit with error status if any operation failed
                    if (hasErrors) {
                        return;
                    }
                    break;
                    
                case 'touch':
                    if (args.length < 2) {
                        this.output.addOutput('touch: missing file operand', true);
                        this.output.addOutput('Try \'touch --help\' for more information.', false);
                        return;
                    }
                    
                    const touchShowHelp = args.includes('--help');
                    
                    if (touchShowHelp) {
                        this.output.addOutput('Usage: touch [OPTION]... FILE...', false);
                        this.output.addOutput('Update the access and modification times of each FILE to the current time.', false);
                        this.output.addOutput('A FILE argument that does not exist is created empty.', false);
                        this.output.addOutput('', false);
                        this.output.addOutput('      --help        display this help and exit', false);
                        return;
                    }
                    
                    // Process all file arguments (excluding flags)
                    const fileArgs = args.filter(arg => !arg.startsWith('-') && arg !== 'touch');
                    
                    if (fileArgs.length === 0) {
                        this.output.addOutput('touch: missing file operand', true);
                        return;
                    }
                    
                    let touchSuccess = true;
                    
                    // Create or update each file
                    for (const filePath of fileArgs) {
                        try {
                            if (this.fileSystem.fileExists(filePath)) {
                                // File exists, update timestamp
                                const content = this.fileSystem.readFile(filePath) || '';
                                touchSuccess = this.fileSystem.writeFile(filePath, content) && touchSuccess;
                            } else {
                                // File doesn't exist, create it
                                touchSuccess = this.fileSystem.createFile(filePath, '') && touchSuccess;
                            }
                        } catch (err: unknown) {
                            const error = err as Error;
                            this.output.addOutput(`touch: ${error?.message || 'Unknown error'}`, true);
                            touchSuccess = false;
                        }
                    }
                    
                    if (!touchSuccess) {
                        return;
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
                    
                case 'cp':
                    if (args.length < 3) {
                        this.output.addOutput('cp: missing file operand', true);
                        this.output.addOutput('Try \'cp --help\' for more information.', false);
                        return;
                    }
                    
                    const cpShowHelp = args.includes('--help');
                    
                    if (cpShowHelp) {
                        this.output.addOutput('Usage: cp [OPTION]... SOURCE DEST', false);
                        this.output.addOutput('Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.', false);
                        this.output.addOutput('', false);
                        this.output.addOutput('  -r, --recursive     copy directories recursively', false);
                        this.output.addOutput('      --help          display this help and exit', false);
                        return;
                    }
                    
                    try {
                        const cpRecursive = args.includes('-r') || args.includes('--recursive');
                        const source = args[args.indexOf('-r') !== -1 ? args.indexOf('-r') + 1 : 1];
                        const destination = args[args.length - 1];
                        
                        // Ensure source exists
                        if (!this.fileSystem.fileExists(source) && !this.fileSystem.directoryExists(source)) {
                            this.output.addOutput(`cp: cannot stat '${source}': No such file or directory`, true);
                            return;
                        }
                        
                        // Execute copy
                        const success = this.fileSystem.copyFile(source, destination, { recursive: cpRecursive });
                        
                        if (!success) {
                            this.output.addOutput(`cp: failed to copy '${source}' to '${destination}'`, true);
                        }
                    } catch (err: unknown) {
                        const error = err as Error;
                        this.output.addOutput(`cp: ${error?.message || 'Unknown error'}`, true);
                    }
                    break;
                    
                case 'mv':
                    if (args.length < 3) {
                        this.output.addOutput('mv: missing file operand', true);
                        this.output.addOutput('Try \'mv --help\' for more information.', false);
                        return;
                    }
                    
                    const mvShowHelp = args.includes('--help');
                    
                    if (mvShowHelp) {
                        this.output.addOutput('Usage: mv [OPTION]... SOURCE DEST', false);
                        this.output.addOutput('Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.', false);
                        this.output.addOutput('', false);
                        this.output.addOutput('      --help          display this help and exit', false);
                        return;
                    }
                    
                    try {
                        const source = args[1];
                        const destination = args[args.length - 1];
                        
                        // Ensure source exists
                        if (!this.fileSystem.fileExists(source) && !this.fileSystem.directoryExists(source)) {
                            this.output.addOutput(`mv: cannot stat '${source}': No such file or directory`, true);
                            return;
                        }
                        
                        // Execute move
                        const success = this.fileSystem.moveFile(source, destination);
                        
                        if (!success) {
                            this.output.addOutput(`mv: failed to move '${source}' to '${destination}'`, true);
                        }
                    } catch (err: unknown) {
                        const error = err as Error;
                        this.output.addOutput(`mv: ${error?.message || 'Unknown error'}`, true);
                    }
                    break;
                    
                case 'mission':
                    this.handleMissionCommand(args);
                    break;
                    
                case 'nano':
                    if (args.length < 2) {
                        this.output.addOutput('nano: missing file operand', true);
                        this.output.addOutput('Usage: nano [file]', false);
                        return;
                    }
                    
                    try {
                        const filePath = args[1];
                        const normalizedPath = this.fileSystem.normalizePath(filePath);
                        
                        // Check parent directory and create if needed
                        const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                        if (!this.fileSystem.directoryExists(parentPath)) {
                            const createParentSuccess = this.fileSystem.createDirectory(parentPath, true);
                            if (!createParentSuccess) {
                                this.output.addOutput(`nano: cannot create parent directory for '${filePath}'`, true);
                                return;
                            }
                        }
                        
                        // Check if file exists, if not create it when saved
                        let content = '';
                        if (this.fileSystem.fileExists(normalizedPath)) {
                            const existingContent = this.fileSystem.readFile(normalizedPath);
                            if (existingContent !== null) {
                                content = existingContent;
                            }
                        }
                        
                        // Switch to nano mode
                        this.currentEditingFile = normalizedPath;
                        this.state = TerminalState.NANO;
                        
                        // Display the nano interface
                        this.showNanoInterface(normalizedPath, content);
                    } catch (err: unknown) {
                        const error = err as Error;
                        this.output.addOutput(`nano: ${error?.message || 'Unknown error'}`, true);
                    }
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
        
        if (cmd === '..') {
            return 'cd ..';
        }
        
        if (this.aliases[cmd]) {
            return this.aliases[cmd] + ' ' + parts.slice(1).join(' ');
        }
        
        return command;
    }
    
    private handleLsCommand(args: string[]): void {
        const showHidden = args.includes('-a') || args.includes('--all');
        const longFormat = args.includes('-l') || args.includes('--long');
        const showHelp = args.includes('--help');
        
        if (showHelp) {
            this.output.addOutput('Usage: ls [OPTION]... [FILE]...', false);
            this.output.addOutput('List information about the FILEs (the current directory by default).', false);
            this.output.addOutput('', false);
            this.output.addOutput('  -a, --all             do not ignore entries starting with .', false);
            this.output.addOutput('  -l, --long            use a long listing format', false);
            this.output.addOutput('      --help            display this help and exit', false);
            return;
        }
        
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
            
            // Just show files without extra text
            if (files.length > 0) {
                // For long format, just join lines
                if (longFormat) {
                    this.output.addOutput("total " + files.length, false);
                    this.output.addOutput(files.join('\n'));
                } else {
                    // For regular format, organize into columns with proper formatting
                    const formattedFiles = files.map(file => {
                        // Extract just the filename (without the trailing slash)
                        const fileName = file.endsWith('/') ? file.slice(0, -1) : file;
                        
                        // Compose full path to the file/directory
                        const fullPath = targetPath === '.' ? 
                            (this.fileSystem.getCurrentPath() + '/' + fileName) : 
                            (targetPath + '/' + fileName);
                            
                        // Check if it's a directory
                        if (this.fileSystem.directoryExists(fullPath)) {
                            // Use blue color for directories in terminal
                            return `\x1b[34m${fileName}/\x1b[0m`;
                        } else if (this.fileSystem.isExecutable(fullPath)) {
                            // Use green color for executable files
                            return `\x1b[32m${fileName}*\x1b[0m`;
                        }
                        return fileName;
                    });
                    
                    // Join with spaces for a column-like appearance
                    this.output.addOutput(formattedFiles.join('  '));
                }
            } else {
                // Don't show anything for empty directories, just like a real terminal
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
        const showHelp = args.includes('--help');
        
        if (showHelp) {
            this.output.addOutput('Usage: cat [OPTION]... [FILE]...', false);
            this.output.addOutput('Concatenate FILE(s) to standard output.', false);
            this.output.addOutput('', false);
            this.output.addOutput('  -n, --number           number all output lines', false);
            this.output.addOutput('      --help             display this help and exit', false);
            return;
        }
        
        if (args.length < 2 || (args.length === 2 && args[1].startsWith('-'))) {
            this.output.addOutput('cat: missing file operand', true);
            this.output.addOutput('Try \'cat --help\' for more information.', false);
            return;
        }
        
        const numberLines = args.includes('-n') || args.includes('--number');
        const fileArgs = args.filter(arg => !arg.startsWith('-') && arg !== 'cat');
        
        // Process each file
        for (const filePath of fileArgs) {
            try {
                const content = this.fileSystem.readFile(filePath);
                
                if (content === null) {
                    this.output.addOutput(`cat: ${filePath}: No such file or directory`, true);
                } else if (content === '') {
                    // Empty file - output nothing for empty files
                } else {
                    // Split content into lines
                    const lines = content.split('\n');
                    
                    if (numberLines) {
                        // Add line numbers
                        lines.forEach((line, index) => {
                            this.output.addOutput(`${(index + 1).toString().padStart(6, ' ')}  ${line}`);
                        });
                    } else {
                        // Output content as-is
                        this.output.addOutput(content);
                    }
                }
            } catch (error: unknown) {
                const err = error as Error;
                this.output.addOutput(`cat: ${err?.message || 'Unknown error'}`, true);
            }
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
        this.output.addOutput("  help         - Show this help message", false);
        this.output.addOutput("  clear, cls   - Clear the terminal output (preserves welcome messages)", false);
        this.output.addOutput("  clearmsg     - Clear only error messages, keeping other output", false);
        this.output.addOutput("  reset        - Reset the terminal completely and restore welcome message", false);
        this.output.addOutput("\nFile System Commands:", false);
        this.output.addOutput("  ls [options] [dir]  - List files in directory", false);
        this.output.addOutput("                        -a: show hidden files, -l: long format", false);
        this.output.addOutput("  cd [dir]            - Change current directory", false);
        this.output.addOutput("  pwd                 - Print current working directory", false);
        this.output.addOutput("  mkdir [options] dir - Create directories", false);
        this.output.addOutput("                        -p: create parent directories as needed", false);
        this.output.addOutput("  touch file          - Create an empty file or update timestamp", false);
        this.output.addOutput("  cat [options] file  - Display file contents", false);
        this.output.addOutput("                        -n: number lines", false);
        this.output.addOutput("  rm [options] file   - Remove files or directories", false);
        this.output.addOutput("                        -r: recursive, -f: force", false);
        this.output.addOutput("  cp [options] src dst- Copy files or directories", false);
        this.output.addOutput("                        -r: copy directories recursively", false);
        this.output.addOutput("  mv src dst          - Move (rename) files or directories", false);
        this.output.addOutput("  nano file           - Edit file using the nano text editor", false);
        this.output.addOutput("  echo [text]         - Display text in the terminal", false);
        this.output.addOutput("\nMission Commands:", false);
        this.output.addOutput("  mission list        - List available missions", false);
        this.output.addOutput("  mission start <id>  - Start a mission", false);
        this.output.addOutput("  mission info <id>   - Show mission details", false);
        this.output.addOutput("\nTip: Commands with options support --help for more information.", false);
    }
    
    private clearOnlyErrorMessages(): void {
        // Get all non-error lines from the output
        interface TextItem {
            text: string;
        }
        
        const nonErrorLines = this.output.getOutputHistory().filter((text: TextItem) => {
            const content = text.text || "";
            // Skip error messages which typically start with "Command not found" or similar
            return !(content.includes("Command not found") || 
                    content.includes("Error") || 
                    content.startsWith("$ "));
        });
        
        // Clear everything
        this.output.clear();
        
        // Re-add just the non-error lines
        nonErrorLines.forEach((line: TextItem) => {
            this.output.addOutput(line.text, false);
        });
    }
} 