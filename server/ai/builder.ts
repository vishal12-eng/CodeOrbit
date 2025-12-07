import { generateJSONWithModel, generateWithModel, ModelId, ChatMessage, chatWithModel } from "./models";

export interface BuildStep {
  id: string;
  description: string;
  action: "create" | "modify" | "delete";
  files: string[];
  status: "pending" | "in_progress" | "completed" | "failed";
  codeChanges?: {
    filePath: string;
    content: string;
    diff?: string;
  }[];
}

export interface BuildPlan {
  id: string;
  summary: string;
  steps: BuildStep[];
  estimatedTime: string;
  complexity: "low" | "medium" | "high";
}

export interface ProjectFile {
  path: string;
  content: string;
}

export async function generateBuildPlan(
  prompt: string,
  projectContext: string,
  modelId: ModelId = "gpt-4o"
): Promise<BuildPlan> {
  const systemPrompt = `You are an expert software architect and developer. Analyze the user's request and create a detailed, step-by-step build plan.

Current project structure and context:
${projectContext || "Empty project"}

Create a comprehensive build plan that breaks down the task into actionable steps. Each step should be atomic and clearly defined.

Respond with a JSON object in this exact format:
{
  "id": "plan-<timestamp>",
  "summary": "Brief overall summary of what will be built",
  "steps": [
    {
      "id": "step-1",
      "description": "Clear description of what this step accomplishes",
      "action": "create" | "modify" | "delete",
      "files": ["path/to/file1.ts", "path/to/file2.ts"],
      "status": "pending"
    }
  ],
  "estimatedTime": "5-10 minutes",
  "complexity": "low" | "medium" | "high"
}

Guidelines:
- Break complex tasks into 3-8 manageable steps
- Each step should modify at most 2-3 files
- Order steps logically (dependencies first, then features)
- Include file paths that follow the project structure
- Be specific about what each step accomplishes`;

  const plan = await generateJSONWithModel(prompt, systemPrompt, modelId);
  
  if (!plan.id) {
    plan.id = `plan-${Date.now()}`;
  }
  
  plan.steps = (plan.steps || []).map((step: any, index: number) => ({
    id: step.id || `step-${index + 1}`,
    description: step.description || "Step description",
    action: step.action || "modify",
    files: step.files || [],
    status: "pending",
    codeChanges: undefined,
  }));

  return plan as BuildPlan;
}

export async function executeBuildStep(
  step: BuildStep,
  projectFiles: ProjectFile[],
  buildContext: string,
  modelId: ModelId = "gpt-4o"
): Promise<BuildStep> {
  const existingFiles = projectFiles
    .filter(f => step.files.includes(f.path))
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const systemPrompt = `You are an expert developer executing a build step. Generate the exact code changes needed for this step.

Build Context:
${buildContext}

Existing files relevant to this step:
${existingFiles || "No existing files for this step"}

Step to execute:
- Action: ${step.action}
- Description: ${step.description}
- Files: ${step.files.join(", ")}

Respond with a JSON object containing the code changes:
{
  "codeChanges": [
    {
      "filePath": "path/to/file.ts",
      "content": "// Complete file content here",
      "diff": "Brief description of what changed"
    }
  ],
  "notes": "Any important notes about this step"
}

Guidelines:
- Generate complete, working code
- Follow best practices for the language/framework
- Include necessary imports
- Add appropriate comments
- For "modify" actions, show the complete updated file
- For "create" actions, generate the full new file
- For "delete" actions, set content to null`;

  const result = await generateJSONWithModel(
    `Execute step: ${step.description}`,
    systemPrompt,
    modelId
  );

  return {
    ...step,
    status: "completed",
    codeChanges: result.codeChanges || [],
  };
}

export async function executeBuildPlan(
  plan: BuildPlan,
  projectFiles: ProjectFile[],
  modelId: ModelId = "gpt-4o",
  onStepComplete?: (step: BuildStep, index: number) => void
): Promise<BuildPlan> {
  const updatedSteps: BuildStep[] = [];
  let currentFiles = [...projectFiles];
  
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    
    try {
      const executedStep = await executeBuildStep(
        { ...step, status: "in_progress" },
        currentFiles,
        plan.summary,
        modelId
      );
      
      if (executedStep.codeChanges) {
        for (const change of executedStep.codeChanges) {
          const existingIndex = currentFiles.findIndex(f => f.path === change.filePath);
          if (existingIndex >= 0) {
            if (change.content === null) {
              currentFiles.splice(existingIndex, 1);
            } else {
              currentFiles[existingIndex].content = change.content;
            }
          } else if (change.content !== null) {
            currentFiles.push({ path: change.filePath, content: change.content });
          }
        }
      }
      
      updatedSteps.push(executedStep);
      
      if (onStepComplete) {
        onStepComplete(executedStep, i);
      }
    } catch (error: any) {
      updatedSteps.push({
        ...step,
        status: "failed",
        codeChanges: [{
          filePath: "error.log",
          content: `Error: ${error.message}`,
          diff: "Step failed",
        }],
      });
    }
  }

  return {
    ...plan,
    steps: updatedSteps,
  };
}

export async function generateCodeEdit(
  instruction: string,
  code: string,
  language: string,
  context: string = "",
  modelId: ModelId = "gpt-4o"
): Promise<{ editedCode: string; diff: string; explanation: string }> {
  const systemPrompt = `You are an expert code editor. Modify the provided ${language} code according to the instruction.

${context ? `Project context:\n${context}\n` : ""}

Respond with a JSON object:
{
  "editedCode": "// The complete modified code",
  "diff": "Brief summary of changes made",
  "explanation": "Explanation of what was changed and why"
}

Guidelines:
- Maintain the existing code style
- Only make changes necessary for the instruction
- Preserve imports and structure unless specifically asked to change
- Add comments for complex changes`;

  const result = await generateJSONWithModel(
    `Instruction: ${instruction}\n\nCode to modify:\n\`\`\`${language}\n${code}\n\`\`\``,
    systemPrompt,
    modelId
  );

  return {
    editedCode: result.editedCode || code,
    diff: result.diff || "No changes made",
    explanation: result.explanation || "",
  };
}

export async function analyzeCodeForRefactoring(
  code: string,
  language: string,
  modelId: ModelId = "gpt-4o"
): Promise<{
  suggestions: { description: string; severity: "info" | "warning" | "error" }[];
  refactoredCode: string;
}> {
  const systemPrompt = `You are a code quality expert. Analyze the provided ${language} code and suggest improvements.

Respond with a JSON object:
{
  "suggestions": [
    {
      "description": "Description of the issue or improvement",
      "severity": "info" | "warning" | "error"
    }
  ],
  "refactoredCode": "// The improved code with all suggestions applied"
}

Focus on:
- Code clarity and readability
- Performance optimizations
- Best practices for ${language}
- Security concerns
- Error handling`;

  const result = await generateJSONWithModel(
    `Analyze and refactor:\n\`\`\`${language}\n${code}\n\`\`\``,
    systemPrompt,
    modelId
  );

  return {
    suggestions: result.suggestions || [],
    refactoredCode: result.refactoredCode || code,
  };
}
