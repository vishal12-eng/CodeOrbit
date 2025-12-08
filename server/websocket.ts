import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { log } from "./index";

export type WebSocketEventType = "terminal" | "runner" | "ai" | "console";

export interface WebSocketMessage {
  type: WebSocketEventType;
  projectId: string;
  data: unknown;
  timestamp?: number;
}

interface ExtendedWebSocket extends WebSocket {
  projectId?: string;
  isAlive?: boolean;
}

const projectConnections = new Map<string, Set<ExtendedWebSocket>>();

let wss: WebSocketServer | null = null;

export function initializeWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");

    if (projectId) {
      ws.projectId = projectId;
      addClientToProject(projectId, ws);
      log(`WebSocket client connected to project: ${projectId}`, "websocket");
    } else {
      log("WebSocket client connected without projectId", "websocket");
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (message) => {
      try {
        const parsed = JSON.parse(message.toString()) as WebSocketMessage;
        
        if (parsed.projectId && parsed.projectId !== ws.projectId) {
          if (ws.projectId) {
            removeClientFromProject(ws.projectId, ws);
          }
          ws.projectId = parsed.projectId;
          addClientToProject(parsed.projectId, ws);
          log(`WebSocket client switched to project: ${parsed.projectId}`, "websocket");
        }
      } catch (error) {
        log(`Failed to parse WebSocket message: ${error}`, "websocket");
      }
    });

    ws.on("close", () => {
      if (ws.projectId) {
        removeClientFromProject(ws.projectId, ws);
        log(`WebSocket client disconnected from project: ${ws.projectId}`, "websocket");
      }
    });

    ws.on("error", (error) => {
      log(`WebSocket error: ${error.message}`, "websocket");
      if (ws.projectId) {
        removeClientFromProject(ws.projectId, ws);
      }
    });
  });

  const heartbeatInterval = setInterval(() => {
    if (!wss) return;
    
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (extWs.isAlive === false) {
        if (extWs.projectId) {
          removeClientFromProject(extWs.projectId, extWs);
        }
        return extWs.terminate();
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  log("WebSocket server initialized", "websocket");
  return wss;
}

function addClientToProject(projectId: string, ws: ExtendedWebSocket): void {
  if (!projectConnections.has(projectId)) {
    projectConnections.set(projectId, new Set());
  }
  projectConnections.get(projectId)!.add(ws);
}

function removeClientFromProject(projectId: string, ws: ExtendedWebSocket): void {
  const clients = projectConnections.get(projectId);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) {
      projectConnections.delete(projectId);
    }
  }
}

export function broadcastToProject(
  projectId: string,
  type: WebSocketEventType,
  data: unknown
): void {
  const clients = projectConnections.get(projectId);
  if (!clients || clients.size === 0) {
    return;
  }

  const message: WebSocketMessage = {
    type,
    projectId,
    data,
    timestamp: Date.now(),
  };

  const messageStr = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

export function getProjectClientCount(projectId: string): number {
  return projectConnections.get(projectId)?.size || 0;
}

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}
