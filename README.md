# Phantom Overlay Editor — macOS Themed Mask for the Phantom Wallet

Transparent macOS overlay agent that paints an AI-generated themed mask on top of the Phantom Chrome extension popup. Keystrokes typed into the mask's themed input are forwarded to the real Phantom underneath via `CGEvent.postToPid`. Clicks on the themed Unlock button are forwarded as real mouse clicks. The wallet keeps doing its own work — we just paint the skin.

> **Status:** demo-stable for the Phantom password screen. Other screens (home, send, NFT view) are next on the roadmap.

---

## What this repo contains

```
packages/
├── agent          ← the actual overlay (Electron + Swift CGEvent injection)
├── desktop        ← admin/editor window (opacity slider, layout debug, WS ping)
├── sync-server    ← bridges Supabase Realtime → ws://localhost:3333 → agent
└── shared         ← Zod WS message schemas shared by all packages
```

The themed mask is generated and pushed by [solana-style-studio](https://github.com/Alexanfr-God/solana-style-studio) — the Lovable-hosted WCC web app with the AI Theme Assistant. This repo is the local-only piece that runs on the user's Mac.

## Prerequisites

- macOS (the agent uses Swift + CoreGraphics; Windows/Linux not supported yet)
- Node.js ≥18 + npm
- Xcode Command Line Tools (`swiftc` at `/usr/bin/swiftc`)
- Google Chrome with the [Phantom extension](https://phantom.app) installed
- **Accessibility permission for Electron** — granted on first run (see "First-run gotcha" below)

## Install + run

```bash
git clone git@github.com:Alexanfr-God/phantom-overlay-editor.git
cd phantom-overlay-editor
npm install
```

Then in three separate terminals (or backgrounded):

```bash
npm run dev:server     # sync-server on :3333 + Supabase Realtime subscriber
npm run dev:agent      # macOS overlay (compiles Swift binary first run, ~30-60s)
npm run dev:desktop    # admin window — opacity slider, debug panel
```

Or all together for development:

```bash
npm run dev
```

## First-run gotcha — Accessibility permission

The agent injects keystrokes/clicks via `CGEvent.postToPid` and `.cghidEventTap`. macOS requires explicit Accessibility permission for this.

1. Start the agent (`npm run dev:agent`).
2. Open Phantom popup → push a theme from WCC → try to type a password into the overlay.
3. macOS pops a dialog: "Electron wants to control your computer." Click "Open System Preferences".
4. Enable the checkbox next to **Electron** in Privacy & Security → Accessibility.
5. Restart the agent:
   ```bash
   pkill -f dev:agent && npm run dev:agent
   ```

Until the permission is granted, the overlay renders but typing doesn't reach Phantom.

## Demo path

1. WCC studio (Lovable web app) is open in your browser.
2. `dev:server` + `dev:agent` are running locally.
3. Open the Phantom popup in Chrome (click the Phantom icon in the toolbar).
4. In WCC, click the ⚡ button on any minted theme — broadcasts the mask via Supabase Realtime.
5. The overlay agent receives the broadcast, finds the Phantom popup window, paints the mask on top.
6. Type your password in the overlay's themed input. Each keystroke is forwarded to the real Phantom via `CGEvent`.
7. Click the themed Unlock button (or press Enter) — a real mouse click lands on Phantom's Unlock button, the wallet unlocks.
8. Phantom navigates away from the password screen — the agent's pixel sampler detects the change and auto-hides the overlay within ~10 seconds.

## Architecture

```
┌──────────────────────────┐    Supabase Realtime
│ solana-style-studio      │    channel "wcc:overlay"
│ (Lovable web app)        │ ───────────────────────┐
└──────────────────────────┘                        │
                                                    ▼
┌──────────────────────────────────────────────────────┐
│ This repo, running on the user's Mac                 │
│                                                      │
│ sync-server  (Node.js, :3333)                         │
│   subscribes to Supabase channel                      │
│   forwards layout:push to ws clients                  │
│         │                                             │
│         ▼  ws://localhost:3333                        │
│ agent  (Electron transparent always-on-top window)    │
│   • tracks Phantom popup via Swift binary             │
│   • paints the JSON mask in AgentOverlay.tsx          │
│   • injects keystrokes/clicks via CGEvent             │
│                       │                               │
│                       ▼  (on top of)                  │
│             Phantom Chrome popup                      │
│             (unmodified, does its own logic)          │
└──────────────────────────────────────────────────────┘
```

### Swift binary (`/tmp/phantom_finder`)

Compiled at agent startup from inline source in `packages/agent/electron/main.ts`. Modes:

| Mode | Use |
|---|---|
| (no args) | Find Phantom popup → `x,y,w,h,pid` |
| `detect` | Same + pixel-sample to identify which screen is showing (`password` vs other) |
| `inject <pid>` | Read UTF-8 from stdin → post each scalar as `CGEvent.keyboardSetUnicodeString` to pid |
| `key <pid> <name>` | Send special key (`return`/`tab`/`escape`/`backspace`) |
| `click <pid> <x> <y>` | Simulate a left-click at absolute coords + warp cursor back |
| `list` | Dump every Chrome window for diagnostics |

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Overlay never appears | `tail -f /tmp/agent.log` — check the agent is detecting Phantom (`[Agent] tick#... Phantom WxH at X,Y pid=...`). If not, Phantom popup is closed. |
| Typing in overlay doesn't reach Phantom | Accessibility permission missing for Electron. See "First-run gotcha". |
| Unlock click doesn't unlock the wallet | Same — Accessibility permission. Also confirm overlay window covers Phantom exactly (`[Agent] ✓ Overlay shown: ... at ...`). |
| Overlay attaches to the wrong popup | Another small Chrome window (1Password, ChatGPT…) of similar size is competing. Run `/tmp/phantom_finder list` while Phantom is open to see what the agent sees. |
| `sync-server` errors with `EADDRINUSE: :3333` | Old instance lingering — `kill $(lsof -ti :3333)` and restart. |
| Cmd+Q dialog or focus jumps when clicking Unlock | Cursor briefly warps to the click target then warps back. If you see a stray glitch, file an issue with `tail /tmp/agent.log`. |
| `[Agent] Swift compile error` | Usually missing Xcode CLT. Install with `xcode-select --install`. |

## Useful commands

```bash
# Live agent log
tail -f /tmp/agent.log | strings

# Live server log
tail -f /tmp/server.log

# Check sync-server WS clients
lsof -i :3333

# Hard reset everything
pkill -f "dev:server|dev:agent|dev:desktop|electron-vite" 2>/dev/null
pkill -9 -f "Electron" 2>/dev/null
kill $(lsof -ti :3333) 2>/dev/null
rm -f /tmp/phantom_finder /tmp/phantom_finder.swift
```

## License & contact

License: see [LICENSE](./LICENSE) if present. Both repos public.

For demo / partnership inquiries, open an issue.
