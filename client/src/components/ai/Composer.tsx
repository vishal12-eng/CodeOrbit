import { useState, useCallback, useRef, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  X,
  Bot,
  Sparkles,
  Search,
  FileCode,
  Play,
  Check,
  XCircle,
  Clock,
  Zap,
  Send,
  ChevronDown,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import MultiFileDiff from "./MultiFileDiff";

type Phase = "idle" | "scanning" | "planning" | "generating" | "ready" | "applying";
type ModelId = "gpt-4o" | "gpt-4o-mini" | "claude-3-5-sonnet" | "gemini-1.5-pro";

interface ProjectContext {
  stack: {
    framework: string | null;
    uiLibrary: string | null;
    database: string | null;
    language: string;
  };
  rules: Array<{ name: string; content: string }>;
  recentFiles: string[];
  openFiles: string[];
}

interface PlanStep {
  stepNumber: number;
  description: string;
  action: "create" | "modify" | "delete" | "command";
  target: string;
  details?: string;
}

interface FileChange {
  path: string;
  originalContent: string;
  newContent: string;
  action: "create" | "modify" | "delete";
}

interface ComposerProps {
  projectId: string;
  openFiles?: string[];
  currentFile?: string;
  onApplyChanges?: (changes: FileChange[]) => void;
  onClose?: () => void;
}

const modelOptions = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
];

const phaseConfig = {
  idle: { label: "Ready", icon: Circle, color: "text-muted-foreground" },
  scanning: { label: "Scanning Context", icon: Search, color: "text-blue-500" },
  planning: { label: "Generating Plan", icon: Sparkles, color: "text-purple-500" },
  generating: { label: "Generating Code", icon: Zap, color: "text-yellow-500" },
  ready: { label: "Review Changes", icon: CheckCircle2, color: "text-green-500" },
  applying: { label: "Applying Changes", icon: Loader2, color: "text-blue-500" },
};

