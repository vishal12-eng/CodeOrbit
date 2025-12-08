import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).default('dark'),
  editorFontSize: z.number().min(10).max(24).default(14),
  autoSave: z.boolean().default(true),
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 512 }),
  role: text("role").notNull().default("user"),
  preferences: jsonb("preferences").$type<UserPreferences>().default({ theme: 'dark', editorFontSize: 14, autoSave: true }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const fileNodeSchema: z.ZodType<FileNode> = z.lazy(() => z.object({
  type: z.enum(['file', 'folder']),
  name: z.string(),
  content: z.string().optional(),
  children: z.array(fileNodeSchema).optional(),
}));

export interface FileNode {
  type: 'file' | 'folder';
  name: string;
  content?: string;
  children?: FileNode[];
}

export type EnvVars = Record<string, string>;

export const projects = pgTable("projects", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id", { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  language: text("language").notNull().default("node-js"),
  files: jsonb("files").$type<FileNode>().notNull(),
  envVars: jsonb("env_vars").$type<EnvVars>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectSchema = z.object({
  ownerId: z.string(),
  name: z.string(),
  language: z.string().default("node-js"),
  files: fileNodeSchema,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const apiKeyProviderEnum = z.enum(['openai', 'anthropic', 'google', 'custom']);
export type ApiKeyProvider = z.infer<typeof apiKeyProviderEnum>;

export const apiKeys = pgTable("api_keys", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  keyPreview: text("key_preview").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApiKeySchema = z.object({
  userId: z.string(),
  provider: apiKeyProviderEnum,
  name: z.string().min(1).max(100),
  apiKey: z.string().min(10),
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export type ApiKeyPublic = Omit<ApiKey, 'encryptedKey'>;
