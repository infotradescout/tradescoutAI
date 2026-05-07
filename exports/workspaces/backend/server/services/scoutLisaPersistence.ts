import { pool } from "../db";
import { createHash } from "crypto";
import type { LisaFeedItem, LisaStoredFinding } from "../../shared/lisa";

/**
 * Scout LISA Persistence Service
 *
 * Handles storage and retrieval of Scout findings in the LISA findings table.
 * Ensures Scout intelligence is persisted and available for LISA's decision engine.
 */

export async function ensureScoutLisaTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scout_lisa_findings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lisa_finding_id varchar(255) NOT NULL UNIQUE,
      scout_type varchar(64) NOT NULL,
      county_fips varchar(10),
      county_name varchar(255),
      state_code varchar(2),
      trade varchar(128),
      headline text NOT NULL,
      narrative text NOT NULL,
      evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
      confidence varchar(16) NOT NULL,
      sources jsonb NOT NULL DEFAULT '[]'::jsonb,
      evidence_hash varchar(64),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz,
      value_numeric numeric,
      value_text text,
      trend_direction varchar(16),
      trend_magnitude numeric,
      conflict_status varchar(32),
      routing_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      scouting_report_json jsonb,
      INDEX scout_county_idx (county_fips),
      INDEX scout_trade_idx (trade),
      INDEX scout_type_idx (scout_type),
      INDEX scout_expires_idx (expires_at)
    )
  `);
}

function computeEvidenceHash(item: LisaFeedItem): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        headline: item.headline,
        narrative: item.narrative,
        evidence: item.evidence,
      })
    )
    .digest("hex");
}

export async function storeScoutLisaFinding(item: LisaFeedItem, scoutMetadata: {
  type: string;
  countyFips?: string;
  countyName?: string;
  stateCode?: string;
  trade?: string;
  confidence: "high" | "medium" | "low";
  valueNumeric?: number;
  valueText?: string;
  trendDirection?: "up" | "down" | "stable";
  trendMagnitude?: number;
  conflictStatus?: "no_conflict" | "resolved" | "unresolved";
  routingTags?: string[];
  sources: string[];
  expiresInMinutes?: number;
  scoutingReportJson?: string;
}): Promise<LisaStoredFinding> {
  const evidenceHash = computeEvidenceHash(item);
  const expiresAt = scoutMetadata.expiresInMinutes
    ? new Date(Date.now() + scoutMetadata.expiresInMinutes * 60 * 1000).toISOString()
    : null;

  const result = await pool.query(
    `
    INSERT INTO scout_lisa_findings (
      lisa_finding_id,
      scout_type,
      county_fips,
      county_name,
      state_code,
      trade,
      headline,
      narrative,
      evidence,
      confidence,
      sources,
      evidence_hash,
      created_at,
      updated_at,
      expires_at,
      value_numeric,
      value_text,
      trend_direction,
      trend_magnitude,
      conflict_status,
      routing_tags,
      scouting_report_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now(), $13, $14, $15, $16, $17, $18, $19, $20)
    ON CONFLICT (lisa_finding_id) DO UPDATE SET
      scout_type = EXCLUDED.scout_type,
      county_fips = EXCLUDED.county_fips,
      county_name = EXCLUDED.county_name,
      state_code = EXCLUDED.state_code,
      trade = EXCLUDED.trade,
      headline = EXCLUDED.headline,
      narrative = EXCLUDED.narrative,
      evidence = EXCLUDED.evidence,
      confidence = EXCLUDED.confidence,
      sources = EXCLUDED.sources,
      evidence_hash = EXCLUDED.evidence_hash,
      updated_at = now(),
      expires_at = EXCLUDED.expires_at,
      value_numeric = EXCLUDED.value_numeric,
      value_text = EXCLUDED.value_text,
      trend_direction = EXCLUDED.trend_direction,
      trend_magnitude = EXCLUDED.trend_magnitude,
      conflict_status = EXCLUDED.conflict_status,
      routing_tags = EXCLUDED.routing_tags,
      scouting_report_json = EXCLUDED.scouting_report_json
    RETURNING *
    `,
    [
      item.id,
      scoutMetadata.type,
      scoutMetadata.countyFips || null,
      scoutMetadata.countyName || null,
      scoutMetadata.stateCode || null,
      scoutMetadata.trade || null,
      item.headline,
      item.narrative,
      JSON.stringify(item.evidence),
      scoutMetadata.confidence,
      JSON.stringify(scoutMetadata.sources),
      evidenceHash,
      expiresAt,
      scoutMetadata.valueNumeric || null,
      scoutMetadata.valueText || null,
      scoutMetadata.trendDirection || null,
      scoutMetadata.trendMagnitude || null,
      scoutMetadata.conflictStatus || null,
      JSON.stringify(scoutMetadata.routingTags || []),
      scoutMetadata.scoutingReportJson ? JSON.stringify(scoutMetadata.scoutingReportJson) : null,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.lisa_finding_id,
    priority: item.priority,
    sourceKind: item.sourceKind,
    headline: row.headline,
    narrative: row.narrative,
    evidence: row.evidence,
    freshnessMinutes: Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000)),
    truthStatus: item.truthStatus || "current",
    scopeType: item.scopeType || "global",
    scopeRef: item.scopeRef || null,
    engineVersion: item.engineVersion,
    supersedesId: item.supersedesId,
    generatedAt: row.created_at.toISOString(),
    valueNumeric: row.value_numeric ? parseFloat(row.value_numeric) : undefined,
    valueText: row.value_text,
    trendDirection: row.trend_direction,
    trendMagnitude: row.trend_magnitude ? parseFloat(row.trend_magnitude) : undefined,
    conflictStatus: row.conflict_status,
    routingTags: row.routing_tags,
    scoutingReportJson: row.scouting_report_json,
  };
}

export async function storeScoutLisaFindings(items: Array<{
  item: LisaFeedItem;
  metadata: {
    type: string;
    countyFips?: string;
    countyName?: string;
    stateCode?: string;
    trade?: string;
    confidence: "high" | "medium" | "low";
    valueNumeric?: number;
    valueText?: string;
    trendDirection?: "up" | "down" | "stable";
    trendMagnitude?: number;
    conflictStatus?: "no_conflict" | "resolved" | "unresolved";
    routingTags?: string[];
    sources: string[];
    expiresInMinutes?: number;
    scoutingReportJson?: string;
  };
}>): Promise<LisaStoredFinding[]> {
  return Promise.all(items.map(({ item, metadata }) => storeScoutLisaFinding(item, metadata)));
}

export async function getScoutLisaFindingsByCounty(countyFips: string): Promise<LisaStoredFinding[]> {
  const result = await pool.query(
    `
    SELECT * FROM scout_lisa_findings
    WHERE county_fips = $1
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [countyFips]
  );

  return result.rows.map((row) => ({
    id: row.lisa_finding_id,
    priority: "high" as const,
    sourceKind: "scout_intelligence" as const,
    headline: row.headline,
    narrative: row.narrative,
    evidence: row.evidence,
    freshnessMinutes: Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000)),
    truthStatus: "current" as const,
    scopeType: "county" as const,
    scopeRef: row.county_fips,
    engineVersion: row.engineVersion,
    supersedesId: row.supersedesId,
    generatedAt: row.created_at.toISOString(),
    valueNumeric: row.value_numeric ? parseFloat(row.value_numeric) : undefined,
    valueText: row.value_text,
    trendDirection: row.trend_direction,
    trendMagnitude: row.trend_magnitude ? parseFloat(row.trend_magnitude) : undefined,
    conflictStatus: row.conflict_status,
    routingTags: row.routing_tags,
    scoutingReportJson: row.scouting_report_json,
  }));
}

