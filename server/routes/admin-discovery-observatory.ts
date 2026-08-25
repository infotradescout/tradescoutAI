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

async function addPublicProfileRequestIntent(snapshot: Record<string, any>) {
  const sourceName = "Public profile Direct Connect intent ledger";
  try {
    const result = await pool.query(
      `with intent_events as (
         select data->>'profileSlug' as profile_slug,
                data->>'deviceType' as device_type,
                created_at
           from events
          where event_type = 'shell_analytics'
            and data->>'type' = 'public_profile_direct_connect_opened'
            and created_at >= $1::timestamptz
            and coalesce(data->>'profileSlug', '') <> ''
       )
       select intent_events.profile_slug,
              coalesce(max(profiles.display_name), intent_events.profile_slug) as display_name,
              count(*)::int as open_count,
              count(*) filter (where intent_events.device_type = 'mobile')::int as mobile_open_count,
              count(*) filter (where intent_events.device_type = 'desktop')::int as desktop_open_count,
              max(intent_events.created_at) as last_opened_at
         from intent_events
         left join profiles on profiles.slug = intent_events.profile_slug
        group by intent_events.profile_slug
        order by count(*) desc, intent_events.profile_slug asc`,
      [snapshot?.window?.from]
    );

    const profileRequestIntent = result.rows.map((row) => ({
      profileSlug: String(row.profile_slug || ""),
      displayName: String(row.display_name || row.profile_slug || "Public profile"),
      openCount: Number(row.open_count || 0),
      mobileOpenCount: Number(row.mobile_open_count || 0),
      desktopOpenCount: Number(row.desktop_open_count || 0),
      lastOpenedAt: row.last_opened_at
        ? new Date(row.last_opened_at).toISOString()
        : null,
      evidenceStrength: "client_correlated_unverified",
      grain: "direct_connect_dialog_mount_events",
    }));
    const openCount = profileRequestIntent.reduce(
      (total, row) => total + Number(row.openCount || 0),
      0
    );
    const funnel = Array.isArray(snapshot.funnel) ? [...snapshot.funnel] : [];
    const entryIndex = funnel.findIndex((stage) => stage?.stage === "entry");
    const insertionIndex = entryIndex >= 0 ? entryIndex + 1 : Math.min(2, funnel.length);
    funnel.splice(insertionIndex, 0, {
      stage: "request_intent",
      label: "Direct Connect opens",
      count: openCount,
      denominator: Number(funnel[entryIndex]?.count || 0),
      denominatorLabel: "unique entries; cross-event visitor linkage unavailable",
      ratePercent: null,
      unknownUnavailable: 0,
    });

    return {
      ...snapshot,
      funnel,
      sourceStates: [
        ...(Array.isArray(snapshot.sourceStates) ? snapshot.sourceStates : []),
        {
          source: sourceName,
          status: "current",
          observedAt: new Date().toISOString(),
          ageSeconds: 0,
          detail: `${openCount} panel-open event(s) across ${profileRequestIntent.length} public profile(s). Opens are deliberate client-observed intent, not submitted requests or provider outcomes.`,
        },
      ],
      operatingViews: {
        ...(snapshot.operatingViews || {}),
        profileRequestIntent,
      },
    };
  } catch (error) {
    console.error("[discovery-observatory] request-intent read failed", error);
    return {
      ...snapshot,
      sourceStates: [
        ...(Array.isArray(snapshot.sourceStates) ? snapshot.sourceStates : []),
        {
          source: sourceName,
          status: "unavailable",
          observedAt: null,
          ageSeconds: null,
          detail: "Request-intent evidence is unavailable and was not converted into a zero.",
        },
      ],
    };
  }
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
    res.json(await addPublicProfileRequestIntent(snapshot));
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
