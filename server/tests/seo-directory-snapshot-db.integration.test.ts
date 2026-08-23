import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertSeoDirectoryScopeSourceCapacity,
  runSeoDirectoryScopeSnapshotJob,
  SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP,
} from "../services/seoDirectoryScopeSnapshotJob";
import { assertSeoDirectorySnapshotReady } from "../services/seoDirectoryNavigationService";
import { invalidatePublicationRulesCache } from "../publicationRules";
import { pool } from "../db";

const connectionString = process.env.TEST_DATABASE_URL || "";
const describeWithDb = connectionString ? describe : describe.skip;

const SNAPSHOT_TABLES = [
  "ts_seo_directory_business_counties",
  "ts_seo_directory_business_pages",
  "ts_seo_trade_county_pages",
  "ts_seo_trade_city_pages",
  "ts_seo_trade_city_county_pages",
  "ts_seo_city_county_pages",
] as const;

async function scalar(client: pg.Client, query: string): Promise<number> {
  const result = await client.query(query);
  return Number(result.rows[0]?.value || 0);
}

async function snapshotCounts(client: pg.Client) {
  return {
    businesses: await scalar(
      client,
      "select count(*)::int as value from ts_seo_directory_business_pages"
    ),
    businessCounties: await scalar(
      client,
      "select count(*)::int as value from ts_seo_directory_business_counties"
    ),
    tradeCounties: await scalar(
      client,
      "select count(*)::int as value from ts_seo_trade_county_pages"
    ),
    tradeCities: await scalar(client, "select count(*)::int as value from ts_seo_trade_city_pages"),
    tradeCityCounties: await scalar(
      client,
      "select count(*)::int as value from ts_seo_trade_city_county_pages"
    ),
    cityCounties: await scalar(
      client,
      "select count(*)::int as value from ts_seo_city_county_pages"
    ),
  };
}

async function snapshotGeneration(client: pg.Client): Promise<number> {
  return scalar(
    client,
    `select coalesce(max(generation), 0)::int as value
       from ts_seo_directory_snapshot_status
      where snapshot_key = 'directory_scope_v1'`
  );
}

