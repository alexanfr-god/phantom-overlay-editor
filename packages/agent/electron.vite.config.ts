import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@phantom-editor/shared"] })],
    resolve: {
      alias: {
        "@phantom-editor/shared": resolve("../shared/src/index.ts"),
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve("electron/main.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ["@phantom-editor/shared"] })],
    build: {
      rollupOptions: {
        input: { index: resolve("electron/preload.ts") },
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@phantom-editor/shared": resolve("../shared/src/index.ts"),
      },
    },
    root: resolve("src"),
    build: {
      outDir: resolve("out/renderer"),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve("src/index.html"),
      },
    },
  },
});
