import { cn } from "@/lib/utils";
import {
  Eye,
  Pencil,
  Edit3,
  Plus,
  Trash2,
  Hammer,
  Play,
  Download,
  FlaskConical,
} from "lucide-react";
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

const actionColors: Record<FileActionType, { bg: string; text: string; border: string }> = {
  read: { 
    bg: "bg-purple-500/10 dark:bg-purple-500/20", 
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/20",
  },
  write: { 
    bg: "bg-orange-500/10 dark:bg-orange-500/20", 
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/20",
  },
  edit: { 
    bg: "bg-orange-500/10 dark:bg-orange-500/20", 
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/20",
  },
  create: { 
    bg: "bg-blue-500/10 dark:bg-blue-500/20", 
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
  },
  delete: { 
    bg: "bg-red-500/10 dark:bg-red-500/20", 
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/20",
  },
  build: { 
    bg: "bg-yellow-500/10 dark:bg-yellow-500/20", 
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-500/20",
  },
  run: { 
    bg: "bg-green-500/10 dark:bg-green-500/20", 
    text: "text-green-600 dark:text-green-400",
    border: "border-green-500/20",
  },
  install: { 
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20", 
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/20",
  },
  test: { 
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20", 
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/20",
  },
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

interface FileActionChipProps {
  action: FileAction;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function FileActionChip({
  action,
  size = "sm",
  showLabel = true,
  className,
}: FileActionChipProps) {
  const Icon = actionIcons[action.type];
  const colors = actionColors[action.type];
  const label = actionLabels[action.type];

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
  };

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium transition-colors",
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size],
        className
      )}
      title={action.description}
      data-testid={`chip-action-${action.type}-${action.file.replace(/[^a-zA-Z0-9]/g, "-")}`}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{label}</span>}
      <span className="font-mono opacity-80 truncate max-w-[120px]">
        {action.file}
      </span>
    </span>
  );
}

interface FileActionChipListProps {
  actions: FileAction[];
  maxVisible?: number;
  size?: "sm" | "md";
  className?: string;
}

export function FileActionChipList({
  actions,
  maxVisible = 5,
  size = "sm",
  className,
}: FileActionChipListProps) {
  const visibleActions = actions.slice(0, maxVisible);
  const remainingCount = actions.length - maxVisible;

  return (
    <div 
      className={cn("flex flex-wrap gap-1", className)}
      data-testid="file-action-chip-list"
    >
      {visibleActions.map((action, index) => (
        <FileActionChip 
          key={`${action.type}-${action.file}-${index}`} 
          action={action} 
          size={size}
        />
      ))}
      {remainingCount > 0 && (
        <span 
          className={cn(
            "inline-flex items-center rounded-md bg-muted text-muted-foreground font-medium",
            size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
          )}
        >
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

export default FileActionChip;
