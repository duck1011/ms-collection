import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

// Use import.meta.dirname which is available in Node 21+ ESM
// Falls back to fileURLToPath for older Node versions
const dirname = typeof import.meta.dirname !== "undefined" 
  ? import.meta.dirname 
  : path.dirname(fileURLToPath(import.meta.url));

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const finalPort = Number.isNaN(port) || port <= 0 ? 5173 : port;

export default defineConfig({
  base: "/ms-collection/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      "@assets": path.resolve(dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(dirname),
  build: {
    outDir: path.resolve(dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        if (warning.code === "SOURCEMAP_ERROR") return;
        if (warning.code === "EMPTY_BUNDLE") return;
        warn(warning);
      },
    },
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: finalPort,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: {
      overlay: true,
      timeout: 60000,
    },
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    },
    fs: {
      strict: false,
      allow: [".."],
    },
  },
  preview: {
    port: finalPort,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});