import {
  users,
  projects,
  apiKeys,
  type User,
  type UpsertUser,
  type Project,
  type InsertProject,
  type FileNode,
  type EnvVars,
  type ApiKey,
  type ApiKeyPublic,
  type ApiKeyProvider,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByOwner(ownerId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<{ name: string; files: FileNode }>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  getProjectEnvVars(projectId: string): Promise<EnvVars | undefined>;
  setProjectEnvVar(projectId: string, key: string, value: string): Promise<EnvVars | undefined>;
  deleteProjectEnvVar(projectId: string, key: string): Promise<EnvVars | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectsByOwner(ownerId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, ownerId))
      .orderBy(desc(projects.updatedAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, updates: Partial<{ name: string; files: FileNode }>): Promise<Project | undefined> {
    const [updated] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  async getProjectEnvVars(projectId: string): Promise<EnvVars | undefined> {
    const [project] = await db.select({ envVars: projects.envVars }).from(projects).where(eq(projects.id, projectId));
    return project?.envVars ?? {};
  }

  async setProjectEnvVar(projectId: string, key: string, value: string): Promise<EnvVars | undefined> {
    const [project] = await db.select({ envVars: projects.envVars }).from(projects).where(eq(projects.id, projectId));
    if (!project) return undefined;

    const currentEnvVars = project.envVars ?? {};
    const updatedEnvVars = { ...currentEnvVars, [key]: value };

    const [updated] = await db
      .update(projects)
      .set({ envVars: updatedEnvVars, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning({ envVars: projects.envVars });
    
    return updated?.envVars ?? undefined;
  }

  async deleteProjectEnvVar(projectId: string, key: string): Promise<EnvVars | undefined> {
    const [project] = await db.select({ envVars: projects.envVars }).from(projects).where(eq(projects.id, projectId));
    if (!project) return undefined;

    const currentEnvVars = project.envVars ?? {};
    const { [key]: _, ...updatedEnvVars } = currentEnvVars;

    const [updated] = await db
      .update(projects)
      .set({ envVars: updatedEnvVars, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning({ envVars: projects.envVars });
    
    return updated?.envVars ?? undefined;
  }
}

export const storage = new DatabaseStorage();