export default function Composer({
  projectId,
  openFiles = [],
  currentFile,
  onApplyChanges,
  onClose,
}: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4o");
  const [phase, setPhase] = useState<Phase>("idle");
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [expandedPlan, setExpandedPlan] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [selectedChangeIndex, setSelectedChangeIndex] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const recordTiming = (phase: string) => {
    const elapsed = Date.now() - startTimeRef.current;
    setTimings(prev => ({ ...prev, [phase]: elapsed }));
    startTimeRef.current = Date.now();
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setError(null);
    setPhase("scanning");
    setPlan([]);
    setFileChanges([]);
    setTimings({});
    startTimeRef.current = Date.now();
    
    abortControllerRef.current = new AbortController();

    try {
      const contextRes = await apiRequest("POST", "/api/composer/context", {
        projectId,
        openFiles,
        currentFile,
      });
      const contextData = await contextRes.json();
      setContext(contextData);
      recordTiming("scan");

      setPhase("planning");
      const planRes = await apiRequest("POST", "/api/composer/plan", {
        projectId,
        prompt,
        context: contextData,
        model: selectedModel,
      });
      const planData = await planRes.json();
      setPlan(planData.steps || []);
      recordTiming("plan");

      setPhase("generating");
      const response = await fetch("/api/composer/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          prompt,
          plan: planData.steps,
          context: contextData,
          model: selectedModel,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to generate code");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      const changes: FileChange[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === "content") {
                  accumulatedContent += data.content;
                  setStreamingContent(accumulatedContent);
                } else if (data.type === "file") {
                  changes.push({
                    path: data.path,
                    originalContent: data.originalContent || "",
                    newContent: data.newContent,
                    action: data.action,
                  });
                  setFileChanges([...changes]);
                } else if (data.type === "complete") {
                  setFileChanges(data.files || changes);
                }
              } catch (e) {
              }
            }
          }
        }
      }

      recordTiming("generate");
      setPhase("ready");
    } catch (err: any) {
      if (err.name === "AbortError") {
        setPhase("idle");
      } else {
        setError(err.message || "An error occurred");
        setPhase("idle");
      }
    }
  };

  const handleApplyAll = async () => {
    if (fileChanges.length === 0) return;
    
    setPhase("applying");
    
    try {
      await apiRequest("POST", "/api/composer/apply", {
        projectId,
        changes: fileChanges,
      });
      
      if (onApplyChanges) {
        onApplyChanges(fileChanges);
      }
      
      setPhase("idle");
      setPlan([]);
      setFileChanges([]);
      setPrompt("");
    } catch (err: any) {
      setError(err.message || "Failed to apply changes");
      setPhase("ready");
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setPhase("idle");
    setPlan([]);
    setFileChanges([]);
    setStreamingContent("");
  };

  const PhaseIcon = phaseConfig[phase].icon;
  const isProcessing = ["scanning", "planning", "generating", "applying"].includes(phase);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <span className="font-semibold">Composer</span>
          <Badge variant="secondary" className="text-xs">AI</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelId)}>
            <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-composer-model">
              <Bot className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-composer">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/10">
        {(["scanning", "planning", "generating", "ready"] as Phase[]).map((p, index) => {
          const config = phaseConfig[p];
          const Icon = config.icon;
          const isActive = phase === p;
          const isComplete = 
            (p === "scanning" && ["planning", "generating", "ready"].includes(phase)) ||
            (p === "planning" && ["generating", "ready"].includes(phase)) ||
            (p === "generating" && phase === "ready");
          
          return (
            <div key={p} className="flex items-center gap-1">
              {index > 0 && <div className="w-4 h-px bg-border" />}
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                isActive && "bg-muted",
                isComplete && "text-green-500",
                !isActive && !isComplete && "text-muted-foreground"
              )}>
                {isActive && p !== "ready" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isComplete ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                <span>{config.label}</span>
                {timings[p.replace("ing", "")] && (
                  <span className="text-[10px] text-muted-foreground">
                    {(timings[p.replace("ing", "")] / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {phase === "idle" && fileChanges.length === 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  What would you like to build?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the changes you want to make... e.g., 'Add a dark mode toggle to the header' or 'Refactor the auth module to use JWT'"
                  className="min-h-[100px] text-sm"
                  data-testid="input-composer-prompt"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Press {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to submit
                  </span>
                  <Button
                    onClick={handleSubmit}
                    disabled={isProcessing || !prompt.trim()}
                    className="gap-2"
                    data-testid="button-composer-submit"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-destructive">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {context && phase !== "idle" && (
            <Card>
              <CardHeader className="py-2 px-3">
                <div className="flex items-center gap-2 text-xs">
                  <Search className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium">Project Context</span>
                  {context.stack.framework && (
                    <Badge variant="secondary" className="text-[10px]">
                      {context.stack.framework}
                    </Badge>
                  )}
                  {context.stack.uiLibrary && (
                    <Badge variant="secondary" className="text-[10px]">
                      {context.stack.uiLibrary}
                    </Badge>
                  )}
                  {context.stack.language && (
                    <Badge variant="outline" className="text-[10px]">
                      {context.stack.language}
                    </Badge>
                  )}
                </div>
              </CardHeader>
            </Card>
          )}

          {plan.length > 0 && (
            <Collapsible open={expandedPlan} onOpenChange={setExpandedPlan}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-2 px-3 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <FileCode className="h-3.5 w-3.5 text-purple-500" />
                        <span className="font-medium">Execution Plan</span>
                        <Badge variant="outline" className="text-[10px]">
                          {plan.length} steps
                        </Badge>
                      </div>
                      {expandedPlan ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-3 px-3">
                    <div className="space-y-2">
                      {plan.map((step, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 text-xs"
                        >
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] font-medium shrink-0 mt-0.5">
                            {step.stepNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{step.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  step.action === "create" && "text-green-500 border-green-500/30",
                                  step.action === "modify" && "text-blue-500 border-blue-500/30",
                                  step.action === "delete" && "text-red-500 border-red-500/30",
                                  step.action === "command" && "text-yellow-500 border-yellow-500/30"
                                )}
                              >
                                {step.action}
                              </Badge>
                              <span className="text-muted-foreground truncate">
                                {step.target}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {(phase === "generating" || phase === "ready") && fileChanges.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">File Changes</span>
                  <Badge variant="secondary" className="text-xs">
                    {fileChanges.length} files
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {fileChanges.map((change, index) => (
                    <Button
                      key={change.path}
                      variant={selectedChangeIndex === index ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setSelectedChangeIndex(index)}
                      data-testid={`button-file-tab-${index}`}
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          "mr-1 text-[9px] px-1",
                          change.action === "create" && "text-green-500",
                          change.action === "modify" && "text-blue-500",
                          change.action === "delete" && "text-red-500"
                        )}
                      >
                        {change.action[0].toUpperCase()}
                      </Badge>
                      {change.path.split("/").pop()}
                    </Button>
                  ))}
                </div>
              </div>

              <MultiFileDiff
                changes={fileChanges}
                selectedIndex={selectedChangeIndex}
                onSelectChange={setSelectedChangeIndex}
              />
            </div>
          )}

          {phase === "generating" && streamingContent && fileChanges.length === 0 && (
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                  <span className="text-sm font-medium">Generating...</span>
                </div>
                <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-x-auto max-h-48 overflow-y-auto">
                  {streamingContent}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {(isProcessing || phase === "ready") && (
        <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/30">
          {isProcessing && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="gap-2"
              data-testid="button-composer-cancel"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </Button>
          )}
          
          {phase === "ready" && fileChanges.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setPhase("idle");
                  setPlan([]);
                  setFileChanges([]);
                }}
                className="gap-2"
                data-testid="button-composer-discard"
              >
                <X className="h-4 w-4" />
                Discard
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleApplyAll}
                className="gap-2"
                data-testid="button-composer-apply"
              >
                <Check className="h-4 w-4" />
                Apply All ({fileChanges.length} files)
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
