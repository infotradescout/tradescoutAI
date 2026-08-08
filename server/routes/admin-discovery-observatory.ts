import { Router, type Request, type Response } from "express";
import { isAuthenticated, isSuperAdmin } from "../auth";
import { pool } from "../db";
import { storage } from "../storage";
import { DiscoveryObservatoryService } from "../services/discoveryObservatoryService";

function actorId(req: Request): string {
  const user = (
    req as Request & {
      user?: { id?: string; claims?: { sub?: string }; [key: string]: unknown };
    }
  ).user;
  return String(user?.id || user?.claims?.sub || "").trim();
}

const router = Router();

// Defense in depth: every route in this router is both authenticated and
// super-admin-only. It is never mounted on a public path.
router.use(isAuthenticated, isSuperAdmin);

const service = new DiscoveryObservatoryService(pool, async (eventType, data) =>
  storage.logEvent(eventType, data)
);

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedWindow = Number(req.query.windowDays || 30);
    const snapshot = await service.getSnapshot(requestedWindow);
    res.json(snapshot);
  } catch (error) {
    console.error("[discovery-observatory] snapshot failed", error);
    res.status(500).json({ message: "Discovery observatory snapshot is unavailable." });
  }
});

router.post("/observations", async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const transactionService = new DiscoveryObservatoryService(client, async (eventType, data) => {
      await client.query("insert into events (event_type, data) values ($1, $2::jsonb)", [
        eventType,
        JSON.stringify(data),
      ]);
    });
    const result = await transactionService.captureObservation(req.body);
    await client.query("commit");
    res.status(result.created ? 201 : 200).json({ observation: result.observation });
  } catch (error) {
    await client.query("rollback");
    if (error instanceof Error && error.message === "INVALID_DISCOVERY_OBSERVATION") {
      res.status(400).json({
        message:
          "Observation is invalid. Preserve unknowns explicitly and provide source freshness.",
      });
      return;
    }
    console.error("[discovery-observatory] observation capture failed", error);
    res.status(500).json({ message: "Observation could not be recorded." });
  } finally {
    client.release();
  }
});

router.post("/experiments/state", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = await service.captureExperimentState(req.body, actorId(req));
    res.status(201).json({ experimentState: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_DISCOVERY_EXPERIMENT_STATE";
    if (
      message === "INVALID_DISCOVERY_EXPERIMENT_STATE" ||
      message === "OWNER_DECISION_REFERENCE_REQUIRED"
    ) {
      res.status(400).json({ message });
      return;
    }
    console.error("[discovery-observatory] experiment state capture failed", error);
    res.status(500).json({ message: "Experiment state could not be recorded." });
  }
});

router.post("/experiments/assignments", async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const transactionService = new DiscoveryObservatoryService(client, async (eventType, data) => {
      await client.query("insert into events (event_type, data) values ($1, $2::jsonb)", [
        eventType,
        JSON.stringify(data),
      ]);
    });
    const result = await transactionService.predeclareExperimentAssignment(req.body, actorId(req));
    await client.query("commit");
    res.status(result.created ? 201 : 200).json({ assignment: result.assignment });
  } catch (error) {
    await client.query("rollback");
    const message =
      error instanceof Error ? error.message : "INVALID_DISCOVERY_EXPERIMENT_ASSIGNMENT";
    if (
      message === "INVALID_DISCOVERY_EXPERIMENT_ASSIGNMENT" ||
      message === "CONFLICTING_DISCOVERY_EXPERIMENT_ASSIGNMENT" ||
      message === "DISCOVERY_EXPERIMENT_OWNER_APPROVAL_REQUIRED"
    ) {
      res.status(409).json({ message });
      return;
    }
    console.error("[discovery-observatory] experiment assignment failed", error);
    res.status(500).json({ message: "Experiment assignment could not be recorded." });
  } finally {
    client.release();
  }
});

export default router;
