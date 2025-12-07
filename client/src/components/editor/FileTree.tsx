import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Plus,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { FileNode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FileTreeProps {
  files: FileNode;
  activeFile: string | null;
  onFileSelect: (path: string, content: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

interface TreeNodeProps {
  node: FileNode;
  path: string;
  depth: number;
  activeFile: string | null;
  onFileSelect: (path: string, content: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

function TreeNode({
  node,
  path,
  depth,
  activeFile,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const isFolder = node.type === 'folder';
  const isActive = activeFile === path;

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(path, node.content || '');
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    const iconClass = 'h-4 w-4 shrink-0';
    
    switch (ext) {
      case 'js':
        return <File className={cn(iconClass, 'text-yellow-500')} />;
      case 'ts':
        return <File className={cn(iconClass, 'text-blue-500')} />;
      case 'json':
        return <File className={cn(iconClass, 'text-orange-400')} />;
      case 'md':
        return <File className={cn(iconClass, 'text-gray-400')} />;
      default:
        return <File className={iconClass} />;
    }
  };

  if (depth === 0 && isFolder) {
    return (
      <div className="py-2">
        {node.children?.map((child) => (
          <TreeNode
            key={child.name}
            node={child}
            path={`${path}/${child.name}`}
            depth={depth + 1}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              'flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded-md transition-colors text-sm',
              isActive && 'bg-primary/10 text-primary',
              !isActive && 'hover:bg-muted/50'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={handleClick}
            data-testid={`tree-item-${path.replace(/\//g, '-')}`}
          >
            {isFolder && (
              <motion.div
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              </motion.div>
            )}
            {isFolder ? (
              isOpen ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-primary" />
              )
            ) : (
              getFileIcon(node.name)
            )}
            <span className="truncate">{node.name}</span>
          </motion.div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isFolder && (
            <>
              <ContextMenuItem onClick={() => onCreateFile(path)}>
                <FilePlus className="mr-2 h-4 w-4" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCreateFolder(path)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem onClick={() => onRename(path)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(path)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      <AnimatePresence>
        {isFolder && isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.name}
                node={child}
                path={`${path}/${child.name}`}
                depth={depth + 1}
                activeFile={activeFile}
                onFileSelect={onFileSelect}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FileTree({
  files,
  activeFile,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: FileTreeProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Files
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onCreateFile('/root')}
            data-testid="button-new-file"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onCreateFolder('/root')}
            data-testid="button-new-folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <TreeNode
          node={files}
          path="/root"
          depth={0}
          activeFile={activeFile}
          onFileSelect={onFileSelect}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
