import { createHash } from "node:crypto";
import { pool } from "../db";
import type { LisaFeedItem, LisaFeedPriority, LisaTruthStatus } from "../../shared/lisa";

export interface ScoutLisaFindingRecord extends LisaFeedItem {
  findingKey: string;
  missionId: string;
  countyFips: string | null;
  stateCode: string | null;
  trade: string | null;
  learningMode: boolean;
  evidenceHash: string;
  expiresAt: string | null;
  payloadJson: Record<string, unknown>;
  generatedAt: string;
  updatedAt: string;
}

export interface ScoutLisaPersistenceInput {
  missionId: string;
  countyFips?: string;
  stateCode?: string;
  trade?: string;
  learningMode?: boolean;
  engineVersion?: string;
  payload?: Record<string, unknown>;
}

export interface ScoutLisaPersistenceResult {
  savedCount: number;
  findings: ScoutLisaFindingRecord[];
}

let ensurePromise: Promise<void> | null = null;

function toIsoString(value: unknown): string {
  const parsed = new Date(String(value || ""));
  if (!Number.isFinite(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function hashPayload(item: LisaFeedItem): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: item.id,
        priority: item.priority,
        headline: item.headline,
        narrative: item.narrative,
        evidence: item.evidence,
        freshnessMinutes: item.freshnessMinutes,
        truthStatus: item.truthStatus || null,
        scopeType: item.scopeType || null,
        scopeRef: item.scopeRef || null,
        engineVersion: item.engineVersion || null,
      })
    )
    .digest("hex");
}

function priorityRank(priority: string): number {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}

function coerceTruthStatus(value: unknown): LisaTruthStatus {
  if (value === "stale" || value === "superseded" || value === "suppressed") {
    return value;
  }
  return "current";
}

