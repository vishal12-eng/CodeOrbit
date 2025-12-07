import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Plus,
  Check,
  X,
  RefreshCw,
  Loader2,
  ChevronRight,
  FileText,
  FilePlus,
  FileX,
  FileEdit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface GitFile {
  path: string;
  status: "added" | "modified" | "deleted" | "untracked";
  staged: boolean;
}

interface GitPanelProps {
  projectId: string;
  onRefresh?: () => void;
}

export default function GitPanel({ projectId, onRefresh }: GitPanelProps) {
  const [currentBranch, setCurrentBranch] = useState("main");
  const [branches, setBranches] = useState(["main", "develop", "feature/ai-panel"]);
  const [stagedFiles, setStagedFiles] = useState<GitFile[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<GitFile[]>([
    { path: "src/App.tsx", status: "modified", staged: false },
    { path: "src/components/NewComponent.tsx", status: "added", staged: false },
  ]);
  const [commitMessage, setCommitMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [isNewBranchDialogOpen, setIsNewBranchDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [isStagedOpen, setIsStagedOpen] = useState(true);
  const [isUnstagedOpen, setIsUnstagedOpen] = useState(true);

  const getStatusIcon = (status: GitFile["status"]) => {
    switch (status) {
      case "added":
        return <FilePlus className="h-4 w-4 text-green-500" />;
      case "modified":
        return <FileEdit className="h-4 w-4 text-yellow-500" />;
      case "deleted":
        return <FileX className="h-4 w-4 text-red-500" />;
      case "untracked":
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const stageFile = (file: GitFile) => {
    setUnstagedFiles((prev) => prev.filter((f) => f.path !== file.path));
    setStagedFiles((prev) => [...prev, { ...file, staged: true }]);
  };

  const unstageFile = (file: GitFile) => {
    setStagedFiles((prev) => prev.filter((f) => f.path !== file.path));
    setUnstagedFiles((prev) => [...prev, { ...file, staged: false }]);
  };

  const stageAll = () => {
    setStagedFiles((prev) => [
      ...prev,
      ...unstagedFiles.map((f) => ({ ...f, staged: true })),
    ]);
    setUnstagedFiles([]);
  };

  const unstageAll = () => {
    setUnstagedFiles((prev) => [
      ...prev,
      ...stagedFiles.map((f) => ({ ...f, staged: false })),
    ]);
    setStagedFiles([]);
  };

  const generateCommitMessage = async () => {
    setIsGeneratingMessage(true);
    try {
      const diff = stagedFiles.map((f) => `${f.status}: ${f.path}`).join("\n");
      const response = await apiRequest("POST", "/api/ai/commit-message", { diff });
      const data = await response.json();
      setCommitMessage(data.message);
    } catch (error) {
      console.error("Failed to generate commit message:", error);
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    setIsLoading(true);
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    setStagedFiles([]);
    setCommitMessage("");
    setIsLoading(false);
  };

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return;
    setBranches((prev) => [...prev, newBranchName.trim()]);
    setCurrentBranch(newBranchName.trim());
    setNewBranchName("");
    setIsNewBranchDialogOpen(false);
  };

  const handleSwitchBranch = (branch: string) => {
    setCurrentBranch(branch);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          <span className="font-semibold">Source Control</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <select
            value={currentBranch}
            onChange={(e) => handleSwitchBranch(e.target.value)}
            className="flex-1 bg-muted/50 border rounded px-2 py-1 text-sm"
          >
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsNewBranchDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <Collapsible open={isStagedOpen} onOpenChange={setIsStagedOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground">
                <motion.div
                  animate={{ rotate: isStagedOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
                Staged Changes ({stagedFiles.length})
              </CollapsibleTrigger>
              {stagedFiles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={unstageAll}
                >
                  Unstage All
                </Button>
              )}
            </div>
            <CollapsibleContent>
              <AnimatePresence>
                {stagedFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 pl-6">
                    No staged changes
                  </p>
                ) : (
                  <div className="space-y-1 mt-2">
                    {stagedFiles.map((file) => (
                      <motion.div
                        key={file.path}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 group"
                      >
                        {getStatusIcon(file.status)}
                        <span className="text-sm flex-1 truncate">{file.path}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={() => unstageFile(file)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={isUnstagedOpen} onOpenChange={setIsUnstagedOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground">
                <motion.div
                  animate={{ rotate: isUnstagedOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
                Changes ({unstagedFiles.length})
              </CollapsibleTrigger>
              {unstagedFiles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={stageAll}
                >
                  Stage All
                </Button>
              )}
            </div>
            <CollapsibleContent>
              <AnimatePresence>
                {unstagedFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 pl-6">
                    No changes
                  </p>
                ) : (
                  <div className="space-y-1 mt-2">
                    {unstagedFiles.map((file) => (
                      <motion.div
                        key={file.path}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 group"
                      >
                        {getStatusIcon(file.status)}
                        <span className="text-sm flex-1 truncate">{file.path}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={() => stageFile(file)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      <div className="p-3 border-t space-y-2">
        <div className="flex items-center gap-2">
          <Textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="min-h-[60px] resize-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={generateCommitMessage}
            disabled={isGeneratingMessage || stagedFiles.length === 0}
          >
            {isGeneratingMessage ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <GitCommit className="h-3 w-3" />
            )}
            AI Message
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2"
            onClick={handleCommit}
            disabled={isLoading || !commitMessage.trim() || stagedFiles.length === 0}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Commit
          </Button>
        </div>
      </div>

      <Dialog open={isNewBranchDialogOpen} onOpenChange={setIsNewBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="feature/my-feature"
              onKeyDown={(e) => e.key === "Enter" && handleCreateBranch()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewBranchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
