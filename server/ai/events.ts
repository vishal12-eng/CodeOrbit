import { Response } from "express";
import type { FileAction, AIResponseSection } from "../../shared/aiSchema";

export type AIEventType =
  | "connected"
  | "thinking:start"
  | "thinking:step"
  | "thinking:update"
  | "action:fileRead"
  | "action:fileWrite"
  | "action:fileCreate"
  | "action:fileDelete"
  | "action:planGenerated"
  | "action:implementation"
  | "action:build"
  | "action:complete"
  | "stream:token"
  | "stream:section"
  | "stream:done"
  | "error";

export interface AIStreamEvent {
  type: AIEventType;
  data: unknown;
  timestamp: number;
}

export interface ThinkingEvent {
  step: number;
  totalSteps?: number;
  message: string;
  status: "pending" | "active" | "complete";
}

export interface TokenEvent {
  token: string;
  sectionId?: string;
  sectionType?: AIResponseSection["type"];
}

export interface SectionEvent {
  section: Partial<AIResponseSection>;
  isComplete: boolean;
}

export interface ActionEvent {
  action: FileAction;
  index: number;
  total: number;
}

export interface PlanEvent {
  summary: string;
  steps: Array<{
    id: string;
    description: string;
    status: "pending" | "active" | "complete";
  }>;
}

export interface StreamCompleteEvent {
  model: string;
  totalTokens?: number;
  processingTime: number;
  sectionsCount: number;
  actionsCount: number;
}

export class SSEWriter {
  private res: Response;
  private isClosed = false;
  private startTime: number;
  private tokenCount = 0;
  private sectionCount = 0;
  private actionCount = 0;

  constructor(res: Response) {
    this.res = res;
    this.startTime = Date.now();
    this.setupSSE();
  }

  private setupSSE() {
    this.res.setHeader("Content-Type", "text/event-stream");
    this.res.setHeader("Cache-Control", "no-cache");
    this.res.setHeader("Connection", "keep-alive");
    this.res.setHeader("X-Accel-Buffering", "no");
    this.res.flushHeaders();

    this.res.on("close", () => {
      this.isClosed = true;
    });
  }

  private send(event: AIEventType, data: unknown) {
    if (this.isClosed) return;
    
    const eventData: AIStreamEvent = {
      type: event,
      data,
      timestamp: Date.now(),
    };
    
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(eventData.data)}\n\n`);
  }

  connected() {
    this.send("connected", { timestamp: Date.now() });
  }

  thinkingStart(message: string = "Analyzing your request...") {
    this.send("thinking:start", { message, timestamp: Date.now() });
  }

  thinkingStep(event: ThinkingEvent) {
    this.send("thinking:step", event);
  }

  thinkingUpdate(message: string) {
    this.send("thinking:update", { message, timestamp: Date.now() });
  }

  streamToken(token: string, sectionId?: string, sectionType?: AIResponseSection["type"]) {
    this.tokenCount++;
    const event: TokenEvent = { token, sectionId, sectionType };
    this.send("stream:token", event);
  }

  streamSection(section: Partial<AIResponseSection>, isComplete: boolean = false) {
    if (isComplete) this.sectionCount++;
    const event: SectionEvent = { section, isComplete };
    this.send("stream:section", event);
  }

  fileAction(action: FileAction, index: number, total: number) {
    this.actionCount++;
    const eventType = `action:file${action.type.charAt(0).toUpperCase() + action.type.slice(1)}` as AIEventType;
    const event: ActionEvent = { action, index, total };
    this.send(eventType, event);
  }

  planGenerated(plan: PlanEvent) {
    this.send("action:planGenerated", plan);
  }

  implementation(description: string, file?: string) {
    this.send("action:implementation", { description, file, timestamp: Date.now() });
  }

  buildAction(status: "start" | "progress" | "complete", message: string) {
    this.send("action:build", { status, message, timestamp: Date.now() });
  }

  actionComplete(description: string) {
    this.send("action:complete", { description, timestamp: Date.now() });
  }

  complete(model: string, totalTokens?: number) {
    const processingTime = Date.now() - this.startTime;
    const event: StreamCompleteEvent = {
      model,
      totalTokens,
      processingTime,
      sectionsCount: this.sectionCount,
      actionsCount: this.actionCount,
    };
    this.send("stream:done", event);
  }

  error(message: string, code?: string) {
    this.send("error", { message, code, timestamp: Date.now() });
  }

  end() {
    if (!this.isClosed) {
      this.res.end();
      this.isClosed = true;
    }
  }

  get closed() {
    return this.isClosed;
  }
}

export function createSSEWriter(res: Response): SSEWriter {
  return new SSEWriter(res);
}

export function simulateThinkingSteps(writer: SSEWriter, steps: string[]) {
  return new Promise<void>((resolve) => {
    let currentStep = 0;
    
    const sendStep = () => {
      if (currentStep < steps.length && !writer.closed) {
        writer.thinkingStep({
          step: currentStep + 1,
          totalSteps: steps.length,
          message: steps[currentStep],
          status: "active",
        });
        currentStep++;
        setTimeout(sendStep, 300);
      } else {
        resolve();
      }
    };
    
    sendStep();
  });
}
