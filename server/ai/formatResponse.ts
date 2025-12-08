import type { 
  StructuredAIResponse, 
  AIResponseSection, 
  FileAction, 
  FileActionType 
} from "@shared/aiSchema";

interface SectionMatch {
  type: AIResponseSection["type"];
  patterns: RegExp[];
}

const sectionPatterns: SectionMatch[] = [
  { type: "goal", patterns: [/^#+\s*(?:1\.\s*)?goal/i, /^goal:/i, /^\*\*goal\*\*/i] },
  { type: "analysis", patterns: [/^#+\s*analysis/i, /^analysis:/i, /^\*\*analysis\*\*/i] },
  { type: "plan", patterns: [/^#+\s*(?:2\.\s*)?plan/i, /^plan:/i, /^\*\*plan\*\*/i] },
  { type: "actions", patterns: [/^#+\s*(?:3\.\s*)?actions?\s*taken/i, /^actions?:/i, /^\*\*actions?\s*taken\*\*/i] },
  { type: "implementation", patterns: [/^#+\s*(?:4\.\s*)?implementation/i, /^implementation:/i, /^\*\*implementation/i] },
  { type: "qa", patterns: [/^#+\s*quality\s*assurance/i, /^qa:/i, /^\*\*quality/i] },
  { type: "result", patterns: [/^#+\s*(?:final\s*)?result/i, /^result:/i, /^\*\*result\*\*/i] },
  { type: "usage", patterns: [/^#+\s*(?:how\s*to\s*)?validat/i, /^usage:/i, /^\*\*how\s*to/i] },
];

const actionPatterns: { pattern: RegExp; type: FileActionType }[] = [
  { pattern: /(?:read|reading|analyzed?)\s+[`'""]?([^\s`'""]+\.[a-z]+)[`'""]?/gi, type: "read" },
  { pattern: /(?:edit(?:ed|ing)?|modif(?:y|ied|ying)|updat(?:e|ed|ing))\s+[`'""]?([^\s`'""]+\.[a-z]+)[`'""]?/gi, type: "edit" },
  { pattern: /(?:writ(?:e|ing|ten)|wrote)\s+[`'""]?([^\s`'""]+\.[a-z]+)[`'""]?/gi, type: "write" },
  { pattern: /(?:creat(?:e|ed|ing)|add(?:ed|ing)?)\s+[`'""]?([^\s`'""]+\.[a-z]+)[`'""]?/gi, type: "create" },
  { pattern: /(?:delet(?:e|ed|ing)|remov(?:e|ed|ing))\s+[`'""]?([^\s`'""]+\.[a-z]+)[`'""]?/gi, type: "delete" },
  { pattern: /(?:build(?:ing)?|built|compil(?:e|ed|ing))\s*(?:project|successfully)?/gi, type: "build" },
  { pattern: /(?:run(?:ning)?|execut(?:e|ed|ing)|start(?:ed|ing)?)\s+(?:the\s+)?(?:project|server|app)/gi, type: "run" },
  { pattern: /(?:npm\s+install|yarn\s+add|install(?:ed|ing)?)\s+([^\s]+)/gi, type: "install" },
  { pattern: /(?:test(?:ed|ing)?)\s+([^\s]+)/gi, type: "test" },
];

function detectSectionType(line: string): AIResponseSection["type"] | null {
  for (const { type, patterns } of sectionPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        return type;
      }
    }
  }
  return null;
}

function extractFileActions(content: string): FileAction[] {
  const actions: FileAction[] = [];
  const seenFiles = new Set<string>();

  for (const { pattern, type } of actionPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(content)) !== null) {
      const file = match[1] || type;
      const key = `${type}:${file}`;
      
      if (!seenFiles.has(key)) {
        seenFiles.add(key);
        actions.push({
          type,
          file,
          description: match[0].trim(),
          timestamp: new Date(),
        });
      }
    }
  }

  return actions;
}

export function formatAIResponse(
  rawContent: string,
  model: string
): StructuredAIResponse {
  const lines = rawContent.split("\n");
  const sections: AIResponseSection[] = [];
  const actions: FileAction[] = [];
  
  let currentSection: { type: AIResponseSection["type"]; content: string[]; title: string } | null = null;
  let sectionOrder = 0;
  let hasStructuredContent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    const sectionType = detectSectionType(trimmedLine);
    
    if (sectionType) {
      hasStructuredContent = true;
      
      if (currentSection) {
        sections.push({
          id: `section-${sectionOrder}`,
          type: currentSection.type,
          title: currentSection.title,
          content: currentSection.content.join("\n").trim(),
          order: sectionOrder,
        });
        sectionOrder++;
      }
      
      const titleMatch = trimmedLine.match(/^#+\s*(?:\d+\.\s*)?(.+)$/i) || 
                         trimmedLine.match(/^\*\*(.+)\*\*$/i) ||
                         trimmedLine.match(/^(.+):$/i);
      
      currentSection = {
        type: sectionType,
        title: titleMatch ? titleMatch[1].trim() : sectionType,
        content: [],
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      id: `section-${sectionOrder}`,
      type: currentSection.type,
      title: currentSection.title,
      content: currentSection.content.join("\n").trim(),
      order: sectionOrder,
    });
  }

  if (!hasStructuredContent) {
    sections.push({
      id: "section-0",
      type: "text",
      title: "",
      content: rawContent,
      order: 0,
    });
  }

  const extractedActions = extractFileActions(rawContent);
  actions.push(...extractedActions);

  return {
    id: `response-${Date.now()}`,
    sections,
    actions,
    metadata: {
      model,
      timestamp: new Date(),
    },
    rawContent,
  };
}

export function streamFormatChunk(
  chunk: string,
  accumulatedContent: string,
  model: string
): { 
  formattedChunk: string; 
  newActions: FileAction[]; 
  detectedSection?: AIResponseSection["type"] 
} {
  const fullContent = accumulatedContent + chunk;
  const lines = fullContent.split("\n");
  const lastLine = lines[lines.length - 1] || "";
  
  const newActions = extractFileActions(chunk);
  const detectedSection = detectSectionType(lastLine) || undefined;

  return {
    formattedChunk: chunk,
    newActions,
    detectedSection,
  };
}

export function createStreamingResponse(content: string, model: string) {
  const response = formatAIResponse(content, model);
  return {
    ...response,
    isStreaming: false,
    isComplete: true,
  };
}
