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
  Wand2,
  WandSparkles,
  Rocket,
  Undo2,
  Redo2,
  Search,
  FileCode,
} from 'lucide-react';
import { Link, useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import UserMenu from '@/components/layout/UserMenu';
import FileTree from '@/components/editor/FileTree';
import CodeTabs from '@/components/editor/CodeTabs';
import CodeEditor, { type CodeEditorRef } from '@/components/editor/CodeEditor';
import Console, { type LogEntry } from '@/components/editor/Console';
import RunButton, { type RunnerType, RUNNER_OPTIONS } from '@/components/editor/RunButton';
import SaveStatus from '@/components/editor/SaveStatus';
import Terminal, { TerminalToggle } from '@/components/editor/Terminal';
import WebPreview from '@/components/editor/WebPreview';
import GitPanel from '@/components/editor/GitPanel';
import SearchPanel from '@/components/editor/SearchPanel';
import InlineSuggestion from '@/components/editor/InlineSuggestion';
import AIPanel from '@/components/ai/AIPanel';
import BuilderMode from '@/components/ai/BuilderMode';
import OneShotCreator from '@/components/ai/OneShotCreator';
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
  previewUrl?: string;
}

interface DetectedType {
  projectType: string;
  projectTypeLabel: string;
}

type LeftPanelTab = 'files' | 'git' | 'search' | 'settings';

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

function flattenFiles(node: FileNodeType, path = ''): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  if (node.type === 'file' && node.content !== undefined) {
    files.push({ path: path + node.name, content: node.content });
  } else if (node.type === 'folder' && node.children) {
    const folderPath = node.name === 'root' ? path : path + node.name + '/';
    for (const child of node.children) {
      files.push(...flattenFiles(child, folderPath));
    }
  }
  return files;
}

function mapProjectTypeToRunner(projectType: string): RunnerType {
  const mapping: Record<string, RunnerType> = {
    'nodejs': 'nodejs',
    'python': 'python',
    'react-cra': 'react',
    'react-vite': 'react',
    'nextjs': 'nextjs',
    'static-html': 'static',
  };
  return mapping[projectType] || 'nodejs';
}

