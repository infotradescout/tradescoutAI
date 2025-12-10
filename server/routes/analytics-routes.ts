import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";

export function registerAnalyticsRoutes(app: Express) {
  app.post("/api/analytics/shell", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // For now, just log the event. You can later persist this
      // to a dedicated analytics table or external service.
      const userId = (req as any).user?.id;
      const event = req.body;

      console.log("[Analytics][Shell]", { userId, event });

      res.status(204).end();
    } catch (error) {
      console.error("Error handling shell analytics event", error);
      res.status(204).end();
    }
  });
}
