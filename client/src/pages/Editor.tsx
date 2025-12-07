import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Link, useParams, useLocation } from 'wouter';
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
import type { Project, FileNode, OpenTab } from '@/lib/types';

// todo: remove mock functionality - replace with API data
const getMockProject = (id: string): Project => ({
  id,
  ownerId: '1',
  name: id === '1' ? 'Hello World' : id === '2' ? 'API Server' : 'Todo App',
  createdAt: '2024-12-01T10:00:00Z',
  updatedAt: '2024-12-05T14:30:00Z',
  language: 'node-js',
  files: {
    type: 'folder',
    name: 'root',
    children: [
      {
        type: 'file',
        name: 'main.js',
        content: `// Welcome to CodeOrbit!
// Click Run to execute your code

function greet(name) {
  return \`Hello, \${name}! Welcome to CodeOrbit.\`;
}

console.log(greet('Developer'));
console.log('');
console.log('Your code ran successfully!');

// Try editing this code and running it again
for (let i = 1; i <= 5; i++) {
  console.log(\`Count: \${i}\`);
}`,
      },
      {
        type: 'folder',
        name: 'src',
        children: [
          {
            type: 'file',
            name: 'utils.js',
            content: `// Utility functions

export function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}`,
          },
          {
            type: 'file',
            name: 'config.js',
            content: `// Configuration

module.exports = {
  appName: 'CodeOrbit',
  version: '1.0.0',
  environment: 'development',
};`,
          },
        ],
      },
      {
        type: 'file',
        name: 'package.json',
        content: `{
  "name": "my-project",
  "version": "1.0.0",
  "description": "A CodeOrbit project",
  "main": "main.js",
  "scripts": {
    "start": "node main.js"
  }
}`,
      },
      {
        type: 'file',
        name: 'README.md',
        content: `# My Project

This is a CodeOrbit project.

## Getting Started

Click the **Run** button to execute your code.`,
      },
    ],
  },
});

export default function Editor() {
  const params = useParams();
  const projectId = params.id || '1';
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // todo: remove mock functionality - fetch from API
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'unsaved'>('saved');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);

  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newItemPath, setNewItemPath] = useState('');
  const [newItemName, setNewItemName] = useState('');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load project
  useEffect(() => {
    // todo: remove mock functionality - fetch from API
    const loadProject = async () => {
      setIsLoading(true);
      await new Promise((r) => setTimeout(r, 500));
      const proj = getMockProject(projectId);
      setProject(proj);
      setIsLoading(false);

      // Auto-open main.js
      const mainFile = proj.files.children?.find(
        (f) => f.type === 'file' && f.name === 'main.js'
      );
      if (mainFile && mainFile.content !== undefined) {
        const path = `/root/${mainFile.name}`;
        setOpenTabs([{ path, name: mainFile.name, content: mainFile.content, isDirty: false }]);
        setActiveTab(path);
      }
    };
    loadProject();
  }, [projectId]);

  // Redirect if not authenticated
  if (!isAuthenticated) {
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
      if (!activeTab) return;

      setOpenTabs((tabs) =>
        tabs.map((t) =>
          t.path === activeTab ? { ...t, content: value, isDirty: true } : t
        )
      );
      setSaveStatus('unsaved');

      // Debounced auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        // todo: remove mock functionality - implement API call
        await new Promise((r) => setTimeout(r, 800));
        setOpenTabs((tabs) =>
          tabs.map((t) => (t.path === activeTab ? { ...t, isDirty: false } : t))
        );
        setSaveStatus('saved');
      }, 1500);
    },
    [activeTab]
  );

  const handleRun = async () => {
    if (!project) return;
    setIsRunning(true);
    setConsoleOutput([]);
    setConsoleErrors([]);

    // todo: remove mock functionality - implement API call
    await new Promise((r) => setTimeout(r, 1000));

    // Find the active tab content or main.js
    const activeContent = openTabs.find((t) => t.path === activeTab)?.content || '';
    
    // Mock execution - simulate running the code
    try {
      // Capture console.log statements from the code
      const logStatements: string[] = [];
      const logRegex = /console\.log\((.*?)\)/g;
      let match;
      while ((match = logRegex.exec(activeContent)) !== null) {
        try {
          // Simple evaluation for string literals and template literals
          let arg = match[1].trim();
          if (arg.startsWith('`') && arg.endsWith('`')) {
            arg = arg.slice(1, -1).replace(/\$\{.*?\}/g, '[value]');
          } else if (arg.startsWith("'") || arg.startsWith('"')) {
            arg = arg.slice(1, -1);
          }
          logStatements.push(arg);
        } catch {
          logStatements.push(match[1]);
        }
      }

      if (logStatements.length > 0) {
        setConsoleOutput(logStatements);
      } else {
        setConsoleOutput(['Program executed successfully (no output)']);
      }
    } catch (err) {
      setConsoleErrors(['Error executing code']);
    }

    setIsRunning(false);
    toast({
      title: 'Execution complete',
      description: 'Your code has finished running.',
    });
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
    // todo: remove mock functionality - implement file creation
    const fileName = newItemName.includes('.') ? newItemName : `${newItemName}.js`;
    toast({
      title: 'File created',
      description: `"${fileName}" has been created.`,
    });
    setIsNewFileDialogOpen(false);
  };

  const handleConfirmNewFolder = () => {
    if (!newItemName.trim() || !project) return;
    // todo: remove mock functionality - implement folder creation
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

  if (isLoading || !project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-lg"
        >
          Loading project...
        </motion.div>
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
          <RunButton isRunning={isRunning} onClick={handleRun} />
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
                isRunning={isRunning}
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
