import { useState, useRef, useEffect } from "react";
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
  Zap,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  model?: string;
}

interface AIPanelProps {
  currentFile?: { path: string; content: string; language: string };
  onApplyCode?: (code: string) => void;
  projectContext?: string;
  onOpenBuilder?: () => void;
  onOpenOneShot?: () => void;
}

type AIMode = "chat" | "edit" | "builder" | "debug" | "tests" | "docs";

type ModelId = 
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4-turbo"
  | "gpt-4"
  | "claude-3-5-sonnet"
  | "claude-3-opus"
  | "gemini-1.5-pro"
  | "gemini-pro"
  | "grok-1";

interface ModelConfig {
  id: ModelId;
  name: string;
  type: "openai" | "anthropic" | "gemini" | "grok";
  available?: boolean;
}

const modeConfig = {
  chat: { icon: MessageSquare, label: "Chat", color: "text-blue-500" },
  edit: { icon: Code, label: "Edit Code", color: "text-green-500" },
  builder: { icon: Wand2, label: "Builder", color: "text-purple-500" },
  debug: { icon: Bug, label: "Debug", color: "text-red-500" },
  tests: { icon: TestTube, label: "Tests", color: "text-yellow-500" },
  docs: { icon: FileText, label: "Docs", color: "text-cyan-500" },
};

const modelTypeColors: Record<string, string> = {
  openai: "text-emerald-500",
  anthropic: "text-orange-500",
  gemini: "text-blue-500",
  grok: "text-violet-500",
};

