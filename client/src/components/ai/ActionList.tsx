import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Eye, Pencil, Edit3, Plus, Trash2, Hammer, Play, Download, FlaskConical, Zap } from "lucide-react";
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
  read: "text-purple-400",
  write: "text-orange-400",
  edit: "text-orange-400",
  create: "text-blue-400",
  delete: "text-red-400",
  build: "text-yellow-400",
  run: "text-green-400",
  install: "text-cyan-400",
  test: "text-indigo-400",
};

interface ActionListProps {
  actions: FileAction[];
  defaultExpanded?: boolean;
  maxPreview?: number;
  className?: string;
}

export function ActionList({
  actions,
  defaultExpanded = true,
  maxPreview = 5,
  className,
}: ActionListProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (actions.length === 0) {
    return null;
  }

  const displayedActions = isExpanded ? actions : actions.slice(0, maxPreview);
  const hasMore = !isExpanded && actions.length > maxPreview;

  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className={cn("rounded-lg border border-primary/20 bg-primary/5 overflow-hidden", className)}
    >
      <CollapsibleTrigger 
        className="flex items-center gap-3 w-full px-4 py-3 hover-elevate transition-all group cursor-pointer"
        data-testid="button-toggle-actions"
      >
        <Zap className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <div className="flex items-baseline gap-2 flex-1">
          <span className="font-semibold text-sm">
            {actions.length} action{actions.length !== 1 ? "s" : ""} taken
          </span>
          <span className="text-xs text-muted-foreground">
            {isExpanded ? "View less" : "View more"}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </CollapsibleTrigger>

      {(isExpanded || !isExpanded) && (
        <CollapsibleContent>
          <div className="border-t border-primary/20 divide-y divide-primary/10">
            {displayedActions.map((action, index) => {
              const Icon = actionIcons[action.type];
              const label = actionLabels[action.type];
              const color = actionColors[action.type];

              return (
                <div 
                  key={`${action.type}-${action.file}-${index}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/10 transition-colors group"
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />
                  <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground min-w-[70px]">
                    {label}
                  </span>
                  <code className="text-xs font-mono text-muted-foreground group-hover:text-foreground/80 break-all flex-1 px-2 py-1 rounded bg-background/50">
                    {action.file}
                  </code>
                  {action.description && (
                    <div className="text-xs text-muted-foreground hidden group-hover:block absolute right-4">
                      {action.description}
                    </div>
                  )}
                </div>
              );
            })}
            {hasMore && (
              <div className="px-4 py-2 text-xs text-muted-foreground/60 text-center">
                +{actions.length - maxPreview} more actions...
              </div>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export default ActionList;
