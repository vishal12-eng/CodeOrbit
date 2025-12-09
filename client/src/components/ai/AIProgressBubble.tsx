import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2, Circle } from "lucide-react";
import type { StreamThinkingEvent } from "@shared/aiSchema";

interface ThinkingStep {
  id: number;
  message: string;
  status: "pending" | "active" | "complete";
}

interface AIProgressBubbleProps {
  steps?: ThinkingStep[];
  currentStep?: number;
  isVisible?: boolean;
  className?: string;
}

export function AIProgressBubble({
  steps = [],
  currentStep = 0,
  isVisible = true,
  className,
}: AIProgressBubbleProps) {
  const [animatedDots, setAnimatedDots] = useState("");

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setAnimatedDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible || steps.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/80 backdrop-blur-sm p-3 space-y-2 animate-in fade-in-50 slide-in-from-bottom-2 duration-300",
        className
      )}
      data-testid="ai-progress-bubble"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span>Thinking{animatedDots}</span>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, index) => {
          const isActive = step.status === "active";
          const isComplete = step.status === "complete";
          const isPending = step.status === "pending";

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2 text-xs transition-all duration-200",
                isComplete && "text-muted-foreground",
                isActive && "text-foreground font-medium",
                isPending && "text-muted-foreground/50"
              )}
            >
              <div className="flex-shrink-0">
                {isComplete ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground/30" />
                )}
              </div>
              <span className={cn(isActive && "animate-pulse")}>
                {step.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function useThinkingSteps(initialSteps?: string[]) {
  const [steps, setSteps] = useState<ThinkingStep[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const startThinking = (stepMessages: string[]) => {
    setIsThinking(true);
    setSteps(
      stepMessages.map((message, index) => ({
        id: index,
        message,
        status: index === 0 ? "active" : "pending",
      }))
    );
  };

  const advanceStep = (stepIndex: number) => {
    setSteps((prev) =>
      prev.map((step, i) => ({
        ...step,
        status:
          i < stepIndex
            ? "complete"
            : i === stepIndex
            ? "active"
            : "pending",
      }))
    );
  };

  const completeThinking = () => {
    setSteps((prev) =>
      prev.map((step) => ({
        ...step,
        status: "complete",
      }))
    );
    setTimeout(() => {
      setIsThinking(false);
      setSteps([]);
    }, 500);
  };

  const updateFromEvent = (event: StreamThinkingEvent) => {
    if (event.status === "active") {
      advanceStep(event.step);
    } else if (event.status === "complete" && event.step === steps.length - 1) {
      completeThinking();
    }
  };

  return {
    steps,
    isThinking,
    startThinking,
    advanceStep,
    completeThinking,
    updateFromEvent,
  };
}

export default AIProgressBubble;
