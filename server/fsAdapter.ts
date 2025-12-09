import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modifiedAt?: Date;
}

export interface FileContent {
  path: string;
  content: string;
  encoding?: string;
}

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
  '.vscode',
  '.idea',
  '__pycache__',
  '.pytest_cache',
  'venv',
  'env',
  '.env',
  'target',
  'vendor',
]);

const IGNORED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.gitkeep',
]);

function resolvePath(relativePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, relativePath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Path traversal not allowed');
  }
  return resolved;
}

function isIgnored(name: string, isDirectory: boolean): boolean {
  if (name.startsWith('.') && name !== '.env.example') {
    return true;
  }
  if (isDirectory) {
    return IGNORED_DIRS.has(name);
  }
  return IGNORED_FILES.has(name);
}

export async function readFile(filePath: string): Promise<FileContent> {
  const resolved = resolvePath(filePath);
  const content = await fs.readFile(resolved, 'utf-8');
  return {
    path: filePath,
    content,
    encoding: 'utf-8',
  };
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  const resolved = resolvePath(filePath);
  const dir = path.dirname(resolved);
  
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolved, content, 'utf-8');
}

export async function deleteFile(filePath: string): Promise<void> {
  const resolved = resolvePath(filePath);
  const stat = await fs.stat(resolved);
  
  if (stat.isDirectory()) {
    await fs.rm(resolved, { recursive: true, force: true });
  } else {
    await fs.unlink(resolved);
  }
}

export async function listFiles(dirPath: string = '.'): Promise<FileInfo[]> {
  const resolved = resolvePath(dirPath);
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const files: FileInfo[] = [];
  
  for (const entry of entries) {
    if (isIgnored(entry.name, entry.isDirectory())) {
      continue;
    }
    
    const fullPath = path.join(resolved, entry.name);
    const relativePath = path.relative(WORKSPACE_ROOT, fullPath);
    
    try {
      const stat = await fs.stat(fullPath);
      files.push({
        name: entry.name,
        path: relativePath,
        type: entry.isDirectory() ? 'folder' : 'file',
        size: entry.isFile() ? stat.size : undefined,
        modifiedAt: stat.mtime,
      });
    } catch (e) {
    }
  }
  
  files.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  
  return files;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const resolved = resolvePath(filePath);
    await fs.access(resolved);
    return true;
  } catch {
    return false;
  }
}

export async function createFolder(folderPath: string): Promise<void> {
  const resolved = resolvePath(folderPath);
  await fs.mkdir(resolved, { recursive: true });
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
  const resolvedOld = resolvePath(oldPath);
  const resolvedNew = resolvePath(newPath);
  await fs.rename(resolvedOld, resolvedNew);
}

export async function copyFile(srcPath: string, destPath: string): Promise<void> {
  const resolvedSrc = resolvePath(srcPath);
  const resolvedDest = resolvePath(destPath);
  const destDir = path.dirname(resolvedDest);
  
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(resolvedSrc, resolvedDest);
}

export function getWorkspaceRoot(): string {
  return WORKSPACE_ROOT;
}
