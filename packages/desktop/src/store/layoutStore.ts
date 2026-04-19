import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { v4 as uuid } from "uuid";
import {
  type LayoutElement,
  type ElementType,
  type PhantomScreen,
  type AnchorId,
  DEFAULT_ELEMENT_SIZES,
  PHANTOM_SCREENS,
  getScreenAnchors,
  getAnchorById,
} from "@phantom-editor/shared";

interface DebugState {
  showBoundingBoxes: boolean;
  overlayEnabled: boolean;
  overlayOpacity: number; // 0–1
  wsConnected: boolean;
  lastSyncAt: number | null;
  log: string[];
}

interface CanvasSize {
  width: number;
  height: number;
  locked: boolean;
}

interface LayoutStore {
  elements: LayoutElement[];
  selectedId: string | null;
  selectedIds: string[]; // multi-select for grouping
  activeScreen: PhantomScreen;
  groups: Record<string, string[]>; // groupId -> elementIds
  canvas: CanvasSize;
  debug: DebugState;

  // Canvas
  setCanvasSize: (width: number, height: number) => void;
  lockCanvas: (locked: boolean) => void;

  // Screen
  setScreen: (screen: PhantomScreen) => void;

  // Element actions
  addElement: (type: ElementType) => void;
  addFromAnchor: (anchorId: AnchorId) => void;
  loadScreen: () => void; // add ALL anchors for current screen at once
  updateElement: (id: string, patch: Partial<LayoutElement>) => void;
  moveElement: (id: string, dx: number, dy: number) => void;
  removeElement: (id: string) => void;
  removeAllElements: () => void;
  duplicateElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  toggleSelect: (id: string) => void; // Shift+click multi-select
  toggleLock: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // Group actions
  groupSelected: () => void;
  ungroupSelected: () => void;

  // Project save/load
  getProjectData: () => string;
  loadProjectData: (json: string) => void;

  // Debug actions
  setDebug: (patch: Partial<DebugState>) => void;
  pushLog: (msg: string) => void;
  clearLog: () => void;
}

