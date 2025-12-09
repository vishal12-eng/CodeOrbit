import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectContext {
  stack: {
    framework: string;
    language: string;
    ui: string | null;
    database: string | null;
    buildTool: string | null;
  };
  rules: Record<string, any>;
  recentFiles: string[];
  packageJson: any | null;
  tsConfig: any | null;
}

export interface DetectedStack {
  framework: string;
  language: string;
  ui: string | null;
  database: string | null;
  buildTool: string | null;
  description: string;
}

const FRAMEWORK_DETECTORS: Array<{
  name: string;
  detect: (pkg: any, files: string[]) => boolean;
  ui?: string;
  buildTool?: string;
}> = [
  {
    name: 'Next.js',
    detect: (pkg) => !!pkg?.dependencies?.next || !!pkg?.devDependencies?.next,
    ui: 'React',
    buildTool: 'Next.js',
  },
  {
    name: 'Vite + React',
    detect: (pkg, files) => 
      (!!pkg?.dependencies?.react || !!pkg?.devDependencies?.react) &&
      (!!pkg?.dependencies?.vite || !!pkg?.devDependencies?.vite || files.includes('vite.config.ts') || files.includes('vite.config.js')),
    ui: 'React',
    buildTool: 'Vite',
  },
  {
    name: 'Create React App',
    detect: (pkg) => !!pkg?.dependencies?.['react-scripts'],
    ui: 'React',
    buildTool: 'CRA',
  },
  {
    name: 'Vue.js',
    detect: (pkg) => !!pkg?.dependencies?.vue || !!pkg?.devDependencies?.vue,
    ui: 'Vue',
    buildTool: 'Vite',
  },
  {
    name: 'Angular',
    detect: (pkg) => !!pkg?.dependencies?.['@angular/core'],
    ui: 'Angular',
    buildTool: 'Angular CLI',
  },
  {
    name: 'Express',
    detect: (pkg) => !!pkg?.dependencies?.express,
    buildTool: 'Node.js',
  },
  {
    name: 'Fastify',
    detect: (pkg) => !!pkg?.dependencies?.fastify,
    buildTool: 'Node.js',
  },
  {
    name: 'Node.js',
    detect: (pkg, files) => files.includes('package.json') && !pkg?.dependencies?.react && !pkg?.dependencies?.vue,
    buildTool: 'Node.js',
  },
];

const UI_FRAMEWORK_DETECTORS: Array<{ name: string; detect: (pkg: any) => boolean }> = [
  { name: 'Tailwind CSS', detect: (pkg) => !!pkg?.dependencies?.tailwindcss || !!pkg?.devDependencies?.tailwindcss },
  { name: 'shadcn/ui', detect: (pkg) => !!pkg?.dependencies?.['class-variance-authority'] || !!pkg?.dependencies?.['@radix-ui/react-slot'] },
  { name: 'Material UI', detect: (pkg) => !!pkg?.dependencies?.['@mui/material'] },
  { name: 'Chakra UI', detect: (pkg) => !!pkg?.dependencies?.['@chakra-ui/react'] },
  { name: 'Ant Design', detect: (pkg) => !!pkg?.dependencies?.antd },
  { name: 'Bootstrap', detect: (pkg) => !!pkg?.dependencies?.bootstrap || !!pkg?.dependencies?.['react-bootstrap'] },
];

const DATABASE_DETECTORS: Array<{ name: string; detect: (pkg: any) => boolean }> = [
  { name: 'PostgreSQL (Drizzle)', detect: (pkg) => !!pkg?.dependencies?.['drizzle-orm'] && !!pkg?.dependencies?.pg },
  { name: 'PostgreSQL (Prisma)', detect: (pkg) => !!pkg?.dependencies?.['@prisma/client'] },
  { name: 'MongoDB', detect: (pkg) => !!pkg?.dependencies?.mongoose || !!pkg?.dependencies?.mongodb },
  { name: 'SQLite', detect: (pkg) => !!pkg?.dependencies?.['better-sqlite3'] || !!pkg?.dependencies?.sqlite3 },
  { name: 'MySQL', detect: (pkg) => !!pkg?.dependencies?.mysql2 || !!pkg?.dependencies?.mysql },
  { name: 'Redis', detect: (pkg) => !!pkg?.dependencies?.redis || !!pkg?.dependencies?.ioredis },
];

export async function detectProjectStack(projectPath: string = process.cwd()): Promise<DetectedStack> {
  const files = await getProjectFiles(projectPath);
  const pkg = await readPackageJson(projectPath);

  let framework = 'Unknown';
  let ui: string | null = null;
  let buildTool: string | null = null;
  let database: string | null = null;
  let language = 'JavaScript';

  for (const detector of FRAMEWORK_DETECTORS) {
    if (detector.detect(pkg, files)) {
      framework = detector.name;
      ui = detector.ui || null;
      buildTool = detector.buildTool || null;
      break;
    }
  }

  for (const detector of UI_FRAMEWORK_DETECTORS) {
    if (detector.detect(pkg)) {
      ui = detector.name;
      break;
    }
  }

  for (const detector of DATABASE_DETECTORS) {
    if (detector.detect(pkg)) {
      database = detector.name;
      break;
    }
  }

  if (files.includes('tsconfig.json') || pkg?.devDependencies?.typescript) {
    language = 'TypeScript';
  }

  const description = `${framework}${ui ? ` + ${ui}` : ''}${database ? ` + ${database}` : ''}`;

  return {
    framework,
    language,
    ui,
    database,
    buildTool,
    description,
  };
}

async function getProjectFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(entry.name);
      }
    }
  } catch (e) {
  }

  return files;
}

async function readPackageJson(projectPath: string): Promise<any | null> {
  try {
    const content = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function loadProjectRules(projectPath: string = process.cwd()): Promise<Record<string, any>> {
  const rules: Record<string, any> = {};
  const rulesDir = path.join(projectPath, '.ide', 'rules');

  try {
    const stat = await fs.stat(rulesDir);
    if (stat.isDirectory()) {
      const files = await fs.readdir(rulesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(rulesDir, file), 'utf-8');
            rules[file.replace('.json', '')] = JSON.parse(content);
          } catch {
          }
        }
      }
    }
  } catch {
  }

  return rules;
}

export async function getRecentlyChangedFiles(projectPath: string = process.cwd()): Promise<string[]> {
  const files: Array<{ path: string; mtime: number }> = [];
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache']);

  async function scanDir(dir: string, depth = 0): Promise<void> {
    if (depth > 5) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);

        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
            await scanDir(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json'].includes(ext)) {
            try {
              const stat = await fs.stat(fullPath);
              files.push({ path: relativePath, mtime: stat.mtimeMs });
            } catch {
            }
          }
        }
      }
    } catch {
    }
  }

  await scanDir(projectPath);

  return files
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 20)
    .map(f => f.path);
}

export async function gatherFullContext(projectPath: string = process.cwd()): Promise<ProjectContext> {
  const [stack, rules, recentFiles] = await Promise.all([
    detectProjectStack(projectPath),
    loadProjectRules(projectPath),
    getRecentlyChangedFiles(projectPath),
  ]);

  let packageJson = null;
  let tsConfig = null;

  try {
    packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
  } catch {
  }

  try {
    tsConfig = JSON.parse(await fs.readFile(path.join(projectPath, 'tsconfig.json'), 'utf-8'));
  } catch {
  }

  return {
    stack,
    rules,
    recentFiles,
    packageJson,
    tsConfig,
  };
}
