import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Search,
  ListTodo,
  FolderCheck,
  Code,
  ShieldCheck,
  Sparkles,
  Lightbulb,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Bot,
} from "lucide-react";
import type { AIResponseSection, StructuredAIResponse } from "@shared/aiSchema";
import { FileActionChip } from "./FileActionChip";
import { ActionList } from "./ActionList";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const sectionIcons: Record<AIResponseSection["type"], typeof Target> = {
  goal: Target,
  analysis: Search,
  plan: ListTodo,
  actions: FolderCheck,
  implementation: Code,
  qa: ShieldCheck,
  result: Sparkles,
  usage: Lightbulb,
  text: MessageSquare,
};

const sectionColors: Record<AIResponseSection["type"], string> = {
  goal: "text-blue-500",
  analysis: "text-purple-500",
  plan: "text-orange-500",
  actions: "text-green-500",
  implementation: "text-cyan-500",
  qa: "text-yellow-500",
  result: "text-emerald-500",
  usage: "text-amber-500",
  text: "text-muted-foreground",
};

interface AIMessageProps {
  response: StructuredAIResponse;
  isStreaming?: boolean;
  showTypewriter?: boolean;
  typewriterSpeed?: number;
  className?: string;
}

function TypewriterText({ 
  text, 
  speed = 10, 
  onComplete 
}: { 
  text: string; 
  speed?: number; 
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (currentIndex < text.length) {
      const charsToAdd = Math.min(3, text.length - currentIndex);
      
      timeoutRef.current = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + charsToAdd));
        setCurrentIndex(currentIndex + charsToAdd);
      }, speed);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  useEffect(() => {
    setDisplayedText("");
    setCurrentIndex(0);
  }, [text]);

  return (
    <span>
      {displayedText}
      {currentIndex < text.length && (
        <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
      )}
    </span>
  );
}

function SectionContent({ 
  content, 
  showTypewriter, 
  typewriterSpeed,
  onTypewriterComplete,
}: { 
  content: string; 
  showTypewriter?: boolean;
  typewriterSpeed?: number;
  onTypewriterComplete?: () => void;
}) {
  if (showTypewriter) {
    return (
      <TypewriterText 
        text={content} 
        speed={typewriterSpeed} 
        onComplete={onTypewriterComplete}
      />
    );
  }

  const lines = content.split("\n");
  
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-muted-foreground">•</span>
              <span>{trimmedLine.slice(2)}</span>
            </div>
          );
        }
        
        if (/^\d+\.\s/.test(trimmedLine)) {
          const match = trimmedLine.match(/^(\d+)\.\s(.+)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 pl-2">
                <span className="text-muted-foreground font-medium min-w-[1.5rem]">{match[1]}.</span>
                <span>{match[2]}</span>
              </div>
            );
          }
        }
        
        if (trimmedLine.startsWith("```")) {
          return null;
        }
        
        if (trimmedLine === "") {
          return <div key={i} className="h-2" />;
        }
        
        return (
          <p key={i} className="leading-relaxed">{line}</p>
        );
      })}
    </div>
  );
}

function AISection({ 
  section, 
  isExpanded,
  onToggle,
  showTypewriter,
  typewriterSpeed,
  onTypewriterComplete,
}: { 
  section: AIResponseSection;
  isExpanded: boolean;
  onToggle: () => void;
  showTypewriter?: boolean;
  typewriterSpeed?: number;
  onTypewriterComplete?: () => void;
}) {
  const Icon = sectionIcons[section.type];
  const colorClass = sectionColors[section.type];

  if (section.type === "text") {
    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        <SectionContent 
          content={section.content} 
          showTypewriter={showTypewriter}
          typewriterSpeed={typewriterSpeed}
          onTypewriterComplete={onTypewriterComplete}
        />
      </div>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 group">
        <Icon className={cn("h-4 w-4 shrink-0", colorClass)} />
        <span className="font-medium text-sm">{section.title}</span>
        <div className="flex-1" />
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 pb-3 text-sm text-muted-foreground">
          <SectionContent 
            content={section.content}
            showTypewriter={showTypewriter}
            typewriterSpeed={typewriterSpeed}
            onTypewriterComplete={onTypewriterComplete}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AIMessage({
  response,
  isStreaming = false,
  showTypewriter = false,
  typewriterSpeed = 10,
  className,
}: AIMessageProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(response.sections.map(s => s.id))
  );
  const [currentTypingSection, setCurrentTypingSection] = useState(0);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleSectionComplete = () => {
    setCurrentTypingSection(prev => prev + 1);
  };

  return (
    <div 
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm animate-in fade-in-50 duration-300",
        className
      )}
      data-testid="ai-message"
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {response.metadata.model}
        </span>
        {isStreaming && (
          <Badge variant="secondary" className="text-[10px] animate-pulse">
            Generating...
          </Badge>
        )}
        {response.actions.length > 0 && (
          <Badge variant="outline" className="text-[10px] ml-auto">
            {response.actions.length} action{response.actions.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {response.actions.length > 0 && (
        <ActionList 
          actions={response.actions} 
          className="mb-3"
        />
      )}

      <div className="space-y-1">
        {response.sections.map((section, index) => (
          <AISection
            key={section.id}
            section={section}
            isExpanded={expandedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
            showTypewriter={showTypewriter && index === currentTypingSection}
            typewriterSpeed={typewriterSpeed}
            onTypewriterComplete={
              index === currentTypingSection ? handleSectionComplete : undefined
            }
          />
        ))}
      </div>

      <div className="mt-3 pt-2 border-t flex items-center gap-2 text-[10px] text-muted-foreground/60">
        <span>
          {response.metadata.timestamp.toLocaleTimeString([], { 
            hour: "2-digit", 
            minute: "2-digit" 
          })}
        </span>
        {response.metadata.totalTokens && (
          <span>• {response.metadata.totalTokens} tokens</span>
        )}
        {response.metadata.processingTime && (
          <span>• {(response.metadata.processingTime / 1000).toFixed(1)}s</span>
        )}
      </div>
    </div>
  );
}

export default AIMessage;
