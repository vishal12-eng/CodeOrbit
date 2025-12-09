import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
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
  StopCircle,
  Cpu,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import SpeechInput from "@/components/editor/SpeechInput";
import { useToast } from "@/hooks/use-toast";
import { AIMessage } from "./AIMessage";
import { AIHeader } from "./AIHeader";
import { ActionList } from "./ActionList";
import { AIProgressBubble } from "./AIProgressBubble";
import { useSSEChat } from "@/hooks/useSSEChat";
import AgentPanel from "./AgentPanel";
import type { StructuredAIResponse, FileAction, StreamThinkingEvent } from "@shared/aiSchema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  model?: string;
  structuredResponse?: StructuredAIResponse;
}

interface AIPanelProps {
  currentFile?: { path: string; content: string; language: string };
  onApplyCode?: (code: string) => void;
  projectContext?: string;
  onOpenBuilder?: () => void;
  onOpenOneShot?: () => void;
}

type AIMode = "chat" | "edit" | "builder" | "debug" | "tests" | "docs";
type PanelMode = "chat" | "builder" | "agent";

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
  const [panelMode, setPanelMode] = useState<PanelMode>("chat");
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4o");
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [currentActionCount, setCurrentActionCount] = useState(0);
  const [useStreaming, setUseStreaming] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const {
    isThinking,
    isStreaming,
    isComplete,
    thinkingSteps,
    streamedContent,
    actions: streamActions,
    model: streamModel,
    error: streamError,
    startStream,
    stopStream,
    reset: resetStream,
  } = useSSEChat({
    onComplete: (data) => {
      addAssistantMessage(streamedContent, data.model, undefined);
    },
    onError: (error) => {
      toast({
        title: "Streaming Error",
        description: error,
        variant: "destructive",
      });
    },
  });

  const handleSpeechTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setInput((prev) => prev + (prev ? " " : "") + text);
    }
  }, []);

  const handleAudioRecorded = useCallback(async (audioBase64: string) => {
    try {
      const response = await apiRequest("POST", "/api/ai/transcribe", { audio: audioBase64 });
      const data = await response.json();
      setInput((prev) => prev + (prev ? " " : "") + data.text);
    } catch (error) {
      console.error("Transcription failed:", error);
      toast({
        title: "Voice Input Error",
        description: "Failed to transcribe audio. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleSpeechError = useCallback((error: string) => {
    toast({
      title: "Voice Input Error",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  const { data: modelsData } = useQuery<{ models: ModelConfig[]; available: ModelConfig[] }>({
    queryKey: ["/api/ai/models"],
  });

  const availableModels = modelsData?.models || defaultModels;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const totalActions = messages.reduce((count, msg) => {
      if (msg.structuredResponse?.actions) {
        return count + msg.structuredResponse.actions.length;
      }
      return count;
    }, 0);
    setCurrentActionCount(totalActions);
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

      if (panelMode === "builder") {
        const userMessages = messages
          .filter((m) => m.role === "user")
          .map((m) => ({ role: m.role, content: m.content }));
        
        response = await apiRequest("POST", "/api/ai/chat/structured", {
          messages: [
            ...userMessages,
            { role: "user", content: input },
          ],
          context: `${fileContext ? `${fileContext}\n\n` : ""}${projectContext ? `Project context:\n${projectContext}` : ""}`,
          model: selectedModel,
          mode: "builder",
        });
        const structuredData = await response.json();
        
        const structuredResponse: StructuredAIResponse = {
          id: Date.now().toString(),
          sections: structuredData.sections?.map((s: any, i: number) => ({
            id: `section-${i}`,
            title: s.title || "",
            content: s.content || "",
            type: s.type || "text",
            order: i,
          })) || [],
          actions: (structuredData.actions || structuredData.fileActions || []).map((a: any) => ({
            type: a.type,
            file: a.filePath || a.file,
            description: a.description,
            timestamp: new Date(),
          })),
          metadata: {
            model: structuredData.model || selectedModel,
            timestamp: new Date(),
            processingTime: structuredData.metadata?.processingTime,
            totalTokens: structuredData.metadata?.totalTokens,
          },
          rawContent: structuredData.rawContent || "",
        };

        addAssistantMessage(
          structuredData.rawContent || structuredData.sections?.map((s: any) => s.content).join("\n\n") || "",
          structuredData.model,
          structuredResponse
        );
      } else {
        switch (mode) {
          case "chat":
            if (useStreaming) {
              resetStream();
              startStream({
                messages: [
                  ...messages.map((m) => ({ role: m.role, content: m.content })),
                  { role: "user", content: input },
                ],
                context: `${fileContext ? `${fileContext}\n\n` : ""}${projectContext ? `Project context:\n${projectContext}` : ""}`,
                model: selectedModel,
                mode: "chat",
              });
              setIsLoading(false);
              return;
            }
            response = await apiRequest("POST", "/api/ai/chat/structured", {
              messages: [
                ...messages.map((m) => ({ role: m.role, content: m.content })),
                { role: "user", content: input },
              ],
              context: `${fileContext ? `${fileContext}\n\n` : ""}${projectContext ? `Project context:\n${projectContext}` : ""}`,
              model: selectedModel,
              mode: "chat",
            });
            const chatStructured = await response.json();
            const chatResponse: StructuredAIResponse = {
              id: Date.now().toString(),
              sections: chatStructured.sections?.map((s: any, i: number) => ({
                id: `section-${i}`,
                title: s.title || "",
                content: s.content || "",
                type: s.type || "text",
                order: i,
              })) || [],
              actions: chatStructured.actions?.map((a: any) => ({
                type: a.type,
                file: a.file,
                description: a.description,
                timestamp: new Date(),
              })) || [],
              metadata: {
                model: chatStructured.model || selectedModel,
                timestamp: new Date(),
                processingTime: chatStructured.metadata?.processingTime,
              },
              rawContent: chatStructured.rawContent || "",
            };
            addAssistantMessage(
              chatStructured.rawContent || chatStructured.sections?.map((s: any) => s.content).join("\n\n") || "",
              chatStructured.model,
              chatResponse
            );
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
      }
    } catch (error: any) {
      addAssistantMessage(`Error: ${error.message || "Something went wrong. Please try again."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addAssistantMessage = (content: string, model?: string, structuredResponse?: StructuredAIResponse) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content,
        timestamp: new Date(),
        model,
        structuredResponse,
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

  const handleClearHistory = () => {
    setMessages([]);
    setCurrentActionCount(0);
  };

  const getModelInfo = (modelId: ModelId): ModelConfig | undefined => {
    return availableModels.find(m => m.id === modelId);
  };

  const currentModel = getModelInfo(selectedModel);
  const ModeIcon = modeConfig[mode].icon;

  return (
    <div className="h-full flex flex-col bg-background">
      <AIHeader
        title="AI Assistant"
        mode={panelMode}
        selectedModel={selectedModel}
        models={availableModels}
        onModelChange={(id) => setSelectedModel(id as ModelId)}
        actionCount={currentActionCount}
        isStreaming={isLoading}
        onClearHistory={handleClearHistory}
      />

      <div className="px-3 py-2 border-b bg-muted/20">
        <Tabs value={panelMode} onValueChange={(v) => setPanelMode(v as PanelMode)}>
          <TabsList className="h-8 w-full grid grid-cols-3">
            <TabsTrigger value="chat" className="gap-1.5 text-xs" data-testid="tab-chat-mode">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="builder" className="gap-1.5 text-xs" data-testid="tab-builder-mode">
              <Wand2 className="h-3.5 w-3.5" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="agent" className="gap-1.5 text-xs" data-testid="tab-agent-mode">
              <Cpu className="h-3.5 w-3.5" />
              Agent
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {panelMode === "chat" && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px]">
                  <ModeIcon className={cn("h-3 w-3", modeConfig[mode].color)} />
                  <span>{modeConfig[mode].label}</span>
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
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
              </DropdownMenuContent>
            </DropdownMenu>
            {onOpenBuilder && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 gap-1 text-[10px]"
                onClick={onOpenBuilder}
              >
                <Zap className="h-3 w-3 text-amber-500" />
                Full Builder
              </Button>
            )}
            {onOpenOneShot && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 gap-1 text-[10px]"
                onClick={onOpenOneShot}
              >
                <Sparkles className="h-3 w-3 text-pink-500" />
                One-Shot
              </Button>
            )}
          </div>
        )}
      </div>

      {panelMode === "agent" ? (
        <AgentPanel projectContext={projectContext} />
      ) : (
        <>
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Start a conversation</p>
                <p className="text-xs mt-1 text-muted-foreground/70">
                  Mode: <span className={panelMode === "builder" ? "text-purple-500" : modeConfig[mode].color}>
                    {panelMode === "builder" ? "Builder" : modeConfig[mode].label}
                  </span>
                  {" | "}
                  Model: <span className={currentModel ? modelTypeColors[currentModel.type] : ""}>{currentModel?.name || "GPT-4o"}</span>
                </p>
                {panelMode === "builder" && (
                  <p className="text-xs mt-2 text-muted-foreground/50 max-w-[200px] mx-auto">
                    Builder mode uses structured AI responses with file actions and organized sections
                  </p>
                )}
              </div>
            )}
          {messages.map((message) => (
            <div key={message.id}>
              {message.role === "user" ? (
                <div className="p-3 rounded-lg text-sm bg-primary/10 ml-6">
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
                  </div>
                </div>
              ) : message.structuredResponse ? (
                <AIMessage
                  response={message.structuredResponse}
                  isStreaming={false}
                  showTypewriter={false}
                  className="mr-6"
                />
              ) : (
                <div className="p-4 rounded-lg text-sm bg-card border mr-6 space-y-2">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.content.split('\n\n').map((paragraph, idx) => {
                      // Format headers
                      if (paragraph.startsWith('## ')) {
                        return <h3 key={idx} className="font-semibold text-base mt-2">{paragraph.replace('## ', '')}</h3>;
                      }
                      if (paragraph.startsWith('# ')) {
                        return <h2 key={idx} className="font-bold text-lg mt-3">{paragraph.replace('# ', '')}</h2>;
                      }
                      // Format bold text
                      if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                        return <p key={idx} className="font-semibold">{paragraph.replace(/\*\*/g, '')}</p>;
                      }
                      // Format lists
                      if (paragraph.includes('\n') && (paragraph.includes('- ') || paragraph.includes('* ') || /^\d+\./.test(paragraph))) {
                        return (
                          <ul key={idx} className="space-y-1 ml-4">
                            {paragraph.split('\n').filter(l => l.trim()).map((line, li) => (
                              <li key={li} className="flex gap-2">
                                {/^\d+\./.test(line.trim()) ? (
                                  <>
                                    <span className="font-medium text-muted-foreground">{line.match(/^\d+/)?.[0]}.</span>
                                    <span>{line.replace(/^\d+\.\s/, '')}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span>{line.trim().replace(/^[-*]\s/, '')}</span>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        );
                      }
                      // Code blocks
                      if (paragraph.includes('```')) {
                        const codeMatch = paragraph.match(/```(\w+)?\n([\s\S]*?)\n```/);
                        if (codeMatch) {
                          return (
                            <pre key={idx} className="bg-muted p-3 rounded-md overflow-x-auto text-xs leading-relaxed">
                              {codeMatch[2]}
                            </pre>
                          );
                        }
                      }
                      return <p key={idx} className="leading-relaxed text-muted-foreground">{paragraph}</p>;
                    })}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                    <span className="text-[10px] text-muted-foreground/60">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {message.model && (
                      <Badge variant="outline" className="text-[9px] h-4">
                        {message.model}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {(isThinking || isStreaming) && (
            <div className="space-y-3 mr-6" data-testid="streaming-container">
              {isThinking && thinkingSteps.length > 0 && (
                <AIProgressBubble 
                  steps={thinkingSteps.map((s, i) => ({ 
                    id: i, 
                    message: s.message, 
                    status: s.status 
                  }))}
                  isVisible={isThinking}
                />
              )}
              {isStreaming && streamedContent && (
                <div className="p-4 rounded-lg text-sm bg-card border animate-in fade-in-50 duration-200">
                  <div className="whitespace-pre-wrap break-words leading-relaxed">{streamedContent}</div>
                  <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
                </div>
              )}
            </div>
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">
                {panelMode === "builder" ? "Building with" : "Thinking with"} {currentModel?.name || "GPT-4o"}...
              </span>
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
          placeholder={panelMode === "builder" 
            ? "Describe what you want to build..." 
            : `Ask AI (${modeConfig[mode].label})...`}
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
            <SpeechInput
              onTranscript={handleSpeechTranscript}
              onListeningChange={setIsVoiceListening}
              onAudioRecorded={handleAudioRecorded}
              onError={handleSpeechError}
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={isLoading}
            />
          </div>
          {(isThinking || isStreaming) ? (
            <Button
              onClick={stopStream}
              variant="destructive"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              data-testid="button-stop-streaming"
            >
              <StopCircle className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
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
              {panelMode === "builder" ? "Build" : "Send"}
            </Button>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
