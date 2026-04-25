import React, { useEffect, useRef, useCallback } from "react";
import { OverlayCanvas } from "./components/MockWallet/OverlayCanvas";
import { RightPanel } from "./components/RightPanel/RightPanel";
import { DebugPanel } from "./components/DebugPanel/DebugPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { useLayoutStore } from "./store/layoutStore";
import type { LayoutDocument } from "@phantom-editor/shared";

declare global {
  interface Window {
    api: {
      getAppVersion: () => Promise<string>;
      saveProject: (data: string) => Promise<string | null>;
      loadProject: () => Promise<{ path: string; content: string } | null>;
      autosave: (data: string) => Promise<void>;
      autoload: () => Promise<string | null>;
      publishToWCC: (data: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
    };
  }
}

export default function App() {
  const { send, ping } = useWebSocket();
  const elements = useLayoutStore((s) => s.elements);
  const canvas = useLayoutStore((s) => s.canvas);
  const activeScreen = useLayoutStore((s) => s.activeScreen);
  const setDebug = useLayoutStore((s) => s.setDebug);
  const pushLog = useLayoutStore((s) => s.pushLog);
  const getProjectData = useLayoutStore((s) => s.getProjectData);
  const loadProjectData = useLayoutStore((s) => s.loadProjectData);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Autoload on startup
  useEffect(() => {
    window.api?.autoload().then((data) => {
      if (data) {
        loadProjectData(data);
        pushLog("Project restored from autosave");
      }
    });
  }, []);

  // Autosave every 10 seconds
  useEffect(() => {
    autosaveTimer.current = setInterval(() => {
      const json = useLayoutStore.getState().getProjectData();
      window.api?.autosave(json);
    }, 10_000);
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current);
    };
  }, []);

  const handleSave = useCallback(async () => {
    const data = getProjectData();
    const path = await window.api?.saveProject(data);
    if (path) pushLog(`Project saved: ${path}`);
  }, [getProjectData, pushLog]);

  const handleLoad = useCallback(async () => {
    const result = await window.api?.loadProject();
    if (result) {
      loadProjectData(result.content);
      pushLog(`Project loaded: ${result.path}`);
    }
  }, [loadProjectData, pushLog]);

  const handlePublishToWCC = useCallback(async () => {
    if (elements.length === 0) {
      pushLog("Nothing to publish — add elements first");
      return;
    }
    const payload = JSON.stringify({
      canvas: { width: canvas.width, height: canvas.height },
      screen: activeScreen,
      elements,
      publishedAt: new Date().toISOString(),
    }, null, 2);

    const result = await window.api?.publishToWCC(payload);
    if (result?.ok) {
      pushLog(`✅ Published ${elements.length} element(s) to wacocu.app`);
    } else {
      pushLog(`❌ Publish failed: ${result?.error ?? "unknown error"}`);
    }
  }, [elements, canvas, activeScreen, pushLog]);

  const handleApply = () => {
    if (elements.length === 0) {
      pushLog("Nothing to sync — add some elements first");
      return;
    }
    const doc: LayoutDocument = {
      version: "1",
      timestamp: Date.now(),
      elements,
      canvas: { width: canvas.width, height: canvas.height },
      targetScreen: activeScreen,
    };
    send({ type: "layout:push", payload: doc });
    pushLog(`Pushed ${elements.length} element(s) (canvas ${canvas.width}×${canvas.height})`);
  };

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#1a1a1a",
      overflow: "hidden",
    }}>
      {/* Title bar area */}
      <div style={{
        height: 40,
        backgroundColor: "#161616",
        borderBottom: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        paddingLeft: 80, // macOS traffic lights space
        flexShrink: 0,
        WebkitAppRegion: "drag" as React.CSSProperties["WebkitAppRegion"],
      } as React.CSSProperties}>
        <span style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>
          Phantom Overlay Editor
        </span>
        <div style={{
          marginLeft: "auto",
          display: "flex",
          gap: 6,
          paddingRight: 12,
          WebkitAppRegion: "no-drag",
        } as React.CSSProperties}>
          <button onClick={handleLoad} style={titleBarBtn}>Open</button>
          <button onClick={handleSave} style={titleBarBtn}>Save</button>
          <button
            onClick={handlePublishToWCC}
            style={{
              ...titleBarBtn,
              backgroundColor: elements.length > 0 ? "#ab9ff2" : "transparent",
              color: elements.length > 0 ? "#1a1a2e" : "#555",
              border: elements.length > 0 ? "1px solid #ab9ff2" : "1px solid #333",
              fontWeight: 600,
            }}
          >
            ↑ Publish to WCC
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
      }}>
        {/* Center: wallet canvas */}
        <div style={{
          flex: 1,
          backgroundColor: "#1a1a1a",
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Grid background */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, #2a2a2a 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            opacity: 0.5,
            pointerEvents: "none",
          }} />
          <OverlayCanvas />
        </div>

        {/* Right panel */}
        <RightPanel onApply={handleApply} onSend={send} />
      </div>

      {/* Bottom: debug panel */}
      <DebugPanel onPing={ping} onSend={send} />
    </div>
  );
}

const titleBarBtn: React.CSSProperties = {
  height: 22,
  padding: "0 10px",
  backgroundColor: "transparent",
  border: "1px solid #333",
  borderRadius: 5,
  color: "#888",
  fontSize: 11,
  cursor: "pointer",
  fontWeight: 500,
};
