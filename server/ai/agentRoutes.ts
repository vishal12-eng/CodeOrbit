import { Router, Request, Response } from "express";
import { agentEventBus, AgentEvent } from "./agentEventBus";
import { createAgentRunner } from "./agentRunner";
import { ModelId } from "./models";

const router = Router();

interface AgentRunRequest {
  task: string;
  projectPath?: string;
  model?: ModelId;
  projectContext?: string;
}

const activeRuns = new Map<string, { startTime: number; status: string }>();

function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

router.post("/run", async (req: Request, res: Response) => {
  try {
    const { task, projectPath, model, projectContext } = req.body as AgentRunRequest;

    if (!task || typeof task !== "string" || task.trim().length === 0) {
      return res.status(400).json({ 
        error: "Task is required",
        message: "Please provide a task description for the agent to execute" 
      });
    }

    const runId = generateRunId();
    const resolvedPath = projectPath || process.cwd();
    const modelId: ModelId = model || "gemini-2.5-flash";

    activeRuns.set(runId, { startTime: Date.now(), status: "running" });

    const runner = createAgentRunner({
      runId,
      task: task.trim(),
      projectPath: resolvedPath,
      modelId,
      projectContext,
    });

    runner.run().finally(() => {
      const runInfo = activeRuns.get(runId);
      if (runInfo) {
        runInfo.status = "completed";
      }
      setTimeout(() => {
        activeRuns.delete(runId);
        agentEventBus.clearRun(runId);
      }, 300000);
    });

    res.json({
      runId,
      status: "started",
      message: "Agent run started. Connect to /api/agent/stream/:runId for updates.",
      streamUrl: `/api/agent/stream/${runId}`,
    });

  } catch (error: any) {
    console.error("Agent run error:", error);
    res.status(500).json({ 
      error: "Failed to start agent run",
      message: error.message 
    });
  }
});

router.get("/stream/:runId", (req: Request, res: Response) => {
  const { runId } = req.params;

  if (!runId) {
    return res.status(400).json({ error: "Run ID is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event: AgentEvent) => {
    try {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (e) {
    }
  };

  sendEvent({
    runId,
    type: "status",
    timestamp: Date.now(),
    data: { status: "initializing", message: "Connected to agent stream" },
  });

  const unsubscribe = agentEventBus.subscribeToRun(runId, sendEvent);

  req.on("close", () => {
    unsubscribe();
  });

  res.on("error", () => {
    unsubscribe();
  });
});

router.get("/runs", (req: Request, res: Response) => {
  const runs = Array.from(activeRuns.entries()).map(([runId, info]) => ({
    runId,
    ...info,
    elapsedTime: Date.now() - info.startTime,
  }));
  
  res.json({ runs });
});

router.get("/runs/:runId", (req: Request, res: Response) => {
  const { runId } = req.params;
  const runInfo = activeRuns.get(runId);
  
  if (!runInfo) {
    return res.status(404).json({ error: "Run not found" });
  }

  const events = agentEventBus.getRunEvents(runId);
  
  res.json({
    runId,
    ...runInfo,
    elapsedTime: Date.now() - runInfo.startTime,
    eventCount: events.length,
    events: events.slice(-50),
  });
});

router.delete("/runs/:runId", (req: Request, res: Response) => {
  const { runId } = req.params;
  
  activeRuns.delete(runId);
  agentEventBus.clearRun(runId);
  
  res.json({ message: "Run cleared", runId });
});

export default router;
