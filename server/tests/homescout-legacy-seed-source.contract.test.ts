import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "server/services/homeScoutIngestionJob.ts"),
  "utf8"
);

describe("HomeScout legacy seed source contract", () => {
  it("skips deleted repo seed files without stale-inactivating listings", () => {
    expect(source).toContain("class MissingJsonFileSourceError extends Error");
    expect(source).toContain("function isLegacySeedSource");
    expect(source).toContain("/^seed_\\d{5}$/.test(sourceKey)");
    expect(source).toContain("missing_legacy_seed_file");
    expect(source).toContain("staleInactivated: 0");
    expect(source).toContain('status: "error"');
    expect(source).toContain("lastError: message");

    const skipIndex = source.indexOf("if (skippedMissingLegacySeed)");
    const staleIndex = source.indexOf("inactivateStaleHomeScoutListingsFromSource");
    expect(skipIndex).toBeGreaterThan(0);
    expect(staleIndex).toBeGreaterThan(skipIndex);

    const skipBlock = source.slice(skipIndex, staleIndex);
    expect(skipBlock).not.toContain("lastSuccessAt");
    expect(skipBlock).not.toContain("lastError: null");
  });
});
