import { useEffect, useRef, useCallback } from "react";
import { WsMessageSchema, type WsMessage } from "@phantom-editor/shared";
import { useLayoutStore } from "../store/layoutStore";

const WS_URL = "ws://localhost:3333";
const CLIENT_ID = crypto.randomUUID();

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDebug = useLayoutStore((s) => s.setDebug);
  const pushLog = useLayoutStore((s) => s.pushLog);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setDebug({ wsConnected: true });
      pushLog("WebSocket connected to sync server");
      ws.send(
        JSON.stringify({
          type: "client:hello",
          role: "desktop",
          clientId: CLIENT_ID,
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        const parsed = WsMessageSchema.safeParse(JSON.parse(ev.data));
        if (!parsed.success) return;
        const msg = parsed.data;

        if (msg.type === "layout:ack") {
          setDebug({ lastSyncAt: Date.now() });
          pushLog(`Layout synced (ack from server)`);
        }
        if (msg.type === "debug:pong") {
          pushLog(`Pong — server time: ${new Date(msg.serverTime).toTimeString().slice(0, 8)}, clients: ${msg.clientCount}`);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setDebug({ wsConnected: false });
      pushLog("WebSocket disconnected — reconnecting in 3s");
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      pushLog("WebSocket error");
      ws.close();
    };
  }, [setDebug, pushLog]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      useLayoutStore.getState().pushLog("Cannot send — not connected");
    }
  }, []);

  const ping = useCallback(() => {
    send({ type: "debug:ping" });
  }, [send]);

  return { send, ping, wsRef };
}