describeWithDb("SEO directory snapshot disposable PostgreSQL proof", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString });
    await client.connect();

    // This suite is only wired into the release gate against TEST_DATABASE_URL.
    // Start from an empty disposable catalog so assertions cannot be satisfied
    // by stale diagnostic fixtures or a prior snapshot generation.
    await client.query("truncate table businesses cascade");
    await client.query("truncate table counties cascade");
    await client.query("delete from states");
    await client.query(`truncate table ${SNAPSHOT_TABLES.join(", ")}`);
    await client.query("delete from ts_seo_directory_snapshot_status");
    invalidatePublicationRulesCache();
  });

  afterAll(async () => {
    if (client) {
      await client.query(
        "drop trigger if exists ts_test_reject_snapshot_publish on ts_seo_directory_snapshot_status"
      );
      await client.query("drop function if exists ts_test_reject_snapshot_publish() cascade");
      await client.query("truncate table businesses cascade");
      await client.query("truncate table counties cascade");
      await client.query("delete from states");
      await client.query(`truncate table ${SNAPSHOT_TABLES.join(", ")}`);
      await client.query("delete from ts_seo_directory_snapshot_status");
      await client.end();
    }
    await pool.end();
  });

  it("publishes only exact governed scope and preserves the last complete generation", async () => {
    // Cold start fails closed. A successfully completed empty snapshot is a
    // distinct, authoritative state and must be accepted.
    await expect(assertSeoDirectorySnapshotReady()).rejects.toThrow(
      /no fresh completed generation/i
    );
    const empty = await runSeoDirectoryScopeSnapshotJob();
    expect(empty).toMatchObject({
      directoryBusinesses: 0,
      tradeCountyPages: 0,
      tradeCityPages: 0,
      tradeCityCountyPages: 0,
      cityCountyPages: 0,
      businessesScanned: 0,
    });
    await expect(assertSeoDirectorySnapshotReady()).resolves.toMatchObject({ generation: 1 });
    expect(await snapshotCounts(client)).toEqual({
      businesses: 0,
      businessCounties: 0,
      tradeCounties: 0,
      tradeCities: 0,
      tradeCityCounties: 0,
      cityCounties: 0,
    });

    await client.query(`
      insert into states (id, name, code)
      values ('seo-proof-fl', 'Florida', 'FL'), ('seo-proof-al', 'Alabama', 'AL');

      insert into counties (id, name, fips, state_code)
      values
        ('seo-proof-county-a', 'Alpha County', '12981', 'FL'),
        ('seo-proof-county-b', 'Beta County', '12982', 'FL'),
        ('seo-proof-county-c', 'Gamma County', '01981', 'AL');

      insert into businesses (
        id, name, slug, role_context, status, claim_status,
        public_discovery_enabled, profile_data, updated_at
      ) values
        (
          'seo-proof-mapped', 'Proof Plumbing', 'proof-plumbing', 'contractor',
          'active', 'unclaimed', true,
          '{"category":"plumber","services":["plumbing"],"city":"Proofville","stateCode":"FL"}'::jsonb,
          now()
        ),
        (
          'seo-proof-unmapped', 'Proof Stone Supply', 'proof-stone-supply', 'contractor',
          'active', 'unclaimed', true,
          '{"category":"stone supplier","services":["natural stone slabs"],"city":"Proofville","stateCode":"FL"}'::jsonb,
          now()
        ),
        (
          'seo-proof-nonprod', 'QA Proof Roofing', 'qa-proof-roofing', 'contractor',
          'active', 'unclaimed', true,
          '{"category":"roofer","services":["roofing"],"city":"Proofville","stateCode":"FL"}'::jsonb,
          now()
        );

      insert into business_counties (id, business_id, county_id)
      values
        ('seo-proof-membership-1', 'seo-proof-mapped', 'seo-proof-county-a'),
        ('seo-proof-membership-2', 'seo-proof-mapped', 'seo-proof-county-b'),
        ('seo-proof-membership-3', 'seo-proof-unmapped', 'seo-proof-county-a'),
        ('seo-proof-membership-4', 'seo-proof-nonprod', 'seo-proof-county-a');
    `);

    const populated = await runSeoDirectoryScopeSnapshotJob();
    expect(populated).toMatchObject({
      directoryBusinesses: 2,
      tradeCountyPages: 2,
      tradeCityPages: 1,
      tradeCityCountyPages: 2,
      cityCountyPages: 2,
      businessesScanned: 4,
    });
    expect(await snapshotGeneration(client)).toBe(2);
    expect(await snapshotCounts(client)).toEqual({
      businesses: 2,
      businessCounties: 3,
      tradeCounties: 2,
      tradeCities: 1,
      tradeCityCounties: 2,
      cityCounties: 2,
    });
    expect(
      await client.query(
        "select slug, trade_slug from ts_seo_directory_business_pages order by slug"
      )
    ).toMatchObject({
      rows: [
        { slug: "proof-plumbing", trade_slug: "plumbing" },
        { slug: "proof-stone-supply", trade_slug: null },
      ],
    });

    // A stable refresh advances exactly one generation without multiplying a
    // multi-county business in the city aggregate.
    const generationNCounts = await snapshotCounts(client);
    await runSeoDirectoryScopeSnapshotJob();
    expect(await snapshotGeneration(client)).toBe(3);
    expect(await snapshotCounts(client)).toEqual(generationNCounts);

    // Force the final publication marker to fail after replacement starts.
    // PostgreSQL must roll the whole transaction back to generation N.
    await client.query(`
      create function ts_test_reject_snapshot_publish()
      returns trigger language plpgsql as $$
      begin
        raise exception 'forced snapshot publication failure';
      end;
      $$;
      create trigger ts_test_reject_snapshot_publish
      before insert or update on ts_seo_directory_snapshot_status
      for each row execute function ts_test_reject_snapshot_publish();
    `);
    let publicationFailure: any = null;
    try {
      await runSeoDirectoryScopeSnapshotJob();
    } catch (error) {
      publicationFailure = error;
    }
    expect(String(publicationFailure?.message || publicationFailure)).toMatch(/Failed query/i);
    expect(String(publicationFailure?.cause?.message || "")).toMatch(
      /forced snapshot publication failure/i
    );
    expect(await snapshotGeneration(client)).toBe(3);
    expect(await snapshotCounts(client)).toEqual(generationNCounts);
    await client.query(
      "drop trigger ts_test_reject_snapshot_publish on ts_seo_directory_snapshot_status"
    );
    await client.query("drop function ts_test_reject_snapshot_publish()");

    // A current live-negative status removes the detail and every aggregate
    // membership on the next completed snapshot. The unmapped business remains
    // a truthful detail page and never manufactures a trade/location scope.
    await client.query(
      "update businesses set public_discovery_enabled = false where id = 'seo-proof-mapped'"
    );
    const revoked = await runSeoDirectoryScopeSnapshotJob();
    expect(revoked).toMatchObject({
      directoryBusinesses: 1,
      tradeCountyPages: 0,
      tradeCityPages: 0,
      tradeCityCountyPages: 0,
      cityCountyPages: 0,
      businessesScanned: 2,
    });
    expect(await snapshotGeneration(client)).toBe(4);
    expect(await snapshotCounts(client)).toEqual({
      businesses: 1,
      businessCounties: 1,
      tradeCounties: 0,
      tradeCities: 0,
      tradeCityCounties: 0,
      cityCounties: 0,
    });

    // Capacity rejection happens before any replacement transaction. The
    // already-published generation and rows must remain untouched.
    const beforeCapacityFailure = await snapshotCounts(client);
    expect(() =>
      assertSeoDirectoryScopeSourceCapacity(SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP + 1)
    ).toThrow(/preserving the previous complete snapshot/i);
    expect(await snapshotGeneration(client)).toBe(4);
    expect(await snapshotCounts(client)).toEqual(beforeCapacityFailure);
  });
});
