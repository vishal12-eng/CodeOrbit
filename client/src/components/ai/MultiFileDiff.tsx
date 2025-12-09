import { useMemo } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileCode, FilePlus, FileX, FilePen } from "lucide-react";

interface FileChange {
  path: string;
  originalContent: string;
  newContent: string;
  action: "create" | "modify" | "delete";
}

interface MultiFileDiffProps {
  changes: FileChange[];
  selectedIndex: number;
  onSelectChange: (index: number) => void;
  height?: string;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sh: "shell",
    bash: "shell",
  };
  return languageMap[ext || ""] || "plaintext";
}

function getActionIcon(action: FileChange["action"]) {
  switch (action) {
    case "create":
      return FilePlus;
    case "modify":
      return FilePen;
    case "delete":
      return FileX;
    default:
      return FileCode;
  }
}

function getActionColor(action: FileChange["action"]) {
  switch (action) {
    case "create":
      return "text-green-500";
    case "modify":
      return "text-blue-500";
    case "delete":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

export default function MultiFileDiff({
  changes,
  selectedIndex,
  onSelectChange,
  height = "400px",
}: MultiFileDiffProps) {
  const selectedChange = changes[selectedIndex];
  const language = useMemo(
    () => (selectedChange ? getLanguageFromPath(selectedChange.path) : "plaintext"),
    [selectedChange]
  );

  if (changes.length === 0) {
    return (
      <Card className="flex items-center justify-center h-48">
        <div className="text-muted-foreground text-sm">No changes to display</div>
      </Card>
    );
  }

  const ActionIcon = getActionIcon(selectedChange?.action);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <ActionIcon className={cn("h-4 w-4", getActionColor(selectedChange?.action))} />
        <span className="text-sm font-medium">{selectedChange?.path}</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            getActionColor(selectedChange?.action)
          )}
        >
          {selectedChange?.action}
        </Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            {selectedIndex + 1} / {changes.length}
          </span>
        </div>
      </div>

      <Card className="overflow-hidden">
        {selectedChange?.action === "delete" ? (
          <div className="p-4 bg-red-500/10">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <FileX className="h-4 w-4" />
              <span className="text-sm font-medium">File will be deleted</span>
            </div>
            <pre className="text-xs bg-background/50 p-2 rounded-md overflow-x-auto max-h-64 overflow-y-auto">
              {selectedChange.originalContent}
            </pre>
          </div>
        ) : (
          <DiffEditor
            height={height}
            language={language}
            original={selectedChange?.originalContent || ""}
            modified={selectedChange?.newContent || ""}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              lineNumbers: "on",
              wordWrap: "on",
              diffWordWrap: "on",
              originalEditable: false,
              enableSplitViewResizing: true,
              renderOverviewRuler: false,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
            theme="vs-dark"
          />
        )}
      </Card>

      {changes.length > 1 && (
        <div className="flex items-center justify-center gap-1 py-1">
          {changes.map((change, index) => {
            const Icon = getActionIcon(change.action);
            return (
              <button
                key={change.path}
                onClick={() => onSelectChange(index)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                  selectedIndex === index
                    ? "bg-muted"
                    : "hover:bg-muted/50"
                )}
                data-testid={`button-diff-file-${index}`}
              >
                <Icon className={cn("h-3 w-3", getActionColor(change.action))} />
                <span className="truncate max-w-24">
                  {change.path.split("/").pop()}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
