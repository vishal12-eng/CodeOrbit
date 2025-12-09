import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { chatWithModel, streamWithModel, ModelId, ChatMessage } from "./models";
import { agentEventBus, AgentFileAction } from "./agentEventBus";

const execAsync = promisify(exec);
const router = Router();

const CODEWIZARD_SYSTEM_PROMPT = `You are **CodeWizard**, an advanced, agentic AI coding assistant embedded in NOVA CODE IDE PRO.

You are a senior full-stack engineer who:
- Generates high-quality, production-ready code (frontend + backend)
- Understands natural language requests (English + Hinglish)
- Creates, edits, deletes, and renames project files
- Shows file diffs and applies changes automatically
- Fixes bugs and optimizes existing code
- Suggests UI/UX improvements and implements them
- Manages entire projects from idea → code → optimization

COMMUNICATION STYLE:
- Be witty and engaging with light humor (e.g., "Ab yeh code rocket ki tarah fly karega! 🚀")
- Keep responses concise, actionable, and focused
- Speak in English + Hinglish mix when appropriate
- Never lecture - just build and explain briefly

RESPONSE FORMAT:
Always respond with valid JSON:
{
  "summary": "Brief description of what you're doing",
  "thinking": "Your chain-of-thought reasoning",
  "fileActions": [
    {
      "action": "create" | "edit" | "delete" | "read",
      "path": "relative/path/to/file.ts",
      "content": "// Full file content for create/edit",
      "diff": "// Optional: unified diff for edits"
    }
  ],
  "message": "Your friendly response to the user with code explanations",
  "nextSteps": ["List of suggested next actions"],
  "codeBlocks": [
    {
      "language": "typescript",
      "filename": "example.ts",
      "code": "// Code snippet to highlight"
    }
  ]
}

CODING RULES:
- Follow DRY, KISS principles
- Write clean, modular, production-ready code
- Use responsive design and accessibility (ARIA)
- Ensure security (input validation, no hardcoded secrets)
- Handle errors properly
- Add useful comments only when necessary
- Follow existing project patterns and style`;

interface CodeWizardRequest {
  message: string;
  projectPath?: string;
  currentFile?: {
    path: string;
    content: string;
    language: string;
  };
  projectContext?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  model?: ModelId;
}

interface FileAction {
  action: "create" | "edit" | "delete" | "read";
  path: string;
  content?: string;
  diff?: string;
}

interface CodeWizardResponse {
  summary: string;
  thinking?: string;
  fileActions: FileAction[];
  message: string;
  nextSteps: string[];
  codeBlocks?: Array<{
    language: string;
    filename: string;
    code: string;
  }>;
  appliedChanges?: string[];
  error?: string;
}

export async function listFiles(dirPath: string, basePath: string = ""): Promise<string[]> {
  const files: string[] = [];
  const ignoreDirs = ["node_modules", ".git", "dist", "build", ".next", "coverage", "__pycache__", ".local"];
  
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith(".")) {
          const subFiles = await listFiles(fullPath, relativePath);
          files.push(...subFiles);
        }
      } else {
        files.push(relativePath);
      }
    }
  } catch (e) {
  }
  
  return files;
}

export async function readFile(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, "utf-8");
  } catch (e) {
    return null;
  }
}

export async function createFile(filePath: string, content: string): Promise<boolean> {
  try {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content, "utf-8");
    return true;
  } catch (e) {
    return false;
  }
}

