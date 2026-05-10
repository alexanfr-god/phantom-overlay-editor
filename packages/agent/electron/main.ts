import { app, BrowserWindow, ipcMain, screen } from "electron";
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
let layoutFreshUntil = 0;   // show overlay unconditionally for 10s after layout:push

// ── Swift source ──────────────────────────────────────────────────────────────
// Modes:
//   <no args>       → find popup, output: x,y,w,h,pid
//   detect          → find popup + sample pixels, output: x,y,w,h,pid,screen
//   inject <pid>    → read text from stdin, type each char into pid via CGEvent
//   key <pid> <id>  → send a special key (return | tab | escape | backspace) to pid
//
// Special-key injection uses Cocoa virtual keycodes; text injection uses
// CGEvent.keyboardSetUnicodeString so the entire char range works (incl.
// non-ASCII passwords). Events are posted directly to the target pid via
// .postToPid, which delivers the keystroke without taking focus from
// our overlay window.
const SWIFT_SRC = `
import CoreGraphics
import Foundation
import AppKit

let args = CommandLine.arguments
let detectMode = args.contains("detect")
let mode: String = args.count >= 2 ? args[1] : ""

// ────────────────────────────────────────────────────────────────────────────
// inject mode: type Unicode text into a target pid
// ────────────────────────────────────────────────────────────────────────────
if mode == "inject" {
  guard args.count >= 3, let pid = Int32(args[2]) else {
    fputs("usage: phantom_finder inject <pid>  (text on stdin)\\n", stderr)
    exit(2)
  }
  let data = FileHandle.standardInput.readDataToEndOfFile()
  guard let text = String(data: data, encoding: .utf8), !text.isEmpty else { exit(0) }

  for scalar in text.unicodeScalars {
    var chars: [UniChar] = []
    let s = String(scalar)
    for u in s.utf16 { chars.append(u) }

    let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)!
    chars.withUnsafeBufferPointer { buf in
      down.keyboardSetUnicodeString(stringLength: buf.count, unicodeString: buf.baseAddress)
    }
    down.postToPid(pid)

    let up = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)!
    chars.withUnsafeBufferPointer { buf in
      up.keyboardSetUnicodeString(stringLength: buf.count, unicodeString: buf.baseAddress)
    }
    up.postToPid(pid)

    // Tiny gap between events so React's onChange has time to settle
    usleep(2000)
  }
  exit(0)
}

// ────────────────────────────────────────────────────────────────────────────
// click mode: simulate a left-click at absolute screen coordinates
// ────────────────────────────────────────────────────────────────────────────
if mode == "click" {
  guard args.count >= 5,
        let pid = Int32(args[2]),
        let x = Double(args[3]),
        let y = Double(args[4]) else {
    fputs("usage: phantom_finder click <pid> <x> <y>\\n", stderr)
    exit(2)
  }
  let target = CGPoint(x: x, y: y)

  // Save cursor position so we can warp it back after the click — keeps the
  // user's pointer where they had it instead of jumping to the button center.
  let original = CGEvent(source: nil)?.location ?? target

  // postToPid is unreliable for mouse events (the OS routes them by screen
  // location). Posting at .cghidEventTap goes through the standard input
  // pipeline so Chrome receives the click on Phantom's Unlock button.
  let down = CGEvent(mouseEventSource: nil,
                     mouseType: .leftMouseDown,
                     mouseCursorPosition: target,
                     mouseButton: .left)!
  down.post(tap: .cghidEventTap)
  usleep(20_000)

  let up = CGEvent(mouseEventSource: nil,
                   mouseType: .leftMouseUp,
                   mouseCursorPosition: target,
                   mouseButton: .left)!
  up.post(tap: .cghidEventTap)
  usleep(20_000)

  // Warp back so user doesn't see the cursor jump
  CGWarpMouseCursorPosition(original)

  // Suppress the next mouse move so the warp doesn't generate a stray event
  CGAssociateMouseAndMouseCursorPosition(1)
  fputs("[Swift] click \\(x),\\(y) on pid=\\(pid)\\n", stderr)
  exit(0)
}

// ────────────────────────────────────────────────────────────────────────────
// key mode: send a single special key to a target pid
// ────────────────────────────────────────────────────────────────────────────
if mode == "key" {
  guard args.count >= 4, let pid = Int32(args[2]) else {
    fputs("usage: phantom_finder key <pid> <return|tab|escape|backspace>\\n", stderr)
    exit(2)
  }
  let keyName = args[3].lowercased()
  let codes: [String: CGKeyCode] = [
    "return": 36, "enter": 36,
    "tab": 48,
    "escape": 53, "esc": 53,
    "backspace": 51, "delete": 51,
  ]
  guard let kc = codes[keyName] else {
    fputs("[Swift] Unknown key name: \\(keyName)\\n", stderr)
    exit(3)
  }
  let down = CGEvent(keyboardEventSource: nil, virtualKey: kc, keyDown: true)!
  down.postToPid(pid)
  let up = CGEvent(keyboardEventSource: nil, virtualKey: kc, keyDown: false)!
  up.postToPid(pid)
  exit(0)
}

// ────────────────────────────────────────────────────────────────────────────
// find/detect mode (default)
// ────────────────────────────────────────────────────────────────────────────
let opts = CGWindowListOption(rawValue:
  CGWindowListOption.optionOnScreenOnly.rawValue |
  CGWindowListOption.excludeDesktopElements.rawValue)
guard let wins = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String:Any]] else { exit(0) }

let BLOCKED = ["metamask", "rabby", "coinbase", "keplr", "trust"]

struct WinMatch {
  let x: Int, y: Int, w: Int, h: Int
  let layer: Int, name: String, priority: Int
  let windowNumber: Int
  let pid: Int
}

var candidates: [WinMatch] = []
let listMode = mode == "list"

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
  let wn = w["kCGWindowNumber"] as? Int ?? 0
  let pid = w["kCGWindowOwnerPID"] as? Int ?? 0

  // ── list mode: dump every Chrome window for diagnostics, no filters ──
  if listMode {
    print("layer=\\(layer) wn=\\(wn) pid=\\(pid) size=\\(Int(wd))x\\(Int(ht)) at \\(Int(x)),\\(Int(y)) owner=\\"\\(owner)\\" name=\\"\\(name)\\"")
    continue
  }

  guard layer == 0 && wd >= 200 && wd <= 500 && ht >= 300 && ht <= 700 else { continue }

  let lower = name.lowercased()
  if BLOCKED.contains(where: { lower.contains($0) }) { continue }

  let isPhantom = lower.contains("phantom") || name.contains("bfnaelmomeimhlpmgjnjophhpkkoljpa")
  candidates.append(WinMatch(
    x: Int(x), y: Int(y), w: Int(wd), h: Int(ht),
    layer: layer, name: name,
    priority: isPhantom ? 0 : 1,
    windowNumber: wn,
    pid: pid
  ))
}

if listMode { exit(0) }

candidates.sort { $0.priority < $1.priority }

// Log every candidate to stderr so the agent log shows what was matched.
// Helps diagnose why Phantom popup is or isn't being detected.
for c in candidates {
  fputs("[Swift] cand pri=\\(c.priority) wn=\\(c.windowNumber) pid=\\(c.pid) \\(c.w)x\\(c.h) name=\\"\\(c.name)\\"\\n", stderr)
}

// Permissive: take the first candidate after sort (Phantom-named first if
// any). The strict "priority==0 only" rule broke real Phantom popups whose
// kCGWindowName doesn't contain "phantom" (Chrome often hides popup names).
// Diagnostic stderr lines above let us tighten this once we know what
// Phantom popups actually look like in the window list.
guard let phantom = candidates.first else { exit(0) }

// Fast mode: just output bounds + pid
if !detectMode {
  print("\\(phantom.x),\\(phantom.y),\\(phantom.w),\\(phantom.h),\\(phantom.pid)")
  exit(0)
}

// Detect mode: per-window pixel sample to determine which screen of Phantom is up
var screen = "unknown"
let phantomWinId = CGWindowID(phantom.windowNumber)
if let cgImg = CGWindowListCreateImage(CGRect.null, .optionIncludingWindow, phantomWinId, .bestResolution) {
  let rep = NSBitmapImageRep(cgImage: cgImg)
  let imgW = rep.pixelsWide
  let imgH = rep.pixelsHigh
  let sx = imgW / 2
  let sy = Int(Double(imgH) * 0.81)
  if let color = rep.colorAt(x: sx, y: sy) {
    let r = Int(color.redComponent * 255)
    let g = Int(color.greenComponent * 255)
    let b = Int(color.blueComponent * 255)
    let isPurple = r >= 120 && r <= 230 && g >= 100 && g <= 210 && b >= 180
    screen = isPurple ? "password" : "other"
    fputs("[Swift] pixel(\\(sx),\\(sy)) = rgb(\\(r),\\(g),\\(b)) -> \\(screen)\\n", stderr)
  }
}

print("\\(phantom.x),\\(phantom.y),\\(phantom.w),\\(phantom.h),\\(phantom.pid),\\(screen)")
`;

