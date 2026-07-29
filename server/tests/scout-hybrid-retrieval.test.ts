import { describe, expect, it } from "vitest";
import {
  buildScoutHybridIndex,
  createScoutHybridSearchIndex,
  DeterministicDenseEmbeddingProvider,
  type ScoutHybridDocument,
} from "../services/scoutHybridRetrievalService";

const PENSACOLA = { countyFips: "12033", state: "FL" };
const DALLAS = { countyFips: "48113", state: "TX" };

async function makeIndex(documents: ScoutHybridDocument[]) {
  const embeddingProvider = new DeterministicDenseEmbeddingProvider(96);
  const artifact = await buildScoutHybridIndex({
    documents,
    embeddingProvider,
    chunkWords: 80,
    overlapWords: 10,
  });
  return {
    artifact,
    index: createScoutHybridSearchIndex({ artifact, embeddingProvider }),
  };
}

describe("Scout hybrid retrieval", () => {
  it("combines BM25 and dense scores while preserving linked evidence", async () => {
    const { index } = await makeIndex([
      {
        id: "roof-pensacola",
        kind: "provider",
        title: "Roof repair provider",
        body: "Published service coverage for roof leak repair.",
        sourceUrl: "https://example.com/providers/roof-pensacola",
        taxonomy: ["roofing"],
        locality: PENSACOLA,
        authority: "first_party",
      },
      {
        id: "plumbing-pensacola",
        kind: "provider",
        title: "Plumbing provider",
        body: "Published service coverage for sewer and drain repair.",
        sourceUrl: "https://example.com/providers/plumbing-pensacola",
        taxonomy: ["plumbing"],
        locality: PENSACOLA,
        authority: "first_party",
      },
    ]);

    const [result] = await index.search({
      text: "Find a roofer for a leaking roof",
      kind: "provider",
      locality: PENSACOLA,
      strictLocality: true,
      requireCountyMatch: true,
    });

    expect(result).toMatchObject({
      id: "roof-pensacola",
      sourceUrl: "https://example.com/providers/roof-pensacola",
      authority: "first_party",
    });
    expect(result?.bm25Score).toBeGreaterThan(0);
    expect(result?.denseScore).toBeGreaterThan(0);
  });

  it("filters jurisdiction before scoring and never leaks a better text match", async () => {
    const { index } = await makeIndex([
      {
        id: "roof-pensacola",
        kind: "provider",
        title: "Roof provider",
        body: "Roof repair service.",
        taxonomy: ["roofing"],
        locality: PENSACOLA,
      },
      {
        id: "roof-dallas",
        kind: "provider",
        title: "Exact emergency roof leak specialist",
        body: "Exact emergency roof leak repair with matching search terms.",
        taxonomy: ["roofing"],
        locality: DALLAS,
      },
    ]);

    const results = await index.search({
      text: "exact emergency roof leak repair",
      kind: "provider",
      locality: PENSACOLA,
      strictLocality: true,
      requireCountyMatch: true,
    });

    expect(results.map((result) => result.id)).toEqual(["roof-pensacola"]);
  });

  it("excludes expired, superseded, stale, and undated records when required", async () => {
    const common = {
      kind: "knowledge" as const,
      title: "Electrical panel permit",
      body: "Electrical service panel replacement permit requirements.",
      taxonomy: ["electrical", "permit"],
      locality: PENSACOLA,
    };
    const { index } = await makeIndex([
      {
        ...common,
        id: "fresh",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      {
        ...common,
        id: "expired",
        updatedAt: "2026-07-01T00:00:00.000Z",
        expiresAt: "2026-07-20T00:00:00.000Z",
      },
      {
        ...common,
        id: "superseded",
        updatedAt: "2026-07-01T00:00:00.000Z",
        supersededAt: "2026-07-20T00:00:00.000Z",
      },
      {
        ...common,
        id: "stale",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      {
        ...common,
        id: "undated",
      },
    ]);

    const results = await index.search({
      text: "electrical panel permit",
      kind: "knowledge",
      locality: PENSACOLA,
      strictLocality: true,
      requireCountyMatch: true,
      asOf: "2026-07-29T00:00:00.000Z",
      maxAgeDays: 365,
      requireFreshnessMetadata: true,
    });

    expect(results.map((result) => result.id)).toEqual(["fresh"]);
  });

  it("records the embedding provider and rejects a mismatched runtime", async () => {
    const firstProvider = new DeterministicDenseEmbeddingProvider(64);
    const artifact = await buildScoutHybridIndex({
      documents: [
        {
          id: "guide",
          kind: "knowledge",
          title: "Guide",
          body: "Reviewed plumbing guide.",
        },
      ],
      embeddingProvider: firstProvider,
    });

    expect(artifact.embedding).toEqual({
      provider: "deterministic_offline",
      model: "feature-hash-v1",
      dimensions: 64,
    });
    expect(() =>
      createScoutHybridSearchIndex({
        artifact,
        embeddingProvider: new DeterministicDenseEmbeddingProvider(96),
      })
    ).toThrow(/does not match/);
  });
});
