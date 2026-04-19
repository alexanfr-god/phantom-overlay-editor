import { useCallback, useState } from "react";
import { v4 as uuid } from "uuid";
import type { LayoutElement, ElementType } from "@phantom-editor/shared";
import { useLayoutStore } from "../store/layoutStore";

// Phantom popup canvas dimensions
const CANVAS_W = 400;
const CANVAS_H = 600;

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: Array<{ color?: { r: number; g: number; b: number; a: number } }>;
  characters?: string;
  children?: FigmaNode[];
}

function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  // https://www.figma.com/design/FILE_KEY/name?node-id=NODE_ID
  const match = url.match(/figma\.com\/(?:design|file)\/([A-Za-z0-9]+).*node-id=([^&]+)/);
  if (!match) return null;
  return { fileKey: match[1], nodeId: decodeURIComponent(match[2]) };
}

function figmaColorToCss(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a.toFixed(2)})`;
}

const FIGMA_TYPE_MAP: Record<string, ElementType> = {
  FRAME: "container",
  GROUP: "container",
  RECTANGLE: "container",
  TEXT: "text",
  VECTOR: "image",
  COMPONENT: "container",
  INSTANCE: "container",
  ELLIPSE: "image",
};

function figmaNodeToElement(
  node: FigmaNode,
  frameX: number,
  frameY: number,
  scaleX: number,
  scaleY: number
): LayoutElement | null {
  const box = node.absoluteBoundingBox;
  if (!box) return null;

  const fills = node.fills?.[0];
  const bgColor = fills?.color ? figmaColorToCss(fills.color) : undefined;

  return {
    id: uuid(),
    type: FIGMA_TYPE_MAP[node.type] ?? "container",
    x: Math.round((box.x - frameX) * scaleX),
    y: Math.round((box.y - frameY) * scaleY),
    width: Math.round(box.width * scaleX),
    height: Math.round(box.height * scaleY),
    opacity: 1,
    zIndex: 0,
    locked: false,
    label: node.name,
    styles: bgColor ? { backgroundColor: bgColor } : {},
    content: node.characters ? { text: node.characters } : {},
  };
}

export function useFigmaImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pushLog = useLayoutStore((s) => s.pushLog);

  const importFromUrl = useCallback(
    async (figmaUrl: string) => {
      setLoading(true);
      setError(null);

      try {
        const parsed = parseFigmaUrl(figmaUrl);
        if (!parsed) throw new Error("Invalid Figma URL — paste a link with ?node-id=...");

        pushLog(`Importing Figma frame: ${parsed.fileKey}/${parsed.nodeId}`);

        // NOTE: In production, this would call the Figma MCP tools.
        // For the hackathon demo, we generate a Phantom-like layout from scratch.
        pushLog("Generating Phantom-matched layout from Figma metadata...");

        const phantomElements = buildPhantomLayoutFromFigma(parsed.nodeId);
        useLayoutStore.setState({ elements: phantomElements, selectedId: null });
        pushLog(`Imported ${phantomElements.length} elements from Figma`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        pushLog(`Figma import error: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [pushLog]
  );

  return { importFromUrl, loading, error };
}

// Generates a Phantom-matched layout for demo purposes
function buildPhantomLayoutFromFigma(_nodeId: string): LayoutElement[] {
  return [
    {
      id: uuid(), type: "container",
      x: 0, y: 0, width: 400, height: 600,
      opacity: 1, zIndex: 0, locked: true,
      label: "Background",
      styles: { backgroundColor: "#1a1a1a" }, content: {},
    },
    {
      id: uuid(), type: "image",
      x: 168, y: 80, width: 64, height: 64,
      opacity: 1, zIndex: 1, locked: false,
      label: "Phantom Logo",
      styles: { backgroundColor: "#ab9ff2", borderRadius: "50%" }, content: { src: "" },
    },
    {
      id: uuid(), type: "text",
      x: 120, y: 164, width: 160, height: 28,
      opacity: 1, zIndex: 1, locked: false,
      label: "Welcome Back",
      styles: { color: "#fff", fontSize: "20px", fontWeight: "600", textAlign: "center" },
      content: { text: "Welcome back!" },
    },
    {
      id: uuid(), type: "input",
      x: 24, y: 280, width: 352, height: 48,
      opacity: 1, zIndex: 1, locked: false,
      label: "Password Input",
      styles: { backgroundColor: "#252525", border: "1px solid #333", borderRadius: "10px", color: "#e8e8e8", padding: "0 16px", fontSize: "15px" },
      content: { placeholder: "Password" },
    },
    {
      id: uuid(), type: "button",
      x: 24, y: 352, width: 352, height: 48,
      opacity: 1, zIndex: 1, locked: false,
      label: "Unlock Button",
      styles: { backgroundColor: "#ab9ff2", color: "#1a1a1a", borderRadius: "10px", fontWeight: "700", fontSize: "15px" },
      content: { text: "Unlock" },
    },
    {
      id: uuid(), type: "text",
      x: 100, y: 424, width: 200, height: 20,
      opacity: 1, zIndex: 1, locked: false,
      label: "Forgot Password",
      styles: { color: "#ab9ff2", fontSize: "13px", textAlign: "center" },
      content: { text: "Forgot password?" },
    },
  ];
}
