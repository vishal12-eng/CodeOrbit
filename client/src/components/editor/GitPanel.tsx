import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Package,
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
  Trash2,
  RotateCcw,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GitFile {
  path: string;
  status: "added" | "modified" | "deleted" | "untracked" | "staged";
}

interface GitBranchData {
  name: string;
  current: boolean;
}

interface GitStash {
  index: number;
  message: string;
}

interface GitStatus {
  current: string | null;
  tracking: string | null;
  staged: Array<{ path: string; status: string }>;
  modified: Array<{ path: string; status: string }>;
  not_added: Array<{ path: string; status: string }>;
  deleted: Array<{ path: string; status: string }>;
  isClean: boolean;
}

interface GitPanelProps {
  projectId: string;
  onRefresh?: () => void;
}

export default function GitPanel({ projectId, onRefresh }: GitPanelProps) {
  const { toast } = useToast();
  
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [branches, setBranches] = useState<GitBranchData[]>([]);
  const [stagedFiles, setStagedFiles] = useState<GitFile[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<GitFile[]>([]);
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [isNewBranchDialogOpen, setIsNewBranchDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isStashDialogOpen, setIsStashDialogOpen] = useState(false);
  const [isDeleteBranchDialogOpen, setIsDeleteBranchDialogOpen] = useState(false);
  
  const [newBranchName, setNewBranchName] = useState("");
  const [mergeBranch, setMergeBranch] = useState<string | null>(null);
  const [deleteBranchName, setDeleteBranchName] = useState<string | null>(null);
  const [stashMessage, setStashMessage] = useState("");
  
  const [isStagedOpen, setIsStagedOpen] = useState(true);
  const [isUnstagedOpen, setIsUnstagedOpen] = useState(true);
  const [isStashesOpen, setIsStashesOpen] = useState(false);

  const getStatusIcon = (status: GitFile["status"]) => {
    switch (status) {
      case "added":
        return <FilePlus className="h-4 w-4 text-green-500" />;
      case "modified":
        return <FileEdit className="h-4 w-4 text-yellow-500" />;
      case "deleted":
        return <FileX className="h-4 w-4 text-red-500" />;
      case "untracked":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "staged":
        return <Check className="h-4 w-4 text-green-500" />;
    }
  };

  const fetchGitStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await apiRequest("GET", `/api/projects/${projectId}/git/status`);
      const status: GitStatus = await response.json();
      
      if (status.current) {
        setIsInitialized(true);
        setCurrentBranch(status.current);
        
        const staged: GitFile[] = status.staged.map(f => ({
          path: f.path,
          status: "staged" as const,
        }));
        setStagedFiles(staged);
        
        const unstaged: GitFile[] = [
          ...status.modified.map(f => ({ path: f.path, status: "modified" as const })),
          ...status.not_added.map(f => ({ path: f.path, status: "untracked" as const })),
          ...status.deleted.map(f => ({ path: f.path, status: "deleted" as const })),
        ];
        setUnstagedFiles(unstaged);
      } else {
        setIsInitialized(false);
      }
    } catch (error) {
      console.error("Failed to fetch git status:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId]);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await apiRequest("GET", `/api/projects/${projectId}/git/branches`);
      const branchList: GitBranchData[] = await response.json();
      setBranches(branchList);
      
      const current = branchList.find(b => b.current);
      if (current) {
        setCurrentBranch(current.name);
      }
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    }
  }, [projectId]);

  const fetchStashes = useCallback(async () => {
    try {
      const response = await apiRequest("GET", `/api/projects/${projectId}/git/stash`);
      const stashList: GitStash[] = await response.json();
      setStashes(stashList);
    } catch (error) {
      console.error("Failed to fetch stashes:", error);
    }
  }, [projectId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchGitStatus(), fetchBranches(), fetchStashes()]);
    onRefresh?.();
  }, [fetchGitStatus, fetchBranches, fetchStashes, onRefresh]);

  useEffect(() => {
    refreshAll();
  }, [projectId]);

  const initRepo = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/init`);
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Repository initialized", description: result.message });
        await refreshAll();
      } else {
        toast({ title: "Failed to initialize", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to initialize repository", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const stageFile = async (file: GitFile) => {
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/add`, {
        files: [file.path],
      });
      const result = await response.json();
      
      if (result.success) {
        await fetchGitStatus();
      } else {
        toast({ title: "Failed to stage", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to stage file", variant: "destructive" });
    }
  };

  const unstageFile = async (file: GitFile) => {
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/unstage`, {
        file: file.path,
      });
      const result = await response.json();
      
      if (result.success) {
        await fetchGitStatus();
      } else {
        toast({ title: "Failed to unstage", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to unstage file", variant: "destructive" });
    }
  };

  const stageAll = async () => {
    try {
      const files = unstagedFiles.map(f => f.path);
      if (files.length === 0) return;
      
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/add`, { files });
      const result = await response.json();
      
      if (result.success) {
        await fetchGitStatus();
      } else {
        toast({ title: "Failed to stage all", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to stage files", variant: "destructive" });
    }
  };

  const unstageAll = async () => {
    for (const file of stagedFiles) {
      await unstageFile(file);
    }
  };

  const generateCommitMessage = async () => {
    setIsGeneratingMessage(true);
    try {
      const diff = stagedFiles.map((f) => `${f.status}: ${f.path}`).join("\n");
      const response = await apiRequest("POST", "/api/ai/commit-message", { diff });
      const data = await response.json();
      setCommitMessage(data.message || "Update files");
    } catch (error) {
      setCommitMessage("Update project files");
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/commit`, {
        message: commitMessage,
      });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Committed", description: result.message });
        setCommitMessage("");
        await refreshAll();
      } else {
        toast({ title: "Commit failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to commit", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/branch`, {
        name: newBranchName.trim(),
      });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Branch created", description: result.message });
        setNewBranchName("");
        setIsNewBranchDialogOpen(false);
        await refreshAll();
      } else {
        toast({ title: "Failed to create branch", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create branch", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchBranch = async (branch: string) => {
    if (branch === currentBranch) return;
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/checkout`, {
        branch,
      });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Switched branch", description: result.message });
        await refreshAll();
      } else {
        toast({ title: "Failed to switch", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to switch branch", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!deleteBranchName) return;
    setIsLoading(true);
    
    try {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}/git/branch/${encodeURIComponent(deleteBranchName)}`);
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Branch deleted", description: result.message });
        setDeleteBranchName(null);
        setIsDeleteBranchDialogOpen(false);
        await refreshAll();
      } else {
        toast({ title: "Failed to delete branch", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete branch", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeBranch) return;
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/merge`, {
        branch: mergeBranch,
      });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Merge complete", description: result.message });
        setMergeBranch(null);
        setIsMergeDialogOpen(false);
        await refreshAll();
      } else {
        toast({ title: "Merge failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to merge branch", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStash = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/stash`, {
        message: stashMessage || undefined,
      });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Changes stashed", description: result.message });
        setStashMessage("");
        setIsStashDialogOpen(false);
        await refreshAll();
      } else {
        toast({ title: "Stash failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to stash changes", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStashPop = async (index?: number) => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/git/stash/pop`, {
        index,
      });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Stash applied", description: result.message });
        await refreshAll();
      } else {
        toast({ title: "Failed to apply stash", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to pop stash", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStashDrop = async (index: number) => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}/git/stash/${index}`);
      const result = await response.json();
      
      if (result.success) {
        toast({ title: "Stash dropped", description: result.message });
        await refreshAll();
      } else {
        toast({ title: "Failed to drop stash", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to drop stash", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <span className="font-semibold">Source Control</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No git repository found. Initialize one to start tracking changes.
          </p>
          <Button onClick={initRepo} disabled={isLoading} data-testid="button-git-init">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitBranch className="h-4 w-4 mr-2" />}
            Initialize Repository
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between p-3 border-b gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          <span className="font-semibold">Source Control</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refreshAll()}
          disabled={isRefreshing}
          data-testid="button-git-refresh"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <select
            value={currentBranch || ""}
            onChange={(e) => handleSwitchBranch(e.target.value)}
            className="flex-1 bg-muted/50 border rounded px-2 py-1 text-sm"
            disabled={isLoading}
            data-testid="select-git-branch"
          >
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-git-branch-menu">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsNewBranchDialogOpen(true)} data-testid="menu-item-new-branch">
                <Plus className="h-4 w-4 mr-2" />
                New Branch
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setIsMergeDialogOpen(true)}
                disabled={branches.length < 2}
                data-testid="menu-item-merge-branch"
              >
                <GitMerge className="h-4 w-4 mr-2" />
                Merge Branch
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const nonCurrentBranches = branches.filter(b => !b.current);
                  if (nonCurrentBranches.length > 0) {
                    setDeleteBranchName(nonCurrentBranches[0].name);
                    setIsDeleteBranchDialogOpen(true);
                  }
                }}
                disabled={branches.length < 2}
                className="text-destructive focus:text-destructive"
                data-testid="menu-item-delete-branch"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Branch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <Collapsible open={isStagedOpen} onOpenChange={setIsStagedOpen}>
            <div className="flex items-center justify-between gap-2">
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
                  data-testid="button-unstage-all"
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
                        data-testid={`staged-file-${file.path}`}
                      >
                        {getStatusIcon(file.status)}
                        <span className="text-sm flex-1 truncate">{file.path}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={() => unstageFile(file)}
                          data-testid={`button-unstage-${file.path}`}
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
            <div className="flex items-center justify-between gap-2">
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
                  data-testid="button-stage-all"
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
                        data-testid={`unstaged-file-${file.path}`}
                      >
                        {getStatusIcon(file.status)}
                        <span className="text-sm flex-1 truncate">{file.path}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={() => stageFile(file)}
                          data-testid={`button-stage-${file.path}`}
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

          <Collapsible open={isStashesOpen} onOpenChange={setIsStashesOpen}>
            <div className="flex items-center justify-between gap-2">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground">
                <motion.div
                  animate={{ rotate: isStashesOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
                <Archive className="h-4 w-4" />
                Stashes ({stashes.length})
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setIsStashDialogOpen(true)}
                disabled={unstagedFiles.length === 0 && stagedFiles.length === 0}
                data-testid="button-stash-changes"
              >
                Stash
              </Button>
            </div>
            <CollapsibleContent>
              <AnimatePresence>
                {stashes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 pl-6">
                    No stashes
                  </p>
                ) : (
                  <div className="space-y-1 mt-2">
                    {stashes.map((stash) => (
                      <motion.div
                        key={stash.index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 group"
                        data-testid={`stash-${stash.index}`}
                      >
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">
                          stash@{"{" + stash.index + "}"}: {stash.message}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={() => handleStashPop(stash.index)}
                          title="Apply stash"
                          data-testid={`button-stash-pop-${stash.index}`}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => handleStashDrop(stash.index)}
                          title="Drop stash"
                          data-testid={`button-stash-drop-${stash.index}`}
                        >
                          <Trash2 className="h-3 w-3" />
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
            data-testid="input-commit-message"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={generateCommitMessage}
            disabled={isGeneratingMessage || stagedFiles.length === 0}
            data-testid="button-generate-commit-message"
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
            data-testid="button-commit"
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
            <DialogDescription>
              Enter a name for the new branch. It will be created from the current branch.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="feature/my-feature"
              onKeyDown={(e) => e.key === "Enter" && handleCreateBranch()}
              data-testid="input-new-branch-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewBranchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={isLoading} data-testid="button-create-branch-confirm">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Branch</DialogTitle>
            <DialogDescription>
              Select a branch to merge into {currentBranch}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <select
              value={mergeBranch || ""}
              onChange={(e) => setMergeBranch(e.target.value)}
              className="w-full bg-muted/50 border rounded px-3 py-2 text-sm"
              data-testid="select-merge-branch"
            >
              <option value="">Select a branch...</option>
              {branches
                .filter(b => b.name !== currentBranch)
                .map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={isLoading || !mergeBranch} data-testid="button-merge-confirm">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStashDialogOpen} onOpenChange={setIsStashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stash Changes</DialogTitle>
            <DialogDescription>
              Save your uncommitted changes temporarily. You can optionally add a message.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={stashMessage}
              onChange={(e) => setStashMessage(e.target.value)}
              placeholder="Optional stash message..."
              onKeyDown={(e) => e.key === "Enter" && handleStash()}
              data-testid="input-stash-message"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStashDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStash} disabled={isLoading} data-testid="button-stash-confirm">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Stash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteBranchDialogOpen} onOpenChange={setIsDeleteBranchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Select a branch to delete. You cannot delete the current branch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <select
              value={deleteBranchName || ""}
              onChange={(e) => setDeleteBranchName(e.target.value)}
              className="w-full bg-muted/50 border rounded px-3 py-2 text-sm"
              data-testid="select-delete-branch"
            >
              {branches
                .filter(b => b.name !== currentBranch)
                .map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBranch}
              disabled={isLoading || !deleteBranchName}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-branch-confirm"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
