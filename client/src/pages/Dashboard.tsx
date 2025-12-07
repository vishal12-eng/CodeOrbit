import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Loader2, Settings, Code, FileCode, Atom, Globe, Server, Zap } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import UserMenu from '@/components/layout/UserMenu';
import ProjectCard from '@/components/ui/ProjectCard';
import PageTransition from '@/components/layout/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Project, FileNode } from '@shared/schema';
import { SiNodedotjs, SiPython, SiReact, SiNextdotjs, SiHtml5, SiTypescript } from 'react-icons/si';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  icon: typeof Code;
  brandIcon?: typeof SiNodedotjs;
  color: string;
  files: FileNode;
}

const projectTemplates: ProjectTemplate[] = [
  {
    id: 'node-js',
    name: 'Node.js',
    description: 'Server-side JavaScript runtime with Express.js starter',
    language: 'node-js',
    icon: Server,
    brandIcon: SiNodedotjs,
    color: 'text-green-500',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        {
          type: 'file',
          name: 'index.js',
          content: `const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello from NovaCode IDE!');
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});`,
        },
        {
          type: 'file',
          name: 'package.json',
          content: JSON.stringify({
            name: 'node-project',
            version: '1.0.0',
            main: 'index.js',
            scripts: {
              start: 'node index.js',
              dev: 'node --watch index.js',
            },
            dependencies: {
              express: '^4.18.2',
            },
          }, null, 2),
        },
      ],
    },
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python with Flask web framework starter',
    language: 'python',
    icon: Code,
    brandIcon: SiPython,
    color: 'text-yellow-500',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        {
          type: 'file',
          name: 'main.py',
          content: `from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello from NovaCode IDE!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)`,
        },
        {
          type: 'file',
          name: 'requirements.txt',
          content: 'flask==3.0.0',
        },
      ],
    },
  },
  {
    id: 'react',
    name: 'React',
    description: 'Modern React app with Vite and TypeScript',
    language: 'react',
    icon: Atom,
    brandIcon: SiReact,
    color: 'text-cyan-500',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        {
          type: 'folder',
          name: 'src',
          children: [
            {
              type: 'file',
              name: 'App.tsx',
              content: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <h1>NovaCode React App</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          Count is {count}
        </button>
      </div>
    </div>
  )
}

export default App`,
            },
            {
              type: 'file',
              name: 'main.tsx',
              content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
            },
            {
              type: 'file',
              name: 'App.css',
              content: `.app {
  text-align: center;
  padding: 2rem;
}

.card {
  margin-top: 2rem;
}

button {
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  background-color: #1a1a1a;
  color: white;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}`,
            },
            {
              type: 'file',
              name: 'index.css',
              content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Inter, system-ui, sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}`,
            },
          ],
        },
        {
          type: 'file',
          name: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        },
        {
          type: 'file',
          name: 'package.json',
          content: JSON.stringify({
            name: 'react-app',
            version: '1.0.0',
            type: 'module',
            scripts: {
              dev: 'vite',
              build: 'tsc && vite build',
              preview: 'vite preview',
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/react': '^18.2.43',
              '@types/react-dom': '^18.2.17',
              '@vitejs/plugin-react': '^4.2.1',
              typescript: '^5.3.3',
              vite: '^5.0.8',
            },
          }, null, 2),
        },
        {
          type: 'file',
          name: 'vite.config.ts',
          content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
        },
        {
          type: 'file',
          name: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: 'react-jsx',
              strict: true,
              noUnusedLocals: true,
              noUnusedParameters: true,
              noFallthroughCasesInSwitch: true,
            },
            include: ['src'],
          }, null, 2),
        },
      ],
    },
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Full-stack React framework with App Router',
    language: 'nextjs',
    icon: Zap,
    brandIcon: SiNextdotjs,
    color: 'text-foreground',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        {
          type: 'folder',
          name: 'app',
          children: [
            {
              type: 'file',
              name: 'page.tsx',
              content: `export default function Home() {
  return (
    <main className="min-h-screen p-24">
      <h1 className="text-4xl font-bold">
        Welcome to NovaCode Next.js
      </h1>
      <p className="mt-4 text-lg">
        Get started by editing app/page.tsx
      </p>
    </main>
  )
}`,
            },
            {
              type: 'file',
              name: 'layout.tsx',
              content: `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Next.js App',
  description: 'Created with NovaCode IDE',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
            },
            {
              type: 'file',
              name: 'globals.css',
              content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, sans-serif;
}`,
            },
          ],
        },
        {
          type: 'file',
          name: 'package.json',
          content: JSON.stringify({
            name: 'nextjs-app',
            version: '1.0.0',
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
            },
            dependencies: {
              next: '^14.0.4',
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/node': '^20.10.5',
              '@types/react': '^18.2.45',
              '@types/react-dom': '^18.2.18',
              typescript: '^5.3.3',
            },
          }, null, 2),
        },
        {
          type: 'file',
          name: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'bundler',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
              plugins: [{ name: 'next' }],
              paths: { '@/*': ['./*'] },
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules'],
          }, null, 2),
        },
        {
          type: 'file',
          name: 'next.config.js',
          content: `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig`,
        },
      ],
    },
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    description: 'TypeScript project with Node.js runtime',
    language: 'node-js',
    icon: FileCode,
    brandIcon: SiTypescript,
    color: 'text-blue-500',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        {
          type: 'folder',
          name: 'src',
          children: [
            {
              type: 'file',
              name: 'index.ts',
              content: `interface Greeting {
  message: string;
  timestamp: Date;
}

function createGreeting(name: string): Greeting {
  return {
    message: \`Hello, \${name}! Welcome to NovaCode IDE.\`,
    timestamp: new Date(),
  };
}

const greeting = createGreeting('Developer');
console.log(greeting.message);
console.log(\`Created at: \${greeting.timestamp.toISOString()}\`);`,
            },
          ],
        },
        {
          type: 'file',
          name: 'package.json',
          content: JSON.stringify({
            name: 'typescript-project',
            version: '1.0.0',
            scripts: {
              build: 'tsc',
              start: 'node dist/index.js',
              dev: 'ts-node src/index.ts',
            },
            devDependencies: {
              typescript: '^5.3.3',
              '@types/node': '^20.10.5',
              'ts-node': '^10.9.2',
            },
          }, null, 2),
        },
        {
          type: 'file',
          name: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              lib: ['ES2020'],
              outDir: './dist',
              rootDir: './src',
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
            },
            include: ['src/**/*'],
            exclude: ['node_modules'],
          }, null, 2),
        },
      ],
    },
  },
  {
    id: 'static',
    name: 'Static HTML',
    description: 'Simple HTML, CSS, and JavaScript website',
    language: 'static',
    icon: Globe,
    brandIcon: SiHtml5,
    color: 'text-orange-500',
    files: {
      type: 'folder',
      name: 'root',
      children: [
        {
          type: 'file',
          name: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NovaCode Static Site</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>Welcome to NovaCode</h1>
    <p>Start building your static website!</p>
    <button id="btn">Click Me</button>
    <p id="output"></p>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
        },
        {
          type: 'file',
          name: 'styles.css',
          content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
}

.container {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

p {
  font-size: 1.2rem;
  opacity: 0.8;
  margin-bottom: 1.5rem;
}

button {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  background: #2ba6ff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

button:hover {
  background: #1488fc;
  transform: scale(1.05);
}

#output {
  margin-top: 1rem;
  font-weight: bold;
}`,
        },
        {
          type: 'file',
          name: 'script.js',
          content: `document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn');
  const output = document.getElementById('output');
  let count = 0;

  btn.addEventListener('click', () => {
    count++;
    output.textContent = \`Button clicked \${count} time\${count !== 1 ? 's' : ''}!\`;
  });
});`,
        },
      ],
    },
  },
];

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('projects');
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; language: string; files: FileNode }) => {
      const res = await apiRequest('POST', '/api/projects', data);
      return res.json();
    },
    onSuccess: (newProject: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setNewProjectName('');
      setSelectedTemplate(null);
      setIsCreateDialogOpen(false);
      toast({
        title: 'Project created',
        description: `"${newProject.name}" has been created.`,
      });
      setLocation(`/editor/${newProject.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project.',
        variant: 'destructive',
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest('PUT', `/api/projects/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsRenameDialogOpen(false);
      setRenameProjectId(null);
      toast({
        title: 'Project renamed',
        description: `Project has been renamed to "${renameValue.trim()}".`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to rename project.',
        variant: 'destructive',
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/projects/${id}/duplicate`, {});
      return res.json();
    },
    onSuccess: (duplicate: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Project duplicated',
        description: `"${duplicate.name}" has been created.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate project.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/projects/${id}`);
      return id;
    },
    onSuccess: () => {
      const project = projects.find((p) => p.id === deleteProjectId);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsDeleteDialogOpen(false);
      setDeleteProjectId(null);
      toast({
        title: 'Project deleted',
        description: `"${project?.name}" has been deleted.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete project.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <PageTransition className="min-h-screen flex flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </header>
        <main className="flex-1 px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-10 w-full max-w-md mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </PageTransition>
    );
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setNewProjectName(`My ${template.name} Project`);
    setIsCreateDialogOpen(true);
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a project name.',
        variant: 'destructive',
      });
      return;
    }
    
    const template = selectedTemplate || projectTemplates[0];
    createMutation.mutate({
      name: newProjectName.trim(),
      language: template.language,
      files: template.files,
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

  const handleConfirmRename = () => {
    if (!renameValue.trim() || !renameProjectId) return;
    renameMutation.mutate({ id: renameProjectId, name: renameValue.trim() });
  };

  const handleDuplicateProject = (id: string) => {
    duplicateMutation.mutate(id);
  };

  const handleDeleteProject = (id: string) => {
    setDeleteProjectId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteProjectId) return;
    deleteMutation.mutate(deleteProjectId);
  };

  const handleCreateBlankProject = () => {
    setSelectedTemplate(projectTemplates[0]);
    setNewProjectName('');
    setIsCreateDialogOpen(true);
  };

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="link-settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <TabsList>
                <TabsTrigger value="projects" data-testid="tab-projects">Your Projects</TabsTrigger>
                <TabsTrigger value="templates" data-testid="tab-templates">New from Template</TabsTrigger>
              </TabsList>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button onClick={handleCreateBlankProject} className="gap-2" data-testid="button-create-project">
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
              </motion.div>
            </div>

            <TabsContent value="projects" className="mt-0">
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

              {filteredProjects.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? 'No projects match your search.' : 'You have no projects yet.'}
                  </p>
                  {!searchQuery && (
                    <div className="flex flex-col items-center gap-3">
                      <Button onClick={handleCreateBlankProject} variant="outline" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create your first project
                      </Button>
                      <span className="text-sm text-muted-foreground">or</span>
                      <Button variant="ghost" onClick={() => setActiveTab('templates')}>
                        Browse templates
                      </Button>
                    </div>
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
            </TabsContent>

            <TabsContent value="templates" className="mt-0">
              <div className="mb-6">
                <h2 className="text-lg font-medium mb-2">Start with a Template</h2>
                <p className="text-muted-foreground">
                  Choose a template to quickly scaffold your next project with best practices built-in.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projectTemplates.map((template, index) => {
                  const BrandIcon = template.brandIcon;
                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className="group cursor-pointer hover-elevate transition-all"
                        onClick={() => handleSelectTemplate(template)}
                        data-testid={`template-${template.id}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-md bg-muted ${template.color}`}>
                              {BrandIcon ? <BrandIcon className="h-5 w-5" /> : <template.icon className="h-5 w-5" />}
                            </div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-sm">
                            {template.description}
                          </CardDescription>
                          <Button 
                            variant="ghost" 
                            className="mt-4 w-full gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            size="sm"
                          >
                            <Plus className="h-4 w-4" />
                            Use Template
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              {selectedTemplate ? (
                <>Creating a new {selectedTemplate.name} project. Enter a name for your project.</>
              ) : (
                'Enter a name for your new project.'
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
              {selectedTemplate.brandIcon ? (
                <selectedTemplate.brandIcon className={`h-5 w-5 ${selectedTemplate.color}`} />
              ) : (
                <selectedTemplate.icon className={`h-5 w-5 ${selectedTemplate.color}`} />
              )}
              <div>
                <p className="font-medium text-sm">{selectedTemplate.name}</p>
                <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
              </div>
            </div>
          )}
          <div className="py-2">
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
            <Button onClick={handleCreateProject} disabled={createMutation.isPending} data-testid="button-confirm-create">
              {createMutation.isPending ? (
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
            <Button onClick={handleConfirmRename} disabled={renameMutation.isPending} data-testid="button-confirm-rename">
              {renameMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
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
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
