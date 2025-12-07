import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, PanelLeftClose, PanelLeft } from 'lucide-react';
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
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import UserMenu from '@/components/layout/UserMenu';
import FileTree from '@/components/editor/FileTree';
import CodeTabs from '@/components/editor/CodeTabs';
import CodeEditor from '@/components/editor/CodeEditor';
import Console from '@/components/editor/Console';
import RunButton from '@/components/editor/RunButton';
import SaveStatus from '@/components/editor/SaveStatus';
import PageTransition from '@/components/layout/PageTransition';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import type { FileNode } from '@shared/schema';
import type { OpenTab } from '@/lib/types';

interface Project {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  language: string;
  files: FileNode;
}

interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTime?: number;
}

function deepCloneFileNode(node: FileNode): FileNode {
  return JSON.parse(JSON.stringify(node));
}

function updateFileInTree(root: FileNode, targetPath: string, newContent: string): FileNode {
  const cloned = deepCloneFileNode(root);
  const parts = targetPath.split('/').filter(Boolean);
  
  function traverse(node: FileNode, pathIndex: number): boolean {
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

export default function Editor() {
  const params = useParams();
  const projectId = params.id || '1';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'unsaved'>('saved');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    enabled: isAuthenticated && !authLoading,
  });

  const saveMutation = useMutation({
    mutationFn: async (files: FileNode) => {
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
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Session expired',
          description: 'Please log in again to continue.',
          variant: 'destructive',
        });
        setLocation('/login');
      } else {
        toast({
          title: 'Save failed',
          description: 'Failed to save your changes. Please try again.',
          variant: 'destructive',
        });
      }
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
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Session expired',
          description: 'Please log in again to continue.',
          variant: 'destructive',
        });
        setLocation('/login');
      } else {
        setConsoleErrors(['Error: Failed to execute code']);
        toast({
          title: 'Execution failed',
          description: 'Failed to run your code. Please try again.',
          variant: 'destructive',
        });
      }
    },
  });

  useEffect(() => {
    if (projectError) {
      if (isUnauthorizedError(projectError as Error)) {
        toast({
          title: 'Session expired',
          description: 'Please log in again to continue.',
          variant: 'destructive',
        });
        setLocation('/login');
      }
    }
  }, [projectError, toast, setLocation]);

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

  if (!authLoading && !isAuthenticated) {
    setLocation('/login');
    return null;
  }

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

  const activeTabData = openTabs.find((t) => t.path === activeTab);

  if (authLoading || projectLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-lg"
          data-testid="loading-indicator"
        >
          Loading project...
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
            <Button data-testid="button-back-to-dashboard">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b shrink-0 h-14">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Logo size="sm" showText={false} />
          <div className="h-4 w-px bg-border" />
          <span className="font-medium text-sm" data-testid="text-project-name">
            {project.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={saveStatus} />
          <RunButton isRunning={runMutation.isPending} onClick={handleRun} />
          <div className="h-4 w-px bg-border" />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <AnimatePresence initial={false}>
            {isSidebarOpen && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 'auto' }}
                exit={{ width: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
                  <div className="h-full bg-muted/20 flex flex-col">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        Explorer
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setIsSidebarOpen(false)}
                        data-testid="button-hide-sidebar"
                      >
                        <PanelLeftClose className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <FileTree
                        files={project.files}
                        activeFile={activeTab}
                        onFileSelect={handleFileSelect}
                        onCreateFile={handleCreateFile}
                        onCreateFolder={handleCreateFolder}
                        onRename={handleRenameItem}
                        onDelete={handleDeleteItem}
                      />
                    </div>
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
              </motion.div>
            )}
          </AnimatePresence>

          <ResizablePanel defaultSize={80}>
            <div className="h-full flex flex-col">
              {!isSidebarOpen && (
                <div className="absolute left-2 top-16 z-10">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsSidebarOpen(true)}
                    data-testid="button-show-sidebar"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <CodeTabs
                tabs={openTabs}
                activeTab={activeTab}
                onTabSelect={handleTabSelect}
                onTabClose={handleTabClose}
              />

              <div className="flex-1 min-h-0">
                {activeTabData ? (
                  <CodeEditor
                    value={activeTabData.content}
                    onChange={handleEditorChange}
                    language={
                      activeTabData.name.endsWith('.json')
                        ? 'json'
                        : activeTabData.name.endsWith('.md')
                        ? 'markdown'
                        : 'javascript'
                    }
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <p className="mb-2">No file open</p>
                      <p className="text-sm">Select a file from the explorer to start editing</p>
                    </div>
                  </div>
                )}
              </div>

              <Console
                output={consoleOutput}
                errors={consoleErrors}
                isRunning={runMutation.isPending}
                onClear={handleClearConsole}
              />
            </div>
          </ResizablePanel>
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
              data-testid="input-new-file-name"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmNewFile()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmNewFile} data-testid="button-confirm-new-file">
              Create
            </Button>
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
              data-testid="input-new-folder-name"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmNewFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmNewFolder} data-testid="button-confirm-new-folder">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
