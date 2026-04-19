import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#1a1a1a",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Dev: load vite dev server; prod: load built file
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── Project save/load ───────────────────────────────────────────────────
const PROJECTS_DIR = join(app.getPath("userData"), "projects");
const AUTOSAVE_PATH = join(PROJECTS_DIR, "_autosave.json");

function ensureProjectsDir() {
  if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true });
}

ipcMain.handle("get-app-version", () => app.getVersion());

ipcMain.handle("project:save", async (_event, data: string) => {
  ensureProjectsDir();
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: "Save Project",
    defaultPath: join(PROJECTS_DIR, "phantom-project.json"),
    filters: [{ name: "Phantom Project", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return null;
  writeFileSync(result.filePath, data, "utf-8");
  return result.filePath;
});

ipcMain.handle("project:load", async () => {
  ensureProjectsDir();
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: "Open Project",
    defaultPath: PROJECTS_DIR,
    filters: [{ name: "Phantom Project", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const content = readFileSync(result.filePaths[0], "utf-8");
  return { path: result.filePaths[0], content };
});

ipcMain.handle("project:autosave", (_event, data: string) => {
  ensureProjectsDir();
  writeFileSync(AUTOSAVE_PATH, data, "utf-8");
});

ipcMain.handle("project:autoload", () => {
  ensureProjectsDir();
  if (!existsSync(AUTOSAVE_PATH)) return null;
  return readFileSync(AUTOSAVE_PATH, "utf-8");
});
