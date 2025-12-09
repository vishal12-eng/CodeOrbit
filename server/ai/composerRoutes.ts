import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { gatherFullContext, detectProjectStack, type ProjectContext } from './contextDetector';
import { chatWithModel, streamWithModel, type ModelId, type ChatMessage } from './models';
import { scanProject } from '../projectScanner';

const execAsync = promisify(exec);
const router = Router();

interface ComposerPlan {
  summary: string;
  steps: Array<{
    id: string;
    description: string;
    file?: string;
    action: 'create' | 'edit' | 'delete' | 'terminal';
    command?: string;
  }>;
  files: Array<{
    path: string;
    action: 'create' | 'edit' | 'delete';
    content: string;
    originalContent?: string;
  }>;
  commands: string[];
}

const COMPOSER_SYSTEM_PROMPT = `You are an expert coding assistant embedded in a modern IDE.

Your job is to help users build features by generating a clear execution plan and complete code implementations.

IMPORTANT RULES:
1. Generate ONLY a numbered plan first - DO NOT write code until asked
2. Break complex tasks into 4-8 specific file changes + terminal commands
3. Be specific about which files to create/modify
4. Include all necessary imports and complete implementations
5. Follow the project's existing patterns and conventions
6. Use TypeScript when the project uses TypeScript
7. Use the project's UI framework (Tailwind, shadcn, etc.)

RESPONSE FORMAT FOR PLANNING:
Return ONLY a JSON object with this structure:
{
  "summary": "Brief 1-line description of what you will build",
  "steps": [
    {
      "id": "step-1",
      "description": "What this step does",
      "file": "path/to/file.tsx",
      "action": "create" | "edit" | "delete" | "terminal",
      "command": "npm install package" // only for terminal actions
    }
  ]
}

RESPONSE FORMAT FOR IMPLEMENTATION:
Return a JSON object with complete file contents:
{
  "files": [
    {
      "path": "path/to/file.tsx",
      "action": "create" | "edit",
      "content": "// Complete file content here..."
    }
  ],
  "commands": ["npm install package1 package2"]
}`;

