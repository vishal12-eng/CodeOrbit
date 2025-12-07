import { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, Copy, Check, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'warning' | 'info' | 'system';
  message: string;
  timestamp: Date;
}

interface ConsoleProps {
  output: string[];
  errors: string[];
  isRunning: boolean;
  onClear: () => void;
  executionTime?: number;
  logs?: LogEntry[];
  serverLogs?: LogEntry[];
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function LogLine({ entry }: { entry: LogEntry }) {
  const isError = entry.type === 'stderr';
  const isWarning = entry.type === 'warning';
  const isSystem = entry.type === 'system';
  const isInfo = entry.type === 'info';

  return (
    <div
      className={cn(
        "flex items-start gap-2 py-0.5 font-mono text-xs leading-relaxed",
        isError && "text-red-500 dark:text-red-400",
        isWarning && "text-yellow-600 dark:text-yellow-400",
        isSystem && "text-blue-500 dark:text-blue-400",
        isInfo && "text-muted-foreground"
      )}
      data-testid={`log-entry-${entry.id}`}
    >
      <span className="text-muted-foreground/60 shrink-0 select-none">
        [{formatTimestamp(entry.timestamp)}]
      </span>
      {isWarning && <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
      <span className="whitespace-pre-wrap break-all">{entry.message}</span>
    </div>
  );
}

export default function Console({ 
  output, 
  errors, 
  isRunning, 
  onClear,
  executionTime,
  logs: externalLogs,
  serverLogs = [],
}: ConsoleProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'server'>('console');
  const scrollRef = useRef<HTMLDivElement>(null);

  const consoleLogs: LogEntry[] = externalLogs || [
    ...output.map((msg, i) => ({
      id: `out-${i}`,
      type: 'stdout' as const,
      message: msg,
      timestamp: new Date(),
    })),
    ...errors.map((msg, i) => ({
      id: `err-${i}`,
      type: msg.toLowerCase().includes('warning') ? 'warning' as const : 'stderr' as const,
      message: msg,
      timestamp: new Date(),
    })),
  ];

  const hasErrors = errors.length > 0 || consoleLogs.some(l => l.type === 'stderr');
  const hasWarnings = consoleLogs.some(l => l.type === 'warning');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleLogs, serverLogs]);

  const handleCopy = async () => {
    const currentLogs = activeTab === 'console' ? consoleLogs : serverLogs;
    const text = currentLogs.map(l => `[${formatTimestamp(l.timestamp)}] ${l.message}`).join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-muted/20">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-background/50 shrink-0">
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'console' | 'server')}>
            <TabsList className="h-7 bg-muted/50">
              <TabsTrigger 
                value="console" 
                className="text-xs px-3 h-6 gap-1.5 data-[state=active]:bg-background"
                data-testid="tab-console-output"
              >
                <Terminal className="h-3 w-3" />
                Console
                {hasErrors && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                    {errors.length || consoleLogs.filter(l => l.type === 'stderr').length}
                  </Badge>
                )}
                {!hasErrors && hasWarnings && (
                  <Badge className="h-4 px-1 text-[10px] bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                    !
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="server" 
                className="text-xs px-3 h-6 gap-1.5 data-[state=active]:bg-background"
                data-testid="tab-server-logs"
              >
                Server
                {serverLogs.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {serverLogs.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Running...
            </span>
          )}
          {executionTime !== undefined && !isRunning && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="execution-time">
              <Clock className="h-3 w-3" />
              {executionTime}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopy}
            disabled={consoleLogs.length === 0 && serverLogs.length === 0}
            data-testid="button-copy-console"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
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
      </div>
      
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 font-mono text-xs min-h-full">
          {activeTab === 'console' && (
            <>
              {consoleLogs.length === 0 && !isRunning && (
                <div className="text-muted-foreground/60" data-testid="console-empty-state">
                  Click Run to execute your code
                </div>
              )}
              {consoleLogs.map((entry) => (
                <LogLine key={entry.id} entry={entry} />
              ))}
            </>
          )}
          {activeTab === 'server' && (
            <>
              {serverLogs.length === 0 && (
                <div className="text-muted-foreground/60" data-testid="server-logs-empty-state">
                  Server logs will appear here when running a web server
                </div>
              )}
              {serverLogs.map((entry) => (
                <LogLine key={entry.id} entry={entry} />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
