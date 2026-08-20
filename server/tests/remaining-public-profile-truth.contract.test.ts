import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS } from "@shared/precisionAerialProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("remaining public profile truth", () => {
  it("keeps Precision direct-only while removing unsupported credential wording", () => {
    const publicCopy = JSON.stringify(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS).toLowerCase();
    const normalizer = read("server/services/remainingPublicProfileTruthNormalization.ts");
    const provisioner = read("server/services/precisionAerialProfileProvisioning.ts");

    expect(publicCopy).not.toContain("faa part 107");
    expect(publicCopy).not.toContain("licensed drone pilot");
    expect(publicCopy).toContain("real estate aerial photo and video");
    expect(publicCopy).toContain("construction progress imagery");
    expect(publicCopy).toContain("land and site aerials");
    expect(publicCopy).toContain("fpv drone video");
    expect(normalizer).toContain("business.publicDiscoveryEnabled !== false");
    expect(normalizer).toContain('business.claimStatus !== "unclaimed"');
    expect(normalizer).toContain('label: "Start a Request"');
    expect(provisioner).not.toContain("FAA Part 107 aerial photo and video in Pensacola");
    expect(provisioner).not.toContain("FAA Part 107 licensed drone pilot Cameron");
  });

  it("uses Start a Request throughout JW Stone and its stored profile metadata", () => {
    const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
    const requestBand = read("client/src/features/jw-stone/JwStoneRequestBand.tsx");
    const registry = read("shared/managedPartnerProfileRegistry.ts");
    const normalizer = read("server/services/remainingPublicProfileTruthNormalization.ts");

    expect(header).toContain("Start a Request");
    expect(requestBand).toContain("Start a Request");
    expect(requestBand).not.toContain('aria-label="Contact"');
    expect(registry).toContain('expectedPrimaryCta: "Start a Request"');
    expect(normalizer).toContain("iprofiles.slug, JW_STONE_PROFILE_SLUG)");
    expect(normalizer).not.toContain("Request Trade Pricing");
    expect(normalizer).not.toContain("Start Direct Connect");
  });

  it("runs after managed contact and ISSA truth normalization", () => {
    const pass = read("server/services/jwStoneManagedContactProvisioning.ts");
    const issaIndex = pass.indexOf("await normalizeIssaBuildVerifiedFullServiceProfile()");
    const remainingIndex = pass.indexOf("await normalizeRemainingPublicProfileTruth()");

    expect(issaIndex).toBeGreaterThan(-1);
    expect(remainingIndex).toBeGreaterThan(issaIndex);
  });

  it("does not touch JR's Auto Glass or the steel planner", () => {
    const changedSources = [
      read("server/services/remainingPublicProfileTruthNormalization.ts"),
      read("server/services/seoPublicationPruneJob.ts"),
    ].join("\n");

    expect(changedSources).not.toContain("jrs-auto-glass");
    expect(changedSources).not.toContain("steel-home-packages");
  });
});
