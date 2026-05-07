import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import { generateGeminiTextWithFallback } from "../ai/geminiFallback";
import { db } from "../db";
import { storage } from "../storage";
import { webSearch } from "./webSearchService";
import { compressScoutPrompt, isFaqStyleScoutQuery } from "./scoutOptimizationEngine";
import { loadScoutKnowledgeBase, type ScoutKnowledgeEntry } from "./scoutKnowledgeLoader";
import { counties } from "../../shared/schema";

export type ScoutConfidence = "high" | "medium" | "low";
export type ScoutSourceName = "knowledge_base" | "local_data" | "live_web";

export interface ScoutSourceItem {
  title: string;
  detail: string;
  evidence: string[];
  confidence: ScoutConfidence;
  sourceName: ScoutSourceName;
  filePath?: string;
  scopeRef?: string | null;
}

export interface ScoutSourceBundle {
  sourceName: ScoutSourceName;
  status: "ready" | "not_yet_indexed";
  note: string;
  confidence: ScoutConfidence;
  items: ScoutSourceItem[];
}

export interface ScoutMissionRequest {
  query: string;
  countyFips?: string;
  stateCode?: string;
  trade?: string;
  missionId?: string;
  cacheKey?: string;
  learningMode?: boolean;
  userId?: string | null;
}

export interface ScoutMissionSummary {
  what: string;
  why: string;
  whatToDo: string;
  confidence: ScoutConfidence;
}

export interface ScoutMissionConflict {
  source: ScoutSourceName;
  resolution: string;
}

