import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { FileNode } from "@shared/schema";
import { ProjectType, type RunnerConfig, type RunResult, type StreamCallbacks, DEFAULT_TIMEOUTS } from "./types";
import { detectProjectType, getEntryFile } from "./detector";
import { nodeRunner } from "./node";
import { pythonRunner } from "./python";
import { reactRunner } from "./react";
import { nextJsRunner } from "./nextjs";
import { staticRunner } from "./static";

export { ProjectType, type RunResult, type RunnerConfig, type StreamCallbacks } from "./types";
export { detectProjectType, getEntryFile } from "./detector";

interface RunProjectOptions {
  projectId: string;
  files: FileNode;
  language?: ProjectType;
  entryFile?: string;
  timeout?: number;
  env?: Record<string, string>;
  callbacks?: StreamCallbacks;
}

async function writeFilesToDisk(node: FileNode, basePath: string): Promise<void> {
  if (node.type === "file" && node.content !== undefined) {
    await writeFile(path.join(basePath, node.name), node.content);
  } else if (node.type === "folder" && node.children) {
    const folderPath = path.join(basePath, node.name);
    await mkdir(folderPath, { recursive: true });
    for (const child of node.children) {
      await writeFiles(child, folderPath);
    }
  }
}

async function writeFiles(node: FileNode, basePath: string): Promise<void> {
  if (node.type === "file" && node.content !== undefined) {
    await writeFile(path.join(basePath, node.name), node.content);
  } else if (node.type === "folder" && node.children) {
    const folderPath = path.join(basePath, node.name);
    await mkdir(folderPath, { recursive: true });
    for (const child of node.children) {
      await writeFiles(child, folderPath);
    }
  }
}

function getRunner(projectType: ProjectType) {
  switch (projectType) {
    case ProjectType.NODEJS:
      return nodeRunner;
    case ProjectType.PYTHON:
      return pythonRunner;
    case ProjectType.REACT_CRA:
    case ProjectType.REACT_VITE:
      return reactRunner;
    case ProjectType.NEXTJS:
      return nextJsRunner;
    case ProjectType.STATIC_HTML:
      return staticRunner;
    default:
      return nodeRunner;
  }
}

function getDefaultTimeout(projectType: ProjectType): number {
  switch (projectType) {
    case ProjectType.NODEJS:
    case ProjectType.PYTHON:
      return DEFAULT_TIMEOUTS.script;
    case ProjectType.REACT_CRA:
    case ProjectType.REACT_VITE:
    case ProjectType.NEXTJS:
      return DEFAULT_TIMEOUTS.server;
    case ProjectType.STATIC_HTML:
      return DEFAULT_TIMEOUTS.script;
    default:
      return DEFAULT_TIMEOUTS.script;
  }
}

export async function runProject(options: RunProjectOptions): Promise<RunResult> {
  const { projectId, files, callbacks } = options;
  
  let tmpDir: string | null = null;

  try {
    const projectType = options.language || detectProjectType(files);
    const entryFile = options.entryFile || getEntryFile(files, projectType);
    const timeout = options.timeout || getDefaultTimeout(projectType);

    tmpDir = await mkdtemp(path.join(tmpdir(), `novacode-${projectId}-`));

    if (files.type === "folder" && files.children) {
      for (const child of files.children) {
        await writeFiles(child, tmpDir);
      }
    } else if (files.type === "file") {
      await writeFilesToDisk(files, tmpDir);
    }

    const config: RunnerConfig = {
      language: projectType,
      entryFile,
      timeout,
      env: options.env,
      projectDir: tmpDir,
    };

    const runner = getRunner(projectType);
    const result = await runner.run(config, callbacks);

    const isLongRunning = [
      ProjectType.REACT_CRA,
      ProjectType.REACT_VITE,
      ProjectType.NEXTJS,
      ProjectType.STATIC_HTML,
    ].includes(projectType);

    if (!isLongRunning && tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    return result;
  } catch (error) {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    const result: RunResult = {
      success: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown error occurred",
      executionTime: 0,
      exitCode: -1,
    };
    
    callbacks?.onComplete?.(result);
    return result;
  }
}

export async function stopProject(projectType: ProjectType): Promise<void> {
  const runner = getRunner(projectType);
  if (runner.cleanup) {
    await runner.cleanup();
  }
}

export function mapLanguageToProjectType(language: string): ProjectType {
  const mapping: Record<string, ProjectType> = {
    "node-js": ProjectType.NODEJS,
    "nodejs": ProjectType.NODEJS,
    "javascript": ProjectType.NODEJS,
    "python": ProjectType.PYTHON,
    "py": ProjectType.PYTHON,
    "react": ProjectType.REACT_VITE,
    "react-cra": ProjectType.REACT_CRA,
    "react-vite": ProjectType.REACT_VITE,
    "nextjs": ProjectType.NEXTJS,
    "next": ProjectType.NEXTJS,
    "html": ProjectType.STATIC_HTML,
    "static": ProjectType.STATIC_HTML,
    "static-html": ProjectType.STATIC_HTML,
  };

  return mapping[language.toLowerCase()] || ProjectType.NODEJS;
}
