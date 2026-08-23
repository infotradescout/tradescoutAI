import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL || "";
const describeWithDb = connectionString ? describe : describe.skip;

describeWithDb("acquisition measurement disposable PostgreSQL proof", () => {
  let client: pg.Client;
  let profileCatalogSql: string;
  let acquisitionFunnelSql: string;
  let acquisitionProjectionCoverageSql: string;

  beforeAll(async () => {
    client = new pg.Client({ connectionString });
    await client.connect();
    // The executable report is ESM JavaScript and intentionally remains the
    // single owner of the SQL exercised here.
    // @ts-expect-error no declaration file is needed for the executable report
    ({ profileCatalogSql, acquisitionFunnelSql, acquisitionProjectionCoverageSql } =
      await import("../../scripts/report-discovery-performance.mjs"));
  });

  afterAll(async () => {
    await client?.end();
  });

  it("uses the migrated unique invariant for lifetime lifecycle idempotence", async () => {
    await client.query("begin");
    try {
      const index = await client.query(
        `select indexdef
           from pg_indexes
          where schemaname = 'public'
            and indexname = 'idx_events_acquisition_lifecycle_user_unique'`
      );
      expect(index.rows[0]?.indexdef).toContain("UNIQUE INDEX");
      expect(index.rows[0]?.indexdef).toContain("event_type");
      expect(index.rows[0]?.indexdef).toContain("user_id");

      const userId = "acquisition-db-idempotence-user";
      const event = {
        type: "acquisition.registration_completed",
        serverConfirmed: true,
        projectionOf: "users.created_at",
        flow: "standard",
        userId,
      };
      const first = await client.query(
        `insert into events (event_type, user_id, data)
         values ($1, $2, $3::jsonb)
         on conflict do nothing
         returning id`,
        [event.type, userId, JSON.stringify(event)]
      );
      const retry = await client.query(
        `insert into events (event_type, user_id, data)
         values ($1, $2, $3::jsonb)
         on conflict do nothing
         returning id`,
        [event.type, userId, JSON.stringify(event)]
      );
      expect(first.rowCount).toBe(1);
      expect(retry.rowCount).toBe(0);
    } finally {
      await client.query("rollback");
    }
  });

  it("excludes spoofed or malformed public-profile milestones from the funnel", async () => {
    await client.query("begin");
    try {
      const validEntry = "acq-db-valid-entry";
      const spoofEntry = "acq-db-spoof-entry";
      const events = [
        {
          eventType: "discovery_landing",
          data: {
            type: "discovery_landing",
            serverVerified: true,
            entryRequestId: validEntry,
            entitySlug: "acq-funnel-business",
            businessSlug: "acq-funnel-business",
            entityType: "business_profile",
            canonicalRoute: "/business/acq-funnel-business",
            sourceHint: "google",
          },
        },
        {
          eventType: "public_profile_discovered",
          data: {
            type: "public_profile_discovered",
            serverVerified: true,
            entryRequestId: validEntry,
            entitySlug: "acq-funnel-business",
            businessSlug: "acq-funnel-business",
            entityType: "business_profile",
            canonicalRoute: "/business/acq-funnel-business",
          },
        },
        {
          eventType: "public_profile_cta",
          data: {
            type: "public_profile_cta",
            serverVerified: true,
            entryRequestId: validEntry,
            entitySlug: "acq-funnel-business",
            businessSlug: "acq-funnel-business",
            entityType: "business_profile",
            canonicalRoute: "/business/acq-funnel-business",
            ctaKind: "account_create",
          },
        },
        {
          eventType: "discovery_landing",
          data: {
            type: "discovery_landing",
            entryRequestId: spoofEntry,
            entitySlug: "acq-funnel-business",
            businessSlug: "acq-funnel-business",
            entityType: "business_profile",
            canonicalRoute: "/business/acq-funnel-business",
            sourceHint: "google",
          },
        },
        {
          eventType: "public_profile_discovered",
          data: {
            type: "public_profile_discovered",
            serverVerified: true,
            entryRequestId: spoofEntry,
            entitySlug: "acq-funnel-business",
            businessSlug: "acq-funnel-business",
            entityType: "business_profile",
            canonicalRoute: "/business/acq-funnel-business",
          },
        },
        {
          eventType: "public_profile_cta",
          data: {
            type: "public_profile_cta",
            serverVerified: true,
            entryRequestId: spoofEntry,
            entitySlug: "different-business",
            businessSlug: "different-business",
            entityType: "business_profile",
            canonicalRoute: "/business/acq-funnel-business",
            ctaKind: "arbitrary_attacker_action",
          },
        },
      ];
      for (const event of events) {
        await client.query(`insert into events (event_type, data) values ($1, $2::jsonb)`, [
          event.eventType,
          JSON.stringify(event.data),
        ]);
      }

      const result = await client.query(acquisitionFunnelSql, [
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        entity_slug: "acq-funnel-business",
        identity_route: "/business/acq-funnel-business",
        source: "utm:google",
        profile_discoveries: 1,
        cta_entries: 1,
        registrations: 0,
        activations: 0,
      });
    } finally {
      await client.query("rollback");
    }
  });

  it("ignores malformed legacy activation timestamps without aborting coverage", async () => {
    await client.query("begin");
    try {
      const users = [
        {
          id: "acquisition-db-valid-activation",
          email: "acquisition-db-valid-activation@example.test",
          completedAt: "2099-03-04T12:00:00.000Z",
        },
        {
          id: "acquisition-db-malformed-activation",
          email: "acquisition-db-malformed-activation@example.test",
          completedAt: "2026-99-99T99:99:99.000Z",
        },
      ];
      for (const user of users) {
        await client.query(
          `insert into users (
             id, email, provider, onboarding_completed, preferences, created_at
           ) values ($1, $2, 'local', true, $3::jsonb, $4::timestamp)`,
          [
            user.id,
            user.email,
            JSON.stringify({
              onboardingOutcome: {
                kind: "business_profile",
                completedAt: user.completedAt,
              },
            }),
            "2099-03-04T12:00:00.000Z",
          ]
        );
      }

      const result = await client.query(acquisitionProjectionCoverageSql, [
        "2099-03-04T00:00:00.000Z",
        "2099-03-05T00:00:00.000Z",
      ]);
      expect(result.rows[0]).toMatchObject({
        consumer_provider_account_creations: 2,
        consumer_provider_activations: 1,
        missing_activation_projections: 1,
      });
    } finally {
      await client.query("rollback");
    }
  });

  it("matches canonical profile exposure and keeps directory entities route-distinct", async () => {
    await client.query("begin");
    try {
      await client.query(`
        delete from ts_seo_directory_snapshot_status;
        delete from ts_seo_directory_business_pages;
        insert into states (id, name, code)
        values ('acq-report-state', 'Florida', 'FL')
        on conflict (code) do nothing;
        insert into counties (id, name, fips, state_code)
        values ('acq-report-county', 'Escambia County', '12991', 'FL')
        on conflict (fips) do nothing;
        insert into ts_publication_rules (
          id,
          listing_stale_days_unclaimed,
          listing_stale_days_claimed_unverified,
          listing_stale_days_verified,
          request_public_summary_ttl_hours,
          category_page_recency_window_days
        ) values ('default', 365, 180, 730, 72, 90)
        on conflict (id) do nothing;
      `);

      const profileFixtures = [
        {
          key: "public",
          profileSlug: "acq-public-meaningful",
          businessSlug: "acq-public-business",
          businessStatus: "active",
          discovery: true,
          role: "contractor",
          headline: "Licensed plumbing help",
          contentBlocks: [],
        },
        {
          key: "inactive",
          profileSlug: "acq-inactive-profile",
          businessSlug: "acq-inactive-business",
          businessStatus: "draft",
          discovery: true,
          role: "contractor",
          headline: "Should stay private",
          contentBlocks: [],
        },
        {
          key: "direct",
          profileSlug: "acq-direct-profile",
          businessSlug: "acq-direct-business",
          businessStatus: "active",
          discovery: false,
          role: "contractor",
          headline: "Exact link only",
          contentBlocks: [],
        },
        {
          key: "empty",
          profileSlug: "acq-empty-profile",
          businessSlug: "acq-empty-business",
          businessStatus: "active",
          discovery: true,
          role: "contractor",
          headline: null,
          contentBlocks: [],
        },
        {
          key: "content",
          profileSlug: "acq-content-profile",
          businessSlug: "acq-content-business",
          businessStatus: "active",
          discovery: true,
          role: "contractor",
          headline: null,
          contentBlocks: [{ type: "services", data: { items: [{ label: "Pipe repair" }] } }],
        },
        {
          key: "internal",
          profileSlug: "acq-internal-profile",
          businessSlug: "acq-internal-business",
          businessStatus: "active",
          discovery: true,
          role: "super_admin",
          headline: "Internal operations",
          contentBlocks: [],
        },
        {
          key: "linked",
          profileSlug: "acq-linked-profile",
          businessSlug: "acq-linked-business",
          businessStatus: "active",
          discovery: true,
          role: "contractor",
          headline: "Canonical linked profile",
          contentBlocks: [],
        },
        {
          key: "collision",
          profileSlug: "acq-same-slug",
          businessSlug: "acq-collision-profile-business",
          businessStatus: "active",
          discovery: true,
          role: "contractor",
          headline: "Separate profile identity",
          contentBlocks: [],
        },
      ];

      for (const fixture of profileFixtures) {
        const userId = `acq-report-user-${fixture.key}`;
        const businessId = `acq-report-business-${fixture.key}`;
        const profileId = `acq-report-profile-${fixture.key}`;
        await client.query(
          `insert into users (
             id, email, role, roles, provider, verified_badge,
             verification_status, address_verified, preferences
           ) values ($1, $2, 'homeowner', '{}', 'local', true, 'approved', true, $3::jsonb)`,
          [userId, `${userId}@example.test`, JSON.stringify({ publicProfileIds: [profileId] })]
        );
        await client.query(
          `insert into businesses (
             id, name, slug, role_context, owner_user_id, status,
             claim_status, public_discovery_enabled, profile_data, updated_at
           ) values ($1, $2, $3, 'contractor', $4, $5, 'claimed', $6, $7::jsonb, now())`,
          [
            businessId,
            fixture.businessSlug,
            fixture.businessSlug,
            userId,
            fixture.businessStatus,
            fixture.discovery,
            JSON.stringify({ category: "plumbing", city: "Pensacola", stateCode: "FL" }),
          ]
        );
        await client.query(
          `insert into profiles (
             id, owner_user_id, business_id, role_context, slug, display_name,
             headline, content_blocks, status
           ) values ($1, $2, $3, $4::user_role, $5, $6, $7, $8::jsonb, 'published')`,
          [
            profileId,
            userId,
            businessId,
            fixture.role,
            fixture.profileSlug,
            fixture.profileSlug,
            fixture.headline,
            JSON.stringify(fixture.contentBlocks),
          ]
        );
      }

      const directoryFixtures = [
        ["directory", "acq-directory-only", "acq-directory-only"],
        ["linked", "acq-report-business-linked", "acq-linked-business"],
        ["collision", "acq-directory-collision", "acq-same-slug"],
        ["stale", "acq-directory-stale", "acq-directory-stale"],
      ] as const;
      for (const [key, businessId, slug] of directoryFixtures) {
        const updatedAt = key === "stale" ? "now()" : "now()";
        await client.query(
          `insert into businesses (
             id, name, slug, role_context, status, claim_status,
             public_discovery_enabled, profile_data, updated_at
           ) values ($1, $2, $3, 'contractor', 'active', 'unclaimed', true, $4::jsonb, ${updatedAt})
           on conflict (id) do nothing`,
          [
            businessId,
            slug,
            slug,
            JSON.stringify({ category: "plumbing", city: "Pensacola", stateCode: "FL" }),
          ]
        );
        await client.query(
          `insert into business_counties (id, business_id, county_id)
           values ($1, $2, (select id from counties where fips = '12991'))
           on conflict (business_id, county_id) do nothing`,
          [`acq-report-business-county-${key}`, businessId]
        );
        await client.query(
          `insert into ts_seo_directory_business_pages (business_id, slug, lastmod)
           select id, slug,
             case when $2 = 'stale' then updated_at - interval '1 day' else updated_at end
           from businesses where id = $1`,
          [businessId, key]
        );
      }
      await client.query(`
        insert into ts_seo_directory_snapshot_status (
          snapshot_key, generation, completed_at, source_row_count,
          directory_business_count, trade_county_page_count, trade_city_page_count
        ) values ('directory_scope_v1', 1, now(), 4, 4, 1, 1)
      `);

      const result = await client.query(profileCatalogSql);
      const byRoute = new Map(result.rows.map((row) => [row.identity_route, row]));
      expect(byRoute.get("/u/acq-public-meaningful")?.is_publicly_exposable).toBe(true);
      expect(byRoute.get("/u/acq-inactive-profile")?.exclusion_reason).toBe(
        "business_trust_missing"
      );
      expect(byRoute.get("/u/acq-direct-profile")?.exclusion_reason).toBe("direct_only");
      expect(byRoute.get("/u/acq-empty-profile")?.exclusion_reason).toBe("empty_profile");
      expect(byRoute.get("/u/acq-content-profile")?.is_publicly_exposable).toBe(true);
      expect(byRoute.get("/u/acq-internal-profile")?.exclusion_reason).toBe("internal_admin");
      expect(byRoute.get("/u/acq-linked-profile")?.is_publicly_exposable).toBe(true);
      expect(byRoute.has("/business/acq-linked-business")).toBe(false);
      expect(byRoute.get("/business/acq-directory-only")?.entity_type).toBe(
        "governed_directory_business"
      );
      expect(byRoute.has("/u/acq-same-slug")).toBe(true);
      expect(byRoute.has("/business/acq-same-slug")).toBe(true);
      expect(byRoute.has("/business/acq-directory-stale")).toBe(false);

      await client.query(
        `update ts_seo_directory_snapshot_status
            set completed_at = now() - interval '24 hours 1 second'
          where snapshot_key = 'directory_scope_v1'`
      );
      const expiredSnapshotResult = await client.query(profileCatalogSql);
      expect(
        expiredSnapshotResult.rows.some((row) => row.entity_type === "governed_directory_business")
      ).toBe(false);
      expect(
        expiredSnapshotResult.rows.some((row) => row.identity_route === "/u/acq-public-meaningful")
      ).toBe(true);
    } finally {
      await client.query("rollback");
    }
  });
});
