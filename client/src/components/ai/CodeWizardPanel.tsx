import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  FilePlus,
  FileEdit,
  Trash2,
  Play,
  Eye,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Wand2,
  Code,
  Copy,
  Check,
  RefreshCw,
  Settings,
  Zap,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CodeWizardPanelProps {
  currentFile?: {
    path: string;
    content: string;
    language: string;
  };
  projectContext?: string;
  onApplyCode?: (path: string, content: string) => void;
  onOpenFile?: (path: string) => void;
}

interface FileAction {
  action: "create" | "edit" | "delete" | "read";
  path: string;
  content?: string;
  diff?: string;
}

interface CodeBlock {
  language: string;
  filename: string;
  code: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  fileActions?: FileAction[];
  codeBlocks?: CodeBlock[];
  nextSteps?: string[];
  thinking?: string;
  summary?: string;
}

type ModelId = "gpt-4o" | "gpt-4o-mini" | "claude-3-5-sonnet" | "gemini-2.5-flash" | "gemini-1.5-pro";

const fileActionIcons: Record<FileAction["action"], typeof FileText> = {
  read: Eye,
  create: FilePlus,
  edit: FileEdit,
  delete: Trash2,
};

const fileActionColors: Record<FileAction["action"], string> = {
  read: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  create: "bg-green-500/10 text-green-500 border-green-500/20",
  edit: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  delete: "bg-red-500/10 text-red-500 border-red-500/20",
};

const models: Array<{ id: ModelId; name: string; provider: string }> = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
];

