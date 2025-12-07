import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, type FileNode } from "@shared/schema";
import { spawn } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import aiRoutes from "./ai/routes";

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

  app.post('/api/run/:projectId', async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const tmpDir = await mkdtemp(path.join(tmpdir(), 'codeorbit-'));
      
      const writeFiles = async (node: FileNode, basePath: string) => {
        if (node.type === 'file' && node.content !== undefined) {
          await writeFile(path.join(basePath, node.name), node.content);
        } else if (node.type === 'folder' && node.children) {
          const { mkdir } = await import('fs/promises');
          const folderPath = path.join(basePath, node.name);
          await mkdir(folderPath, { recursive: true });
          for (const child of node.children) {
            await writeFiles(child, folderPath);
          }
        }
      };

      if (project.files.type === 'folder' && project.files.children) {
        for (const child of project.files.children) {
          await writeFiles(child, tmpDir);
        }
      }

      const startTime = Date.now();
      
      const result = await new Promise<{ success: boolean; stdout: string; stderr: string }>((resolve) => {
        const mainFile = path.join(tmpDir, 'main.js');
        const child = spawn('node', [mainFile], {
          cwd: tmpDir,
          timeout: 10000,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          resolve({
            success: code === 0,
            stdout,
            stderr,
          });
        });

        child.on('error', (err) => {
          resolve({
            success: false,
            stdout: '',
            stderr: err.message,
          });
        });
      });

      const executionTime = Date.now() - startTime;

      await rm(tmpDir, { recursive: true, force: true });

      res.json({
        ...result,
        executionTime,
      });
    } catch (error) {
      console.error("Error running code:", error);
      res.status(500).json({ message: "Failed to run code" });
    }
  });

  return httpServer;
}
