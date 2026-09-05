import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { randomUUID } from "node:crypto";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const hmrPath = "/__vite_hmr";
  const hmrEnabled = process.env.ENABLE_VITE_HMR === "true";
  const hmrHost =
    typeof process.env.VITE_HMR_HOST === "string" && process.env.VITE_HMR_HOST.trim().length > 0
      ? process.env.VITE_HMR_HOST.trim()
      : undefined;
  const hmrPortRaw = Number.parseInt(String(process.env.VITE_HMR_PORT || ""), 10);
  const hmrPort = Number.isFinite(hmrPortRaw) && hmrPortRaw > 0 ? hmrPortRaw : 24678;
  const hmrProtocol =
    typeof process.env.VITE_HMR_PROTOCOL === "string" &&
    process.env.VITE_HMR_PROTOCOL.trim().length > 0
      ? process.env.VITE_HMR_PROTOCOL.trim()
      : undefined;

  // IMPORTANT:
  // Do not attach Vite HMR to the shared HTTP server. Socket.io uses websocket upgrades too,
  // and mixing multiple upgrade handlers is a common cause of:
  //   "server.handleUpgrade() was called more than once with the same socket"
  // Instead, run HMR on its own port and let the app server handle /socket.io exclusively.
  const serverOptions = {
    middlewareMode: true,
    hmr: hmrEnabled
      ? {
          host: hmrHost,
          port: hmrPort,
          clientPort: hmrPort,
          protocol: hmrProtocol,
          path: hmrPath,
        }
      : false,
    allowedHosts: true as const,
  };

  if (!hmrEnabled) {
    log("Vite HMR disabled (set ENABLE_VITE_HMR=true to opt in).", "vite");
  }

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        console.error("[VITE ERROR]", msg, options);
        viteLogger.error(msg, options);
        // Don't exit immediately in development - let dev see the error
        if (process.env.NODE_ENV === "production") {
          process.exit(1);
        }
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Only serve HTML for non-API, non-asset routes
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes - let them be handled by the API router
    if (url.startsWith("/api/")) {
      return next();
    }

    // Skip asset requests (they're handled by vite.middlewares)
    if (
      url.includes("/src/") ||
      url.includes("/node_modules/") ||
      url.match(/\.(js|css|json|wasm|map)$/i)
    ) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${randomUUID()}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      console.error("[VITE TRANSFORM ERROR]", e);
      console.error("[VITE TRANSFORM ERROR] Stack:", (e as Error).stack);
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
