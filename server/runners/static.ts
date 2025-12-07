import { createServer, type Server } from "http";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { Runner, RunnerConfig, RunResult, StreamCallbacks } from "./types";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

export class StaticRunner implements Runner {
  private server: Server | null = null;
  private port: number = 3000;

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || "application/octet-stream";
  }

  async run(config: RunnerConfig, callbacks?: StreamCallbacks): Promise<RunResult> {
    const startTime = Date.now();
    const projectDir = config.projectDir;

    const indexPath = path.join(projectDir, config.entryFile || "index.html");
    if (!existsSync(indexPath)) {
      const result: RunResult = {
        success: false,
        stdout: "",
        stderr: "No index.html found in project",
        executionTime: Date.now() - startTime,
        exitCode: -1,
      };
      callbacks?.onComplete?.(result);
      return result;
    }

    return new Promise<RunResult>((resolve) => {
      this.server = createServer(async (req, res) => {
        let requestPath = req.url || "/";
        
        if (requestPath === "/") {
          requestPath = "/" + (config.entryFile || "index.html");
        }

        const filePath = path.join(projectDir, requestPath);
        const normalizedPath = path.normalize(filePath);
        
        if (!normalizedPath.startsWith(projectDir)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        try {
          if (!existsSync(normalizedPath)) {
            const indexFallback = path.join(projectDir, "index.html");
            if (existsSync(indexFallback)) {
              const content = await readFile(indexFallback);
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(content);
              return;
            }
            res.writeHead(404);
            res.end("Not Found");
            return;
          }

          const content = await readFile(normalizedPath);
          const mimeType = this.getMimeType(normalizedPath);
          
          res.writeHead(200, { 
            "Content-Type": mimeType,
            "Cache-Control": "no-cache",
          });
          res.end(content);
        } catch (error) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          this.port++;
          this.server?.listen(this.port);
        } else {
          const result: RunResult = {
            success: false,
            stdout: "",
            stderr: err.message,
            executionTime: Date.now() - startTime,
            exitCode: -1,
          };
          callbacks?.onComplete?.(result);
          resolve(result);
        }
      });

      this.server.listen(this.port, () => {
        const stdout = `Static server running at http://localhost:${this.port}\n`;
        callbacks?.onStdout?.(stdout);
        
        const result: RunResult = {
          success: true,
          stdout,
          stderr: "",
          executionTime: Date.now() - startTime,
          previewUrl: `http://localhost:${this.port}`,
        };
        callbacks?.onComplete?.(result);
        resolve(result);
      });
    });
  }

  async cleanup(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const staticRunner = new StaticRunner();
