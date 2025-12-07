import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Mic,
  MicOff,
  Image,
  Sparkles,
  Code,
  FileText,
  Bug,
  TestTube,
  Wand2,
  MessageSquare,
  Loader2,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
}

interface AIPanelProps {
  currentFile?: { path: string; content: string; language: string };
  onApplyCode?: (code: string) => void;
  projectContext?: string;
}

type AIMode = "chat" | "edit" | "builder" | "debug" | "tests" | "docs";

const modeConfig = {
  chat: { icon: MessageSquare, label: "Chat", color: "text-blue-500" },
  edit: { icon: Code, label: "Edit Code", color: "text-green-500" },
  builder: { icon: Wand2, label: "Builder", color: "text-purple-500" },
  debug: { icon: Bug, label: "Debug", color: "text-red-500" },
  tests: { icon: TestTube, label: "Generate Tests", color: "text-yellow-500" },
  docs: { icon: FileText, label: "Generate Docs", color: "text-cyan-500" },
};

export default function AIPanel({ currentFile, onApplyCode, projectContext }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AIMode>("chat");
  const [isRecording, setIsRecording] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && attachedImages.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
      images: attachedImages.length > 0 ? [...attachedImages] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachedImages([]);
    setIsLoading(true);

    try {
      let response;
      const fileContext = currentFile
        ? `Current file: ${currentFile.path}\nLanguage: ${currentFile.language}\n\`\`\`${currentFile.language}\n${currentFile.content}\n\`\`\``
        : "";

      switch (mode) {
        case "chat":
          response = await apiRequest("POST", "/api/ai/chat", {
            messages: [
              ...messages.map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: input },
            ],
            systemPrompt: `You are NovaCode AI, a helpful coding assistant. ${fileContext ? `\n\n${fileContext}` : ""}${projectContext ? `\n\nProject context:\n${projectContext}` : ""}`,
          });
          const chatData = await response.json();
          addAssistantMessage(chatData.content);
          break;

        case "edit":
          if (!currentFile) {
            addAssistantMessage("Please open a file to edit.");
            break;
          }
          response = await apiRequest("POST", "/api/ai/edit", {
            instruction: input,
            code: currentFile.content,
            language: currentFile.language,
            context: projectContext,
          });
          const editData = await response.json();
          addAssistantMessage(`Here's the edited code:\n\n\`\`\`${currentFile.language}\n${editData.code}\n\`\`\`\n\nClick "Apply" to update the file.`);
          break;

        case "builder":
          response = await apiRequest("POST", "/api/ai/builder/plan", {
            prompt: input,
            projectStructure: projectContext,
          });
          const planData = await response.json();
          const planMessage = `## Build Plan\n\n${planData.summary}\n\n### Steps:\n${planData.steps?.map((s: any, i: number) => `${i + 1}. **${s.action}** - ${s.description}\n   Files: ${s.files?.join(", ") || "N/A"}`).join("\n") || "No steps generated"}`;
          addAssistantMessage(planMessage);
          break;

        case "debug":
          if (!currentFile) {
            addAssistantMessage("Please open a file to debug.");
            break;
          }
          response = await apiRequest("POST", "/api/ai/debug", {
            code: currentFile.content,
            error: input,
            language: currentFile.language,
          });
          const debugData = await response.json();
          addAssistantMessage(`## Debug Analysis\n\n**Explanation:**\n${debugData.explanation}\n\n**Suggested Fix:**\n\`\`\`${currentFile.language}\n${debugData.fix}\n\`\`\``);
          break;

        case "tests":
          if (!currentFile) {
            addAssistantMessage("Please open a file to generate tests for.");
            break;
          }
          response = await apiRequest("POST", "/api/ai/generate-tests", {
            code: currentFile.content,
            language: currentFile.language,
          });
          const testsData = await response.json();
          addAssistantMessage(`## Generated Tests\n\n${testsData.tests}`);
          break;

        case "docs":
          if (!currentFile) {
            addAssistantMessage("Please open a file to document.");
            break;
          }
          response = await apiRequest("POST", "/api/ai/generate-docs", {
            code: currentFile.content,
            language: currentFile.language,
          });
          const docsData = await response.json();
          addAssistantMessage(`## Documentation\n\n${docsData.docs}`);
          break;
      }
    } catch (error: any) {
      addAssistantMessage(`Error: ${error.message || "Something went wrong. Please try again."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addAssistantMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        setAttachedImages((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(",")[1];
          try {
            const response = await apiRequest("POST", "/api/ai/transcribe", { audio: base64 });
            const data = await response.json();
            setInput((prev) => prev + (prev ? " " : "") + data.text);
          } catch (error) {
            console.error("Transcription failed:", error);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const ModeIcon = modeConfig[mode].icon;

  return (
    <div className="h-full flex flex-col bg-background border-l">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">NovaCode AI</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ModeIcon className={cn("h-4 w-4", modeConfig[mode].color)} />
              {modeConfig[mode].label}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {Object.entries(modeConfig).map(([key, config]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setMode(key as AIMode)}
                className="gap-2"
              >
                <config.icon className={cn("h-4 w-4", config.color)} />
                {config.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Start a conversation with NovaCode AI</p>
              <p className="text-xs mt-2">
                Current mode: <span className={modeConfig[mode].color}>{modeConfig[mode].label}</span>
              </p>
            </div>
          )}
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "p-3 rounded-lg",
                  message.role === "user"
                    ? "bg-primary/10 ml-8"
                    : "bg-muted mr-8"
                )}
              >
                {message.images && message.images.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {message.images.map((img, i) => (
                      <img
                        key={i}
                        src={`data:image/jpeg;base64,${img}`}
                        alt="Attached"
                        className="h-16 w-16 object-cover rounded"
                      />
                    ))}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {attachedImages.length > 0 && (
        <div className="flex gap-2 px-3 py-2 border-t flex-wrap">
          {attachedImages.map((img, i) => (
            <div key={i} className="relative">
              <img
                src={`data:image/jpeg;base64,${img}`}
                alt="Attached"
                className="h-12 w-12 object-cover rounded"
              />
              <button
                onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask NovaCode AI (${modeConfig[mode].label} mode)...`}
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              multiple
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <Image className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isRecording && "text-red-500")}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && attachedImages.length === 0)}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