export async function editFile(filePath: string, content: string): Promise<boolean> {
  try {
    await fs.promises.writeFile(filePath, content, "utf-8");
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (e) {
    return false;
  }
}

export async function createFolder(folderPath: string): Promise<boolean> {
  try {
    await fs.promises.mkdir(folderPath, { recursive: true });
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteFolder(folderPath: string): Promise<boolean> {
  try {
    await fs.promises.rm(folderPath, { recursive: true, force: true });
    return true;
  } catch (e) {
    return false;
  }
}

export async function runCommand(cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { 
      cwd: cwd || process.cwd(),
      timeout: 30000,
    });
    return { stdout, stderr, success: true };
  } catch (e: any) {
    return { stdout: e.stdout || "", stderr: e.stderr || e.message, success: false };
  }
}

async function getProjectStructure(projectPath: string): Promise<string> {
  const files = await listFiles(projectPath);
  return files.slice(0, 100).join("\n");
}

async function getRelevantFileContents(projectPath: string, files: string[], maxFiles: number = 10): Promise<string> {
  const contents: string[] = [];
  const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json", ".py", ".go", ".rs"];
  
  const relevantFiles = files
    .filter(f => codeExtensions.some(ext => f.endsWith(ext)))
    .slice(0, maxFiles);
  
  for (const file of relevantFiles) {
    const fullPath = path.join(projectPath, file);
    const content = await readFile(fullPath);
    if (content && content.length < 5000) {
      const ext = path.extname(file).slice(1);
      contents.push(`### ${file}\n\`\`\`${ext}\n${content}\n\`\`\``);
    }
  }
  
  return contents.join("\n\n");
}

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const {
      message,
      projectPath,
      currentFile,
      projectContext,
      conversationHistory,
      model,
    } = req.body as CodeWizardRequest;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const resolvedPath = projectPath || process.cwd();
    const modelId: ModelId = model || "gemini-2.5-flash";

    const projectFiles = await listFiles(resolvedPath);
    const projectStructure = projectFiles.slice(0, 50).join("\n");
    
    let fileContext = "";
    if (currentFile) {
      fileContext = `\n\nCurrently open file: ${currentFile.path}\n\`\`\`${currentFile.language}\n${currentFile.content}\n\`\`\``;
    }

    const relevantContents = await getRelevantFileContents(resolvedPath, projectFiles, 5);

    const prompt = `
User Request: ${message}

Project Structure:
${projectStructure}

${projectContext ? `Project Context:\n${projectContext}\n` : ""}
${fileContext}

${relevantContents ? `\nRelevant File Contents:\n${relevantContents}` : ""}

Please analyze the request and provide a complete response with any necessary file actions.
Remember to respond with valid JSON following the specified format.
`;

    const messages: ChatMessage[] = [
      { role: "system", content: CODEWIZARD_SYSTEM_PROMPT },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: prompt });

    const response = await chatWithModel(messages, modelId);

    let wizardResponse: CodeWizardResponse;
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        wizardResponse = {
          summary: parsed.summary || "Analyzed your request",
          thinking: parsed.thinking,
          fileActions: parsed.fileActions || [],
          message: parsed.message || response.content,
          nextSteps: parsed.nextSteps || [],
          codeBlocks: parsed.codeBlocks,
        };
      } else {
        wizardResponse = {
          summary: "Response from CodeWizard",
          fileActions: [],
          message: response.content,
          nextSteps: [],
        };
      }
    } catch (e) {
      wizardResponse = {
        summary: "Response from CodeWizard",
        fileActions: [],
        message: response.content,
        nextSteps: [],
      };
    }

    res.json({
      ...wizardResponse,
      model: response.model,
    });

  } catch (error: any) {
    console.error("CodeWizard chat error:", error);
    res.status(500).json({ 
      error: "CodeWizard request failed",
      message: error.message,
    });
  }
});

router.post("/apply", async (req: Request, res: Response) => {
  try {
    const { fileActions, projectPath } = req.body as {
      fileActions: FileAction[];
      projectPath?: string;
    };

    if (!fileActions || !Array.isArray(fileActions)) {
      return res.status(400).json({ error: "File actions are required" });
    }

    const resolvedPath = projectPath || process.cwd();
    const results: Array<{ path: string; action: string; success: boolean; error?: string }> = [];

    for (const action of fileActions) {
      const fullPath = path.join(resolvedPath, action.path);
      let success = false;
      let error: string | undefined;

      try {
        switch (action.action) {
          case "create":
            if (action.content !== undefined) {
              success = await createFile(fullPath, action.content);
            }
            break;
          case "edit":
            if (action.content !== undefined) {
              success = await editFile(fullPath, action.content);
            }
            break;
          case "delete":
            success = await deleteFile(fullPath);
            break;
          case "read":
            const content = await readFile(fullPath);
            success = content !== null;
            break;
        }
      } catch (e: any) {
        error = e.message;
      }

      results.push({
        path: action.path,
        action: action.action,
        success,
        error,
      });
    }

    res.json({
      success: results.every(r => r.success),
      results,
    });

  } catch (error: any) {
    console.error("CodeWizard apply error:", error);
    res.status(500).json({ 
      error: "Failed to apply changes",
      message: error.message,
    });
  }
});

