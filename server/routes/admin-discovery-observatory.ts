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

function percentage(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function addPublicProfileRequestIntent(snapshot: Record<string, any>) {
  const sourceName = "Public profile Direct Connect intent ledger";
  try {
    const [profileResult, routeResult] = await Promise.all([
      pool.query(
        `with all_intent_events as (
           select data->>'profileSlug' as profile_slug,
                  data->>'deviceType' as device_type,
                  split_part(coalesce(data->>'route', ''), '?', 1) as route,
                  nullif(data->>'anonymousSessionId', '') as session_key,
                  data->>'linkageVersion' as linkage_version,
                  created_at
             from events
            where (
                    event_type = 'public_profile_direct_connect_opened'
                    or (
                      event_type = 'shell_analytics'
                      and data->>'type' = 'public_profile_direct_connect_opened'
                    )
                  )
              and created_at >= $1::timestamptz
              and coalesce(data->>'profileSlug', '') <> ''
         ),
         measurable_intent_events as (
           select *
             from all_intent_events
            where session_key is not null
              and linkage_version = '1'
         ),
         profile_baselines as (
           select profile_slug,
                  min(created_at) - interval '30 minutes' as baseline_at
             from measurable_intent_events
            group by profile_slug
         ),
         measurable_landings as (
           select data->>'businessSlug' as profile_slug,
                  split_part(coalesce(data->>'canonicalRoute', ''), '?', 1) as route,
                  nullif(data->>'anonymousSessionId', '') as session_key,
                  created_at
             from events
             join profile_baselines
               on profile_baselines.profile_slug = data->>'businessSlug'
            where event_type = 'discovery_landing'
              and created_at >= $1::timestamptz
              and created_at >= profile_baselines.baseline_at
              and nullif(data->>'anonymousSessionId', '') is not null
         ),
         raw_intent_rollup as (
           select profile_slug,
                  count(*)::int as open_count,
                  count(*) filter (where device_type = 'mobile')::int as mobile_open_count,
                  count(*) filter (where device_type = 'desktop')::int as desktop_open_count,
                  max(created_at) as last_opened_at
             from all_intent_events
            group by profile_slug
         ),
         measurable_intent_rollup as (
           select profile_slug,
                  count(*)::int as measurable_open_count,
                  count(distinct session_key)::int as open_session_count
             from measurable_intent_events
            group by profile_slug
         ),
         landing_rollup as (
           select profile_slug,
                  count(distinct session_key)::int as landing_session_count
             from measurable_landings
            group by profile_slug
         ),
         linked_rollup as (
           select intent.profile_slug,
                  count(distinct intent.session_key)::int as linked_session_count
             from measurable_intent_events intent
            where exists (
              select 1
                from measurable_landings landing
               where landing.profile_slug = intent.profile_slug
                 and landing.session_key = intent.session_key
                 and landing.created_at <= intent.created_at
            )
            group by intent.profile_slug
         ),
         profile_keys as (
           select profile_slug from all_intent_events
           union
           select profile_slug from measurable_landings
         )
         select profile_keys.profile_slug,
                coalesce(max(profiles.display_name), profile_keys.profile_slug) as display_name,
                coalesce(max(raw_intent_rollup.open_count), 0)::int as open_count,
                coalesce(max(raw_intent_rollup.mobile_open_count), 0)::int as mobile_open_count,
                coalesce(max(raw_intent_rollup.desktop_open_count), 0)::int as desktop_open_count,
                coalesce(max(measurable_intent_rollup.measurable_open_count), 0)::int as measurable_open_count,
                coalesce(max(measurable_intent_rollup.open_session_count), 0)::int as open_session_count,
                coalesce(max(landing_rollup.landing_session_count), 0)::int as landing_session_count,
                coalesce(max(linked_rollup.linked_session_count), 0)::int as linked_session_count,
                max(raw_intent_rollup.last_opened_at) as last_opened_at
           from profile_keys
           left join profiles on profiles.slug = profile_keys.profile_slug
           left join raw_intent_rollup on raw_intent_rollup.profile_slug = profile_keys.profile_slug
           left join measurable_intent_rollup on measurable_intent_rollup.profile_slug = profile_keys.profile_slug
           left join landing_rollup on landing_rollup.profile_slug = profile_keys.profile_slug
           left join linked_rollup on linked_rollup.profile_slug = profile_keys.profile_slug
          group by profile_keys.profile_slug
          order by coalesce(max(linked_rollup.linked_session_count), 0) desc,
                   coalesce(max(raw_intent_rollup.open_count), 0) desc,
                   profile_keys.profile_slug asc`,
        [snapshot?.window?.from]
      ),
      pool.query(
        `with measurable_intent_events as (
           select data->>'profileSlug' as profile_slug,
                  split_part(coalesce(data->>'route', ''), '?', 1) as route,
                  nullif(data->>'anonymousSessionId', '') as session_key,
                  created_at
             from events
            where (
                    event_type = 'public_profile_direct_connect_opened'
                    or (
                      event_type = 'shell_analytics'
                      and data->>'type' = 'public_profile_direct_connect_opened'
                    )
                  )
              and data->>'linkageVersion' = '1'
              and nullif(data->>'anonymousSessionId', '') is not null
              and created_at >= $1::timestamptz
              and coalesce(data->>'profileSlug', '') <> ''
              and coalesce(split_part(data->>'route', '?', 1), '') <> ''
         ),
         profile_baselines as (
           select profile_slug,
                  min(created_at) - interval '30 minutes' as baseline_at
             from measurable_intent_events
            group by profile_slug
         ),
         measurable_landings as (
           select data->>'businessSlug' as profile_slug,
                  split_part(coalesce(data->>'canonicalRoute', ''), '?', 1) as route,
                  nullif(data->>'anonymousSessionId', '') as session_key,
                  created_at
             from events
             join profile_baselines
               on profile_baselines.profile_slug = data->>'businessSlug'
            where event_type = 'discovery_landing'
              and created_at >= $1::timestamptz
              and created_at >= profile_baselines.baseline_at
              and nullif(data->>'anonymousSessionId', '') is not null
         ),
         intent_routes as (
           select profile_slug,
                  route,
                  count(*)::int as open_count,
                  count(distinct session_key)::int as open_session_count,
                  max(created_at) as last_opened_at
             from measurable_intent_events
            group by profile_slug, route
         ),
         landing_routes as (
           select profile_slug,
                  route,
                  count(distinct session_key)::int as landing_session_count
             from measurable_landings
            group by profile_slug, route
         ),
         linked_routes as (
           select intent.profile_slug,
                  intent.route,
                  count(distinct intent.session_key)::int as linked_session_count
             from measurable_intent_events intent
            where exists (
              select 1
                from measurable_landings landing
               where landing.profile_slug = intent.profile_slug
                 and landing.route = intent.route
                 and landing.session_key = intent.session_key
                 and landing.created_at <= intent.created_at
            )
            group by intent.profile_slug, intent.route
         ),
         route_keys as (
           select profile_slug, route from intent_routes
           union
           select profile_slug, route from landing_routes
         )
         select route_keys.profile_slug,
                route_keys.route,
                coalesce(intent_routes.open_count, 0)::int as open_count,
                coalesce(intent_routes.open_session_count, 0)::int as open_session_count,
                coalesce(landing_routes.landing_session_count, 0)::int as landing_session_count,
                coalesce(linked_routes.linked_session_count, 0)::int as linked_session_count,
                intent_routes.last_opened_at
           from route_keys
           left join intent_routes
             on intent_routes.profile_slug = route_keys.profile_slug
            and intent_routes.route = route_keys.route
           left join landing_routes
             on landing_routes.profile_slug = route_keys.profile_slug
            and landing_routes.route = route_keys.route
           left join linked_routes
             on linked_routes.profile_slug = route_keys.profile_slug
            and linked_routes.route = route_keys.route
          order by coalesce(linked_routes.linked_session_count, 0) desc,
                   coalesce(intent_routes.open_count, 0) desc,
                   route_keys.profile_slug asc,
                   route_keys.route asc`,
        [snapshot?.window?.from]
      ),
    ]);

    const routeBreakdown = new Map<string, Array<Record<string, unknown>>>();
    for (const row of routeResult.rows) {
      const profileSlug = String(row.profile_slug || "");
      if (!profileSlug) continue;
      const landingSessionCount = Number(row.landing_session_count || 0);
      const linkedSessionCount = Number(row.linked_session_count || 0);
      const entries = routeBreakdown.get(profileSlug) || [];
      entries.push({
        route: String(row.route || ""),
        openCount: Number(row.open_count || 0),
        openSessionCount: Number(row.open_session_count || 0),
        landingSessionCount,
        linkedSessionCount,
        linkedOpenRatePercent: percentage(linkedSessionCount, landingSessionCount),
        lastOpenedAt: row.last_opened_at ? new Date(row.last_opened_at).toISOString() : null,
      });
      routeBreakdown.set(profileSlug, entries);
    }

    const profileRequestIntent = profileResult.rows.map((row) => {
      const profileSlug = String(row.profile_slug || "");
      const landingSessionCount = Number(row.landing_session_count || 0);
      const linkedSessionCount = Number(row.linked_session_count || 0);
      const measurableOpenCount = Number(row.measurable_open_count || 0);
      const openCount = Number(row.open_count || 0);
      return {
        profileSlug,
        displayName: String(row.display_name || profileSlug || "Public profile"),
        openCount,
        mobileOpenCount: Number(row.mobile_open_count || 0),
        desktopOpenCount: Number(row.desktop_open_count || 0),
        measurableOpenCount,
        historicalUnlinkedOpenCount: Math.max(0, openCount - measurableOpenCount),
        openSessionCount: Number(row.open_session_count || 0),
        landingSessionCount,
        linkedSessionCount,
        linkedOpenRatePercent: percentage(linkedSessionCount, landingSessionCount),
        routes: routeBreakdown.get(profileSlug) || [],
        lastOpenedAt: row.last_opened_at ? new Date(row.last_opened_at).toISOString() : null,
        evidenceStrength: "client_correlated_unverified",
        grain: "tab_scoped_profile_discovery_sessions",
      };
    });

    const openCount = profileRequestIntent.reduce(
      (total, row) => total + Number(row.openCount || 0),
      0
    );
    const measurableOpenCount = profileRequestIntent.reduce(
      (total, row) => total + Number(row.measurableOpenCount || 0),
      0
    );
    const landingSessionCount = profileRequestIntent.reduce(
      (total, row) => total + Number(row.landingSessionCount || 0),
      0
    );
    const linkedSessionCount = profileRequestIntent.reduce(
      (total, row) => total + Number(row.linkedSessionCount || 0),
      0
    );
    const linkedOpenRatePercent = percentage(linkedSessionCount, landingSessionCount);
    const historicalUnlinkedOpenCount = Math.max(0, openCount - measurableOpenCount);
    const visibleProfileSummary = profileRequestIntent
      .slice(0, 12)
      .map((row) => {
        const rate =
          row.linkedOpenRatePercent == null ? "baseline unavailable" : `${row.linkedOpenRatePercent}%`;
        return `${row.displayName}: ${row.linkedSessionCount}/${row.landingSessionCount} linked sessions (${rate}); ${row.openCount} raw open event(s)`;
      })
      .join(" · ");

    const funnel = Array.isArray(snapshot.funnel) ? [...snapshot.funnel] : [];
    const entryIndex = funnel.findIndex((stage) => stage?.stage === "entry");
    const insertionIndex = entryIndex >= 0 ? entryIndex + 1 : Math.min(2, funnel.length);
    funnel.splice(insertionIndex, 0, {
      stage: "request_intent",
      label: "Discovery sessions opening Direct Connect",
      count: linkedSessionCount,
      denominator: landingSessionCount,
      denominatorLabel: "measurable profile discovery sessions after linkage became observable",
      ratePercent: linkedOpenRatePercent,
      unknownUnavailable: historicalUnlinkedOpenCount,
    });

    const rateDetail =
      linkedOpenRatePercent == null
        ? "A linked conversion baseline is not yet available."
        : `${linkedSessionCount} of ${landingSessionCount} measurable profile discovery session(s) opened Direct Connect (${linkedOpenRatePercent}%).`;

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
          detail: `${openCount} raw panel-open event(s) across ${profileRequestIntent.length} public profile(s). ${rateDetail} ${historicalUnlinkedOpenCount} historical open event(s) lack the tab-scoped linkage contract and remain unlinked rather than being forced into a conversion rate. Opens are intent evidence, not submitted requests or provider outcomes.${visibleProfileSummary ? ` Profile totals: ${visibleProfileSummary}.` : ""}`,
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
