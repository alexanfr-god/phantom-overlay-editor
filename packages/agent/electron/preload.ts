import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentApi", {
  onPhantomBounds: (cb: (bounds: { x: number; y: number; width: number; height: number } | null) => void) => {
    ipcRenderer.on("phantom-bounds", (_ev, bounds) => cb(bounds));
  },
  onWsMessage: (cb: (msg: unknown) => void) => {
    ipcRenderer.on("ws-message", (_ev, msg) => cb(msg));
  },
  getStatus: () => ipcRenderer.invoke("get-status"),
  // Interactive overlay: toggle mouse event pass-through
  setInteractive: (interactive: boolean) => ipcRenderer.invoke("set-interactive", interactive),
  // Hide overlay (after unlock)
  hideOverlay: () => ipcRenderer.invoke("hide-overlay"),
});
