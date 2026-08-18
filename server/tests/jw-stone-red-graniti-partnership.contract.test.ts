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
  it("shows the relationship on JW Stone as a source partnership, not copied inventory", () => {
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const section = read("client/src/features/jw-stone/JwStoneSourcePartnersSection.tsx");

    expect(marketplace).toContain(
      'import { JwStoneSourcePartnersSection } from "./JwStoneSourcePartnersSection"'
    );
    expect(marketplace).toContain(
      "<JwStoneSourcePartnersSection onStartRequest={() => startRequest([])} />"
    );
    expect(section).toContain("Source partnerships");
    expect(section).toContain("Exclusive first-cut distributor");
    expect(section).toContain("Kept separate from available inventory");
    expect(section).toContain("received, verified, and added to the");
    expect(section).toContain("View company profile");
    expect(section).toContain("Start a first-cut request");

    expect(section).not.toContain("JW_STONE_CATALOG");
    expect(section).not.toContain("STONE_CORE_RED_GRANITI_MATERIALS");
    expect(section).not.toMatch(/inventoryCatalog|stone card|slab count|bundle count/i);
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
