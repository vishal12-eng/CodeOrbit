import { useState } from "react";
import {
  Play,
  PlayCircle,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileCode,
  Wand2,
  X,
  Bot,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

interface BuildStep {
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

interface BuildPlan {
  id: string;
  summary: string;
  steps: BuildStep[];
  estimatedTime: string;
  complexity: "low" | "medium" | "high";
}

type ModelId = "gpt-4o" | "gpt-4o-mini" | "claude-3-5-sonnet" | "gemini-1.5-pro";

interface BuilderModeProps {
  projectContext?: string;
  projectFiles?: { path: string; content: string }[];
  onApplyChanges?: (files: { path: string; content: string }[]) => void;
  onClose?: () => void;
}

const modelOptions = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
];

const complexityColors = {
  low: "text-green-500 bg-green-500/10",
  medium: "text-yellow-500 bg-yellow-500/10",
  high: "text-red-500 bg-red-500/10",
};

const statusIcons = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
};

const statusColors = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-500",
  completed: "text-green-500",
  failed: "text-red-500",
};

export default function BuilderMode({
  projectContext,
  projectFiles = [],
  onApplyChanges,
  onClose,
}: BuilderModeProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4o");
  const [plan, setPlan] = useState<BuildPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [allChanges, setAllChanges] = useState<{ path: string; content: string }[]>([]);

  const generatePlan = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setPlan(null);
    setAllChanges([]);

    try {
      const response = await apiRequest("POST", "/api/ai/builder/plan", {
        prompt,
        projectStructure: projectContext,
        model: selectedModel,
      });
      const data = await response.json();
      setPlan(data);
      setExpandedSteps(new Set([data.steps[0]?.id]));
    } catch (error: any) {
      console.error("Failed to generate plan:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const executeStep = async (stepIndex: number) => {
    if (!plan || stepIndex >= plan.steps.length) return;

    const step = plan.steps[stepIndex];
    setCurrentStepIndex(stepIndex);

    const updatedSteps = [...plan.steps];
    updatedSteps[stepIndex] = { ...step, status: "in_progress" };
    setPlan({ ...plan, steps: updatedSteps });

    try {
      const response = await apiRequest("POST", "/api/ai/builder/execute", {
        step,
        projectFiles: [...projectFiles, ...allChanges.map(c => ({ path: c.path, content: c.content }))],
        buildContext: plan.summary,
        model: selectedModel,
      });
      const executedStep = await response.json();

      updatedSteps[stepIndex] = executedStep;
      setPlan({ ...plan, steps: updatedSteps });

      if (executedStep.codeChanges) {
        const newChanges = executedStep.codeChanges.map((c: any) => ({
          path: c.filePath,
          content: c.content,
        }));
        setAllChanges((prev) => {
          const updated = [...prev];
          for (const change of newChanges) {
            const existingIndex = updated.findIndex(c => c.path === change.path);
            if (existingIndex >= 0) {
              updated[existingIndex] = change;
            } else {
              updated.push(change);
            }
          }
          return updated;
        });
      }

      setExpandedSteps((prev) => new Set([...Array.from(prev), step.id]));
    } catch (error: any) {
      updatedSteps[stepIndex] = { ...step, status: "failed" };
      setPlan({ ...plan, steps: updatedSteps });
      console.error("Failed to execute step:", error);
    }

    setCurrentStepIndex(-1);
  };

  const executeAllSteps = async () => {
    if (!plan) return;

    setIsExecuting(true);

    for (let i = 0; i < plan.steps.length; i++) {
      if (plan.steps[i].status !== "completed") {
        await executeStep(i);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setIsExecuting(false);
  };

  const applyAllChanges = () => {
    if (onApplyChanges && allChanges.length > 0) {
      onApplyChanges(allChanges);
    }
  };

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const completedSteps = plan?.steps.filter((s) => s.status === "completed").length || 0;
  const totalSteps = plan?.steps.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-purple-500" />
          <span className="font-semibold">AI Builder Mode</span>
          <Badge variant="secondary" className="text-xs">Beta</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelId)}>
            <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-builder-model">
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
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-builder">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {!plan && (
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
                  placeholder="Describe the feature or changes you want to make... e.g., 'Add a dark mode toggle to the header' or 'Create a user authentication system'"
                  className="min-h-[100px] text-sm"
                  data-testid="input-builder-prompt"
                />
                <Button
                  onClick={generatePlan}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full gap-2"
                  data-testid="button-generate-plan"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Plan...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate Build Plan
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {plan && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">{plan.summary}</CardTitle>
                    <Badge className={cn("text-xs", complexityColors[plan.complexity])}>
                      {plan.complexity}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span>{totalSteps} steps</span>
                    <span>{plan.estimatedTime}</span>
                    <span>{completedSteps}/{totalSteps} completed</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>

              <div className="space-y-2">
                {plan.steps.map((step, index) => {
                  const StatusIcon = statusIcons[step.status];
                  const isExpanded = expandedSteps.has(step.id);

                  return (
                    <Collapsible
                      key={step.id}
                      open={isExpanded}
                      onOpenChange={() => toggleStep(step.id)}
                    >
                      <Card className={cn(
                        step.status === "in_progress" && "ring-2 ring-blue-500/50",
                        step.status === "failed" && "ring-2 ring-red-500/50"
                      )}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="py-3 cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                                {index + 1}
                              </div>
                              <StatusIcon
                                className={cn(
                                  "h-4 w-4",
                                  statusColors[step.status],
                                  step.status === "in_progress" && "animate-spin"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{step.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[10px]">
                                    {step.action}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {step.files.length} file(s)
                                  </span>
                                </div>
                              </div>
                              {step.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    executeStep(index);
                                  }}
                                  disabled={isExecuting || currentStepIndex >= 0}
                                  className="h-7 gap-1"
                                  data-testid={`button-execute-step-${index}`}
                                >
                                  <Play className="h-3 w-3" />
                                  Run
                                </Button>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0 pb-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1">
                                {step.files.map((file) => (
                                  <Badge key={file} variant="secondary" className="text-[10px] gap-1">
                                    <FileCode className="h-2.5 w-2.5" />
                                    {file}
                                  </Badge>
                                ))}
                              </div>
                              {step.codeChanges && step.codeChanges.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {step.codeChanges.map((change, ci) => (
                                    <div key={ci} className="rounded-md bg-muted/50 p-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium">{change.filePath}</span>
                                        {change.diff && (
                                          <Badge variant="outline" className="text-[9px]">
                                            {change.diff}
                                          </Badge>
                                        )}
                                      </div>
                                      <pre className="text-[10px] overflow-x-auto max-h-32 overflow-y-auto bg-background/50 p-2 rounded">
                                        {change.content?.slice(0, 500)}
                                        {change.content?.length > 500 && "..."}
                                      </pre>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>

              <div className="flex gap-2 sticky bottom-0 bg-background py-3 border-t -mx-4 px-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPlan(null);
                    setPrompt("");
                    setAllChanges([]);
                  }}
                  className="flex-1"
                  data-testid="button-new-plan"
                >
                  New Plan
                </Button>
                <Button
                  onClick={executeAllSteps}
                  disabled={isExecuting || completedSteps === totalSteps}
                  className="flex-1 gap-2"
                  data-testid="button-execute-all"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      Execute All
                    </>
                  )}
                </Button>
                {allChanges.length > 0 && (
                  <Button
                    onClick={applyAllChanges}
                    variant="default"
                    className="flex-1 gap-2"
                    data-testid="button-apply-changes"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Apply ({allChanges.length})
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
