import { useState, useCallback, useRef, useEffect } from "react";

export type AgentEventType =
  | "status"
  | "step_start"
  | "step_end"
  | "file_action"
  | "model_output"
  | "error"
  | "done";

export interface AgentStep {
  id: string;
  name: string;
  description: string;
  status: "pending" | "active" | "done" | "error";
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface AgentFileAction {
  type: "read" | "create" | "edit" | "delete" | "build" | "run" | "test";
  file: string;
  description?: string;
  timestamp: number;
}

interface AgentState {
  isConnected: boolean;
  isRunning: boolean;
  status: string;
  statusMessage: string;
  steps: AgentStep[];
  currentStepIndex: number;
  fileActions: AgentFileAction[];
  modelOutput: string;
  error: string | null;
  result: AgentResult | null;
}

export interface AgentResult {
  success: boolean;
  summary: string;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  totalSteps: number;
  totalActions: number;
  executionTime: number;
}

interface UseAgentSSEOptions {
  onStep?: (step: AgentStep) => void;
  onFileAction?: (action: AgentFileAction) => void;
  onModelOutput?: (content: string) => void;
  onComplete?: (result: AgentResult) => void;
  onError?: (error: string) => void;
}

const initialState: AgentState = {
  isConnected: false,
  isRunning: false,
  status: "idle",
  statusMessage: "",
  steps: [],
  currentStepIndex: -1,
  fileActions: [],
  modelOutput: "",
  error: null,
  result: null,
};

export function useAgentSSE(options: UseAgentSSEOptions = {}) {
  const [state, setState] = useState<AgentState>(initialState);
  const [runId, setRunId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const connectToStream = useCallback((streamRunId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/agent/stream/${streamRunId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true }));
    };

    eventSource.onerror = () => {
      setState(prev => ({ 
        ...prev, 
        isConnected: false,
        error: "Connection to agent stream lost"
      }));
    };

    const handleEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.type as AgentEventType;
        const eventData = data.data;

        switch (eventType) {
          case "status":
            setState(prev => ({
              ...prev,
              status: eventData.status,
              statusMessage: eventData.message,
              isRunning: !["completed", "failed"].includes(eventData.status),
            }));
            break;

          case "step_start":
            setState(prev => {
              const newSteps = [...prev.steps];
              const stepData = eventData.step;
              const existingIndex = newSteps.findIndex(s => s.id === stepData.id);
              
              if (existingIndex >= 0) {
                newSteps[existingIndex] = stepData;
              } else {
                newSteps.push(stepData);
              }

              return {
                ...prev,
                steps: newSteps,
                currentStepIndex: eventData.stepIndex,
              };
            });
            options.onStep?.(eventData.step);
            break;

          case "step_end":
            setState(prev => {
              const newSteps = [...prev.steps];
              const stepData = eventData.step;
              const existingIndex = newSteps.findIndex(s => s.id === stepData.id);
              
              if (existingIndex >= 0) {
                newSteps[existingIndex] = stepData;
              }

              return {
                ...prev,
                steps: newSteps,
              };
            });
            options.onStep?.(eventData.step);
            break;

          case "file_action":
            setState(prev => ({
              ...prev,
              fileActions: [...prev.fileActions, eventData.action],
            }));
            options.onFileAction?.(eventData.action);
            break;

          case "model_output":
            setState(prev => ({
              ...prev,
              modelOutput: prev.modelOutput + eventData.content,
            }));
            options.onModelOutput?.(eventData.content);
            break;

          case "error":
            setState(prev => ({
              ...prev,
              error: eventData.message,
            }));
            options.onError?.(eventData.message);
            break;

          case "done":
            setState(prev => ({
              ...prev,
              isRunning: false,
              result: eventData,
            }));
            options.onComplete?.(eventData);
            eventSource.close();
            break;
        }
      } catch (e) {
      }
    };

    eventSource.addEventListener("status", handleEvent);
    eventSource.addEventListener("step_start", handleEvent);
    eventSource.addEventListener("step_end", handleEvent);
    eventSource.addEventListener("file_action", handleEvent);
    eventSource.addEventListener("model_output", handleEvent);
    eventSource.addEventListener("error", handleEvent);
    eventSource.addEventListener("done", handleEvent);

  }, [options]);

  const startAgent = useCallback(async (task: string, projectContext?: string, model?: string) => {
    setState({ ...initialState, isRunning: true, status: "starting" });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, projectContext, model }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to start agent");
      }

      const data = await response.json();
      setRunId(data.runId);
      connectToStream(data.runId);

    } catch (error: any) {
      if (error.name === "AbortError") return;
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: error.message || "Failed to start agent",
      }));
      options.onError?.(error.message);
    }
  }, [connectToStream, options]);

  const stopAgent = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setState(prev => ({
      ...prev,
      isRunning: false,
      status: "stopped",
      statusMessage: "Agent stopped by user",
    }));
  }, []);

  const reset = useCallback(() => {
    stopAgent();
    setState(initialState);
    setRunId(null);
  }, [stopAgent]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    runId,
    startAgent,
    stopAgent,
    reset,
  };
}

export default useAgentSSE;