function compileBinary(): Promise<void> {
  return new Promise((resolve) => {
    const src = BIN + ".swift";
    writeFileSync(src, SWIFT_SRC);
    execFile("/usr/bin/swiftc", ["-O", "-o", BIN, src], { timeout: 60000 }, (err) => {
      if (err) console.error("[Agent] Swift compile error:", err.message);
      else console.log("[Agent] ✓ Swift binary compiled");
      ready = !err;
      resolve();
    });
  });
}

interface FindResult {
  x: number; y: number; width: number; height: number;
  pid?: number;
  screen?: string;
}

let tickCount = 0;
let phantomPid: number | null = null; // last known Chrome PID hosting Phantom popup

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

      // Fast mode  : x,y,w,h,pid
      // Detect mode: x,y,w,h,pid,screen
      const parts = stdout.trim().split(",");
      if (parts.length < 4) { resolve(null); return; }

      const x = parseInt(parts[0]);
      const y = parseInt(parts[1]);
      const w = parseInt(parts[2]);
      const h = parseInt(parts[3]);
      const pid = parts[4] ? parseInt(parts[4]) : NaN;
      const screen = parts[5]; // undefined in fast mode

      if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) { resolve(null); return; }

      if (!isNaN(pid) && pid > 0) phantomPid = pid;

      if (tickCount <= 3 || tickCount % 50 === 0) {
        console.log(`[Agent] tick#${tickCount} Phantom ${w}x${h} at ${x},${y} pid=${phantomPid}${screen ? ` screen="${screen}"` : ""}`);
      }

      resolve({ x, y, width: w, height: h, pid: isNaN(pid) ? undefined : pid, screen });
    });
  });
}

