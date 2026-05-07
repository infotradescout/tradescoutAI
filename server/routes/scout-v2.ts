import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import { counties } from "../../shared/schema";
import {
  buildScoutMissionCacheKey,
  runScoutMissionWithOptimization,
} from "../services/scoutOptimizationEngine";
import { synthesizeScoutMission } from "../services/scoutMultiSourceSynthesis";
import { convertScoutMissionToLisaItems } from "../services/scoutToLisaConverter";
import {
  ensureScoutLisaFindingsTable,
  getCurrentScoutLisaFindings,
  getScoutLisaFindingsSummary,
  persistScoutLisaFindings,
  rankScoutLisaFindingPriority,
} from "../services/scoutLisaPersistence";
import {
  endScoutStream,
  sendScoutStreamEvent,
  startScoutStream,
} from "../services/scoutStreamingHandler";

const router = Router();

router.use(requireAdmin);

type ScoutV2MissionInput = {
  query?: string;
  countyFips?: string;
  stateCode?: string;
  trade?: string;
  learning?: boolean;
  learningMode?: boolean;
  missionId?: string;
};

type ScoutV2MissionResponse = {
  missionId: string;
  cacheKey: string;
  generatedAt: string;
  mode: "standard" | "learning";
  cached: boolean;
  deduped: boolean;
  summary: {
    what: string;
    why: string;
    whatToDo: string;
    confidence: "high" | "medium" | "low";
  };
  bundles: ReturnType<typeof summarizeBundles>;
  conflictsResolved: Array<{ source: string; resolution: string }>;
  evidence: string[];
  lisa: {
    savedCount: number;
    findings: unknown[];
  };
  countyWriteback: {
    metricsWritten: number;
    notesWritten: number;
    entitiesWritten: number;
  };
  optimization: {
    route: "cache" | "inflight" | "compute";
    usedLlm: boolean;
    model?: string;
    rawChars: number;
    compressedChars: number;
    skippedReason?: string;
  };
};

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCountyFips(value: unknown): string | null {
  const text = normalizeText(value);
  return /^\d{5}$/.test(text) ? text : null;
}

function parseStateCode(value: unknown): string | null {
  const text = normalizeText(value).toUpperCase();
  return /^[A-Z]{2}$/.test(text) ? text : null;
}

function parseTrade(value: unknown): string | null {
  const text = normalizeText(value).toLowerCase();
  return text ? text.slice(0, 64) : null;
}

function isHeatmapMount(req: Request): boolean {
  return String((req as any).baseUrl || "").includes("/api/scout-heatmap");
}

function summarizeBundle(bundle: {
  status: string;
  note: string;
  items: Array<{ title: string }>;
}) {
  return {
    status: bundle.status,
    note: bundle.note,
    itemCount: bundle.items.length,
    topTitles: bundle.items.slice(0, 3).map((item) => item.title),
  };
}

function summarizeBundles(analysis: any) {
  return {
    knowledgeBase: summarizeBundle(analysis.bundles.knowledgeBase),
    localData: summarizeBundle(analysis.bundles.localData),
    liveWeb: summarizeBundle(analysis.bundles.liveWeb),
  };
}

async function upsertCountyMetric(
  countyFips: string,
  metricKey: string,
  metricValue: number
): Promise<void> {
  await db.execute(sql`
    INSERT INTO county_metrics (county_fips, metric_key, metric_value, updated_at)
    VALUES (${countyFips}, ${metricKey}, ${metricValue}, now())
    ON CONFLICT (county_fips, metric_key)
    DO UPDATE SET
      metric_value = EXCLUDED.metric_value,
      updated_at = now()
  `);
}