export interface ScoutMissionSynthesis {
  missionId: string;
  cacheKey: string;
  query: string;
  countyFips?: string;
  stateCode?: string;
  trade?: string;
  learningMode: boolean;
  generatedAt: string;
  sourcePriority: ScoutSourceName[];
  bundles: {
    knowledgeBase: ScoutSourceBundle;
    localData: ScoutSourceBundle;
    liveWeb: ScoutSourceBundle;
  };
  summary: ScoutMissionSummary;
  conflictsResolved: ScoutMissionConflict[];
  evidence: string[];
  prompt: {
    usedLlm: boolean;
    model?: string;
    rawChars: number;
    compressedChars: number;
    skippedReason?: string;
  };
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function clampConfidence(value: unknown, fallback: ScoutConfidence): ScoutConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

function summarizeEvidence(items: ScoutSourceItem[]): string[] {
  return items.flatMap((item) => item.evidence).filter((value) => String(value || "").trim());
}

function buildTradeLabel(query: string, trade?: string): string {
  const explicitTrade = normalizeText(trade);
  if (explicitTrade) {
    return explicitTrade;
  }

  const lower = query.toLowerCase();
  if (/\belectrical|electrician|breaker|panel|outlet|receptacle\b/.test(lower)) return "electrical";
  if (/\bplumbing|plumber|pipe|drain|water heater\b/.test(lower)) return "plumbing";
  if (/\bhvac|heating|cooling|air conditioning\b/.test(lower)) return "hvac";
  if (/\broof|roofing|shingle\b/.test(lower)) return "roofing";
  if (/\bframing|carpentry|deck|wood\b/.test(lower)) return "carpentry";
  if (/\bconcrete|foundation|slab\b/.test(lower)) return "concrete";
  if (/\bpricing|price|cost|estimate|material\b/.test(lower)) return "pricing";
  return "";
}

function countyLabelFromFips(countyFips?: string): string {
  return /^\d{5}$/.test(String(countyFips || "")) ? String(countyFips) : "";
}

function buildKnowledgeBundle(
  input: ScoutMissionRequest,
  entries: ScoutKnowledgeEntry[]
): ScoutSourceBundle {
  if (!entries.length) {
    return {
      sourceName: "knowledge_base",
      status: "not_yet_indexed",
      note: "TradeScout Brain is not yet indexed for this mission.",
      confidence: "low",
      items: [],
    };
  }

  return {
    sourceName: "knowledge_base",
    status: "ready",
    note: "TradeScout Brain indexed this mission with direct source matches.",
    confidence: "high",
    items: entries.slice(0, 5).map((entry) => ({
      title: entry.title,
      detail: entry.excerpt,
      evidence: [`file=${entry.filePath}`, `score=${entry.score}`],
      confidence: "high",
      sourceName: "knowledge_base",
      filePath: entry.filePath,
      scopeRef: input.countyFips || null,
    })),
  };
}

async function loadLocalDataBundle(input: ScoutMissionRequest): Promise<ScoutSourceBundle> {
  if (!input.countyFips || !/^\d{5}$/.test(input.countyFips)) {
    return {
      sourceName: "local_data",
      status: "not_yet_indexed",
      note: "No countyFips was supplied, so the local county layer stayed idle.",
      confidence: "low",
      items: [],
    };
  }

  const [countyRecord, metrics, notes, entities] = await Promise.all([
    db.select().from(counties).where(eq(counties.fips, input.countyFips)).limit(1),
    storage.getCountyMetricsForCounty({ countyFips: input.countyFips }),
    storage.getCountyNotes(input.countyFips),
    storage.getCountyEntities(input.countyFips),
  ]);

  const countyName = countyRecord[0]?.name ? String(countyRecord[0].name) : input.countyFips;

  const metricItems = metrics.slice(0, 8).map((metric) => ({
    title: `${metric.metricKey}`,
    detail: `${countyName}: ${metric.metricKey} = ${metric.metricValue}`,
    evidence: [
      `county_fips=${metric.countyFips}`,
      `metric_key=${metric.metricKey}`,
      `metric_value=${metric.metricValue}`,
    ],
    confidence: "medium" as ScoutConfidence,
    sourceName: "local_data" as const,
    scopeRef: input.countyFips || null,
  }));

  const noteItems = notes.slice(0, 4).map((note) => ({
    title: `County note: ${note.category}`,
    detail: normalizeText(String(note.content || "")).slice(0, 500),
    evidence: [`note_id=${note.id}`, `category=${note.category}`],
    confidence: "medium" as ScoutConfidence,
    sourceName: "local_data" as const,
    scopeRef: input.countyFips || null,
  }));

  const entityItems = entities.slice(0, 4).map((entity) => ({
    title: `County entity: ${entity.entityType}`,
    detail: normalizeText(String(entity.label || entity.entityId || "Unnamed entity")).slice(
      0,
      500
    ),
    evidence: [`entity_id=${entity.id}`, `entity_type=${entity.entityType}`],
    confidence: "medium" as ScoutConfidence,
    sourceName: "local_data" as const,
    scopeRef: input.countyFips || null,
  }));

  const items = [...metricItems, ...noteItems, ...entityItems];
  if (!items.length) {
    return {
      sourceName: "local_data",
      status: "not_yet_indexed",
      note: `County data for ${countyName} is not yet indexed into county_metrics, county_notes, or county_entities.`,
      confidence: "low",
      items: [],
    };
  }

  return {
    sourceName: "local_data",
    status: "ready",
    note: `County data indexed for ${countyName}.`,
    confidence: "medium",
    items,
  };
}

async function loadLiveWebBundle(
  input: ScoutMissionRequest,
  allowWeb: boolean
): Promise<ScoutSourceBundle> {
  if (!allowWeb) {
    return {
      sourceName: "live_web",
      status: "not_yet_indexed",
      note: "Live web search was intentionally skipped for this mission.",
      confidence: "low",
      items: [],
    };
  }

  const locality = [input.countyFips, input.stateCode].filter(Boolean).join(", ");
  const query = locality ? `${input.query} (${locality})` : input.query;
  const result = await webSearch(query, 5);

  if (!result.success || !result.content) {
    return {
      sourceName: "live_web",
      status: "not_yet_indexed",
      note: result.error || "Live web search did not return indexed results.",
      confidence: "low",
      items: [],
    };
  }

  return {
    sourceName: "live_web",
    status: "ready",
    note: result.provider
      ? `Live web context retrieved via ${result.provider}.`
      : "Live web context retrieved.",
    confidence: "low",
    items: [
      {
        title: "Live web context",
        detail: normalizeText(result.content).slice(0, 1200),
        evidence: [result.provider ? `provider=${result.provider}` : "provider=unknown"],
        confidence: "low",
        sourceName: "live_web",
        scopeRef: input.countyFips || input.stateCode || null,
      },
    ],
  };
}

function chooseBestBundle(
  knowledgeBase: ScoutSourceBundle,
  localData: ScoutSourceBundle,
  liveWeb: ScoutSourceBundle
): ScoutSourceBundle | null {
  if (knowledgeBase.items.length > 0) return knowledgeBase;
  if (localData.items.length > 0) return localData;
  if (liveWeb.items.length > 0) return liveWeb;
  return null;
}

function buildWhatToDo(
  input: ScoutMissionRequest,
  bundles: {
    knowledgeBase: ScoutSourceBundle;
    localData: ScoutSourceBundle;
    liveWeb: ScoutSourceBundle;
  },
  countyLabel: string
): string {
  const lower = input.query.toLowerCase();
  if (/\b(code|permit|inspection|zoning|setback|occupancy)\b/.test(lower)) {
    return countyLabel
      ? `Verify the county and jurisdiction rule for ${countyLabel} before you contact anyone, then record the final rule back into county_notes.`
      : "Verify the local jurisdiction rule before you contact anyone, then record the final rule back into county_notes.";
  }

  if (/\b(price|cost|estimate|pricing|material)\b/.test(lower)) {
    return bundles.localData.items.length > 0
      ? "Use the county metrics as the anchor, keep the web layer tertiary, and update the mission once the price signal is confirmed."
      : "Gather a county-scoped price signal, write it into county_metrics, and rerun the mission.";
  }

  if (input.learningMode) {
    return "Capture the missing county intelligence in county_metrics, county_entities, or county_notes, then rerun Scout 2.0 so the mission can learn from the new local evidence.";
  }

  return "Keep the county container updated, rerun the mission when fresh local data is available, and treat live web context as tertiary support only.";
}

function buildWhy(
  input: ScoutMissionRequest,
  knowledgeBase: ScoutSourceBundle,
  localData: ScoutSourceBundle,
  liveWeb: ScoutSourceBundle
): string {
  const parts: string[] = [];
  if (knowledgeBase.items.length > 0) {
    parts.push(knowledgeBase.note);
  }
  if (localData.items.length > 0) {
    parts.push(localData.note);
  }
  if (liveWeb.items.length > 0) {
    parts.push(liveWeb.note);
  }

  if (!parts.length) {
    return "Scout did not find this mission yet, so there is nothing reliable to synthesize.";
  }

  const tradeLabel = buildTradeLabel(input.query, input.trade);
  if (tradeLabel) {
    parts.push(`Mission focus: ${tradeLabel}.`);
  }

  return parts.join(" ");
}

function buildWhat(
  input: ScoutMissionRequest,
  knowledgeBase: ScoutSourceBundle,
  localData: ScoutSourceBundle,
  liveWeb: ScoutSourceBundle
): string {
  const best = chooseBestBundle(knowledgeBase, localData, liveWeb);
  if (best?.items.length) {
    return best.items[0].detail || best.note;
  }

  const tradeLabel = buildTradeLabel(input.query, input.trade);
  if (tradeLabel) {
    return `Scout did not find indexed ${tradeLabel} intelligence for this mission yet.`;
  }

  return "Scout did not find this mission yet in TradeScout Brain or the county containers.";
}

function buildConflicts(
  knowledgeBase: ScoutSourceBundle,
  localData: ScoutSourceBundle,
  liveWeb: ScoutSourceBundle
): ScoutMissionConflict[] {
  const conflicts: ScoutMissionConflict[] = [];

  if (knowledgeBase.items.length > 0 && localData.items.length > 0) {
    conflicts.push({
      source: "local_data",
      resolution:
        "County data was treated as corroboration, but the indexed TradeScout Brain remained the higher-trust source.",
    });
  }

  if ((knowledgeBase.items.length > 0 || localData.items.length > 0) && liveWeb.items.length > 0) {
    conflicts.push({
      source: "live_web",
      resolution:
        "Live web context was kept tertiary and could not override indexed TradeScout or county data.",
    });
  }

  return conflicts;
}

function stripCodeFences(text: string): string {
  return String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeSummary(
  raw: Record<string, unknown> | null,
  fallback: ScoutMissionSummary
): ScoutMissionSummary {
  if (!raw) {
    return fallback;
  }

  return {
    what: normalizeText(raw.what).slice(0, 1200) || fallback.what,
    why: normalizeText(raw.why).slice(0, 1400) || fallback.why,
    whatToDo: normalizeText(raw.whatToDo).slice(0, 1000) || fallback.whatToDo,
    confidence: clampConfidence(raw.confidence, fallback.confidence),
  };
}

function normalizeConflictList(raw: unknown): ScoutMissionConflict[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = String((item as Record<string, unknown>).source || "").trim();
      const resolution = normalizeText((item as Record<string, unknown>).resolution).slice(0, 500);
      if (!source || !resolution) return null;
      if (source !== "knowledge_base" && source !== "local_data" && source !== "live_web") {
        return null;
      }
      return { source, resolution } as ScoutMissionConflict;
    })
    .filter((item): item is ScoutMissionConflict => item !== null);
}

