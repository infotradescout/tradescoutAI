import fs from "fs";
import { describe, expect, it } from "vitest";
import {
  buildImportedPublicProfileFields,
  buildTargetingImportExtras,
  mergeOnlyMissingProfileFields,
} from "../../scripts/import/business-profile-fields";
import { parseCsv } from "../../scripts/import/utils";
import { getTradeSeoMatch } from "@shared/tradeSeo";
import {
  resolveStoneCorridorReleasePhase,
  resolveStoneCorridorVisibility,
  selectStoneCorridorBusinessMatch,
  STONE_CORRIDOR_RELEASE_ID,
  STONE_CORRIDOR_SOURCE,
  STONE_CORRIDOR_PUBLIC_TRADE_SLUG,
} from "../services/stoneCorridorProfileProvisioning";

const DATASET_PATH =
  "scripts/import/datasets/stone-corridor-baton-rouge-to-panama-city-2026-08-22.csv";

function readDataset() {
  return parseCsv(fs.readFileSync(DATASET_PATH, "utf8"), ",");
}

describe("Baton Rouge to Panama City stone corridor import", () => {
  it("contains 51 unique, official-source location profiles with complete county routing", () => {
    const rows = readDataset();

    expect(rows).toHaveLength(51);
    expect(new Set(rows.map((row) => row.external_id)).size).toBe(rows.length);
    expect(new Set(rows.map((row) => `${row.business_name}|${row.address}`)).size).toBe(
      rows.length
    );

    for (const row of rows) {
      expect(row.external_id).toMatch(/^official_web:/);
      expect(row.business_name).toBeTruthy();
      expect(row.tagline).toBeTruthy();
      expect(row.description).toBeTruthy();
      expect(row.address).toBeTruthy();
      expect(row.city).toBeTruthy();
      expect(row.state_code).toMatch(/^(LA|MS|AL|FL)$/);
      expect(row.zip_code).toMatch(/^\d{5}$/);
      expect(row.county_fips).toMatch(/^\d{5}$/);
      expect(row.source_checked_at).toBe("2026-08-22");
      expect(row.official_source_kind).toBe("business_website");
      expect(row.source_url).toMatch(/^https:\/\//);
      expect(row.target_segments).toBeTruthy();
      expect(row.jw_stone_fit).toBeTruthy();
      expect(row.bidrock_fit).toBeTruthy();
      expect(row.acquisition_priority).toMatch(/^tier_[12]$/);

      const websiteHost = new URL(row.website).hostname.replace(/^www\./, "");
      const sourceHost = new URL(row.source_url).hostname.replace(/^www\./, "");
      expect(sourceHost).toBe(websiteHost);
    }
  });

  it("covers all corridor markets and all requested stone business roles", () => {
    const rows = readDataset();
    const markets = new Set(rows.map((row) => row.corridor_market));
    const categories = rows.map((row) => row.trade_categories);

    expect(markets).toEqual(
      new Set([
        "baton_rouge",
        "northshore",
        "new_orleans",
        "mississippi_gulf_coast",
        "mobile_baldwin",
        "pensacola",
        "emerald_coast",
        "panama_city",
      ])
    );
    expect(
      categories.filter((value) => value.includes("fabricator")).length
    ).toBeGreaterThanOrEqual(30);
    expect(categories.filter((value) => value.includes("installer")).length).toBeGreaterThanOrEqual(
      35
    );
    expect(categories.filter((value) => value.includes("supplier")).length).toBeGreaterThanOrEqual(
      30
    );
    expect(getTradeSeoMatch(STONE_CORRIDOR_PUBLIC_TRADE_SLUG)?.canonicalSlug).toBe(
      "masonry-contractor"
    );
  });

  it("keeps profiles unclaimed-safe and excludes the existing JW Stone anchor profile", () => {
    const source = fs.readFileSync(DATASET_PATH, "utf8");
    const rows = readDataset();

    expect(source).not.toMatch(/license_(?:number|status|verified)/i);
    expect(source).not.toMatch(/review_(?:count|url)|average_rating/i);
    expect(rows.some((row) => /jw stone/i.test(row.business_name))).toBe(false);
    expect(rows.some((row) => /verified|tradescout partner/i.test(row.description))).toBe(false);
  });

  it("maps researched public fields and internal targeting metadata without overwriting owner data", () => {
    const [row] = readDataset();
    const importRow = {
      rawPayload: row,
      stateCode: row.state_code,
      countyFips: row.county_fips,
      countyName: row.county_name,
    };

    expect(buildImportedPublicProfileFields(importRow)).toMatchObject({
      tagline: row.tagline,
      description: row.description,
      address: row.address,
      city: row.city,
      stateCode: row.state_code,
      zipCode: row.zip_code,
    });
    expect(buildTargetingImportExtras(importRow)).toMatchObject({
      external_id: row.external_id,
      source_url: row.source_url,
      corridor_market: row.corridor_market,
      target_segments: row.target_segments,
      jw_stone_fit: row.jw_stone_fit,
      bidrock_fit: row.bidrock_fit,
      acquisition_priority: row.acquisition_priority,
      county_fips: row.county_fips,
      county_name: row.county_name,
    });

    const merged = mergeOnlyMissingProfileFields(
      { description: "Owner-authored description", city: "" },
      { description: row.description, city: row.city, tagline: row.tagline }
    );
    expect(merged).toMatchObject({
      description: "Owner-authored description",
      city: row.city,
      tagline: row.tagline,
    });
  });

  it("retains the canonical claimed-profile preservation guard", () => {
    const merger = fs.readFileSync("scripts/import/merge-staged-businesses.ts", "utf8");

    expect(merger).toContain('existing.claimStatus === "claimed"');
    expect(merger).toContain("claimed fields preserved");
    expect(merger).toContain("mergeOnlyMissingProfileFields");
  });

  it("wires a two-phase, auditable production release through the existing bootstrap", () => {
    const startup = fs.readFileSync("server/index.ts", "utf8");
    const provisioner = fs.readFileSync(
      "server/services/stoneCorridorProfileProvisioning.ts",
      "utf8"
    );
    const dockerfile = fs.readFileSync("Dockerfile", "utf8");

    expect(startup).toContain("provisionStoneCorridorProfiles");
    expect(startup).toContain('provisionProfile("Stone Corridor"');
    expect(provisioner).toContain("listingImportStaging");
    expect(provisioner).toContain("release_previous_status");
    expect(provisioner).toContain("release_previous_public_discovery_enabled");
    expect(provisioner).toContain("release_activated_at");
    expect(provisioner).toContain("release_rolled_back_at");
    expect(provisioner).toContain("pg_advisory_xact_lock");
    expect(provisioner).toContain("publicContactEnabled = false");
    expect(provisioner).toContain("publicWebsiteEnabled = false");
    expect(provisioner).toContain(
      "publicDiscoveryEnabled: creationVisibility.publicDiscoveryEnabled"
    );
    expect(dockerfile).toContain("COPY --from=builder /app/scripts ./scripts");
    expect(STONE_CORRIDOR_RELEASE_ID).toMatch(/^stone_corridor_/);
    expect(STONE_CORRIDOR_SOURCE).toBe("official_web_stone_corridor_20260822");
  });

  it("fails closed to draft and preserves later manual status changes", () => {
    expect(resolveStoneCorridorReleasePhase(undefined)).toBe("draft");
    expect(resolveStoneCorridorReleasePhase("unexpected")).toBe("draft");
    expect(resolveStoneCorridorReleasePhase("active")).toBe("active");
    expect(resolveStoneCorridorReleasePhase("rollback")).toBe("rollback");

    expect(
      resolveStoneCorridorVisibility({
        phase: "active",
        currentStatus: "draft",
        currentPublicDiscoveryEnabled: false,
        importExtras: {},
      })
    ).toEqual({ status: "active", publicDiscoveryEnabled: true, markActivated: true });
    expect(
      resolveStoneCorridorVisibility({
        phase: "active",
        currentStatus: "draft",
        currentPublicDiscoveryEnabled: false,
        importExtras: { release_activated_at: "2026-08-22T00:00:00.000Z" },
      })
    ).toEqual({ status: "draft", publicDiscoveryEnabled: false, markActivated: false });
    expect(
      resolveStoneCorridorVisibility({
        phase: "active",
        currentStatus: "suspended",
        currentPublicDiscoveryEnabled: false,
        importExtras: {},
      })
    ).toEqual({ status: "suspended", publicDiscoveryEnabled: false, markActivated: false });
  });

  it("restores pre-release visibility on rollback", () => {
    expect(
      resolveStoneCorridorVisibility({
        phase: "rollback",
        currentStatus: "active",
        currentPublicDiscoveryEnabled: true,
        importExtras: {
          release_previous_status: "draft",
          release_previous_public_discovery_enabled: "false",
        },
      })
    ).toEqual({ status: "draft", publicDiscoveryEnabled: false, markActivated: false });
    expect(
      resolveStoneCorridorVisibility({
        phase: "rollback",
        currentStatus: "active",
        currentPublicDiscoveryEnabled: true,
        importExtras: {
          release_previous_status: "active",
          release_previous_public_discovery_enabled: "true",
        },
      })
    ).toEqual({ status: "active", publicDiscoveryEnabled: true, markActivated: false });
    expect(
      resolveStoneCorridorVisibility({
        phase: "rollback",
        currentStatus: "active",
        currentPublicDiscoveryEnabled: true,
        importExtras: {
          release_previous_status: "suspended",
          release_previous_public_discovery_enabled: "false",
        },
      })
    ).toEqual({ status: "suspended", publicDiscoveryEnabled: false, markActivated: false });
  });

  it("prefers a claimed exact match so owner-controlled profiles cannot be shadowed", () => {
    const [row] = readDataset();
    const candidates = [
      {
        id: "unclaimed",
        name: row.business_name,
        slug: "unclaimed-copy",
        ownerUserId: null,
        claimStatus: "unclaimed",
        profileData: { website: row.website },
        publicDiscoveryEnabled: true,
        sources: [],
        status: "active",
      },
      {
        id: "claimed",
        name: row.business_name,
        slug: "owner-profile",
        ownerUserId: "owner-1",
        claimStatus: "claimed",
        profileData: { website: row.website },
        publicDiscoveryEnabled: true,
        sources: [],
        status: "active",
      },
    ];

    expect(selectStoneCorridorBusinessMatch(candidates, row)?.id).toBe("claimed");
  });
});
