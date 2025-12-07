import { X, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OpenTab } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CodeTabsProps {
  tabs: OpenTab[];
  activeTab: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  const iconColors: Record<string, string> = {
    js: 'text-yellow-500',
    jsx: 'text-yellow-500',
    ts: 'text-blue-500',
    tsx: 'text-blue-500',
    json: 'text-yellow-600',
    md: 'text-gray-500',
    css: 'text-purple-500',
    html: 'text-orange-500',
    py: 'text-green-500',
  };
  return iconColors[ext || ''] || 'text-muted-foreground';
}

export default function CodeTabs({ tabs, activeTab, onTabSelect, onTabClose }: CodeTabsProps) {
  if (tabs.length === 0) {
    return (
      <div className="h-9 border-b bg-muted/30 flex items-center px-3 shrink-0">
        <span className="text-xs text-muted-foreground">No files open</span>
      </div>
    );
  }

  return (
    <div className="flex items-center border-b bg-muted/30 overflow-x-auto shrink-0 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.path;
        return (
          <div
            key={tab.path}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer transition-all border-r border-border/50',
              isActive 
                ? 'bg-background text-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            onClick={() => onTabSelect(tab.path)}
            data-testid={`tab-${tab.path.replace(/\//g, '-')}`}
          >
            <FileCode className={cn('h-3.5 w-3.5', getFileIcon(tab.name))} />
            <span className="flex items-center gap-1.5 max-w-[120px] truncate">
              {tab.isDirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              )}
              <span className="truncate">{tab.name}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-5 w-5 p-0 ml-1 rounded-sm transition-opacity',
                isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:opacity-100'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.path);
              }}
              data-testid={`button-close-tab-${tab.path.replace(/\//g, '-')}`}
            >
              <X className="h-3 w-3" />
            </Button>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </div>
        );
      })}
    </div>
  );
}
