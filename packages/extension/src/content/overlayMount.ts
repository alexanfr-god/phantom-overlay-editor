import React from "react";
import { createRoot } from "react-dom/client";
import { OverlayApp } from "./OverlayApp";

const HOST_ID = "phantom-overlay-editor-root";

export function mountOverlay(): void {
  // Idempotent — never double-mount
  if (document.getElementById(HOST_ID)) {
    console.log("[PhantomOverlay] Already mounted, skipping");
    return;
  }

  // Host element — sits outside Shadow DOM for positioning
  const host = document.createElement("div");
  host.id = HOST_ID;
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2147483646",
    pointerEvents: "none",
    // Invisible to layout
    margin: "0",
    padding: "0",
    border: "none",
    background: "none",
  });
  document.documentElement.appendChild(host); // append to <html>, not <body>

  // Shadow DOM — CSS isolation from Phantom's styles
  const shadow = host.attachShadow({ mode: "open" });

  // Reset styles inside shadow
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; display: block; }
    *, *::before, *::after { box-sizing: border-box; }
  `;
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  mountPoint.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(React.createElement(OverlayApp));

  console.log("[PhantomOverlay] ✓ Overlay mounted in shadow DOM");
}
