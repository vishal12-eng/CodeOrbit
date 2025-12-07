import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Trash2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ConsoleProps {
  output: string[];
  errors: string[];
  isRunning: boolean;
  onClear: () => void;
}

export default function Console({ output, errors, isRunning, onClear }: ConsoleProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex flex-col border-t bg-muted/20">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
        <button
          className="flex items-center gap-2 text-sm font-medium"
          onClick={() => setIsCollapsed(!isCollapsed)}
          data-testid="button-toggle-console"
        >
          <Terminal className="h-4 w-4" />
          <span>Console</span>
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClear}
          data-testid="button-clear-console"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 180 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <ScrollArea className="h-[180px]">
              <div className="p-3 font-mono text-xs space-y-1">
                {isRunning && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <motion.div
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      Running...
                    </motion.div>
                  </div>
                )}
                {output.length === 0 && errors.length === 0 && !isRunning && (
                  <div className="text-muted-foreground">
                    Click Run to execute your code
                  </div>
                )}
                {output.map((line, i) => (
                  <div key={`out-${i}`} className="text-foreground" data-testid={`console-output-${i}`}>
                    {line}
                  </div>
                ))}
                {errors.map((line, i) => (
                  <div key={`err-${i}`} className="text-destructive" data-testid={`console-error-${i}`}>
                    {line}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
