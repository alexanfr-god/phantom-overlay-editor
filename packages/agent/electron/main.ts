import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { execFile, exec } from "child_process";
import { writeFileSync } from "fs";
import WebSocket from "ws";
import { WsMessageSchema } from "@phantom-editor/shared";

const WS_URL = "ws://localhost:3333";
const CLIENT_ID = "agent-" + Math.random().toString(36).slice(2);
const BIN = "/tmp/phantom_finder";

let OFFSET_X = 0;
let OFFSET_Y = 0;

let overlayWin: BrowserWindow | null = null;
let ws: WebSocket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let trackTimer: ReturnType<typeof setInterval> | null = null;
let lastKey = "";
let ready = false;
let missCount = 0;
let screenMissCount = 0;    // consecutive "wrong screen" detections
let targetScreen = "password";
let unlockCooldownUntil = 0; // timestamp — don't show overlay until this time

// ── Swift source ──────────────────────────────────────────────────────────────
// Two modes:
//   no args  → find popup, output: x,y,w,h
//   "detect" → find popup + sample pixels, output: x,y,w,h,screen
const SWIFT_SRC = `
import CoreGraphics
import Foundation
import AppKit

let detectMode = CommandLine.arguments.contains("detect")

let opts = CGWindowListOption(rawValue:
  CGWindowListOption.optionOnScreenOnly.rawValue |
  CGWindowListOption.excludeDesktopElements.rawValue)
guard let wins = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String:Any]] else { exit(0) }

let BLOCKED = ["metamask", "rabby", "coinbase", "keplr", "trust"]

struct WinMatch {
  let x: Int, y: Int, w: Int, h: Int
  let layer: Int, name: String, priority: Int
}

var candidates: [WinMatch] = []

for w in wins {
  let owner = w["kCGWindowOwnerName"] as? String ?? ""
  if !owner.contains("Chrome") && !owner.contains("Google") { continue }

  let name = w["kCGWindowName"] as? String ?? ""
  let b = w["kCGWindowBounds"] as? [String:Any] ?? [:]
  let wd = b["Width"] as? CGFloat ?? 0
  let ht = b["Height"] as? CGFloat ?? 0
  let x  = b["X"] as? CGFloat ?? 0
  let y  = b["Y"] as? CGFloat ?? 0
  let layer = w["kCGWindowLayer"] as? Int ?? 0

  guard layer == 0 && wd >= 200 && wd <= 500 && ht >= 300 && ht <= 700 else { continue }

  let lower = name.lowercased()
  if BLOCKED.contains(where: { lower.contains($0) }) { continue }

  let isPhantom = lower.contains("phantom") || name.contains("bfnaelmomeimhlpmgjnjophhpkkoljpa")
  candidates.append(WinMatch(
    x: Int(x), y: Int(y), w: Int(wd), h: Int(ht),
    layer: layer, name: name,
    priority: isPhantom ? 0 : 1
  ))
}

candidates.sort { $0.priority < $1.priority }
guard let phantom = candidates.first else { exit(0) }

// ── Fast mode: just output bounds ──
if !detectMode {
  print("\\(phantom.x),\\(phantom.y),\\(phantom.w),\\(phantom.h)")
  exit(0)
}

// ── Detect mode: sample pixels to determine screen ──
var screen = "unknown"
let rect = CGRect(
  x: CGFloat(phantom.x), y: CGFloat(phantom.y),
  width: CGFloat(phantom.w), height: CGFloat(phantom.h)
)

// .optionAll captures the screen region (works without per-window permission)
// Caller must hide overlay before running detect mode to avoid self-capture
if let cgImg = CGWindowListCreateImage(rect, .optionAll, kCGNullWindowID, .bestResolution) {
  let rep = NSBitmapImageRep(cgImage: cgImg)
  let imgW = rep.pixelsWide
  let imgH = rep.pixelsHigh

  // Sample center of Unlock button area (x=50%, y=81%)
  let sx = imgW / 2
  let sy = Int(Double(imgH) * 0.81)

  if let color = rep.colorAt(x: sx, y: sy) {
    let r = Int(color.redComponent * 255)
    let g = Int(color.greenComponent * 255)
    let b = Int(color.blueComponent * 255)

    // Phantom Unlock button purple ~= #ab9ff2 (R~171 G~159 B~242)
    let isPurple = r >= 120 && r <= 230 && g >= 100 && g <= 210 && b >= 180
    screen = isPurple ? "password" : "other"
    fputs("[Swift] pixel(\\(sx),\\(sy)) = rgb(\\(r),\\(g),\\(b)) -> \\(screen)\\n", stderr)
  }
}

print("\\(phantom.x),\\(phantom.y),\\(phantom.w),\\(phantom.h),\\(screen)")
`;

