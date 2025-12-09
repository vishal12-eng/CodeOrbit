import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { rimrafSync } from 'rimraf';

const PROJECT_ROOT = process.cwd();

// Secure path sanitization to prevent directory traversal attacks
function safePath(p: string): string {
    // Normalize and resolve the path
    const normalizedPath = path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(PROJECT_ROOT, normalizedPath);
    
    // Ensure the resolved path is within PROJECT_ROOT
    if (!fullPath.startsWith(PROJECT_ROOT + path.sep) && fullPath !== PROJECT_ROOT) {
        throw new Error('Access denied: Path is outside project directory');
    }
    
    // Block access to sensitive files and directories
    const blockedPatterns = [
        /node_modules/i,
        /\.git/i,
        /\.env$/i,
        /\.env\..*/i,
        /package-lock\.json/i,
    ];
    
    for (const pattern of blockedPatterns) {
        if (pattern.test(normalizedPath)) {
            throw new Error('Access denied: Cannot access protected files/directories');
        }
    }
    
    return fullPath;
}

// Validate command for security
function validateCommand(cmd: string): string {
    const blockedCommands = [
        /rm\s+-rf\s+\//i,
        /sudo/i,
        /chmod\s+777/i,
        /curl.*\|.*sh/i,
        /wget.*\|.*sh/i,
    ];
    
    for (const pattern of blockedCommands) {
        if (pattern.test(cmd)) {
            throw new Error('Command blocked for security reasons');
        }
    }
    
    return cmd;
}

export function createFile(pathArg: string, content: string): string { 
    const fullPath = safePath(pathArg); 
    fs.mkdirSync(path.dirname(fullPath), { recursive: true }); 
    fs.writeFileSync(fullPath, content); 
    return `File created: ${pathArg}`; 
}

export function editFile(pathArg: string, action: string, content: string, lineNum: number | null = null): string { 
    const fullPath = safePath(pathArg); 
    let data = fs.readFileSync(fullPath, 'utf8'); 

    if (action === 'replace') data = content; 
    else if (action === 'append') data += content; 
    else if (action === 'insert_at_line' && lineNum) { 
        const lines = data.split('\n'); 
        lines.splice(lineNum - 1, 0, content); 
        data = lines.join('\n'); 
    } 

    fs.writeFileSync(fullPath, data); 
    return `File edited: ${pathArg}`; 
}

export function deleteFile(pathArg: string): string { 
    fs.unlinkSync(safePath(pathArg)); 
    return `Deleted: ${pathArg}`; 
}

export function createFolder(pathArg: string): string { 
    fs.mkdirSync(safePath(pathArg), { recursive: true }); 
    return `Folder created: ${pathArg}`; 
}

export function deleteFolder(pathArg: string): string { 
    rimrafSync(safePath(pathArg)); 
    return `Folder deleted: ${pathArg}`; 
}

export function listFiles(pathArg: string = '.'): string { 
    const fullPath = safePath(pathArg); 
    return fs.readdirSync(fullPath).join(', '); 
}

export function runCommand(cmd: string): Promise<string> { 
    const safeCmd = validateCommand(cmd);
    return new Promise((resolve, reject) => { 
        exec(safeCmd, { cwd: PROJECT_ROOT, timeout: 30000 }, (error, stdout, stderr) => { 
            if (error) reject(new Error(stderr || error.message)); 
            else resolve(stdout); 
        }); 
    }); 
}
