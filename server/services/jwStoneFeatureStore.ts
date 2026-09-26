import {
  JW_STONE_FEATURE_KEY, JwStoneFeatureError, parseJwStoneFeatureCommand,
  type JwStoneFeatureCommand, type JwStoneFeatureState,
} from "../../shared/jwStoneFeaturePolicy";
export interface FeatureConnection {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}
export interface FeaturePool {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  connect(): Promise<FeatureConnection>;
}
export type FeatureReceipt = {
  operationId: string; actorUserId: string; expectedRevision: number; revision: number;
  previousEnabled: boolean; enabled: boolean; note: string; changedAt: string;
};
export type StoredFeatures = JwStoneFeatureState & { audit: FeatureReceipt[] };
export function readStoredJwStoneFeatures(row?: Record<string, unknown>): StoredFeatures {
  // No database write or automatic suspension on first deployment.
  if (!row) return { profileSlug: "jw-stone", enabled: true, configured: false, revision: 0, audit: [] };
  const config = row.config as Record<string, unknown> | null;
  if (typeof row.enabled !== "boolean" || !config || config.version !== 1 ||
      !Number.isSafeInteger(config.revision) || Number(config.revision) < 1 || !Array.isArray(config.audit) ||
      config.audit.length !== config.revision) throw new Error("Invalid persisted JW Stone feature configuration");
  const audit = config.audit as FeatureReceipt[];
  const seen = new Set<string>();
  for (const [index, receipt] of audit.entries()) {
    if (!receipt || receipt.revision !== index + 1 || receipt.expectedRevision !== index ||
        typeof receipt.operationId !== "string" || seen.has(receipt.operationId) ||
        typeof receipt.actorUserId !== "string" || !receipt.actorUserId ||
        typeof receipt.enabled !== "boolean" || typeof receipt.previousEnabled !== "boolean" ||
        typeof receipt.note !== "string" || typeof receipt.changedAt !== "string" ||
        !Number.isFinite(Date.parse(receipt.changedAt)) ||
        receipt.previousEnabled !== (index ? audit[index - 1].enabled : true)) {
      throw new Error("Invalid JW Stone feature audit history");
    }
    seen.add(receipt.operationId);
  }
  if (audit.at(-1)?.enabled !== row.enabled) throw new Error("JW Stone feature state disagrees with its receipt");
  return { profileSlug: "jw-stone", configured: true, enabled: row.enabled, revision: Number(config.revision), audit };
}
export function nextJwStoneFeatureState(current: StoredFeatures, command: JwStoneFeatureCommand, actorUserId: string, now: string) {
  if (!actorUserId.trim()) throw new JwStoneFeatureError(401, "AUTHENTICATION_REQUIRED", "Sign in to manage feature access.");
  const prior = current.audit.find(item => item.operationId === command.operationId);
  if (prior) {
    if (prior.actorUserId !== actorUserId || prior.enabled !== command.enabled ||
        prior.note !== command.note || prior.expectedRevision !== command.expectedRevision) {
      throw new JwStoneFeatureError(409, "FEATURE_OPERATION_CONFLICT", "This operation identity belongs to a different change.");
    }
    return { state: current, receipt: prior, replayed: true };
  }
  if (command.expectedRevision !== current.revision) throw new JwStoneFeatureError(409, "FEATURE_REVISION_CHANGED", "The setting changed. Reload it before saving.");
  const revision = current.revision + 1;
  if (!Number.isSafeInteger(revision)) throw new Error("Feature revision limit reached");
  const receipt: FeatureReceipt = { ...command, actorUserId, revision,
    previousEnabled: current.enabled, changedAt: now };
  return { state: { profileSlug: "jw-stone" as const, enabled: command.enabled, configured: true,
    revision, audit: [...current.audit, receipt] }, receipt, replayed: false };
}
export function createJwStoneFeatureStore(database: FeaturePool) {
  const select = "SELECT enabled, config FROM feature_flags WHERE key = $1";
  return {
    async read(): Promise<StoredFeatures> {
      return readStoredJwStoneFeatures((await database.query(select, [JW_STONE_FEATURE_KEY])).rows[0]);
    },
    async change(actorUserId: string, input: unknown) {
      const command = parseJwStoneFeatureCommand(input);
      const connection = await database.connect();
      try {
        await connection.query("BEGIN");
        // Serializes both the absent-row bootstrap and subsequent revisions across processes.
        await connection.query("SELECT pg_advisory_xact_lock(hashtext($1))", [JW_STONE_FEATURE_KEY]);
        const current = readStoredJwStoneFeatures((await connection.query(select + " FOR UPDATE", [JW_STONE_FEATURE_KEY])).rows[0]);
        const result = nextJwStoneFeatureState(current, command, actorUserId, new Date().toISOString());
        if (!result.replayed) {
          await connection.query(`INSERT INTO feature_flags (key, name, description, enabled, category, config, updated_at)
            VALUES ($1, $2, $3, $4, 'jw_stone', $5::jsonb, NOW())
            ON CONFLICT (key) DO UPDATE SET enabled=EXCLUDED.enabled, config=EXCLUDED.config, updated_at=EXCLUDED.updated_at`,
          [JW_STONE_FEATURE_KEY, "JW Stone sales enhancements",
            "TradeScout-controlled add-ons only. Paid website, catalog, contact and Direct Connect stay available.",
            result.state.enabled, JSON.stringify({ version: 1, revision: result.state.revision, audit: result.state.audit })]);
        }
        await connection.query("COMMIT");
        return result;
      } catch (error) {
        await connection.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally { connection.release(); }
    },
  };
}
