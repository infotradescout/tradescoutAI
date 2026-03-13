import { pool } from "../db";
import { ensureLiveStreamSnapshotTables } from "./liveStreamSnapshotService";
import { ensurePartnerIntelligenceBriefSnapshotsTable } from "./partnerIntelligenceBriefSnapshotService";
import { ensureTradepartnerCountyObservationSnapshotsTable } from "./partnerCountyObservationSnapshotService";
import { ensureSeoDirectoryScopeSnapshotTables } from "./seoDirectoryScopeSnapshotJob";

type SnapshotStatusRow = {
  key:
    | "partner_county_observation"
    | "partner_intelligence_brief"
    | "live_stream"
    | "seo_trade_county_pages"
    | "seo_trade_city_pages";
  label: string;
  latestComputedAt: string | null;
  rowCount: number;
  staleAfterMinutes: number;
  isStale: boolean;
};

export type SnapshotStatusSummary = {
  generatedAt: string;
  schedulerEnabled: boolean;
  statuses: SnapshotStatusRow[];
};

async function querySnapshotStatus(args: {
  table: string;
  timestampColumn: string;
  key: SnapshotStatusRow["key"];
  label: string;
  staleAfterMinutes: number;
}): Promise<SnapshotStatusRow> {
  let result;
  try {
    result = await pool.query(
      `
        select
          max(${args.timestampColumn}) as latest_computed_at,
          count(*)::int as row_count
        from ${args.table}
      `
    );
  } catch (error) {
    console.warn(`[snapshot-status] degraded ${args.table}:`, error);
    result = { rows: [{ latest_computed_at: null, row_count: 0 }] };
  }

  const latestComputedAtRaw = result.rows?.[0]?.latest_computed_at;
  const rowCount = Number(result.rows?.[0]?.row_count || 0);
  const latestComputedAt = latestComputedAtRaw ? new Date(String(latestComputedAtRaw)) : null;
  const isStale =
    !latestComputedAt ||
    !Number.isFinite(latestComputedAt.getTime()) ||
    Date.now() - latestComputedAt.getTime() > args.staleAfterMinutes * 60 * 1000;

  return {
    key: args.key,
    label: args.label,
    latestComputedAt:
      latestComputedAt && Number.isFinite(latestComputedAt.getTime())
        ? latestComputedAt.toISOString()
        : null,
    rowCount,
    staleAfterMinutes: args.staleAfterMinutes,
    isStale,
  };
}

export async function getSnapshotStatusSummary(): Promise<SnapshotStatusSummary> {
  try {
    await Promise.all([
      ensureTradepartnerCountyObservationSnapshotsTable(),
      ensurePartnerIntelligenceBriefSnapshotsTable(),
      ensureLiveStreamSnapshotTables(),
      ensureSeoDirectoryScopeSnapshotTables(),
    ]);
  } catch (error) {
    console.warn("[snapshot-status] ensure degraded:", error);
  }

  const statuses = await Promise.all([
    querySnapshotStatus({
      table: "tradepartner_county_observation_snapshots",
      timestampColumn: "computed_at",
      key: "partner_county_observation",
      label: "Partner County Observation",
      staleAfterMinutes: 30,
    }),
    querySnapshotStatus({
      table: "tradepartner_intelligence_brief_snapshots",
      timestampColumn: "computed_at",
      key: "partner_intelligence_brief",
      label: "Partner Intelligence Brief",
      staleAfterMinutes: 30,
    }),
    querySnapshotStatus({
      table: "admin_live_stream_snapshots",
      timestampColumn: "computed_at",
      key: "live_stream",
      label: "Admin Live Stream",
      staleAfterMinutes: 10,
    }),
    querySnapshotStatus({
      table: "ts_seo_trade_county_pages",
      timestampColumn: "updated_at",
      key: "seo_trade_county_pages",
      label: "SEO Trade County Pages",
      staleAfterMinutes: 60 * 12,
    }),
    querySnapshotStatus({
      table: "ts_seo_trade_city_pages",
      timestampColumn: "updated_at",
      key: "seo_trade_city_pages",
      label: "SEO Trade City Pages",
      staleAfterMinutes: 60 * 12,
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    schedulerEnabled: String(process.env.SCHEDULER_ENABLED || "").toLowerCase() === "true",
    statuses,
  };
}
