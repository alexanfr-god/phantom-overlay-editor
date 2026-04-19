import React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { LayoutElement } from "@phantom-editor/shared";
import { useLayoutStore } from "../../store/layoutStore";

interface Props {
  element: LayoutElement;
  isSelected: boolean;
  showBounds: boolean;
}

export function OverlayElement({ element, isSelected, showBounds }: Props) {
  const selectElement = useLayoutStore((s) => s.selectElement);
  const toggleSelect = useLayoutStore((s) => s.toggleSelect);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const groups = useLayoutStore((s) => s.groups);
  const inGroup = Object.values(groups).some((g) => g.includes(element.id));
  const isMultiSelected = selectedIds.includes(element.id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: element.id,
    disabled: element.locked,
  });

  // Large full-screen elements like "background" get subtler outlines
  const isFullSize = element.width >= 400 && element.height >= 400;

  const style: React.CSSProperties = {
    position: "absolute",
    left: element.x + (transform?.x ?? 0),
    top: element.y + (transform?.y ?? 0),
    width: element.width,
    height: element.height,
    opacity: isDragging ? 0.7 : element.opacity,
    zIndex: element.zIndex + 10,
    cursor: element.locked ? "default" : isDragging ? "grabbing" : "grab",
    outline: isSelected
      ? "2px solid #ab9ff2"
      : isMultiSelected
        ? "2px solid rgba(171,159,242,0.5)"
        : isFullSize
          ? "none"
          : "1px solid rgba(171,159,242,0.4)",
    outlineOffset: 1,
    userSelect: "none",
    boxShadow: isSelected && !isFullSize
      ? "0 0 12px rgba(171,159,242,0.3)"
      : isFullSize
        ? "none"
        : "0 2px 8px rgba(0,0,0,0.3)",
    borderRadius: element.styles.borderRadius ?? "0px",
    overflow: "hidden",
    ...element.styles,
  } as React.CSSProperties;

  // Always override position so element.styles can't move the element
  style.position = "absolute";
  style.left = element.x + (transform?.x ?? 0);
  style.top = element.y + (transform?.y ?? 0);
  style.width = element.width;
  style.height = element.height;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      toggleSelect(element.id);
    } else {
      selectElement(element.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      {...listeners}
      {...attributes}
    >
      {/* Group badge */}
      {inGroup && (
        <div style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 14,
          height: 14,
          background: "rgba(171,159,242,0.7)",
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          color: "#111",
          fontWeight: 700,
          zIndex: 99,
        }}>
          G
        </div>
      )}

      {/* Lock badge */}
      {element.locked && (
        <div style={{
          position: "absolute",
          top: 2,
          right: 2,
          width: 14,
          height: 14,
          background: "rgba(0,0,0,0.7)",
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          zIndex: 99,
        }}>
          🔒
        </div>
      )}

      {/* Content rendering */}
      <ElementContent element={element} />

      {/* Floating label (always visible) */}
      {isSelected && (
        <div style={{
          position: "absolute",
          bottom: -18,
          left: 0,
          fontSize: 9,
          color: "#ab9ff2",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          lineHeight: 1,
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        }}>
          {element.label ?? element.type} · {Math.round(element.x)},{Math.round(element.y)} · {element.width}×{element.height}
        </div>
      )}
    </div>
  );
}

function ElementContent({ element }: { element: LayoutElement }) {
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: element.styles.fontSize ?? "14px",
    fontWeight: element.styles.fontWeight ?? "normal",
    color: element.styles.color ?? "#e8e8e8",
    padding: element.styles.padding ?? "0",
    textAlign: (element.styles.textAlign as React.CSSProperties["textAlign"]) ?? "center",
    letterSpacing: element.styles.letterSpacing ?? "normal",
    pointerEvents: "none",
    overflow: "hidden",
  };

  switch (element.type) {
    case "button":
      return (
        <div style={style}>
          {String(element.content.text ?? "Button")}
        </div>
      );
    case "text":
      return (
        <div style={style}>
          {String(element.content.text ?? "Text")}
        </div>
      );
    case "input":
      return (
        <input
          type="password"
          placeholder={String(element.content.placeholder ?? "Password")}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            color: element.styles.color ?? "#e8e8e8",
            fontSize: element.styles.fontSize ?? "15px",
            fontWeight: element.styles.fontWeight ?? "normal",
            fontFamily: "inherit",
            padding: element.styles.padding ?? "0 16px",
            boxSizing: "border-box",
            pointerEvents: "auto",
            caretColor: "#ab9ff2",
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      );
    case "image":
      return element.content.src ? (
        <img
          src={String(element.content.src)}
          alt={element.label ?? "image"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: (element.styles.objectFit as React.CSSProperties["objectFit"]) ?? "cover",
            borderRadius: "inherit",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div style={{ ...style, color: "#555", fontSize: 11, flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 24, opacity: 0.5 }}>🖼</span>
          <span>IMG</span>
        </div>
      );
    case "container":
    default:
      return null;
  }
}
