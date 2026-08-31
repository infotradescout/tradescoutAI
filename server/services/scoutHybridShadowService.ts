import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  createScoutHybridSearchIndex,
  DeterministicDenseEmbeddingProvider,
  OpenAIDenseEmbeddingProvider,
  type ScoutHybridIndexArtifact,
  type ScoutHybridQuery,
  type ScoutHybridSearchResult,
  type ScoutHybridSearchIndex,
} from "./scoutHybridRetrievalService";
import { GENERATED_SCOUT_CORPUS_RETRIEVAL_ENABLED } from "./scoutCorpusContainment";
import { resolveTradeScoutRuntimePaths } from "../runtimePaths";

export type ScoutHybridShadowObservation = {
  observedAt: string;
  queryHash: string;
  legacyIds: string[];
  shadowIds: string[];
  topScores: Array<{
    id: string;
    score: number;
    bm25Score: number;
    denseScore: number;
  }>;
  corpusDigest: string;
  embeddingProvider: string;
  embeddingModel: string;
};

type ShadowSearchInput = {
  query: ScoutHybridQuery;
  legacyIds?: string[];
};

const MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;
const observations: ScoutHybridShadowObservation[] = [];
let runtimeIndexPromise: Promise<ScoutHybridSearchIndex | null> | null = null;
let warnedUnavailable = false;

function enabled(value: unknown): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function queryHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function resolveIndexPath(): string {
  return resolveTradeScoutRuntimePaths(process.env).scoutHybridIndex;
}

function createEmbeddingProvider(artifact: ScoutHybridIndexArtifact) {
  if (artifact.embedding.provider === "openai") {
    const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for the configured Scout hybrid index");
    }
    return new OpenAIDenseEmbeddingProvider({
      apiKey,
      model: artifact.embedding.model,
      dimensions: artifact.embedding.dimensions,
    });
  }

  if (artifact.embedding.provider === "deterministic_offline") {
    if (
      process.env.NODE_ENV === "production" &&
      !enabled(process.env.SCOUT_HYBRID_ALLOW_OFFLINE_EMBEDDINGS)
    ) {
      throw new Error("Offline benchmark embeddings are disabled in production");
    }
    return new DeterministicDenseEmbeddingProvider(artifact.embedding.dimensions);
  }

  throw new Error(`Unsupported Scout hybrid embedding provider: ${artifact.embedding.provider}`);
}

async function loadRuntimeIndex(): Promise<ScoutHybridSearchIndex | null> {
  if (!enabled(process.env.SCOUT_HYBRID_SHADOW_ENABLED)) return null;
  if (runtimeIndexPromise) return runtimeIndexPromise;

  runtimeIndexPromise = Promise.resolve().then(() => {
    const indexPath = resolveIndexPath();
    if (!fs.existsSync(indexPath)) {
      if (!warnedUnavailable) {
        warnedUnavailable = true;
        console.warn("[ScoutHybridShadow] Index artifact is not available", { indexPath });
      }
      return null;
    }
    const stats = fs.statSync(indexPath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ARTIFACT_BYTES) {
      throw new Error("Scout hybrid index artifact is empty or exceeds the safety bound");
    }
    const artifact = JSON.parse(fs.readFileSync(indexPath, "utf8")) as ScoutHybridIndexArtifact;
    const embeddingProvider = createEmbeddingProvider(artifact);
    return createScoutHybridSearchIndex({ artifact, embeddingProvider });
  });

  return runtimeIndexPromise.catch((error) => {
    runtimeIndexPromise = null;
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.error("[ScoutHybridShadow] Failed to load index", error);
    }
    return null;
  });
}

export async function searchScoutHybridShadow(
  input: ShadowSearchInput
): Promise<ScoutHybridSearchResult[]> {
  const index = await loadRuntimeIndex();
  if (!index) return [];
  return index.search(input.query);
}

export async function observeScoutHybridShadow(
  input: ShadowSearchInput
): Promise<ScoutHybridShadowObservation | null> {
  if (!enabled(process.env.SCOUT_HYBRID_SHADOW_ENABLED)) return null;
  try {
    const index = await loadRuntimeIndex();
    if (!index) return null;
    const results = await index.search(input.query);
    const observation: ScoutHybridShadowObservation = {
      observedAt: new Date().toISOString(),
      queryHash: queryHash(input.query.text),
      legacyIds: (input.legacyIds || []).slice(0, 10),
      shadowIds: results.map((result) => result.id).slice(0, 10),
      topScores: results.slice(0, 10).map((result) => ({
        id: result.id,
        score: result.score,
        bm25Score: result.bm25Score,
        denseScore: result.denseScore,
      })),
      corpusDigest: index.artifact.corpusDigest,
      embeddingProvider: index.artifact.embedding.provider,
      embeddingModel: index.artifact.embedding.model,
    };
    observations.push(observation);
    if (observations.length > 100) observations.splice(0, observations.length - 100);
    console.info("[ScoutHybridShadow]", JSON.stringify(observation));
    return observation;
  } catch (error) {
    console.error("[ScoutHybridShadow] Observation failed", error);
    return null;
  }
}

export async function searchScoutHybridCutover(
  input: ShadowSearchInput
): Promise<ScoutHybridSearchResult[] | null> {
  if (!GENERATED_SCOUT_CORPUS_RETRIEVAL_ENABLED) {
    return null;
  }

  if (
    !enabled(process.env.SCOUT_HYBRID_SHADOW_ENABLED) ||
    !enabled(process.env.SCOUT_HYBRID_CUTOVER_ENABLED)
  ) {
    return null;
  }
  const index = await loadRuntimeIndex();
  if (!index || index.artifact.embedding.provider === "deterministic_offline") return null;
  const results = await index.search(input.query);
  if (!results.length || results.some((result) => !result.sourceUrl)) return null;
  return results;
}

export function getScoutHybridShadowObservations(): ScoutHybridShadowObservation[] {
  return observations.map((observation) => ({
    ...observation,
    legacyIds: [...observation.legacyIds],
    shadowIds: [...observation.shadowIds],
    topScores: observation.topScores.map((score) => ({ ...score })),
  }));
}

export function resetScoutHybridShadowForTests(): void {
  runtimeIndexPromise = null;
  warnedUnavailable = false;
  observations.splice(0, observations.length);
}