async function writeCountyWriteback(
  req: Request,
  analysis: any,
  mode: "standard" | "learning"
): Promise<{
  metricsWritten: number;
  notesWritten: number;
  entitiesWritten: number;
}> {
  const countyFips = parseCountyFips(analysis.countyFips);
  const userId =
    typeof (req as any)?.user?.id === "string"
      ? String((req as any).user.id)
      : typeof (req as any)?.user?.claims?.sub === "string"
        ? String((req as any).user.claims.sub)
        : null;

  if (!countyFips || !userId) {
    return { metricsWritten: 0, notesWritten: 0, entitiesWritten: 0 };
  }

  const metricsToWrite = [
    ["scout_mission_count", 1],
    [
      "scout_signal_score",
      analysis.summary.confidence === "high"
        ? 90
        : analysis.summary.confidence === "medium"
          ? 60
          : 30,
    ],
    ["scout_source_count", analysis.evidence.length],
  ] as const;

  let metricsWritten = 0;
  try {
    for (const [metricKey, value] of metricsToWrite) {
      if (metricKey === "scout_mission_count") {
        await db.execute(sql`
          INSERT INTO county_metrics (county_fips, metric_key, metric_value, updated_at)
          VALUES (${countyFips}, ${metricKey}, ${value}, now())
          ON CONFLICT (county_fips, metric_key)
          DO UPDATE SET
            metric_value = county_metrics.metric_value + 1,
            updated_at = now()
        `);
        metricsWritten += 1;
        continue;
      }
      await upsertCountyMetric(countyFips, metricKey, Number(value));
      metricsWritten += 1;
    }
  } catch (error) {
    console.error("[scout-v2] county metric writeback failed:", error);
  }

  let notesWritten = 0;
  try {
    const countyNameRow = await db
      .select({ name: counties.name })
      .from(counties)
      .where(eq(counties.fips, countyFips))
      .limit(1);
    const countyName = countyNameRow[0]?.name ? String(countyNameRow[0].name) : countyFips;
    const noteContent = [
      `Scout 2.0 mission for ${countyName}.`,
      `What: ${analysis.summary.what}`,
      `Why: ${analysis.summary.why}`,
      `What to do: ${analysis.summary.whatToDo}`,
      mode === "learning"
        ? "Learning mode was enabled for this mission."
        : "Learning mode was disabled.",
    ].join("\n");

    await storage.createCountyNote({
      countyFips,
      authorUserId: userId,
      category: "operations",
      content: noteContent,
    });
    notesWritten = 1;
  } catch (error) {
    console.error("[scout-v2] county note writeback failed:", error);
  }

  return {
    metricsWritten,
    notesWritten,
    entitiesWritten: 0,
  };
}

async function executeScoutMission(
  req: Request,
  input: ScoutV2MissionInput
): Promise<ScoutV2MissionResponse> {
  const query = normalizeText(input.query);
  if (!query) {
    throw new Error("query is required");
  }

  const countyFips = parseCountyFips(input.countyFips);
  const stateCode = parseStateCode(input.stateCode);
  const trade = parseTrade(input.trade);
  const mode =
    Boolean(input.learning || input.learningMode) ||
    String((req as any).baseUrl || "").includes("learning")
      ? "learning"
      : "standard";

  const cacheKey = buildScoutMissionCacheKey({
    query,
    countyFips: countyFips || undefined,
    stateCode: stateCode || undefined,
    trade: trade || undefined,
    learningMode: mode === "learning",
  });

  const result = await runScoutMissionWithOptimization(
    cacheKey,
    async () => {
      const analysis = await synthesizeScoutMission({
        query,
        countyFips: countyFips || undefined,
        stateCode: stateCode || undefined,
        trade: trade || undefined,
        missionId: normalizeText(input.missionId) || undefined,
        cacheKey,
        learningMode: mode === "learning",
        userId:
          typeof (req as any)?.user?.id === "string"
            ? String((req as any).user.id)
            : typeof (req as any)?.user?.claims?.sub === "string"
              ? String((req as any).user.claims.sub)
              : null,
      });

      const lisaItems = convertScoutMissionToLisaItems(analysis, {
        engineVersion: process.env.SCOUT_V2_ENGINE_VERSION || "scout-v2",
      }).items;

      let persisted = { savedCount: 0, findings: [] as unknown[] };
      try {
        persisted = await persistScoutLisaFindings(lisaItems, {
          missionId: analysis.missionId,
          countyFips: analysis.countyFips,
          stateCode: analysis.stateCode,
          trade: analysis.trade,
          learningMode: analysis.learningMode,
          engineVersion: process.env.SCOUT_V2_ENGINE_VERSION || "scout-v2",
          payload: {
            cacheKey: analysis.cacheKey,
            generatedAt: analysis.generatedAt,
            sourcePriority: analysis.sourcePriority,
            prompt: analysis.prompt,
          },
        });
      } catch (error) {
        console.error("[scout-v2] persistence failed:", error);
      }

      const countyWriteback = await writeCountyWriteback(req, analysis, mode);

      return {
        analysis,
        lisaItems,
        persisted,
        countyWriteback,
      };
    },
    {
      ttlMs: mode === "learning" ? 120_000 : 300_000,
    }
  );

  const payload = result.value as {
    analysis: any;
    lisaItems: any[];
    persisted: { savedCount: number; findings: unknown[] };
    countyWriteback: { metricsWritten: number; notesWritten: number; entitiesWritten: number };
  };

  return {
    missionId: payload.analysis.missionId,
    cacheKey,
    generatedAt: payload.analysis.generatedAt,
    mode,
    cached: result.cacheHit,
    deduped: result.deduped,
    summary: payload.analysis.summary,
    bundles: summarizeBundles(payload.analysis),
    conflictsResolved: payload.analysis.conflictsResolved,
    evidence: payload.analysis.evidence,
    lisa: {
      savedCount: payload.persisted.savedCount,
      findings: payload.persisted.findings,
    },
    countyWriteback: payload.countyWriteback,
    optimization: {
      route: result.route,
      usedLlm: Boolean(payload.analysis.prompt?.usedLlm),
      model: payload.analysis.prompt?.model,
      rawChars: Number(payload.analysis.prompt?.rawChars || 0),
      compressedChars: Number(payload.analysis.prompt?.compressedChars || 0),
      skippedReason: payload.analysis.prompt?.skippedReason || undefined,
    },
  };
}

