import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  businesses,
  businessCounties,
  counties,
  profiles,
  searchAnalytics,
  users,
  realtorProfiles,
  carSalesmanProfiles,
} from "@shared/schema";

const fixture = vi.hoisted(() => ({
  client: null as import("@electric-sql/pglite").PGlite | null,
}));

vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  fixture.client = new PGlite();
  return { db: drizzle(fixture.client) };
});

import { lookupScoutPublicProfiles } from "../repositories/profileRepository";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

beforeAll(async () => {
  const types: Record<string, string> = {
    boolean: "boolean",
    number: "double precision",
    json: "jsonb",
    date: "timestamp",
    array: "text[]",
  };
  for (const table of [
    users, businesses, counties, businessCounties, profiles, searchAnalytics,
    realtorProfiles, carSalesmanProfiles,
  ]) {
    const config = getTableConfig(table);
    const columns = config.columns.map(
      (column) => `${quote(column.name)} ${types[column.dataType] || "text"}`
    );
    await fixture.client!.exec(`CREATE TABLE ${quote(config.name)} (${columns.join(", ")})`);
  }
});

beforeEach(async () => {
  await fixture.client!.exec(
    "TRUNCATE users, businesses, counties, business_counties, profiles, search_analytics"
  );
  await fixture.client!.query(
    "INSERT INTO counties (id, name, fips, state_code) VALUES ('maricopa', 'Maricopa County', '04013', 'AZ'), ('pinal', 'Pinal County', '04021', 'AZ'), ('wrong-state', 'Maricopa County', '04013', 'CA')"
  );
});

afterAll(async () => {
  await fixture.client?.close();
});

type SeedOptions = {
  countyId?: "maricopa" | "pinal" | "wrong-state" | null;
  businessName?: string;
  headline?: string;
  updatedAt?: string;
  verificationStatus?: string;
  verifiedBadge?: boolean;
  publiclyReleased?: boolean;
  profileStatus?: string;
  businessStatus?: string;
  discoveryEnabled?: boolean;
  businessOwnerMismatch?: boolean;
  linked?: boolean;
};

async function seed(slug: string, options: SeedOptions = {}) {
  const ownerId = `owner-${slug}`;
  const businessId = `business-${slug}`;
  const {
    countyId = "maricopa",
    businessName = slug.replaceAll("-", " "),
    headline = "Local service page",
    updatedAt = "2026-09-01",
    verificationStatus = "approved",
    verifiedBadge = false,
    publiclyReleased = true,
    profileStatus = "published",
    businessStatus = "active",
    discoveryEnabled = true,
    businessOwnerMismatch = false,
    linked = true,
  } = options;
  await fixture.client!.query(
    "INSERT INTO users (id, verification_status, verified_badge, preferences) VALUES ($1, $2, $3, $4::jsonb)",
    [ownerId, verificationStatus, verifiedBadge, JSON.stringify({ publicProfileIds: [slug] })]
  );
  if (linked) {
    await fixture.client!.query(
      "INSERT INTO businesses (id, name, owner_user_id, status, public_discovery_enabled, sources, profile_data) VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, '{}'::jsonb)",
      [businessId, businessName, businessOwnerMismatch ? "someone-else" : ownerId, businessStatus, discoveryEnabled]
    );
    if (countyId) {
      await fixture.client!.query(
        "INSERT INTO business_counties (id, business_id, county_id) VALUES ($1, $2, $3)",
        [`area-${slug}`, businessId, countyId]
      );
    }
  }
  await fixture.client!.query(
    "INSERT INTO profiles (id, slug, display_name, headline, role_context, owner_user_id, business_id, status, publicly_released, updated_at) VALUES ($1, $1, $2, $3, 'business_owner', $4, $5, $6, $7, $8)",
    [slug, slug.replaceAll("-", " "), headline, ownerId, linked ? businessId : null, profileStatus, publiclyReleased, updatedAt]
  );
}

