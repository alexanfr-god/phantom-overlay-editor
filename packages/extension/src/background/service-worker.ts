// MV3 Service Worker
// Minimal — WS connection is managed in content script (not background)
// because service workers have limited WebSocket support in MV3

chrome.runtime.onInstalled.addListener(() => {
  console.log("[PhantomOverlay] Extension installed");
});

// Keep-alive ping to prevent SW from being killed during active editing sessions
chrome.alarms.create("keepalive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepalive") {
    // noop — just keeps the service worker alive
  }
});

export {};
