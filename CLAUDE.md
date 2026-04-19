# Phantom Overlay Editor

Hackathon MVP: визуальный редактор UI кошелька Phantom с Chrome overlay.

## Architecture
- `packages/shared` — Zod schemas, shared types (`@phantom-editor/shared`)
- `packages/sync-server` — Node.js WebSocket broadcast server on `:3333`
- `packages/desktop` — Electron + React editor (electron-vite)
- `packages/agent` — macOS Electron agent: transparent always-on-top window that tracks Phantom popup position via osascript and renders overlay
- `packages/extension` — Chrome MV3 extension (legacy, optional)

## Development

```bash
# Start everything
npm run dev

# Individual
npm run dev:server    # WS server only
npm run dev:desktop   # Electron app only
npm run dev:agent     # macOS overlay agent (tracks Phantom window position)
npm run dev:ext       # Extension watch build (optional)

# Install all deps
npm install
```

## Key conventions
- All positions in pixels relative to 400×600 Phantom canvas
- Element IDs are UUIDs
- Never send `layout:push` with empty elements[]
- All WS messages must pass `WsMessageSchema.parse()` — never send raw objects
- Shadow DOM root ID: `phantom-overlay-editor-root`
- Phantom extension ID: `bfnaelmomeimhlpmgjnjophhpkkoljpa`

## Extension loading
After `npm run dev:ext`:
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `packages/extension/dist`
4. Open Phantom popup → overlay appears

---

## Skills

### /debug-overlay
Inspect live overlay state and WebSocket connectivity.

**Steps:**
1. Check sync server: `lsof -i :3333`
   - Not running? → `npm run dev:server`
2. Check WS client count in server logs: look for "client connected" lines
3. In Chrome DevTools on Phantom popup:
   ```js
   document.querySelector('#phantom-overlay-editor-root')?.shadowRoot
   // null = content script didn't mount (check extension is enabled + URL matches Phantom)
   ```
4. Check overlay element count:
   ```js
   document.querySelector('#phantom-overlay-editor-root')
     ?.shadowRoot?.querySelectorAll('[data-overlay-element]').length
   ```
5. Check overlay state:
   ```js
   window.__overlayState
   // { layout, enabled, opacity, lastUpdated }
   ```
6. Send debug ping from desktop DevTools:
   ```js
   window.__layoutStore.getState()  // verify elements are there
   ```
7. Report: server running ✓/✗, WS clients count, overlay element count, lastUpdated timestamp

---

### /sync-layout
Push current layout from desktop to extension overlay.

**Steps:**
1. Verify elements exist:
   ```js
   // In desktop DevTools:
   window.__layoutStore.getState().elements.length
   ```
2. If 0 — add elements first in the UI, then re-run
3. Build and send layout document:
   ```js
   const store = window.__layoutStore.getState();
   const doc = {
     version: "1",
     timestamp: Date.now(),
     elements: store.elements
   };
   // This is what the Apply button does — click it in the UI
   // Or programmatically via ws (requires wsRef access)
   ```
4. Watch sync server terminal for: `→ broadcast: layout:push`
5. Verify in Phantom DevTools:
   ```js
   document.querySelector('#phantom-overlay-editor-root')
     ?.shadowRoot?.querySelectorAll('[data-overlay-element]').length
   // Should match elements count
   ```
6. Report: elements sent count, elements rendered count, any Zod errors

---

### /add-element
Add a new overlay element from command line.

**Usage:** `/add-element button` or `/add-element text`

**Supported types:** `button`, `input`, `text`, `image`, `container`

**Steps:**
1. Parse element type from args (default: `button`)
2. Validate type is one of the 5 supported types
3. In desktop DevTools:
   ```js
   window.__layoutStore.getState().addElement('button') // replace type
   ```
4. Element appears at center of canvas (200, 300) with defaults
5. Element is auto-selected — controls panel shows it
6. Optional: auto-sync:
   ```js
   const s = window.__layoutStore.getState();
   // click Apply button or call send() if wsRef is accessible
   ```
7. Report: element ID created, type, position

---

### /check-phantom
Verify Phantom detection is working correctly.

**Steps:**
1. Check Phantom is installed in Chrome: `chrome://extensions` → find "Phantom"
2. Note Phantom's extension ID (should be `bfnaelmomeimhlpmgjnjophhpkkoljpa`)
3. If different ID (dev build of Phantom):
   - Update `packages/extension/manifest.json` → `host_permissions`
   - Update `packages/extension/src/content/index.ts` → `PHANTOM_ORIGIN`
   - Rebuild: `npm run dev:ext`
4. Open Phantom popup → check URL starts with `chrome-extension://bfnaelmomeimhlpmgjnjophhpkkoljpa`
5. Open DevTools on the popup page (right-click → Inspect)
6. Check console for: `[PhantomOverlay] Phantom detected, initializing overlay...`
7. If missing: extension content script not injecting → reload extension

---

## WebSocket Message Reference

```typescript
// Desktop → Server → Extension
{ type: "layout:push", payload: { version: "1", timestamp: number, elements: [] } }
{ type: "overlay:toggle", enabled: boolean }
{ type: "overlay:opacity", value: number }  // 0-1
{ type: "debug:ping" }

// Extension → Server → Desktop
// (extensions are subscribers only, they don't send layout)

// Server → Sender
{ type: "layout:ack", clientId: string, timestamp: number }
{ type: "debug:pong", serverTime: number, clientCount: number }

// Both → Server (on connect)
{ type: "client:hello", role: "desktop" | "extension", clientId: string }
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Apply button grey | Sync server not running — `npm run dev:server` |
| Overlay not appearing | Extension not loaded or wrong Phantom ID — run `/check-phantom` |
| WS reconnect loop | Server crashed — check terminal for errors |
| Figma import fails | Figma MCP tools need valid URL with `?node-id=` param |
| DnD not working | Element is locked — click 🔒 in right panel to unlock |
