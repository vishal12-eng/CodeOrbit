import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, type FileNode } from "@shared/schema";
import aiRoutes from "./ai/routes";
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use('/api/ai', aiRoutes);

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

  app.post('/api/run/:projectId', async (req: any, res) => {
    try {
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
        timeout: req.body.timeout,
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
