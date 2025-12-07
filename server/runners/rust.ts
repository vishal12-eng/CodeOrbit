import { spawn, execSync, type ChildProcess } from "child_process";
import path from "path";
import { existsSync } from "fs";
import type { Runner, RunnerConfig, RunResult, StreamCallbacks } from "./types";
import { DEFAULT_TIMEOUTS } from "./types";

export class RustRunner implements Runner {
  private process: ChildProcess | null = null;

  private hasCargoToml(projectDir: string): boolean {
    return existsSync(path.join(projectDir, "Cargo.toml"));
  }

  private compileRustc(projectDir: string, entryFile: string): { success: boolean; output: string; outputBinary: string } {
    const outputBinary = path.join(projectDir, "main");
    try {
      const output = execSync(`rustc -o main ${entryFile}`, {
        cwd: projectDir,
        timeout: DEFAULT_TIMEOUTS.build,
        encoding: "utf-8",
      });
      return { success: true, output: output || "Compilation successful", outputBinary };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : "Compilation failed",
        outputBinary,
      };
    }
  }

  async run(config: RunnerConfig, callbacks?: StreamCallbacks): Promise<RunResult> {
    const startTime = Date.now();
    const timeout = config.timeout || DEFAULT_TIMEOUTS.script;
    const entryFile = config.entryFile || "main.rs";

    const usesCargo = this.hasCargoToml(config.projectDir);

    if (!usesCargo) {
      const compileResult = this.compileRustc(config.projectDir, entryFile);
      if (!compileResult.success) {
        const result: RunResult = {
          success: false,
          stdout: "",
          stderr: compileResult.output,
          executionTime: Date.now() - startTime,
          exitCode: -1,
        };
        callbacks?.onComplete?.(result);
        return result;
      }
    }

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
        if (usesCargo) {
          this.process = spawn("cargo", ["run", "--quiet"], {
            cwd: config.projectDir,
            env: { ...process.env, ...config.env },
          });
        } else {
          this.process = spawn("./main", [], {
            cwd: config.projectDir,
            env: { ...process.env, ...config.env },
          });
        }

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

export const rustRunner = new RustRunner();
