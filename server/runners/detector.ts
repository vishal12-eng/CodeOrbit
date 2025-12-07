import type { FileNode } from "@shared/schema";
import { ProjectType, findFile, hasFileWithExtension } from "./types";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function parsePackageJson(content: string): PackageJson | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function hasReactDependency(pkg: PackageJson): boolean {
  return !!(pkg.dependencies?.react || pkg.devDependencies?.react);
}

function hasNextDependency(pkg: PackageJson): boolean {
  return !!(pkg.dependencies?.next || pkg.devDependencies?.next);
}

function hasViteDependency(pkg: PackageJson): boolean {
  return !!(pkg.dependencies?.vite || pkg.devDependencies?.vite);
}

function hasCRAScripts(pkg: PackageJson): boolean {
  return !!(
    pkg.scripts?.start?.includes("react-scripts") ||
    pkg.dependencies?.["react-scripts"] ||
    pkg.devDependencies?.["react-scripts"]
  );
}

export function detectProjectType(files: FileNode): ProjectType {
  const packageJsonNode = findFile(files, "package.json");
  
  if (packageJsonNode?.content) {
    const pkg = parsePackageJson(packageJsonNode.content);
    
    if (pkg) {
      if (hasNextDependency(pkg)) {
        return ProjectType.NEXTJS;
      }
      
      if (hasReactDependency(pkg)) {
        if (hasViteDependency(pkg)) {
          return ProjectType.REACT_VITE;
        }
        if (hasCRAScripts(pkg)) {
          return ProjectType.REACT_CRA;
        }
        return ProjectType.REACT_VITE;
      }
      
      return ProjectType.NODEJS;
    }
  }
  
  if (hasFileWithExtension(files, ".py")) {
    return ProjectType.PYTHON;
  }
  
  const indexHtml = findFile(files, "index.html");
  if (indexHtml) {
    return ProjectType.STATIC_HTML;
  }
  
  return ProjectType.NODEJS;
}

export function getEntryFile(files: FileNode, projectType: ProjectType): string | undefined {
  switch (projectType) {
    case ProjectType.NODEJS: {
      const mainJs = findFile(files, "main.js");
      if (mainJs) return "main.js";
      const indexJs = findFile(files, "index.js");
      if (indexJs) return "index.js";
      const appJs = findFile(files, "app.js");
      if (appJs) return "app.js";
      return "main.js";
    }
    
    case ProjectType.PYTHON: {
      const mainPy = findFile(files, "main.py");
      if (mainPy) return "main.py";
      const appPy = findFile(files, "app.py");
      if (appPy) return "app.py";
      return "main.py";
    }
    
    case ProjectType.STATIC_HTML:
      return "index.html";
    
    default:
      return undefined;
  }
}
