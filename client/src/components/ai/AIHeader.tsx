import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bot,
  ChevronDown,
  Sparkles,
  Wand2,
  Settings,
  Trash2,
  RotateCcw,
  FolderCheck,
} from "lucide-react";

interface ModelOption {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "gemini" | "grok";
  available?: boolean;
}

interface AIHeaderProps {
  title?: string;
  subtitle?: string;
  mode?: "chat" | "builder" | "edit" | "debug" | "agent" | "wizard";
  selectedModel?: string;
  models?: ModelOption[];
  onModelChange?: (modelId: string) => void;
  actionCount?: number;
  isStreaming?: boolean;
  onClearHistory?: () => void;
  onSettings?: () => void;
  className?: string;
}

const modeConfig = {
  chat: { icon: Sparkles, label: "Chat", color: "text-blue-500" },
  builder: { icon: Wand2, label: "Builder", color: "text-purple-500" },
  edit: { icon: Bot, label: "Edit", color: "text-orange-500" },
  debug: { icon: Bot, label: "Debug", color: "text-red-500" },
  agent: { icon: Bot, label: "Agent", color: "text-cyan-500" },
  wizard: { icon: Sparkles, label: "CodeWizard", color: "text-violet-500" },
};

const modelTypeColors: Record<string, string> = {
  openai: "text-green-500",
  anthropic: "text-orange-500",
  gemini: "text-blue-500",
  grok: "text-purple-500",
};

export function AIHeader({
  title = "AI Assistant",
  subtitle,
  mode = "chat",
  selectedModel,
  models = [],
  onModelChange,
  actionCount = 0,
  isStreaming = false,
  onClearHistory,
  onSettings,
  className,
}: AIHeaderProps) {
  const ModeIcon = modeConfig[mode].icon;
  const currentModel = models.find(m => m.id === selectedModel);

  return (
    <div 
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30 shrink-0",
        className
      )}
      data-testid="ai-header"
    >
      <div className="flex items-center gap-2">
        <ModeIcon className={cn("h-4 w-4", modeConfig[mode].color)} />
        <div>
          <span className="font-medium text-sm">{title}</span>
          {subtitle && (
            <span className="text-xs text-muted-foreground ml-2">{subtitle}</span>
          )}
        </div>
        <Badge 
          variant="secondary" 
          className={cn(
            "text-[10px]",
            modeConfig[mode].color
          )}
        >
          {modeConfig[mode].label}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        {actionCount > 0 && (
          <Badge 
            variant="outline" 
            className="text-[10px] gap-1"
            data-testid="badge-action-count"
          >
            <FolderCheck className="h-3 w-3 text-green-500" />
            {actionCount} action{actionCount !== 1 ? "s" : ""}
          </Badge>
        )}

        {isStreaming && (
          <Badge variant="secondary" className="text-[10px] animate-pulse">
            Generating...
          </Badge>
        )}

        {models.length > 0 && onModelChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 gap-1 text-xs"
                data-testid="button-select-model"
              >
                <Bot 
                  className={cn(
                    "h-3.5 w-3.5", 
                    currentModel ? modelTypeColors[currentModel.type] : ""
                  )} 
                />
                <span className="hidden sm:inline max-w-[80px] truncate">
                  {currentModel?.name || "Select Model"}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Select Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {["openai", "anthropic", "gemini", "grok"].map((type) => {
                const typeModels = models.filter(m => m.type === type);
                if (typeModels.length === 0) return null;
                return (
                  <div key={type}>
                    <DropdownMenuLabel 
                      className={cn(
                        "text-[10px] uppercase tracking-wider", 
                        modelTypeColors[type]
                      )}
                    >
                      {type}
                    </DropdownMenuLabel>
                    {typeModels.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => onModelChange(model.id)}
                        className={cn(
                          "gap-2 text-xs", 
                          model.available === false && "opacity-50"
                        )}
                        disabled={model.available === false}
                      >
                        <Bot className={cn("h-3 w-3", modelTypeColors[model.type])} />
                        {model.name}
                        {model.id === selectedModel && (
                          <Badge variant="secondary" className="ml-auto text-[9px]">
                            Active
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onClearHistory && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClearHistory}
            title="Clear chat history"
            data-testid="button-clear-history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}

        {onSettings && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onSettings}
            title="AI Settings"
            data-testid="button-ai-settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default AIHeader;
