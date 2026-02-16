import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;

function ok(name, detail) {
  return { name, status: "pass", detail };
}

function fail(name, detail) {
  return { name, status: "fail", detail };
}

function warn(name, detail) {
  return { name, status: "warn", detail };
}

async function countRepoMigrations() {
  const dir = path.resolve("migrations");
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^\d{4}_.+\.sql$/i.test(name))
    .length;
}

async function getRepoMigrationJournalState() {
  const journalPath = path.resolve("migrations", "meta", "_journal.json");
  const raw = await fs.readFile(journalPath, "utf8");
  const journal = JSON.parse(raw);
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];
  const latest = entries.length > 0 ? entries[entries.length - 1] : null;

  return {
    count: entries.length,
    latestTag: latest?.tag ?? null,
    latestWhen: latest ? Number(latest.when) : null,
  };
}

async function run() {
  const checks = [];
  const dbUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    checks.push(fail("database_url", "DATABASE_URL/TEST_DATABASE_URL missing"));
    return { checks, passed: false };
  }

  checks.push(ok("database_url", "Database URL is configured"));
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    checks.push(ok("db_connectivity", "Connected to Postgres"));

    const [maxConnRes, currentConnRes] = await Promise.all([
      client.query("select setting::int as max from pg_settings where name='max_connections'"),
      client.query("select count(*)::int as n from pg_stat_activity"),
    ]);
    const maxConnections = Number(maxConnRes.rows?.[0]?.max ?? 0);
    const currentConnections = Number(currentConnRes.rows?.[0]?.n ?? 0);
    const usagePct =
      maxConnections > 0 ? Math.round((currentConnections / maxConnections) * 100) : 0;
    if (usagePct >= 85) {
      checks.push(
        warn(
          "db_connection_headroom",
          `Current connections ${currentConnections}/${maxConnections} (${usagePct}%)`
        )
      );
    } else {
      checks.push(
        ok(
          "db_connection_headroom",
          `Current connections ${currentConnections}/${maxConnections} (${usagePct}%)`
        )
      );
    }

    await client.query("create schema if not exists drizzle");
    await client.query(`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);

    const [dbMigrationCountRes, dbMigrationLatestRes, repoMigrationState, repoMigrationCount] = await Promise.all([
      client.query("select count(*)::int as n from drizzle.__drizzle_migrations"),
      client.query(
        "select created_at from drizzle.__drizzle_migrations order by created_at desc nulls last limit 1"
      ),
      getRepoMigrationJournalState(),
      countRepoMigrations(),
    ]);

    const dbMigrationCount = Number(dbMigrationCountRes.rows?.[0]?.n ?? 0);
    const dbLatestCreatedAt = Number(dbMigrationLatestRes.rows?.[0]?.created_at ?? 0);
    if (dbMigrationCount < repoMigrationCount) {
      const markerRes = await client.query(`
        select
          to_regclass('public.home_scout_market_buckets') is not null as has_homescout_buckets,
          to_regclass('public.commercial_projects') is not null as has_commercial_projects,
          to_regclass('public.commercial_project_bids') is not null as has_commercial_bids
      `);
      const marker = markerRes.rows?.[0] || {};
      const hasMarkers =
        Boolean(marker.has_homescout_buckets) &&
        Boolean(marker.has_commercial_projects) &&
        Boolean(marker.has_commercial_bids);

      if (hasMarkers) {
        const latestRepoWhen = Number(repoMigrationState.latestWhen ?? 0);
        if (latestRepoWhen > 0 && dbLatestCreatedAt >= latestRepoWhen) {
          checks.push(
            ok(
              "migration_state",
              `Baselined DB ledger is aligned to latest repo migration (${repoMigrationState.latestTag})`
            )
          );
        } else {
          checks.push(
            warn(
              "migration_state",
              `Baselined DB detected (${dbMigrationCount}/${repoMigrationCount}) with required schema markers present`
            )
          );
        }
      } else {
        checks.push(
          fail(
            "migration_state",
            `DB has ${dbMigrationCount}/${repoMigrationCount} migrations and missing required schema markers. Run npm run db:migrate.`
          )
        );
      }
    } else {
      checks.push(
        ok(
          "migration_state",
          `DB migrations ${dbMigrationCount}, repo migrations ${repoMigrationCount}`
        )
      );
    }

    const mockRowsRes = await client.query(`
      select count(*)::int as n
      from commercial_projects
      where title ~* '(mock|demo|sample|test|placeholder)'
         or summary ~* '(mock|demo|sample|test|placeholder)'
         or slug ~* '(mock|demo|sample|test|placeholder)'
    `);
    const mockRows = Number(mockRowsRes.rows?.[0]?.n ?? 0);
    if (mockRows > 0) {
      checks.push(fail("commercial_mock_rows", `Found ${mockRows} forbidden commercial mock rows`));
    } else {
      checks.push(ok("commercial_mock_rows", "No forbidden commercial mock rows"));
    }

    const unverifiedBidRes = await client.query(`
      select count(*)::int as n
      from commercial_project_bids b
      join contractors c on c.id = b.contractor_id
      where b.status in ('submitted', 'shortlisted', 'accepted')
        and (coalesce(c.verified_licensed, false) = false or coalesce(c.verified_insured, false) = false)
    `);
    const unverifiedBidCount = Number(unverifiedBidRes.rows?.[0]?.n ?? 0);
    if (unverifiedBidCount > 0) {
      checks.push(
        fail("commercial_bid_integrity", `Found ${unverifiedBidCount} active bids from unverified contractors`)
      );
    } else {
      checks.push(ok("commercial_bid_integrity", "All active bids belong to verified contractors"));
    }

    const openProjectsRes = await client.query(`
      select count(*)::int as n
      from commercial_projects
      where status = 'open'
    `);
    checks.push(ok("commercial_open_projects", `Open commercial projects: ${openProjectsRes.rows?.[0]?.n ?? 0}`));
  } catch (error) {
    checks.push(
      fail(
        "runtime_exception",
        error instanceof Error ? error.message : "Unknown readiness error"
      )
    );
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }

  const passed = checks.every((c) => c.status !== "fail");
  return { checks, passed };
}

run()
  .then((result) => {
    const lines = result.checks.map((check) => {
      const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
      return `${marker} ${check.name}: ${check.detail}`;
    });
    console.log(lines.join("\n"));
    if (!result.passed) process.exit(1);
  })
  .catch((error) => {
    console.error("FAIL readiness_runner:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
