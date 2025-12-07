import { spawn, type ChildProcess, execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import type { Runner, RunnerConfig, RunResult, StreamCallbacks } from "./types";
import { DEFAULT_TIMEOUTS, ProjectType } from "./types";

export class ReactRunner implements Runner {
  private process: ChildProcess | null = null;
  private port: number = 3000;

  private async installDependencies(projectDir: string): Promise<{ success: boolean; output: string }> {
    const nodeModulesPath = path.join(projectDir, "node_modules");
    const packageJsonPath = path.join(projectDir, "package.json");

    if (!existsSync(packageJsonPath)) {
      return { success: false, output: "No package.json found" };
    }

    if (existsSync(nodeModulesPath)) {
      return { success: true, output: "Dependencies already installed" };
    }

    try {
      const output = execSync("npm install", {
        cwd: projectDir,
        timeout: DEFAULT_TIMEOUTS.build,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { success: true, output: output || "Dependencies installed successfully" };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : "Failed to install dependencies",
      };
    }
  }

  private getStartCommand(projectType: ProjectType): { command: string; args: string[] } {
    if (projectType === ProjectType.REACT_VITE) {
      return { command: "npm", args: ["run", "dev", "--", "--port", String(this.port)] };
    }
    return { command: "npm", args: ["start"] };
  }

  async run(config: RunnerConfig, callbacks?: StreamCallbacks): Promise<RunResult> {
    const startTime = Date.now();
    const timeout = config.timeout || DEFAULT_TIMEOUTS.server;

    const installResult = await this.installDependencies(config.projectDir);
    if (!installResult.success) {
      const result: RunResult = {
        success: false,
        stdout: "",
        stderr: installResult.output,
        executionTime: Date.now() - startTime,
        exitCode: -1,
      };
      callbacks?.onComplete?.(result);
      return result;
    }

    const { command, args } = this.getStartCommand(config.language);

    return new Promise<RunResult>((resolve) => {
      let stdout = installResult.output ? installResult.output + "\n" : "";
      let stderr = "";
      let resolved = false;
      let serverReady = false;

      const resolveOnce = (result: RunResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      try {
        this.process = spawn(command, args, {
          cwd: config.projectDir,
          env: { 
            ...process.env, 
            ...config.env,
            PORT: String(this.port),
            BROWSER: "none",
          },
          shell: true,
        });

        const timeoutId = setTimeout(() => {
          if (!serverReady) {
            this.cleanup();
            resolveOnce({
              success: false,
              stdout,
              stderr: stderr + "\nDev server startup timed out",
              executionTime: Date.now() - startTime,
              exitCode: -1,
            });
          }
        }, timeout);

        this.process.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          stdout += text;
          callbacks?.onStdout?.(text);

          if (
            text.includes("Local:") ||
            text.includes("ready") ||
            text.includes("compiled") ||
            text.includes("Started on")
          ) {
            serverReady = true;
            clearTimeout(timeoutId);
            const result: RunResult = {
              success: true,
              stdout,
              stderr,
              executionTime: Date.now() - startTime,
              previewUrl: `http://localhost:${this.port}`,
            };
            callbacks?.onComplete?.(result);
            resolveOnce(result);
          }
        });

        this.process.stderr?.on("data", (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          callbacks?.onStderr?.(text);
        });

        this.process.on("close", (code) => {
          clearTimeout(timeoutId);
          if (!resolved) {
            const result: RunResult = {
              success: code === 0,
              stdout,
              stderr,
              executionTime: Date.now() - startTime,
              exitCode: code ?? -1,
            };
            callbacks?.onComplete?.(result);
            resolveOnce(result);
          }
        });

        this.process.on("error", (err) => {
          clearTimeout(timeoutId);
          const result: RunResult = {
            success: false,
            stdout,
            stderr: stderr + "\n" + err.message,
            executionTime: Date.now() - startTime,
            exitCode: -1,
          };
          callbacks?.onComplete?.(result);
          resolveOnce(result);
        });
      } catch (error) {
        const result: RunResult = {
          success: false,
          stdout: "",
          stderr: error instanceof Error ? error.message : "Unknown error",
          executionTime: Date.now() - startTime,
          exitCode: -1,
        };
        callbacks?.onComplete?.(result);
        resolveOnce(result);
      }
    });
  }

  async cleanup(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}

export const reactRunner = new ReactRunner();
