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
  it("keeps the source relationship completely off the JW Stone public profile", () => {
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const removedSectionPath = path.resolve(
      process.cwd(),
      "client/src/features/jw-stone/JwStoneSourcePartnersSection.tsx"
    );

    expect(marketplace).not.toContain("JwStoneSourcePartnersSection");
    expect(marketplace).not.toContain("jw-source-partners");
    expect(fs.existsSync(removedSectionPath)).toBe(false);
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
