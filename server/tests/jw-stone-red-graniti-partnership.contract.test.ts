import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT,
  STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS,
} from "@shared/stoneCore";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("JW Stone and R.E.D. Graniti partnership separation", () => {
  it("keeps the source relationship off the JW Stone public profile", () => {
    const section = read("client/src/features/jw-stone/JwStoneSourcePartnersSection.tsx");

    expect(section).toContain("return null");
    expect(section).not.toContain("Source partnerships");
    expect(section).not.toContain("Exclusive first-cut distributor");
    expect(section).not.toContain("View company profile");
    expect(section).not.toContain("Start a first-cut request");
    expect(section).not.toContain("RED_GRANITI_BUSINESS_NAME");
    expect(section).not.toContain("RED_GRANITI_LOGO_URL");
    expect(section).not.toContain("RED_GRANITI_PROFILE_SLUG");
  });

  it("keeps the relationship and future material views as independent records", () => {
    expect(STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.sourceProfileSlug).toBe("red-graniti");
    expect(STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.distributorProfileSlug).toBe("jw-stone");
    expect(STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.scope).toBe("first_cut");
    expect(STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.exclusivity).toBe("exclusive");
    expect(STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.territoryStatus).toBe(
      "not_publicly_specified"
    );

    const jwPublication = STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS.find(
      (target) => target.profileSlug === "jw-stone"
    );
    expect(jwPublication).toMatchObject({
      channel: "authorized_distributor",
      publicationRole: "exclusive_first_cut",
      publicationStatus: "authorized_not_published",
      inventoryClaim: "none",
    });
  });
});
