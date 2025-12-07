import { Play, Loader2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type RunnerType = 'nodejs' | 'python' | 'react' | 'nextjs' | 'static';

interface RunnerInfo {
  id: RunnerType;
  label: string;
  shortLabel: string;
}

export const RUNNER_OPTIONS: RunnerInfo[] = [
  { id: 'nodejs', label: 'Node.js', shortLabel: 'Node' },
  { id: 'python', label: 'Python', shortLabel: 'Python' },
  { id: 'react', label: 'React', shortLabel: 'React' },
  { id: 'nextjs', label: 'Next.js', shortLabel: 'Next.js' },
  { id: 'static', label: 'Static HTML', shortLabel: 'Static' },
];

interface RunButtonProps {
  isRunning: boolean;
  onClick: () => void;
  disabled?: boolean;
  runnerType?: RunnerType;
  onRunnerChange?: (runner: RunnerType) => void;
  showRunner?: boolean;
}

export default function RunButton({ 
  isRunning, 
  onClick, 
  disabled,
  runnerType = 'nodejs',
  onRunnerChange,
  showRunner = true,
}: RunButtonProps) {
  const currentRunner = RUNNER_OPTIONS.find(r => r.id === runnerType) || RUNNER_OPTIONS[0];

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex">
      <Button
        onClick={onClick}
        disabled={disabled || isRunning}
        className={cn(
          "gap-2 bg-green-600 hover:bg-green-700 text-white",
          showRunner && onRunnerChange ? "rounded-r-none" : "px-4"
        )}
        data-testid="button-run"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Running
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Run
          </>
        )}
        {showRunner && !onRunnerChange && (
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-green-700/50">
            {currentRunner.shortLabel}
          </Badge>
        )}
      </Button>
      {showRunner && onRunnerChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white px-2 rounded-l-none border-l border-green-500/50"
              disabled={disabled || isRunning}
              data-testid="button-runner-dropdown"
            >
              <span className="text-xs mr-1">{currentRunner.shortLabel}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {RUNNER_OPTIONS.map((runner) => (
              <DropdownMenuItem
                key={runner.id}
                onClick={() => onRunnerChange(runner.id)}
                className={cn(runnerType === runner.id && "bg-muted")}
                data-testid={`runner-option-${runner.id}`}
              >
                {runner.label}
                {runnerType === runner.id && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </motion.div>
  );
}
