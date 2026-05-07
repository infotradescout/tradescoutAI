import { createHash } from "node:crypto";
import type { LisaFeedItem } from "../../shared/lisa";
import type {
  ScoutMissionSynthesis,
  ScoutSourceBundle,
  ScoutConfidence,
} from "./scoutMultiSourceSynthesis";

export interface ScoutLisaConversionResult {
  items: LisaFeedItem[];
}

export interface ScoutLisaConversionOptions {
  engineVersion?: string;
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function mapScoutConfidenceToPriority(
  confidence: ScoutConfidence
): LisaFeedItem["priority"] {
  if (confidence === "high") return "critical";
  if (confidence === "medium") return "high";
  return "medium";
}

function buildScopeType(input: ScoutMissionSynthesis): LisaFeedItem["scopeType"] {
  if (input.countyFips) return "county";
  if (input.trade) return "category";
  return "global";
}

function buildScopeRef(input: ScoutMissionSynthesis): string | null {
  const parts: string[] = [];
  if (input.countyFips) {
    parts.push(input.countyFips);
  }
  if (input.trade) {
    parts.push(`trade:${input.trade}`);
  }
  return parts.length ? parts.join(", ") : null;
}

function buildNarrative(what: string, why: string, whatToDo: string): string {
  return `What: ${what}\nWhy: ${why}\nWhat to do: ${whatToDo}`;
}

function buildEvidence(bundle: ScoutSourceBundle): string[] {
  return bundle.items.flatMap((item) => item.evidence);
}

function buildBundleItems(
  analysis: ScoutMissionSynthesis,
  bundle: ScoutSourceBundle,
  options: ScoutLisaConversionOptions,
  suffix: string
): LisaFeedItem[] {
  if (!bundle.items.length) {
    return [];
  }

  const scopeType = buildScopeType(analysis);
  const scopeRef = buildScopeRef(analysis);
  const engineVersion = options.engineVersion || "scout-v2";

  return bundle.items.slice(0, 3).map((item, index) => {
    const content = buildNarrative(item.detail, bundle.note, analysis.summary.whatToDo);
    return {
      id: `scout-v2:${hashKey(`${analysis.cacheKey}:${suffix}:${index}:${item.title}`)}`,
      priority: mapScoutConfidenceToPriority(item.confidence),
      sourceKind: "scout_intelligence",
      headline: item.title,
      narrative: content,
      evidence: item.evidence.length ? item.evidence : buildEvidence(bundle),
      freshnessMinutes: 0,
      truthStatus: "current",
      scopeType,
      scopeRef,
      engineVersion,
    };
  });
}

export function convertScoutMissionToLisaItems(
  analysis: ScoutMissionSynthesis,
  options: ScoutLisaConversionOptions = {}
): ScoutLisaConversionResult {
  const engineVersion = options.engineVersion || "scout-v2";
  const scopeType = buildScopeType(analysis);
  const scopeRef = buildScopeRef(analysis);
  const primaryNarrative = buildNarrative(
    analysis.summary.what,
    analysis.summary.why,
    analysis.summary.whatToDo
  );

  const primary: LisaFeedItem = {
    id: `scout-v2:${hashKey(`${analysis.cacheKey}:primary`)}`,
    priority: mapScoutConfidenceToPriority(analysis.summary.confidence),
    sourceKind: "scout_intelligence",
    headline: `Scout 2.0 mission: ${analysis.query}`,
    narrative: primaryNarrative,
    evidence: analysis.evidence,
    freshnessMinutes: 0,
    truthStatus: "current",
    scopeType,
    scopeRef,
    engineVersion,
  };

  const knowledgeItems = buildBundleItems(analysis, analysis.bundles.knowledgeBase, options, "kb");
  const localItems = buildBundleItems(analysis, analysis.bundles.localData, options, "local");
  const webItems = buildBundleItems(analysis, analysis.bundles.liveWeb, options, "web");

  const gapItem: LisaFeedItem | null =
    analysis.bundles.knowledgeBase.items.length === 0 &&
    analysis.bundles.localData.items.length === 0 &&
    analysis.bundles.liveWeb.items.length === 0
      ? {
          id: `scout-v2:${hashKey(`${analysis.cacheKey}:gap`)}`,
          priority: "medium",
          sourceKind: "scout_intelligence",
          headline: "Scout 2.0 mission is not yet indexed",
          narrative: buildNarrative(
            "Scout did not find a verified source for this mission yet.",
            "There is no indexed TradeScout Brain or county data match to override with invented detail.",
            analysis.learningMode
              ? "Index the missing county fact in county_metrics, county_entities, or county_notes, then rerun the mission."
              : "Add the missing county data or better source material, then rerun the mission."
          ),
          evidence: ["not_yet_indexed=true", `query=${analysis.query}`],
          freshnessMinutes: 0,
          truthStatus: "current",
          scopeType,
          scopeRef,
          engineVersion,
        }
      : null;

  return {
    items: [primary, ...knowledgeItems, ...localItems, ...webItems, ...(gapItem ? [gapItem] : [])],
  };
}
