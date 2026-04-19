import { useEffect } from "react";
import { useLayoutStore } from "../store/layoutStore";

/**
 * Global keyboard shortcuts for the overlay editor.
 *
 * - Delete / Backspace  → remove selected element
 * - Ctrl+D / Cmd+D      → duplicate selected element
 * - Escape              → deselect
 * - Arrow keys          → nudge selected element by 1px (Shift = 10px)
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input / textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const store = useLayoutStore.getState();
      const { selectedId } = store;

      switch (e.key) {
        case "Delete":
        case "Backspace": {
          if (selectedId) {
            e.preventDefault();
            store.removeElement(selectedId);
          }
          break;
        }

        case "Escape": {
          store.selectElement(null);
          break;
        }

        case "d": {
          if ((e.metaKey || e.ctrlKey) && selectedId) {
            e.preventDefault();
            store.duplicateElement(selectedId);
          }
          break;
        }

        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          if (!selectedId) break;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const el = store.elements.find((el) => el.id === selectedId);
          if (!el || el.locked) break;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          store.moveElement(selectedId, dx, dy);
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
