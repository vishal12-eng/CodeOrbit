import { EventEmitter } from "events";

export type AgentEventType =
  | "status"
  | "step_start"
  | "step_end"
  | "file_action"
  | "files_changed"
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
  content?: string;
  timestamp: number;
}

export interface AgentFilesChangedEvent {
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
}

export interface AgentEvent {
  runId: string;
  type: AgentEventType;
  timestamp: number;
  data: AgentStatusEvent | AgentStepEvent | AgentFileActionEvent | AgentFilesChangedEvent | AgentModelOutputEvent | AgentErrorEvent | AgentDoneEvent;
}

export interface AgentStatusEvent {
  status: "initializing" | "planning" | "executing" | "building" | "completed" | "failed";
  message: string;
}

export interface AgentStepEvent {
  step: AgentStep;
  stepIndex: number;
  totalSteps: number;
}

export interface AgentFileActionEvent {
  action: AgentFileAction;
  actionIndex: number;
  totalActions: number;
}

export interface AgentModelOutputEvent {
  content: string;
  isStreaming: boolean;
  sectionType?: string;
}

export interface AgentErrorEvent {
  message: string;
  code?: string;
  step?: string;
}

export interface AgentDoneEvent {
  success: boolean;
  summary: string;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  totalSteps: number;
  totalActions: number;
  executionTime: number;
}

class AgentEventBus extends EventEmitter {
  private runs: Map<string, AgentEvent[]> = new Map();

  publishAgentEvent(event: AgentEvent): void {
    const events = this.runs.get(event.runId) || [];
    events.push(event);
    this.runs.set(event.runId, events);
    this.emit(`run:${event.runId}`, event);
  }

  subscribeToRun(runId: string, callback: (event: AgentEvent) => void): () => void {
    const eventName = `run:${runId}`;
    this.on(eventName, callback);
    
    const existingEvents = this.runs.get(runId) || [];
    for (const event of existingEvents) {
      callback(event);
    }
    
    return () => {
      this.off(eventName, callback);
    };
  }

  getRunEvents(runId: string): AgentEvent[] {
    return this.runs.get(runId) || [];
  }

  clearRun(runId: string): void {
    this.runs.delete(runId);
    this.removeAllListeners(`run:${runId}`);
  }

  status(runId: string, status: AgentStatusEvent["status"], message: string): void {
    this.publishAgentEvent({
      runId,
      type: "status",
      timestamp: Date.now(),
      data: { status, message } as AgentStatusEvent,
    });
  }

  stepStart(runId: string, step: AgentStep, stepIndex: number, totalSteps: number): void {
    this.publishAgentEvent({
      runId,
      type: "step_start",
      timestamp: Date.now(),
      data: { step, stepIndex, totalSteps } as AgentStepEvent,
    });
  }

  stepEnd(runId: string, step: AgentStep, stepIndex: number, totalSteps: number): void {
    this.publishAgentEvent({
      runId,
      type: "step_end",
      timestamp: Date.now(),
      data: { step, stepIndex, totalSteps } as AgentStepEvent,
    });
  }

  fileAction(runId: string, action: AgentFileAction, actionIndex: number, totalActions: number): void {
    this.publishAgentEvent({
      runId,
      type: "file_action",
      timestamp: Date.now(),
      data: { action, actionIndex, totalActions } as AgentFileActionEvent,
    });
  }

  modelOutput(runId: string, content: string, isStreaming: boolean = false, sectionType?: string): void {
    this.publishAgentEvent({
      runId,
      type: "model_output",
      timestamp: Date.now(),
      data: { content, isStreaming, sectionType } as AgentModelOutputEvent,
    });
  }

  error(runId: string, message: string, code?: string, step?: string): void {
    this.publishAgentEvent({
      runId,
      type: "error",
      timestamp: Date.now(),
      data: { message, code, step } as AgentErrorEvent,
    });
  }

  done(runId: string, result: AgentDoneEvent): void {
    this.publishAgentEvent({
      runId,
      type: "done",
      timestamp: Date.now(),
      data: result,
    });
  }

  filesChanged(runId: string, created: string[], modified: string[], deleted: string[]): void {
    this.publishAgentEvent({
      runId,
      type: "files_changed",
      timestamp: Date.now(),
      data: {
        filesCreated: created,
        filesModified: modified,
        filesDeleted: deleted,
      } as AgentFilesChangedEvent,
    });
  }
}

export const agentEventBus = new AgentEventBus();
