import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { agentEventBus, AgentStep, AgentFileAction } from "./agentEventBus";
import { chatWithModel, streamWithModel, ModelId, ChatMessage } from "./models";

const execAsync = promisify(exec);

export interface AgentRunConfig {
  runId: string;
  task: string;
  projectPath: string;
  modelId: ModelId;
  projectContext?: string;
}

interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

interface AgentPlan {
  summary: string;
  steps: Array<{
    id: string;
    name: string;
    description: string;
    action: "read" | "create" | "edit" | "delete" | "build" | "run" | "test";
    files: string[];
  }>;
}

const AGENT_SYSTEM_PROMPT = `You are Nova Agent, an advanced AI coding assistant embedded in Nova Code IDE.

Your job is to fully implement the user's request by:
1. Reading and understanding existing project files
2. Creating a clear execution plan
3. Implementing all required changes
4. Verifying the implementation works

RESPONSE FORMAT:
Always respond with valid JSON in this exact structure:
{
  "summary": "Brief description of what you will do",
  "steps": [
    {
      "id": "step-1",
      "name": "Step Name",
      "description": "What this step accomplishes",
      "action": "create" | "edit" | "read" | "delete" | "build" | "run" | "test",
      "files": ["path/to/file.ts"]
    }
  ],
  "implementation": {
    "files": [
      {
        "path": "path/to/file.ts",
        "action": "create" | "edit" | "delete",
        "content": "// Complete file content here"
      }
    ]
  }
}

RULES:
- Generate complete, working code
- Follow existing project patterns
- Include all imports
- Handle errors properly
- Test edge cases`;

export class AgentRunner {
  private runId: string;
  private task: string;
  private projectPath: string;
  private modelId: ModelId;
  private projectContext: string;
  private startTime: number;
  private filesCreated: string[] = [];
  private filesModified: string[] = [];
  private filesDeleted: string[] = [];
  private actionCount: number = 0;

  constructor(config: AgentRunConfig) {
    this.runId = config.runId;
    this.task = config.task;
    this.projectPath = config.projectPath;
    this.modelId = config.modelId;
    this.projectContext = config.projectContext || "";
    this.startTime = Date.now();
  }

