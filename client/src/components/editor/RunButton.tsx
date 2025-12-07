import { Play, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface RunButtonProps {
  isRunning: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export default function RunButton({ isRunning, onClick, disabled }: RunButtonProps) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Button
        onClick={onClick}
        disabled={disabled || isRunning}
        className="gap-2 bg-green-600 hover:bg-green-700 text-white px-4"
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
      </Button>
    </motion.div>
  );
}
