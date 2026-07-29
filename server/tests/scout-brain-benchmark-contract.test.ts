import { describe, expect, it } from "vitest";
import {
  buildScoutBrainBenchmarkCases,
  buildScoutBrainBenchmarkCorpus,
} from "../../scripts/lib/scout-brain-benchmark-fixture";

describe("Scout Brain benchmark contract", () => {
  it("contains exactly 150 unique representative cases", () => {
    const cases = buildScoutBrainBenchmarkCases();
    const conversationSignatures = cases.map((item) =>
      JSON.stringify({
        history: item.history ?? [],
        query: item.query.trim().toLowerCase(),
      })
    );

    expect(cases).toHaveLength(150);
    expect(new Set(cases.map((item) => item.id)).size).toBe(150);
    expect(new Set(conversationSignatures).size).toBe(150);
  });

  it("keeps the intended benchmark distribution explicit", () => {
    const cases = buildScoutBrainBenchmarkCases();
    const byFamily = Object.groupBy(cases, (item) => item.family);
    const byIntent = Object.groupBy(cases, (item) => item.expectedIntent);

    expect(byFamily.provider).toHaveLength(60);
    expect(byFamily.code).toHaveLength(45);
    expect(byFamily.asset).toHaveLength(30);
    expect(byFamily.memory).toHaveLength(15);

    expect(byIntent.provider_search).toHaveLength(65);
    expect(byIntent.code_query).toHaveLength(50);
    expect(byIntent.asset_action).toHaveLength(35);
  });

  it("requires retrieval cases to name relevant records and a jurisdiction", () => {
    const cases = buildScoutBrainBenchmarkCases();
    const retrievalCases = cases.filter((item) => item.expectedRelevantIds.length > 0);

    expect(retrievalCases).toHaveLength(115);
    for (const item of retrievalCases) {
      expect(item.locality?.countyFips).toMatch(/^\d{5}$/);
      expect(item.locality?.state).toMatch(/^[A-Z]{2}$/);
      expect(item.expectedRelevantIds.length).toBeGreaterThan(0);
    }
  });

  it("keeps unmeasured provider evidence null in the controlled corpus", () => {
    const corpus = buildScoutBrainBenchmarkCorpus();
    const providers = corpus.filter((item) => item.kind === "provider");
    const knowledge = corpus.filter((item) => item.kind === "knowledge");

    expect(corpus).toHaveLength(105);
    expect(providers).toHaveLength(60);
    expect(knowledge).toHaveLength(45);
    for (const provider of providers) {
      expect(provider.measured.verification).toBeNull();
      expect(provider.measured.responseRate).toBeNull();
      expect(provider.measured.trust).toBeNull();
    }
  });

  it("marks all continuation cases as working-memory dependent", () => {
    const cases = buildScoutBrainBenchmarkCases();
    const memoryCases = cases.filter((item) => item.family === "memory");

    expect(memoryCases).toHaveLength(15);
    for (const item of memoryCases) {
      expect(item.requiresWorkingMemory).toBe(true);
      expect(item.history?.length).toBeGreaterThanOrEqual(2);
    }
  });
});
