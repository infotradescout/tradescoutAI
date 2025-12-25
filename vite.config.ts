import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      // Force all React imports (including from linked deps) to resolve
      // to the single root instance used by the app.
      react: path.resolve(import.meta.dirname, "node_modules", "react"),
      "react-dom": path.resolve(import.meta.dirname, "node_modules", "react-dom"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    // Ensure Vite never loads a second React copy, even via symlinks.
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Reduce dev reload noise by ignoring non-client file writes
    watch: {
      ignored: [
        // Absolute dirs outside the Vite root that can change frequently
        path.resolve(import.meta.dirname, "server", "cache", "**"),
        path.resolve(import.meta.dirname, "server", "logs"),
        path.resolve(import.meta.dirname, "data", "**"),
        path.resolve(import.meta.dirname, "dist", "**"),
        // Workspace-level artifacts
        path.resolve(import.meta.dirname, "validation-results-*.json"),
        path.resolve(import.meta.dirname, "test-results", "**"),
        path.resolve(import.meta.dirname, "response.json"),
        path.resolve(import.meta.dirname, "test.json"),
      ],
    },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
