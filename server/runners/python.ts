import { spawn, type ChildProcess, execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import type { Runner, RunnerConfig, RunResult, StreamCallbacks } from "./types";
import { DEFAULT_TIMEOUTS } from "./types";

export class PythonRunner implements Runner {
  private process: ChildProcess | null = null;

  private async installRequirements(projectDir: string): Promise<{ success: boolean; output: string }> {
    const requirementsPath = path.join(projectDir, "requirements.txt");
    
    if (!existsSync(requirementsPath)) {
      return { success: true, output: "" };
    }

    try {
      const output = execSync(`pip3 install -r requirements.txt --quiet`, {
        cwd: projectDir,
        timeout: DEFAULT_TIMEOUTS.build,
        encoding: "utf-8",
      });
      return { success: true, output: output || "Dependencies installed successfully" };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : "Failed to install requirements",
      };
    }
  }

  async run(config: RunnerConfig, callbacks?: StreamCallbacks): Promise<RunResult> {
    const startTime = Date.now();
    const timeout = config.timeout || DEFAULT_TIMEOUTS.script;
    const entryFile = config.entryFile || "main.py";

    const reqResult = await this.installRequirements(config.projectDir);
    if (!reqResult.success) {
      const result: RunResult = {
        success: false,
        stdout: "",
        stderr: reqResult.output,
        executionTime: Date.now() - startTime,
        exitCode: -1,
      };
      callbacks?.onComplete?.(result);
      return result;
    }

    return new Promise<RunResult>((resolve) => {
      let stdout = reqResult.output ? reqResult.output + "\n" : "";
      let stderr = "";
      let resolved = false;

      const resolveOnce = (result: RunResult) => {
        if (!resolved) {
          resolved = true;
          this.process = null;
          resolve(result);
        }
      };

      try {
        this.process = spawn("python3", [entryFile], {
          cwd: config.projectDir,
          env: { ...process.env, ...config.env, PYTHONUNBUFFERED: "1" },
        });

        const timeoutId = setTimeout(() => {
          if (this.process) {
            this.process.kill("SIGTERM");
          }
          resolveOnce({
            success: false,
            stdout,
            stderr: stderr + "\nExecution timed out after " + (timeout / 1000) + " seconds",
            executionTime: Date.now() - startTime,
            exitCode: -1,
          });
        }, timeout);

        this.process.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          stdout += text;
          callbacks?.onStdout?.(text);
        });

        this.process.stderr?.on("data", (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          callbacks?.onStderr?.(text);
        });

        this.process.on("close", (code) => {
          clearTimeout(timeoutId);
          const result: RunResult = {
            success: code === 0,
            stdout,
            stderr,
            executionTime: Date.now() - startTime,
            exitCode: code ?? -1,
          };
          callbacks?.onComplete?.(result);
          resolveOnce(result);
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

export const pythonRunner = new PythonRunner();