// ── Inject keystrokes into the tracked Phantom Chrome process ──────────────
// Spawn the Swift binary in `inject` or `key` mode and post events directly
// to Phantom's pid via CGEvent.postToPid. Focus stays on our overlay.
function injectText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ready)              return reject(new Error("Swift binary not ready"));
    if (!phantomPid)         return reject(new Error("Phantom pid unknown — not yet detected"));
    if (!text || text === "") return resolve();

    const child = execFile(BIN, ["inject", String(phantomPid)], { timeout: 5000 }, (err) => {
      if (err) reject(err); else resolve();
    });
    child.stdin?.write(text);
    child.stdin?.end();
  });
}

function injectKey(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ready)      return reject(new Error("Swift binary not ready"));
    if (!phantomPid) return reject(new Error("Phantom pid unknown — not yet detected"));
    execFile(BIN, ["key", String(phantomPid), name], { timeout: 2000 }, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

// Inject a left-click at absolute screen coordinates (x, y). Used by the
// overlay's themed Unlock button to actually press Phantom's real button.
function injectClickAbs(x: number, y: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ready)      return reject(new Error("Swift binary not ready"));
    if (!phantomPid) return reject(new Error("Phantom pid unknown — not yet detected"));
    execFile(BIN, ["click", String(phantomPid), String(Math.round(x)), String(Math.round(y))],
             { timeout: 2000 }, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

// ── Helper: detect Phantom screen without hiding overlay ──
// Uses per-window CGWindowListCreateImage in the Swift binary, which
// captures only Phantom's pixels (our overlay window is excluded).
function detectScreen(): Promise<FindResult | null> {
  return findPhantom(true);
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

  // Forward overlay renderer console messages into the main agent log so
  // diagnostics (e.g. layout:push element dump) show up in /tmp/agent.log
  // without the user having to open Electron DevTools.
  overlayWin.webContents.on("console-message", (_e, level, message) => {
    const tag = level === 2 ? "WARN" : level === 3 ? "ERROR" : "LOG";
    console.log(`[Overlay-${tag}] ${message}`);
  });

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
        layoutFreshUntil = Date.now() + 10_000; // show unconditionally for 10s
        console.log(`[Agent] Layout received — targetScreen="${targetScreen}" (fresh for 10s)`);
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
  const result = await findPhantom(false);

  if (overlayVisible) {
    if (result) {
      missCount = 0;
      applyBounds(result);
    } else {
      missCount++;
      if (missCount >= 6) {
        forceHide();
        missCount = 0;
        console.log("[Agent] Phantom gone — overlay hidden");
      }
    }
    return;
  }

  // Overlay hidden: show whenever Phantom is detected AND we're inside the
  // freshness window (layout:push refreshes for 10s; captive-extend bumps it
  // forward on each keystroke / focus so active typing keeps the overlay
  // alive). We dropped the per-tick pixel-sample screen detection — its
  // RGB threshold was misfiring on Phantom's current dark password screen
  // and forcing overlay show/hide every ~5s, which broke typing and clicks.
  if (!result) {
    missCount++;
    return;
  }
  missCount = 0;

  if (Date.now() < layoutFreshUntil) {
    applyBounds(result);
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

// ── Keystroke / key forwarding to Phantom (CGEvent.postToPid) ──────────────
// The overlay's themed <input> captures user typing and forwards each new
// character or special key here; we relay through the Swift binary, which
// posts CGEvents directly to Chrome's pid so focus stays in our overlay.
ipcMain.handle("inject-text", async (_ev, text: string) => {
  try {
    await injectText(text);
    console.log(`[Agent] inject-text "${text.replace(/./g, "•")}" (${text.length} chars, pid=${phantomPid})`);
    return { ok: true };
  } catch (e) {
    console.warn(`[Agent] inject-text failed: ${(e as Error).message}`);
    return { ok: false, error: (e as Error).message };
  }
});

ipcMain.handle("inject-key", async (_ev, name: string) => {
  try {
    await injectKey(name);
    console.log(`[Agent] inject-key "${name}" (pid=${phantomPid})`);
    return { ok: true };
  } catch (e) {
    console.warn(`[Agent] inject-key failed: ${(e as Error).message}`);
    return { ok: false, error: (e as Error).message };
  }
});

// Click at a position expressed as fractions of the overlay window (xPct,
// yPct ∈ [0,1]). Main converts to absolute screen coords using the overlay's
// current bounds — Phantom popup is at the same coords because we track it.
//
// Critical: the overlay sits on top of Phantom. CGEvent posted at
// .cghidEventTap routes to whatever window is at that screen position. If
// the overlay is in captive mode it would re-intercept the click. So we
// briefly disable captive mode (forwarding clicks through) for the
// injection, then let the cursor poller restore it.
ipcMain.handle("inject-click", async (_ev, xPct: number, yPct: number) => {
  if (!overlayWin) return { ok: false, error: "overlay not ready" };
  const b = overlayWin.getBounds();
  const ax = b.x + xPct * b.width;
  const ay = b.y + yPct * b.height;

  const wasCaptive = captiveActive;
  if (wasCaptive) {
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
    overlayWin.setFocusable(false);
    captiveActive = false;
  }

  try {
    await injectClickAbs(ax, ay);
    console.log(`[Agent] inject-click @ ${Math.round(ax)},${Math.round(ay)} (pid=${phantomPid})`);
    // Successfully fired a click — that was almost certainly Unlock. Schedule
    // auto-hide so the overlay doesn't sit over Phantom's wallet home screen
    // after a successful unlock. The 2s cooldown then suppresses immediate
    // re-show if Phantom is still detected at the same coords.
    setTimeout(() => {
      if (overlayWin?.isVisible()) {
        forceHide();
        unlockCooldownUntil = Date.now() + 2000;
        layoutFreshUntil = 0;
        console.log("[Agent] Auto-hide after inject-click (assumed unlock)");
      }
    }, 1500);
    return { ok: true };
  } catch (e) {
    console.warn(`[Agent] inject-click failed: ${(e as Error).message}`);
    return { ok: false, error: (e as Error).message };
  } finally {
    captiveHoldUntil = Date.now() + 200;
  }
});

ipcMain.handle("get-phantom-pid", () => phantomPid);

// ── Captive-region cursor polling ──────────────────────────────────────────
// The overlay defaults to setIgnoreMouseEvents(true, {forward:true}) so all
// clicks pass through to Phantom. But on the password screen we need to
// capture clicks on certain regions (the themed input, the unlock button) so
// the overlay can handle them instead and forward via injectText / injectKey.
//
// Overlay sends "captive regions" as percentages of the canvas. Main polls
// the global cursor every 80ms; when the cursor is over any captive region
// AND the overlay is visible, the window is switched to interactive mode
// (setIgnoreMouseEvents(false), focusable). When the cursor leaves all
// regions AND no overlay element currently holds focus, we revert.
interface CaptivePctRegion { x: number; y: number; w: number; h: number }
let captiveRegions: CaptivePctRegion[] = [];
let captiveActive = false;
let captiveHoldUntil = 0; // grace period after entering, prevents flap

function updateCaptiveMode(forceOff = false): void {
  if (!overlayWin || !overlayWin.isVisible()) {
    if (captiveActive) {
      overlayWin?.setIgnoreMouseEvents(true, { forward: true });
      overlayWin?.setFocusable(false);
      captiveActive = false;
    }
    return;
  }
  if (forceOff || captiveRegions.length === 0) {
    if (captiveActive) {
      overlayWin.setIgnoreMouseEvents(true, { forward: true });
      overlayWin.setFocusable(false);
      captiveActive = false;
    }
    return;
  }

  const cur = screen.getCursorScreenPoint();
  const bounds = overlayWin.getBounds();
  const inCaptive = captiveRegions.some((r) => {
    const ax = bounds.x + r.x * bounds.width;
    const ay = bounds.y + r.y * bounds.height;
    const aw = r.w * bounds.width;
    const ah = r.h * bounds.height;
    return cur.x >= ax && cur.x <= ax + aw && cur.y >= ay && cur.y <= ay + ah;
  });

  if (inCaptive) {
    captiveHoldUntil = Date.now() + 800; // hold captive for 800ms after last hover
    if (!captiveActive) {
      overlayWin.setIgnoreMouseEvents(false);
      overlayWin.setFocusable(true);
      captiveActive = true;
    }
  } else if (captiveActive && Date.now() > captiveHoldUntil) {
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
    overlayWin.setFocusable(false);
    captiveActive = false;
  }
}

setInterval(updateCaptiveMode, 80);

ipcMain.handle("set-captive-regions", (_ev, regions: CaptivePctRegion[]) => {
  captiveRegions = Array.isArray(regions) ? regions : [];
  console.log(`[Agent] Captive regions: ${captiveRegions.length}`);
});

// Renderer signals it's actively typing — extend captive grace window so
// the overlay can't flip back to pass-through mid-keystroke, AND extend
// the overlay-show freshness window so tick() doesn't hide the overlay
// in the middle of a password entry.
ipcMain.handle("captive-extend", () => {
  captiveHoldUntil = Date.now() + 1500;
  layoutFreshUntil = Math.max(layoutFreshUntil, Date.now() + 30_000);
});
