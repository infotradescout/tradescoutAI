import type { Express } from "express";
import type { IStorage } from "../storage/contracts";

export type EventRoutesStorage = Pick<IStorage, "logEvent">;

export interface EventRoutesDependencies {
  storage: EventRoutesStorage;
}

export function registerEventRoutes(app: Express, { storage }: EventRoutesDependencies) {
  app.post("/api/events", async (req: any, res: any) => {
    try {
      const payload = (req.body ?? {}) as any;
      const rawEventType = typeof payload?.eventType === "string" ? payload.eventType.trim() : "";
      const eventType = rawEventType || "event.unknown";
      const data = payload?.data ?? {};
      const sessionUser = (req as any)?.user ?? null;

      res.status(204).end();

      void storage
        .logEvent(eventType, {
          ...data,
          userId: sessionUser?.id || data?.userId || null,
          contractorId: sessionUser?.contractorId || data?.contractorId || null,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        })
        .catch((error: any) => {
          console.error("Error persisting /api/events telemetry", error);
        });
    } catch (error: any) {
      console.error("Error logging event:", error);
      res.status(204).end();
    }
  });
}