export const useLayoutStore = create<LayoutStore>()(
  immer((set) => ({
    elements: [],
    selectedId: null,
    selectedIds: [],
    activeScreen: "password" as PhantomScreen,
    groups: {},
    canvas: { width: 400, height: 600, locked: false },
    debug: {
      showBoundingBoxes: false,
      overlayEnabled: true,
      overlayOpacity: 1,
      wsConnected: false,
      lastSyncAt: null,
      log: [],
    },

    setCanvasSize: (width, height) =>
      set((s) => {
        if (s.canvas.locked) return;
        const newW = Math.max(100, Math.round(width));
        const newH = Math.max(100, Math.round(height));
        const scaleX = newW / s.canvas.width;
        const scaleY = newH / s.canvas.height;

        // Scale all elements proportionally
        for (const el of s.elements) {
          el.x = Math.round(el.x * scaleX);
          el.y = Math.round(el.y * scaleY);
          el.width = Math.round(el.width * scaleX);
          el.height = Math.round(el.height * scaleY);
        }

        s.canvas.width = newW;
        s.canvas.height = newH;
      }),

    lockCanvas: (locked) =>
      set((s) => {
        s.canvas.locked = locked;
      }),

    setScreen: (screen) =>
      set((s) => {
        s.activeScreen = screen;
      }),

    addElement: (type) =>
      set((s) => {
        const size = DEFAULT_ELEMENT_SIZES[type];
        const el: LayoutElement = {
          id: uuid(),
          type,
          x: Math.round(s.canvas.width / 2 - size.width / 2),
          y: Math.round(s.canvas.height / 2 - size.height / 2),
          width: size.width,
          height: size.height,
          opacity: 1,
          zIndex: s.elements.length,
          locked: false,
          styles: getDefaultStyles(type),
          content: getDefaultContent(type),
          screen: s.activeScreen,
        };
        s.elements.push(el);
        s.selectedId = el.id;
      }),

    addFromAnchor: (anchorId) =>
      set((s) => {
        const anchor = getAnchorById(s.activeScreen, anchorId);
        if (!anchor) return;
        // Don't add duplicates for same anchor+screen
        const exists = s.elements.some(
          (e) => e.anchor === anchorId && e.screen === s.activeScreen
        );
        if (exists) return;

        const el: LayoutElement = {
          id: uuid(),
          type: anchor.type,
          x: anchor.x,
          y: anchor.y,
          width: anchor.width,
          height: anchor.height,
          opacity: 1,
          zIndex: s.elements.length,
          locked: false,
          styles: anchor.styles ?? getDefaultStyles(anchor.type),
          content: anchor.content ?? getDefaultContent(anchor.type),
          label: anchor.label,
          anchor: anchorId,
          screen: s.activeScreen,
        };
        s.elements.push(el);
        s.selectedId = el.id;
      }),

    loadScreen: () =>
      set((s) => {
        const anchors = getScreenAnchors(s.activeScreen);
        // Clear existing elements for this screen
        s.elements = s.elements.filter((e) => e.screen !== s.activeScreen);
        // Add all anchors
        for (const anchor of anchors) {
          const el: LayoutElement = {
            id: uuid(),
            type: anchor.type,
            x: anchor.x,
            y: anchor.y,
            width: anchor.width,
            height: anchor.height,
            opacity: 1,
            zIndex: s.elements.length,
            locked: false,
            styles: anchor.styles ?? getDefaultStyles(anchor.type),
            content: anchor.content ?? getDefaultContent(anchor.type),
            label: anchor.label,
            anchor: anchor.id,
            screen: s.activeScreen,
          };
          s.elements.push(el);
        }
        s.selectedId = null;
      }),

    updateElement: (id, patch) =>
      set((s) => {
        const idx = s.elements.findIndex((e) => e.id === id);
        if (idx === -1) return;
        Object.assign(s.elements[idx], patch);
      }),

    moveElement: (id, dx, dy) =>
      set((s) => {
        const el = s.elements.find((e) => e.id === id);
        if (!el || el.locked) return;

        // Find group — move all grouped elements together
        const groupId = Object.keys(s.groups).find((g) => s.groups[g].includes(id));
        const idsToMove = groupId ? s.groups[groupId] : [id];

        for (const eid of idsToMove) {
          const target = s.elements.find((e) => e.id === eid);
          if (!target || target.locked) continue;
          target.x = Math.round(Math.max(0, Math.min(s.canvas.width - target.width, target.x + dx)));
          target.y = Math.round(Math.max(0, Math.min(s.canvas.height - target.height, target.y + dy)));
        }
      }),

    removeElement: (id) =>
      set((s) => {
        s.elements = s.elements.filter((e) => e.id !== id);
        if (s.selectedId === id) s.selectedId = null;
      }),

    removeAllElements: () =>
      set((s) => {
        s.elements = [];
        s.selectedId = null;
        s.selectedIds = [];
        s.groups = {};
      }),

    duplicateElement: (id) =>
      set((s) => {
        const el = s.elements.find((e) => e.id === id);
        if (!el) return;
        const copy: LayoutElement = {
          ...JSON.parse(JSON.stringify(el)),
          id: uuid(),
          x: el.x + 16,
          y: el.y + 16,
          zIndex: s.elements.length,
        };
        s.elements.push(copy);
        s.selectedId = copy.id;
      }),

    selectElement: (id) =>
      set((s) => {
        s.selectedId = id;
        s.selectedIds = id ? [id] : [];
      }),

    toggleSelect: (id) =>
      set((s) => {
        const idx = s.selectedIds.indexOf(id);
        if (idx === -1) {
          s.selectedIds.push(id);
        } else {
          s.selectedIds.splice(idx, 1);
        }
        s.selectedId = s.selectedIds[s.selectedIds.length - 1] ?? null;
      }),

    toggleLock: (id) =>
      set((s) => {
        const el = s.elements.find((e) => e.id === id);
        if (el) el.locked = !el.locked;
      }),

    bringForward: (id) =>
      set((s) => {
        const el = s.elements.find((e) => e.id === id);
        if (el) el.zIndex += 1;
      }),

    sendBackward: (id) =>
      set((s) => {
        const el = s.elements.find((e) => e.id === id);
        if (el) el.zIndex = Math.max(0, el.zIndex - 1);
      }),

    groupSelected: () =>
      set((s) => {
        if (s.selectedIds.length < 2) return;
        const gid = uuid();
        s.groups[gid] = [...s.selectedIds];
      }),

    ungroupSelected: () =>
      set((s) => {
        if (!s.selectedId) return;
        const gid = Object.keys(s.groups).find((g) => s.groups[g].includes(s.selectedId!));
        if (gid) delete s.groups[gid];
      }),

    getProjectData: () => {
      const s = useLayoutStore.getState();
      return JSON.stringify({
        elements: s.elements,
        activeScreen: s.activeScreen,
        groups: s.groups,
        canvas: s.canvas,
      }, null, 2);
    },

    loadProjectData: (json) =>
      set((s) => {
        try {
          const data = JSON.parse(json);
          if (data.elements) s.elements = data.elements;
          if (data.activeScreen) s.activeScreen = data.activeScreen;
          if (data.groups) s.groups = data.groups;
          if (data.canvas) {
            s.canvas.width = data.canvas.width ?? 400;
            s.canvas.height = data.canvas.height ?? 600;
            s.canvas.locked = data.canvas.locked ?? false;
          }
          s.selectedId = null;
          s.selectedIds = [];
        } catch (e) {
          console.error("[Store] Failed to load project:", e);
        }
      }),

    setDebug: (patch) =>
      set((s) => {
        Object.assign(s.debug, patch);
      }),

    pushLog: (msg) =>
      set((s) => {
        const ts = new Date().toTimeString().slice(0, 8);
        s.debug.log.unshift(`[${ts}] ${msg}`);
        if (s.debug.log.length > 100) s.debug.log.pop();
      }),

    clearLog: () =>
      set((s) => {
        s.debug.log = [];
      }),
  }))
);

// Expose store globally for /sync-layout and /debug-overlay skills
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__layoutStore = useLayoutStore;
}

function getDefaultStyles(type: ElementType): Record<string, string> {
  switch (type) {
    case "button":
      return {
        backgroundColor: "#ab9ff2",
        color: "#1a1a1a",
        borderRadius: "8px",
        fontWeight: "600",
        fontSize: "14px",
      };
    case "input":
      return {
        backgroundColor: "#2a2a2a",
        color: "#e8e8e8",
        border: "1px solid #444",
        borderRadius: "8px",
        padding: "0 12px",
        fontSize: "14px",
      };
    case "text":
      return {
        color: "#e8e8e8",
        fontSize: "14px",
      };
    case "container":
      return {
        backgroundColor: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: "12px",
      };
    case "image":
      return {
        backgroundColor: "#333",
        borderRadius: "8px",
        objectFit: "cover",
      };
  }
}

function getDefaultContent(type: ElementType): Record<string, unknown> {
  switch (type) {
    case "button":
      return { text: "Button" };
    case "input":
      return { placeholder: "Enter text..." };
    case "text":
      return { text: "Text" };
    default:
      return {};
  }
}
