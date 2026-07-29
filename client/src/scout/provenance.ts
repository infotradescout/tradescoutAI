import type { ScoutBackendResponse } from "./api";
import type { ScoutKnowledgeSource, ScoutMessage } from "./state";

export function safeScoutSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function normalizeScoutKnowledgeSources(
  value: NonNullable<ScoutBackendResponse["knowledge"]>["sources"]
): ScoutKnowledgeSource[] {
  if (!Array.isArray(value)) return [];

  const sources: ScoutKnowledgeSource[] = [];
  const seen = new Set<string>();
  for (const source of value) {
    if (!source) continue;

    const normalized = (() => {
      if (typeof source === "string") {
        const title = source.trim();
        return title ? { title } : null;
      }

      const url = safeScoutSourceUrl(source.url);
      const type = typeof source.type === "string" ? source.type.trim() : "";
      if (type === "url_citation" && !url) return null;
      const title =
        typeof source.title === "string" && source.title.trim().length > 0
          ? source.title.trim()
          : url;
      if (!title) return null;

      return {
        title,
        ...(url ? { url } : {}),
        ...(type ? { type } : {}),
        ...(typeof source.provider === "string" && source.provider.trim()
          ? { provider: source.provider.trim() }
          : {}),
      };
    })();

    if (!normalized) continue;
    const key = `${normalized.title}\n${normalized.url || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(normalized);
  }

  return sources;
}

export function buildScoutProvenance(
  response: Pick<ScoutBackendResponse, "metadata" | "knowledge" | "evidence">
): ScoutMessage["provenance"] {
  const sources = normalizeScoutKnowledgeSources([
    ...(response.knowledge?.sources || []),
    ...(response.evidence || []).map((source) => ({
      title: source.title,
      url: source.url || undefined,
      type: source.type,
      provider: source.provider,
    })),
  ]);
  return {
    sourceUsed: response.metadata?.sourceUsed,
    attemptedSource: response.metadata?.attemptedSource,
    fallbackUsed: response.metadata?.fallbackUsed,
    degradationReason: response.metadata?.degradationReason,
    confidenceBand: response.metadata?.confidenceBand,
    knowledgeLayer: response.knowledge?.layer,
    sources,
    sourceTitles: sources.map((source) => source.title),
    resolvedStage: response.metadata?.resolvedContext?.stage,
    blockingReason: response.metadata?.resolvedContext?.blockingReason ?? null,
    allowedActions: Array.isArray(response.metadata?.resolvedContext?.allowedActions)
      ? response.metadata?.resolvedContext?.allowedActions
      : [],
  };
}
