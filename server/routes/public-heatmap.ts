import type { Express } from "express";
import type { IStorage } from "../storage/contracts";

export type PublicHeatmapStorage = Pick<IStorage, "getLocalityHeatmapData">;

export interface PublicHeatmapDependencies {
  storage: PublicHeatmapStorage;
}

export function registerPublicHeatmapRoutes(
  app: Express,
  { storage }: PublicHeatmapDependencies
) {
  app.get("/api/heatmap", async (req: any, res: any) => {
    try {
      const timeframe = (req.query.timeframe as string) || "30d";
      const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
      const heatmapData = await storage.getLocalityHeatmapData(days);
      res.json(heatmapData);
    } catch (error: any) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });
}
