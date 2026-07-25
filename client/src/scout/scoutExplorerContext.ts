import {
  getScoutContextCache,
  hasAreaInScoutContext,
  hasMaterialInScoutContext,
  patchScoutContextCache,
  type ScoutContextCacheEntry,
  type ScoutContextPendingAskKey,
} from "@/lib/scoutContextCache";

const AREA_NEED_PATTERN =
  /\b(near me|in my area|local|nearby|my county|around here|this week|available|find|looking for|contractor|plumber|electrician|roofer|hvac|community|direct connect)\b/i;

const MATERIAL_NEED_PATTERN =
  /\b(stone|onyx|marble|quartz|granite|slab|material|countertop|tile)\b/i;

const PROJECT_NEED_PATTERN =
  /\b(help me|what should i|next step|project|remodel|kitchen|bath|install|quote|estimate)\b/i;

export type ExplorerContextDecision =
  | { kind: "continue"; cache: ScoutContextCacheEntry | null }
  | {
      kind: "ask";
      cache: ScoutContextCacheEntry;
      key: ScoutContextPendingAskKey;
      prompt: string;
    }
  | {
      kind: "answered";
      cache: ScoutContextCacheEntry;
      key: ScoutContextPendingAskKey;
      continueMessage: string;
    };

export function buildMissingContextPrompt(key: ScoutContextPendingAskKey): string {
  if (key === "area") {
    return "To keep this useful without an account, where should I focus — city and state, or your county?";
  }
  if (key === "material") {
    return "Which material or stone are you looking at? A name or product is enough.";
  }
  return "What are you trying to get done first? One short sentence is enough.";
}

export function nextMissingExplorerContextKey(
  cache: ScoutContextCacheEntry | null,
  message: string,
  locality?: {
    county?: string;
    countyName?: string;
    countyFips?: string;
    state?: string;
    stateCode?: string;
    city?: string;
  } | null
): ScoutContextPendingAskKey | null {
  const asked = new Set(cache?.askedKeys || []);
  const needsArea = AREA_NEED_PATTERN.test(message);
  const needsMaterial = MATERIAL_NEED_PATTERN.test(message);
  const needsProject = PROJECT_NEED_PATTERN.test(message);

  if (needsArea && !hasAreaInScoutContext(cache, locality) && !asked.has("area")) {
    return "area";
  }

  if (needsMaterial && !hasMaterialInScoutContext(cache) && !asked.has("material")) {
    return "material";
  }

  if (needsProject && !cache?.projectSummary && !cache?.intent && !asked.has("project_goal")) {
    if (needsArea && !hasAreaInScoutContext(cache, locality)) return "area";
    return "project_goal";
  }

  return null;
}

export function tryParseExplorerContextAnswer(
  key: ScoutContextPendingAskKey,
  rawAnswer: string
): Partial<ScoutContextCacheEntry> | null {
  const answer = String(rawAnswer || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!answer || answer.length < 2) return null;

  if (key === "area") {
    const cityState = answer.match(/^([A-Za-z .'-]+?),\s*([A-Za-z]{2})\b/);
    if (cityState) {
      return {
        city: cityState[1].trim(),
        stateCode: cityState[2].toUpperCase(),
      };
    }
    const countyMatch = answer.match(/\b([A-Za-z .'-]+)\s+county\b/i);
    if (countyMatch) {
      return { countyName: countyMatch[1].trim() };
    }
    return { city: answer.slice(0, 120) };
  }

  if (key === "material") {
    const slug = answer
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 128);
    return {
      itemName: answer.slice(0, 120),
      ...(slug ? { itemId: slug, stone: slug } : {}),
    };
  }

  return {
    projectSummary: answer.slice(0, 500),
    intent: "explore",
  };
}

/**
 * Resolve explorer context for a Scout turn against the shared lib cache:
 * - If a pending ask exists, parse the answer into the cache.
 * - Else if required context is missing, ask (do not force signup).
 * - Else continue.
 */
export function resolveExplorerContextTurn(input: {
  message: string;
  locality?: {
    county?: string;
    countyName?: string;
    countyFips?: string;
    state?: string;
    stateCode?: string;
    city?: string;
  } | null;
}): ExplorerContextDecision {
  const cache = getScoutContextCache();
  const pendingKey = cache?.pendingAskKey;

  if (pendingKey) {
    const parsed = tryParseExplorerContextAnswer(pendingKey, input.message);
    if (parsed) {
      const deferred = cache?.deferredMessage?.trim();
      const next = patchScoutContextCache({
        ...parsed,
        clearPendingAsk: true,
        unsetFields: ["deferredMessage"],
      });
      if (!next) return { kind: "continue", cache: null };
      return {
        kind: "answered",
        cache: next,
        key: pendingKey,
        continueMessage: deferred || input.message,
      };
    }
    const prompt = cache?.pendingAskPrompt || buildMissingContextPrompt(pendingKey);
    const next =
      patchScoutContextCache({
        pendingAskKey: pendingKey,
        pendingAskPrompt: prompt,
        askedKeys: [pendingKey],
      }) || cache;
    return { kind: "ask", cache: next!, key: pendingKey, prompt };
  }

  const missingKey = nextMissingExplorerContextKey(cache, input.message, input.locality);
  if (missingKey) {
    const prompt = buildMissingContextPrompt(missingKey);
    const next = patchScoutContextCache({
      deferredMessage: input.message.slice(0, 500),
      pendingAskKey: missingKey,
      pendingAskPrompt: prompt,
      askedKeys: [missingKey],
      source: cache?.source || "scout_explorer",
    });
    if (!next) return { kind: "continue", cache };
    return { kind: "ask", cache: next, key: missingKey, prompt };
  }

  return { kind: "continue", cache };
}

export function explorerLocalityForScoutRequest(
  cache: ScoutContextCacheEntry | null,
  locality?: {
    county?: string;
    countyName?: string;
    countyFips?: string;
    state?: string;
    stateCode?: string;
    city?: string;
  } | null
) {
  return {
    county: locality?.county || locality?.countyName || cache?.countyName,
    countyName: locality?.countyName || locality?.county || cache?.countyName,
    countyFips: locality?.countyFips || cache?.countyFips,
    state: locality?.state || locality?.stateCode || cache?.stateCode,
    stateCode: locality?.stateCode || locality?.state || cache?.stateCode,
    city: locality?.city || cache?.city,
  };
}