router.post('/context', async (req: Request, res: Response) => {
  try {
    const projectPath = process.cwd();
    const context = await gatherFullContext(projectPath);
    
    res.json({
      success: true,
      context,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { query, context } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const projectPath = process.cwd();
    const projectContext = context || await gatherFullContext(projectPath);
    const projectFiles = await scanProject({ maxFiles: 50, includeContent: true });

    const fileContext = flattenForContext(projectFiles, 300);
    
    const prompt = `
PROJECT CONTEXT:
- Framework: ${projectContext.stack?.framework || 'Unknown'}
- UI: ${projectContext.stack?.ui || 'None'}
- Language: ${projectContext.stack?.language || 'JavaScript'}
- Database: ${projectContext.stack?.database || 'None'}

EXISTING FILES (truncated):
${fileContext}

USER REQUEST:
${query}

Generate a detailed execution plan. Return ONLY valid JSON with "summary" and "steps" arrays.
DO NOT include any code implementations yet - just the plan.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: COMPOSER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    const response = await chatWithModel(messages, 'gemini-1.5-pro');
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        return res.json({
          success: true,
          plan: {
            summary: plan.summary || 'Executing request',
            steps: plan.steps || [],
          },
          context: projectContext,
        });
      }
    } catch {
    }

    res.json({
      success: true,
      plan: {
        summary: 'Executing request',
        steps: [{ id: 'step-1', description: query, action: 'edit' }],
      },
      context: projectContext,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { query, plan, context, model = 'gemini-1.5-pro' } = req.body;
    
    if (!query || !plan) {
      return res.status(400).json({ success: false, error: 'Query and plan are required' });
    }

    const projectPath = process.cwd();
    const projectFiles = await scanProject({ maxFiles: 50, includeContent: true });
    const fileContext = flattenForContext(projectFiles, 500);

    const prompt = `
PROJECT CONTEXT:
- Framework: ${context?.stack?.framework || 'Unknown'}
- UI: ${context?.stack?.ui || 'None'}
- Language: ${context?.stack?.language || 'JavaScript'}

EXISTING FILES:
${fileContext}

EXECUTION PLAN:
${JSON.stringify(plan, null, 2)}

USER REQUEST: ${query}

Now generate the COMPLETE implementation for all files in the plan.
Return ONLY valid JSON with "files" array containing complete file contents and "commands" array for terminal commands.
Each file must have: path, action (create/edit), and complete content.
Generate PRODUCTION-READY code with all imports, types, and proper error handling.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: COMPOSER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    const response = await chatWithModel(messages, model as ModelId);
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        for (const file of result.files || []) {
          if (file.action === 'edit' && file.path) {
            try {
              const fullPath = path.join(projectPath, file.path);
              file.originalContent = await fs.readFile(fullPath, 'utf-8');
            } catch {
              file.originalContent = '';
            }
          }
        }

        return res.json({
          success: true,
          files: result.files || [],
          commands: result.commands || [],
        });
      }
    } catch {
    }

    res.status(500).json({ success: false, error: 'Failed to parse AI response' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { query, plan, context, model = 'gemini-1.5-pro' } = req.body;
    
    const projectPath = process.cwd();
    const projectFiles = await scanProject({ maxFiles: 50, includeContent: true });
    const fileContext = flattenForContext(projectFiles, 500);

    const prompt = `
PROJECT CONTEXT:
- Framework: ${context?.stack?.framework || 'Unknown'}
- UI: ${context?.stack?.ui || 'None'}  
- Language: ${context?.stack?.language || 'JavaScript'}

EXISTING FILES:
${fileContext}

EXECUTION PLAN:
${JSON.stringify(plan, null, 2)}

USER REQUEST: ${query}

Generate COMPLETE implementation for all files. Return ONLY valid JSON:
{
  "files": [{"path": "...", "action": "create|edit", "content": "...complete code..."}],
  "commands": ["npm install ..."]
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: COMPOSER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    let fullResponse = '';
    let fileIndex = 0;

    res.write(`data: ${JSON.stringify({ type: 'start', timestamp: Date.now() })}\n\n`);

    await streamWithModel(messages, model as ModelId, (token, done) => {
      if (!done && token) {
        fullResponse += token;
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);

        const fileMatches = fullResponse.match(/"path"\s*:\s*"([^"]+)"/g);
        if (fileMatches && fileMatches.length > fileIndex) {
          const newFile = fileMatches[fileMatches.length - 1].match(/"path"\s*:\s*"([^"]+)"/)?.[1];
          if (newFile) {
            res.write(`data: ${JSON.stringify({ type: 'file_start', path: newFile, index: fileMatches.length })}\n\n`);
            fileIndex = fileMatches.length;
          }
        }
      }
    });

    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        res.write(`data: ${JSON.stringify({ type: 'complete', files: result.files || [], commands: result.commands || [] })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to parse response' })}\n\n`);
      }
    } catch {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to parse AI response' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

router.post('/apply', async (req: Request, res: Response) => {
  try {
    const { files, commands } = req.body;
    const projectPath = process.cwd();
    const results: Array<{ path: string; success: boolean; error?: string }> = [];

    for (const file of files || []) {
      try {
        const fullPath = path.join(projectPath, file.path);
        
        if (file.action === 'delete') {
          await fs.unlink(fullPath);
          results.push({ path: file.path, success: true });
        } else {
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, file.content, 'utf-8');
          results.push({ path: file.path, success: true });
        }
      } catch (error: any) {
        results.push({ path: file.path, success: false, error: error.message });
      }
    }

    const commandResults: Array<{ command: string; success: boolean; output?: string; error?: string }> = [];
    
    for (const command of commands || []) {
      try {
        const { stdout, stderr } = await execAsync(command, { 
          cwd: projectPath,
          timeout: 60000,
        });
        commandResults.push({ 
          command, 
          success: true, 
          output: stdout + (stderr ? `\n${stderr}` : ''),
        });
      } catch (error: any) {
        commandResults.push({ 
          command, 
          success: false, 
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      files: results,
      commands: commandResults,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function flattenForContext(node: any, maxLength: number = 300, prefix: string = ''): string {
  let result = '';
  
  if (node.type === 'file' && node.content) {
    const content = node.content.length > maxLength 
      ? node.content.slice(0, maxLength) + '...[truncated]'
      : node.content;
    result += `### ${prefix}${node.name}\n\`\`\`\n${content}\n\`\`\`\n\n`;
  } else if (node.type === 'folder' && node.children) {
    const newPrefix = node.name === 'root' ? '' : `${prefix}${node.name}/`;
    for (const child of node.children.slice(0, 30)) {
      result += flattenForContext(child, maxLength, newPrefix);
    }
  }
  
  return result;
}

export default router;
