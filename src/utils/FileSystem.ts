interface FileSystemNode {
    type: 'file' | 'directory';
    name: string;
    content?: string;
    children?: { [key: string]: FileSystemNode };
    permissions?: string;
    owner?: string;
    group?: string;
    executable?: boolean;
    createdAt?: Date;
    modifiedAt?: Date;
}

export class FileSystem {
    private static instance: FileSystem;
    private root: FileSystemNode;
    private currentPath: string;
    private static readonly STORAGE_KEY = 'terminal_filesystem_state';

    private constructor() {
        // Try to load from localStorage
        const savedState = this.loadState();
        
        if (savedState) {
            this.root = savedState.root;
            this.currentPath = savedState.currentPath;
            console.log("Loaded file system from localStorage");
        } else {
            // Default initial state
            this.root = {
                type: 'directory',
                name: '/',
                children: {
                    'home': {
                        type: 'directory',
                        name: 'home',
                        children: {
                            'user': {
                                type: 'directory',
                                name: 'user',
                                children: {
                                    'documents': {
                                        type: 'directory',
                                        name: 'documents',
                                        children: {
                                            'welcome.txt': {
                                                type: 'file',
                                                name: 'welcome.txt',
                                                content: 'Welcome to Terminal OS!\n\nThis is your home directory.\nFeel free to explore the system using commands like ls, cd, and cat.\n\nType "help" to see available commands.',
                                                createdAt: new Date(),
                                                modifiedAt: new Date()
                                            }
                                        },
                                        permissions: 'drwxr-xr-x',
                                        owner: 'user',
                                        group: 'users',
                                        createdAt: new Date(),
                                        modifiedAt: new Date()
                                    },
                                    'projects': {
                                        type: 'directory',
                                        name: 'projects',
                                        children: {},
                                        permissions: 'drwxr-xr-x',
                                        owner: 'user',
                                        group: 'users',
                                        createdAt: new Date(),
                                        modifiedAt: new Date()
                                    },
                                    '.bashrc': {
                                        type: 'file',
                                        name: '.bashrc',
                                        content: '# .bashrc file\n# This file contains user-specific bash shell configuration\n\n# Define aliases\nalias ls="ls --color=auto"\nalias ll="ls -l"\nalias la="ls -la"\n',
                                        permissions: '-rw-r--r--',
                                        owner: 'user',
                                        group: 'users',
                                        createdAt: new Date(),
                                        modifiedAt: new Date()
                                    }
                                }
                            }
                        }
                    },
                    'bin': {
                        type: 'directory',
                        name: 'bin',
                        children: {
                            'ls': {
                                type: 'file',
                                name: 'ls',
                                content: '#!/bin/bash\n# ls command implementation',
                                permissions: '-rwxr-xr-x',
                                owner: 'root',
                                group: 'root',
                                executable: true,
                                createdAt: new Date(),
                                modifiedAt: new Date()
                            },
                            'cat': {
                                type: 'file',
                                name: 'cat',
                                content: '#!/bin/bash\n# cat command implementation',
                                permissions: '-rwxr-xr-x',
                                owner: 'root',
                                group: 'root',
                                executable: true,
                                createdAt: new Date(),
                                modifiedAt: new Date()
                            }
                        },
                        permissions: 'drwxr-xr-x',
                        owner: 'root',
                        group: 'root',
                        createdAt: new Date(),
                        modifiedAt: new Date()
                    },
                    'etc': {
                        type: 'directory',
                        name: 'etc',
                        children: {
                            'hosts': {
                                type: 'file',
                                name: 'hosts',
                                content: '127.0.0.1 localhost\n127.0.1.1 terminal-os',
                                permissions: '-rw-r--r--',
                                owner: 'root',
                                group: 'root',
                                createdAt: new Date(),
                                modifiedAt: new Date()
                            }
                        },
                        permissions: 'drwxr-xr-x',
                        owner: 'root',
                        group: 'root',
                        createdAt: new Date(),
                        modifiedAt: new Date()
                    }
                }
            };
            this.currentPath = '/home/user';
            
            // Save the initial state
            this.saveState();
        }
    }

    static getInstance(): FileSystem {
        if (!FileSystem.instance) {
            FileSystem.instance = new FileSystem();
        }
        return FileSystem.instance;
    }

