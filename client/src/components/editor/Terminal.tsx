import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, ChevronUp, ChevronDown, Sparkles, Loader2, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface TerminalProps {
  projectId: string;
  isOpen: boolean;
  onToggle: () => void;
  onCommand?: (command: string, output: string) => void;
}

interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "system" | "ai";
  content: string;
  timestamp: Date;
}

type AIModeType = "insert" | "run";

const COMMAND_HISTORY_KEY = "novacode_terminal_history";

const NL_TO_BASH_SYSTEM_PROMPT = `You are a command-line expert assistant. Your task is to convert natural language descriptions into bash/shell commands.

Rules:
1. Return ONLY the bash command, no explanations or markdown formatting
2. If multiple commands are needed, separate them with && or ;
3. Use common CLI tools (npm, git, curl, etc.) appropriately
4. For package installation, detect the appropriate package manager (npm, pip, cargo, etc.)
5. Keep commands safe - never suggest destructive commands without explicit confirmation flags
6. If the request is unclear, provide the most likely intended command

Examples:
- "install react and typescript" → "npm install react typescript"
- "create a new folder called components" → "mkdir components"
- "show all files including hidden" → "ls -la"
- "find all javascript files" → "find . -name '*.js'"
- "initialize a git repo and make first commit" → "git init && git add . && git commit -m 'Initial commit'"`;

