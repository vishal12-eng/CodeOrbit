import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle } from 'lucide-react';

type SaveState = 'saved' | 'saving' | 'error' | 'unsaved';

interface SaveStatusProps {
  status: SaveState;
}

export default function SaveStatus({ status }: SaveStatusProps) {
  const getStatusContent = () => {
    switch (status) {
      case 'saving':
        return (
          <motion.div
            key="saving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving...</span>
          </motion.div>
        );
      case 'saved':
        return (
          <motion.div
            key="saved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-green-500"
          >
            <Check className="h-3 w-3" />
            <span>Saved</span>
          </motion.div>
        );
      case 'error':
        return (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-destructive"
          >
            <AlertCircle className="h-3 w-3" />
            <span>Error saving</span>
          </motion.div>
        );
      case 'unsaved':
        return (
          <motion.div
            key="unsaved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            <span>Unsaved changes</span>
          </motion.div>
        );
    }
  };

  return (
    <div className="text-xs" data-testid="save-status">
      <AnimatePresence mode="wait">
        {getStatusContent()}
      </AnimatePresence>
    </div>
  );
}
