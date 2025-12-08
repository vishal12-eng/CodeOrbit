import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StructuredAIResponse, FileAction } from "@shared/aiSchema";
import { AIMessage } from "./AIMessage";
import { FileActionChipList } from "./FileActionChip";

interface AIStreamingRendererProps {
  content: string;
  model: string;
  isComplete: boolean;
  actions?: FileAction[];
  className?: string;
}

export function AIStreamingRenderer({
  content,
  model,
  isComplete,
  actions = [],
  className,
}: AIStreamingRendererProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentIndex < content.length) {
      const charsToAdd = Math.min(5, content.length - currentIndex);
      const timeout = setTimeout(() => {
        setDisplayedContent(content.slice(0, currentIndex + charsToAdd));
        setCurrentIndex(currentIndex + charsToAdd);
      }, 8);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, content]);

  useEffect(() => {
    setDisplayedContent("");
    setCurrentIndex(0);
  }, []);

  useEffect(() => {
    if (content.length > displayedContent.length) {
      if (currentIndex < content.length) {
      }
    }
  }, [content, displayedContent.length, currentIndex]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedContent]);

  const isTyping = currentIndex < content.length && !isComplete;

  return (
    <div 
      className={cn(
        "rounded-lg border bg-card shadow-sm animate-in fade-in-50 duration-200",
        className
      )}
      data-testid="ai-streaming-renderer"
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {model}
        </span>
        {!isComplete && (
          <Badge variant="secondary" className="text-[10px] gap-1 animate-pulse">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Generating...
          </Badge>
        )}
        {actions.length > 0 && (
          <Badge variant="outline" className="text-[10px] ml-auto">
            {actions.length} action{actions.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {actions.length > 0 && (
        <div className="px-4 py-2 border-b bg-muted/20">
          <FileActionChipList actions={actions} maxVisible={6} />
        </div>
      )}

      <ScrollArea className="max-h-[400px]">
        <div 
          ref={containerRef}
          className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
        >
          {displayedContent}
          {isTyping && (
            <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
          )}
        </div>
      </ScrollArea>

      {isComplete && (
        <div className="px-4 py-2 border-t text-[10px] text-muted-foreground/60">
          Completed at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

interface StreamingChatRendererProps {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    response?: StructuredAIResponse;
    isStreaming?: boolean;
    model?: string;
    timestamp: Date;
  }>;
  currentStreamContent?: string;
  currentStreamModel?: string;
  currentStreamActions?: FileAction[];
  isStreaming?: boolean;
  className?: string;
}

export function StreamingChatRenderer({
  messages,
  currentStreamContent,
  currentStreamModel,
  currentStreamActions = [],
  isStreaming = false,
  className,
}: StreamingChatRendererProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStreamContent]);

  return (
    <ScrollArea className={cn("flex-1", className)}>
      <div ref={scrollRef} className="p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === "user" ? (
              <div className="p-3 rounded-lg bg-primary/10 ml-8 text-sm">
                {message.content}
                <div className="text-[10px] text-muted-foreground/60 mt-1">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })}
                </div>
              </div>
            ) : message.response ? (
              <AIMessage 
                response={message.response} 
                isStreaming={message.isStreaming}
                className="mr-8"
              />
            ) : (
              <div className="p-3 rounded-lg bg-muted/50 mr-8 text-sm">
                {message.content}
                <div className="text-[10px] text-muted-foreground/60 mt-1">
                  {message.model && <span>{message.model} • </span>}
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {isStreaming && currentStreamContent && (
          <AIStreamingRenderer
            content={currentStreamContent}
            model={currentStreamModel || "AI"}
            isComplete={false}
            actions={currentStreamActions}
            className="mr-8"
          />
        )}
      </div>
    </ScrollArea>
  );
}

export default AIStreamingRenderer;
