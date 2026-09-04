import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildScoutHybridIndex,
  DeterministicDenseEmbeddingProvider,
} from "../services/scoutHybridRetrievalService";
import {
  getScoutHybridShadowObservations,
  observeScoutHybridShadow,
  resetScoutHybridShadowForTests,
  searchScoutHybridCutover,
  searchScoutHybridShadow,
} from "../services/scoutHybridShadowService";
import { runtimePaths } from "../runtimePaths";

const originalEnvironment = {
  enabled: process.env.SCOUT_HYBRID_SHADOW_ENABLED,
  cutover: process.env.SCOUT_HYBRID_CUTOVER_ENABLED,
  indexPath: process.env.SCOUT_HYBRID_INDEX_PATH,
};
const temporaryDirectories: string[] = [];
const originalRuntimeIndexPath = runtimePaths.scoutHybridIndex;

function restoreEnvironment(
  key: "SCOUT_HYBRID_SHADOW_ENABLED" | "SCOUT_HYBRID_CUTOVER_ENABLED" | "SCOUT_HYBRID_INDEX_PATH",
  value: string | undefined
) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  restoreEnvironment("SCOUT_HYBRID_SHADOW_ENABLED", originalEnvironment.enabled);
  restoreEnvironment("SCOUT_HYBRID_CUTOVER_ENABLED", originalEnvironment.cutover);
  restoreEnvironment("SCOUT_HYBRID_INDEX_PATH", originalEnvironment.indexPath);
  runtimePaths.scoutHybridIndex = originalRuntimeIndexPath;
  resetScoutHybridShadowForTests();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe.sequential("Scout hybrid shadow runtime", () => {
  it("records comparison telemetry without storing raw query text", async () => {
    const embeddingProvider = new DeterministicDenseEmbeddingProvider(64);
    const artifact = await buildScoutHybridIndex({
      documents: [
        {
          id: "source:panel-permit:12033",
          kind: "knowledge",
          title: "Electrical panel permit",
          body: "Reviewed electrical service panel permit guidance.",
          sourceUrl: "https://example.gov/panel-permit",
          locality: { countyFips: "12033", state: "FL" },
          taxonomy: ["electrical", "permit"],
        },
      ],
      embeddingProvider,
    });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scout-hybrid-shadow-"));
    temporaryDirectories.push(directory);
    const indexPath = path.join(directory, "index.json");
    fs.writeFileSync(indexPath, JSON.stringify(artifact));
    process.env.SCOUT_HYBRID_SHADOW_ENABLED = "true";
    process.env.SCOUT_HYBRID_INDEX_PATH = indexPath;
    runtimePaths.scoutHybridIndex = indexPath;
    resetScoutHybridShadowForTests();

    const query = {
      text: "Do I need an electrical panel permit?",
      kind: "knowledge" as const,
      locality: { countyFips: "12033", state: "FL" },
      strictLocality: true,
      requireCountyMatch: true,
    };
    const results = await searchScoutHybridShadow({ query });
    const observation = await observeScoutHybridShadow({
      query,
      legacyIds: ["legacy-file.docx"],
    });

    expect(results.map((result) => result.id)).toEqual([
      "source:panel-permit:12033",
    ]);
    expect(observation).toMatchObject({
      legacyIds: ["legacy-file.docx"],
      shadowIds: ["source:panel-permit:12033"],
      embeddingProvider: "deterministic_offline",
    });
    expect(observation?.queryHash).toHaveLength(24);
    expect(JSON.stringify(getScoutHybridShadowObservations())).not.toContain(query.text);
  });

  it("refuses user-facing cutover for an offline benchmark embedding artifact", async () => {
    const embeddingProvider = new DeterministicDenseEmbeddingProvider(64);
    const artifact = await buildScoutHybridIndex({
      documents: [
        {
          id: "guide",
          kind: "knowledge",
          title: "Permit guide",
          body: "Permit guidance.",
          sourceUrl: "https://example.gov/permit",
        },
      ],
      embeddingProvider,
    });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scout-hybrid-cutover-"));
    temporaryDirectories.push(directory);
    const indexPath = path.join(directory, "index.json");
    fs.writeFileSync(indexPath, JSON.stringify(artifact));
    process.env.SCOUT_HYBRID_SHADOW_ENABLED = "true";
    process.env.SCOUT_HYBRID_CUTOVER_ENABLED = "true";
    process.env.SCOUT_HYBRID_INDEX_PATH = indexPath;
    runtimePaths.scoutHybridIndex = indexPath;
    resetScoutHybridShadowForTests();

    await expect(
      searchScoutHybridCutover({
        query: { text: "permit guidance", kind: "knowledge" },
      })
    ).resolves.toBeNull();
  });
});