function mapRow(row: any): ScoutLisaFindingRecord {
  const freshnessMinutes =
    typeof row.freshness_minutes === "number"
      ? row.freshness_minutes
      : typeof row.freshness_minutes === "string" && row.freshness_minutes.trim().length > 0
        ? Number(row.freshness_minutes)
        : null;

  return {
    findingKey: String(row.finding_key),
    missionId: String(row.mission_id || ""),
    countyFips: row.county_fips || null,
    stateCode: row.state_code || null,
    trade: row.trade || null,
    learningMode: Boolean(row.learning_mode),
    id: String(row.finding_key),
    priority: row.priority,
    sourceKind: row.source_kind,
    headline: row.headline,
    narrative: row.narrative,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    freshnessMinutes: Number.isFinite(freshnessMinutes as number) ? freshnessMinutes : null,
    truthStatus: coerceTruthStatus(row.truth_status),
    scopeType: row.scope_type || "global",
    scopeRef: row.scope_ref || null,
    engineVersion: row.engine_version || null,
    evidenceHash: String(row.evidence_hash || ""),
    expiresAt: row.expires_at ? toIsoString(row.expires_at) : null,
    payloadJson: (row.payload_json as Record<string, unknown>) || {},
    generatedAt: toIsoString(row.generated_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function ensureScoutLisaFindingsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scout_lisa_findings (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          mission_id varchar(80) NOT NULL,
          finding_key varchar(255) NOT NULL,
          source_kind varchar(64) NOT NULL,
          priority varchar(16) NOT NULL,
          truth_status varchar(16) NOT NULL DEFAULT 'current',
          scope_type varchar(32) NOT NULL DEFAULT 'global',
          scope_ref varchar(255),
          county_fips varchar(5),
          state_code varchar(2),
          trade varchar(64),
          headline text NOT NULL,
          narrative text NOT NULL,
          evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
          freshness_minutes integer,
          engine_version varchar(64),
          learning_mode boolean NOT NULL DEFAULT false,
          evidence_hash varchar(64),
          expires_at timestamptz,
          payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          generated_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      await pool.query(
        `ALTER TABLE IF EXISTS scout_lisa_findings ADD COLUMN IF NOT EXISTS county_fips varchar(5);`
      );
      await pool.query(
        `ALTER TABLE IF EXISTS scout_lisa_findings ADD COLUMN IF NOT EXISTS state_code varchar(2);`
      );
      await pool.query(
        `ALTER TABLE IF EXISTS scout_lisa_findings ADD COLUMN IF NOT EXISTS trade varchar(64);`
      );
      await pool.query(
        `ALTER TABLE IF EXISTS scout_lisa_findings ADD COLUMN IF NOT EXISTS learning_mode boolean NOT NULL DEFAULT false;`
      );
      await pool.query(
        `ALTER TABLE IF EXISTS scout_lisa_findings ADD COLUMN IF NOT EXISTS evidence_hash varchar(64);`
      );
      await pool.query(
        `ALTER TABLE IF EXISTS scout_lisa_findings ADD COLUMN IF NOT EXISTS expires_at timestamptz;`
      );
      await pool.query(
        `ALTER TABLE IF EXISTS scout_lisa_findings ADD COLUMN IF NOT EXISTS payload_json jsonb NOT NULL DEFAULT '{}'::jsonb;`
      );

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS scout_lisa_findings_key_idx ON scout_lisa_findings (finding_key);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS scout_lisa_findings_mission_idx ON scout_lisa_findings (mission_id, generated_at DESC);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS scout_lisa_findings_county_idx ON scout_lisa_findings (county_fips, generated_at DESC);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS scout_lisa_findings_priority_idx ON scout_lisa_findings (priority);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS scout_lisa_findings_expires_idx ON scout_lisa_findings (expires_at);`
      );
    })();
  }

  await ensurePromise;
}

function resolveExpiresAt(item: LisaFeedItem): string {
  const freshness = item.freshnessMinutes;
  const ttlMinutes =
    typeof freshness === "number" && Number.isFinite(freshness) && freshness >= 0
      ? Math.max(60, freshness * 4)
      : 24 * 60;
  return new Date(Date.now() + ttlMinutes * 60_000).toISOString();
}

export async function persistScoutLisaFindings(
  items: LisaFeedItem[],
  input: ScoutLisaPersistenceInput
): Promise<ScoutLisaPersistenceResult> {
  await ensureScoutLisaFindingsTable();

  if (!Array.isArray(items) || items.length === 0) {
    return { savedCount: 0, findings: [] };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const item of items) {
      const evidenceHash = hashPayload(item);
      const expiresAt = resolveExpiresAt(item);
      const payloadJson = {
        missionId: input.missionId,
        countyFips: input.countyFips || null,
        stateCode: input.stateCode || null,
        trade: input.trade || null,
        learningMode: Boolean(input.learningMode),
        engineVersion: input.engineVersion || item.engineVersion || null,
        ...input.payload,
      };

      await client.query(
        `
          INSERT INTO scout_lisa_findings (
            mission_id,
            finding_key,
            source_kind,
            priority,
            truth_status,
            scope_type,
            scope_ref,
            county_fips,
            state_code,
            trade,
            headline,
            narrative,
            evidence,
            freshness_minutes,
            engine_version,
            learning_mode,
            evidence_hash,
            expires_at,
            payload_json,
            generated_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13::jsonb,
            $14,
            $15,
            $16,
            $17,
            $18::timestamptz,
            $19::jsonb,
            $20::timestamptz,
            now()
          )
          ON CONFLICT (finding_key)
          DO UPDATE SET
            mission_id = EXCLUDED.mission_id,
            source_kind = EXCLUDED.source_kind,
            priority = EXCLUDED.priority,
            truth_status = EXCLUDED.truth_status,
            scope_type = EXCLUDED.scope_type,
            scope_ref = EXCLUDED.scope_ref,
            county_fips = EXCLUDED.county_fips,
            state_code = EXCLUDED.state_code,
            trade = EXCLUDED.trade,
            headline = EXCLUDED.headline,
            narrative = EXCLUDED.narrative,
            evidence = EXCLUDED.evidence,
            freshness_minutes = EXCLUDED.freshness_minutes,
            engine_version = EXCLUDED.engine_version,
            learning_mode = EXCLUDED.learning_mode,
            evidence_hash = EXCLUDED.evidence_hash,
            expires_at = EXCLUDED.expires_at,
            payload_json = EXCLUDED.payload_json,
            generated_at = EXCLUDED.generated_at,
            updated_at = now()
        `,
        [
          input.missionId,
          item.id,
          item.sourceKind,
          item.priority,
          item.truthStatus || "current",
          item.scopeType || "global",
          item.scopeRef || null,
          input.countyFips || null,
          input.stateCode || null,
          input.trade || null,
          item.headline,
          item.narrative,
          JSON.stringify(item.evidence || []),
          item.freshnessMinutes,
          input.engineVersion || item.engineVersion || null,
          Boolean(input.learningMode),
          evidenceHash,
          expiresAt,
          JSON.stringify(payloadJson),
          new Date().toISOString(),
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    savedCount: items.length,
    findings: await getCurrentScoutLisaFindings(input.countyFips || undefined),
  };
}

export async function getCurrentScoutLisaFindings(
  countyFips?: string
): Promise<ScoutLisaFindingRecord[]> {
  await ensureScoutLisaFindingsTable();

  const params: unknown[] = [];
  const countyClause =
    countyFips && /^\d{5}$/.test(countyFips)
      ? (() => {
          params.push(countyFips);
          return `AND county_fips = $${params.length}`;
        })()
      : "";

  const result = await pool.query(
    `
      SELECT *
      FROM scout_lisa_findings
      WHERE truth_status = 'current'
        AND (expires_at IS NULL OR expires_at > now())
        ${countyClause}
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END ASC,
        generated_at DESC
    `,
    params
  );

  return result.rows.map(mapRow);
}

export async function getScoutLisaFindingsSummary(): Promise<{
  totalCurrent: number;
  byPriority: Record<LisaFeedPriority, number>;
}> {
  await ensureScoutLisaFindingsTable();
  const result = await pool.query(`
    SELECT priority, count(*)::int AS count
    FROM scout_lisa_findings
    WHERE truth_status = 'current'
      AND (expires_at IS NULL OR expires_at > now())
    GROUP BY priority
  `);

  const byPriority: Record<LisaFeedPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const row of result.rows) {
    const priority = String(row.priority || "") as LisaFeedPriority;
    if (priority in byPriority) {
      byPriority[priority] = Number(row.count || 0);
    }
  }

  const totalCurrent = Object.values(byPriority).reduce((sum, count) => sum + count, 0);
  return { totalCurrent, byPriority };
}

export function rankScoutLisaFindingPriority(priority: string): number {
  return priorityRank(priority);
}