function CodeBlockDisplay({ block, onApply }: { block: CodeBlock; onApply?: (code: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(block.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid={`code-block-${block.filename}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Code className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{block.filename}</span>
          <Badge variant="outline" className="text-[10px]">{block.language}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleCopy}
            data-testid={`button-copy-${block.filename}`}
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          {onApply && (
            <Button
              size="sm"
              variant="secondary"
              className="h-6 text-[10px] gap-1"
              onClick={() => onApply(block.code)}
              data-testid={`button-apply-${block.filename}`}
            >
              <Play className="h-3 w-3" />
              Apply
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="max-h-[300px]">
        <pre className="p-3 text-xs font-mono overflow-x-auto">
          <code>{block.code}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}

function FileActionChip({ 
  action, 
  onApply, 
  onView 
}: { 
  action: FileAction; 
  onApply?: () => void;
  onView?: () => void;
}) {
  const Icon = fileActionIcons[action.action];
  const colorClass = fileActionColors[action.action];

  return (
    <div className="flex items-center gap-1">
      <Badge
        variant="outline"
        className={cn("gap-1 text-[10px] font-normal cursor-pointer", colorClass)}
        onClick={onView}
        data-testid={`file-action-${action.action}-${action.path}`}
      >
        <Icon className="h-2.5 w-2.5" />
        <span className="truncate max-w-[120px]">{action.path}</span>
      </Badge>
      {(action.action === "create" || action.action === "edit") && action.content && onApply && (
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-1.5 text-[10px]"
          onClick={onApply}
          data-testid={`button-apply-file-${action.path}`}
        >
          Apply
        </Button>
      )}
    </div>
  );
}

function MessageBubble({ 
  message, 
  onApplyFile,
  onApplyCode,
  onViewFile,
}: { 
  message: Message;
  onApplyFile?: (path: string, content: string) => void;
  onApplyCode?: (code: string) => void;
  onViewFile?: (path: string) => void;
}) {
  const [showThinking, setShowThinking] = useState(false);
  const [showFileActions, setShowFileActions] = useState(true);

  if (message.role === "user") {
    return (
      <div className="flex justify-end" data-testid={`message-user-${message.id}`}>
        <div className="max-w-[85%] p-3 rounded-lg bg-primary text-primary-foreground">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <span className="text-[10px] opacity-70 mt-1 block">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid={`message-assistant-${message.id}`}>
      {message.summary && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          <span className="font-medium">{message.summary}</span>
        </div>
      )}

      {message.thinking && (
        <Collapsible open={showThinking} onOpenChange={setShowThinking}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            {showThinking ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span>View reasoning</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="p-2 mt-1 bg-muted/30 text-xs text-muted-foreground">
              {message.thinking}
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Card className="p-4 bg-card">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {message.content.split('\n').map((line, i) => {
            if (line.startsWith('## ')) {
              return <h3 key={i} className="text-base font-semibold mt-3 mb-2">{line.replace('## ', '')}</h3>;
            }
            if (line.startsWith('# ')) {
              return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace('# ', '')}</h2>;
            }
            if (line.startsWith('- ')) {
              return <li key={i} className="ml-4 text-sm">{line.replace('- ', '')}</li>;
            }
            if (line.match(/^\d+\. /)) {
              return <li key={i} className="ml-4 text-sm list-decimal">{line.replace(/^\d+\. /, '')}</li>;
            }
            if (line.startsWith('```')) {
              return null;
            }
            if (line.trim()) {
              return <p key={i} className="text-sm mb-2">{line}</p>;
            }
            return null;
          })}
        </div>
      </Card>

      {message.fileActions && message.fileActions.length > 0 && (
        <Collapsible open={showFileActions} onOpenChange={setShowFileActions}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            {showFileActions ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            File Actions ({message.fileActions.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="flex flex-wrap gap-2">
              {message.fileActions.map((action, i) => (
                <FileActionChip
                  key={`${action.path}-${i}`}
                  action={action}
                  onApply={action.content ? () => onApplyFile?.(action.path, action.content!) : undefined}
                  onView={() => onViewFile?.(action.path)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {message.codeBlocks && message.codeBlocks.length > 0 && (
        <div className="space-y-2">
          {message.codeBlocks.map((block, i) => (
            <CodeBlockDisplay
              key={`${block.filename}-${i}`}
              block={block}
              onApply={onApplyCode}
            />
          ))}
        </div>
      )}

      {message.nextSteps && message.nextSteps.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Suggested next steps:</p>
          <div className="flex flex-wrap gap-1.5">
            {message.nextSteps.map((step, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {step}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <span className="text-[10px] text-muted-foreground">
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

export default function CodeWizardPanel({
  currentFile,
  projectContext,
  onApplyCode,
  onOpenFile,
}: CodeWizardPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("gemini-2.5-flash");
  const [applyingChanges, setApplyingChanges] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await apiRequest("POST", "/api/codewizard/chat", {
        message: input.trim(),
        currentFile,
        projectContext,
        conversationHistory,
        model: selectedModel,
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message || "I've processed your request.",
        timestamp: new Date(),
        fileActions: data.fileActions,
        codeBlocks: data.codeBlocks,
        nextSteps: data.nextSteps,
        thinking: data.thinking,
        summary: data.summary,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get response from CodeWizard",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFile = async (path: string, content: string) => {
    setApplyingChanges(true);
    try {
      const response = await apiRequest("POST", "/api/codewizard/apply", {
        fileActions: [{ action: "edit", path, content }],
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Changes Applied",
          description: `Successfully updated ${path}`,
        });
        onApplyCode?.(path, content);
      } else {
        throw new Error("Failed to apply changes");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply file changes",
        variant: "destructive",
      });
    } finally {
      setApplyingChanges(false);
    }
  };

  const handleApplyAllChanges = async (fileActions: FileAction[]) => {
    setApplyingChanges(true);
    try {
      const actionsToApply = fileActions.filter(
        a => (a.action === "create" || a.action === "edit") && a.content
      );

      if (actionsToApply.length === 0) {
        toast({
          title: "No Changes",
          description: "No file changes to apply",
        });
        return;
      }

      const response = await apiRequest("POST", "/api/codewizard/apply", {
        fileActions: actionsToApply,
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "All Changes Applied",
          description: `Successfully updated ${result.results.filter((r: any) => r.success).length} files`,
        });
      } else {
        const failed = result.results.filter((r: any) => !r.success);
        throw new Error(`Failed to apply ${failed.length} files`);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply changes",
        variant: "destructive",
      });
    } finally {
      setApplyingChanges(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const currentModel = models.find(m => m.id === selectedModel);

  return (
    <div className="h-full flex flex-col bg-background" data-testid="codewizard-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Wand2 className="h-5 w-5 text-violet-500" />
            {isLoading && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            )}
          </div>
          <span className="font-bold bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent">
            CodeWizard
          </span>
          <Badge variant="secondary" className="text-[10px]">
            <Zap className="h-2.5 w-2.5 mr-1" />
            AI Agent
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <Bot className="h-3 w-3" />
                {currentModel?.name || "Select Model"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {models.map(model => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className="text-xs"
                >
                  <span className="flex-1">{model.name}</span>
                  <Badge variant="outline" className="text-[9px] ml-2">{model.provider}</Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleClearChat}
            data-testid="button-clear-chat"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="relative mx-auto w-16 h-16 mb-4">
                <Wand2 className="h-16 w-16 text-violet-500/30" />
                <Sparkles className="h-6 w-6 text-violet-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold mb-2 bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent">
                Welcome to CodeWizard
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                I'm your AI coding assistant. Describe what you want to build and I'll help you create, 
                edit, and optimize your code. Ab code likhna hua aasan!
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  Create files
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Edit code
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Fix bugs
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Generate tests
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Optimize
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {messages.map(message => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onApplyFile={handleApplyFile}
                  onApplyCode={(code) => onApplyCode?.(currentFile?.path || "untitled", code)}
                  onViewFile={onOpenFile}
                />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  <span className="text-sm">CodeWizard is thinking...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="p-4 border-t bg-card/30">
        {currentFile && (
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>Context: {currentFile.path}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CodeWizard to help you code... (e.g., 'Add a dark mode toggle')"
            className="resize-none min-h-[60px] text-sm"
            disabled={isLoading || applyingChanges}
            data-testid="input-codewizard-message"
          />
          <div className="flex flex-col gap-2">
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading || applyingChanges}
              className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
              data-testid="button-send-codewizard"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
