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

function getNodeModulePath(id: string): string | null {
  const normalized = id.replace(/\\/g, "/");
  const nodeModulesIndex = normalized.lastIndexOf("/node_modules/");
  if (nodeModulesIndex === -1) {
    return null;
  }

  return normalized.slice(nodeModulesIndex + "/node_modules/".length);
}

function getPackageChunkName(id: string): string | undefined {
  const modulePath = getNodeModulePath(id);
  if (!modulePath) {
    return undefined;
  }

  const packageName = modulePath.startsWith("@")
    ? modulePath.split("/", 2).join("/")
    : modulePath.split("/", 1)[0];

  const chunkByPackage: Record<string, string> = {
    react: "vendor-react",
    "react-dom": "vendor-react",
    scheduler: "vendor-react",
    recharts: "vendor-recharts",
    "d3-array": "vendor-d3",
    "d3-color": "vendor-d3",
    "d3-ease": "vendor-d3",
    "d3-format": "vendor-d3",
    "d3-interpolate": "vendor-d3",
    "d3-path": "vendor-d3",
    "d3-scale": "vendor-d3",
    "d3-shape": "vendor-d3",
    "d3-time": "vendor-d3",
    "d3-time-format": "vendor-d3",
    "d3-timer": "vendor-d3",
    "d3-geo": "vendor-d3-geo",
    "topojson-client": "vendor-topojson",
    xlsx: "vendor-xlsx",
    jszip: "vendor-jszip",
    html2canvas: "vendor-html2canvas",
    fabric: "vendor-fabric",
    jspdf: "vendor-jspdf",
    pdfkit: "vendor-pdfkit",
    mammoth: "vendor-mammoth",
    "@googlemaps/markerclusterer": "vendor-googlemaps",
  };

  return chunkByPackage[packageName];
}

export default defineConfig({
  base: "/",
  experimental: {
    // Vite otherwise stores preload dependencies as "assets/<file>" and
    // prepends the base only at runtime. Static JavaScript crawlers can resolve
    // those raw strings relative to the entry chunk as "/assets/assets/<file>".
    renderBuiltUrl(filename) {
      return `/${filename.replace(/^\/+/, "")}`;
    },
  },
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
      input: {
        app: path.resolve(__dirname, "client", "index.html"),
        landing: path.resolve(__dirname, "client", "landing.html"),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          return getPackageChunkName(id);
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
