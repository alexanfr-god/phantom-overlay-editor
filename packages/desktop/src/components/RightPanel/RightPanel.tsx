import React, { useState } from "react";
import { useLayoutStore } from "../../store/layoutStore";
import { ElementControls } from "./ElementControls";
import type { ElementType, PhantomScreen } from "@phantom-editor/shared";
import { PHANTOM_SCREENS, getScreenAnchors } from "@phantom-editor/shared";
import { useFigmaImport } from "../../hooks/useFigmaImport";

const ELEMENT_TYPES: { type: ElementType; icon: string; label: string }[] = [
  { type: "button", icon: "⬜", label: "Button" },
  { type: "input", icon: "✏️", label: "Input" },
  { type: "text", icon: "T", label: "Text" },
  { type: "container", icon: "▭", label: "Box" },
  { type: "image", icon: "🖼", label: "Image" },
];

export function RightPanel({ onApply, onSend }: { onApply: () => void; onSend: (msg: any) => void }) {
  const addElement = useLayoutStore((s) => s.addElement);
  const addFromAnchor = useLayoutStore((s) => s.addFromAnchor);
  const loadScreen = useLayoutStore((s) => s.loadScreen);
  const removeAllElements = useLayoutStore((s) => s.removeAllElements);
  const activeScreen = useLayoutStore((s) => s.activeScreen);
  const setScreen = useLayoutStore((s) => s.setScreen);
  const elements = useLayoutStore((s) => s.elements);
  const selectedId = useLayoutStore((s) => s.selectedId);
  const selectElement = useLayoutStore((s) => s.selectElement);
  const debug = useLayoutStore((s) => s.debug);
  const canvas = useLayoutStore((s) => s.canvas);
  const setCanvasSize = useLayoutStore((s) => s.setCanvasSize);
  const lockCanvas = useLayoutStore((s) => s.lockCanvas);

  // Change canvas + immediately sync to overlay
  const changeCanvas = (w: number, h: number) => {
    setCanvasSize(w, h);
    const finalW = Math.max(100, Math.round(w));
    const finalH = Math.max(100, Math.round(h));
    onSend({ type: "canvas:resize", width: finalW, height: finalH });
  };
  const { importFromUrl, loading: figmaLoading } = useFigmaImport();
  const [figmaUrl, setFigmaUrl] = useState("");
  const [showFigmaInput, setShowFigmaInput] = useState(false);

  const anchors = getScreenAnchors(activeScreen);
  const usedAnchors = new Set(elements.filter(e => e.screen === activeScreen).map(e => e.anchor));

  const handleFigmaImport = async () => {
    if (!figmaUrl.trim()) return;
    await importFromUrl(figmaUrl.trim());
    setFigmaUrl("");
    setShowFigmaInput(false);
  };

  return (
    <div style={{
      width: 260,
      height: "100%",
      backgroundColor: "#1e1e1e",
      borderLeft: "1px solid #2a2a2a",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Screen selector */}
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Phantom Screen
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {PHANTOM_SCREENS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScreen(s.id)}
              style={{
                flex: 1,
                height: 26,
                backgroundColor: activeScreen === s.id ? "#ab9ff2" : "#252525",
                border: activeScreen === s.id ? "none" : "1px solid #333",
                borderRadius: 6,
                color: activeScreen === s.id ? "#111" : "#888",
                fontSize: 10,
                fontWeight: activeScreen === s.id ? 700 : 500,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {s.id}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas size controls */}
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Canvas Size
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Width */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 10, color: "#666", width: 14 }}>W</span>
            <button
              onClick={() => changeCanvas(canvas.width - 10, canvas.height)}
              disabled={canvas.locked}
              style={canvasBtnStyle(canvas.locked)}
            >−</button>
            <input
              type="number"
              value={canvas.width}
              onChange={(e) => changeCanvas(parseInt(e.target.value) || 100, canvas.height)}
              disabled={canvas.locked}
              style={canvasInputStyle}
            />
            <button
              onClick={() => changeCanvas(canvas.width + 10, canvas.height)}
              disabled={canvas.locked}
              style={canvasBtnStyle(canvas.locked)}
            >+</button>
          </div>
          {/* Height */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 10, color: "#666", width: 14 }}>H</span>
            <button
              onClick={() => changeCanvas(canvas.width, canvas.height - 10)}
              disabled={canvas.locked}
              style={canvasBtnStyle(canvas.locked)}
            >−</button>
            <input
              type="number"
              value={canvas.height}
              onChange={(e) => setCanvasSize(canvas.width, parseInt(e.target.value) || 100)}
              disabled={canvas.locked}
              style={canvasInputStyle}
            />
            <button
              onClick={() => changeCanvas(canvas.width, canvas.height + 10)}
              disabled={canvas.locked}
              style={canvasBtnStyle(canvas.locked)}
            >+</button>
          </div>
          {/* Lock */}
          <button
            onClick={() => {
              lockCanvas(!canvas.locked);
              // Always send current size when toggling lock
              onSend({ type: "canvas:resize", width: canvas.width, height: canvas.height });
            }}
            title={canvas.locked ? "Unlock canvas size" : "Lock canvas size"}
            style={{
              width: 26, height: 26,
              backgroundColor: canvas.locked ? "rgba(171,159,242,0.15)" : "transparent",
              border: `1px solid ${canvas.locked ? "#ab9ff2" : "#333"}`,
              borderRadius: 6,
              color: canvas.locked ? "#ab9ff2" : "#666",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {canvas.locked ? "🔒" : "🔓"}
          </button>
        </div>
      </div>

      {/* Quick actions: load whole screen / clear all */}
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid #2a2a2a",
        display: "flex",
        gap: 6,
      }}>
        <button
          onClick={loadScreen}
          style={{
            flex: 1,
            height: 32,
            backgroundColor: "#ab9ff2",
            border: "none",
            borderRadius: 7,
            color: "#1a1a1a",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ▶ Build {activeScreen} Screen
        </button>
        {elements.length > 0 && (
          <button
            onClick={removeAllElements}
            style={{
              height: 32,
              padding: "0 12px",
              backgroundColor: "transparent",
              border: "1px solid #f87171",
              borderRadius: 7,
              color: "#f87171",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Anchor snap — one-click add element bound to Phantom UI element */}
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid #2a2a2a",
        maxHeight: 160,
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Snap to Anchor
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {anchors.filter(a => a.id !== "background").map((a) => {
            const used = usedAnchors.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => !used && addFromAnchor(a.id)}
                disabled={used}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  backgroundColor: used ? "#1a1a1a" : "#252525",
                  border: used ? "1px solid #222" : "1px solid #333",
                  borderRadius: 6,
                  color: used ? "#444" : "#ccc",
                  fontSize: 11,
                  cursor: used ? "default" : "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span style={{ fontSize: 9, color: used ? "#333" : "#ab9ff2", fontWeight: 700, minWidth: 14 }}>
                  {used ? "✓" : "+"}
                </span>
                <span style={{ flex: 1 }}>{a.label}</span>
                <span style={{ fontSize: 9, color: "#555" }}>{a.width}x{a.height}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add custom elements toolbar */}
      <div style={{
        padding: "10px 12px",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Add Custom
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ELEMENT_TYPES.map(({ type, icon, label }) => (
            <button
              key={type}
              onClick={() => addElement(type)}
              title={`Add ${label}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "6px 8px",
                backgroundColor: "#252525",
                border: "1px solid #333",
                borderRadius: 7,
                color: "#aaa",
                fontSize: 11,
                cursor: "pointer",
                minWidth: 44,
              }}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Figma import */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a2a" }}>
        {showFigmaInput ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="Paste Figma URL..."
              onKeyDown={(e) => e.key === "Enter" && handleFigmaImport()}
              style={{
                width: "100%",
                height: 28,
                backgroundColor: "#2a2a2a",
                border: "1px solid #ab9ff2",
                borderRadius: 6,
                color: "#e8e8e8",
                fontSize: 12,
                padding: "0 8px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={handleFigmaImport}
                disabled={figmaLoading}
                style={{
                  flex: 1, height: 26,
                  backgroundColor: "#ab9ff2", border: "none",
                  borderRadius: 5, color: "#1a1a1a",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                {figmaLoading ? "Importing..." : "Import"}
              </button>
              <button
                onClick={() => setShowFigmaInput(false)}
                style={{
                  height: 26, padding: "0 10px",
                  backgroundColor: "transparent", border: "1px solid #333",
                  borderRadius: 5, color: "#888", fontSize: 11, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowFigmaInput(true)}
            style={{
              width: "100%", height: 28,
              backgroundColor: "transparent",
              border: "1px dashed #444",
              borderRadius: 6,
              color: "#888", fontSize: 11, cursor: "pointer",
            }}
          >
            ✦ Import from Figma
          </button>
        )}
      </div>

      {/* Layer list */}
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid #2a2a2a",
        maxHeight: 180,
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Layers ({elements.length})
        </div>
        {[...elements].reverse().map((el) => (
          <div
            key={el.id}
            onClick={() => selectElement(el.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px",
              borderRadius: 5,
              cursor: "pointer",
              backgroundColor: el.id === selectedId ? "rgba(171,159,242,0.12)" : "transparent",
              color: el.id === selectedId ? "#ab9ff2" : "#aaa",
              fontSize: 12,
              marginBottom: 2,
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.5 }}>{el.type[0].toUpperCase()}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {el.label ?? el.id.slice(0, 8)}
            </span>
            {el.locked && <span style={{ fontSize: 10 }}>🔒</span>}
          </div>
        ))}
        {elements.length === 0 && (
          <div style={{ color: "#444", fontSize: 11, textAlign: "center", padding: "8px 0" }}>
            No elements yet
          </div>
        )}
      </div>

      {/* Element controls */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <ElementControls />
      </div>

      {/* Apply button */}
      <div style={{ padding: 12, borderTop: "1px solid #2a2a2a" }}>
        <button
          onClick={onApply}
          style={{
            width: "100%",
            height: 40,
            backgroundColor: debug.wsConnected ? "#ab9ff2" : "#2a2a2a",
            border: "none",
            borderRadius: 8,
            color: debug.wsConnected ? "#1a1a1a" : "#555",
            fontSize: 14,
            fontWeight: 700,
            cursor: debug.wsConnected ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          {debug.wsConnected ? "Apply →" : "No Connection"}
        </button>
        {debug.lastSyncAt && (
          <div style={{ fontSize: 10, color: "#555", textAlign: "center", marginTop: 4 }}>
            Last sync: {new Date(debug.lastSyncAt).toTimeString().slice(0, 8)}
          </div>
        )}
      </div>
    </div>
  );
}

const canvasBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 22, height: 22,
  backgroundColor: disabled ? "#1a1a1a" : "#252525",
  border: `1px solid ${disabled ? "#222" : "#444"}`,
  borderRadius: 4,
  color: disabled ? "#444" : "#aaa",
  fontSize: 14,
  cursor: disabled ? "not-allowed" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
});

const canvasInputStyle: React.CSSProperties = {
  width: 48, height: 22,
  backgroundColor: "#2a2a2a",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#ccc",
  fontSize: 11,
  textAlign: "center",
  outline: "none",
  padding: 0,
};