export async function getScoutLisaFindingsByTrade(trade: string): Promise<LisaStoredFinding[]> {
  const result = await pool.query(
    `
    SELECT * FROM scout_lisa_findings
    WHERE trade = $1
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [trade]
  );

  return result.rows.map((row) => ({
    id: row.lisa_finding_id,
    priority: "high" as const,
    sourceKind: "scout_intelligence" as const,
    headline: row.headline,
    narrative: row.narrative,
    evidence: row.evidence,
    freshnessMinutes: Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000)),
    truthStatus: "current" as const,
    scopeType: "category" as const,
    scopeRef: trade,
    engineVersion: row.engineVersion,
    supersedesId: row.supersedesId,
    generatedAt: row.created_at.toISOString(),
    valueNumeric: row.value_numeric ? parseFloat(row.value_numeric) : undefined,
    valueText: row.value_text,
    trendDirection: row.trend_direction,
    trendMagnitude: row.trend_magnitude ? parseFloat(row.trend_magnitude) : undefined,
    conflictStatus: row.conflict_status,
    routingTags: row.routing_tags,
    scoutingReportJson: row.scouting_report_json,
  }));
}

export async function cleanupExpiredScoutFindings(): Promise<number> {
  const result = await pool.query(
    `
    DELETE FROM scout_lisa_findings
    WHERE expires_at IS NOT NULL AND expires_at < now()
    `
  );

  return result.rowCount || 0;
}

export async function getScoutLisaStats(): Promise<{
  totalFindings: number;
  byType: Record<string, number>;
  byCounty: Record<string, number>;
  byTrade: Record<string, number>;
  expiredCount: number;
}> {
  const [totalResult, typeResult, countyResult, tradeResult, expiredResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM scout_lisa_findings WHERE expires_at IS NULL OR expires_at > now()`),
    pool.query(`SELECT scout_type, COUNT(*) as count FROM scout_lisa_findings WHERE expires_at IS NULL OR expires_at > now() GROUP BY scout_type`),
    pool.query(`SELECT county_fips, COUNT(*) as count FROM scout_lisa_findings WHERE county_fips IS NOT NULL AND (expires_at IS NULL OR expires_at > now()) GROUP BY county_fips`),
    pool.query(`SELECT trade, COUNT(*) as count FROM scout_lisa_findings WHERE trade IS NOT NULL AND (expires_at IS NULL OR expires_at > now()) GROUP BY trade`),
    pool.query(`SELECT COUNT(*) as count FROM scout_lisa_findings WHERE expires_at IS NOT NULL AND expires_at < now()`),
  ]);

  return {
    totalFindings: parseInt(totalResult.rows[0]?.count || 0),
    byType: Object.fromEntries(typeResult.rows.map((r) => [r.scout_type, parseInt(r.count)])),
    byCounty: Object.fromEntries(countyResult.rows.map((r) => [r.county_fips, parseInt(r.count)])),
    byTrade: Object.fromEntries(tradeResult.rows.map((r) => [r.trade, parseInt(r.count)])),
    expiredCount: parseInt(expiredResult.rows[0]?.count || 0),
  };
}