export default function Terminal({ projectId, isOpen, onToggle, onCommand }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: "welcome",
      type: "system",
      content: "NovaCode Terminal v1.0.0\nType 'help' for available commands.\n",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem(COMMAND_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isAIMode, setIsAIMode] = useState(false);
  const [aiModeType, setAIModeType] = useState<AIModeType>("insert");
  const [isAILoading, setIsAILoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(commandHistory.slice(-50)));
  }, [commandHistory]);

  const addLine = useCallback((type: TerminalLine["type"], content: string) => {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const convertNLToBash = async (naturalLanguage: string): Promise<string | null> => {
    try {
      setIsAILoading(true);
      const response = await apiRequest("POST", "/api/ai/chat", {
        messages: [
          { role: "user", content: naturalLanguage }
        ],
        systemPrompt: NL_TO_BASH_SYSTEM_PROMPT,
        model: "gpt-4o"
      });
      
      const data = await response.json();
      return data.content?.trim() || null;
    } catch (error) {
      console.error("AI conversion error:", error);
      return null;
    } finally {
      setIsAILoading(false);
    }
  };

  const handleAIConversion = async (naturalLanguage: string) => {
    const trimmed = naturalLanguage.trim();
    if (!trimmed) return;

    addLine("ai", `AI: "${trimmed}"`);
    
    const bashCommand = await convertNLToBash(trimmed);
    
    if (bashCommand) {
      addLine("system", `→ ${bashCommand}`);
      
      if (aiModeType === "run") {
        executeCommand(bashCommand);
      } else {
        setInput(bashCommand);
        setIsAIMode(false);
        addLine("system", "Command inserted. Press Enter to execute.");
      }
    } else {
      addLine("error", "Failed to convert to command. Please try again.");
    }
    
    if (aiModeType === "run") {
      setIsAIMode(false);
    }
  };

  const executeCommand = async (cmd: string) => {
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) return;

    addLine("input", `$ ${trimmedCmd}`);
    setCommandHistory((prev) => [...prev, trimmedCmd]);
    setHistoryIndex(-1);

    const [command, ...args] = trimmedCmd.split(" ");

    switch (command.toLowerCase()) {
      case "help":
        addLine(
          "output",
          `Available commands:
  help          - Show this help message
  clear         - Clear the terminal
  pwd           - Print working directory
  ls            - List files
  cat <file>    - Display file contents
  echo <text>   - Print text
  date          - Show current date/time
  whoami        - Show current user
  npm <cmd>     - Run npm commands
  node <file>   - Run JavaScript file
  history       - Show command history
  about         - About NovaCode IDE

AI Mode (${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+K):
  Press ${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+K to toggle AI mode
  Type natural language, AI converts to bash
  Press Tab to toggle INSERT/RUN mode`
        );
        break;

      case "clear":
        setLines([]);
        break;

      case "pwd":
        addLine("output", `/home/novacode/projects/${projectId}`);
        break;

      case "ls":
        addLine("output", "main.js\npackage.json\nREADME.md");
        break;

      case "cat":
        if (args.length === 0) {
          addLine("error", "cat: missing file operand");
        } else {
          addLine("output", `Contents of ${args[0]}...`);
        }
        break;

      case "echo":
        addLine("output", args.join(" "));
        break;

      case "date":
        addLine("output", new Date().toString());
        break;

      case "whoami":
        addLine("output", "novacode-user");
        break;

      case "npm":
        if (args.length === 0) {
          addLine("error", "Usage: npm <command>");
        } else {
          addLine("system", `Running npm ${args.join(" ")}...`);
          setTimeout(() => {
            if (args[0] === "install" || args[0] === "i") {
              addLine("output", "added 0 packages in 0.5s");
            } else if (args[0] === "start" || args[0] === "run") {
              addLine("output", "Starting application...");
            } else {
              addLine("output", `npm ${args.join(" ")} completed`);
            }
          }, 500);
        }
        break;

      case "node":
        if (args.length === 0) {
          addLine("error", "Usage: node <file.js>");
        } else {
          addLine("system", `Executing ${args[0]}...`);
          setTimeout(() => {
            addLine("output", "Program output would appear here");
          }, 300);
        }
        break;

      case "history":
        addLine("output", commandHistory.slice(-10).map((c, i) => `${i + 1}  ${c}`).join("\n"));
        break;

      case "about":
        addLine(
          "output",
          `NovaCode IDE v1.0.0
An AI-powered cloud development environment
Built with React, TypeScript, and Monaco Editor
Powered by OpenAI GPT-5`
        );
        break;

      default:
        addLine("error", `Command not found: ${command}\nType 'help' for available commands.`);
    }

    onCommand?.(trimmedCmd, "");
  };

  const toggleAIMode = useCallback(() => {
    setIsAIMode((prev) => {
      const newValue = !prev;
      if (newValue) {
        setInput("");
      }
      return newValue;
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMac = navigator.platform.includes("Mac");
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && e.key === "k") {
      e.preventDefault();
      toggleAIMode();
      return;
    }

    if (isAIMode) {
      if (e.key === "Enter" && !isAILoading) {
        e.preventDefault();
        handleAIConversion(input);
        setInput("");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsAIMode(false);
        setInput("");
      } else if (e.key === "Tab") {
        e.preventDefault();
        setAIModeType((prev) => prev === "insert" ? "run" : "insert");
      }
      return;
    }

    if (e.key === "Enter") {
      executeCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  const modKeySymbol = isMac ? "⌘" : "Ctrl";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: isMaximized ? "50%" : 200, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <TerminalIcon className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Terminal</span>
              {isAIMode && (
                <Badge 
                  variant="outline" 
                  className="bg-purple-500/20 text-purple-300 border-purple-500/50 text-xs"
                  data-testid="badge-ai-mode"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Mode
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <Command className="h-3 w-3" />
                <span>{modKeySymbol}+K AI</span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                  onClick={() => setIsMaximized(!isMaximized)}
                  data-testid="button-terminal-maximize"
                >
                  {isMaximized ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                  onClick={onToggle}
                  data-testid="button-terminal-close"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-sm cursor-text"
            onClick={focusInput}
          >
            {lines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "whitespace-pre-wrap",
                  line.type === "input" && "text-green-400",
                  line.type === "output" && "text-zinc-300",
                  line.type === "error" && "text-red-400",
                  line.type === "system" && "text-blue-400",
                  line.type === "ai" && "text-purple-400"
                )}
              >
                {line.content}
              </div>
            ))}
            
            <div className="flex items-center">
              {isAIMode ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] px-1.5 py-0 cursor-pointer select-none",
                        aiModeType === "insert" 
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/50" 
                          : "bg-green-500/20 text-green-300 border-green-500/50"
                      )}
                      onClick={() => setAIModeType((prev) => prev === "insert" ? "run" : "insert")}
                      data-testid="badge-ai-mode-type"
                    >
                      {aiModeType.toUpperCase()}
                    </Badge>
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe what you want to do..."
                    className="flex-1 bg-transparent outline-none text-purple-300 placeholder-purple-500/50 ml-2"
                    autoFocus
                    spellCheck={false}
                    disabled={isAILoading}
                    data-testid="input-ai-command"
                  />
                  {isAILoading && (
                    <Loader2 className="h-4 w-4 text-purple-400 animate-spin ml-2" />
                  )}
                </>
              ) : (
                <>
                  <span className="text-green-400">$ </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent outline-none text-zinc-100 ml-1"
                    autoFocus
                    spellCheck={false}
                    data-testid="input-terminal-command"
                  />
                </>
              )}
            </div>
          </div>
          
          {isAIMode && (
            <div className="px-3 py-1.5 bg-zinc-900/50 border-t border-zinc-800 text-xs text-zinc-500 flex items-center justify-between gap-2">
              <span>
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">Tab</kbd>
                {" "}to toggle INSERT/RUN
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">Esc</kbd>
                {" "}to exit AI mode
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function TerminalToggle({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="gap-2 text-muted-foreground hover:text-foreground"
      data-testid="button-terminal-toggle"
    >
      <TerminalIcon className="h-4 w-4" />
      Terminal
      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
    </Button>
  );
}
