import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  Loader2,
  StopCircle,
  CheckCircle2,
  Circle,
  AlertCircle,
  FileText,
  FilePlus,
  FileEdit,
  Trash2,
  Play,
  Hammer,
  TestTube,
  Eye,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAgentSSE, AgentStep, AgentFileAction, AgentResult } from "@/hooks/useAgentSSE";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AgentPanelProps {
  projectContext?: string;
  onFileChange?: (file: string, action: string) => void;
}

const fileActionIcons: Record<AgentFileAction["type"], typeof FileText> = {
  read: Eye,
  create: FilePlus,
  edit: FileEdit,
  delete: Trash2,
  build: Hammer,
  run: Play,
  test: TestTube,
};

const fileActionColors: Record<AgentFileAction["type"], string> = {
  read: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  create: "bg-green-500/10 text-green-500 border-green-500/20",
  edit: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  delete: "bg-red-500/10 text-red-500 border-red-500/20",
  build: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  run: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  test: "bg-pink-500/10 text-pink-500 border-pink-500/20",
};

const statusColors: Record<string, string> = {
  idle: "text-muted-foreground",
  initializing: "text-blue-500",
  planning: "text-purple-500",
  executing: "text-amber-500",
  building: "text-cyan-500",
  completed: "text-green-500",
  failed: "text-red-500",
};

