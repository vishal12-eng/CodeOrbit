import { z } from "zod";

export const fileActionTypeSchema = z.enum([
  "read",
  "write",
  "edit",
  "delete",
  "create",
  "build",
  "run",
  "install",
  "test",
]);

export type FileActionType = z.infer<typeof fileActionTypeSchema>;

export interface FileAction {
  type: FileActionType;
  file: string;
  description?: string;
  timestamp?: Date;
}

export interface AIResponseSection {
  id: string;
  title: string;
  content: string;
  type: "goal" | "analysis" | "plan" | "actions" | "implementation" | "qa" | "result" | "usage" | "text";
  order: number;
}

export interface StructuredAIResponse {
  id: string;
  sections: AIResponseSection[];
  actions: FileAction[];
  metadata: {
    model: string;
    timestamp: Date;
    totalTokens?: number;
    processingTime?: number;
  };
  rawContent: string;
}

export interface AIStreamChunk {
  type: "section" | "action" | "text" | "complete" | "error";
  data: Partial<AIResponseSection> | FileAction | string | StructuredAIResponse;
  timestamp: number;
}

export const sectionTitles: Record<AIResponseSection["type"], string> = {
  goal: "Goal",
  analysis: "Analysis",
  plan: "Plan",
  actions: "Actions Taken",
  implementation: "Implementation Details",
  qa: "Quality Assurance",
  result: "Final Result",
  usage: "How to Validate",
  text: "",
};

export const sectionIcons: Record<AIResponseSection["type"], string> = {
  goal: "target",
  analysis: "search",
  plan: "list-todo",
  actions: "folder-check",
  implementation: "code",
  qa: "shield-check",
  result: "sparkles",
  usage: "lightbulb",
  text: "message-square",
};

export const actionTypeColors: Record<FileActionType, { bg: string; text: string; icon: string }> = {
  read: { bg: "bg-purple-500/10", text: "text-purple-500", icon: "eye" },
  write: { bg: "bg-orange-500/10", text: "text-orange-500", icon: "pencil" },
  edit: { bg: "bg-orange-500/10", text: "text-orange-500", icon: "edit-3" },
  create: { bg: "bg-blue-500/10", text: "text-blue-500", icon: "plus" },
  delete: { bg: "bg-red-500/10", text: "text-red-500", icon: "trash-2" },
  build: { bg: "bg-yellow-500/10", text: "text-yellow-500", icon: "hammer" },
  run: { bg: "bg-green-500/10", text: "text-green-500", icon: "play" },
  install: { bg: "bg-cyan-500/10", text: "text-cyan-500", icon: "download" },
  test: { bg: "bg-indigo-500/10", text: "text-indigo-500", icon: "flask-conical" },
};

export function parseActionFromText(text: string): FileAction | null {
  const patterns = [
    { regex: /(?:read|reading|analyzed?)\s+[`'""]?([^`'""]+)[`'""]?/i, type: "read" as const },
    { regex: /(?:edit(?:ed|ing)?|modif(?:y|ied|ying)|updat(?:e|ed|ing))\s+[`'""]?([^`'""]+)[`'""]?/i, type: "edit" as const },
    { regex: /(?:writ(?:e|ing|ten)|wrote)\s+[`'""]?([^`'""]+)[`'""]?/i, type: "write" as const },
    { regex: /(?:creat(?:e|ed|ing)|add(?:ed|ing)?|new)\s+[`'""]?([^`'""]+\.[a-z]+)[`'""]?/i, type: "create" as const },
    { regex: /(?:delet(?:e|ed|ing)|remov(?:e|ed|ing))\s+[`'""]?([^`'""]+)[`'""]?/i, type: "delete" as const },
    { regex: /(?:build(?:ing)?|built|compil(?:e|ed|ing))/i, type: "build" as const },
    { regex: /(?:run(?:ning)?|execut(?:e|ed|ing)|start(?:ed|ing)?)/i, type: "run" as const },
    { regex: /(?:install(?:ed|ing)?|npm\s+install|yarn\s+add)/i, type: "install" as const },
    { regex: /(?:test(?:ed|ing)?)/i, type: "test" as const },
  ];

  for (const { regex, type } of patterns) {
    const match = text.match(regex);
    if (match) {
      return {
        type,
        file: match[1] || type,
        description: text.trim(),
        timestamp: new Date(),
      };
    }
  }

  return null;
}

export function extractActionsFromContent(content: string): FileAction[] {
  const actions: FileAction[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const action = parseActionFromText(line);
    if (action && action.file.includes(".") || action?.type === "build" || action?.type === "run") {
      actions.push(action);
    }
  }

  return actions;
}