function compileBinary(): Promise<void> {
  return new Promise((resolve) => {
    const src = BIN + ".swift";
    writeFileSync(src, SWIFT_SRC);
    execFile("swiftc", ["-O", "-o", BIN, src], { timeout: 30000 }, (err) => {
      if (err) console.error("[Agent] Swift compile error:", err.message);
      else console.log("[Agent] ✓ Swift binary compiled");
      ready = !err;
      resolve();
    });
  });
}

interface FindResult {
  x: number; y: number; width: number; height: number;
  screen?: string;
}

let tickCount = 0;

function findPhantom(detect: boolean): Promise<FindResult | null> {
  return new Promise((resolve) => {
    if (!ready) { resolve(null); return; }
    const args = detect ? `${BIN} detect` : BIN;
    exec(args, { timeout: 2000 }, (err, stdout, stderr) => {
      tickCount++;
      if (err || !stdout.trim()) { resolve(null); return; }

      if (stderr.trim() && (tickCount <= 5 || tickCount % 50 === 0)) {
        console.log(`[Agent] ${stderr.trim()}`);
      }

      const parts = stdout.trim().split(",");
      if (parts.length < 4) { resolve(null); return; }

      const x = parseInt(parts[0]);
      const y = parseInt(parts[1]);
      const w = parseInt(parts[2]);
      const h = parseInt(parts[3]);
      const screen = parts[4]; // undefined if fast mode

      if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) { resolve(null); return; }

      if (tickCount <= 3 || tickCount % 50 === 0) {
        console.log(`[Agent] tick#${tickCount} Phantom ${w}x${h} at ${x},${y}${screen ? ` screen="${screen}"` : ""}`);
      }

      resolve({ x, y, width: w, height: h, screen });
    });
  });
}

// ── Helper: run detect with overlay hidden to avoid self-capture ──
function detectWithHide(): Promise<FindResult | null> {
  return new Promise(async (resolve) => {
    const wasVisible = overlayWin?.isVisible() ?? false;
    if (wasVisible) {
      overlayWin!.hide();
    }
    // Small delay to let the window actually hide before screenshot
    await new Promise((r) => setTimeout(r, 60));
    const result = await findPhantom(true);
    // We don't re-show here — caller decides based on result
    resolve(result);
  });
}

// ── Overlay window ──────────────────────────────────────────────────────────
function applyBounds(b: FindResult) {
  if (!overlayWin) return;
  const wasHidden = !overlayWin.isVisible();
  missCount = 0;

  const finalX = b.x + OFFSET_X;
  const finalY = b.y + OFFSET_Y;
  const key = `${finalX},${finalY},${b.width},${b.height}`;

  if (key === lastKey && !wasHidden) return;
  lastKey = key;

  overlayWin.setPosition(finalX, finalY, false);
  overlayWin.setContentSize(b.width, b.height, false);

  if (wasHidden) {
    overlayWin.showInactive();
    console.log(`[Agent] ✓ Overlay shown: ${b.width}x${b.height} at ${finalX},${finalY}`);
  }
  overlayWin.moveTop();
  overlayWin.webContents.send("phantom-bounds", b);
}

function forceHide() {
  if (!overlayWin?.isVisible()) return;
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setFocusable(false);
  overlayWin.hide();
  lastKey = "";
  overlayWin.webContents.send("phantom-bounds", null);
}

function createOverlayWindow() {
  overlayWin = new BrowserWindow({
    width: 400, height: 600,
    x: -10000, y: -10000,
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true,
    hasShadow: false, focusable: false, show: false,
    roundedCorners: false,
    thickFrame: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setAlwaysOnTop(true, "floating");
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWin.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    overlayWin.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ── WebSocket ───────────────────────────────────────────────────────────────
function connectWs() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    retryCount = 0;
    ws!.send(JSON.stringify({ type: "client:hello", role: "agent", clientId: CLIENT_ID }));
    console.log("[Agent] ✓ WS connected");
  });

  ws.on("message", (data: Buffer) => {
    let raw: unknown;
    try { raw = JSON.parse(data.toString()); } catch { return; }
    const r = WsMessageSchema.safeParse(raw);
    if (!r.success) return;
    const msg = r.data;

    if (msg.type === "layout:push" || msg.type === "overlay:toggle" || msg.type === "overlay:opacity" || msg.type === "canvas:resize") {
      overlayWin?.webContents.send("ws-message", msg);
      if (msg.type === "layout:push") {
        const payload = msg.payload as { targetScreen?: string };
        if (payload.targetScreen) {
          targetScreen = payload.targetScreen;
        }
        unlockCooldownUntil = 0; // new layout clears cooldown
        screenMissCount = 0;
        console.log(`[Agent] Layout received — targetScreen="${targetScreen}"`);
      }
    }

    if (msg.type === "overlay:insets") {
      OFFSET_X = msg.left;
      OFFSET_Y = msg.top;
      lastKey = "";
      console.log(`[Agent] Offset updated: X=${OFFSET_X} Y=${OFFSET_Y}`);
    }
  });

  ws.on("close", () => {
    const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10_000);
    retryCount++;
    retryTimer = setTimeout(connectWs, delay);
  });

  ws.on("error", () => ws?.terminate());
}

