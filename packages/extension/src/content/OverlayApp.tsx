import React, { useState, useEffect } from "react";
import type { LayoutElement } from "@phantom-editor/shared";
import { overlayState, subscribeOverlay } from "../ws/layoutState";

/**
 * Renders custom overlay elements on top of the real Phantom wallet UI.
 * Mounted inside a Shadow DOM so Phantom's CSS cannot affect our elements.
 * All elements use pointer-events: none so users can still interact with Phantom.
 */
export function OverlayApp(): React.ReactElement | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Re-render whenever overlay state changes (layout push, toggle, opacity)
    const unsub = subscribeOverlay(() => setTick((n) => n + 1));
    return unsub;
  }, []);

  const { layout, enabled, opacity } = overlayState;

  // Nothing to show
  if (!layout || layout.elements.length === 0 || !enabled) return null;

  const sorted = [...layout.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      id="phantom-overlay-app"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2147483647,
        opacity,
        transition: "opacity 0.25s ease",
      }}
    >
      {sorted.map((el) => (
        <OverlayNode key={el.id} element={el} />
      ))}

      {/* Dev badge — shows element count, hidden in prod via opacity */}
      <div style={{
        position: "fixed",
        bottom: 6,
        right: 6,
        backgroundColor: "rgba(171,159,242,0.9)",
        color: "#111",
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 20,
        fontFamily: "monospace",
        letterSpacing: "0.04em",
        zIndex: 2147483647,
        userSelect: "none",
      }}>
        ◈ {sorted.length}
      </div>
    </div>
  );
}

function OverlayNode({ element: el }: { element: LayoutElement }): React.ReactElement {
  // Build style from element props — position props always override element.styles
  const base: React.CSSProperties = {
    ...el.styles,
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    opacity: el.opacity,
    zIndex: el.zIndex,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  };

  return (
    <div
      data-overlay-element={el.id}
      data-overlay-type={el.type}
      style={base}
    >
      <NodeContent el={el} />
    </div>
  );
}

function NodeContent({ el }: { el: LayoutElement }): React.ReactElement | null {
  const textStyle: React.CSSProperties = {
    fontSize: el.styles.fontSize ?? "14px",
    fontWeight: el.styles.fontWeight ?? "500",
    color: el.styles.color ?? "#fff",
    textAlign: (el.styles.textAlign as React.CSSProperties["textAlign"]) ?? "center",
    width: "100%",
    lineHeight: 1.3,
  };

  switch (el.type) {
    case "button":
      return <span style={textStyle}>{String(el.content.text ?? "Button")}</span>;
    case "text":
      return <span style={textStyle}>{String(el.content.text ?? "")}</span>;
    case "input":
      return (
        <span style={{ ...textStyle, color: el.styles.color ?? "#888", textAlign: "left", paddingLeft: 12 }}>
          {String(el.content.placeholder ?? "")}
        </span>
      );
    case "image":
      return el.content.src
        ? <img src={String(el.content.src)} alt={el.label ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
        : null;
    case "container":
    default:
      return null;
  }
}
