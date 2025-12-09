import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  X, 
  File, 
  Code, 
  Loader2,
  Check,
  ChevronRight,
  AtSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface InlineSuggestionProps {
  isOpen: boolean;
  position: { line: number; column: number; top: number; left: number };
  currentCode: string;
  language: string;
  filePath?: string;
  projectFiles?: { path: string; content: string }[];
  onClose: () => void;
  onAccept: (code: string) => void;
  onInsert: (code: string) => void;
}

interface AutocompleteItem {
  type: 'file' | 'code' | 'symbol';
  label: string;
  value: string;
}

export default function InlineSuggestion({
  isOpen,
  position,
  currentCode,
  language,
  filePath,
  projectFiles = [],
  onClose,
  onAccept,
  onInsert,
}: InlineSuggestionProps) {
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [selectedAutocomplete, setSelectedAutocomplete] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setInput('');
      setSuggestion('');
      setError(null);
      setShowAutocomplete(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const lastAt = input.lastIndexOf('@');
    if (lastAt !== -1) {
      const query = input.slice(lastAt + 1).toLowerCase();
      const items: AutocompleteItem[] = [];

      if ('file'.startsWith(query) || query === '') {
        items.push({ type: 'file', label: '@file', value: '@file:' });
      }
      if ('code'.startsWith(query) || query === '') {
        items.push({ type: 'code', label: '@code', value: '@code:' });
      }

      const fileMatches = projectFiles
        .filter(f => f.path.toLowerCase().includes(query))
        .slice(0, 5)
        .map(f => ({
          type: 'file' as const,
          label: `@${f.path}`,
          value: `@file:${f.path}`,
        }));

      items.push(...fileMatches);

      if (items.length > 0 && query.length > 0) {
        setAutocompleteItems(items);
        setShowAutocomplete(true);
        setSelectedAutocomplete(0);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  }, [input, projectFiles]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const context = `Current file: ${filePath || 'unknown'}\nLanguage: ${language}\nCurrent code context:\n\`\`\`${language}\n${currentCode}\n\`\`\``;

      const response = await apiRequest('POST', '/api/ai/chat', {
        messages: [
          { role: 'user', content: `Generate code for: ${input}\n\nContext:\n${context}\n\nRespond with ONLY the code, no explanations.` }
        ],
        model: 'gpt-4o-mini',
        mode: 'edit',
      });

      const data = await response.json();
      
      let generatedCode = data.content || data.message || '';
      
      const codeMatch = generatedCode.match(/```(?:\w+)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        generatedCode = codeMatch[1].trim();
      }

      setSuggestion(generatedCode);
    } catch (err: any) {
      setError(err.message || 'Failed to generate suggestion');
    } finally {
      setIsLoading(false);
    }
  }, [input, currentCode, language, filePath, isLoading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAutocomplete(prev => 
          Math.min(prev + 1, autocompleteItems.length - 1)
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAutocomplete(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selected = autocompleteItems[selectedAutocomplete];
        if (selected) {
          const lastAt = input.lastIndexOf('@');
          setInput(input.slice(0, lastAt) + selected.value + ' ');
          setShowAutocomplete(false);
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (suggestion) {
        onAccept(suggestion);
        onClose();
      } else {
        handleSubmit();
      }
      return;
    }

    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      onAccept(suggestion);
      onClose();
      return;
    }
  }, [showAutocomplete, autocompleteItems, selectedAutocomplete, input, suggestion, onClose, onAccept, handleSubmit]);

  const handleAcceptSuggestion = () => {
    if (suggestion) {
      onAccept(suggestion);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="absolute z-50"
        style={{
          top: position.top,
          left: position.left,
          maxWidth: 'calc(100% - 40px)',
        }}
        data-testid="inline-suggestion-overlay"
      >
        <div className={cn(
          "bg-background/95 backdrop-blur-xl border rounded-lg shadow-2xl overflow-hidden",
          "ring-1 ring-primary/20",
          suggestion && "ring-2 ring-primary/40 shadow-primary/20"
        )}>
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">AI Inline Edit</span>
            <div className="flex-1" />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Tab to accept
            </kbd>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onClose}
              data-testid="button-close-inline"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="p-3 space-y-3">
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                <AtSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what you want... (@ for files/code)"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  data-testid="input-inline-prompt"
                />
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    data-testid="button-generate-inline"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <AnimatePresence>
                {showAutocomplete && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden z-10"
                  >
                    {autocompleteItems.map((item, idx) => (
                      <button
                        key={item.value}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors",
                          idx === selectedAutocomplete 
                            ? "bg-primary/10 text-foreground" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => {
                          const lastAt = input.lastIndexOf('@');
                          setInput(input.slice(0, lastAt) + item.value + ' ');
                          setShowAutocomplete(false);
                          inputRef.current?.focus();
                        }}
                      >
                        {item.type === 'file' ? (
                          <File className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <Code className="h-3.5 w-3.5 text-green-500" />
                        )}
                        <span className="font-mono">{item.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <div className="px-3 py-2 bg-destructive/10 text-destructive text-xs rounded-md">
                {error}
              </div>
            )}

            {suggestion && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="relative"
              >
                <div className={cn(
                  "relative overflow-hidden rounded-md border bg-muted/30",
                  "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:pointer-events-none",
                  "shadow-[0_0_15px_rgba(var(--primary),0.15)]"
                )}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-medium text-primary">AI Suggestion</span>
                  </div>
                  <pre className="p-3 text-xs font-mono overflow-x-auto max-h-[200px]">
                    <code className="text-foreground/90">{suggestion}</code>
                  </pre>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={handleAcceptSuggestion}
                    className="gap-1.5"
                    data-testid="button-accept-suggestion"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                    <kbd className="ml-1 text-[10px] opacity-70">Tab</kbd>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSuggestion('')}
                  >
                    Discard
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    Regenerate
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
