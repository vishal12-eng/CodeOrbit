import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { OpenTab } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CodeTabsProps {
  tabs: OpenTab[];
  activeTab: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
}

export default function CodeTabs({ tabs, activeTab, onTabSelect, onTabClose }: CodeTabsProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5 border-b bg-muted/30 px-2 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.path;
        return (
          <motion.div
            key={tab.path}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              'group relative flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors',
              isActive && 'bg-background',
              !isActive && 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onTabSelect(tab.path)}
            data-testid={`tab-${tab.path.replace(/\//g, '-')}`}
          >
            <span className="flex items-center gap-1.5">
              {tab.isDirty && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
              <span>{tab.name}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.path);
              }}
              data-testid={`button-close-tab-${tab.path.replace(/\//g, '-')}`}
            >
              <X className="h-3 w-3" />
            </Button>
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ duration: 0.2 }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
