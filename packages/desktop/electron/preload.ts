import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  // Project save/load
  saveProject: (data: string) => ipcRenderer.invoke("project:save", data),
  loadProject: () => ipcRenderer.invoke("project:load"),
  autosave: (data: string) => ipcRenderer.invoke("project:autosave", data),
  autoload: () => ipcRenderer.invoke("project:autoload"),
  // Publish to wacocu.app
  publishToWCC: (data: string) => ipcRenderer.invoke("project:publish-to-wcc", data),
});
