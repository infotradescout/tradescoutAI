import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const buildId =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_REF ||
  `${Date.now()}`;

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" ? [runtimeErrorOverlay()] : []),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer())]
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
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }

          if (
            id.includes("/@tanstack/") ||
            id.includes("/wouter/") ||
            id.includes("/react-router/") ||
            id.includes("/react-router-dom/")
          ) {
            return "vendor-routing";
          }

          if (id.includes("/lucide-react/") || id.includes("/react-icons/")) {
            return "vendor-icons";
          }

          if (id.includes("/@radix-ui/") || id.includes("/cmdk/") || id.includes("/vaul/")) {
            return "vendor-ui";
          }

          if (
            id.includes("/recharts/") ||
            id.includes("/d3-") ||
            id.includes("/topojson-client/") ||
            id.includes("/us-atlas/")
          ) {
            return "vendor-analytics";
          }

          if (
            id.includes("/xlsx/") ||
            id.includes("/jszip/") ||
            id.includes("/html2canvas/") ||
            id.includes("/fabric/") ||
            id.includes("/jspdf/") ||
            id.includes("/pdfkit/") ||
            id.includes("/mammoth/")
          ) {
            return "vendor-docs";
          }

          if (id.includes("/@googlemaps/") || id.includes("/google-auth-library/")) {
            return "vendor-google";
          }

          if (
            id.includes("/framer-motion/") ||
            id.includes("/embla-carousel-react/") ||
            id.includes("/react-day-picker/") ||
            id.includes("/date-fns/")
          ) {
            return "vendor-interactions";
          }

          if (
            id.includes("/@uppy/") ||
            id.includes("/socket.io-client/") ||
            id.includes("/openai/") ||
            id.includes("/@anthropic-ai/") ||
            id.includes("/@google/generative-ai/")
          ) {
            return "vendor-integrations";
          }

          return "vendor-misc";
        },
      },
    },
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