function StepItem({ step, index, isActive }: { step: AgentStep; index: number; isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setIsOpen(true);
  }, [isActive]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
            isActive && "bg-primary/5",
            step.status === "done" && "opacity-80",
            step.status === "error" && "bg-red-500/5"
          )}
          data-testid={`agent-step-${step.id}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {step.status === "pending" && (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            {step.status === "active" && (
              <div className="relative">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
              </div>
            )}
            {step.status === "done" && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {step.status === "error" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Step {index + 1}
              </span>
              <span className="text-sm font-medium truncate">{step.name}</span>
              {isOpen ? (
                <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="pl-10 pr-3 pb-3">
          <p className="text-xs text-muted-foreground">{step.description}</p>
          {step.error && (
            <p className="text-xs text-red-500 mt-1">{step.error}</p>
          )}
          {step.endTime && step.startTime && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Completed in {((step.endTime - step.startTime) / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FileActionChip({ action }: { action: AgentFileAction }) {
  const Icon = fileActionIcons[action.type];
  const colorClass = fileActionColors[action.type];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[10px] font-normal", colorClass)}
      data-testid={`file-action-${action.type}-${action.file}`}
    >
      <Icon className="h-2.5 w-2.5" />
      <span className="truncate max-w-[120px]">{action.file}</span>
    </Badge>
  );
}

function TypewriterText({ text, speed = 5 }: { text: string; speed?: number }) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const charsToAdd = Math.min(5, text.length - currentIndex);
      const timeout = setTimeout(() => {
        setDisplayText(text.slice(0, currentIndex + charsToAdd));
        setCurrentIndex(currentIndex + charsToAdd);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  useEffect(() => {
    setDisplayText("");
    setCurrentIndex(0);
  }, [text]);

  return (
    <span>
      {displayText}
      {currentIndex < text.length && (
        <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
      )}
    </span>
  );
}

function ResultSummary({ result }: { result: AgentResult }) {
  return (
    <Card className="p-4 bg-card/50">
      <div className="flex items-center gap-2 mb-3">
        {result.success ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-500" />
        )}
        <span className={cn("font-medium", result.success ? "text-green-500" : "text-red-500")}>
          {result.success ? "Completed Successfully" : "Completed with Errors"}
        </span>
      </div>
      
      <p className="text-sm text-muted-foreground mb-3">{result.summary}</p>
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 rounded bg-green-500/10">
          <div className="font-medium text-green-500">{result.filesCreated.length}</div>
          <div className="text-muted-foreground">Created</div>
        </div>
        <div className="text-center p-2 rounded bg-amber-500/10">
          <div className="font-medium text-amber-500">{result.filesModified.length}</div>
          <div className="text-muted-foreground">Modified</div>
        </div>
        <div className="text-center p-2 rounded bg-red-500/10">
          <div className="font-medium text-red-500">{result.filesDeleted.length}</div>
          <div className="text-muted-foreground">Deleted</div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center justify-between">
        <span>{result.totalSteps} steps completed</span>
        <span>{(result.executionTime / 1000).toFixed(1)}s total</span>
      </div>
    </Card>
  );
}

export default function AgentPanel({ projectContext, onFileChange }: AgentPanelProps) {
  const [input, setInput] = useState("");
  const [showFileActions, setShowFileActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const outputScrollRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isRunning,
    status,
    statusMessage,
    steps,
    currentStepIndex,
    fileActions,
    modelOutput,
    error,
    result,
    startAgent,
    stopAgent,
    reset,
  } = useAgentSSE({
    onFileAction: (action) => {
      onFileChange?.(action.file, action.type);
    },
  });

  useEffect(() => {
    if (outputScrollRef.current) {
      outputScrollRef.current.scrollTop = outputScrollRef.current.scrollHeight;
    }
  }, [modelOutput]);

  const handleSubmit = async () => {
    if (!input.trim() || isRunning) return;
    const task = input.trim();
    setInput("");
    await startAgent(task, projectContext, "gemini-1.5-pro");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="h-full flex flex-col bg-background" data-testid="agent-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot className="h-5 w-5 text-primary" />
            {isRunning && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          <span className="font-semibold">Nova Agent</span>
          <Badge variant="secondary" className="text-[10px]">
            <Zap className="h-2.5 w-2.5 mr-1" />
            AI Builder
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={cn("text-xs", statusColors[status] || "text-muted-foreground")}>
            {statusMessage || status}
          </span>
          {(isRunning || result) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={reset}
              data-testid="button-reset-agent"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!isRunning && !result && steps.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary/30" />
              <h3 className="font-semibold mb-2">Nova Agent Ready</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Describe what you want to build and I'll handle the implementation - reading files, 
                generating code, and making changes to your project.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  Reads project files
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Generates plans
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Applies code changes
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Runs build checks
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {steps.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Execution Steps
                    </h4>
                    <span className="text-[10px] text-muted-foreground">
                      {steps.filter(s => s.status === "done").length}/{steps.length} complete
                    </span>
                  </div>
                  {steps.map((step, index) => (
                    <StepItem
                      key={step.id}
                      step={step}
                      index={index}
                      isActive={index === currentStepIndex}
                    />
                  ))}
                </div>
              )}

              {fileActions.length > 0 && (
                <Collapsible open={showFileActions} onOpenChange={setShowFileActions}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer py-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        File Actions ({fileActions.length})
                      </h4>
                      {showFileActions ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {fileActions.map((action, index) => (
                        <FileActionChip key={`${action.file}-${index}`} action={action} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {modelOutput && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    AI Response
                  </h4>
                  <Card className="p-3 bg-card/50">
                    <ScrollArea className="max-h-[300px]" ref={outputScrollRef}>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                        {isRunning ? (
                          <TypewriterText text={modelOutput} speed={3} />
                        ) : (
                          modelOutput
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              )}

              {error && (
                <Card className="p-3 bg-red-500/10 border-red-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                </Card>
              )}

              {result && <ResultSummary result={result} />}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="p-4 border-t bg-card/30">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            className="resize-none min-h-[60px] text-sm"
            disabled={isRunning}
            data-testid="input-agent-task"
          />
          <div className="flex flex-col gap-2">
            {isRunning ? (
              <Button
                size="icon"
                variant="destructive"
                onClick={stopAgent}
                data-testid="button-stop-agent"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!input.trim()}
                data-testid="button-start-agent"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
