import { resolve } from "path";
import fs from "fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Plugin: copy manifest.json to dist after build
function copyManifest(): Plugin {
  return {
    name: "copy-manifest",
    closeBundle() {
      fs.copyFileSync(
        resolve(__dirname, "manifest.json"),
        resolve(__dirname, "dist/manifest.json")
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifest()],
  resolve: {
    alias: {
      "@phantom-editor/shared": resolve("../shared/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        "content/index": resolve(__dirname, "src/content/index.ts"),
        "background/service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
        format: "esm",
      },
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
