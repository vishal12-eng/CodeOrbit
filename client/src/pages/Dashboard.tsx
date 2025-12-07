import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import UserMenu from '@/components/layout/UserMenu';
import ProjectCard from '@/components/ui/ProjectCard';
import PageTransition from '@/components/layout/PageTransition';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Project } from '@/lib/types';

// todo: remove mock functionality - replace with API data
const mockProjects: Project[] = [
  {
    id: '1',
    ownerId: '1',
    name: 'Hello World',
    createdAt: '2024-12-01T10:00:00Z',
    updatedAt: '2024-12-05T14:30:00Z',
    language: 'node-js',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        { type: 'file', name: 'main.js', content: "console.log('Hello, World!');" },
      ],
    },
  },
  {
    id: '2',
    ownerId: '1',
    name: 'API Server',
    createdAt: '2024-12-02T09:00:00Z',
    updatedAt: '2024-12-06T11:20:00Z',
    language: 'node-js',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        { type: 'file', name: 'server.js', content: "const http = require('http');\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'text/plain' });\n  res.end('Hello from API Server!');\n});\n\nserver.listen(3000, () => {\n  console.log('Server running on port 3000');\n});" },
        { type: 'file', name: 'package.json', content: '{\n  "name": "api-server",\n  "version": "1.0.0"\n}' },
      ],
    },
  },
  {
    id: '3',
    ownerId: '1',
    name: 'Todo App',
    createdAt: '2024-12-03T15:00:00Z',
    updatedAt: '2024-12-07T09:45:00Z',
    language: 'node-js',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        { type: 'file', name: 'main.js', content: "const todos = [];\n\nfunction addTodo(text) {\n  todos.push({ id: Date.now(), text, done: false });\n}\n\nfunction listTodos() {\n  todos.forEach(t => console.log(`[${t.done ? 'x' : ' '}] ${t.text}`));\n}\n\naddTodo('Learn JavaScript');\naddTodo('Build a project');\nlistTodos();" },
      ],
    },
  },
];

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // todo: remove mock functionality - replace with API calls
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  // Redirect if not authenticated
  if (!isAuthenticated) {
    setLocation('/login');
    return null;
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a project name.',
        variant: 'destructive',
      });
      return;
    }
    setIsCreating(true);
    // todo: remove mock functionality - implement API call
    await new Promise((r) => setTimeout(r, 500));
    const newProject: Project = {
      id: String(Date.now()),
      ownerId: user?.id || '1',
      name: newProjectName.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      language: 'node-js',
      files: {
        type: 'folder',
        name: 'root',
        children: [
          { type: 'file', name: 'main.js', content: "console.log('Hello from CodeOrbit!');" },
        ],
      },
    };
    setProjects([newProject, ...projects]);
    setNewProjectName('');
    setIsCreateDialogOpen(false);
    setIsCreating(false);
    toast({
      title: 'Project created',
      description: `"${newProject.name}" has been created.`,
    });
  };

  const handleOpenProject = (id: string) => {
    setLocation(`/editor/${id}`);
  };

  const handleRenameProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      setRenameProjectId(id);
      setRenameValue(project.name);
      setIsRenameDialogOpen(true);
    }
  };

  const handleConfirmRename = async () => {
    if (!renameValue.trim() || !renameProjectId) return;
    // todo: remove mock functionality - implement API call
    await new Promise((r) => setTimeout(r, 300));
    setProjects(
      projects.map((p) =>
        p.id === renameProjectId ? { ...p, name: renameValue.trim(), updatedAt: new Date().toISOString() } : p
      )
    );
    setIsRenameDialogOpen(false);
    setRenameProjectId(null);
    toast({
      title: 'Project renamed',
      description: `Project has been renamed to "${renameValue.trim()}".`,
    });
  };

  const handleDuplicateProject = async (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    // todo: remove mock functionality - implement API call
    await new Promise((r) => setTimeout(r, 300));
    const duplicate: Project = {
      ...project,
      id: String(Date.now()),
      name: `${project.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects([duplicate, ...projects]);
    toast({
      title: 'Project duplicated',
      description: `"${duplicate.name}" has been created.`,
    });
  };

  const handleDeleteProject = (id: string) => {
    setDeleteProjectId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteProjectId) return;
    // todo: remove mock functionality - implement API call
    await new Promise((r) => setTimeout(r, 300));
    const project = projects.find((p) => p.id === deleteProjectId);
    setProjects(projects.filter((p) => p.id !== deleteProjectId));
    setIsDeleteDialogOpen(false);
    setDeleteProjectId(null);
    toast({
      title: 'Project deleted',
      description: `"${project?.name}" has been deleted.`,
    });
  };

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <h1 className="text-2xl font-semibold">Your Projects</h1>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2" data-testid="button-create-project">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </motion.div>
          </div>

          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'No projects match your search.' : 'You have no projects yet.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create your first project
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  onOpen={handleOpenProject}
                  onRename={handleRenameProject}
                  onDuplicate={handleDuplicateProject}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter a name for your new project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="My Awesome Project"
              className="mt-2"
              data-testid="input-project-name"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={isCreating} data-testid="button-confirm-create">
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="renameName">Project Name</Label>
            <Input
              id="renameName"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-2"
              data-testid="input-rename"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRename} data-testid="button-confirm-rename">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
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
    </PageTransition>
  );
}
