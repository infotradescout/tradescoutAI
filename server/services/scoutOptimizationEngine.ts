type ScoutCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export interface ScoutOptimizationSnapshot<T> {
  value: T;
  cacheKey: string;
  cacheHit: boolean;
  deduped: boolean;
  route: "cache" | "inflight" | "compute";
}

export interface ScoutMissionCacheInput {
  query: string;
  countyFips?: string;
  stateCode?: string;
  trade?: string;
  contextKey?: string;
  learningMode?: boolean;
}

const responseCache = new Map<string, ScoutCacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildScoutMissionCacheKey(input: ScoutMissionCacheInput): string {
  const parts = [
    normalize(input.query),
    normalize(input.countyFips),
    normalize(input.stateCode),
    normalize(input.trade),
  ];
  const contextKey = normalize(input.contextKey);
  if (contextKey) parts.push(`context:${contextKey}`);
  parts.push(input.learningMode ? "learning" : "standard");
  return parts.join("|");
}

export function generateQueryHash(
  query: string,
  context?: { county?: string; state?: string; trade?: string; contextKey?: string }
): string {
  return buildScoutMissionCacheKey({
    query,
    countyFips: context?.county,
    stateCode: context?.state,
    trade: context?.trade,
    contextKey: context?.contextKey,
  });
}

export function checkFaqMatch(
  query: string
): { cachedAnswer: string; confidence: "high" | "medium"; reason: string } | null {
  if (!isFaqStyleScoutQuery(query)) {
    return null;
  }

  return null;
}

export function routeQuery(input: {
  query: string;
  userId?: string;
  isAuthenticated?: boolean;
  county?: string;
  state?: string;
}): { path: "compute"; skipLlm: boolean; reason: string } {
  return {
    path: "compute",
    skipLlm: false,
    reason: input.isAuthenticated ? "authenticated_scout_mission" : "guest_scout_mission",
  };
}

export function isFaqStyleScoutQuery(query: string): boolean {
  const lower = normalize(query);
  if (!lower) return false;

  return (
    /^(what|how|why|where|when|who|which)\b/.test(lower) ||
    /\b(what is|how does|how do|explain|define|faq|help me understand|walk me through)\b/.test(
      lower
    ) ||
    lower.length <= 48
  );
}

export function compressScoutPrompt(prompt: string, maxChars = 12000): string {
  const collapsed = String(prompt || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (collapsed.length <= maxChars) {
    return collapsed;
  }

  return collapsed.slice(0, maxChars);
}

export function pruneScoutOptimizationCache(): void {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (entry.expiresAt <= now) {
      responseCache.delete(key);
    }
  }
}

export async function runScoutMissionWithOptimization<T>(
  cacheKey: string,
  work: () => Promise<T>,
  options?: {
    ttlMs?: number;
  }
): Promise<ScoutOptimizationSnapshot<T>> {
  pruneScoutOptimizationCache();

  const cached = responseCache.get(cacheKey);
  if (cached) {
    return {
      value: cached.value as T,
      cacheKey,
      cacheHit: true,
      deduped: false,
      route: "cache",
    };
  }

  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    const value = (await inFlight) as T;
    return {
      value,
      cacheKey,
      cacheHit: false,
      deduped: true,
      route: "inflight",
    };
  }

  const promise = (async () => {
    const result = await work();
    const ttlMs = Math.max(15_000, Number(options?.ttlMs || 5 * 60_000));
    responseCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + ttlMs,
    });
    return result;
  })();

  inFlightRequests.set(cacheKey, promise as Promise<unknown>);

  try {
    const value = await promise;
    return {
      value,
      cacheKey,
      cacheHit: false,
      deduped: false,
      route: "compute",
    };
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
