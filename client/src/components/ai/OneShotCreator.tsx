import { useState } from "react";
import {
  Sparkles,
  X,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Loader2,
  Download,
  Eye,
  Bot,
  Code,
  Globe,
  Server,
  FileCode,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

type ProjectType = "react" | "nextjs" | "nodejs" | "python" | "static";
type ModelId = "gpt-4o" | "gpt-4o-mini" | "claude-3-5-sonnet" | "gemini-1.5-pro";

interface FileNode {
  type: "file" | "folder";
  name: string;
  content?: string;
  children?: FileNode[];
}

interface GeneratedApp {
  name: string;
  type: ProjectType;
  description: string;
  files: FileNode;
  setupInstructions: string[];
}

interface OneShotCreatorProps {
  onCreateProject?: (files: { path: string; content: string }[]) => void;
  onClose?: () => void;
}

const projectTemplates = [
  {
    type: "react" as ProjectType,
    name: "React App",
    description: "Modern React with Vite and TypeScript",
    icon: Code,
    color: "text-cyan-500",
  },
  {
    type: "nextjs" as ProjectType,
    name: "Next.js App",
    description: "Full-stack Next.js with App Router",
    icon: Globe,
    color: "text-white",
  },
  {
    type: "nodejs" as ProjectType,
    name: "Node.js API",
    description: "Express.js REST API with TypeScript",
    icon: Server,
    color: "text-green-500",
  },
  {
    type: "python" as ProjectType,
    name: "Python App",
    description: "Flask web application",
    icon: FileCode,
    color: "text-yellow-500",
  },
  {
    type: "static" as ProjectType,
    name: "Static Website",
    description: "Simple HTML/CSS/JS website",
    icon: Globe,
    color: "text-orange-500",
  },
];

const modelOptions = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
];

function flattenFileNode(node: FileNode, path: string = ""): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  
  if (node.type === "file" && node.content !== undefined) {
    files.push({ path: path + node.name, content: node.content });
  } else if (node.type === "folder" && node.children) {
    const folderPath = path ? path + node.name + "/" : "";
    for (const child of node.children) {
      files.push(...flattenFileNode(child, folderPath));
    }
  }
  
  return files;
}

function FileTreeNode({ node, path = "", onSelectFile }: { 
  node: FileNode; 
  path?: string;
  onSelectFile?: (path: string, content: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const fullPath = path ? `${path}/${node.name}` : node.name;

  if (node.type === "file") {
    return (
      <button
        onClick={() => onSelectFile?.(fullPath, node.content || "")}
        className="flex items-center gap-2 py-1 px-2 w-full text-left hover-elevate rounded text-sm"
      >
        <File className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 py-1 px-2 w-full text-left hover-elevate rounded text-sm font-medium"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Folder className="h-3.5 w-3.5 text-amber-500" />
        <span>{node.name}</span>
      </button>
      {isExpanded && node.children && (
        <div className="ml-4 border-l pl-2">
          {node.children.map((child, i) => (
            <FileTreeNode key={i} node={child} path={fullPath} onSelectFile={onSelectFile} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OneShotCreator({ onCreateProject, onClose }: OneShotCreatorProps) {
  const [step, setStep] = useState<"input" | "generating" | "preview">("input");
  const [prompt, setPrompt] = useState("");
  const [selectedType, setSelectedType] = useState<ProjectType>("react");
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4o");
  const [generatedApp, setGeneratedApp] = useState<GeneratedApp | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [progress, setProgress] = useState(0);

  const generateApp = async () => {
    if (!prompt.trim()) return;

    setStep("generating");
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 15, 90));
    }, 500);

    try {
      const response = await apiRequest("POST", "/api/ai/oneshot", {
        prompt,
        projectType: selectedType,
        model: selectedModel,
      });
      const app = await response.json();
      setGeneratedApp(app);
      setProgress(100);
      setTimeout(() => setStep("preview"), 500);
    } catch (error: any) {
      console.error("Failed to generate app:", error);
      setStep("input");
    } finally {
      clearInterval(progressInterval);
    }
  };

  const handleCreateProject = () => {
    if (!generatedApp || !onCreateProject) return;

    const files = flattenFileNode(generatedApp.files);
    onCreateProject(files);
  };

  const selectedTemplate = projectTemplates.find((t) => t.type === selectedType);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">One-Shot App Creator</h1>
            <p className="text-xs text-muted-foreground">Generate a complete app from a single prompt</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelId)}>
            <SelectTrigger className="w-44 h-9" data-testid="select-oneshot-model">
              <Bot className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-oneshot">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {step === "input" && (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="max-w-3xl w-full space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">What would you like to build?</h2>
                <p className="text-muted-foreground">
                  Describe your app idea and we'll generate all the code for you
                </p>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {projectTemplates.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => setSelectedType(template.type)}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all text-center",
                      selectedType === template.type
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50 hover-elevate"
                    )}
                    data-testid={`button-template-${template.type}`}
                  >
                    <template.icon className={cn("h-8 w-8 mx-auto mb-2", template.color)} />
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{template.description}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe your ${selectedTemplate?.name || "app"}... e.g., "A task management app with categories, due dates, and priority levels" or "An e-commerce product page with cart functionality"`}
                  className="min-h-[140px] text-base"
                  data-testid="input-oneshot-prompt"
                />
                <Button
                  onClick={generateApp}
                  disabled={!prompt.trim()}
                  size="lg"
                  className="w-full gap-2 h-12 text-base"
                  data-testid="button-generate-app"
                >
                  <Rocket className="h-5 w-5" />
                  Generate {selectedTemplate?.name || "App"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="max-w-md w-full space-y-6 text-center">
              <div className="relative">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center animate-pulse">
                  <Sparkles className="h-12 w-12 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Generating Your App</h2>
                <p className="text-muted-foreground text-sm">
                  Creating project structure and writing code...
                </p>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && generatedApp && (
          <div className="h-full flex">
            <div className="w-72 border-r bg-muted/20 flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold">{generatedApp.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{generatedApp.description}</p>
                <Badge className="mt-2" variant="secondary">
                  {selectedTemplate?.name}
                </Badge>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2">
                  <FileTreeNode
                    node={generatedApp.files}
                    onSelectFile={(path, content) => setSelectedFile({ path, content })}
                  />
                </div>
              </ScrollArea>
              <div className="p-3 border-t space-y-2">
                <Button
                  onClick={handleCreateProject}
                  className="w-full gap-2"
                  data-testid="button-create-project"
                >
                  <Download className="h-4 w-4" />
                  Create Project
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("input");
                    setGeneratedApp(null);
                    setSelectedFile(null);
                  }}
                  className="w-full"
                  data-testid="button-start-over"
                >
                  Start Over
                </Button>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              {selectedFile ? (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{selectedFile.path}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {selectedFile.content.split("\n").length} lines
                    </Badge>
                  </div>
                  <ScrollArea className="flex-1">
                    <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
                      {selectedFile.content}
                    </pre>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a file to preview</p>
                  </div>
                </div>
              )}
            </div>

            {generatedApp.setupInstructions.length > 0 && (
              <div className="w-64 border-l bg-muted/20 p-4">
                <h4 className="font-semibold text-sm mb-3">Setup Instructions</h4>
                <ol className="space-y-2 text-xs">
                  {generatedApp.setupInstructions.map((instruction, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                        {i + 1}
                      </span>
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                        {instruction}
                      </code>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
