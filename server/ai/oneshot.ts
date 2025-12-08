import { generateJSONWithModel, generateWithModel, ModelId } from "./models";
import { FileNode } from "../../shared/schema";

export type ProjectType = "react" | "nextjs" | "nodejs" | "python" | "static" | "go" | "java" | "cpp" | "rust";

export interface ProjectTemplate {
  type: ProjectType;
  name: string;
  description: string;
  defaultFiles: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    type: "react",
    name: "React App",
    description: "Modern React application with Vite",
    defaultFiles: ["index.html", "src/main.tsx", "src/App.tsx", "src/index.css", "package.json", "vite.config.ts", "tsconfig.json"],
  },
  {
    type: "nextjs",
    name: "Next.js App",
    description: "Full-stack Next.js application",
    defaultFiles: ["app/page.tsx", "app/layout.tsx", "app/globals.css", "package.json", "next.config.js", "tsconfig.json", "tailwind.config.ts"],
  },
  {
    type: "nodejs",
    name: "Node.js API",
    description: "Express.js REST API with TypeScript",
    defaultFiles: ["src/index.ts", "src/routes.ts", "package.json", "tsconfig.json"],
  },
  {
    type: "python",
    name: "Python App",
    description: "Python application with Flask",
    defaultFiles: ["app.py", "requirements.txt", "templates/index.html"],
  },
  {
    type: "static",
    name: "Static Website",
    description: "Simple HTML/CSS/JS website",
    defaultFiles: ["index.html", "styles.css", "script.js"],
  },
  {
    type: "go",
    name: "Go App",
    description: "Go application with modules",
    defaultFiles: ["main.go", "go.mod"],
  },
  {
    type: "java",
    name: "Java App",
    description: "Java application with Maven",
    defaultFiles: ["Main.java", "pom.xml"],
  },
  {
    type: "cpp",
    name: "C++ App",
    description: "C++ application with Makefile",
    defaultFiles: ["main.cpp", "Makefile"],
  },
  {
    type: "rust",
    name: "Rust App",
    description: "Rust application with Cargo",
    defaultFiles: ["src/main.rs", "Cargo.toml"],
  },
];

export interface GeneratedApp {
  name: string;
  type: ProjectType;
  description: string;
  files: FileNode;
  setupInstructions: string[];
}

function createFileNodeFromFlat(files: { path: string; content: string }[]): FileNode {
  const root: FileNode = { type: "folder", name: "root", children: [] };
  
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      let folder = current.children?.find(c => c.type === "folder" && c.name === folderName);
      
      if (!folder) {
        folder = { type: "folder", name: folderName, children: [] };
        if (!current.children) current.children = [];
        current.children.push(folder);
      }
      current = folder;
    }
    
    const fileName = parts[parts.length - 1];
    if (!current.children) current.children = [];
    current.children.push({
      type: "file",
      name: fileName,
      content: file.content,
    });
  }
  
  return root;
}

export async function generateFullApp(
  prompt: string,
  projectType: ProjectType,
  modelId: ModelId = "gpt-4o"
): Promise<GeneratedApp> {
  const template = PROJECT_TEMPLATES.find(t => t.type === projectType) || PROJECT_TEMPLATES[0];
  
  const systemPrompt = `You are an expert full-stack developer. Generate a complete, production-ready ${template.name} application based on the user's requirements.

Project Type: ${template.name}
Description: ${template.description}
Expected Files: ${template.defaultFiles.join(", ")}

Generate a complete application with all necessary files. Each file should contain production-ready code.

Respond with a JSON object:
{
  "name": "project-name",
  "description": "Brief description of the app",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "// Complete file content"
    }
  ],
  "setupInstructions": [
    "npm install",
    "npm run dev"
  ]
}

Guidelines for ${projectType}:
${getProjectGuidelines(projectType)}

Important:
- Generate complete, working code - no placeholders
- Include all necessary configuration files
- Add proper styling (use Tailwind CSS for React/Next.js)
- Include proper TypeScript types where applicable
- Follow best practices for the framework
- Make the app functional and visually appealing`;

  const result = await generateJSONWithModel(prompt, systemPrompt, modelId);
  
  const files = (result.files || []).map((f: any) => ({
    path: f.path,
    content: f.content || "",
  }));

  return {
    name: result.name || "generated-app",
    type: projectType,
    description: result.description || prompt,
    files: createFileNodeFromFlat(files),
    setupInstructions: result.setupInstructions || getDefaultSetupInstructions(projectType),
  };
}