// ── App ─────────────────────────────────────────────────────────────────────
let tracking = false;

app.whenReady().then(async () => {
  if (app.dock) app.dock.hide();

  createOverlayWindow();
  connectWs();

  await compileBinary();

  // ── Main tracking loop ──
  trackTimer = setInterval(async () => {
    if (tracking) return; // prevent overlapping ticks
    tracking = true;
    try {
      await tick();
    } finally {
      tracking = false;
    }
  }, 500);

  console.log("[Agent] Tracking with screen detection");
});

async function tick() {
  // Cooldown after unlock — don't show overlay for 2 seconds
  if (Date.now() < unlockCooldownUntil) return;

  const overlayVisible = overlayWin?.isVisible() ?? false;

  if (overlayVisible) {
    // Overlay is shown. Periodically re-verify the screen (every ~5 ticks = 2.5s).
    // To sample pixels, we must hide overlay first to avoid self-capture.
    if (tickCount % 5 === 0) {
      const result = await detectWithHide();
      if (!result) {
        // Phantom gone
        missCount++;
        if (missCount >= 3) {
          forceHide();
          console.log("[Agent] Phantom gone — overlay hidden");
        }
        return;
      }
      missCount = 0;

      if (result.screen === targetScreen || result.screen === "unknown") {
        screenMissCount = 0;
        applyBounds(result); // re-show + update position
      } else {
        screenMissCount++;
        if (screenMissCount >= 3) {
          forceHide();
          screenMissCount = 0;
          console.log(`[Agent] Screen changed to "${result.screen}" — overlay hidden`);
        } else {
          // Not enough misses yet — re-show overlay
          applyBounds(result);
        }
      }
      return;
    }

    // Non-detect tick: fast position check
    const result = await findPhantom(false);
    if (result) {
      missCount = 0;
      applyBounds(result);
    } else {
      missCount++;
      if (missCount >= 3) {
        forceHide();
        console.log("[Agent] Phantom gone — overlay hidden");
      }
    }
    return;
  }

  // ── Overlay hidden — run detect to check if we should show ──
  const result = await detectWithHide();
  if (!result) {
    missCount++;
    return;
  }
  missCount = 0;

  if (result.screen === targetScreen) {
    screenMissCount = 0;
    applyBounds(result);
    console.log(`[Agent] ✓ Screen matches "${targetScreen}" — overlay shown`);
  } else if (result.screen === "unknown") {
    // Can't determine screen (no pixel data) — show anyway
    screenMissCount = 0;
    applyBounds(result);
  } else {
    // Wrong screen — stay hidden
    if (tickCount % 25 === 0) {
      console.log(`[Agent] Screen "${result.screen}" ≠ target "${targetScreen}"`);
    }
  }
}

app.on("window-all-closed", () => {});
app.on("before-quit", () => {
  if (retryTimer) clearTimeout(retryTimer);
  if (trackTimer) clearInterval(trackTimer);
  ws?.close();
});

ipcMain.handle("get-status", () => ({
  wsConnected: ws?.readyState === WebSocket.OPEN,
  ready,
  lastKey,
  targetScreen,
  offset: { x: OFFSET_X, y: OFFSET_Y },
}));

ipcMain.handle("set-interactive", (_ev, interactive: boolean) => {
  if (!overlayWin) return;
  if (interactive) {
    overlayWin.setIgnoreMouseEvents(false);
    overlayWin.setFocusable(true);
    overlayWin.focus();
  } else {
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
    overlayWin.setFocusable(false);
  }
});

// Unlock: hide overlay + set 2-second cooldown
ipcMain.handle("hide-overlay", () => {
  forceHide();
  unlockCooldownUntil = Date.now() + 2000;
  screenMissCount = 0;
  console.log("[Agent] Overlay hidden (unlock) — cooldown 2s");
});