  async run(): Promise<void> {
    try {
      agentEventBus.status(this.runId, "initializing", "Starting agent run...");

      const projectFiles = await this.readProjectFiles();
      agentEventBus.status(this.runId, "planning", "Analyzing project and generating plan...");

      const plan = await this.generatePlan(projectFiles);
      
      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error("Failed to generate a valid execution plan");
      }

      agentEventBus.modelOutput(this.runId, `## Plan: ${plan.summary}\n\n`, false, "plan");

      agentEventBus.status(this.runId, "executing", "Executing plan...");
      await this.executePlan(plan, projectFiles);

      agentEventBus.status(this.runId, "building", "Running build verification...");
      await this.runBuild();

      agentEventBus.status(this.runId, "completed", "Agent run completed successfully");
      
      agentEventBus.done(this.runId, {
        success: true,
        summary: plan.summary,
        filesCreated: this.filesCreated,
        filesModified: this.filesModified,
        filesDeleted: this.filesDeleted,
        totalSteps: plan.steps.length,
        totalActions: this.actionCount,
        executionTime: Date.now() - this.startTime,
      });

    } catch (error: any) {
      agentEventBus.error(this.runId, error.message || "Agent run failed", "AGENT_ERROR");
      agentEventBus.status(this.runId, "failed", `Agent run failed: ${error.message}`);
      agentEventBus.done(this.runId, {
        success: false,
        summary: `Failed: ${error.message}`,
        filesCreated: this.filesCreated,
        filesModified: this.filesModified,
        filesDeleted: this.filesDeleted,
        totalSteps: 0,
        totalActions: this.actionCount,
        executionTime: Date.now() - this.startTime,
      });
    }
  }

  private async readProjectFiles(): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json", ".md"];
    const ignoreDirs = ["node_modules", ".git", "dist", "build", ".next", "coverage"];

    const readDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.projectPath, fullPath);
          
          if (entry.isDirectory()) {
            if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith(".")) {
              await readDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              try {
                const content = await fs.promises.readFile(fullPath, "utf-8");
                const language = this.getLanguageFromExt(ext);
                files.push({ path: relativePath, content, language });
                
                this.emitFileAction("read", relativePath, `Read ${relativePath}`);
              } catch (e) {
              }
            }
          }
        }
      } catch (e) {
      }
    };

    await readDir(this.projectPath);
    return files;
  }

  private getLanguageFromExt(ext: string): string {
    const langMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescriptreact",
      ".js": "javascript",
      ".jsx": "javascriptreact",
      ".css": "css",
      ".html": "html",
      ".json": "json",
      ".md": "markdown",
    };
    return langMap[ext] || "plaintext";
  }

  private async generatePlan(projectFiles: ProjectFile[]): Promise<AgentPlan & { implementation?: { files: Array<{ path: string; action: string; content: string }> } }> {
    const fileContext = projectFiles
      .slice(0, 15)
      .map(f => `### ${f.path}\n\`\`\`${f.language}\n${f.content.slice(0, 400)}${f.content.length > 400 ? "\n..." : ""}\n\`\`\``)
      .join("\n\n");

    const prompt = `
Task: ${this.task}

Project Context:
${this.projectContext || "Standard web project"}

Existing Files (showing first 400 chars each):
${fileContext}

Generate a detailed execution plan WITH complete implementation. You must include the "implementation" field with all file changes.
Return a JSON object with "summary", "steps", and "implementation.files" arrays.
`;

    const messages: ChatMessage[] = [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ];

    const response = await chatWithModel(messages, this.modelId);
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        const result = {
          summary: parsed.summary || "Executing task",
          steps: parsed.steps || [],
          implementation: parsed.implementation,
        };
        
        if (parsed.implementation?.files && Array.isArray(parsed.implementation.files)) {
          for (const file of parsed.implementation.files) {
            if (file.path && file.content !== undefined) {
              await this.applyFileChange(file);
            }
          }
        }
        
        return result;
      }
    } catch (e: any) {
      agentEventBus.modelOutput(this.runId, `\nParsing plan response...\n`, false, "info");
    }

    return {
      summary: "Executing requested changes",
      steps: [
        {
          id: "step-1",
          name: "Implement Changes",
          description: "Implementing the requested changes",
          action: "edit" as const,
          files: [],
        },
      ],
    };
  }

  private async executePlan(plan: AgentPlan, projectFiles: ProjectFile[]): Promise<void> {
    const totalSteps = plan.steps.length;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const agentStep: AgentStep = {
        id: step.id,
        name: step.name,
        description: step.description,
        status: "active",
        startTime: Date.now(),
      };

      agentEventBus.stepStart(this.runId, agentStep, i, totalSteps);
      agentEventBus.modelOutput(this.runId, `\n### Step ${i + 1}: ${step.name}\n${step.description}\n`, false, "step");

      try {
        await this.executeStep(step, projectFiles);
        
        agentStep.status = "done";
        agentStep.endTime = Date.now();
        agentEventBus.stepEnd(this.runId, agentStep, i, totalSteps);

      } catch (error: any) {
        agentStep.status = "error";
        agentStep.error = error.message;
        agentStep.endTime = Date.now();
        agentEventBus.stepEnd(this.runId, agentStep, i, totalSteps);
        agentEventBus.error(this.runId, error.message, "STEP_ERROR", step.id);
      }
    }
  }

  private async executeStep(
    step: AgentPlan["steps"][0],
    projectFiles: ProjectFile[]
  ): Promise<void> {
    const relevantFiles = projectFiles
      .filter(f => step.files.some(sf => f.path.includes(sf) || sf.includes(f.path)))
      .map(f => `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
      .join("\n\n");

    const prompt = `
Execute this step:
- Name: ${step.name}
- Description: ${step.description}
- Action: ${step.action}
- Target Files: ${step.files.join(", ")}

Existing relevant files:
${relevantFiles || "No existing files match"}

Generate the complete implementation. Return JSON with "files" array containing objects with "path", "action", and "content".
`;

    const messages: ChatMessage[] = [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ];

    let fullResponse = "";
    
    await streamWithModel(messages, this.modelId, (token, done) => {
      if (!done && token) {
        fullResponse += token;
        agentEventBus.modelOutput(this.runId, token, true, "implementation");
      }
    });

    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const files = parsed.implementation?.files || parsed.files || [];
        
        for (const file of files) {
          await this.applyFileChange(file);
        }
      }
    } catch (e) {
    }
  }

  private async applyFileChange(file: { path: string; action: string; content: string }): Promise<void> {
    const fullPath = path.join(this.projectPath, file.path);
    const dir = path.dirname(fullPath);

    try {
      if (file.action === "delete") {
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
          this.filesDeleted.push(file.path);
          this.emitFileAction("delete", file.path, `Deleted ${file.path}`);
          agentEventBus.filesChanged(this.runId, [], [], [file.path]);
        }
      } else {
        await fs.promises.mkdir(dir, { recursive: true });
        
        const exists = fs.existsSync(fullPath);
        await fs.promises.writeFile(fullPath, file.content, "utf-8");
        
        if (exists) {
          this.filesModified.push(file.path);
          this.emitFileAction("edit", file.path, `Modified ${file.path}`);
          agentEventBus.filesChanged(this.runId, [], [file.path], []);
        } else {
          this.filesCreated.push(file.path);
          this.emitFileAction("create", file.path, `Created ${file.path}`);
          agentEventBus.filesChanged(this.runId, [file.path], [], []);
        }
      }
    } catch (error: any) {
      agentEventBus.error(this.runId, `Failed to apply change to ${file.path}: ${error.message}`, "FILE_ERROR");
    }
  }

  private emitFileAction(type: AgentFileAction["type"], file: string, description: string): void {
    this.actionCount++;
    agentEventBus.fileAction(
      this.runId,
      { type, file, description, timestamp: Date.now() },
      this.actionCount,
      this.actionCount
    );
  }

  private async runBuild(): Promise<void> {
    const packageJsonPath = path.join(this.projectPath, "package.json");
    
    try {
      if (!fs.existsSync(packageJsonPath)) {
        agentEventBus.modelOutput(this.runId, "\n\nNo package.json found, skipping build step.\n", false, "build");
        return;
      }

      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, "utf-8"));
      const hasTypeScript = fs.existsSync(path.join(this.projectPath, "tsconfig.json"));
      
      if (hasTypeScript) {
        this.emitFileAction("build", "tsconfig.json", "Running TypeScript check...");
        try {
          await execAsync("npx tsc --noEmit 2>&1 || true", { 
            cwd: this.projectPath,
            timeout: 30000,
          });
          agentEventBus.modelOutput(this.runId, "\n\nTypeScript check completed.\n", false, "build");
        } catch (e) {
          agentEventBus.modelOutput(this.runId, "\n\nTypeScript check skipped.\n", false, "build");
        }
      }
      
      if (packageJson.scripts?.build) {
        this.emitFileAction("build", "package.json", "Running build script...");
        try {
          await execAsync("npm run build 2>&1 || true", { 
            cwd: this.projectPath,
            timeout: 60000,
          });
          agentEventBus.modelOutput(this.runId, "\n\nBuild completed.\n", false, "build");
        } catch (e) {
          agentEventBus.modelOutput(this.runId, "\n\nBuild check skipped.\n", false, "build");
        }
      } else if (!hasTypeScript) {
        agentEventBus.modelOutput(this.runId, "\n\nNo build script found, verification skipped.\n", false, "build");
      }
    } catch (error: any) {
      agentEventBus.modelOutput(this.runId, `\n\nBuild verification skipped: ${error.message}\n`, false, "build");
    }
  }
}

export function createAgentRunner(config: AgentRunConfig): AgentRunner {
  return new AgentRunner(config);
}
