import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIRECT_PROFILE_AUTHORITIES } from "@shared/publicProfileExposureRegistry";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  eligibleSlugs: [] as string[],
}));

// Compile the repository's real Drizzle query without loading a database client.
vi.mock("../db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return { db: drizzle((query, params, method) => mocks.query(query, params, method)) };
});

import { ProfileRepository } from "../repositories/profileRepository";

function readSearchBoundary(query: string, params: unknown[]) {
  const exclusion = /lower\(trim\("profiles"\."slug"\)\) not in \((\$\d+(?:, \$\d+)*)\)/i.exec(
    query
  );
  expect(
    exclusion,
    "registered direct profiles must be excluded in the compiled SQL"
  ).not.toBeNull();
  const limit = / limit \$(\d+)\s*$/i.exec(query);
  expect(limit).not.toBeNull();
  expect(exclusion!.index).toBeGreaterThan(query.indexOf(" where "));
  expect(exclusion!.index).toBeLessThan(query.indexOf(" order by "));
  expect(query.indexOf(" order by ")).toBeLessThan(limit!.index);
  const excludedSlugs = exclusion![1]
    .split(", ")
    .map((placeholder) => params[Number(placeholder.slice(1)) - 1]);
  return { excludedSlugs, limit: Number(params[Number(limit![1]) - 1]) };
}

describe("public profile search direct authority", () => {
  beforeEach(() => {
    mocks.eligibleSlugs = [];
    mocks.query.mockReset();
    mocks.query.mockImplementation(async (query: string, params: unknown[]) => {
      if (!query.startsWith("select ")) return { rows: [] };
      const boundary = readSearchBoundary(query, params);
      // These fixtures already meet the unchanged publication/discovery/trust
      // predicates. Interpret only the emitted exclusion and LIMIT, so no live
      // database or copied registry filter can hide a missing SQL boundary.
      const matching = mocks.eligibleSlugs
        .filter((slug) => !boundary.excludedSlugs.includes(slug.trim().toLowerCase()))
        .slice(0, boundary.limit);
      return {
        rows: matching.map((slug) => [slug, slug, "Verified match", null, "business_owner"]),
      };
    });
  });

  it("binds every registered direct-only slug in the SQL exclusion before LIMIT", async () => {
    await new ProfileRepository().searchProfilesPublic({ query: "stone", limit: 2 });
    const [query, params] = mocks.query.mock.calls.find(([query]) => query.startsWith("select "))!;
    expect(readSearchBoundary(query, params).excludedSlugs).toEqual(
      Object.keys(DIRECT_PROFILE_AUTHORITIES).map((slug) => slug.trim().toLowerCase())
    );
    // The ordinary verified-business, explicit-release and discovery conditions
    // must remain in the same query, rather than being replaced by the exclusion.
    expect(query).toContain('"businesses"."status" = \'active\'');
    expect(query).toContain('"businesses"."public_discovery_enabled" = true');
    expect(query).toContain('"users"."verified_badge" = true');
    expect(query).toContain('"users"."verification_status"');
    expect(query).toContain("publicProfileIds");
    expect(params).toContain("%stone%");
  });

  it.each(Object.keys(DIRECT_PROFILE_AUTHORITIES))(
    "does not let %s or its case/space variant crowd a verified result out of limit one",
    async (slug) => {
      mocks.eligibleSlugs = [slug, `  ${slug.toUpperCase()}  `, "ordinary-verified-stone"];
      const result = await new ProfileRepository().searchProfilesPublic({
        query: "stone",
        limit: 1,
      });
      expect(result.map((row) => row.slug)).toEqual(["ordinary-verified-stone"]);
    }
  );

  it("excludes stale-badge LSS even when discovery is enabled and retains regular verified matches", async () => {
    // A stale badge with discovery enabled satisfies the old common SQL gate.
    mocks.eligibleSlugs = [
      "louisiana-stone-solutions",
      "approved-stone-company",
      "badge-verified-stone-company",
      "louisiana-stone-solutions-neighbor",
    ];
    const result = await new ProfileRepository().searchProfilesPublic({ query: "stone", limit: 3 });
    expect(result.map((row) => row.slug)).toEqual([
      "approved-stone-company",
      "badge-verified-stone-company",
      "louisiana-stone-solutions-neighbor",
    ]);
    expect(Object.keys(result[0]).sort()).toEqual([
      "displayName",
      "headline",
      "id",
      "roleContext",
      "slug",
    ]);
  });
});