const defaultModels: ModelConfig[] = [
  { id: "gpt-4o", name: "GPT-4o", type: "openai" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", type: "openai" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", type: "anthropic" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", type: "gemini" },
  { id: "grok-1", name: "Grok", type: "grok" },
];

export default function AIPanel({ 
  currentFile, 
  onApplyCode, 
  projectContext,
  onOpenBuilder,
  onOpenOneShot,
}: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AIMode>("chat");
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4o");
  const [isRecording, setIsRecording] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { data: modelsData } = useQuery<{ models: ModelConfig[]; available: ModelConfig[] }>({
    queryKey: ["/api/ai/models"],
  });

  const availableModels = modelsData?.models || defaultModels;

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
            model: selectedModel,
          });
          const chatData = await response.json();
          addAssistantMessage(chatData.content, chatData.model);
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
            model: selectedModel,
          });
          const editData = await response.json();
          const editMessage = editData.diff 
            ? `## Changes\n${editData.diff}\n\n${editData.explanation || ""}\n\n\`\`\`${currentFile.language}\n${editData.code}\n\`\`\``
            : `Here's the edited code:\n\n\`\`\`${currentFile.language}\n${editData.code}\n\`\`\`\n\nClick "Apply" to update the file.`;
          addAssistantMessage(editMessage, editData.model);
          break;

        case "builder":
          response = await apiRequest("POST", "/api/ai/builder/plan", {
            prompt: input,
            projectStructure: projectContext,
            model: selectedModel,
          });
          const planData = await response.json();
          const planMessage = `## Build Plan\n\n**${planData.summary}**\n\nComplexity: ${planData.complexity || "medium"} | Est. Time: ${planData.estimatedTime || "5-10 min"}\n\n### Steps:\n${planData.steps?.map((s: any, i: number) => `${i + 1}. **${s.action}** - ${s.description}\n   Files: ${s.files?.join(", ") || "N/A"}`).join("\n") || "No steps generated"}`;
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
            model: selectedModel,
          });
          const debugData = await response.json();
          addAssistantMessage(`## Debug Analysis\n\n**Explanation:**\n${debugData.explanation}\n\n**Suggested Fix:**\n\`\`\`${currentFile.language}\n${debugData.fix}\n\`\`\``, debugData.model);
          break;

        case "tests":
          if (!currentFile) {
            addAssistantMessage("Please open a file to generate tests for.");
            break;
          }
          response = await apiRequest("POST", "/api/ai/generate-tests", {
            code: currentFile.content,
            language: currentFile.language,
            model: selectedModel,
          });
          const testsData = await response.json();
          addAssistantMessage(`## Generated Tests\n\n${testsData.tests}`, testsData.model);
          break;

        case "docs":
          if (!currentFile) {
            addAssistantMessage("Please open a file to document.");
            break;
          }
          response = await apiRequest("POST", "/api/ai/generate-docs", {
            code: currentFile.content,
            language: currentFile.language,
            model: selectedModel,
          });
          const docsData = await response.json();
          addAssistantMessage(`## Documentation\n\n${docsData.docs}`, docsData.model);
          break;
      }
    } catch (error: any) {
      addAssistantMessage(`Error: ${error.message || "Something went wrong. Please try again."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addAssistantMessage = (content: string, model?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content,
        timestamp: new Date(),
        model,
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

  const getModelInfo = (modelId: ModelId): ModelConfig | undefined => {
    return availableModels.find(m => m.id === modelId);
  };

  const currentModel = getModelInfo(selectedModel);
  const ModeIcon = modeConfig[mode].icon;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <Bot className={cn("h-3.5 w-3.5", currentModel ? modelTypeColors[currentModel.type] : "")} />
                <span className="hidden lg:inline">{currentModel?.name || "GPT-4o"}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Select Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {["openai", "anthropic", "gemini", "grok"].map((type) => {
                const typeModels = availableModels.filter(m => m.type === type);
                if (typeModels.length === 0) return null;
                return (
                  <div key={type}>
                    <DropdownMenuLabel className={cn("text-[10px] uppercase tracking-wider", modelTypeColors[type])}>
                      {type}
                    </DropdownMenuLabel>
                    {typeModels.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={cn("gap-2 text-xs", model.available === false && "opacity-50")}
                        disabled={model.available === false}
                      >
                        <Bot className={cn("h-3 w-3", modelTypeColors[model.type])} />
                        {model.name}
                        {model.id === selectedModel && (
                          <Badge variant="secondary" className="ml-auto text-[9px]">Active</Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <ModeIcon className={cn("h-3.5 w-3.5", modeConfig[mode].color)} />
                <span className="hidden sm:inline">{modeConfig[mode].label}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {Object.entries(modeConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setMode(key as AIMode)}
                  className="gap-2 text-xs"
                >
                  <config.icon className={cn("h-3.5 w-3.5", config.color)} />
                  {config.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {onOpenBuilder && (
                <DropdownMenuItem onClick={onOpenBuilder} className="gap-2 text-xs">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Builder Mode
                </DropdownMenuItem>
              )}
              {onOpenOneShot && (
                <DropdownMenuItem onClick={onOpenOneShot} className="gap-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-pink-500" />
                  One-Shot Creator
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                Mode: <span className={modeConfig[mode].color}>{modeConfig[mode].label}</span>
                {" | "}
                Model: <span className={currentModel ? modelTypeColors[currentModel.type] : ""}>{currentModel?.name || "GPT-4o"}</span>
              </p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "p-3 rounded-lg text-sm",
                message.role === "user"
                  ? "bg-primary/10 ml-6"
                  : "bg-muted/50 mr-6"
              )}
            >
              {message.images && message.images.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {message.images.map((img, i) => (
                    <img
                      key={i}
                      src={`data:image/jpeg;base64,${img}`}
                      alt="Attached"
                      className="h-14 w-14 object-cover rounded"
                    />
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground/60">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {message.model && message.role === "assistant" && (
                  <Badge variant="outline" className="text-[9px] h-4">
                    {message.model}
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Thinking with {currentModel?.name || "GPT-4o"}...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {attachedImages.length > 0 && (
        <div className="flex gap-2 px-3 py-2 border-t flex-wrap bg-muted/20">
          {attachedImages.map((img, i) => (
            <div key={i} className="relative">
              <img
                src={`data:image/jpeg;base64,${img}`}
                alt="Attached"
                className="h-10 w-10 object-cover rounded"
              />
              <button
                onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 border-t bg-background shrink-0">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask AI (${modeConfig[mode].label})...`}
          className="min-h-[56px] max-h-[120px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          data-testid="input-ai-message"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-0.5">
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
              className="h-7 w-7"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-attach-image"
            >
              <Image className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", isRecording && "text-red-500 bg-red-500/10")}
              onClick={isRecording ? stopRecording : startRecording}
              data-testid="button-voice-input"
            >
              {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <Button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && attachedImages.length === 0)}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            data-testid="button-send-ai-message"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