function buildPrompt(
  input: ScoutMissionRequest,
  knowledgeBase: ScoutSourceBundle,
  localData: ScoutSourceBundle,
  liveWeb: ScoutSourceBundle
): string {
  const payload = {
    mission: {
      query: input.query,
      countyFips: input.countyFips || null,
      stateCode: input.stateCode || null,
      trade: input.trade || null,
      learningMode: Boolean(input.learningMode),
    },
    sourcePriority: ["knowledge_base", "local_data", "live_web"],
    sources: {
      knowledgeBase,
      localData,
      liveWeb,
    },
    outputContract: {
      what: "One concise statement of the most important verified finding.",
      why: "Why that finding matters for the county or trade.",
      whatToDo: "One concrete next step that preserves county and trust invariants.",
      confidence: "high | medium | low",
      conflictsResolved: [
        { source: "knowledge_base | local_data | live_web", resolution: "short explanation" },
      ],
    },
    rules: [
      "Use knowledge_base first, county/local data second, live web third.",
      "Do not invent missing data.",
      "If nothing is indexed, say 'not yet indexed'.",
      "Keep the answer in What / Why / What to do language.",
    ],
  };

  return compressScoutPrompt(
    `You are Scout 2.0 for TradeScout.\nReturn strict JSON only.\n\n${JSON.stringify(payload, null, 2)}`,
    9000
  );
}

