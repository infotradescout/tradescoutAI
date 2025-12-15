import type { Express, Request, Response } from "express";

export function registerAnalyticsRoutes(app: Express) {
  // This endpoint is intentionally "soft": it should never block UX.
  // Guests are allowed – userId is optional.
  app.post("/api/analytics/shell", async (req: Request, res: Response) => {
    try {
      const userId = (req as any)?.user?.id ?? null;
      const event = req.body;

      console.log("[Analytics][Shell]", { userId, event });

      // No content; just acknowledge we received the event
      res.status(204).end();
    } catch (error) {
      console.error("Error handling shell analytics event", error);
      // Still return 204 so analytics can never break the app
      res.status(204).end();
    }
  });
}
