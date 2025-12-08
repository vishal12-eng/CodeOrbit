import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, FolderCheck } from "lucide-react";
import { FileActionChip } from "./FileActionChip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { FileAction } from "@shared/aiSchema";

interface ActionListProps {
  actions: FileAction[];
  defaultExpanded?: boolean;
  maxPreview?: number;
  className?: string;
}

export function ActionList({
  actions,
  defaultExpanded = false,
  maxPreview = 3,
  className,
}: ActionListProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (actions.length === 0) {
    return null;
  }

  const previewActions = actions.slice(0, maxPreview);
  const hasMore = actions.length > maxPreview;

  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className={cn("rounded-md border bg-muted/30", className)}
    >
      <CollapsibleTrigger 
        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover-elevate rounded-md"
        data-testid="button-toggle-actions"
      >
        <FolderCheck className="h-4 w-4 text-green-500" />
        <span className="font-medium">
          {actions.length} action{actions.length !== 1 ? "s" : ""} taken
        </span>
        <div className="flex-1" />
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-3 pb-3 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {actions.map((action, index) => (
              <FileActionChip
                key={`${action.type}-${action.file}-${index}`}
                action={action}
                size="md"
              />
            ))}
          </div>
        </div>
      </CollapsibleContent>

      {!isExpanded && previewActions.length > 0 && (
        <div className="px-3 pb-2 -mt-1">
          <div className="flex flex-wrap gap-1">
            {previewActions.map((action, index) => (
              <FileActionChip
                key={`preview-${action.type}-${action.file}-${index}`}
                action={action}
                size="sm"
                showLabel={false}
              />
            ))}
            {hasMore && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{actions.length - maxPreview} more
              </span>
            )}
          </div>
        </div>
      )}
    </Collapsible>
  );
}

export default ActionList;
