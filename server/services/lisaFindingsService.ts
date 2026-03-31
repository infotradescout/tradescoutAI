import { createHash, randomUUID } from "crypto";
import { pool } from "../db";
import type {
  LisaFeedItem,
  LisaFeedResponse,
  LisaStoredFinding,
  LisaTruthStatus,
} from "../../shared/lisa";

const DEFAULT_ENGINE_VERSION = process.env.LISA_ENGINE_VERSION || "tradescout-local-v1";

let ensurePromise: Promise<void> | null = null;

function toIsoString(value: unknown): string {
  const parsed = new Date(String(value || ""));
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function buildFindingKey(item: LisaFeedItem): string {
  const scopeType = item.scopeType || "global";
  const scopeRef = item.scopeRef || "global";
  return `${scopeType}:${scopeRef}:${item.id}`;
}

function computeEvidenceHash(item: LisaFeedItem): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        headline: item.headline,
        narrative: item.narrative,
        evidence: item.evidence,
        freshnessMinutes: item.freshnessMinutes,
      })
    )
    .digest("hex");
}

function coerceTruthStatus(value: unknown): LisaTruthStatus {
  if (value === "stale" || value === "superseded" || value === "suppressed") return value;
  return "current";
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

function mapRowToStoredFinding(row: any): LisaStoredFinding {
  return {
    id: String(row.finding_key),
    priority: row.priority,
    sourceKind: row.source_kind,
    headline: row.headline,
    narrative: row.narrative,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    freshnessMinutes:
      typeof row.freshness_minutes === "number"
        ? row.freshness_minutes
        : (row.freshness_minutes ?? null),
    truthStatus: coerceTruthStatus(row.truth_status),
    scopeType: row.scope_type || "global",
    scopeRef: row.scope_ref || null,
    engineVersion: row.engine_version || DEFAULT_ENGINE_VERSION,
    supersedesId: row.supersedes_id || null,
    generatedAt: toIsoString(row.generated_at),
  };
}

export async function ensureLisaFindingsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lisa_findings (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          finding_key varchar(255) NOT NULL,
          source_kind varchar(64) NOT NULL,
          priority varchar(16) NOT NULL,
          truth_status varchar(16) NOT NULL DEFAULT 'current',
          scope_type varchar(32) NOT NULL DEFAULT 'global',
          scope_ref varchar(255),
          headline text NOT NULL,
          narrative text NOT NULL,
          evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
          freshness_minutes integer,
          engine_version varchar(64),
          runtime_mode varchar(32) NOT NULL DEFAULT 'tradescout_local',
          runtime_source text,
          evidence_hash varchar(64),
          supersedes_id uuid,
          superseded_by_id uuid,
          generated_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        ALTER TABLE IF EXISTS lisa_findings
        ADD COLUMN IF NOT EXISTS payload_json jsonb NOT NULL DEFAULT '{}'::jsonb;
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS lisa_findings_key_idx ON lisa_findings (finding_key);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS lisa_findings_status_idx ON lisa_findings (truth_status);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS lisa_findings_scope_idx ON lisa_findings (scope_type, scope_ref);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS lisa_findings_generated_idx ON lisa_findings (generated_at DESC);`
      );
    })();
  }
  await ensurePromise;
}

export async function reconcileLisaFindings(
  feedResponse: LisaFeedResponse
): Promise<LisaStoredFinding[]> {
  await ensureLisaFindingsTable();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const activeKeys: string[] = [];
    for (const item of feedResponse.feed) {
      const findingKey = buildFindingKey(item);
      activeKeys.push(findingKey);
      const evidenceHash = computeEvidenceHash(item);
      const engineVersion = item.engineVersion || DEFAULT_ENGINE_VERSION;
      const truthStatus = item.truthStatus || "current";
      const scopeType = item.scopeType || "global";
      const scopeRef = item.scopeRef || null;

      const existing = await client.query(
        `
          SELECT *
          FROM lisa_findings
          WHERE finding_key = $1
            AND truth_status = 'current'
          ORDER BY generated_at DESC
          LIMIT 1
        `,
        [findingKey]
      );

      const currentRow = existing.rows[0];
      if (
        currentRow &&
        currentRow.evidence_hash === evidenceHash &&
        currentRow.headline === item.headline &&
        currentRow.narrative === item.narrative &&
        currentRow.priority === item.priority
      ) {
        await client.query(
          `
            UPDATE lisa_findings
            SET evidence = $2::jsonb,
                freshness_minutes = $3,
                generated_at = $4::timestamptz,
                updated_at = now(),
                engine_version = $5,
                runtime_mode = $6,
                runtime_source = $7,
                truth_status = $8
            WHERE id = $1::uuid
          `,
          [
            currentRow.id,
            JSON.stringify(item.evidence),
            item.freshnessMinutes,
            feedResponse.generatedAt,
            engineVersion,
            feedResponse.runtime.mode,
            feedResponse.runtime.source,
            truthStatus,
          ]
        );
        continue;
      }

      const newId = randomUUID();
      await client.query(
        `
          INSERT INTO lisa_findings (
            id,
            finding_key,
            source_kind,
            priority,
            truth_status,
            scope_type,
            scope_ref,
            headline,
            narrative,
            evidence,
            freshness_minutes,
            engine_version,
            runtime_mode,
            runtime_source,
            evidence_hash,
            supersedes_id,
            generated_at,
            updated_at
          )
          VALUES (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10::jsonb,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16::uuid,
            $17::timestamptz,
            now()
          )
        `,
        [
          newId,
          findingKey,
          item.sourceKind,
          item.priority,
          truthStatus,
          scopeType,
          scopeRef,
          item.headline,
          item.narrative,
          JSON.stringify(item.evidence),
          item.freshnessMinutes,
          engineVersion,
          feedResponse.runtime.mode,
          feedResponse.runtime.source,
          evidenceHash,
          currentRow?.id || null,
          feedResponse.generatedAt,
        ]
      );

      if (currentRow) {
        await client.query(
          `
            UPDATE lisa_findings
            SET truth_status = 'superseded',
                superseded_by_id = $2::uuid,
                updated_at = now()
            WHERE id = $1::uuid
          `,
          [currentRow.id, newId]
        );
      }
    }

    if (activeKeys.length > 0) {
      await client.query(
        `
          UPDATE lisa_findings
          SET truth_status = 'stale',
              updated_at = now()
          WHERE runtime_mode = $1
            AND truth_status = 'current'
            AND NOT (finding_key = ANY($2::varchar[]))
        `,
        [feedResponse.runtime.mode, activeKeys]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getCurrentLisaFindings();
}

export async function getCurrentLisaFindings(): Promise<LisaStoredFinding[]> {
  await ensureLisaFindingsTable();
  const result = await pool.query(`
    SELECT *
    FROM lisa_findings
    WHERE truth_status = 'current'
    ORDER BY
      CASE priority
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END ASC,
      generated_at DESC
  `);

  return result.rows
    .map(mapRowToStoredFinding)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}
