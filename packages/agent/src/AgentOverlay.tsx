import React, { useEffect, useRef, useState } from "react";
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
      injectText: (text: string) => Promise<{ ok: boolean; error?: string }>;
      injectKey: (name: "return" | "enter" | "tab" | "escape" | "backspace") => Promise<{ ok: boolean; error?: string }>;
      injectClick: (xPct: number, yPct: number) => Promise<{ ok: boolean; error?: string }>;
      getPhantomPid: () => Promise<number | null>;
      setCaptiveRegions: (regions: Array<{ x: number; y: number; w: number; h: number }>) => Promise<void>;
      captiveExtend: () => Promise<void>;
    };
  }
}

const WCC_KEYFRAMES = `
@keyframes wcc-gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes wcc-cosmic-pulse {
  0%,100% { filter: brightness(1) saturate(1.0); }
  50%      { filter: brightness(1.1) saturate(1.15); }
}
@keyframes wcc-aurora {
  0%,100% { filter: hue-rotate(0deg) brightness(1); }
  33%      { filter: hue-rotate(25deg) brightness(1.08); }
  66%      { filter: hue-rotate(-15deg) brightness(0.97); }
}
`;

export function AgentOverlay(): React.ReactElement | null {
  const [state, setState] = useState<State>({
    layout: null,
    enabled: true,
    opacity: 1,
    canvasW: DEFAULT_CANVAS_W,
    canvasH: DEFAULT_CANVAS_H,
  });

  useEffect(() => {
    window.agentApi?.onWsMessage((raw) => {
      const msg = raw as { type: string; [k: string]: unknown };
      setState((s) => {
        switch (msg.type) {
          case "layout:push": {
            const layout = msg.payload as LayoutDocument;
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

  // Whenever the layout changes, push captive-region percentages to main so
  // the agent enables click capture only on the input + unlock button areas.
  useEffect(() => {
    const els = state.layout?.elements ?? [];
    if (els.length === 0) {
      window.agentApi?.setCaptiveRegions([]);
      return;
    }
    const interactive = els.filter((el) => {
      const a = getAnchorId(el);
      return el.type === "input" || a === "unlock-button" || a === "password-input";
    });
    const regions = interactive.map((el) => ({
      x: el.x / state.canvasW,
      y: el.y / state.canvasH,
      w: el.width / state.canvasW,
      h: el.height / state.canvasH,
    }));
    window.agentApi?.setCaptiveRegions(regions);
  }, [state.layout, state.canvasW, state.canvasH]);

  const { layout, enabled, opacity, canvasW, canvasH } = state;
  if (!layout || layout.elements.length === 0 || !enabled) return null;

  const sorted = [...layout.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        opacity,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: WCC_KEYFRAMES }} />
      {sorted.map((el) => (
        <OverlayEl key={el.id} el={el} cw={canvasW} ch={canvasH} />
      ))}
    </div>
  );
}

interface OverlayElProps {
  el: LayoutElement;
  cw: number;
  ch: number;
}

function getAnchorId(el: LayoutElement): string {
  const raw = (el as any).anchor ?? (el as any).label ?? "";
  return String(raw).toLowerCase();
}

function OverlayEl({ el, cw, ch }: OverlayElProps): React.ReactElement {
  const pctX = (el.x / cw) * 100;
  const pctY = (el.y / ch) * 100;
  const pctW = (el.width / cw) * 100;
  const pctH = (el.height / ch) * 100;

  const anchorId = getAnchorId(el);
  const isInteractive = el.type === "input" || anchorId === "unlock-button" || anchorId === "password-input";

  const baseStyle: React.CSSProperties = {
    ...el.styles,

    // Strip background from text-only elements (so they don't paint colored
    // bars over Phantom's native UI labels showing through transparent gaps).
    ...(el.type === "text"
      ? {
          background: "transparent",
          backgroundColor: "transparent",
          border: "none",
          boxShadow: "none",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        }
      : {}),

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
    justifyContent: el.type === "input" ? "flex-start" : "center",
    overflow: "hidden",

    // Interactive elements (input + unlock) capture clicks; everything else
    // is decorative and lets clicks pass through to Phantom (assuming main
    // has switched the window to interactive mode for this region).
    pointerEvents: isInteractive ? "auto" : "none",
    cursor: isInteractive ? (el.type === "input" ? "text" : "pointer") : "default",
  };

  return (
    <div data-el={el.id} data-type={el.type} data-anchor={anchorId} style={baseStyle}>
      <ElContent el={el} anchorId={anchorId} />
    </div>
  );
}

// ── Inner content per element type ────────────────────────────────────────

function ElContent({ el, anchorId }: { el: LayoutElement; anchorId: string }): React.ReactElement | null {
  const textStyle: React.CSSProperties = {
    fontSize: el.styles.fontSize ?? "14px",
    fontWeight: el.styles.fontWeight ?? "500",
    color: el.styles.color ?? "#fff",
    textAlign: (el.styles.textAlign as React.CSSProperties["textAlign"]) ?? "center",
    letterSpacing: el.styles.letterSpacing ?? "normal",
    whiteSpace: (el.styles.whiteSpace as React.CSSProperties["whiteSpace"]) ?? "nowrap",
    textShadow: el.styles.textShadow ?? undefined,
    fontFamily: el.styles.fontFamily ?? "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    width: "100%",
    lineHeight: 1.3,
    pointerEvents: "none",
  };

  // Themed Phantom ghost logo (vector — no Phantom asset, our own copy).
  if (anchorId === "logo" || anchorId === "phantom-logo") {
    return <PhantomGhost styles={el.styles} />;
  }

  switch (el.type) {
    case "text":
      return <span style={textStyle}>{String(el.content.text ?? "")}</span>;

    case "button":
      return (
        <ButtonContent
          text={String(el.content.text ?? "")}
          textStyle={textStyle}
          anchorId={anchorId}
        />
      );

    case "input":
      // Themed real <input type="password"> — captures user typing locally
      // and forwards each new character to Phantom via main process IPC.
      return (
        <PasswordInputContent
          placeholder={String(el.content.placeholder ?? "Password")}
          textStyle={textStyle}
        />
      );

    case "image":
      return el.content.src ? (
        <img
          src={String(el.content.src)}
          alt={el.label ?? ""}
          style={{
            width: "100%",
            height: "100%",
            objectFit: (el.styles.objectFit as React.CSSProperties["objectFit"]) ?? "cover",
            borderRadius: "inherit",
            pointerEvents: "none",
          }}
        />
      ) : null;

    case "container":
    default:
      return null;
  }
}

// ── Themed Phantom-style ghost SVG ────────────────────────────────────────
// Our own vector copy. Color comes from the theme via the element's `color`
// (fill) and `textShadow` (drop-shadow) styles; nothing here references the
// real Phantom asset.
function PhantomGhost({ styles }: { styles: Record<string, string> }): React.ReactElement {
  const fill = styles.color ?? "#FFFFFF";
  const textShadow = styles.textShadow ?? "";

  // Convert any text-shadow value into an equivalent CSS filter so the SVG
  // gets the same glow that themed text would.
  const filter = textShadow
    ? textShadow
        .split(",")
        .map((s) => `drop-shadow(${s.trim()})`)
        .join(" ")
    : `drop-shadow(0 4px 12px rgba(0,0,0,0.3))`;

  return (
    <svg
      viewBox="0 0 128 128"
      width="100%"
      height="100%"
      style={{ filter, pointerEvents: "none", display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill={fill}
        d="M64 16C39.7 16 20 35.7 20 60v44c0 4.4 5.1 6.9 8.5 4.2l9.5-7.5 9.5 7.5c2.2 1.7 5.3 1.7 7.5 0l9.5-7.5 9.5 7.5c2.2 1.7 5.3 1.7 7.5 0l9.5-7.5 9.5 7.5c3.4 2.7 8.5.2 8.5-4.2V60c0-24.3-19.7-44-44-44z"
      />
      <ellipse cx="48" cy="58" rx="6" ry="8" fill="#0E0E10" />
      <ellipse cx="80" cy="58" rx="6" ry="8" fill="#0E0E10" />
    </svg>
  );
}

// ── Button (Unlock) — pressing it injects a real click on Phantom's button ─
// We deliberately simulate a mouse click (CGEvent at .cghidEventTap) on the
// underlying Phantom Unlock button rather than sending Enter to the input.
// This mirrors the wallet's native interaction one-to-one: any onClick logic
// Phantom attaches to the button (analytics, validation, animation) fires
// exactly as if the user clicked the wallet directly.
function ButtonContent({
  text,
  textStyle,
  anchorId,
}: {
  text: string;
  textStyle: React.CSSProperties;
  anchorId: string;
}): React.ReactElement {
  const isUnlock = anchorId === "unlock-button";

  const onClick = async (e: React.MouseEvent) => {
    if (!isUnlock) return;
    e.preventDefault();
    e.stopPropagation();

    // Find the wrapping <div> (the OverlayEl container) — its centre on the
    // viewport corresponds 1:1 to the Phantom button centre, since the
    // overlay window covers the Phantom popup with identical bounds.
    const node = (e.currentTarget as HTMLElement).closest("[data-anchor='unlock-button']") as HTMLElement | null;
    const rect = (node ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
    const xPct = (rect.left + rect.width / 2) / window.innerWidth;
    const yPct = (rect.top + rect.height / 2) / window.innerHeight;

    try {
      const r = await window.agentApi.injectClick(xPct, yPct);
      if (!r.ok) console.warn("[Overlay] injectClick failed:", r.error);
    } catch (err) {
      console.warn("[Overlay] injectClick threw:", err);
    }
  };

  return (
    <span
      style={{ ...textStyle, pointerEvents: isUnlock ? "auto" : "none" }}
      onClick={onClick}
    >
      {text}
    </span>
  );
}

// ── Password input — captures user typing, forwards each char to Phantom ─
// The <input> is real and themed. We track previous value to compute the
// diff each keystroke (handles paste, IME, backspace) and send characters
// or backspace keys via the agent's CGEvent.postToPid bridge. The actual
// password never leaves the local agent process.
function PasswordInputContent({
  placeholder,
  textStyle,
}: {
  placeholder: string;
  textStyle: React.CSSProperties;
}): React.ReactElement {
  const ref = useRef<HTMLInputElement>(null);
  const prev = useRef<string>("");

  const handleInput = async (e: React.FormEvent<HTMLInputElement>) => {
    const next = (e.currentTarget as HTMLInputElement).value;
    const before = prev.current;
    prev.current = next;
    window.agentApi.captiveExtend();

    if (next.length > before.length && next.startsWith(before)) {
      // Pure append — send only the new chars
      const added = next.slice(before.length);
      const r = await window.agentApi.injectText(added);
      if (!r.ok) console.warn("[Overlay] injectText failed:", r.error);
    } else if (next.length < before.length && before.startsWith(next)) {
      // Pure delete — send backspaces for each removed char
      const removed = before.length - next.length;
      for (let i = 0; i < removed; i++) {
        await window.agentApi.injectKey("backspace");
      }
    } else {
      // Replace / paste / mixed — naive: backspace whole previous, type new
      for (let i = 0; i < before.length; i++) {
        await window.agentApi.injectKey("backspace");
      }
      if (next.length > 0) {
        await window.agentApi.injectText(next);
      }
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Look up the Unlock button position in the rendered DOM and inject a
      // real mouse click at its centre — same path as a manual click. This
      // guarantees Phantom's onClick handler fires (some Phantom builds
      // ignore Enter in the password input).
      const btn = document.querySelector("[data-anchor='unlock-button']") as HTMLElement | null;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const xPct = (rect.left + rect.width / 2) / window.innerWidth;
        const yPct = (rect.top + rect.height / 2) / window.innerHeight;
        const r = await window.agentApi.injectClick(xPct, yPct);
        if (!r.ok) console.warn("[Overlay] Enter→injectClick failed:", r.error);
      } else {
        const r = await window.agentApi.injectKey("return");
        if (!r.ok) console.warn("[Overlay] fallback inject Return failed:", r.error);
      }
    }
  };

  return (
    <input
      ref={ref}
      type="password"
      placeholder={placeholder}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={() => window.agentApi.captiveExtend()}
      style={{
        ...textStyle,
        // Override text-style defaults that don't make sense for an <input>
        background: "transparent",
        border: "none",
        outline: "none",
        width: "100%",
        height: "100%",
        padding: "0 16px",
        textAlign: "left",
        fontStyle: "normal",
        // Ensure dots use the themed text color
        color: textStyle.color,
        // Larger letter-spacing so dots feel premium
        letterSpacing: "0.2em",
        pointerEvents: "auto",
        cursor: "text",
      }}
    />
  );
}
