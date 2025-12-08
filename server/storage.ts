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

  getApiKeys(userId: string): Promise<ApiKeyPublic[]>;
  createApiKey(userId: string, provider: ApiKeyProvider, name: string, apiKey: string): Promise<ApiKeyPublic>;
  deleteApiKey(userId: string, keyId: string): Promise<boolean>;
  getApiKeyDecrypted(userId: string, provider: ApiKeyProvider): Promise<string | null>;

  enableProjectSharing(projectId: string, userId: string): Promise<{ shareToken: string } | null>;
  disableProjectSharing(projectId: string, userId: string): Promise<boolean>;
  getProjectByShareToken(token: string): Promise<Project | undefined>;
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

  private getEncryptionSecret(): string {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('ENCRYPTION_SECRET environment variable must be set with at least 32 characters');
    }
    return secret;
  }

  private encryptKey(apiKey: string): string {
    const algorithm = 'aes-256-cbc';
    const secret = this.getEncryptionSecret();
    const key = crypto.scryptSync(secret, 'novacode-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptKey(encryptedKey: string): string {
    const algorithm = 'aes-256-cbc';
    const secret = this.getEncryptionSecret();
    const key = crypto.scryptSync(secret, 'novacode-salt', 32);
    const [ivHex, encrypted] = encryptedKey.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getKeyPreview(apiKey: string): string {
    if (apiKey.length <= 8) return '****';
    return apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
  }

  async getApiKeys(userId: string): Promise<ApiKeyPublic[]> {
    const keys = await db.select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      provider: apiKeys.provider,
      name: apiKeys.name,
      keyPreview: apiKeys.keyPreview,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).where(eq(apiKeys.userId, userId));
    return keys;
  }

  async createApiKey(userId: string, provider: ApiKeyProvider, name: string, apiKey: string): Promise<ApiKeyPublic> {
    const encryptedKey = this.encryptKey(apiKey);
    const keyPreview = this.getKeyPreview(apiKey);
    
    const [newKey] = await db.insert(apiKeys).values({
      userId,
      provider,
      name,
      keyPreview,
      encryptedKey,
    }).returning({
      id: apiKeys.id,
      userId: apiKeys.userId,
      provider: apiKeys.provider,
      name: apiKeys.name,
      keyPreview: apiKeys.keyPreview,
      createdAt: apiKeys.createdAt,
    });
    return newKey;
  }

  async deleteApiKey(userId: string, keyId: string): Promise<boolean> {
    const result = await db.delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getApiKeyDecrypted(userId: string, provider: ApiKeyProvider): Promise<string | null> {
    const [key] = await db.select({ encryptedKey: apiKeys.encryptedKey })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)));
    
    if (!key) return null;
    return this.decryptKey(key.encryptedKey);
  }

  async enableProjectSharing(projectId: string, userId: string): Promise<{ shareToken: string } | null> {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project || project.ownerId !== userId) return null;
    
    const shareToken = crypto.randomBytes(32).toString('hex');
    
    await db.update(projects)
      .set({ shareToken, shareEnabled: 'true', updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    
    return { shareToken };
  }

  async disableProjectSharing(projectId: string, userId: string): Promise<boolean> {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project || project.ownerId !== userId) return false;
    
    await db.update(projects)
      .set({ shareToken: null, shareEnabled: 'false', updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    
    return true;
  }

  async getProjectByShareToken(token: string): Promise<Project | undefined> {
    const [project] = await db.select()
      .from(projects)
      .where(and(eq(projects.shareToken, token), eq(projects.shareEnabled, 'true')));
    return project;
  }
}

export const storage = new DatabaseStorage();
