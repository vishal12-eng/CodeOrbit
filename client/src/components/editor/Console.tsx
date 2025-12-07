import { Terminal, Trash2 } from 'lucide-react';
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
  return (
    <div className="h-full flex flex-col bg-muted/20">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-background/50 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span>Console</span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Running...
            </span>
          )}
        </div>
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
      
      <ScrollArea className="flex-1">
        <div className="p-3 font-mono text-xs space-y-0.5 min-h-full">
          {output.length === 0 && errors.length === 0 && !isRunning && (
            <div className="text-muted-foreground/60">
              Click Run to execute your code
            </div>
          )}
          {output.map((line, i) => (
            <div
              key={`out-${i}`}
              className="text-foreground leading-relaxed"
              data-testid={`console-output-${i}`}
            >
              {line}
            </div>
          ))}
          {errors.map((line, i) => (
            <div
              key={`err-${i}`}
              className="text-destructive leading-relaxed"
              data-testid={`console-error-${i}`}
            >
              {line}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
