import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertApiKeySchema, apiKeyProviderEnum, type FileNode, type ApiKeyProvider } from "@shared/schema";
import aiRoutes from "./ai/routes";
import agentRoutes from "./ai/agentRoutes";
import codewizardRoutes from "./ai/codewizard";
import fileController from "./fileController";
import { isAuthenticated } from "./replitAuth";
import { 
  runProject, 
  stopProject,
  detectProjectType, 
  mapLanguageToProjectType,
  ProjectType,
  type RunResult 
} from "./runners";
import * as git from "./git";
import { formatCode } from "./formatter";
import archiver from "archiver";
import AdmZip from "adm-zip";
import { Readable } from "stream";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX_REQUESTS = 30;

setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitMap.entries());
  for (const [key, entry] of entries) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

function sanitizePath(entryPath: string): string | null {
  const parts = entryPath.split(/[/\\]/);
  const sanitized: string[] = [];
  
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') return null;
    if (part.startsWith('~') || part.includes(':')) return null;
    sanitized.push(part);
  }
  
  if (sanitized.length === 0) return null;
  return sanitized.join('/');
}

function countLinesOfCode(node: FileNode): number {
  if (node.type === 'file' && node.content) {
    return node.content.split('\n').length;
  }
  if (node.type === 'folder' && node.children) {
    return node.children.reduce((sum, child) => sum + countLinesOfCode(child), 0);
  }
  return 0;
}

function countFiles(node: FileNode): number {
  if (node.type === 'file') {
    return 1;
  }
  if (node.type === 'folder' && node.children) {
    return node.children.reduce((sum, child) => sum + countFiles(child), 0);
  }
  return 0;
}

function addFileToTree(root: FileNode, filePath: string, content: string): FileNode {
  const cloned = JSON.parse(JSON.stringify(root)) as FileNode;
  const parts = filePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return cloned;

  let current = cloned;
  for (const part of parts) {
    if (current.type !== 'folder' || !current.children) {
      current.children = [];
    }
    let child = current.children.find(c => c.name === part && c.type === 'folder');
    if (!child) {
      child = { name: part, type: 'folder', children: [] };
      current.children.push(child);
    }
    current = child;
  }

  if (!current.children) current.children = [];
  const existing = current.children.find(c => c.name === fileName);
  if (existing) {
    throw new Error(`File "${fileName}" already exists`);
  }
  current.children.push({ name: fileName, type: 'file', content });
  return cloned;
}

function addFolderToTree(root: FileNode, folderPath: string): FileNode {
  const cloned = JSON.parse(JSON.stringify(root)) as FileNode;
  const parts = folderPath.split('/').filter(Boolean);
  if (parts.length === 0) return cloned;

  let current = cloned;
  for (const part of parts) {
    if (current.type !== 'folder') {
      throw new Error(`Cannot create folder inside a file`);
    }
    if (!current.children) current.children = [];
    let child = current.children.find(c => c.name === part);
    if (child) {
      if (child.type !== 'folder') {
        throw new Error(`"${part}" is a file, not a folder`);
      }
    } else {
      child = { name: part, type: 'folder', children: [] };
      current.children.push(child);
    }
    current = child;
  }
  return cloned;
}

function deleteFromTree(root: FileNode, itemPath: string): FileNode {
  const cloned = JSON.parse(JSON.stringify(root)) as FileNode;
  const parts = itemPath.split('/').filter(Boolean);
  const itemName = parts.pop();
  if (!itemName) return cloned;

  let current = cloned;
  for (const part of parts) {
    if (current.type !== 'folder' || !current.children) {
      throw new Error(`Path not found: ${itemPath}`);
    }
    const child = current.children.find(c => c.name === part && c.type === 'folder');
    if (!child) {
      throw new Error(`Path not found: ${itemPath}`);
    }
    current = child;
  }

  if (!current.children) {
    throw new Error(`Item not found: ${itemPath}`);
  }
  const idx = current.children.findIndex(c => c.name === itemName);
  if (idx === -1) {
    throw new Error(`Item not found: ${itemPath}`);
  }
  current.children.splice(idx, 1);
  return cloned;
}

