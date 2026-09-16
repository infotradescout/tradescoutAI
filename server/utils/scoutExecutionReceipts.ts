import { createHash } from "node:crypto";
import type { ScoutAction, ScoutActionContext } from "./scoutActionGuard";

export interface ScoutReceiptDatabase {
  query(text: string, values?: unknown[]): Promise<{
    rows: Record<string, unknown>[];
    rowCount: number | null;
  }>;
}

export type ScoutProfileExecutionReceipt = {
  executed: true;
  action: "SAVE_PROFILE";
  userId: string;
  executionId: string;
  updatedFields: string[];
  replayed: boolean;
};

export const SCOUT_EXECUTION_ID_PATTERN = /^[a-zA-Z0-9:_-]{16,128}$/;

function canonicalJson(value: unknown, depth = 0): string {
  if (depth > 20) throw new Error("Invalid Scout execution payload");
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item, depth + 1)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key], depth + 1)}`
    ).join(",")}}`;
  }
  throw new Error("Invalid Scout execution payload");
}

/** Exclude transport/approval metadata; never persist submitted field values. */
export function fingerprintScoutProfileAction(action: ScoutAction): string {
  const { executionId: _id, requiresApproval: _approval, ...payload } = action.payload || {};
  const serialized = canonicalJson({ type: action.type, payload });
  if (serialized.length > 131072) throw new Error("Invalid Scout execution payload");
  return createHash("sha256").update(serialized).digest("hex");
}

function completedReceipt(
  value: unknown,
  userId: string,
  executionId: string,
  replayed: boolean
): ScoutProfileExecutionReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Scout execution was not confirmed");
  }
  const result = value as Record<string, unknown>;
  if (result.executed !== true || result.action !== "SAVE_PROFILE" || result.userId !== userId) {
    throw new Error("Scout execution was not confirmed");
  }
  if (!Array.isArray(result.updatedFields) || result.updatedFields.length > 100 ||
    !result.updatedFields.every((field) => typeof field === "string" && /^[a-zA-Z][a-zA-Z0-9_.]{0,100}$/.test(field))) {
    throw new Error("Scout execution was not confirmed");
  }
  return {
    executed: true,
    action: "SAVE_PROFILE",
    userId,
    executionId,
    updatedFields: [...result.updatedFields] as string[],
    replayed,
  };
}

/**
 * At-most-once dispatch, not an exactly-once promise about an arbitrary executor.
 * The claim commits before the separate profile write. A crash anywhere after
 * that claim leaves a durable pending/unconfirmed receipt; it is NEVER reclaimed
 * or rerun automatically. Only a positively acknowledged result is replayable.
 *
 * The owner comes exclusively from the authenticated request context. A key is
 * not authorization. The existing route validates authentication/permissions
 * before calling the guard. No profile values or raw errors enter the receipt.
 */
export async function executeScoutProfileOnce(
  action: ScoutAction,
  context: ScoutActionContext,
  executor: (action: ScoutAction) => Promise<unknown>,
  database?: ScoutReceiptDatabase
): Promise<ScoutProfileExecutionReceipt> {
  const userId = context.userId;
  const executionId = action.payload?.executionId;
  if (action.type !== "SAVE_PROFILE" || typeof userId !== "string" || !userId.trim() ||
    typeof executionId !== "string" || !SCOUT_EXECUTION_ID_PATTERN.test(executionId)) {
    throw new Error("Invalid Scout execution identity");
  }
  const fingerprint = fingerprintScoutProfileAction(action);
  const connection = database || (await import("../db")).pool;
  const claim = await connection.query(
    `INSERT INTO scout_execution_receipts
      (owner_user_id, execution_id, action_type, request_fingerprint)
     VALUES ($1, $2, 'SAVE_PROFILE', $3)
     ON CONFLICT (owner_user_id, execution_id) DO NOTHING
     RETURNING execution_id`,
    [userId, executionId, fingerprint]
  );

  if (claim.rowCount !== 1) {
    const existing = await connection.query(
      `SELECT action_type, request_fingerprint, status, result
       FROM scout_execution_receipts WHERE owner_user_id = $1 AND execution_id = $2`,
      [userId, executionId]
    );
    const receipt = existing.rows[0];
    if (!receipt || receipt.action_type !== "SAVE_PROFILE" || receipt.request_fingerprint !== fingerprint) {
      throw new Error("Scout execution identity does not match this action");
    }
    if (receipt.status !== "completed") {
      throw new Error("Scout execution is already pending or unconfirmed");
    }
    const result = completedReceipt(receipt.result, userId, executionId, true);
    // A failed replay counter must not authorize another execution or obscure a
    // previously committed receipt. It is diagnostic, not the completion count.
    await connection.query(
      `UPDATE scout_execution_receipts SET replay_count = replay_count + 1, last_replayed_at = now()
       WHERE owner_user_id = $1 AND execution_id = $2 AND status = 'completed'`,
      [userId, executionId]
    ).catch(() => undefined);
    return result;
  }

  try {
    const result = completedReceipt(await executor(action), userId, executionId, false);
    const saved = await connection.query(
      `UPDATE scout_execution_receipts SET status = 'completed', result = $3::jsonb, completed_at = now()
       WHERE owner_user_id = $1 AND execution_id = $2 AND status = 'pending'
       RETURNING execution_id`,
      [userId, executionId, JSON.stringify(result)]
    );
    if (saved.rowCount !== 1) throw new Error("Scout completion receipt was not confirmed");
    return result;
  } catch (error) {
    // Do not overwrite a completed receipt when its UPDATE committed but the
    // acknowledgement was lost. Never log or persist the exception or payload.
    await connection.query(
      `UPDATE scout_execution_receipts SET status = 'unconfirmed'
       WHERE owner_user_id = $1 AND execution_id = $2 AND status = 'pending'`,
      [userId, executionId]
    ).catch(() => undefined);
    throw error;
  }
}