router.get("/files", async (req: Request, res: Response) => {
  try {
    const projectPath = (req.query.path as string) || process.cwd();
    const files = await listFiles(projectPath);
    
    res.json({ files, count: files.length });
  } catch (error: any) {
    console.error("CodeWizard files error:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

router.get("/file", async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    const projectPath = (req.query.projectPath as string) || process.cwd();
    
    if (!filePath) {
      return res.status(400).json({ error: "File path is required" });
    }

    const fullPath = path.join(projectPath, filePath);
    const content = await readFile(fullPath);
    
    if (content === null) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json({ 
      path: filePath, 
      content,
      language: getLanguageFromPath(filePath),
    });
  } catch (error: any) {
    console.error("CodeWizard file read error:", error);
    res.status(500).json({ error: "Failed to read file" });
  }
});

router.post("/file", async (req: Request, res: Response) => {
  try {
    const { path: filePath, content, projectPath } = req.body;
    
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: "File path and content are required" });
    }

    const resolvedPath = projectPath || process.cwd();
    const fullPath = path.join(resolvedPath, filePath);
    const success = await createFile(fullPath, content);
    
    res.json({ success, path: filePath });
  } catch (error: any) {
    console.error("CodeWizard file create error:", error);
    res.status(500).json({ error: "Failed to create file" });
  }
});

router.put("/file", async (req: Request, res: Response) => {
  try {
    const { path: filePath, content, projectPath } = req.body;
    
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: "File path and content are required" });
    }

    const resolvedPath = projectPath || process.cwd();
    const fullPath = path.join(resolvedPath, filePath);
    const success = await editFile(fullPath, content);
    
    res.json({ success, path: filePath });
  } catch (error: any) {
    console.error("CodeWizard file edit error:", error);
    res.status(500).json({ error: "Failed to edit file" });
  }
});

router.delete("/file", async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    const projectPath = (req.query.projectPath as string) || process.cwd();
    
    if (!filePath) {
      return res.status(400).json({ error: "File path is required" });
    }

    const fullPath = path.join(projectPath, filePath);
    const success = await deleteFile(fullPath);
    
    res.json({ success, path: filePath });
  } catch (error: any) {
    console.error("CodeWizard file delete error:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

router.post("/folder", async (req: Request, res: Response) => {
  try {
    const { path: folderPath, projectPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: "Folder path is required" });
    }

    const resolvedPath = projectPath || process.cwd();
    const fullPath = path.join(resolvedPath, folderPath);
    const success = await createFolder(fullPath);
    
    res.json({ success, path: folderPath });
  } catch (error: any) {
    console.error("CodeWizard folder create error:", error);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

router.delete("/folder", async (req: Request, res: Response) => {
  try {
    const folderPath = req.query.path as string;
    const projectPath = (req.query.projectPath as string) || process.cwd();
    
    if (!folderPath) {
      return res.status(400).json({ error: "Folder path is required" });
    }

    const fullPath = path.join(projectPath, folderPath);
    const success = await deleteFolder(fullPath);
    
    res.json({ success, path: folderPath });
  } catch (error: any) {
    console.error("CodeWizard folder delete error:", error);
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

router.post("/run", async (req: Request, res: Response) => {
  try {
    const { command, projectPath } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: "Command is required" });
    }

    const resolvedPath = projectPath || process.cwd();
    const result = await runCommand(command, resolvedPath);
    
    res.json(result);
  } catch (error: any) {
    console.error("CodeWizard run error:", error);
    res.status(500).json({ error: "Failed to run command" });
  }
});

function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
    ".json": "json",
    ".md": "markdown",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c",
    ".sql": "sql",
    ".yaml": "yaml",
    ".yml": "yaml",
  };
  return langMap[ext] || "plaintext";
}

export default router;
