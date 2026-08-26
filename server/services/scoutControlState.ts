import { pool } from "../db";

export type ScoutAuthorityMode = "normal" | "conservative" | "advisory";

export interface ScoutControlState {
  authorityMode: ScoutAuthorityMode;
  confidenceDampener: number;
  outcomeLearningEnabled: boolean;
  version: number;
  lastChangedAt: string | null;
  source: "database" | "default" | "fail_safe";
}

export const DEFAULT_SCOUT_CONTROL_STATE: ScoutControlState = {
  authorityMode: "normal",
  confidenceDampener: 1,
  outcomeLearningEnabled: true,
  version: 0,
  lastChangedAt: null,
  source: "default",
};

export const FAIL_SAFE_SCOUT_CONTROL_STATE: ScoutControlState = {
  authorityMode: "advisory",
  confidenceDampener: 0,
  outcomeLearningEnabled: false,
  version: 0,
  lastChangedAt: null,
  source: "fail_safe",
};

type Client = {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
  release?: () => void;
};
type ControlPool = Client & { connect(): Promise<Client> };
const database = pool as unknown as ControlPool;
const CATEGORY = "scout_governor";
const KEY = "global_controls";
const LOCK_KEY = "scout-global-control-state";

function normalizeState(value: unknown, metadata?: { version?: unknown; updatedAt?: unknown }): ScoutControlState {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const authorityMode = ["normal", "conservative", "advisory"].includes(
    String(raw.authorityMode)
  )
    ? (String(raw.authorityMode) as ScoutAuthorityMode)
    : DEFAULT_SCOUT_CONTROL_STATE.authorityMode;
  const multiplier = Number(raw.confidenceDampener);
  return {
    authorityMode,
    confidenceDampener:
      Number.isFinite(multiplier) && multiplier >= 0 && multiplier <= 2
        ? multiplier
        : DEFAULT_SCOUT_CONTROL_STATE.confidenceDampener,
    outcomeLearningEnabled:
      typeof raw.outcomeLearningEnabled === "boolean"
        ? raw.outcomeLearningEnabled
        : DEFAULT_SCOUT_CONTROL_STATE.outcomeLearningEnabled,
    version: Math.max(0, Number(metadata?.version ?? raw.version ?? 0) || 0),
    lastChangedAt: metadata?.updatedAt
      ? new Date(metadata.updatedAt as any).toISOString()
      : typeof raw.lastChangedAt === "string"
        ? raw.lastChangedAt
        : null,
    source: "database",
  };
}

export async function getScoutControlState(): Promise<ScoutControlState> {
  try {
    const result = await database.query(
      `SELECT value, updated_at
         FROM site_settings
        WHERE category = $1 AND key = $2 AND is_active = true
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [CATEGORY, KEY]
    );
    const row = result.rows[0];
    if (!row) return { ...DEFAULT_SCOUT_CONTROL_STATE };
    return normalizeState(row.value, {
      version: row.value?.version,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error("[Scout Controls] Durable state read failed; applying fail-safe controls.", error);
    return { ...FAIL_SAFE_SCOUT_CONTROL_STATE };
  }
}

export async function updateScoutControlState(
  patch: Partial<Pick<ScoutControlState, "authorityMode" | "confidenceDampener" | "outcomeLearningEnabled">>,
  actorId: string
): Promise<ScoutControlState> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
      [LOCK_KEY]
    );
    const existingResult = await client.query(
      `SELECT id, value, updated_at
         FROM site_settings
        WHERE category = $1 AND key = $2 AND is_active = true
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
        FOR UPDATE`,
      [CATEGORY, KEY]
    );
    const existing = existingResult.rows[0];
    const current = existing
      ? normalizeState(existing.value, {
          version: existing.value?.version,
          updatedAt: existing.updated_at,
        })
      : { ...DEFAULT_SCOUT_CONTROL_STATE };
    const next: ScoutControlState = {
      ...current,
      ...patch,
      version: current.version + 1,
      lastChangedAt: new Date().toISOString(),
      source: "database",
    };
    if (!["normal", "conservative", "advisory"].includes(next.authorityMode)) {
      throw new Error("Invalid Scout authority mode");
    }
    if (
      !Number.isFinite(next.confidenceDampener) ||
      next.confidenceDampener < 0 ||
      next.confidenceDampener > 2
    ) {
      throw new Error("Confidence dampener must be between 0 and 2");
    }

    if (existing) {
      await client.query(
        `UPDATE site_settings
            SET value = $1::jsonb, updated_at = now(), is_active = true
          WHERE id = $2`,
        [JSON.stringify(next), existing.id]
      );
      await client.query(
        `UPDATE site_settings
            SET is_active = false, updated_at = now()
          WHERE category = $1 AND key = $2 AND id <> $3 AND is_active = true`,
        [CATEGORY, KEY, existing.id]
      );
    } else {
      await client.query(
        `INSERT INTO site_settings
           (category, key, value, description, is_active)
         VALUES ($1, $2, $3::jsonb, $4, true)`,
        [CATEGORY, KEY, JSON.stringify(next), "Durable global Scout governor controls"]
      );
    }

    await client.query(
      `INSERT INTO admin_audit_log (type, admin_id, metadata)
       VALUES ('scout_control_state_changed', $1, $2::jsonb)`,
      [actorId, JSON.stringify({ before: current, after: next })]
    );
    await client.query("COMMIT");
    return next;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release?.();
  }
}
