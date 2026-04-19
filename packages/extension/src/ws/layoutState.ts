import type { LayoutDocument } from "@phantom-editor/shared";

export interface OverlayState {
  layout: LayoutDocument | null;
  enabled: boolean;
  opacity: number;
  wsConnected: boolean;
  lastUpdated: number | null;
}

export type OverlayListener = () => void;

export const overlayState: OverlayState = {
  layout: null,
  enabled: true,
  opacity: 1,
  wsConnected: false,
  lastUpdated: null,
};

const listeners = new Set<OverlayListener>();

export function subscribeOverlay(fn: OverlayListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyListeners(): void {
  listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error("[PhantomOverlay] Listener error:", e); }
  });
}

// Expose for /debug-overlay skill
(window as Record<string, unknown>).__overlayState = overlayState;
