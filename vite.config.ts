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
    xlsx: "vendor-xlsx",
    jszip: "vendor-jszip",
    html2canvas: "vendor-html2canvas",
    fabric: "vendor-fabric",
    pdfkit: "vendor-pdfkit",
    mammoth: "vendor-mammoth",
  };

  return chunkByPackage[packageName];
}

export default defineConfig({
  base: "/",
  experimental: {
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
      react: path.resolve(__dirname, "node_modules", "react"),
      "react-dom": path.resolve(__dirname, "node_modules", "react-dom"),
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
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
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.endsWith("/steel-home-project-tools/BuildingThreePreview.tsx")) {
            return "steel-building-preview";
          }
          if (normalizedId.endsWith("/steel-home-project-tools/CabinetMeasuredEditor.tsx")) {
            return "steel-cabinet-measured-editor";
          }
          if (normalizedId.endsWith("/steel-home-project-tools/KitchenWorkspacePanel.tsx")) {
            return "steel-kitchen-workspace-panel";
          }
          if (normalizedId.endsWith("/steel-home-project-tools/MeasuredCountertopDesigner.tsx")) {
            return "steel-countertop-measured-editor";
          }
          if (normalizedId.endsWith("/steel-home-project-tools/cabinetCasework.ts")) {
            return "cabinet-casework";
          }
          if (normalizedId.endsWith("/steel-home-project-tools/countertopStudioShare.ts")) {
            return "countertop-plan-sharing";
          }
          if (
            normalizedId.endsWith("/steel-home-project-tools/stoneProjectionSafety.ts") ||
            normalizedId.endsWith("/shared/jwStonePublicMedia.ts") ||
            normalizedId.endsWith("/scripts/data/jw-stone-public-media-manifest.json")
          ) {
            return "stone-projection-policy";
          }
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
    watch: {
      ignored: [
        path.resolve(__dirname, "server", "cache", "**"),
        path.resolve(__dirname, "server", "logs"),
        path.resolve(__dirname, "data", "**"),
        path.resolve(__dirname, "dist", "**"),
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
        ws: true,
        secure: false,
      },
    },
  },
});