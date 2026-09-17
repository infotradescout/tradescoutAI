import type { Request, Response, Router } from "express";
import { loadScoutWorkOverview, type ScoutWorkDatabase } from "./scoutWorkOverview";
import { registerScoutRequestContextRoutes } from "./scoutRequestContextRoutes";

export function createScoutWorkHandler(getDatabase: () => Promise<ScoutWorkDatabase>) {
  return async (req: Request, res: Response): Promise<void> => {
    res.set("Cache-Control", "private, no-store");
    res.vary("Cookie");
    res.vary("Authorization");
    const identity = (req as Request & { user?: { id?: unknown; claims?: { sub?: unknown } } }).user;
    const ownerId = identity?.id || identity?.claims?.sub;
    if (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 200) {
      res.status(401).json({ message: "Sign in to continue your saved work." });
      return;
    }
    try {
      // Client query/body owner IDs never select another account's work.
      const overview = await loadScoutWorkOverview(ownerId, await getDatabase());
      if (overview.sections.every((section) => section.availability === "unavailable")) {
        res.status(503).json({ message: "Your saved work could not be loaded. Refresh to check again." });
        return;
      }
      res.json(overview);
    } catch {
      res.status(503).json({ message: "Your saved work could not be loaded. Refresh to check again." });
    }
  };
}

export function registerScoutWorkRoutes(router: Router): void {
  router.get("/work", createScoutWorkHandler(async () => (await import("../db")).pool));
  registerScoutRequestContextRoutes(router);
}
