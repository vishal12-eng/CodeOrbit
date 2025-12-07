import type { FileNode } from "@shared/schema";

export enum ProjectType {
  NODEJS = "nodejs",
  PYTHON = "python",
  REACT_CRA = "react-cra",
  REACT_VITE = "react-vite",
  NEXTJS = "nextjs",
  STATIC_HTML = "static-html",
}

export interface RunnerConfig {
  language: ProjectType;
  entryFile?: string;
  timeout: number;
  env?: Record<string, string>;
  projectDir: string;
}

export interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTime: number;
  previewUrl?: string;
  exitCode?: number;
}

export interface StreamCallbacks {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onComplete?: (result: RunResult) => void;
}

export interface Runner {
  run(config: RunnerConfig, callbacks?: StreamCallbacks): Promise<RunResult>;
  cleanup?(): Promise<void>;
}

export const DEFAULT_TIMEOUTS = {
  script: 10000,
  build: 60000,
  server: 300000,
} as const;

export function findFile(files: FileNode, fileName: string): FileNode | undefined {
  if (files.type === "file" && files.name === fileName) {
    return files;
  }
  if (files.type === "folder" && files.children) {
    for (const child of files.children) {
      if (child.type === "file" && child.name === fileName) {
        return child;
      }
      if (child.type === "folder") {
        const found = findFile(child, fileName);
        if (found) return found;
      }
    }
  }
  return undefined;
}

export function hasFileWithExtension(files: FileNode, extension: string): boolean {
  if (files.type === "file" && files.name.endsWith(extension)) {
    return true;
  }
  if (files.type === "folder" && files.children) {
    for (const child of files.children) {
      if (hasFileWithExtension(child, extension)) {
        return true;
      }
    }
  }
  return false;
}
