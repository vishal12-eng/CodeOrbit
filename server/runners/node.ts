import { spawn, type ChildProcess } from "child_process";
import type { Runner, RunnerConfig, RunResult, StreamCallbacks } from "./types";
import { DEFAULT_TIMEOUTS } from "./types";

export class NodeRunner implements Runner {
  private process: ChildProcess | null = null;

  async run(config: RunnerConfig, callbacks?: StreamCallbacks): Promise<RunResult> {
    const startTime = Date.now();
    const timeout = config.timeout || DEFAULT_TIMEOUTS.script;
    const entryFile = config.entryFile || "main.js";

    return new Promise<RunResult>((resolve) => {
      let stdout = "";
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
        this.process = spawn("node", [entryFile], {
          cwd: config.projectDir,
          env: { ...process.env, ...config.env },
          timeout,
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

export const nodeRunner = new NodeRunner();
