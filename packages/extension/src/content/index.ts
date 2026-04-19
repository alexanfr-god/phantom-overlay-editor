/**
 * Phantom Overlay Editor — Content Script Entry
 *
 * SAFETY: Only activates on the exact Phantom extension origin.
 * Any other extension or page is completely ignored.
 */

const PHANTOM_EXTENSION_ID = "bfnaelmomeimhlpmgjnjophhpkkoljpa";
const PHANTOM_ORIGIN = `chrome-extension://${PHANTOM_EXTENSION_ID}`;

// ── Guard: exit immediately if not Phantom ──────────────
if (!location.href.startsWith(PHANTOM_ORIGIN)) {
  // Silently do nothing — this content script matched a broad pattern
  // but we double-check here for safety
} else {
  console.log(`[PhantomOverlay] Phantom detected at ${location.href}`);
  boot();
}

async function boot(): Promise<void> {
  // Dynamic imports to avoid loading React/WS until we know it's Phantom
  const [{ mountOverlay }, { connectWs }] = await Promise.all([
    import("./overlayMount"),
    import("../ws/wsClient"),
  ]);

  // Wait for Phantom's DOM to be ready
  if (document.readyState === "loading") {
    await new Promise<void>((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
  }

  // Mount overlay in Shadow DOM
  mountOverlay();

  // Connect WebSocket to local sync server
  connectWs();

  // Watchdog: re-mount if Phantom's SPA removes our host
  const observer = new MutationObserver(() => {
    if (!document.getElementById("phantom-overlay-editor-root")) {
      console.log("[PhantomOverlay] Host removed — remounting");
      mountOverlay();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: false,
  });

  console.log("[PhantomOverlay] ✓ Boot complete");
}
