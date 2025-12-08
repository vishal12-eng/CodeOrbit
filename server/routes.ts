import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, type FileNode } from "@shared/schema";
import aiRoutes from "./ai/routes";
import { 
  runProject, 
  stopProject,
  detectProjectType, 
  mapLanguageToProjectType,
  ProjectType,
  type RunResult 
} from "./runners";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use('/api/ai', aiRoutes);

  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const user = { id: "demo-user", email: "demo@example.com", firstName: "Demo", lastName: "User" };
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get('/api/projects', async (req: any, res) => {
    try {
      const userId = "demo-user";
      const projects = await storage.getProjectsByOwner(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post('/api/projects', async (req: any, res) => {
    try {
      const userId = "demo-user";
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

  app.post('/api/projects/:id/duplicate', async (req: any, res) => {
    try {
      const userId = "demo-user";
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
