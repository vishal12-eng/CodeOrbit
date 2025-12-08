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
  MoreHorizontal,
} from "lucide-react";
import type { AIResponseSection, StructuredAIResponse } from "@shared/aiSchema";
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
      const next = new Set(Array.from(prev));
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
        "animate-in fade-in-50 duration-300",
        className
      )}
      data-testid="ai-message"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">bolt</span>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground ml-auto cursor-pointer hover:text-foreground transition-colors" />
          </div>

          <div className="space-y-0">
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

          {response.actions.length > 0 && (
            <ActionList 
              actions={response.actions} 
              isLoading={isStreaming}
            />
          )}

          <div className="text-[11px] text-muted-foreground/50 mt-2">
            {response.metadata.timestamp.toLocaleTimeString([], { 
              hour: "2-digit", 
              minute: "2-digit",
              hour12: true,
            }).toLowerCase()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIMessage;
