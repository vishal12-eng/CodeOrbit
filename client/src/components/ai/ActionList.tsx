import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  ChevronUp,
  Eye, 
  Pencil, 
  Edit3, 
  Plus, 
  Trash2, 
  Hammer, 
  Play, 
  Download, 
  FlaskConical,
  MessageCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { FileAction, FileActionType } from "@shared/aiSchema";

const actionIcons: Record<FileActionType, typeof Eye> = {
  read: Eye,
  write: Pencil,
  edit: Edit3,
  create: Plus,
  delete: Trash2,
  build: Hammer,
  run: Play,
  install: Download,
  test: FlaskConical,
};

const actionLabels: Record<FileActionType, string> = {
  read: "Read",
  write: "Wrote",
  edit: "Edited",
  create: "Created",
  delete: "Deleted",
  build: "Built",
  run: "Ran",
  install: "Installed",
  test: "Tested",
};

const actionColors: Record<FileActionType, string> = {
  read: "text-neutral-400",
  write: "text-neutral-400",
  edit: "text-neutral-400",
  create: "text-neutral-400",
  delete: "text-red-400",
  build: "text-neutral-400",
  run: "text-green-400",
  install: "text-cyan-400",
  test: "text-indigo-400",
};

interface ActionListProps {
  actions: FileAction[];
  defaultExpanded?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function ActionList({
  actions,
  defaultExpanded = false,
  isLoading = false,
  className,
}: ActionListProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (actions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className={cn("my-4", className)}
    >
      <CollapsibleTrigger 
        className="flex items-center gap-2 w-full py-2 cursor-pointer group"
        data-testid="button-toggle-actions"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm text-muted-foreground font-medium">
          {isLoading ? "Working..." : `${actions.length} action${actions.length !== 1 ? "s" : ""} taken`}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden">
        <div className="space-y-1 pt-1">
          {actions.map((action, index) => {
            const Icon = actionIcons[action.type];
            const label = actionLabels[action.type];
            const color = actionColors[action.type];

            if (action.type === "build" && !action.file) {
              return (
                <div 
                  key={`${action.type}-${index}`}
                  className="flex items-center gap-2 py-1.5"
                >
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    {action.description || "Built the project to verify everything works"}
                  </span>
                </div>
              );
            }

            return (
              <div 
                key={`${action.type}-${action.file}-${index}`}
                className="flex items-center gap-2 py-1.5"
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />
                <span className="text-sm text-muted-foreground min-w-[55px]">
                  {label}
                </span>
                <code className="text-xs font-mono px-2 py-0.5 rounded bg-muted/50 text-foreground/80 truncate max-w-[280px]">
                  {action.file}
                </code>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default ActionList;
