import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { OverlayElement } from "./OverlayElement";
import { useLayoutStore } from "../../store/layoutStore";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

export function OverlayCanvas() {
  useKeyboardShortcuts();

  const elements = useLayoutStore((s) => s.elements);
  const selectedId = useLayoutStore((s) => s.selectedId);
  const debug = useLayoutStore((s) => s.debug);
  const canvas = useLayoutStore((s) => s.canvas);
  const selectElement = useLayoutStore((s) => s.selectElement);
  const moveElement = useLayoutStore((s) => s.moveElement);

  const CANVAS_W = canvas.width;
  const CANVAS_H = canvas.height;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [refImage, setRefImage] = useState<string | null>(null);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 4 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (delta.x !== 0 || delta.y !== 0) {
      moveElement(String(active.id), delta.x / zoom, delta.y / zoom);
    }
  };

  // ── Zoom ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ── Pan ─────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  // ── Load reference image via file picker ────────────────────────────────
  const loadRefImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setRefImage(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = ""; // reset so same file can be picked again
  }, []);

  // ── Drop reference image ────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setRefImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        cursor: isPanning ? "grabbing" : "default",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Top toolbar */}
      <div style={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(30,30,30,0.95)",
        borderRadius: 8,
        padding: "4px 10px",
        zIndex: 100,
        border: "1px solid #333",
      }}>
        <button onClick={loadRefImage} style={toolBtnStyle}>
          {refImage ? "Change Reference" : "Load Reference Image"}
        </button>
        {refImage && (
          <button onClick={() => setRefImage(null)} style={{ ...toolBtnStyle, color: "#f87171" }}>
            Clear
          </button>
        )}
      </div>

      {/* Zoom controls */}
      <div style={{
        position: "absolute",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(30,30,30,0.95)",
        borderRadius: 8,
        padding: "4px 12px",
        zIndex: 100,
        border: "1px solid #333",
      }}>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.1))} style={zoomBtnStyle}>−</button>
        <span style={{ color: "#aaa", fontSize: 11, minWidth: 40, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.1))} style={zoomBtnStyle}>+</button>
        <div style={{ width: 1, height: 16, backgroundColor: "#333" }} />
        <button onClick={resetView} style={zoomBtnStyle}>Reset</button>
      </div>

      {/* Transformed canvas */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: "center center",
        transition: isPanning ? "none" : "transform 0.1s ease-out",
      }}>
        {/* Canvas frame */}
        <div
          style={{
            position: "relative",
            width: CANVAS_W,
            height: CANVAS_H,
            boxShadow: "0 0 0 1px #444, 0 24px 80px rgba(0,0,0,0.6)",
            borderRadius: 0,
            overflow: "hidden",
            backgroundColor: "#111111",
            backgroundImage:
              "linear-gradient(45deg, #161616 25%, transparent 25%, transparent 75%, #161616 75%), " +
              "linear-gradient(45deg, #161616 25%, transparent 25%, transparent 75%, #161616 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 8px 8px",
          }}
        >
          {/* Reference image */}
          {refImage && (
            <img
              src={refImage}
              alt="Reference"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
                opacity: 0.5,
              }}
            />
          )}

          {/* Overlay elements */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: debug.overlayEnabled ? debug.overlayOpacity : 0,
              transition: "opacity 0.2s",
              pointerEvents: debug.overlayEnabled ? "auto" : "none",
            }}
            onClick={() => selectElement(null)}
          >
            <DndContext
              sensors={sensors}
              modifiers={[restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              {sortedElements.map((el) => (
                <OverlayElement
                  key={el.id}
                  element={el}
                  isSelected={el.id === selectedId}
                  showBounds={debug.showBoundingBoxes}
                />
              ))}
            </DndContext>
          </div>
        </div>

        {/* Canvas label */}
        <div style={{
          position: "absolute",
          top: -24,
          left: 0,
          color: "#555",
          fontSize: 11,
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}>
          {CANVAS_W} × {CANVAS_H}
        </div>

        {/* WS status */}
        <div style={{
          position: "absolute",
          top: -24,
          right: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: debug.wsConnected ? "#4ade80" : "#f87171",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            backgroundColor: debug.wsConnected ? "#4ade80" : "#f87171",
          }} />
          {debug.wsConnected ? "connected" : "disconnected"}
        </div>
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#aaa",
  fontSize: 16,
  cursor: "pointer",
  padding: "2px 6px",
  borderRadius: 4,
  lineHeight: 1,
};

const toolBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #444",
  color: "#ccc",
  fontSize: 11,
  cursor: "pointer",
  padding: "3px 10px",
  borderRadius: 5,
};
