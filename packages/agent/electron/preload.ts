import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentApi", {
  onPhantomBounds: (cb: (bounds: { x: number; y: number; width: number; height: number } | null) => void) => {
    ipcRenderer.on("phantom-bounds", (_ev, bounds) => cb(bounds));
  },
  onWsMessage: (cb: (msg: unknown) => void) => {
    ipcRenderer.on("ws-message", (_ev, msg) => cb(msg));
  },
  getStatus: () => ipcRenderer.invoke("get-status"),

  // Interactive overlay: toggle mouse event pass-through (manual; usually
  // managed automatically by main's cursor polling).
  setInteractive: (interactive: boolean) => ipcRenderer.invoke("set-interactive", interactive),

  // Hide overlay (after unlock)
  hideOverlay: () => ipcRenderer.invoke("hide-overlay"),

  // ── Phantom keystroke forwarding ────────────────────────────────────────
  // Each character the user types in the themed overlay <input> is relayed
  // here; main forwards it via Swift CGEvent.postToPid into the tracked
  // Chrome process so Phantom's real input updates without focus stealing.
  injectText: (text: string) => ipcRenderer.invoke("inject-text", text) as Promise<{ ok: boolean; error?: string }>,
  injectKey: (name: "return" | "enter" | "tab" | "escape" | "backspace") =>
    ipcRenderer.invoke("inject-key", name) as Promise<{ ok: boolean; error?: string }>,
  // Inject a left-click into Phantom at a point expressed as a fraction of
  // the overlay window (0..1). Main translates to absolute screen coords.
  injectClick: (xPct: number, yPct: number) =>
    ipcRenderer.invoke("inject-click", xPct, yPct) as Promise<{ ok: boolean; error?: string }>,
  getPhantomPid: () => ipcRenderer.invoke("get-phantom-pid") as Promise<number | null>,

  // Captive regions (percentage of overlay canvas) where the overlay should
  // capture clicks instead of forwarding them to Phantom. Use for the
  // themed password input + unlock button.
  setCaptiveRegions: (regions: Array<{ x: number; y: number; w: number; h: number }>) =>
    ipcRenderer.invoke("set-captive-regions", regions),

  // Tell main we're actively typing — extends the captive grace window so
  // pass-through doesn't kick in mid-keystroke if the cursor drifts.
  captiveExtend: () => ipcRenderer.invoke("captive-extend"),
});
