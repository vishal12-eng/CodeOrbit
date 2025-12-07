import { useState } from 'react';
import FileTree from '@/components/editor/FileTree';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { FileNode } from '@/lib/types';

const mockFiles: FileNode = {
  type: 'folder',
  name: 'root',
  children: [
    { type: 'file', name: 'main.js', content: "console.log('Hello!');" },
    { type: 'file', name: 'package.json', content: '{}' },
    {
      type: 'folder',
      name: 'src',
      children: [
        { type: 'file', name: 'utils.js', content: '' },
        { type: 'file', name: 'config.js', content: '' },
      ],
    },
  ],
};

export default function FileTreeExample() {
  const [activeFile, setActiveFile] = useState<string | null>('/root/main.js');

  return (
    <ThemeProvider>
      <div className="w-64 h-80 border rounded-lg overflow-hidden">
        <FileTree
          files={mockFiles}
          activeFile={activeFile}
          onFileSelect={(path, content) => {
            setActiveFile(path);
            console.log('Selected:', path);
          }}
          onCreateFile={(path) => console.log('Create file at:', path)}
          onCreateFolder={(path) => console.log('Create folder at:', path)}
          onRename={(path) => console.log('Rename:', path)}
          onDelete={(path) => console.log('Delete:', path)}
        />
      </div>
    </ThemeProvider>
  );
}
