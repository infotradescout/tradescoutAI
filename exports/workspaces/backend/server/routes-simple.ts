import type { Express } from "express";
import { createServer, type Server } from "http";

const simpleRoutesAllowed =
  process.env.NODE_ENV === "test" && process.env.ALLOW_SIMPLE_ROUTES === "true";

if (!simpleRoutesAllowed) {
  throw new Error(
    "server/routes-simple.ts is disabled. Use server/routes.ts (full routes) for all non-test runtime."
  );
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Basic API endpoints for the simple frontend
  app.get("/api/auth/user", (req, res) => {
    // Fail-soft auth shape for guest-first UX
    res.status(200).json({ authenticated: false });
  });

  app.get("/api/contractors", (req, res) => {
    // Return empty array for now
    res.json([]);
  });

  app.get("/api/daily-deals", (req, res) => {
    // Return empty array for now
    res.json([]);
  });

  // Basic contractor data for the landing page
  app.get("/api/stats", (req, res) => {
    res.json({
      totalContractors: 28500,
      totalUsers: 125000,
      totalRevenue: 2450000,
      retention: 89,
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
