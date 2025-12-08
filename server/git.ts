import simpleGit, { SimpleGit, StatusResult, LogResult, BranchSummary } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import { FileNode } from "@shared/schema";

const PROJECTS_DIR = path.join(process.cwd(), ".git-projects");

function ensureProjectsDir(): void {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function getProjectPath(projectId: string): string {
  ensureProjectsDir();
  return path.join(PROJECTS_DIR, projectId);
}

function getGit(projectId: string): SimpleGit {
  const projectPath = getProjectPath(projectId);
  return simpleGit(projectPath);
}

function writeFilesToDisk(projectPath: string, files: FileNode, currentPath: string = ""): void {
  if (files.type === "file") {
    const filePath = path.join(projectPath, currentPath, files.name);
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(filePath, files.content || "");
  } else if (files.type === "folder" && files.children) {
    const folderPath = currentPath ? path.join(currentPath, files.name) : files.name;
    for (const child of files.children) {
      writeFilesToDisk(projectPath, child, folderPath === files.name ? "" : folderPath);
    }
  }
}

export interface GitStatus {
  current: string | null;
  tracking: string | null;
  staged: Array<{ path: string; status: string }>;
  modified: Array<{ path: string; status: string }>;
  not_added: Array<{ path: string; status: string }>;
  deleted: Array<{ path: string; status: string }>;
  isClean: boolean;
}

export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
}

export async function initRepo(projectId: string, files?: FileNode): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  try {
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    if (files) {
      if (files.type === "folder" && files.children) {
        for (const child of files.children) {
          writeFilesToDisk(projectPath, child);
        }
      } else {
        writeFilesToDisk(projectPath, files);
      }
    }

    const git = getGit(projectId);
    await git.init();
    
    const gitignorePath = path.join(projectPath, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, "node_modules/\n.env\n.DS_Store\n");
    }
    
    return { success: true, message: "Git repository initialized" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to initialize repository: ${errorMessage}` };
  }
}

export async function getStatus(projectId: string): Promise<GitStatus> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return {
      current: null,
      tracking: null,
      staged: [],
      modified: [],
      not_added: [],
      deleted: [],
      isClean: true,
    };
  }

  const git = getGit(projectId);
  const status: StatusResult = await git.status();

  return {
    current: status.current,
    tracking: status.tracking,
    staged: status.staged.map((file) => ({ path: file, status: "staged" })),
    modified: status.modified.map((file) => ({ path: file, status: "modified" })),
    not_added: status.not_added.map((file) => ({ path: file, status: "untracked" })),
    deleted: status.deleted.map((file) => ({ path: file, status: "deleted" })),
    isClean: status.isClean(),
  };
}

export async function addFiles(projectId: string, files: string[]): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    await git.add(files);
    return { success: true, message: `Staged ${files.length} file(s)` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to stage files: ${errorMessage}` };
  }
}

export async function commit(projectId: string, message: string): Promise<{ success: boolean; message: string; hash?: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    const result = await git.commit(message);
    return { 
      success: true, 
      message: `Committed with hash ${result.commit}`,
      hash: result.commit 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to commit: ${errorMessage}` };
  }
}

export async function getLog(projectId: string, limit: number = 50): Promise<GitCommit[]> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return [];
  }

  try {
    const git = getGit(projectId);
    const log: LogResult = await git.log({ maxCount: limit });
    
    return log.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author_name: entry.author_name,
      author_email: entry.author_email,
    }));
  } catch (error) {
    return [];
  }
}

export async function getBranches(projectId: string): Promise<GitBranch[]> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return [];
  }

  try {
    const git = getGit(projectId);
    const branches: BranchSummary = await git.branchLocal();
    
    return Object.entries(branches.branches).map(([name, data]) => ({
      name,
      current: data.current,
    }));
  } catch (error) {
    return [];
  }
}

export async function checkout(projectId: string, branch: string): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    await git.checkout(branch);
    return { success: true, message: `Switched to branch '${branch}'` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to checkout: ${errorMessage}` };
  }
}

export async function createBranch(projectId: string, name: string): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    await git.checkoutLocalBranch(name);
    return { success: true, message: `Created and switched to branch '${name}'` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to create branch: ${errorMessage}` };
  }
}

export async function syncFilesToRepo(projectId: string, files: FileNode): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  try {
    if (files.type === "folder" && files.children) {
      for (const child of files.children) {
        writeFilesToDisk(projectPath, child);
      }
    } else {
      writeFilesToDisk(projectPath, files);
    }
    return { success: true, message: "Files synced to repository" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to sync files: ${errorMessage}` };
  }
}

export async function deleteBranch(projectId: string, branchName: string): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    await git.deleteLocalBranch(branchName, true);
    return { success: true, message: `Deleted branch '${branchName}'` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to delete branch: ${errorMessage}` };
  }
}

export async function mergeBranch(projectId: string, branchName: string): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    await git.merge([branchName]);
    return { success: true, message: `Merged branch '${branchName}' into current branch` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to merge: ${errorMessage}` };
  }
}

export interface GitStash {
  index: number;
  message: string;
}

export async function stashSave(projectId: string, message?: string): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    const options = message ? ['save', message] : ['save'];
    await git.stash(options);
    return { success: true, message: message ? `Stashed changes: "${message}"` : "Stashed changes" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to stash: ${errorMessage}` };
  }
}

export async function stashPop(projectId: string, index?: number): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    const options = index !== undefined ? ['pop', `stash@{${index}}`] : ['pop'];
    await git.stash(options);
    return { success: true, message: "Applied and removed stash" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to pop stash: ${errorMessage}` };
  }
}

export async function stashDrop(projectId: string, index?: number): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    const options = index !== undefined ? ['drop', `stash@{${index}}`] : ['drop'];
    await git.stash(options);
    return { success: true, message: "Dropped stash" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to drop stash: ${errorMessage}` };
  }
}

export async function stashList(projectId: string): Promise<GitStash[]> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return [];
  }

  try {
    const git = getGit(projectId);
    const result = await git.stashList();
    
    return result.all.map((entry, index) => ({
      index,
      message: entry.message,
    }));
  } catch (error) {
    return [];
  }
}

export async function resetFile(projectId: string, filePath: string): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    await git.checkout(['--', filePath]);
    return { success: true, message: `Discarded changes in '${filePath}'` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to reset file: ${errorMessage}` };
  }
}

export async function unstageFile(projectId: string, filePath: string): Promise<{ success: boolean; message: string }> {
  const projectPath = getProjectPath(projectId);
  
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return { success: false, message: "Not a git repository. Please initialize first." };
  }

  try {
    const git = getGit(projectId);
    await git.reset(['HEAD', '--', filePath]);
    return { success: true, message: `Unstaged '${filePath}'` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to unstage file: ${errorMessage}` };
  }
}