function fallbackSummary(
  input: ScoutMissionRequest,
  knowledgeBase: ScoutSourceBundle,
  localData: ScoutSourceBundle,
  liveWeb: ScoutSourceBundle
): ScoutMissionSummary {
  const best = chooseBestBundle(knowledgeBase, localData, liveWeb);
  const confidence: ScoutConfidence =
    knowledgeBase.items.length > 0 ? "high" : localData.items.length > 0 ? "medium" : "low";
  const countyLabel = countyLabelFromFips(input.countyFips);

  if (!best) {
    return {
      what: "Scout did not find this mission yet in TradeScout Brain or the county containers.",
      why: "No indexed source returned a reliable match.",
      whatToDo: buildWhatToDo(input, { knowledgeBase, localData, liveWeb }, countyLabel),
      confidence: "low",
    };
  }

  return {
    what: buildWhat(input, knowledgeBase, localData, liveWeb),
    why: buildWhy(input, knowledgeBase, localData, liveWeb),
    whatToDo: buildWhatToDo(input, { knowledgeBase, localData, liveWeb }, countyLabel),
    confidence,
  };
}

async function maybeRunLlm(
  input: ScoutMissionRequest,
  knowledgeBase: ScoutSourceBundle,
  localData: ScoutSourceBundle,
  liveWeb: ScoutSourceBundle
): Promise<{
  summary: ScoutMissionSummary;
  used: boolean;
  model?: string;
  skippedReason?: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      summary: fallbackSummary(input, knowledgeBase, localData, liveWeb),
      used: false,
      skippedReason: "GEMINI_API_KEY not configured",
    };
  }

  if (isFaqStyleScoutQuery(input.query) && !input.learningMode) {
    return {
      summary: fallbackSummary(input, knowledgeBase, localData, liveWeb),
      used: false,
      skippedReason: "FAQ-style query routed around LLM",
    };
  }

  const hasAnyData =
    knowledgeBase.items.length > 0 || localData.items.length > 0 || liveWeb.items.length > 0;
  if (!hasAnyData) {
    return {
      summary: fallbackSummary(input, knowledgeBase, localData, liveWeb),
      used: false,
      skippedReason: "No indexed data available",
    };
  }

  const prompt = buildPrompt(input, knowledgeBase, localData, liveWeb);
  const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  try {
    const { text, model } = await generateGeminiTextWithFallback(gemini, prompt);
    const parsed = safeJsonParse(text);
    return {
      summary: normalizeSummary(parsed, fallbackSummary(input, knowledgeBase, localData, liveWeb)),
      used: true,
      model,
    };
  } catch (error) {
    return {
      summary: fallbackSummary(input, knowledgeBase, localData, liveWeb),
      used: false,
      skippedReason: error instanceof Error ? error.message : "LLM synthesis failed",
    };
  }
}

