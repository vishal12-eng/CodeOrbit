import { useState, useMemo, useCallback } from 'react';
import { Search, Replace, X, ChevronDown, ChevronRight, FileCode, CaseSensitive, Regex } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface FileMatch {
  path: string;
  matches: LineMatch[];
}

interface LineMatch {
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchPanelProps {
  files: { path: string; content: string }[];
  onResultClick: (path: string, lineNumber: number) => void;
  onReplace?: (path: string, lineNumber: number, oldText: string, newText: string) => void;
  onReplaceAll?: (replacements: { path: string; oldContent: string; newContent: string }[]) => void;
  onClose?: () => void;
}

export default function SearchPanel({
  files,
  onResultClick,
  onReplace,
  onReplaceAll,
  onClose,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const results: FileMatch[] = [];

    for (const file of files) {
      const lines = file.content.split('\n');
      const fileMatches: LineMatch[] = [];

      let searchPattern: RegExp;
      try {
        if (isRegex) {
          searchPattern = new RegExp(query, isCaseSensitive ? 'g' : 'gi');
        } else {
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchPattern = new RegExp(escapedQuery, isCaseSensitive ? 'g' : 'gi');
        }
      } catch {
        continue;
      }

      lines.forEach((line, index) => {
        searchPattern.lastIndex = 0;
        let match;
        while ((match = searchPattern.exec(line)) !== null) {
          fileMatches.push({
            lineNumber: index + 1,
            lineContent: line,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });
          if (match[0].length === 0) break;
        }
      });

      if (fileMatches.length > 0) {
        results.push({ path: file.path, matches: fileMatches });
      }
    }

    return results;
  }, [query, files, isRegex, isCaseSensitive]);

  const totalMatches = useMemo(() => {
    return searchResults.reduce((sum, file) => sum + file.matches.length, 0);
  }, [searchResults]);

  const toggleFileExpanded = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleResultClick = useCallback(
    (path: string, lineNumber: number) => {
      onResultClick(path, lineNumber);
    },
    [onResultClick]
  );

  const handleReplaceInFile = useCallback(
    (path: string, match: LineMatch) => {
      if (!onReplace) return;
      const matchText = match.lineContent.substring(match.matchStart, match.matchEnd);
      onReplace(path, match.lineNumber, matchText, replaceText);
    },
    [onReplace, replaceText]
  );

  const handleReplaceAll = useCallback(() => {
    if (!onReplaceAll || !query.trim()) return;

    const replacements: { path: string; oldContent: string; newContent: string }[] = [];

    for (const file of files) {
      let searchPattern: RegExp;
      try {
        if (isRegex) {
          searchPattern = new RegExp(query, isCaseSensitive ? 'g' : 'gi');
        } else {
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchPattern = new RegExp(escapedQuery, isCaseSensitive ? 'g' : 'gi');
        }
      } catch {
        continue;
      }

      const newContent = file.content.replace(searchPattern, replaceText);
      if (newContent !== file.content) {
        replacements.push({
          path: file.path,
          oldContent: file.content,
          newContent,
        });
      }
    }

    if (replacements.length > 0) {
      onReplaceAll(replacements);
    }
  }, [onReplaceAll, query, replaceText, files, isRegex, isCaseSensitive]);

  const getFileName = (path: string) => path.split('/').pop() || path;

  const highlightMatch = (line: string, start: number, end: number) => {
    const before = line.substring(0, start);
    const match = line.substring(start, end);
    const after = line.substring(end);

    const trimmedBefore = before.length > 30 ? '...' + before.slice(-30) : before;
    const trimmedAfter = after.length > 30 ? after.slice(0, 30) + '...' : after;

    return (
      <span className="font-mono text-xs">
        <span className="text-muted-foreground">{trimmedBefore}</span>
        <span className="bg-yellow-500/30 text-foreground font-medium">{match}</span>
        <span className="text-muted-foreground">{trimmedAfter}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full" data-testid="search-panel">
      <div className="flex items-center justify-between gap-2 p-2 border-b">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Search</span>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-2 space-y-2 border-b">
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Input
              placeholder="Search in files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-16"
              data-testid="input-search-query"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-6 w-6',
                      isCaseSensitive && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                    data-testid="button-toggle-case-sensitive"
                  >
                    <CaseSensitive className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Match Case</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-6 w-6',
                      isRegex && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => setIsRegex(!isRegex)}
                    data-testid="button-toggle-regex"
                  >
                    <Regex className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Use Regular Expression</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowReplace(!showReplace)}
                className={cn(showReplace && 'bg-accent text-accent-foreground')}
                data-testid="button-toggle-replace"
              >
                <Replace className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Replace</TooltipContent>
          </Tooltip>
        </div>

        {showReplace && (
          <div className="flex items-center gap-1">
            <Input
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="flex-1"
              data-testid="input-replace-text"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReplaceAll}
                  disabled={!query.trim() || totalMatches === 0}
                  data-testid="button-replace-all"
                >
                  Replace All
                </Button>
              </TooltipTrigger>
              <TooltipContent>Replace all occurrences</TooltipContent>
            </Tooltip>
          </div>
        )}

        {query.trim() && (
          <div className="text-xs text-muted-foreground">
            {totalMatches} result{totalMatches !== 1 ? 's' : ''} in{' '}
            {searchResults.length} file{searchResults.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {searchResults.length === 0 && query.trim() && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}

          {searchResults.map((fileResult) => (
            <Collapsible
              key={fileResult.path}
              open={expandedFiles.has(fileResult.path) || expandedFiles.size === 0}
              onOpenChange={() => toggleFileExpanded(fileResult.path)}
            >
              <CollapsibleTrigger
                className="flex items-center gap-2 w-full p-1.5 hover-elevate rounded-md text-left"
                data-testid={`search-result-file-${fileResult.path}`}
              >
                {expandedFiles.has(fileResult.path) || expandedFiles.size === 0 ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
                <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-sm truncate flex-1">{getFileName(fileResult.path)}</span>
                <Badge variant="secondary" className="text-xs">
                  {fileResult.matches.length}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-5 border-l pl-2">
                  {fileResult.matches.map((match, idx) => (
                    <div
                      key={`${fileResult.path}-${match.lineNumber}-${idx}`}
                      className="flex items-center gap-1 group"
                    >
                      <button
                        className="flex-1 flex items-center gap-2 p-1 hover-elevate rounded-md text-left min-w-0"
                        onClick={() => handleResultClick(fileResult.path, match.lineNumber)}
                        data-testid={`search-result-line-${fileResult.path}-${match.lineNumber}`}
                      >
                        <span className="text-xs text-muted-foreground w-8 shrink-0 text-right">
                          {match.lineNumber}
                        </span>
                        <div className="truncate min-w-0">
                          {highlightMatch(
                            match.lineContent,
                            match.matchStart,
                            match.matchEnd
                          )}
                        </div>
                      </button>
                      {showReplace && onReplace && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => handleReplaceInFile(fileResult.path, match)}
                          data-testid={`button-replace-${fileResult.path}-${match.lineNumber}`}
                        >
                          <Replace className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
