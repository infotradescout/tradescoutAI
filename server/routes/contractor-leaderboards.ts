import type { Express } from "express";
import type { IStorage } from "../storage";

export type ContractorLeaderboardRouteStorage = Pick<
  IStorage,
  "getMonthlyLeaderboard" | "getLifetimeLeaderboard" | "getContractorLeaderboardPosition"
>;

export function registerContractorLeaderboardRoutes(
  app: Express,
  storage: ContractorLeaderboardRouteStorage
): void {
  // Contractor leaderboards
  app.get("/api/leaderboard/monthly", async (req: any, res: any) => {
    try {
      const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const state = req.query.state as string;
      const county = req.query.county as string;

      const leaderboard = await storage.getMonthlyLeaderboard(month, year, limit, state, county);
      res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching monthly leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch monthly leaderboard" });
    }
  });

  app.get("/api/leaderboard/lifetime", async (req: any, res: any) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const state = req.query.state as string;
      const county = req.query.county as string;

      const leaderboard = await storage.getLifetimeLeaderboard(limit, state, county);
      res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching lifetime leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch lifetime leaderboard" });
    }
  });

  app.get("/api/leaderboard/contractor/:contractorId", async (req: any, res: any) => {
    try {
      const { contractorId } = req.params;
      const stats = await storage.getContractorLeaderboardPosition(contractorId);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching contractor leaderboard position:", error);
      res.status(500).json({ message: "Failed to fetch contractor position" });
    }
  });
}
