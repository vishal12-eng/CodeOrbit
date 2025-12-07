import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TerminalProps {
  projectId: string;
  isOpen: boolean;
  onToggle: () => void;
  onCommand?: (command: string, output: string) => void;
}

interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "system";
  content: string;
  timestamp: Date;
}

const COMMAND_HISTORY_KEY = "novacode_terminal_history";

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
  about         - About NovaCode IDE`
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                onClick={() => setIsMaximized(!isMaximized)}
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
              >
                <X className="h-3 w-3" />
              </Button>
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
                  line.type === "system" && "text-blue-400"
                )}
              >
                {line.content}
              </div>
            ))}
            <div className="flex items-center">
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
              />
            </div>
          </div>
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
    >
      <TerminalIcon className="h-4 w-4" />
      Terminal
      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
    </Button>
  );
}