describe("Scout public profile pages lookup", () => {
  it("filters exact business county and canonical state before LIMIT", async () => {
    await seed("newer-pinal-plumbing", { countyId: "pinal", updatedAt: "2026-09-10" });
    await seed("newer-false-state-plumbing", {
      countyId: "wrong-state",
      updatedAt: "2026-09-09",
    });
    await seed("newer-unmapped-plumbing", { countyId: null, updatedAt: "2026-09-08" });
    await seed("maricopa-plumbing", { updatedAt: "2026-09-01" });

    const result = await lookupScoutPublicProfiles({ countyFips: "04013", topic: "plumbing", limit: 1 });
    expect(result.status).toBe("checked");
    expect(result.items).toEqual([
      {
        id: "maricopa-plumbing",
        slug: "maricopa-plumbing",
        displayName: "maricopa plumbing",
        businessName: "maricopa plumbing",
        headline: "Local service page",
        roleContext: "business_owner",
        countyFips: "04013",
        detailPath: "/u/maricopa-plumbing",
      },
    ]);
  });

  it("retains public release, linked business, discovery, trust, suspension and direct-only gates", async () => {
    await seed("newer-private-stone", { publiclyReleased: false, updatedAt: "2026-09-15" });
    await seed("newer-draft-stone", { profileStatus: "draft", updatedAt: "2026-09-14" });
    await seed("newer-unlinked-stone", { linked: false, updatedAt: "2026-09-13" });
    await seed("newer-inactive-stone", { businessStatus: "pending", updatedAt: "2026-09-12" });
    await seed("newer-undiscoverable-stone", { discoveryEnabled: false, updatedAt: "2026-09-11" });
    await seed("newer-mismatched-stone", { businessOwnerMismatch: true, updatedAt: "2026-09-10" });
    await seed("newer-pending-stone", { verificationStatus: "pending", updatedAt: "2026-09-09" });
    await seed("newer-suspended-stone", {
      verificationStatus: "suspended",
      verifiedBadge: true,
      updatedAt: "2026-09-08",
    });
    await seed("louisiana-stone-solutions", { updatedAt: "2026-09-07" });
    await seed("maricopa-stone", { updatedAt: "2026-09-01" });

    const result = await lookupScoutPublicProfiles({ countyFips: "04013", topic: "stone", limit: 1 });
    expect(result.status).toBe("checked");
    expect(result.items.map((item) => item.slug)).toEqual(["maricopa-stone"]);
    expect((await fixture.client!.query("SELECT count(*)::int AS count FROM search_analytics")).rows[0].count).toBe(0);
  });

  it("matches public headline or name and reports invalid area and topic without a fabricated zero", async () => {
    await seed("local-projects", { headline: "Maricopa plumbing services" });
    await seed("other-local", { headline: "Stone fabrication" });
    const match = await lookupScoutPublicProfiles({ countyFips: "04013", topic: "plumbing" });
    expect(match.status).toBe("checked");
    expect(match.items.map((item) => item.slug)).toEqual(["local-projects"]);
    expect(await lookupScoutPublicProfiles({ countyFips: "99999", topic: "plumbing" })).toEqual({
      status: "area_unavailable", items: [], reason: "invalid_county",
    });
    expect(await lookupScoutPublicProfiles({ countyFips: "04013", topic: "!!!" })).toEqual({
      status: "error", items: [], reason: "invalid_topic",
    });
  });

  it("finds a page by the business name shown at its public detail", async () => {
    await seed("plain-services", {
      businessName: "Cactus Plumbing Group",
      headline: "General local work",
    });

    const result = await lookupScoutPublicProfiles({ countyFips: "04013", topic: "plumbing" });
    expect(result.status).toBe("checked");
    expect(result.items).toEqual([
      expect.objectContaining({
        slug: "plain-services",
        businessName: "Cactus Plumbing Group",
        displayName: "plain services",
        detailPath: "/u/plain-services",
      }),
    ]);
  });

  it("reports source failure as unchecked and does not write analytics", async () => {
    const query = vi.spyOn(fixture.client!, "query").mockRejectedValueOnce(new Error("synthetic read failure"));
    try {
      expect(await lookupScoutPublicProfiles({ countyFips: "04013", topic: "plumbing" })).toEqual({
        status: "error", items: [], reason: "source_unavailable",
      });
    } finally {
      query.mockRestore();
    }
    expect((await fixture.client!.query("SELECT count(*)::int AS count FROM search_analytics")).rows[0].count).toBe(0);
  });
});
