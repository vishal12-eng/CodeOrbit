import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Sparkles,
  FolderTree,
  GitBranch,
  Settings,
  Globe,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { Link, useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import UserMenu from '@/components/layout/UserMenu';
import FileTree from '@/components/editor/FileTree';
import CodeTabs from '@/components/editor/CodeTabs';
import CodeEditor from '@/components/editor/CodeEditor';
import Console from '@/components/editor/Console';
import RunButton from '@/components/editor/RunButton';
import SaveStatus from '@/components/editor/SaveStatus';
import Terminal, { TerminalToggle } from '@/components/editor/Terminal';
import WebPreview from '@/components/editor/WebPreview';
import GitPanel from '@/components/editor/GitPanel';
import AIPanel from '@/components/ai/AIPanel';
import PageTransition from '@/components/layout/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import type { FileNode as FileNodeType } from '@shared/schema';
import type { OpenTab } from '@/lib/types';

interface Project {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  language: string;
  files: FileNodeType;
}

interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTime?: number;
}

type LeftPanelTab = 'files' | 'git' | 'settings';

function deepCloneFileNode(node: FileNodeType): FileNodeType {
  return JSON.parse(JSON.stringify(node));
}

function updateFileInTree(root: FileNodeType, targetPath: string, newContent: string): FileNodeType {
  const cloned = deepCloneFileNode(root);
  const parts = targetPath.split('/').filter(Boolean);

  function traverse(node: FileNodeType, pathIndex: number): boolean {
    const currentPart = parts[pathIndex];

    if (node.type === 'folder' && node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.name === currentPart) {
          if (pathIndex === parts.length - 1) {
            if (child.type === 'file') {
              child.content = newContent;
              return true;
            }
          } else {
            return traverse(child, pathIndex + 1);
          }
        }
      }
    }
    return false;
  }

  if (parts[0] === 'root') {
    traverse(cloned, 1);
  } else {
    traverse(cloned, 0);
  }

  return cloned;
}

function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sh: 'shell',
    bash: 'shell',
  };
  return languageMap[ext || ''] || 'plaintext';
}

function getProjectStructure(files: FileNodeType, prefix = ''): string {
  let result = '';
  if (files.type === 'folder' && files.children) {
    for (const child of files.children) {
      const path = prefix ? `${prefix}/${child.name}` : child.name;
      result += `${path}\n`;
      if (child.type === 'folder') {
        result += getProjectStructure(child, path);
      }
    }
  }
  return result;
}