function renameInTree(root: FileNode, oldPath: string, newName: string): FileNode {
  const cloned = JSON.parse(JSON.stringify(root)) as FileNode;
  const parts = oldPath.split('/').filter(Boolean);
  const oldName = parts.pop();
  if (!oldName) return cloned;

  let current = cloned;
  for (const part of parts) {
    if (current.type !== 'folder' || !current.children) {
      throw new Error(`Path not found: ${oldPath}`);
    }
    const child = current.children.find(c => c.name === part && c.type === 'folder');
    if (!child) {
      throw new Error(`Path not found: ${oldPath}`);
    }
    current = child;
  }

  if (!current.children) {
    throw new Error(`Item not found: ${oldPath}`);
  }
  const item = current.children.find(c => c.name === oldName);
  if (!item) {
    throw new Error(`Item not found: ${oldPath}`);
  }
  if (current.children.some(c => c.name === newName && c !== item)) {
    throw new Error(`An item named "${newName}" already exists`);
  }
  item.name = newName;
  return cloned;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use('/api/ai', aiRoutes);
  app.use('/api/agent', agentRoutes);
  app.use('/api/codewizard', codewizardRoutes);
  app.use('/api/files', fileController);

  app.post('/api/format', async (req: any, res) => {
    try {
      const { code, language } = req.body;
      
      if (typeof code !== 'string') {
        return res.status(400).json({ error: "Invalid code: must be a string" });
      }
      
      if (!language || typeof language !== 'string') {
        return res.status(400).json({ error: "Invalid language: must be a non-empty string" });
      }

      const result = await formatCode(code, language);
      
      if (result.success) {
        res.json({ 
          formatted: result.formatted,
          note: result.note 
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Error formatting code:", error);
      res.status(500).json({ error: "Failed to format code" });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const projects = await storage.getProjectsByOwner(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertProjectSchema.safeParse({ ...req.body, ownerId: userId });
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid project data", errors: parsed.error.errors });
      }

      const project = await storage.createProject(parsed.data);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get('/api/projects/:id', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.put('/api/projects/:id', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const updates: Partial<{ name: string; files: FileNode }> = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.files) updates.files = req.body.files;

      const updated = await storage.updateProject(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete('/api/projects/:id', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.post('/api/projects/:id/files', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { path, content = '' } = req.body;
      if (!path || typeof path !== 'string') {
        return res.status(400).json({ message: "Invalid path: must be a non-empty string" });
      }

      const sanitized = sanitizePath(path);
      if (!sanitized) {
        return res.status(400).json({ message: "Invalid path" });
      }

      const updatedFiles = addFileToTree(project.files, sanitized, content);
      const updated = await storage.updateProject(req.params.id, { files: updatedFiles });
      res.status(201).json(updated);
    } catch (error: any) {
      console.error("Error creating file:", error);
      res.status(400).json({ message: error.message || "Failed to create file" });
    }
  });

  app.post('/api/projects/:id/folders', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { path } = req.body;
      if (!path || typeof path !== 'string') {
        return res.status(400).json({ message: "Invalid path: must be a non-empty string" });
      }

      const sanitized = sanitizePath(path);
      if (!sanitized) {
        return res.status(400).json({ message: "Invalid path" });
      }

      const updatedFiles = addFolderToTree(project.files, sanitized);
      const updated = await storage.updateProject(req.params.id, { files: updatedFiles });
      res.status(201).json(updated);
    } catch (error: any) {
      console.error("Error creating folder:", error);
      res.status(400).json({ message: error.message || "Failed to create folder" });
    }
  });

  app.put('/api/projects/:id/files/rename', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { oldPath, newName } = req.body;
      if (!oldPath || typeof oldPath !== 'string') {
        return res.status(400).json({ message: "Invalid oldPath: must be a non-empty string" });
      }
      if (!newName || typeof newName !== 'string') {
        return res.status(400).json({ message: "Invalid newName: must be a non-empty string" });
      }

      const sanitizedOld = sanitizePath(oldPath);
      if (!sanitizedOld) {
        return res.status(400).json({ message: "Invalid oldPath" });
      }

      const updatedFiles = renameInTree(project.files, sanitizedOld, newName);
      const updated = await storage.updateProject(req.params.id, { files: updatedFiles });
      res.json(updated);
    } catch (error: any) {
      console.error("Error renaming item:", error);
      res.status(400).json({ message: error.message || "Failed to rename item" });
    }
  });

  app.delete('/api/projects/:id/files', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { path } = req.body;
      if (!path || typeof path !== 'string') {
        return res.status(400).json({ message: "Invalid path: must be a non-empty string" });
      }

      const sanitized = sanitizePath(path);
      if (!sanitized) {
        return res.status(400).json({ message: "Invalid path" });
      }

      const updatedFiles = deleteFromTree(project.files, sanitized);
      const updated = await storage.updateProject(req.params.id, { files: updatedFiles });
      res.json(updated);
    } catch (error: any) {
      console.error("Error deleting file:", error);
      res.status(400).json({ message: error.message || "Failed to delete file" });
    }
  });

  app.delete('/api/projects/:id/folders', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { path } = req.body;
      if (!path || typeof path !== 'string') {
        return res.status(400).json({ message: "Invalid path: must be a non-empty string" });
      }

      const sanitized = sanitizePath(path);
      if (!sanitized) {
        return res.status(400).json({ message: "Invalid path" });
      }

      const updatedFiles = deleteFromTree(project.files, sanitized);
      const updated = await storage.updateProject(req.params.id, { files: updatedFiles });
      res.json(updated);
    } catch (error: any) {
      console.error("Error deleting folder:", error);
      res.status(400).json({ message: error.message || "Failed to delete folder" });
    }
  });

  app.post('/api/projects/:id/duplicate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const duplicated = await storage.createProject({
        ownerId: userId,
        name: `${project.name} (Copy)`,
        language: project.language,
        files: project.files,
      });
      
      res.status(201).json(duplicated);
    } catch (error) {
      console.error("Error duplicating project:", error);
      res.status(500).json({ message: "Failed to duplicate project" });
    }
  });

  app.get('/api/projects/:id/detect-type', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const detectedType = detectProjectType(project.files);
      
      res.json({ 
        projectType: detectedType,
        projectTypeLabel: getProjectTypeLabel(detectedType)
      });
    } catch (error) {
      console.error("Error detecting project type:", error);
      res.status(500).json({ message: "Failed to detect project type" });
    }
  });

  app.get('/api/projects/:id/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const linesOfCode = countLinesOfCode(project.files);
      const fileCount = countFiles(project.files);
      const detectedType = detectProjectType(project.files);
      
      res.json({
        linesOfCode,
        fileCount,
        language: project.language,
        projectType: detectedType,
        projectTypeLabel: getProjectTypeLabel(detectedType),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });
    } catch (error) {
      console.error("Error fetching project analytics:", error);
      res.status(500).json({ message: "Failed to fetch project analytics" });
    }
  });

  app.post('/api/run/:projectId', async (req: any, res) => {
    try {
      const identifier = req.ip || 'unknown';
      if (!checkRateLimit(identifier)) {
        return res.status(429).json({ 
          message: "Rate limit exceeded. Please wait before running code again.",
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
      }

      const project = await storage.getProject(req.params.projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const language = req.body.language 
        ? mapLanguageToProjectType(req.body.language)
        : undefined;

      const result = await runProject({
        projectId: req.params.projectId,
        files: project.files,
        language,
        entryFile: req.body.entryFile,
        timeout: Math.min(req.body.timeout || 30000, 120000),
        env: req.body.env,
      });

      res.json(result);
    } catch (error) {
      console.error("Error running code:", error);
      res.status(500).json({ message: "Failed to run code" });
    }
  });

  app.get('/api/run/:projectId/stream', async (req: any, res) => {
    try {
      const identifier = req.ip || 'unknown';
      if (!checkRateLimit(identifier)) {
        return res.status(429).json({ 
          message: "Rate limit exceeded. Please wait before running code again.",
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
      }

      const project = await storage.getProject(req.params.projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent('start', { projectId: req.params.projectId, timestamp: Date.now() });

      const language = req.query.language 
        ? mapLanguageToProjectType(req.query.language as string)
        : undefined;

      const result = await runProject({
        projectId: req.params.projectId,
        files: project.files,
        language,
        entryFile: req.query.entryFile as string | undefined,
        callbacks: {
          onStdout: (data: string) => {
            sendEvent('stdout', { output: data });
          },
          onStderr: (data: string) => {
            sendEvent('stderr', { output: data });
          },
          onComplete: (result: RunResult) => {
            sendEvent('complete', result);
          },
        },
      });

      if (!res.writableEnded) {
        sendEvent('complete', result);
        res.end();
      }

      req.on('close', () => {
        if (language) {
          stopProject(language).catch(() => {});
        }
      });
    } catch (error) {
      console.error("Error streaming execution:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to stream execution" });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ message: "Execution failed" })}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/run/:projectId/stop', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const projectType = req.body.language 
        ? mapLanguageToProjectType(req.body.language)
        : detectProjectType(project.files);

      await stopProject(projectType);
      
      res.json({ success: true, message: "Project execution stopped" });
    } catch (error) {
      console.error("Error stopping project:", error);
      res.status(500).json({ message: "Failed to stop project" });
    }
  });

  app.get('/api/projects/:id/env', async (req: any, res) => {
    try {
      const envVars = await storage.getProjectEnvVars(req.params.id);
      
      if (envVars === undefined) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(envVars);
    } catch (error) {
      console.error("Error fetching env vars:", error);
      res.status(500).json({ message: "Failed to fetch environment variables" });
    }
  });

  app.post('/api/projects/:id/env', async (req: any, res) => {
    try {
      const { key, value } = req.body;
      
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ message: "Invalid key: must be a non-empty string" });
      }
      
      if (value === undefined || typeof value !== 'string') {
        return res.status(400).json({ message: "Invalid value: must be a string" });
      }

      const envVars = await storage.setProjectEnvVar(req.params.id, key, value);
      
      if (envVars === undefined) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(envVars);
    } catch (error) {
      console.error("Error setting env var:", error);
      res.status(500).json({ message: "Failed to set environment variable" });
    }
  });

  app.delete('/api/projects/:id/env/:key', async (req: any, res) => {
    try {
      const envVars = await storage.deleteProjectEnvVar(req.params.id, req.params.key);
      
      if (envVars === undefined) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(envVars);
    } catch (error) {
      console.error("Error deleting env var:", error);
      res.status(500).json({ message: "Failed to delete environment variable" });
    }
  });

  app.get('/api/projects/:id/git/status', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      await git.syncFilesToRepo(req.params.id, project.files);
      const status = await git.getStatus(req.params.id);
      res.json(status);
    } catch (error) {
      console.error("Error getting git status:", error);
      res.status(500).json({ message: "Failed to get git status" });
    }
  });

  app.post('/api/projects/:id/git/init', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const result = await git.initRepo(req.params.id, project.files);
      res.json(result);
    } catch (error) {
      console.error("Error initializing git repo:", error);
      res.status(500).json({ message: "Failed to initialize git repository" });
    }
  });

  app.post('/api/projects/:id/git/add', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { files } = req.body;
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ message: "Invalid files: must be an array of file paths" });
      }

      await git.syncFilesToRepo(req.params.id, project.files);
      const result = await git.addFiles(req.params.id, files);
      res.json(result);
    } catch (error) {
      console.error("Error staging files:", error);
      res.status(500).json({ message: "Failed to stage files" });
    }
  });

  app.post('/api/projects/:id/git/commit', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Invalid commit message: must be a non-empty string" });
      }

      const result = await git.commit(req.params.id, message);
      res.json(result);
    } catch (error) {
      console.error("Error committing:", error);
      res.status(500).json({ message: "Failed to commit" });
    }
  });

  app.get('/api/projects/:id/git/log', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const log = await git.getLog(req.params.id, limit);
      res.json(log);
    } catch (error) {
      console.error("Error getting git log:", error);
      res.status(500).json({ message: "Failed to get git log" });
    }
  });

  app.get('/api/projects/:id/git/branches', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const branches = await git.getBranches(req.params.id);
      res.json(branches);
    } catch (error) {
      console.error("Error getting branches:", error);
      res.status(500).json({ message: "Failed to get branches" });
    }
  });

  app.post('/api/projects/:id/git/checkout', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { branch } = req.body;
      if (!branch || typeof branch !== 'string') {
        return res.status(400).json({ message: "Invalid branch: must be a non-empty string" });
      }

      const result = await git.checkout(req.params.id, branch);
      res.json(result);
    } catch (error) {
      console.error("Error checking out branch:", error);
      res.status(500).json({ message: "Failed to checkout branch" });
    }
  });

  app.post('/api/projects/:id/git/branch', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Invalid branch name: must be a non-empty string" });
      }

      const result = await git.createBranch(req.params.id, name);
      res.json(result);
    } catch (error) {
      console.error("Error creating branch:", error);
      res.status(500).json({ message: "Failed to create branch" });
    }
  });

  app.delete('/api/projects/:id/git/branch/:branchName', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { branchName } = req.params;
      if (!branchName || typeof branchName !== 'string') {
        return res.status(400).json({ message: "Invalid branch name" });
      }

      const result = await git.deleteBranch(req.params.id, branchName);
      res.json(result);
    } catch (error) {
      console.error("Error deleting branch:", error);
      res.status(500).json({ message: "Failed to delete branch" });
    }
  });

  app.post('/api/projects/:id/git/merge', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { branch } = req.body;
      if (!branch || typeof branch !== 'string') {
        return res.status(400).json({ message: "Invalid branch: must be a non-empty string" });
      }

      const result = await git.mergeBranch(req.params.id, branch);
      res.json(result);
    } catch (error) {
      console.error("Error merging branch:", error);
      res.status(500).json({ message: "Failed to merge branch" });
    }
  });

  app.get('/api/projects/:id/git/stash', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const stashes = await git.stashList(req.params.id);
      res.json(stashes);
    } catch (error) {
      console.error("Error getting stash list:", error);
      res.status(500).json({ message: "Failed to get stash list" });
    }
  });

  app.post('/api/projects/:id/git/stash', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      await git.syncFilesToRepo(req.params.id, project.files);
      const { message } = req.body;
      const result = await git.stashSave(req.params.id, message);
      res.json(result);
    } catch (error) {
      console.error("Error stashing changes:", error);
      res.status(500).json({ message: "Failed to stash changes" });
    }
  });

  app.post('/api/projects/:id/git/stash/pop', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { index } = req.body;
      const result = await git.stashPop(req.params.id, index);
      res.json(result);
    } catch (error) {
      console.error("Error popping stash:", error);
      res.status(500).json({ message: "Failed to pop stash" });
    }
  });

  app.delete('/api/projects/:id/git/stash/:index', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const index = parseInt(req.params.index, 10);
      if (isNaN(index)) {
        return res.status(400).json({ message: "Invalid stash index" });
      }

      const result = await git.stashDrop(req.params.id, index);
      res.json(result);
    } catch (error) {
      console.error("Error dropping stash:", error);
      res.status(500).json({ message: "Failed to drop stash" });
    }
  });

  app.post('/api/projects/:id/git/unstage', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { file } = req.body;
      if (!file || typeof file !== 'string') {
        return res.status(400).json({ message: "Invalid file path" });
      }

      const result = await git.unstageFile(req.params.id, file);
      res.json(result);
    } catch (error) {
      console.error("Error unstaging file:", error);
      res.status(500).json({ message: "Failed to unstage file" });
    }
  });

  app.post('/api/projects/:id/git/reset', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { file } = req.body;
      if (!file || typeof file !== 'string') {
        return res.status(400).json({ message: "Invalid file path" });
      }

      const result = await git.resetFile(req.params.id, file);
      res.json(result);
    } catch (error) {
      console.error("Error resetting file:", error);
      res.status(500).json({ message: "Failed to reset file" });
    }
  });

  app.get('/api/keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const keys = await storage.getApiKeys(userId);
      res.json(keys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.post('/api/keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { provider, name, apiKey } = req.body;
      
      const parsed = insertApiKeySchema.safeParse({ userId, provider, name, apiKey });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid API key data", errors: parsed.error.errors });
      }
      
      const validatedProvider = apiKeyProviderEnum.safeParse(provider);
      if (!validatedProvider.success) {
        return res.status(400).json({ message: "Invalid provider. Must be one of: openai, anthropic, google, custom" });
      }

      const trimmedName = (name || '').trim();
      const trimmedKey = (apiKey || '').trim();
      
      if (!trimmedName || trimmedName.length > 100) {
        return res.status(400).json({ message: "Name must be between 1 and 100 characters" });
      }
      
      if (trimmedKey.length < 10) {
        return res.status(400).json({ message: "API key must be at least 10 characters" });
      }

      const key = await storage.createApiKey(userId, validatedProvider.data, trimmedName, trimmedKey);
      res.status(201).json(key);
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.delete('/api/keys/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const keyId = req.params.id;
      
      const userKeys = await storage.getApiKeys(userId);
      const keyExists = userKeys.some(k => k.id === keyId);
      
      if (!keyExists) {
        return res.status(404).json({ message: "API key not found or not owned by you" });
      }
      
      const deleted = await storage.deleteApiKey(userId, keyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "API key not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  app.post('/api/projects/:id/share', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.enableProjectSharing(req.params.id, userId);
      
      if (!result) {
        return res.status(404).json({ message: "Project not found or not owned by you" });
      }
      
      res.json({ 
        shareToken: result.shareToken,
        shareUrl: `/shared/${result.shareToken}` 
      });
    } catch (error) {
      console.error("Error enabling sharing:", error);
      res.status(500).json({ message: "Failed to enable project sharing" });
    }
  });

  app.delete('/api/projects/:id/share', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await storage.disableProjectSharing(req.params.id, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Project not found or not owned by you" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error disabling sharing:", error);
      res.status(500).json({ message: "Failed to disable project sharing" });
    }
  });

  app.get('/api/shared/:token', async (req: any, res) => {
    try {
      const project = await storage.getProjectByShareToken(req.params.token);
      
      if (!project) {
        return res.status(404).json({ message: "Shared project not found or sharing is disabled" });
      }
      
      res.json({
        id: project.id,
        name: project.name,
        language: project.language,
        files: project.files,
      });
    } catch (error) {
      console.error("Error fetching shared project:", error);
      res.status(500).json({ message: "Failed to fetch shared project" });
    }
  });

  app.get('/api/projects/:id/download', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}.zip"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to create archive" });
        }
      });

      archive.pipe(res);

      const addFilesToArchive = (node: FileNode, currentPath: string) => {
        if (node.type === 'file') {
          archive.append(node.content || '', { name: currentPath });
        } else if (node.type === 'folder' && node.children) {
          for (const child of node.children) {
            const childPath = currentPath ? `${currentPath}/${child.name}` : child.name;
            addFilesToArchive(child, childPath);
          }
        }
      };

      if (project.files.type === 'folder' && project.files.children) {
        for (const child of project.files.children) {
          addFilesToArchive(child, child.name);
        }
      } else {
        addFilesToArchive(project.files, project.files.name);
      }

      await archive.finalize();
    } catch (error) {
      console.error("Error downloading project:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download project" });
      }
    }
  });

  app.post('/api/projects/:id/upload', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { files: uploadedFiles, targetPath } = req.body;
      
      if (!uploadedFiles || !Array.isArray(uploadedFiles)) {
        return res.status(400).json({ message: "Invalid files: must be an array of {name, content, path?} objects" });
      }

      const deepCloneFileNode = (node: FileNode): FileNode => {
        const cloned: FileNode = { type: node.type, name: node.name };
        if (node.content !== undefined) cloned.content = node.content;
        if (node.children) cloned.children = node.children.map(deepCloneFileNode);
        return cloned;
      };

      const addFileToNode = (node: FileNode, pathParts: string[], fileName: string, content: string): void => {
        if (pathParts.length === 0) {
          if (node.type === 'folder') {
            const existingIndex = node.children?.findIndex(c => c.name === fileName);
            const newFile: FileNode = { type: 'file', name: fileName, content };
            
            if (existingIndex !== undefined && existingIndex >= 0 && node.children) {
              node.children[existingIndex] = newFile;
            } else {
              node.children = node.children || [];
              node.children.push(newFile);
            }
          }
          return;
        }

        const [currentPart, ...remainingParts] = pathParts;
        
        if (node.type === 'folder') {
          let targetChild = node.children?.find(c => c.name === currentPart && c.type === 'folder');
          
          if (!targetChild) {
            targetChild = { type: 'folder', name: currentPart, children: [] };
            node.children = node.children || [];
            node.children.push(targetChild);
          }
          
          addFileToNode(targetChild, remainingParts, fileName, content);
        }
      };

      const updatedFiles = deepCloneFileNode(project.files);
      
      for (const file of uploadedFiles) {
        if (!file.name || typeof file.name !== 'string') {
          continue;
        }
        
        const basePath = (targetPath || '').split('/').filter((p: string) => p && p !== 'root');
        const filePath = (file.path || '').split('/').filter((p: string) => p && p !== '.');
        const fullPathParts = [...basePath, ...filePath.slice(0, -1)];
        const fileName = filePath.length > 0 ? filePath[filePath.length - 1] : file.name;
        
        addFileToNode(updatedFiles, fullPathParts, fileName, file.content || '');
      }

      const updated = await storage.updateProject(req.params.id, { files: updatedFiles });
      res.json(updated);
    } catch (error) {
      console.error("Error uploading files:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  app.post('/api/projects/import-zip', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { zipData, projectName, language } = req.body;
      
      if (!zipData || typeof zipData !== 'string') {
        return res.status(400).json({ message: "Missing or invalid ZIP data (expected base64 string)" });
      }
      
      const zipBuffer = Buffer.from(zipData, 'base64');
      const maxZipSize = 50 * 1024 * 1024;
      if (zipBuffer.length > maxZipSize) {
        return res.status(400).json({ message: "ZIP file too large. Maximum size is 50MB." });
      }
      
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      
      const blacklistedExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin'];
      const blacklistedDirs = ['node_modules', '.git', '__pycache__', '.venv', 'venv', 'target', 'dist', 'build'];
      
      const buildFileTree = (): FileNode => {
        const root: FileNode = { type: 'folder', name: 'root', children: [] };
        
        for (const entry of entries) {
          if (entry.isDirectory) continue;
          
          const sanitizedPath = sanitizePath(entry.entryName);
          if (!sanitizedPath) continue;
          
          const parts = sanitizedPath.split('/').filter(p => p);
          if (parts.length === 0) continue;
          
          if (parts.some(part => blacklistedDirs.includes(part))) continue;
          
          const fileName = parts[parts.length - 1];
          const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
          if (blacklistedExtensions.includes(ext)) continue;
          
          let content = '';
          try {
            const buffer = entry.getData();
            if (buffer.length <= 1024 * 1024) {
              content = buffer.toString('utf-8');
            } else {
              content = '[File too large to preview]';
            }
          } catch (err) {
            content = '[Binary or unreadable file]';
          }
          
          let current = root;
          for (let i = 0; i < parts.length - 1; i++) {
            const folderName = parts[i];
            let folder = current.children?.find(c => c.name === folderName && c.type === 'folder');
            if (!folder) {
              folder = { type: 'folder', name: folderName, children: [] };
              current.children = current.children || [];
              current.children.push(folder);
            }
            current = folder;
          }
          
          current.children = current.children || [];
          current.children.push({ type: 'file', name: fileName, content });
        }
        
        return root;
      };
      
      const files = buildFileTree();
      
      const project = await storage.createProject({
        ownerId: userId,
        name: projectName || 'Imported Project',
        language: language || 'javascript',
        files,
      });
      
      res.status(201).json(project);
    } catch (error) {
      console.error("Error importing ZIP:", error);
      res.status(500).json({ message: "Failed to import ZIP file" });
    }
  });

  // AI Handler routes for file operations (like Bolt/Cursor)
  const aiHandler = await import('./ai-handler');

  app.post('/api/ai-handler/create-file', async (req: any, res) => {
    try {
      const { path, content } = req.body;
      if (!path) {
        return res.status(400).json({ error: "Path is required" });
      }
      const result = aiHandler.createFile(path, content || '');
      res.json({ success: true, message: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-handler/edit-file', async (req: any, res) => {
    try {
      const { path, action, content, lineNum } = req.body;
      if (!path || !action) {
        return res.status(400).json({ error: "Path and action are required" });
      }
      const result = aiHandler.editFile(path, action, content || '', lineNum);
      res.json({ success: true, message: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-handler/delete-file', async (req: any, res) => {
    try {
      const { path } = req.body;
      if (!path) {
        return res.status(400).json({ error: "Path is required" });
      }
      const result = aiHandler.deleteFile(path);
      res.json({ success: true, message: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-handler/create-folder', async (req: any, res) => {
    try {
      const { path } = req.body;
      if (!path) {
        return res.status(400).json({ error: "Path is required" });
      }
      const result = aiHandler.createFolder(path);
      res.json({ success: true, message: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-handler/delete-folder', async (req: any, res) => {
    try {
      const { path } = req.body;
      if (!path) {
        return res.status(400).json({ error: "Path is required" });
      }
      const result = aiHandler.deleteFolder(path);
      res.json({ success: true, message: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ai-handler/list-files', async (req: any, res) => {
    try {
      const path = req.query.path || '.';
      const result = aiHandler.listFiles(path);
      res.json({ success: true, files: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai-handler/run-command', async (req: any, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }
      const result = await aiHandler.runCommand(command);
      res.json({ success: true, output: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

function getProjectTypeLabel(projectType: ProjectType): string {
  const labels: Record<ProjectType, string> = {
    [ProjectType.NODEJS]: "Node.js",
    [ProjectType.PYTHON]: "Python",
    [ProjectType.REACT_CRA]: "React (Create React App)",
    [ProjectType.REACT_VITE]: "React (Vite)",
    [ProjectType.NEXTJS]: "Next.js",
    [ProjectType.STATIC_HTML]: "Static HTML",
    [ProjectType.GO]: "Go",
    [ProjectType.JAVA]: "Java",
    [ProjectType.CPP]: "C++",
    [ProjectType.RUST]: "Rust",
  };
  return labels[projectType] || "Unknown";
}
