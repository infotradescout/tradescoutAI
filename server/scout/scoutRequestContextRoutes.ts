import type { Request, Response, Router } from "express";
import { projectScoutRequestContext, SCOUT_REQUEST_ID_PATTERN } from "../../shared/scoutRequestContext";

export interface ScoutRequestContextDatabase {
  query(text: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export function createScoutRequestContextHandler(getDatabase: () => Promise<ScoutRequestContextDatabase>) {
  return async (req: Request, res: Response): Promise<void> => {
    res.set("Cache-Control", "private, no-store");
    res.vary("Cookie");
    res.vary("Authorization");
    const identity = (req as Request & { user?: { id?: unknown; claims?: { sub?: unknown } } }).user;
    const ownerId = identity?.id || identity?.claims?.sub;
    if (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 200) {
      res.status(401).json({ message: "Sign in to continue your saved request." });
      return;
    }
    const requestId = req.params.requestId;
    if (typeof requestId !== "string" || !SCOUT_REQUEST_ID_PATTERN.test(requestId)) {
      res.status(400).json({ message: "Choose a saved request to continue." });
      return;
    }
    try {
      const database = await getDatabase();
      const { rows } = await database.query(
        `SELECT id, title, description, status, county_fips, state_code,
          trade_id, budget_min, budget_max, updated_at
         FROM work_requests WHERE id = $1 AND created_by_user_id = $2 LIMIT 1`,
        [requestId, ownerId]
      );
      if (!rows[0]) {
        // The same response covers a missing record and another owner's record.
        res.status(404).json({ message: "This request is not available in your account." });
        return;
      }
      res.json(projectScoutRequestContext(rows[0], ownerId, requestId, new Date().toISOString()));
    } catch {
      res.status(503).json({ message: "This request could not be loaded. No action was submitted." });
    }
  };
}

export function registerScoutRequestContextRoutes(router: Router): void {
  router.get("/work/requests/:requestId", createScoutRequestContextHandler(async () => (await import("../db")).pool));
}
