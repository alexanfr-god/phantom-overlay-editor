import { WsMessageSchema } from "@phantom-editor/shared";
import { overlayState, notifyListeners } from "./layoutState";

const WS_URL = "ws://localhost:3333";
const CLIENT_ID = Math.random().toString(36).slice(2); // crypto not available in all contexts

let socket: WebSocket | null = null;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let isDestroyed = false;

export function connectWs(): void {
  if (isDestroyed) return;
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    return;
  }

  console.log(`[PhantomOverlay] Connecting WS → ${WS_URL}`);

  try {
    socket = new WebSocket(WS_URL);
  } catch (e) {
    console.error("[PhantomOverlay] WS constructor failed:", e);
    scheduleRetry();
    return;
  }

  socket.onopen = () => {
    console.log("[PhantomOverlay] ✓ WS connected");
    retryCount = 0;

    // Identify as extension client
    socket!.send(JSON.stringify({
      type: "client:hello",
      role: "extension",
      clientId: CLIENT_ID,
    }));

    // Report popup window position to agent
    reportPosition();

    // Notify UI that we're connected
    overlayState.wsConnected = true;
    notifyListeners();
  };

  socket.onmessage = (ev: MessageEvent) => {
    let data: unknown;
    try {
      data = JSON.parse(ev.data as string);
    } catch {
      return;
    }

    const result = WsMessageSchema.safeParse(data);
    if (!result.success) {
      console.warn("[PhantomOverlay] Unknown message:", data);
      return;
    }

    const msg = result.data;
    console.log(`[PhantomOverlay] ← ${msg.type}`);

    switch (msg.type) {
      case "layout:push":
        overlayState.layout = msg.payload;
        overlayState.lastUpdated = Date.now();
        overlayState.enabled = true; // auto-enable on push
        console.log(`[PhantomOverlay] Layout applied: ${msg.payload.elements.length} elements`);
        notifyListeners();
        break;

      case "overlay:toggle":
        overlayState.enabled = msg.enabled;
        notifyListeners();
        break;

      case "overlay:opacity":
        overlayState.opacity = msg.value;
        notifyListeners();
        break;

      case "layout:ack":
      case "debug:pong":
      case "client:hello":
        break;
    }
  };

  socket.onclose = (ev: CloseEvent) => {
    socket = null;
    overlayState.wsConnected = false;
    notifyListeners();
    console.log(`[PhantomOverlay] WS closed (code ${ev.code})`);
    scheduleRetry();
  };

  socket.onerror = () => {
    // onclose fires after onerror — no extra handling needed
    console.warn("[PhantomOverlay] WS error");
  };
}

function reportPosition(): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({
    type: "popup:position",
    x: window.screenX,
    y: window.screenY,
    width: window.outerWidth,
    height: window.outerHeight,
  }));
  console.log(`[PhantomOverlay] Reported position: ${window.screenX},${window.screenY} ${window.outerWidth}x${window.outerHeight}`);
}

export function destroyWs(): void {
  isDestroyed = true;
  if (retryTimer) clearTimeout(retryTimer);
  socket?.close();
  socket = null;
}

function scheduleRetry(): void {
  if (isDestroyed) return;
  // Exponential backoff capped at 10s
  const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10_000);
  retryCount++;
  console.log(`[PhantomOverlay] Retry in ${Math.round(delay)}ms (attempt ${retryCount})`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectWs();
  }, delay);
}
