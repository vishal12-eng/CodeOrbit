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