export async function synthesizeScoutMission(
  input: ScoutMissionRequest
): Promise<ScoutMissionSynthesis> {
  const missionId = normalizeText(input.missionId) || `mission-${Date.now()}`;
  const cacheKey = normalizeText(input.cacheKey) || missionId;
  const generatedAt = new Date().toISOString();

  const knowledgeBaseLoad = await loadScoutKnowledgeBase({
    query: input.query,
    countyFips: input.countyFips,
    stateCode: input.stateCode,
    trade: input.trade,
    limit: 5,
  });
  const knowledgeBase = buildKnowledgeBundle(input, knowledgeBaseLoad.entries);
  const localData = await loadLocalDataBundle(input);

  const allowWeb =
    !knowledgeBase.items.length ||
    /\b(latest|current|today|market|price|cost|estimate|permit|code|building|material)\b/i.test(
      input.query
    ) ||
    input.learningMode === true;
  const liveWeb = await loadLiveWebBundle(input, allowWeb);

  const llmResult = await maybeRunLlm(input, knowledgeBase, localData, liveWeb);
  const countyLabel = countyLabelFromFips(input.countyFips);
  const fallback = fallbackSummary(input, knowledgeBase, localData, liveWeb);
  const summary = llmResult.summary || fallback;
  const sourcePriority: ScoutSourceName[] = ["knowledge_base", "local_data", "live_web"];
  const conflictsResolved = buildConflicts(knowledgeBase, localData, liveWeb);
  const evidence = Array.from(
    new Set([
      ...summarizeEvidence(knowledgeBase.items),
      ...summarizeEvidence(localData.items),
      ...summarizeEvidence(liveWeb.items),
    ])
  );

  const rawPrompt = buildPrompt(input, knowledgeBase, localData, liveWeb);

  return {
    missionId,
    cacheKey,
    query: input.query,
    countyFips: input.countyFips,
    stateCode: input.stateCode,
    trade: input.trade,
    learningMode: Boolean(input.learningMode),
    generatedAt,
    sourcePriority,
    bundles: {
      knowledgeBase,
      localData,
      liveWeb,
    },
    summary,
    conflictsResolved,
    evidence: evidence.length
      ? evidence
      : [
          countyLabel ? `county_fips=${countyLabel}` : "county_fips=not_provided",
          "not_yet_indexed=true",
        ],
    prompt: {
      usedLlm: llmResult.used,
      model: llmResult.model,
      rawChars: rawPrompt.length,
      compressedChars: compressScoutPrompt(rawPrompt, 9000).length,
      skippedReason: llmResult.skippedReason,
    },
  };
}
