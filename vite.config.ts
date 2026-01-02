import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      react: path.resolve(__dirname, "node_modules", "react"),
      "react-dom": path.resolve(__dirname, "node_modules", "react-dom"),
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
    // Ensure Vite never loads a second React copy, even via symlinks.
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client", "public"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
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
        path.resolve(__dirname, "server", "cache", "**"),
        path.resolve(__dirname, "server", "logs"),
        path.resolve(__dirname, "data", "**"),
        path.resolve(__dirname, "dist", "**"),
        // Workspace-level artifacts
        path.resolve(__dirname, "validation-results-*.json"),
        path.resolve(__dirname, "test-results", "**"),
        path.resolve(__dirname, "response.json"),
        path.resolve(__dirname, "test.json"),
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
