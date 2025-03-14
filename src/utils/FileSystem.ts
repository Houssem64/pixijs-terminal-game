interface FileSystemNode {
    type: 'file' | 'directory';
    name: string;
    content?: string;
    children?: { [key: string]: FileSystemNode };
    permissions?: string;
    owner?: string;
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

    listFiles(path?: string): string[] {
        const targetPath = path || this.currentPath;
        const node = this.getNodeFromPath(targetPath);
        if (!node || node.type !== 'directory') return [];
        return Object.keys(node.children || {});
    }

    createDirectory(path: string): boolean {
        const normalizedPath = this.normalizePath(path);
        const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        const dirName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
        
        const parent = this.getNodeFromPath(parentPath);
        if (!parent || parent.type !== 'directory') return false;
        
        if (parent.children?.[dirName]) return false;
        
        parent.children = parent.children || {};
        parent.children[dirName] = {
            type: 'directory',
            name: dirName,
            children: {}
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

    removeFile(path: string): boolean {
        const normalizedPath = this.normalizePath(path);
        const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        const fileName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
        
        const parent = this.getNodeFromPath(parentPath);
        if (!parent || parent.type !== 'directory' || !parent.children?.[fileName]) return false;
        
        delete parent.children[fileName];
        return true;
    }
} 