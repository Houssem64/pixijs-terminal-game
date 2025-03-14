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

    private constructor() {
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
                            children: {}
                        }
                    }
                }
            }
        };
        this.currentPath = '/home/user';
    }

    static getInstance(): FileSystem {
        if (!FileSystem.instance) {
            FileSystem.instance = new FileSystem();
        }
        return FileSystem.instance;
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

    private normalizePath(path: string): string {
        if (path.startsWith('~')) {
            path = '/home/user' + path.slice(1);
        }
        if (!path.startsWith('/')) {
            path = this.currentPath + '/' + path;
        }
        return path;
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
                
                return `${permissions} 1 ${owner} ${group} ${size} ${date} ${file}${fileNode.type === 'directory' ? '/' : ''}`;
            });
        }
        
        return visibleFiles;
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
        node.content = content;
        return true;
    }

    changePath(path: string): boolean {
        const normalizedPath = this.normalizePath(path);
        const node = this.getNodeFromPath(normalizedPath);
        if (!node || node.type !== 'directory') return false;
        this.currentPath = normalizedPath;
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
                for (const [childName, childNode] of Object.entries(sourceNode.children)) {
                    this.copyFile(`${source}/${childName}`, `${destination}/${childName}`, { recursive: true });
                }
            }
            
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
        
        return true;
    }

    moveFile(source: string, destination: string): boolean {
        // Implement as copy + delete
        if (this.copyFile(source, destination, { recursive: true })) {
            return this.removeFile(source, { recursive: true });
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
        const node = this.getNodeFromPath(this.normalizePath(path));
        if (!node) return false;
        
        // Check if it's a file marked as executable
        if (node.type === 'file') {
            return node.executable === true;
        }
        
        // Directories are always "executable" (can be entered)
        return node.type === 'directory';
    }
} 