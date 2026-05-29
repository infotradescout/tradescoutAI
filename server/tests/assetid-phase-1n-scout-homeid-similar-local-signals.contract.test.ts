import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1n scout homeid similar-home local signals contracts", () => {
  it("adds a thresholded similar-home local signal evaluator to Scout", () => {
    const source = read("client/src/scout/ScoutOS.tsx");
    expect(source).toContain("function evaluateHomeIdSimilarLocalSignals");
    expect(source).toContain("minimumSampleCount: 3");
    expect(source).toContain("sampleCount");
    expect(source).toContain("Similar-home local signals");
  });

  it("binds similar-home signals to real aggregate snapshot data and HomeID components", () => {
    const source = read("client/src/scout/ScoutOS.tsx");
    expect(source).toContain('"/api/scout/home-snapshot"');
    expect(source).toContain("scoutSourceSignalsQuery.data?.trendingPrompts");
    expect(source).toContain("homeIdContextRail.components");
    expect(source).toContain("homeIdContextRail.localTrendingPrompts");
  });
});