router.get("/status", async (_req: Request, res: Response) => {
  try {
    await ensureScoutLisaFindingsTable();
    const summary = await getScoutLisaFindingsSummary();

    res.json({
      ok: true,
      engineVersion: process.env.SCOUT_V2_ENGINE_VERSION || "scout-v2",
      knowledgeRoot: "data/TradeScout Brain/40_KNOWLEDGE",
      learningMountEnabled: true,
      heatmapMountEnabled: true,
      currentFindings: summary.totalCurrent,
      byPriority: summary.byPriority,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[scout-v2] status error:", error);
    res.status(500).json({ message: "Failed to load Scout 2.0 status" });
  }
});

router.get("/health", async (req: Request, res: Response) => {
  try {
    const summary = await getScoutLisaFindingsSummary();
    res.json({
      ok: true,
      engineVersion: process.env.SCOUT_V2_ENGINE_VERSION || "scout-v2",
      knowledgeRoot: "data/TradeScout Brain/40_KNOWLEDGE",
      learningMountEnabled: true,
      heatmapMountEnabled: true,
      currentFindings: summary.totalCurrent,
      byPriority: summary.byPriority,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[scout-v2] health error:", error);
    res.status(500).json({ message: "Failed to load Scout 2.0 health" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    if (isHeatmapMount(req)) {
      return res.status(405).json({ message: "Heatmap routes are read-only" });
    }

    const result = await executeScoutMission(req, req.body || {});
    res.json(result);
  } catch (error: any) {
    const status = String(error?.message || "").includes("query is required") ? 400 : 500;
    res.status(status).json({
      message: status === 400 ? "query is required" : "Failed to run Scout 2.0 mission",
      error: status === 400 ? String(error?.message || "query is required") : undefined,
    });
  }
});

router.post("/stream", async (req: Request, res: Response) => {
  try {
    if (isHeatmapMount(req)) {
      return res.status(405).json({ message: "Heatmap routes are read-only" });
    }

    startScoutStream(res);
    sendScoutStreamEvent(res, "status", { stage: "starting" });

    const result = await executeScoutMission(req, req.body || {});
    sendScoutStreamEvent(res, "mission", result);
    sendScoutStreamEvent(res, "complete", {
      missionId: result.missionId,
      cached: result.cached,
      deduped: result.deduped,
    });
    endScoutStream(res);
  } catch (error: any) {
    sendScoutStreamEvent(res, "error", {
      message: String(error?.message || "Failed to run Scout 2.0 mission"),
    });
    endScoutStream(res);
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const metricKey =
      normalizeText(req.query.metric || "scout_mission_count") || "scout_mission_count";
    const metrics = await storage.getCountyMetricsByKey(metricKey);
    const byCounty: Record<string, number> = {};
    for (const row of metrics) {
      if (!row.countyFips) continue;
      byCounty[row.countyFips] = Number(row.metricValue || 0);
    }

    const findings = await getCurrentScoutLisaFindings();

    res.json({
      updatedAt: new Date().toISOString(),
      metricKey,
      byCounty,
      scoutFindings: findings.slice(0, 25),
    });
  } catch (error) {
    console.error("[scout-v2] summary error:", error);
    res.status(500).json({ message: "Failed to load Scout 2.0 summary" });
  }
});

router.get("/county/:countyFips", async (req: Request, res: Response) => {
  try {
    const countyFips = parseCountyFips(req.params.countyFips);
    if (!countyFips) {
      return res.status(400).json({ message: "countyFips must be a 5 digit FIPS code" });
    }

    const [countyRow] = await db
      .select()
      .from(counties)
      .where(eq(counties.fips, countyFips))
      .limit(1);
    const [scoutMetrics, notes, entities, findings] = await Promise.all([
      storage.getCountyMetricsForCounty({
        countyFips,
        metricKeys: ["scout_mission_count", "scout_signal_score", "scout_source_count"],
      }),
      storage.getCountyNotes(countyFips),
      storage.getCountyEntities(countyFips),
      getCurrentScoutLisaFindings(countyFips),
    ]);

    res.json({
      county: countyRow || null,
      countyFips,
      scoutMetrics,
      notes,
      entities,
      findings,
    });
  } catch (error) {
    console.error("[scout-v2] county heatmap error:", error);
    res.status(500).json({ message: "Failed to load county heatmap" });
  }
});

router.get("/county/:countyFips/findings", async (req: Request, res: Response) => {
  try {
    const countyFips = parseCountyFips(req.params.countyFips);
    if (!countyFips) {
      return res.status(400).json({ message: "countyFips must be a 5 digit FIPS code" });
    }

    const findings = await getCurrentScoutLisaFindings(countyFips);
    res.json({
      countyFips,
      findings,
      total: findings.length,
    });
  } catch (error) {
    console.error("[scout-v2] county findings error:", error);
    res.status(500).json({ message: "Failed to load county findings" });
  }
});

router.get("/county/:countyFips/metrics", async (req: Request, res: Response) => {
  try {
    const countyFips = parseCountyFips(req.params.countyFips);
    if (!countyFips) {
      return res.status(400).json({ message: "countyFips must be a 5 digit FIPS code" });
    }

    const metrics = await storage.getCountyMetricsForCounty({
      countyFips,
      metricKeys: ["scout_mission_count", "scout_signal_score", "scout_source_count"],
    });

    res.json({
      countyFips,
      metrics,
    });
  } catch (error) {
    console.error("[scout-v2] county metrics error:", error);
    res.status(500).json({ message: "Failed to load county metrics" });
  }
});

router.get("/county/:countyFips/notes", async (req: Request, res: Response) => {
  try {
    const countyFips = parseCountyFips(req.params.countyFips);
    if (!countyFips) {
      return res.status(400).json({ message: "countyFips must be a 5 digit FIPS code" });
    }

    const notes = await storage.getCountyNotes(countyFips);
    res.json({
      countyFips,
      notes,
    });
  } catch (error) {
    console.error("[scout-v2] county notes error:", error);
    res.status(500).json({ message: "Failed to load county notes" });
  }
});

router.get("/county/:countyFips/entities", async (req: Request, res: Response) => {
  try {
    const countyFips = parseCountyFips(req.params.countyFips);
    if (!countyFips) {
      return res.status(400).json({ message: "countyFips must be a 5 digit FIPS code" });
    }

    const entities = await storage.getCountyEntities(countyFips);
    res.json({
      countyFips,
      entities,
    });
  } catch (error) {
    console.error("[scout-v2] county entities error:", error);
    res.status(500).json({ message: "Failed to load county entities" });
  }
});

router.get("/priority-order", async (_req: Request, res: Response) => {
  res.json({
    order: ["critical", "high", "medium", "low"].map((priority) => ({
      priority,
      rank: rankScoutLisaFindingPriority(priority),
    })),
  });
});

export default router;
