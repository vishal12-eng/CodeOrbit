export interface User {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  editorFontSize: number;
  autoSave: boolean;
}

export interface FileNode {
  type: 'file' | 'folder';
  name: string;
  content?: string;
  children?: FileNode[];
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  language: 'node-js';
  files: FileNode;
}

export interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTime?: number;
}

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}
