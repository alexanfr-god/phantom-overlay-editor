import React, { useEffect, useState, useRef, useCallback } from "react";
import type { LayoutElement, LayoutDocument } from "@phantom-editor/shared";

const DEFAULT_CANVAS_W = 400;
const DEFAULT_CANVAS_H = 600;

interface State {
  layout: LayoutDocument | null;
  enabled: boolean;
  opacity: number;
  canvasW: number;
  canvasH: number;
}

declare global {
  interface Window {
    agentApi: {
      onPhantomBounds: (cb: (b: { x: number; y: number; width: number; height: number } | null) => void) => void;
      onWsMessage: (cb: (msg: unknown) => void) => void;
      getStatus: () => Promise<{ wsConnected: boolean }>;
      setInteractive: (interactive: boolean) => Promise<void>;
      hideOverlay: () => Promise<void>;
    };
  }
}

export function AgentOverlay(): React.ReactElement | null {
  const [state, setState] = useState<State>({
    layout: null,
    enabled: true,
    opacity: 1,
    canvasW: DEFAULT_CANVAS_W,
    canvasH: DEFAULT_CANVAS_H,
  });
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [hidden, setHidden] = useState(false);
  const interactiveRef = useRef(false);

  useEffect(() => {
    window.agentApi?.onWsMessage((raw) => {
      const msg = raw as { type: string; [k: string]: unknown };
      setState((s) => {
        switch (msg.type) {
          case "layout:push": {
            const layout = msg.payload as LayoutDocument;
            // Reset state on new layout push
            return {
              ...s,
              layout,
              enabled: true,
              canvasW: layout.canvas?.width ?? s.canvasW,
              canvasH: layout.canvas?.height ?? s.canvasH,
            };
          }
          case "overlay:toggle":
            return { ...s, enabled: msg.enabled as boolean };
          case "overlay:opacity":
            return { ...s, opacity: msg.value as number };
          case "canvas:resize":
            return {
              ...s,
              canvasW: (msg as any).width ?? s.canvasW,
              canvasH: (msg as any).height ?? s.canvasH,
            };
          default:
            return s;
        }
      });
    });
  }, []);

  // Global mousemove listener — detect when cursor is over [data-interactive]
  // This works because setIgnoreMouseEvents(true, { forward: true })
  // still delivers mousemove events to the renderer.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isOver = !!el?.closest("[data-interactive]");
      if (isOver !== interactiveRef.current) {
        interactiveRef.current = isOver;
        window.agentApi?.setInteractive(isOver);
      }
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  const handleUnlock = useCallback(() => {
    if (unlocking) return;
    setUnlocking(true);
    setTimeout(() => {
      setHidden(true);
      interactiveRef.current = false;
      window.agentApi?.setInteractive(false);
      window.agentApi?.hideOverlay();
    }, 600);
  }, [unlocking]);

  const { layout, enabled, opacity, canvasW, canvasH } = state;
  if (!layout || layout.elements.length === 0 || !enabled || hidden) return null;

  const sorted = [...layout.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        opacity,
        overflow: "hidden",
      }}
    >
      {sorted.map((el) => (
        <OverlayEl
          key={el.id}
          el={el}
          cw={canvasW}
          ch={canvasH}
          password={password}
          setPassword={setPassword}
          unlocking={unlocking}
          onUnlock={handleUnlock}
        />
      ))}
    </div>
  );
}

interface OverlayElProps {
  el: LayoutElement;
  cw: number;
  ch: number;
  password: string;
  setPassword: (v: string) => void;
  unlocking: boolean;
  onUnlock: () => void;
}

function OverlayEl({ el, cw, ch, password, setPassword, unlocking, onUnlock }: OverlayElProps): React.ReactElement {
  const pctX = (el.x / cw) * 100;
  const pctY = (el.y / ch) * 100;
  const pctW = (el.width / cw) * 100;
  const pctH = (el.height / ch) * 100;

  const isPasswordInput = el.type === "input" && (
    el.label?.toLowerCase().includes("password") ||
    el.anchor?.includes("password")
  );
  const isUnlockButton = el.type === "button" && (
    el.label?.toLowerCase().includes("unlock") ||
    el.anchor?.includes("unlock") ||
    (el.content.text as string)?.toLowerCase()?.includes("unlock")
  );
  const isInteractive = isPasswordInput || isUnlockButton;

  const baseStyle: React.CSSProperties = {
    ...el.styles,
    position: "absolute",
    left: `${pctX}%`,
    top: `${pctY}%`,
    width: `${pctW}%`,
    height: `${pctH}%`,
    opacity: el.opacity,
    zIndex: el.zIndex,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: isInteractive ? "auto" : "none",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    overflow: "hidden",
  };

  // ── Unlock button ──
  if (isUnlockButton) {
    return (
      <div
        data-el={el.id}
        data-interactive="true"
        onClick={(e) => { e.stopPropagation(); onUnlock(); }}
        style={{
          ...baseStyle,
          cursor: "pointer",
          transition: "transform 0.15s ease, filter 0.15s ease",
          transform: unlocking ? "scale(0.93)" : "scale(1)",
          filter: unlocking ? "brightness(0.65)" : "brightness(1)",
        }}
      >
        <span style={{
          fontSize: el.styles.fontSize ?? "14px",
          fontWeight: el.styles.fontWeight ?? "600",
          color: el.styles.color ?? "#1a1a2e",
          textAlign: "center",
          width: "100%",
          lineHeight: 1.3,
          userSelect: "none",
        }}>
          {unlocking ? "Unlocking..." : String(el.content.text ?? "Unlock")}
        </span>
      </div>
    );
  }

  // ── Password input ──
  if (isPasswordInput) {
    return (
      <div data-el={el.id} data-interactive="true" style={{ ...baseStyle, cursor: "text" }}>
        <input
          type="password"
          value={password}
          placeholder={String(el.content.placeholder ?? "Password")}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onUnlock(); }}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            color: el.styles.color ?? "#e8e8e8",
            fontSize: el.styles.fontSize ?? "14px",
            fontWeight: el.styles.fontWeight ?? "500",
            padding: el.styles.padding ?? "0 16px",
            letterSpacing: "2px",
            fontFamily: "inherit",
            boxSizing: "border-box",
            caretColor: "#ab9ff2",
          }}
        />
      </div>
    );
  }

  // ── Regular element ──
  return (
    <div data-el={el.id} style={baseStyle}>
      <ElContent el={el} />
    </div>
  );
}

function ElContent({ el }: { el: LayoutElement }): React.ReactElement | null {
  const textStyle: React.CSSProperties = {
    fontSize: el.styles.fontSize ?? "14px",
    fontWeight: el.styles.fontWeight ?? "500",
    color: el.styles.color ?? "#fff",
    textAlign: (el.styles.textAlign as React.CSSProperties["textAlign"]) ?? "center",
    letterSpacing: el.styles.letterSpacing ?? "normal",
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
        <span style={{ ...textStyle, color: "#777", textAlign: "left", paddingLeft: parseInt(el.styles.padding ?? "16") || 16 }}>
          {String(el.content.placeholder ?? "")}
        </span>
      );
    case "image":
      return el.content.src ? (
        <img
          src={String(el.content.src)}
          alt={el.label ?? ""}
          style={{ width: "100%", height: "100%", objectFit: (el.styles.objectFit as React.CSSProperties["objectFit"]) ?? "cover", borderRadius: "inherit" }}
        />
      ) : null;
    default:
      return null;
  }
}
