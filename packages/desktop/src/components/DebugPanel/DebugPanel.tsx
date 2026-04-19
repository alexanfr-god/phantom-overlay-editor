import React, { useState, useCallback } from "react";
import { useLayoutStore } from "../../store/layoutStore";
import type { WsMessage } from "@phantom-editor/shared";

interface Offset { x: number; y: number; }

interface Props {
  onPing: () => void;
  onSend: (msg: WsMessage) => void;
}

export function DebugPanel({ onPing, onSend }: Props) {
  const debug = useLayoutStore((s) => s.debug);
  const setDebug = useLayoutStore((s) => s.setDebug);
  const clearLog = useLayoutStore((s) => s.clearLog);
  const [collapsed, setCollapsed] = useState(false);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  const sendOffset = useCallback((patch: Partial<Offset>) => {
    const next = { ...offset, ...patch };
    setOffset(next);
    // Reuse overlay:insets message — agent reads left as X, top as Y
    onSend({ type: "overlay:insets", top: next.y, left: next.x, right: 0, bottom: 0 } as unknown as WsMessage);
  }, [offset, onSend]);

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          height: 32,
          backgroundColor: "#1a1a1a",
          borderTop: "1px solid #2a2a2a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Debug Panel ▲
        </span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <StatusDot label="WS" active={debug.wsConnected} />
          <StatusDot label="Overlay" active={debug.overlayEnabled} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: 220,
      backgroundColor: "#141414",
      borderTop: "1px solid #2a2a2a",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        borderBottom: "1px solid #2a2a2a",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Debug
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Bounding boxes toggle */}
          <ToggleChip
            label="Bounds"
            active={debug.showBoundingBoxes}
            onChange={(v) => setDebug({ showBoundingBoxes: v })}
          />
          {/* Overlay toggle */}
          <ToggleChip
            label="Overlay"
            active={debug.overlayEnabled}
            onChange={(v) => {
              setDebug({ overlayEnabled: v });
              onSend({ type: "overlay:toggle", enabled: v });
            }}
          />
          {/* Ping */}
          <button
            onClick={onPing}
            style={{
              height: 20, padding: "0 8px",
              backgroundColor: "transparent",
              border: "1px solid #333",
              borderRadius: 4, color: "#888",
              fontSize: 10, cursor: "pointer",
            }}
          >
            Ping
          </button>
          {/* Clear log */}
          <button
            onClick={clearLog}
            style={{
              height: 20, padding: "0 8px",
              backgroundColor: "transparent",
              border: "1px solid #333",
              borderRadius: 4, color: "#888",
              fontSize: 10, cursor: "pointer",
            }}
          >
            Clear
          </button>
          {/* Collapse */}
          <button
            onClick={() => setCollapsed(true)}
            style={{
              height: 20, width: 20,
              backgroundColor: "transparent",
              border: "none", color: "#555",
              cursor: "pointer", fontSize: 12,
            }}
          >
            ▼
          </button>
        </div>
      </div>

      {/* Opacity slider */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderBottom: "1px solid #1e1e1e",
        flexShrink: 0,
      }}>
        <label style={{ fontSize: 10, color: "#555", width: 80, flexShrink: 0 }}>
          Overlay opacity
        </label>
        <input
          type="range"
          min={0} max={1} step={0.01}
          value={debug.overlayOpacity}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setDebug({ overlayOpacity: v });
            onSend({ type: "overlay:opacity", value: v });
          }}
          style={{ flex: 1, accentColor: "#ab9ff2" }}
        />
        <span style={{ fontSize: 10, color: "#888", width: 30, textAlign: "right" }}>
          {Math.round(debug.overlayOpacity * 100)}%
        </span>
      </div>

      {/* Overlay offset — fine-tune overlay position */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderBottom: "1px solid #1e1e1e",
        flexShrink: 0,
      }}>
        <label style={{ fontSize: 10, color: "#555", width: 80, flexShrink: 0 }}>
          Overlay offset
        </label>
        <span style={{ fontSize: 10, color: "#666" }}>X</span>
        <input
          type="number"
          value={offset.x}
          onChange={(e) => sendOffset({ x: parseInt(e.target.value) || 0 })}
          style={{ width: 44, height: 22, backgroundColor: "#2a2a2a", border: "1px solid #333", borderRadius: 4, color: "#aaa", fontSize: 10, textAlign: "center", outline: "none" }}
        />
        <span style={{ fontSize: 10, color: "#666" }}>Y</span>
        <input
          type="number"
          value={offset.y}
          onChange={(e) => sendOffset({ y: parseInt(e.target.value) || 0 })}
          style={{ width: 44, height: 22, backgroundColor: "#2a2a2a", border: "1px solid #333", borderRadius: 4, color: "#aaa", fontSize: 10, textAlign: "center", outline: "none" }}
        />
        <span style={{ fontSize: 9, color: "#444" }}>px</span>
      </div>

      {/* Log */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "4px 12px",
        fontFamily: "monospace",
        fontSize: 11,
      }}>
        {debug.log.length === 0 ? (
          <div style={{ color: "#333", marginTop: 8 }}>No events yet</div>
        ) : (
          debug.log.map((entry, i) => (
            <div key={i} style={{ color: "#666", lineHeight: "1.6", borderBottom: "1px solid #1a1a1a" }}>
              {entry}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusDot({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: active ? "#4ade80" : "#555" }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: active ? "#4ade80" : "#444" }} />
      {label}
    </div>
  );
}

function ToggleChip({ label, active, onChange }: { label: string; active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!active)}
      style={{
        height: 20, padding: "0 8px",
        backgroundColor: active ? "rgba(171,159,242,0.15)" : "transparent",
        border: `1px solid ${active ? "#ab9ff2" : "#333"}`,
        borderRadius: 4,
        color: active ? "#ab9ff2" : "#555",
        fontSize: 10, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
