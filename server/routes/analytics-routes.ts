import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";

export function registerAnalyticsRoutes(app: Express) {
  // Shell analytics should work for guests too, so we do NOT require auth here.
  app.post("/api/analytics/shell", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id ?? null;
      const event = req.body;

      console.log("[Analytics][Shell]", { userId, event });

      res.status(204).end();
    } catch (error) {
      console.error("Error handling shell analytics event", error);
      // Still return 204 so the client never treats this as a hard error
      res.status(204).end();
    }
  });
}
