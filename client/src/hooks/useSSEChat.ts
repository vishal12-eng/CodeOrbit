import { useState, useCallback, useRef } from "react";
import type {
  AIStreamEventType,
  StreamThinkingEvent,
  StreamTokenEvent,
  StreamSectionEvent,
  StreamCompleteEvent,
  StreamErrorEvent,
  FileAction,
  AIResponseSection,
} from "@shared/aiSchema";

interface SSEEvent {
  event: AIStreamEventType;
  data: any;
}

interface StreamingState {
  isConnected: boolean;
  isThinking: boolean;
  isStreaming: boolean;
  isComplete: boolean;
  thinkingSteps: StreamThinkingEvent[];
  currentThinkingStep: number;
  streamedContent: string;
  tokens: string[];
  sections: Partial<AIResponseSection>[];
  actions: FileAction[];
  model: string;
  error: string | null;
  processingTime?: number;
  totalTokens?: number;
}

interface UseSSEChatOptions {
  onToken?: (token: string) => void;
  onSection?: (section: Partial<AIResponseSection>) => void;
  onAction?: (action: FileAction) => void;
  onThinking?: (step: StreamThinkingEvent) => void;
  onComplete?: (data: StreamCompleteEvent) => void;
  onError?: (error: string) => void;
}

const initialState: StreamingState = {
  isConnected: false,
  isThinking: false,
  isStreaming: false,
  isComplete: false,
  thinkingSteps: [],
  currentThinkingStep: 0,
  streamedContent: "",
  tokens: [],
  sections: [],
  actions: [],
  model: "",
  error: null,
};

export function useSSEChat(options: UseSSEChatOptions = {}) {
  const [state, setState] = useState<StreamingState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(
    async (params: {
      messages: Array<{ role: string; content: string }>;
      context?: string;
      model?: string;
      mode?: string;
    }) => {
      setState(initialState);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEventName: AIStreamEventType | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "") continue;

            if (trimmed.startsWith("event:")) {
              currentEventName = trimmed.slice(6).trim() as AIStreamEventType;
              continue;
            }

            if (trimmed.startsWith("data:") && currentEventName) {
              let eventData: any = {};
              try {
                const jsonStr = trimmed.slice(5).trim();
                if (jsonStr) {
                  eventData = JSON.parse(jsonStr);
                }
              } catch (e) {
                eventData = {};
              }

              const event: SSEEvent = { event: currentEventName, data: eventData };
              currentEventName = null;

              switch (event.event) {
              case "connected":
                setState((prev) => ({ ...prev, isConnected: true }));
                break;

              case "thinking:start":
                setState((prev) => ({
                  ...prev,
                  isThinking: true,
                  thinkingSteps: [
                    {
                      step: 0,
                      message: event.data.message,
                      status: "active",
                    },
                  ],
                }));
                options.onThinking?.({
                  step: 0,
                  message: event.data.message,
                  status: "active",
                });
                break;

              case "thinking:step":
                const stepData = event.data as StreamThinkingEvent;
                setState((prev) => {
                  const updatedSteps = [...prev.thinkingSteps];
                  for (let i = 0; i < stepData.step; i++) {
                    if (updatedSteps[i]) {
                      updatedSteps[i] = { ...updatedSteps[i], status: "complete" };
                    }
                  }
                  updatedSteps[stepData.step] = stepData;
                  return {
                    ...prev,
                    thinkingSteps: updatedSteps,
                    currentThinkingStep: stepData.step,
                  };
                });
                options.onThinking?.(stepData);
                break;

              case "thinking:update":
                setState((prev) => {
                  const updatedSteps = [...prev.thinkingSteps];
                  const lastStep = updatedSteps[updatedSteps.length - 1];
                  if (lastStep) {
                    lastStep.status = "complete";
                  }
                  return {
                    ...prev,
                    thinkingSteps: updatedSteps,
                    isThinking: false,
                    isStreaming: true,
                  };
                });
                break;

              case "stream:token":
                const tokenData = event.data as StreamTokenEvent;
                setState((prev) => ({
                  ...prev,
                  streamedContent: prev.streamedContent + tokenData.token,
                  tokens: [...prev.tokens, tokenData.token],
                  isStreaming: true,
                }));
                options.onToken?.(tokenData.token);
                break;

              case "stream:section":
                const sectionData = event.data as StreamSectionEvent;
                setState((prev) => ({
                  ...prev,
                  sections: [...prev.sections, sectionData.section],
                }));
                options.onSection?.(sectionData.section);
                break;

              case "action:fileRead":
              case "action:fileWrite":
              case "action:fileCreate":
              case "action:fileDelete":
              case "action:build":
                const action = event.data as FileAction;
                setState((prev) => ({
                  ...prev,
                  actions: [...prev.actions, action],
                }));
                options.onAction?.(action);
                break;

              case "stream:done":
                const completeData = event.data as StreamCompleteEvent;
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  isComplete: true,
                  model: completeData.model,
                  processingTime: completeData.processingTime,
                  totalTokens: completeData.totalTokens,
                }));
                options.onComplete?.(completeData);
                break;

              case "error":
                const errorData = event.data as StreamErrorEvent;
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  isThinking: false,
                  error: errorData.message,
                }));
                options.onError?.(errorData.message);
                break;
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return;
        }
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isThinking: false,
          error: error.message || "Stream failed",
        }));
        options.onError?.(error.message || "Stream failed");
      }
    },
    [options]
  );

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      isThinking: false,
    }));
  }, []);

  const reset = useCallback(() => {
    stopStream();
    setState(initialState);
  }, [stopStream]);

  return {
    ...state,
    startStream,
    stopStream,
    reset,
  };
}

export default useSSEChat;
