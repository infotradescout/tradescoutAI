/**
 * HomeScout bootstrap (dev/staging)
 *
 * What it does:
 * - Ensures a HomeScout source exists (default: repo seed file for county 22105)
 * - Runs ingestion for that source (or all enabled sources)
 * - Runs the bucket + county metrics jobs so UI has precomputed context
 *
 * Usage:
 *   npm run homescout:bootstrap
 *
 * Advanced:
 *   tsx -r dotenv/config scripts/homescout-bootstrap.ts --sourceKey seed_22105 --path data/homescout/seed-22105.json
 *   tsx -r dotenv/config scripts/homescout-bootstrap.ts --runAllSources
 */

import { pool } from "../server/db";
import { storage } from "../server/storage";
import { runHomeScoutIngestionJob } from "../server/services/homeScoutIngestionJob";
import { runHomeScoutBucketMetricsJob } from "../server/services/homeScoutBucketMetricsJob";
import { runHomeScoutAggregationJob } from "../server/services/homeScoutAggregationJob";
import { runHomeScoutMarketMetricsJob } from "../server/services/homeScoutMarketMetricsJob";
import fs from "fs/promises";
import path from "path";

type Args = {
  sourceKey: string;
  sourceType: "json_file" | "json_url";
  path?: string;
  url?: string;
  enabled: boolean;
  staleAfterDays: number;
  autoActivate: boolean;
  runAllSources: boolean;
};

async function applySqlFile(relPath: string) {
  const abs = path.resolve(process.cwd(), relPath);
  const sql = await fs.readFile(abs, "utf8");
  await pool.query(sql);
}

async function ensureHomeScoutSchema() {
  // We intentionally apply repo SQL migrations directly here because:
  // - direct SQL is deterministic even when local Drizzle metadata drifts
  // - drizzle-kit push can prompt interactively (rename detection)
  const files = [
    "migrations/0038_county_intelligence_containers.sql",
    "migrations/0034_homescout_listings.sql",
    "migrations/0035_homescout_search_indexes.sql",
    "migrations/0036_homescout_reports.sql",
    "migrations/0037_homescout_ingestion.sql",
    "migrations/0039_homescout_inspections.sql",
  ];

  for (const f of files) {
    try {
      await applySqlFile(f);
      console.log("[HomeScoutBootstrap] Applied:", f);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed applying ${f}: ${msg}`);
    }
  }
}

function readArgValue(flag: string): string | null {
  const idx = process.argv.findIndex((x) => x === `--${flag}` || x.startsWith(`--${flag}=`));
  if (idx === -1) return null;
  const token = process.argv[idx] ?? "";
  if (token.includes("=")) return token.split("=").slice(1).join("=") || null;
  const next = process.argv[idx + 1];
  return next && !next.startsWith("--") ? next : null;
}

function readBool(flag: string, defaultValue: boolean): boolean {
  const raw = readArgValue(flag);
  if (raw == null) {
    return process.argv.includes(`--${flag}`) ? true : defaultValue;
  }
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return defaultValue;
}

function readString(flag: string, defaultValue: string): string {
  const raw = readArgValue(flag);
  return raw == null || raw.trim().length === 0 ? defaultValue : raw.trim();
}

function readInt(flag: string, defaultValue: number): number {
  const raw = readArgValue(flag);
  const n = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.trunc(n);
}

function parseArgs(): Args {
  const sourceKey = readString("sourceKey", "seed_22105");
  const sourceTypeRaw = readString("sourceType", "json_file");
  const sourceType = sourceTypeRaw === "json_url" ? "json_url" : "json_file";

  const enabled = readBool("enabled", true);
  const autoActivate = readBool("autoActivate", true);
  const staleAfterDays = Math.max(1, Math.min(365, readInt("staleAfterDays", 7)));
  const runAllSources = readBool("runAllSources", false);

  const path = readArgValue("path") ?? undefined;
  const url = readArgValue("url") ?? undefined;

  return {
    sourceKey,
    sourceType,
    path,
    url,
    enabled,
    staleAfterDays,
    autoActivate,
    runAllSources,
  };
}

async function ensureSource(args: Args) {
  const existing = await storage.getHomeScoutSourceByKey(args.sourceKey);
  const nextConfig: Record<string, any> = {
    staleAfterDays: args.staleAfterDays,
    autoActivate: args.autoActivate,
  };
  if (args.sourceType === "json_file") {
    nextConfig.path = args.path || "data/homescout/seed-22105.json";
  } else {
    if (!args.url) {
      throw new Error(`--url is required when --sourceType json_url`);
    }
    nextConfig.url = args.url;
    nextConfig.timeoutMs = 15000;
  }

  if (!existing) {
    return await storage.createHomeScoutSource({
      sourceKey: args.sourceKey,
      sourceType: args.sourceType,
      enabled: args.enabled,
      config: nextConfig as any,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
    } as any);
  }

  const mergedConfig = { ...(existing as any).config, ...nextConfig };
  return await storage.updateHomeScoutSource(existing.id, {
    enabled: args.enabled,
    sourceType: args.sourceType as any,
    config: mergedConfig as any,
  } as any);
}

async function main() {
  const args = parseArgs();

  await ensureHomeScoutSchema();

  const source = await ensureSource(args);
  if (!source) {
    throw new Error("Failed to ensure HomeScout source");
  }

  console.log("[HomeScoutBootstrap] Source ensured:", {
    id: source.id,
    sourceKey: (source as any).sourceKey,
    sourceType: (source as any).sourceType,
    enabled: (source as any).enabled,
    config: (source as any).config,
  });

  const ingestion = await runHomeScoutIngestionJob(
    args.runAllSources ? undefined : { sourceId: source.id }
  );
  console.log("[HomeScoutBootstrap] Ingestion complete:", ingestion);

  const buckets = await runHomeScoutBucketMetricsJob();
  console.log("[HomeScoutBootstrap] Bucket metrics complete:", buckets);

  const agg = await runHomeScoutAggregationJob();
  console.log("[HomeScoutBootstrap] County listings metric complete:", agg);

  const market = await runHomeScoutMarketMetricsJob();
  console.log("[HomeScoutBootstrap] County market metrics complete:", market);
}

main()
  .catch((err) => {
    console.error("[HomeScoutBootstrap] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // ensure the process exits cleanly in scripts/CI
    try {
      await pool.end();
    } catch {
      // ignore
    }
  });
