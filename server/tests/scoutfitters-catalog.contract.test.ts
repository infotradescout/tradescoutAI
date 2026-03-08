import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("ScoutFitters catalog contracts", () => {
  it("config route exposes configured tier metadata for the curated catalog", () => {
    const source = read("server/routes/scoutfitters.ts");

    expect(source).toContain("const SCOUTFITTERS_TIER_KEYS = Array.from(ALLOWED_TIER_KEYS).sort()");
    expect(source).toContain("configuredTierKeys");
    expect(source).toContain("variantsConfigured");
    expect(source).toContain("catalog: SCOUTFITTERS_TIER_KEYS.map((key) => ({");
  });

  it("marketing page loads live ScoutFitters config and renders value tiers directly", () => {
    const source = read("client/src/pages/marketing/ScoutFitters.tsx");

    expect(source).toContain('fetch("/api/scoutfitters/config"');
    expect(source).toContain("const contractorTierKeys = useMemo(");
    expect(source).toContain("const valueTierKeys = useMemo(");
    expect(source).toContain("{valueTierKeys.length > 0 && (");
    expect(source).not.toContain("showValueOptions");
  });

  it("draft orders stay gated by fulfillment readiness", () => {
    const source = read("client/src/pages/marketing/ScoutFitters.tsx");

    expect(source).toContain('setSubmitError("ScoutFitters fulfillment is not configured yet.")');
    expect(source).toContain(
      'setSubmitError("The selected merch option is not configured for fulfillment yet.")'
    );
    expect(source).toContain("!printfulConfigured ||");
    expect(source).toContain("!selectedTierConfigured");
  });
});