    // Save state to localStorage
    private saveState(): void {
        try {
            // Create a serializable version of the state
            const serializableState = {
                root: this.prepareForSerialization(this.root),
                currentPath: this.currentPath
            };
            
            localStorage.setItem(FileSystem.STORAGE_KEY, JSON.stringify(serializableState));
            console.log("Saved file system state to localStorage");
        } catch (error) {
            console.error("Failed to save file system state:", error);
        }
    }
    
    // Convert Date objects to strings for serialization
    private prepareForSerialization(node: FileSystemNode): any {
        const result: any = { ...node };
        
        // Convert Date objects to ISO strings
        if (node.createdAt instanceof Date) {
            result.createdAt = node.createdAt.toISOString();
        }
        if (node.modifiedAt instanceof Date) {
            result.modifiedAt = node.modifiedAt.toISOString();
        }
        
        // Process children recursively
        if (node.children) {
            result.children = {};
            for (const [key, childNode] of Object.entries(node.children)) {
                result.children[key] = this.prepareForSerialization(childNode);
            }
        }
        
        return result;
    }

    // Load state from localStorage
    private loadState(): { root: FileSystemNode, currentPath: string } | null {
        try {
            const savedState = localStorage.getItem(FileSystem.STORAGE_KEY);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                return {
                    root: this.restoreFromSerialization(parsedState.root),
                    currentPath: parsedState.currentPath
                };
            }
        } catch (error) {
            console.error("Failed to load file system state:", error);
        }
        return null;
    }
    
    // Convert string dates back to Date objects
    private restoreFromSerialization(node: any): FileSystemNode {
        const result: FileSystemNode = { ...node };
        
        // Convert ISO strings back to Date objects
        if (typeof node.createdAt === 'string') {
            result.createdAt = new Date(node.createdAt);
        }
        if (typeof node.modifiedAt === 'string') {
            result.modifiedAt = new Date(node.modifiedAt);
        }
        
        // Process children recursively
        if (node.children) {
            result.children = {};
            for (const [key, childNode] of Object.entries(node.children)) {
                result.children[key] = this.restoreFromSerialization(childNode);
            }
        }
        
        return result;
    }

    getCurrentPath(): string {
        return this.currentPath;
    }

    private getNodeFromPath(path: string): FileSystemNode | null {
        const normalizedPath = this.normalizePath(path);
        const parts = normalizedPath.split('/').filter(p => p);
        let current = this.root;

        for (const part of parts) {
            if (!current.children?.[part]) {
                return null;
            }
            current = current.children[part];
        }

        return current;
    }

    normalizePath(path: string): string {
        if (path.startsWith('~')) {
            path = '/home/user' + path.slice(1);
        }
        
        // Special case for ..
        if (path === '..') {
            // Go up one directory
            if (this.currentPath === '/') {
                return '/'; // Already at root
            }
            
            const parts = this.currentPath.split('/').filter(p => p);
            if (parts.length === 0) {
                return '/';
            }
            
            parts.pop(); // Remove last part
            return '/' + parts.join('/');
        }
        
        if (!path.startsWith('/')) {
            path = this.currentPath + '/' + path;
        }
        
        // Resolve '..' in the middle of paths
        const parts = path.split('/');
        const resolvedParts = [];
        
        for (const part of parts) {
            if (part === '' || part === '.') {
                // Skip empty parts and current directory
                continue;
            } else if (part === '..') {
                // Go up one directory
                if (resolvedParts.length > 0) {
                    resolvedParts.pop();
                }
            } else {
                resolvedParts.push(part);
            }
        }
        
        // Ensure path starts with /
        return '/' + resolvedParts.join('/');
    }

    listFiles(path?: string, options?: { showHidden?: boolean, longFormat?: boolean }): string[] {
        const targetPath = path || this.currentPath;
        const node = this.getNodeFromPath(targetPath);
        if (!node || node.type !== 'directory') return [];
        
        const files = Object.keys(node.children || {});
        
        // Filter hidden files (those starting with a dot)
        const visibleFiles = options?.showHidden ? files : files.filter(file => !file.startsWith('.'));
        
        // Format according to options
        if (options?.longFormat) {
            return visibleFiles.map(file => {
                const fileNode = node.children?.[file];
                if (!fileNode) return '';
                
                const permissions = fileNode.permissions || (fileNode.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--');
                const owner = fileNode.owner || 'user';
                const group = fileNode.group || 'users';
                const size = fileNode.type === 'file' ? (fileNode.content?.length || 0) : 4096;
                const date = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                
                return `${permissions} 1 ${owner} ${group} ${size} ${date} ${file}${fileNode.type === 'directory' ? '/' : fileNode.executable ? '*' : ''}`;
            });
        }
        
        // For regular format, add trailing slashes to directories
        return visibleFiles.map(file => {
            const fileNode = node.children?.[file];
            if (!fileNode) return file;
            
            return file + (fileNode.type === 'directory' ? '/' : '');
        });
    }

    findFiles(path: string): string[] {
        const node = this.getNodeFromPath(path);
        if (!node) return [];
        
        const results: string[] = [];
        
        // Recursive function to collect all files and directories
        const collectFiles = (node: FileSystemNode, currentPath: string) => {
            if (node.type === 'directory' && node.children) {
                results.push(currentPath);
                
                for (const [name, childNode] of Object.entries(node.children)) {
                    collectFiles(childNode, `${currentPath}/${name}`);
                }
            } else if (node.type === 'file') {
                results.push(currentPath);
            }
        };
        
        collectFiles(node, path);
        return results;
    }

    createDirectory(path: string, recursive: boolean = false): boolean {
        const normalizedPath = this.normalizePath(path);
        
        // Handle recursive directory creation
        if (recursive) {
            const parts = normalizedPath.split('/').filter(p => p);
            let currentPath = '';
            
            for (const part of parts) {
                currentPath += '/' + part;
                const node = this.getNodeFromPath(currentPath);
                
                if (!node) {
                    // Create this part of the path
                    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                    const dirName = currentPath.substring(currentPath.lastIndexOf('/') + 1);
                    
                    const parent = this.getNodeFromPath(parentPath);
                    if (!parent || parent.type !== 'directory') return false;
                    
                    parent.children = parent.children || {};
                    parent.children[dirName] = {
                        type: 'directory',
                        name: dirName,
                        children: {},
                        permissions: 'drwxr-xr-x',
                        owner: 'user',
                        group: 'users',
                        createdAt: new Date(),
                        modifiedAt: new Date()
                    };
                } else if (node.type !== 'directory') {
                    // Path exists but is not a directory
                    return false;
                }
            }
            
            // Save state after modification
            this.saveState();
            
            return true;
        }
        
        // Non-recursive implementation (original behavior)
        const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        const dirName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
        
        const parent = this.getNodeFromPath(parentPath);
        if (!parent || parent.type !== 'directory') return false;
        
        if (parent.children?.[dirName]) return false;
        
        parent.children = parent.children || {};
        parent.children[dirName] = {
            type: 'directory',
            name: dirName,
            children: {},
            permissions: 'drwxr-xr-x',
            owner: 'user',
            group: 'users',
            createdAt: new Date(),
            modifiedAt: new Date()
        };
        
        // Save state after modification
        this.saveState();
        
        return true;
    }

    createFile(path: string, content: string = ''): boolean {
        const normalizedPath = this.normalizePath(path);
        const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        const fileName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
        
        const parent = this.getNodeFromPath(parentPath);
        if (!parent || parent.type !== 'directory') return false;
        
        if (parent.children?.[fileName]) return false;
        
        parent.children = parent.children || {};
        parent.children[fileName] = {
            type: 'file',
            name: fileName,
            content: content
        };
        
        // Save state after modification
        this.saveState();
        
        return true;
    }

    readFile(path: string): string | null {
        const node = this.getNodeFromPath(this.normalizePath(path));
        if (!node || node.type !== 'file') return null;
        return node.content || '';
    }

    writeFile(path: string, content: string): boolean {
        const node = this.getNodeFromPath(this.normalizePath(path));
        if (!node || node.type !== 'file') return false;
        
        // Update content
        node.content = content;
        
        // Update timestamps
        node.modifiedAt = new Date();
        
        // Save state after modification
        this.saveState();
        
        return true;
    }

    changePath(path: string): boolean {
        let normalizedPath = this.normalizePath(path);
        
        // Handle special cases for cd
        if (path === '..') {
            if (this.currentPath === '/') {
                return true; // Already at root, no change needed
            }
            
            const parts = this.currentPath.split('/').filter(p => p);
            if (parts.length === 0) {
                this.currentPath = '/';
                return true;
            }
            
            parts.pop(); // Remove last part
            this.currentPath = '/' + parts.join('/');
            if (this.currentPath === '') {
                this.currentPath = '/';
            }
            
            // Save state after modification
            this.saveState();
            
            return true;
        }
        
        // For regular paths
        const node = this.getNodeFromPath(normalizedPath);
        if (!node || node.type !== 'directory') return false;
        this.currentPath = normalizedPath;
        
        // Save state after modification
        this.saveState();
        
        return true;
    }

    removeFile(path: string, options?: { recursive?: boolean, force?: boolean }): boolean {
        const normalizedPath = this.normalizePath(path);
        const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        const fileName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
        
        const parent = this.getNodeFromPath(parentPath);
        if (!parent || parent.type !== 'directory' || !parent.children?.[fileName]) return false;
        
        const node = parent.children[fileName];
        
        // If it's a directory and not empty, need recursive option
        if (node.type === 'directory' && node.children && Object.keys(node.children).length > 0) {
            if (!options?.recursive) {
                return false; // Directory not empty and recursive option not provided
            }
        }
        
        delete parent.children[fileName];
        
        // Save state after modification
        this.saveState();
        
        return true;
    }

    copyFile(source: string, destination: string, options?: { recursive?: boolean }): boolean {
        const sourceNode = this.getNodeFromPath(this.normalizePath(source));
        if (!sourceNode) return false;
        
        const destPath = this.normalizePath(destination);
        const destParentPath = destPath.substring(0, destPath.lastIndexOf('/'));
        const destName = destPath.substring(destPath.lastIndexOf('/') + 1);
        
        const destParent = this.getNodeFromPath(destParentPath);
        if (!destParent || destParent.type !== 'directory') return false;
        
        // If source is a directory, need recursive option
        if (sourceNode.type === 'directory') {
            if (!options?.recursive) return false;
            
            // Create destination directory
            destParent.children = destParent.children || {};
            destParent.children[destName] = {
                type: 'directory',
                name: destName,
                children: {},
                permissions: sourceNode.permissions,
                owner: sourceNode.owner,
                group: sourceNode.group
            };
            
            // Copy all children recursively
            if (sourceNode.children) {
                for (const childName of Object.keys(sourceNode.children)) {
                    this.copyFile(`${source}/${childName}`, `${destination}/${childName}`, { recursive: true });
                }
            }
            
            // Save state after modification
            this.saveState();
            
            return true;
        }
        
        // Copying a file
        destParent.children = destParent.children || {};
        destParent.children[destName] = {
            type: 'file',
            name: destName,
            content: sourceNode.content,
            permissions: sourceNode.permissions,
            owner: sourceNode.owner,
            group: sourceNode.group,
            executable: sourceNode.executable
        };
        
        // Save state after modification
        this.saveState();
        
        return true;
    }

    moveFile(source: string, destination: string): boolean {
        // Implement as copy + delete
        if (this.copyFile(source, destination, { recursive: true })) {
            const result = this.removeFile(source, { recursive: true });
            
            // State already saved in copyFile and removeFile
            
            return result;
        }
        return false;
    }

    changePermissions(path: string, mode: string): boolean {
        const node = this.getNodeFromPath(this.normalizePath(path));
        if (!node) return false;
        
        // Simple implementation - just store the mode string
        // In a real implementation, we would parse and apply the permission bits
        node.permissions = mode;
        return true;
    }

    changeOwner(path: string, owner: string): boolean {
        const node = this.getNodeFromPath(this.normalizePath(path));
        if (!node) return false;
        
        // Parse owner and optionally group
        const parts = owner.split(':');
        node.owner = parts[0];
        if (parts.length > 1) {
            node.group = parts[1];
        }
        
        return true;
    }

    isExecutable(path: string): boolean {
        const node = this.getNodeFromPath(path);
        return node?.executable || false;
    }

    // Add methods to check if a file or directory exists
    fileExists(path: string): boolean {
        const node = this.getNodeFromPath(path);
        return node !== null && node.type === 'file';
    }

    directoryExists(path: string): boolean {
        const node = this.getNodeFromPath(path);
        return node !== null && node.type === 'directory';
    }
} 