import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileNode } from '@shared/schema';

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
  'target',
  'vendor',
  '.local',
  'attached_assets',
]);

const IGNORED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.gitkeep',
  'package-lock.json',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.java', '.kt', '.kts',
  '.go',
  '.rs',
  '.cpp', '.c', '.cc', '.cxx', '.h', '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.scala',
  '.html', '.htm',
  '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml',
  '.xml',
  '.md', '.mdx', '.txt',
  '.sql',
  '.sh', '.bash', '.zsh',
  '.env', '.env.example',
  '.gitignore', '.dockerignore',
  '.dockerfile', 'Dockerfile',
]);

function isIgnored(name: string, isDirectory: boolean): boolean {
  if (name.startsWith('.') && !name.startsWith('.env') && name !== '.gitignore') {
    return true;
  }
  if (isDirectory) {
    return IGNORED_DIRS.has(name);
  }
  return IGNORED_FILES.has(name);
}

function hasCodeExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return true;
  if (CODE_EXTENSIONS.has(filename.toLowerCase())) return true;
  return false;
}

export interface ScanOptions {
  rootPath?: string;
  maxDepth?: number;
  maxFiles?: number;
  includeContent?: boolean;
  maxFileSize?: number;
}

export async function scanProject(options: ScanOptions = {}): Promise<FileNode> {
  const {
    rootPath = process.cwd(),
    maxDepth = 10,
    maxFiles = 500,
    includeContent = true,
    maxFileSize = 100 * 1024,
  } = options;

  let fileCount = 0;

  async function scanDir(dirPath: string, depth: number): Promise<FileNode[]> {
    if (depth > maxDepth || fileCount >= maxFiles) {
      return [];
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const entry of sortedEntries) {
      if (fileCount >= maxFiles) break;
      if (isIgnored(entry.name, entry.isDirectory())) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const children = await scanDir(fullPath, depth + 1);
        nodes.push({
          name: entry.name,
          type: 'folder',
          children,
        });
      } else if (entry.isFile()) {
        if (!hasCodeExtension(entry.name)) continue;

        fileCount++;
        const node: FileNode = {
          name: entry.name,
          type: 'file',
        };

        if (includeContent) {
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size <= maxFileSize) {
              node.content = await fs.readFile(fullPath, 'utf-8');
            } else {
              node.content = `// File too large to display (${Math.round(stat.size / 1024)}KB)`;
            }
          } catch (e) {
            node.content = '// Error reading file';
          }
        }

        nodes.push(node);
      }
    }

    return nodes;
  }

  const children = await scanDir(rootPath, 0);

  return {
    name: 'root',
    type: 'folder',
    children,
  };
}

export async function getFileContent(filePath: string, rootPath?: string): Promise<string> {
  const root = rootPath || process.cwd();
  const resolved = path.resolve(root, filePath);
  
  if (!resolved.startsWith(root)) {
    throw new Error('Path traversal not allowed');
  }
  
  return await fs.readFile(resolved, 'utf-8');
}

export async function getDirectoryTree(dirPath: string = '.'): Promise<FileNode> {
  const rootPath = process.cwd();
  const resolved = path.resolve(rootPath, dirPath);
  
  if (!resolved.startsWith(rootPath)) {
    throw new Error('Path traversal not allowed');
  }

  return await scanProject({
    rootPath: resolved,
    includeContent: false,
    maxDepth: 5,
    maxFiles: 200,
  });
}