export default function Editor() {
  const params = useParams();
  const projectId = params.id || '1';
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'unsaved'>('saved');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);
  const [isWebPreviewOpen, setIsWebPreviewOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('files');
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);

  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newItemPath, setNewItemPath] = useState('');
  const [newItemName, setNewItemName] = useState('');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<{ path: string; content: string } | null>(null);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
  });

  const saveMutation = useMutation({
    mutationFn: async (files: FileNodeType) => {
      const response = await apiRequest('PUT', `/api/projects/${projectId}`, { files });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      setOpenTabs((tabs) =>
        tabs.map((t) => (t.path === activeTab ? { ...t, isDirty: false } : t))
      );
      setSaveStatus('saved');
    },
    onError: (error: Error) => {
      setSaveStatus('error');
      toast({
        title: 'Save failed',
        description: 'Failed to save your changes. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/run/${projectId}`);
      return response.json() as Promise<RunResult>;
    },
    onSuccess: (data: RunResult) => {
      const output: string[] = [];
      const errors: string[] = [];

      if (data.stdout) {
        output.push(...data.stdout.split('\n').filter(Boolean));
      }
      if (data.stderr) {
        errors.push(...data.stderr.split('\n').filter(Boolean));
      }
      if (!data.stdout && !data.stderr) {
        output.push('Program executed successfully (no output)');
      }

      setConsoleOutput(output);
      setConsoleErrors(errors);

      toast({
        title: data.success ? 'Execution complete' : 'Execution failed',
        description: data.executionTime
          ? `Completed in ${data.executionTime}ms`
          : 'Your code has finished running.',
        variant: data.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      setConsoleErrors(['Error: Failed to execute code']);
      toast({
        title: 'Execution failed',
        description: 'Failed to run your code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (projectError) {
      toast({
        title: 'Error loading project',
        description: 'Failed to load your project. Please try again.',
        variant: 'destructive',
      });
    }
  }, [projectError, toast]);

  useEffect(() => {
    if (project && openTabs.length === 0) {
      const mainFile = project.files.children?.find(
        (f) => f.type === 'file' && f.name === 'main.js'
      );
      if (mainFile && mainFile.content !== undefined) {
        const path = `/root/${mainFile.name}`;
        setOpenTabs([{ path, name: mainFile.name, content: mainFile.content, isDirty: false }]);
        setActiveTab(path);
      }
    }
  }, [project, openTabs.length]);


  const handleFileSelect = (path: string, content: string) => {
    const name = path.split('/').pop() || '';
    const existingTab = openTabs.find((t) => t.path === path);
    if (existingTab) {
      setActiveTab(path);
    } else {
      setOpenTabs([...openTabs, { path, name, content, isDirty: false }]);
      setActiveTab(path);
    }
  };

  const handleTabSelect = (path: string) => {
    setActiveTab(path);
  };

  const handleTabClose = (path: string) => {
    const newTabs = openTabs.filter((t) => t.path !== path);
    setOpenTabs(newTabs);
    if (activeTab === path) {
      setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1].path : null);
    }
  };

  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeTab || !project) return;

      setOpenTabs((tabs) =>
        tabs.map((t) =>
          t.path === activeTab ? { ...t, content: value, isDirty: true } : t
        )
      );
      setSaveStatus('unsaved');

      pendingContentRef.current = { path: activeTab, content: value };

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        if (pendingContentRef.current && project) {
          setSaveStatus('saving');
          const updatedFiles = updateFileInTree(
            project.files,
            pendingContentRef.current.path,
            pendingContentRef.current.content
          );
          saveMutation.mutate(updatedFiles);
        }
      }, 1500);
    },
    [activeTab, project, saveMutation]
  );

  const handleRun = async () => {
    if (!project) return;
    setConsoleOutput([]);
    setConsoleErrors([]);
    runMutation.mutate();
  };

  const handleClearConsole = () => {
    setConsoleOutput([]);
    setConsoleErrors([]);
  };

  const handleCreateFile = (path: string) => {
    setNewItemPath(path);
    setNewItemName('');
    setIsNewFileDialogOpen(true);
  };

  const handleCreateFolder = (path: string) => {
    setNewItemPath(path);
    setNewItemName('');
    setIsNewFolderDialogOpen(true);
  };

  const handleConfirmNewFile = () => {
    if (!newItemName.trim() || !project) return;
    const fileName = newItemName.includes('.') ? newItemName : `${newItemName}.js`;
    toast({
      title: 'File created',
      description: `"${fileName}" has been created.`,
    });
    setIsNewFileDialogOpen(false);
  };

  const handleConfirmNewFolder = () => {
    if (!newItemName.trim() || !project) return;
    toast({
      title: 'Folder created',
      description: `"${newItemName}" has been created.`,
    });
    setIsNewFolderDialogOpen(false);
  };

  const handleRenameItem = (path: string) => {
    toast({
      title: 'Rename',
      description: 'Rename functionality would open here.',
    });
  };

  const handleDeleteItem = (path: string) => {
    toast({
      title: 'Delete',
      description: 'Delete confirmation would open here.',
    });
  };

  const handleApplyAICode = (code: string) => {
    if (!activeTab) return;
    handleEditorChange(code);
    toast({
      title: 'Code applied',
      description: 'AI-generated code has been applied to the current file.',
    });
  };

  const activeTabData = openTabs.find((t) => t.path === activeTab);
  const currentFileInfo = activeTabData
    ? {
        path: activeTabData.path,
        content: activeTabData.content,
        language: getFileLanguage(activeTabData.name),
      }
    : undefined;

  if (projectLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-lg flex items-center gap-2"
        >
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          Loading NovaCode IDE...
        </motion.div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg mb-4">Project not found</p>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-3 border-b shrink-0 h-12 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          {!isSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              data-testid="button-open-sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Logo size="sm" showText={false} />
          <div className="h-4 w-px bg-border" />
          <span className="font-medium text-sm truncate max-w-[200px]">{project.name}</span>
          <SaveStatus status={saveStatus} />
        </div>
        <div className="flex items-center gap-1">
          <TerminalToggle isOpen={isTerminalOpen} onToggle={() => setIsTerminalOpen(!isTerminalOpen)} />
          <Button
            variant={isWebPreviewOpen ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setIsWebPreviewOpen(!isWebPreviewOpen)}
            className="gap-1.5"
            data-testid="button-toggle-preview"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <RunButton isRunning={runMutation.isPending} onClick={handleRun} />
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            variant={isAIPanelOpen ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            data-testid="button-toggle-ai"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {isSidebarOpen && (
            <>
              <ResizablePanel defaultSize={18} minSize={12} maxSize={30} className="min-w-[180px]">
                <div className="h-full bg-muted/30 flex flex-col border-r">
                  <div className="flex items-center gap-1 px-2 py-2 border-b bg-background/50">
                    <Tabs
                      value={leftPanelTab}
                      onValueChange={(v) => setLeftPanelTab(v as LeftPanelTab)}
                      className="flex-1"
                    >
                      <TabsList className="h-8 w-full grid grid-cols-3 bg-muted/50">
                        <TabsTrigger value="files" className="text-xs gap-1 px-1.5 data-[state=active]:bg-background">
                          <FolderTree className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Files</span>
                        </TabsTrigger>
                        <TabsTrigger value="git" className="text-xs gap-1 px-1.5 data-[state=active]:bg-background">
                          <GitBranch className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Git</span>
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="text-xs gap-1 px-1.5 data-[state=active]:bg-background">
                          <Settings className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Settings</span>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setIsSidebarOpen(false)}
                      data-testid="button-close-sidebar"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {leftPanelTab === 'files' && (
                      <FileTree
                        files={project.files}
                        activeFile={activeTab}
                        onFileSelect={handleFileSelect}
                        onCreateFile={handleCreateFile}
                        onCreateFolder={handleCreateFolder}
                        onRename={handleRenameItem}
                        onDelete={handleDeleteItem}
                      />
                    )}
                    {leftPanelTab === 'git' && (
                      <GitPanel projectId={projectId} />
                    )}
                    {leftPanelTab === 'settings' && (
                      <div className="p-3 space-y-4">
                        <h3 className="font-medium text-sm">Editor Settings</h3>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Font Size</Label>
                          <Input type="number" defaultValue={14} min={10} max={24} className="h-8" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Tab Size</Label>
                          <Input type="number" defaultValue={2} min={2} max={8} className="h-8" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle className="w-1 bg-border/50 hover:bg-primary/20 transition-colors" />
            </>
          )}

          <ResizablePanel defaultSize={isAIPanelOpen ? 55 : 82} minSize={30}>
            <div className="h-full flex flex-col bg-background">
              <CodeTabs
                tabs={openTabs}
                activeTab={activeTab}
                onTabSelect={handleTabSelect}
                onTabClose={handleTabClose}
              />

              <div className="flex-1 min-h-0 flex flex-col">
                <ResizablePanelGroup direction="vertical" className="flex-1">
                  <ResizablePanel defaultSize={isTerminalOpen ? 55 : 70} minSize={20}>
                    {activeTabData ? (
                      <CodeEditor
                        value={activeTabData.content}
                        onChange={handleEditorChange}
                        language={getFileLanguage(activeTabData.name)}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/10">
                        <div className="text-center">
                          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
                          <p className="mb-1 font-medium">No file open</p>
                          <p className="text-sm text-muted-foreground/70">Select a file from the explorer to start editing</p>
                        </div>
                      </div>
                    )}
                  </ResizablePanel>
                  <ResizableHandle withHandle className="h-1 bg-border/50 hover:bg-primary/20 transition-colors" />
                  <ResizablePanel defaultSize={isTerminalOpen ? 20 : 30} minSize={10} maxSize={50}>
                    <Console
                      output={consoleOutput}
                      errors={consoleErrors}
                      isRunning={runMutation.isPending}
                      onClear={handleClearConsole}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>

                <Terminal
                  projectId={projectId}
                  isOpen={isTerminalOpen}
                  onToggle={() => setIsTerminalOpen(!isTerminalOpen)}
                />
              </div>
            </div>
          </ResizablePanel>

          {isWebPreviewOpen && (
            <>
              <ResizableHandle withHandle className="w-1 bg-border/50 hover:bg-primary/20 transition-colors" />
              <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
                <WebPreview
                  isOpen={isWebPreviewOpen}
                  onClose={() => setIsWebPreviewOpen(false)}
                  projectId={projectId}
                />
              </ResizablePanel>
            </>
          )}

          {isAIPanelOpen && (
            <>
              <ResizableHandle withHandle className="w-1 bg-border/50 hover:bg-primary/20 transition-colors" />
              <ResizablePanel defaultSize={27} minSize={18} maxSize={45}>
                <AIPanel
                  currentFile={currentFileInfo}
                  onApplyCode={handleApplyAICode}
                  projectContext={project ? getProjectStructure(project.files) : undefined}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <Dialog open={isNewFileDialogOpen} onOpenChange={setIsNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="index.js"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmNewFile()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmNewFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folderName">Folder Name</Label>
            <Input
              id="folderName"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="components"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmNewFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmNewFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
