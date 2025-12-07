import ProjectCard from '@/components/ui/ProjectCard';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { Project } from '@/lib/types';

const mockProject: Project = {
  id: '1',
  ownerId: '1',
  name: 'My Awesome Project',
  createdAt: '2024-12-01T10:00:00Z',
  updatedAt: '2024-12-05T14:30:00Z',
  language: 'node-js',
  files: {
    type: 'folder',
    name: 'root',
    children: [
      { type: 'file', name: 'main.js', content: "console.log('Hello!');" },
    ],
  },
};

export default function ProjectCardExample() {
  return (
    <ThemeProvider>
      <div className="p-6 max-w-sm">
        <ProjectCard
          project={mockProject}
          onOpen={(id) => console.log('Open:', id)}
          onRename={(id) => console.log('Rename:', id)}
          onDuplicate={(id) => console.log('Duplicate:', id)}
          onDelete={(id) => console.log('Delete:', id)}
        />
      </div>
    </ThemeProvider>
  );
}
