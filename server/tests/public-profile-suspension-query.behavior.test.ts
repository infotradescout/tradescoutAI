import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { businesses, profiles, searchAnalytics, users } from "@shared/schema";

const fixture = vi.hoisted(() => ({
  client: null as import("@electric-sql/pglite").PGlite | null,
  getBusinessProfileBySlug: vi.fn(),
  getMarketplaceListings: vi.fn(),
  getMarketplaceCategories: vi.fn(),
}));

vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  fixture.client = new PGlite();
  return { db: drizzle(fixture.client) };
});
vi.mock("../storage", () => ({ storage: fixture }));
vi.mock("../auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../services/canonicalBusinessProfileRoute", () => ({
  resolveCanonicalBusinessProfileRoute: async () => null,
}));
vi.mock("../services/indexNowService", () => ({ notifyIndexNow: vi.fn() }));

import { ProfileRepository } from "../repositories/profileRepository";
import { registerBusinessProfileRoutes } from "../routes/business-profile";

const repository = new ProfileRepository();
const app = express();
registerBusinessProfileRoutes(app);
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

beforeAll(async () => {
  // Execute the real PostgreSQL queries on a disposable typed projection.
  // This proves query behavior; it is not a full migration/constraint replay.
  const types: Record<string, string> = {
    boolean: "boolean",
    number: "double precision",
    json: "jsonb",
    date: "timestamp",
    array: "text[]",
  };
  for (const table of [users, businesses, profiles, searchAnalytics]) {
    const config = getTableConfig(table);
    const columns = config.columns.map(
      (column) => `${quote(column.name)} ${types[column.dataType] || "text"}`
    );
    await fixture.client!.exec(`CREATE TABLE ${quote(config.name)} (${columns.join(", ")})`);
  }
});

beforeEach(async () => {
  await fixture.client!.exec("TRUNCATE users, businesses, profiles, search_analytics");
  fixture.getBusinessProfileBySlug.mockReset();
  fixture.getMarketplaceListings.mockReset().mockResolvedValue([]);
  fixture.getMarketplaceCategories.mockReset().mockResolvedValue([]);
});

afterAll(async () => {
  await fixture.client?.close();
});

async function seed(slug: string, status: string | null, badge: boolean, newer = false) {
  const ownerId = `owner-${slug}`;
  await fixture.client!.query(
    "INSERT INTO users (id, verification_status, verified_badge, preferences) VALUES ($1, $2, $3, $4::jsonb)",
    [ownerId, status, badge, JSON.stringify({ publicProfileIds: [slug] })]
  );
  await fixture.client!.query(
    "INSERT INTO businesses (id, owner_user_id, status, public_discovery_enabled, sources, profile_data) VALUES ($1, $2, 'active', true, '[]'::jsonb, '{}'::jsonb)",
    [`business-${slug}`, ownerId]
  );
  await fixture.client!.query(
    "INSERT INTO profiles (id, slug, display_name, headline, role_context, owner_user_id, business_id, status, updated_at) VALUES ($1, $1, $1, 'Synthetic business', 'business_owner', $2, $3, 'published', $4)",
    [slug, ownerId, `business-${slug}`, newer ? "2026-09-06" : "2026-09-05"]
  );
  return ownerId;
}

describe("suspended-owner public query and API behavior", () => {
  it.each(["suspended", " Suspended "])(
    "excludes a newer %s owner with a retained badge before the actual SQL limit",
    async (status) => {
      await seed("stone-suspended", status, true, true);
      await seed("stone-approved", "approved", false);

      const result = await repository.searchProfilesPublic({ query: "stone", limit: 1 });

      expect(result.map((profile) => profile.slug)).toEqual(["stone-approved"]);
      expect(Object.keys(result[0]).sort()).toEqual([
        "displayName",
        "headline",
        "id",
        "roleContext",
        "slug",
      ]);
    }
  );

  it.each([
    { status: "approved", badge: false, expected: 1 },
    { status: "pending", badge: true, expected: 1 },
    { status: null, badge: true, expected: 1 },
    { status: "pending", badge: false, expected: 0 },
    { status: "suspended", badge: false, expected: 0 },
  ])(
    "preserves existing SQL trust behavior for $status / badge=$badge",
    async ({ status, badge, expected }) => {
      await seed("stone-company", status, badge);
      expect(await repository.searchProfilesPublic({ query: "stone" })).toHaveLength(expected);
    }
  );

  it("keeps registered manual direct profiles out of discovery", async () => {
    await seed("louisiana-stone-solutions", "pending", true);
    expect(await repository.searchProfilesPublic({ query: "stone" })).toEqual([]);
  });

  it.each([
    { status: "suspended", badge: true, expected: 404 },
    { status: " Suspended ", badge: true, expected: 404 },
    { status: "approved", badge: false, expected: 200 },
    { status: "pending", badge: true, expected: 200 },
    { status: "pending", badge: false, expected: 404 },
  ])(
    "serves the legacy API consistently for $status / badge=$badge",
    async ({ status, badge, expected }) => {
      const ownerId = await seed("stone-company", status, badge);
      fixture.getBusinessProfileBySlug.mockResolvedValue({
        id: "legacy-profile",
        userId: ownerId,
        slug: "stone-company",
        name: "Synthetic business details",
        visibility: "public",
        services: [],
        serviceAreas: [],
        seoMeta: {},
      });

      const response = await request(app).get("/api/business-profile/slug/stone-company");

      expect(response.status).toBe(expected);
      if (expected === 404) {
        expect(response.body).toEqual({ message: "Profile not found" });
        expect(fixture.getMarketplaceListings).not.toHaveBeenCalled();
      } else {
        expect(response.body.name).toBe("Synthetic business details");
        expect(response.body).not.toHaveProperty("userId");
      }
    }
  );
});