function getProjectGuidelines(type: ProjectType): string {
  switch (type) {
    case "react":
      return `- Use Vite as the build tool
- Use React 18+ with functional components and hooks
- Use TypeScript for type safety
- Include Tailwind CSS for styling
- Structure: src/components/, src/hooks/, src/lib/
- Include a responsive, modern UI design`;
    
    case "nextjs":
      return `- Use Next.js 14+ with App Router
- Use TypeScript for type safety
- Include Tailwind CSS for styling
- Structure: app/, components/, lib/
- Use Server Components where appropriate
- Include proper metadata and SEO`;
    
    case "nodejs":
      return `- Use Express.js with TypeScript
- Include proper error handling
- Structure: src/routes/, src/controllers/, src/middleware/
- Include CORS and JSON body parsing
- Add basic API documentation
- Use async/await for async operations`;
    
    case "python":
      return `- Use Flask as the web framework
- Include Jinja2 templates if needed
- Structure: app.py, templates/, static/
- Include proper error handling
- Add requirements.txt with all dependencies
- Use Python 3.9+ features`;
    
    case "static":
      return `- Use semantic HTML5
- Include responsive CSS with modern techniques
- Add JavaScript for interactivity
- Make it mobile-friendly
- Include proper meta tags
- Use CSS variables for theming`;
    
    case "go":
      return `- Use Go 1.21+ with modules
- Entry file must be main.go with package main
- Include go.mod with module name
- Use standard library where possible
- Include proper error handling
- Follow Go idioms and conventions
- Use goroutines for concurrency if needed`;
    
    case "java":
      return `- Entry file must be Main.java with public class Main
- Include pom.xml for Maven build
- Use Java 17+ features
- Include proper package structure
- Add proper exception handling
- Follow Java naming conventions`;
    
    case "cpp":
      return `- Entry file must be main.cpp with int main()
- Include Makefile for building
- Use C++17 or later features
- Include proper header guards
- Use modern C++ practices (smart pointers, RAII)
- Add proper error handling`;
    
    case "rust":
      return `- Use Cargo for project management
- Entry file is src/main.rs with fn main()
- Include Cargo.toml with package info
- Use Rust 2021 edition
- Follow Rust idioms (Result, Option)
- Use proper error handling with Result types`;
    
    default:
      return "";
  }
}

function getDefaultSetupInstructions(type: ProjectType): string[] {
  switch (type) {
    case "react":
      return ["npm install", "npm run dev"];
    case "nextjs":
      return ["npm install", "npm run dev"];
    case "nodejs":
      return ["npm install", "npm run dev"];
    case "python":
      return ["pip install -r requirements.txt", "python app.py"];
    case "static":
      return ["Open index.html in a browser"];
    case "go":
      return ["go run main.go"];
    case "java":
      return ["javac Main.java", "java Main"];
    case "cpp":
      return ["make", "./app"];
    case "rust":
      return ["cargo run"];
    default:
      return [];
  }
}

export async function generateAppFromImage(
  imageBase64: string,
  additionalPrompt: string,
  projectType: ProjectType,
  modelId: ModelId = "gpt-4o"
): Promise<GeneratedApp> {
  const prompt = `Analyze the provided image/screenshot and create a complete ${projectType} application that replicates or is inspired by the design.

Additional requirements: ${additionalPrompt || "None"}

The image shows a UI design that should be implemented as a functional application.`;

  return generateFullApp(prompt, projectType, modelId);
}

export async function enhanceExistingApp(
  existingFiles: { path: string; content: string }[],
  enhancement: string,
  modelId: ModelId = "gpt-4o"
): Promise<{ updatedFiles: { path: string; content: string }[]; newFiles: { path: string; content: string }[] }> {
  const filesContext = existingFiles
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const systemPrompt = `You are an expert developer enhancing an existing application.

Current project files:
${filesContext}

Analyze the existing code and implement the requested enhancement while maintaining consistency with the existing codebase.

Respond with a JSON object:
{
  "updatedFiles": [
    { "path": "existing/file.ts", "content": "// Updated content" }
  ],
  "newFiles": [
    { "path": "new/file.ts", "content": "// New file content" }
  ],
  "explanation": "What was changed and why"
}

Guidelines:
- Maintain existing code style and patterns
- Only modify files that need changes
- Create new files only when necessary
- Ensure all imports are correct
- Test compatibility with existing code`;

  const result = await generateJSONWithModel(enhancement, systemPrompt, modelId);

  return {
    updatedFiles: result.updatedFiles || [],
    newFiles: result.newFiles || [],
  };
}

export async function generateComponentLibrary(
  components: string[],
  projectType: ProjectType,
  modelId: ModelId = "gpt-4o"
): Promise<{ path: string; content: string }[]> {
  const systemPrompt = `You are an expert UI developer. Generate a library of reusable components.

Project Type: ${projectType}
Components to generate: ${components.join(", ")}

For each component, generate:
1. The component code with full TypeScript types
2. Proper styling using Tailwind CSS
3. Accessibility features
4. Comprehensive props interface

Respond with a JSON object:
{
  "components": [
    {
      "path": "components/ComponentName.tsx",
      "content": "// Full component code"
    }
  ]
}`;

  const result = await generateJSONWithModel(
    `Generate these components: ${components.join(", ")}`,
    systemPrompt,
    modelId
  );

  return result.components || [];
}