function isWebProject(runner: RunnerType): boolean {
  return ['react', 'nextjs', 'static'].includes(runner);
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

  const [selectedRunner, setSelectedRunner] = useState<RunnerType>('nodejs');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [executionTime, setExecutionTime] = useState<number | undefined>(undefined);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [serverLogs, setServerLogs] = useState<LogEntry[]>([]);

  const [isBuilderModeOpen, setIsBuilderModeOpen] = useState(false);
  const [isOneShotOpen, setIsOneShotOpen] = useState(false);

  const [isInlineOpen, setIsInlineOpen] = useState(false);
  const [inlinePosition, setInlinePosition] = useState<{ line: number; column: number; top: number; left: number }>({ line: 1, column: 1, top: 50, left: 50 });
  const [selectedAIModel, setSelectedAIModel] = useState<string>('gpt-4o');

  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newItemPath, setNewItemPath] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameItemPath, setRenameItemPath] = useState('');
  const [renameItemName, setRenameItemName] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteItemPath, setDeleteItemPath] = useState('');
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [filePickerQuery, setFilePickerQuery] = useState('');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<{ path: string; content: string } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logIdCounter = useRef(0);
  const codeEditorRef = useRef<CodeEditorRef>(null);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
  });

  const { data: detectedType } = useQuery<DetectedType>({
    queryKey: ['/api/projects', projectId, 'detect-type'],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (detectedType?.projectType) {
      const runner = mapProjectTypeToRunner(detectedType.projectType);
      setSelectedRunner(runner);
    }
  }, [detectedType]);

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
      const response = await apiRequest('POST', `/api/run/${projectId}`, {
        language: selectedRunner,
      });
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
      setExecutionTime(data.executionTime);

      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        if (isWebProject(selectedRunner)) {
          setIsWebPreviewOpen(true);
        }
      }

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

  const formatMutation = useMutation({
    mutationFn: async ({ code, language }: { code: string; language: string }) => {
      const response = await apiRequest('POST', '/api/format', { code, language });
      return response.json() as Promise<{ formatted?: string; error?: string; note?: string }>;
    },
    onSuccess: (data, variables) => {
      if (data.formatted !== undefined && activeTab) {
        setOpenTabs((tabs) =>
          tabs.map((t) =>
            t.path === activeTab ? { ...t, content: data.formatted!, isDirty: true } : t
          )
        );
        setSaveStatus('unsaved');
        
        const toastMessage = data.note || 'Code formatted successfully';
        toast({
          title: 'Formatted',
          description: toastMessage,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Format failed',
        description: error.message || 'Failed to format code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleFormatCode = useCallback(() => {
    const tab = openTabs.find((t) => t.path === activeTab);
    if (!tab) return;
    
    const language = getFileLanguage(tab.name);
    formatMutation.mutate({ code: tab.content, language });
  }, [activeTab, openTabs, formatMutation]);

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

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const addLogEntry = useCallback((type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      id: `log-${logIdCounter.current++}`,
      type,
      message,
      timestamp: new Date(),
    };
    setConsoleLogs((prev) => [...prev, entry]);
  }, []);

  const addServerLog = useCallback((type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      id: `server-${logIdCounter.current++}`,
      type,
      message,
      timestamp: new Date(),
    };
    setServerLogs((prev) => [...prev, entry]);
  }, []);

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

  const handleRunWithStreaming = useCallback(() => {
    if (!project) return;

    setConsoleLogs([]);
    setServerLogs([]);
    setConsoleOutput([]);
    setConsoleErrors([]);
    setExecutionTime(undefined);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const streamUrl = `/api/run/${projectId}/stream?language=${selectedRunner}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    addLogEntry('system', `Starting ${RUNNER_OPTIONS.find(r => r.id === selectedRunner)?.label || selectedRunner} runner...`);

    eventSource.addEventListener('start', (event) => {
      const data = JSON.parse(event.data);
      addLogEntry('info', `Execution started at ${new Date(data.timestamp).toLocaleTimeString()}`);
    });

    eventSource.addEventListener('stdout', (event) => {
      const data = JSON.parse(event.data);
      addLogEntry('stdout', data.output);
    });

    eventSource.addEventListener('stderr', (event) => {
      const data = JSON.parse(event.data);
      const isWarning = data.output.toLowerCase().includes('warning');
      addLogEntry(isWarning ? 'warning' : 'stderr', data.output);
    });

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      setExecutionTime(data.executionTime);
      
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        if (isWebProject(selectedRunner)) {
          setIsWebPreviewOpen(true);
        }
      }

      addLogEntry('system', `Execution ${data.success ? 'completed' : 'failed'}${data.executionTime ? ` in ${data.executionTime}ms` : ''}`);
      
      eventSource.close();
      eventSourceRef.current = null;

      toast({
        title: data.success ? 'Execution complete' : 'Execution failed',
        description: data.executionTime
          ? `Completed in ${data.executionTime}ms`
          : 'Your code has finished running.',
        variant: data.success ? 'default' : 'destructive',
      });
    });

    eventSource.addEventListener('error', (event) => {
      addLogEntry('stderr', 'Streaming error occurred');
      eventSource.close();
      eventSourceRef.current = null;
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
      }
    };
  }, [project, projectId, selectedRunner, addLogEntry, toast]);

  const handleImmediateSave = useCallback(() => {
    if (!activeTab || !project) return;
    
    const currentTab = openTabs.find(t => t.path === activeTab);
    if (!currentTab || !currentTab.isDirty) {
      toast({
        title: 'Already saved',
        description: 'No changes to save.',
      });
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setSaveStatus('saving');
    const updatedFiles = updateFileInTree(project.files, activeTab, currentTab.content);
    saveMutation.mutate(updatedFiles);
  }, [activeTab, project, openTabs, saveMutation, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === 's') {
        e.preventDefault();
        handleImmediateSave();
      }

      if (modKey && e.key === 'Enter') {
        e.preventDefault();
        handleRunWithStreaming();
      }

      if (modKey && e.key === 'f') {
        e.preventDefault();
        setIsSidebarOpen(true);
        setLeftPanelTab('search');
      }

      if (modKey && e.key === 'p') {
        e.preventDefault();
        setIsFilePickerOpen(true);
        setFilePickerQuery('');
      }

      if (modKey && e.key === 'i') {
        e.preventDefault();
        setIsInlineOpen((prev) => !prev);
        if (!isInlineOpen) {
          setInlinePosition({ line: 1, column: 1, top: 100, left: 100 });
        }
      }

      if (modKey && e.key === 'u') {
        e.preventDefault();
        setIsAIPanelOpen((prev) => !prev);
      }

      if (modKey && e.key === '.') {
        e.preventDefault();
        setIsBuilderModeOpen(true);
      }

      if (modKey && e.key === 'k') {
        e.preventDefault();
        setIsTerminalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleImmediateSave, handleRunWithStreaming, isInlineOpen]);

  const handleRun = async () => {
    if (!project) return;
    handleRunWithStreaming();
  };

  const handleClearConsole = () => {
    setConsoleOutput([]);
    setConsoleErrors([]);
    setConsoleLogs([]);
    setServerLogs([]);
    setExecutionTime(undefined);
  };

  const handleRunnerChange = (runner: RunnerType) => {
    setSelectedRunner(runner);
    if (isWebProject(runner) && !isWebPreviewOpen) {
      toast({
        title: 'Web project selected',
        description: 'Web preview will open automatically when you run your code.',
      });
    }
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

  const handleConfirmNewFile = async () => {
    if (!newItemName.trim() || !project) return;
    const fileName = newItemName.includes('.') ? newItemName : `${newItemName}.js`;
    const basePath = newItemPath.replace(/^\/root\/?/, '');
    const filePath = basePath ? `${basePath}/${fileName}` : fileName;
    
    try {
      await apiRequest('POST', `/api/projects/${projectId}/files`, {
        path: filePath,
        content: '',
      });
      toast({
        title: 'File created',
        description: `"${fileName}" has been created.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create file',
        variant: 'destructive',
      });
    }
    setIsNewFileDialogOpen(false);
    setNewItemName('');
  };

  const handleConfirmNewFolder = async () => {
    if (!newItemName.trim() || !project) return;
    const basePath = newItemPath.replace(/^\/root\/?/, '');
    const folderPath = basePath ? `${basePath}/${newItemName}` : newItemName;
    
    try {
      await apiRequest('POST', `/api/projects/${projectId}/folders`, {
        path: folderPath,
      });
      toast({
        title: 'Folder created',
        description: `"${newItemName}" has been created.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create folder',
        variant: 'destructive',
      });
    }
    setIsNewFolderDialogOpen(false);
    setNewItemName('');
  };

  const handleRenameItem = (path: string) => {
    setRenameItemPath(path);
    const itemName = path.split('/').pop() || '';
    setRenameItemName(itemName);
    setIsRenameDialogOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!renameItemName.trim() || !renameItemPath) return;
    
    const oldPath = renameItemPath.replace(/^\/root\/?/, '');
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = renameItemName;
    const newPath = pathParts.join('/');
    
    try {
      await apiRequest('PUT', `/api/projects/${projectId}/files/rename`, {
        oldPath,
        newPath,
      });
      
      toast({
        title: 'Renamed',
        description: `Renamed to "${renameItemName}"`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to rename',
        variant: 'destructive',
      });
    }
    setIsRenameDialogOpen(false);
    setRenameItemName('');
    setRenameItemPath('');
  };

  const handleDeleteItem = (path: string) => {
    setDeleteItemPath(path);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItemPath) return;
    
    const itemPath = deleteItemPath.replace(/^\/root\/?/, '');
    const hasExtension = /\.[^/.]+$/.test(itemPath.split('/').pop() || '');
    
    try {
      if (hasExtension) {
        await apiRequest('DELETE', `/api/projects/${projectId}/files?path=${encodeURIComponent(itemPath)}`);
      } else {
        await apiRequest('DELETE', `/api/projects/${projectId}/folders?path=${encodeURIComponent(itemPath)}`);
      }
      
      const tabToClose = openTabs.find(t => t.path.includes(itemPath));
      if (tabToClose) {
        handleTabClose(tabToClose.path);
      }
      
      toast({
        title: 'Deleted',
        description: `"${deleteItemPath.split('/').pop()}" has been deleted.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete',
        variant: 'destructive',
      });
    }
    setIsDeleteDialogOpen(false);
    setDeleteItemPath('');
  };

  const handleApplyAICode = (code: string) => {
    if (!activeTab) return;
    handleEditorChange(code);
    toast({
      title: 'Code applied',
      description: 'AI-generated code has been applied to the current file.',
    });
  };

  const handleBuilderApplyChanges = (files: { path: string; content: string }[]) => {
    if (!project) return;
    
    toast({
      title: 'Changes applied',
      description: `Applied changes to ${files.length} file(s).`,
    });
    setIsBuilderModeOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
  };

  const handleOneShotCreateProject = async (files: { path: string; content: string }[]) => {
    try {
      const response = await apiRequest('POST', '/api/projects', {
        name: 'New Generated Project',
        language: selectedRunner,
        files: {
          type: 'folder',
          name: 'root',
          children: files.map(f => ({
            type: 'file' as const,
            name: f.path.split('/').pop() || f.path,
            content: f.content,
          })),
        },
      });
      const newProject = await response.json();
      
      toast({
        title: 'Project created',
        description: 'Navigating to your new project...',
      });
      
      setIsOneShotOpen(false);
      setLocation(`/editor/${newProject.id}`);
    } catch (error) {
      toast({
        title: 'Failed to create project',
        description: 'There was an error creating your project.',
        variant: 'destructive',
      });
    }
  };

  const activeTabData = openTabs.find((t) => t.path === activeTab);
  const currentFileInfo = activeTabData
    ? {
        path: activeTabData.path,
        content: activeTabData.content,
        language: getFileLanguage(activeTabData.name),
      }
    : undefined;

  const projectFiles = project ? flattenFiles(project.files) : [];

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
          <span className="font-medium text-sm truncate max-w-[200px]" data-testid="text-project-name">
            {project.name}
          </span>
          {detectedType?.projectTypeLabel && (
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-project-type">
              {detectedType.projectTypeLabel}
            </Badge>
          )}
          <SaveStatus status={saveStatus} />
          <div className="h-4 w-px bg-border mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => codeEditorRef.current?.undo()}
                disabled={!activeTabData}
                data-testid="button-undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => codeEditorRef.current?.redo()}
                disabled={!activeTabData}
                data-testid="button-redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Redo (Ctrl+Shift+Z)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFormatCode}
                disabled={!activeTabData || formatMutation.isPending}
                data-testid="button-format"
              >
                <WandSparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Format Code</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOneShotOpen(true)}
            className="gap-1.5"
            data-testid="button-oneshot-creator"
          >
            <Rocket className="h-4 w-4" />
            <span className="hidden md:inline">Create</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsBuilderModeOpen(true)}
            className="gap-1.5"
            data-testid="button-builder-mode"
          >
            <Wand2 className="h-4 w-4" />
            <span className="hidden md:inline">Builder</span>
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
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
          <RunButton 
            isRunning={runMutation.isPending || !!eventSourceRef.current} 
            onClick={handleRun}
            runnerType={selectedRunner}
            onRunnerChange={handleRunnerChange}
            showRunner={true}
          />
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
                      <TabsList className="h-8 w-full grid grid-cols-4 bg-muted/50">
                        <TabsTrigger value="files" className="text-xs gap-1 px-1.5 data-[state=active]:bg-background">
                          <FolderTree className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Files</span>
                        </TabsTrigger>
                        <TabsTrigger value="search" className="text-xs gap-1 px-1.5 data-[state=active]:bg-background" data-testid="tab-search">
                          <Search className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Search</span>
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
                        projectId={projectId}
                        onFileSelect={handleFileSelect}
                        onCreateFile={handleCreateFile}
                        onCreateFolder={handleCreateFolder}
                        onRename={handleRenameItem}
                        onDelete={handleDeleteItem}
                        onFilesChange={() => queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] })}
                      />
                    )}
                    {leftPanelTab === 'git' && (
                      <GitPanel projectId={projectId} />
                    )}
                    {leftPanelTab === 'search' && (
                      <SearchPanel
                        files={projectFiles}
                        onResultClick={(path, lineNumber) => {
                          const file = projectFiles.find(f => f.path === path);
                          if (file) {
                            handleFileSelect('/' + path, file.content);
                          }
                        }}
                        onReplaceAll={(replacements) => {
                          if (!project) return;
                          let updatedFiles = project.files;
                          for (const r of replacements) {
                            updatedFiles = updateFileInTree(updatedFiles, '/' + r.path, r.newContent);
                          }
                          saveMutation.mutate(updatedFiles);
                          toast({
                            title: 'Replace complete',
                            description: `Replaced in ${replacements.length} file(s).`,
                          });
                        }}
                      />
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
                    <div className="h-full flex flex-col">
                      <div className="flex-1 relative">
                        {activeTabData ? (
                          <>
                            <CodeEditor
                              ref={codeEditorRef}
                              value={activeTabData.content}
                              onChange={handleEditorChange}
                              language={getFileLanguage(activeTabData.name)}
                            />
                            <InlineSuggestion
                              isOpen={isInlineOpen}
                              position={inlinePosition}
                              currentCode={activeTabData.content}
                              language={getFileLanguage(activeTabData.name)}
                              filePath={activeTabData.path}
                              projectFiles={projectFiles}
                              onClose={() => setIsInlineOpen(false)}
                              onAccept={(code) => {
                                handleEditorChange(activeTabData.content + '\n' + code);
                                setIsInlineOpen(false);
                              }}
                              onInsert={(code) => {
                                handleEditorChange(activeTabData.content + '\n' + code);
                              }}
                            />
                          </>
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/10">
                            <div className="text-center">
                              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
                              <p className="mb-1 font-medium">No file open</p>
                              <p className="text-sm text-muted-foreground/70">Select a file from the explorer to start editing</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-3 py-1 bg-muted/30 border-t text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            <span data-testid="status-agent-ready">Agent Ready</span>
                          </div>
                          <span className="text-muted-foreground/50">|</span>
                          <span data-testid="status-ai-model">{selectedAIModel}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span data-testid="status-file-count">{projectFiles.length} files</span>
                          {activeTabData && (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{getFileLanguage(activeTabData.name)}</span>
                            </>
                          )}
                          <span className="text-muted-foreground/50">|</span>
                          <span className="font-mono text-[10px] opacity-70">Cmd+I: Inline AI</span>
                        </div>
                      </div>
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle className="h-1 bg-border/50 hover:bg-primary/20 transition-colors" />
                  <ResizablePanel defaultSize={isTerminalOpen ? 20 : 30} minSize={10} maxSize={50}>
                    <Console
                      output={consoleOutput}
                      errors={consoleErrors}
                      isRunning={runMutation.isPending || !!eventSourceRef.current}
                      onClear={handleClearConsole}
                      executionTime={executionTime}
                      logs={consoleLogs}
                      serverLogs={serverLogs}
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
                  previewUrl={previewUrl}
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

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="renameName">New Name</Label>
            <Input
              id="renameName"
              value={renameItemName}
              onChange={(e) => setRenameItemName(e.target.value)}
              placeholder="newname.js"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
              data-testid="input-rename"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRename} data-testid="button-confirm-rename">Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{deleteItemPath.split('/').pop()}"? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} data-testid="button-confirm-delete">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isBuilderModeOpen && (
        <Dialog open={isBuilderModeOpen} onOpenChange={setIsBuilderModeOpen}>
          <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden">
            <BuilderMode
              projectContext={getProjectStructure(project.files)}
              projectFiles={projectFiles}
              onApplyChanges={handleBuilderApplyChanges}
              onClose={() => setIsBuilderModeOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {isOneShotOpen && (
        <OneShotCreator
          onCreateProject={handleOneShotCreateProject}
          onClose={() => setIsOneShotOpen(false)}
        />
      )}

      <CommandDialog open={isFilePickerOpen} onOpenChange={setIsFilePickerOpen}>
        <CommandInput
          placeholder="Search files..."
          value={filePickerQuery}
          onValueChange={setFilePickerQuery}
          data-testid="input-file-picker"
        />
        <CommandList>
          <CommandEmpty>No files found.</CommandEmpty>
          <CommandGroup heading="Files">
            {projectFiles
              .filter((file) =>
                file.path.toLowerCase().includes(filePickerQuery.toLowerCase())
              )
              .slice(0, 20)
              .map((file) => (
                <CommandItem
                  key={file.path}
                  value={file.path}
                  onSelect={() => {
                    handleFileSelect(`/root/${file.path}`, file.content);
                    setIsFilePickerOpen(false);
                  }}
                  data-testid={`file-picker-item-${file.path.replace(/[/.]/g, '-')}`}
                >
                  <FileCode className="mr-2 h-4 w-4" />
                  <span>{file.path}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-4">
          <span>Quick open files</span>
          <div className="flex items-center gap-2">
            <CommandShortcut>Esc to close</CommandShortcut>
          </div>
        </div>
      </CommandDialog>
    </PageTransition>
  );
}
