import type { Express, Request, Response } from "express";
import { isStaff } from "../auth";
import { storage } from "../storage";

export function registerAnalyticsRoutes(app: Express) {
  // This endpoint is intentionally "soft": it should never block UX.
  // Guests are allowed – userId is optional.
  app.post("/api/analytics/shell", async (req: Request, res: Response) => {
    try {
      const user = (req as any)?.user ?? null;
      const userId = user?.id ?? null;
      const contractorId = user?.contractorId ?? null;
      const event = req.body as any;

      console.log("[Analytics][Shell]", { userId, event });

      // Best-effort persistence into the generic events table.
      // This must never throw back to the client.
      try {
        const ipHeader = (req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) as string | undefined;
        const ipAddress = ipHeader?.split(",")[0]?.trim() || (req as any).ip || null;
        const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

        const enrichedEvent = {
          ...event,
          ipAddress,
          userAgent,
          userId,
          contractorId,
        };

        const eventType = typeof event?.type === "string" && event.type.trim().length > 0
          ? event.type
          : "shell.unknown";

        await storage.logEvent(eventType, enrichedEvent);
      } catch (persistError) {
        console.error("[Analytics][Shell] Failed to persist event", persistError);
      }

      // No content; just acknowledge we received the event
      res.status(204).end();
    } catch (error) {
      console.error("Error handling shell analytics event", error);
      // Still return 204 so analytics can never break the app
      res.status(204).end();
    }
  });

  // Internal: Scout draft funnel + latency summary
  app.get("/api/analytics/scout-drafts/summary", isStaff, async (req: any, res: Response) => {
    try {
      const now = new Date();

      const windowHoursRaw = req.query.windowHours;
      const parsedWindowHours = typeof windowHoursRaw === "string" ? Number(windowHoursRaw) : NaN;
      const safeWindowHours = Number.isFinite(parsedWindowHours)
        ? Math.min(Math.max(parsedWindowHours, 1), 24 * 30)
        : 72; // default: last 72 hours

      const to = now;
      const from = new Date(to.getTime() - safeWindowHours * 60 * 60 * 1000);

      const summary = await storage.getScoutDraftAnalyticsSummary(from, to);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching Scout draft analytics summary", error);
      res.status(500).json({ message: "Failed to fetch Scout draft analytics summary" });
    }
  });

  // Internal: Outcome confirmation summary across action types
  app.get("/api/analytics/outcomes/summary", isStaff, async (req: any, res: Response) => {
    try {
      const now = new Date();

      const windowHoursRaw = req.query.windowHours;
      const parsedWindowHours = typeof windowHoursRaw === "string" ? Number(windowHoursRaw) : NaN;
      const safeWindowHours = Number.isFinite(parsedWindowHours)
        ? Math.min(Math.max(parsedWindowHours, 1), 24 * 30)
        : 72; // default: last 72 hours

      const to = now;
      const from = new Date(to.getTime() - safeWindowHours * 60 * 60 * 1000);

      const summary = await storage.getOutcomeAnalyticsSummary(from, to);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching outcome analytics summary", error);
      res.status(500).json({ message: "Failed to fetch outcome analytics summary" });
    }
  });
}
