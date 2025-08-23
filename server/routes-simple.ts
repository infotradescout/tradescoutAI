import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Basic API endpoints for the simple frontend
  app.get('/api/auth/user', (req, res) => {
    // Return null for now - no authentication
    res.json(null);
  });

  app.get('/api/contractors', (req, res) => {
    // Return empty array for now
    res.json([]);
  });

  app.get('/api/daily-deals', (req, res) => {
    // Return empty array for now
    res.json([]);
  });

  // Basic contractor data for the landing page
  app.get('/api/stats', (req, res) => {
    res.json({
      totalContractors: 28500,
      totalUsers: 125000,
      totalRevenue: 2450000,
      retention: 89
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}