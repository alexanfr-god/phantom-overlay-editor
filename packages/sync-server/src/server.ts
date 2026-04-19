import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { WsMessageSchema } from "@phantom-editor/shared";
import { log } from "./logger";

interface ClientInfo {
  ws: WebSocket;
  role: "desktop" | "extension" | "unknown";
  clientId: string;
  connectedAt: number;
}

export function createSyncServer(port = 3333) {
  const wss = new WebSocketServer({ port });
  const clients = new Map<WebSocket, ClientInfo>();

  wss.on("connection", (ws, req) => {
    const clientId = randomUUID();
    const info: ClientInfo = {
      ws,
      role: "unknown",
      clientId,
      connectedAt: Date.now(),
    };
    clients.set(ws, info);
    log.info(`client connected [${clientId.slice(0, 8)}] (total: ${clients.size})`);

    ws.on("message", (raw) => {
      let data: unknown;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        log.warn("received non-JSON message");
        return;
      }

      const parsed = WsMessageSchema.safeParse(data);
      if (!parsed.success) {
        log.warn("invalid WsMessage", parsed.error.flatten());
        return;
      }

      const msg = parsed.data;
      const client = clients.get(ws)!;

      // Handle special messages
      if (msg.type === "client:hello") {
        client.role = msg.role;
        log.ok(`${msg.role} registered [${msg.clientId.slice(0, 8)}]`);
        return;
      }

      if (msg.type === "debug:ping") {
        ws.send(
          JSON.stringify({
            type: "debug:pong",
            serverTime: Date.now(),
            clientCount: clients.size,
          })
        );
        return;
      }

      log.info(`[${client.role}] → broadcast: ${msg.type} (${clients.size - 1} receivers)`);

      // Broadcast to all OTHER clients
      for (const [otherWs] of clients.entries()) {
        if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
          otherWs.send(JSON.stringify(msg));
        }
      }

      // Ack back to sender for layout:push
      if (msg.type === "layout:push") {
        ws.send(
          JSON.stringify({
            type: "layout:ack",
            clientId: client.clientId,
            timestamp: Date.now(),
          })
        );
      }
    });

    ws.on("close", () => {
      const info = clients.get(ws);
      clients.delete(ws);
      log.info(
        `client disconnected [${info?.clientId.slice(0, 8)}] role=${info?.role} (total: ${clients.size})`
      );
    });

    ws.on("error", (err) => {
      log.error(`client error: ${err.message}`);
    });
  });

  wss.on("error", (err) => {
    log.error(`server error: ${err.message}`);
  });

  log.ok(`sync server listening on ws://localhost:${port}`);
  return wss;
}
