import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { workRequests } from "@shared/schema";
import { db } from "../db";

let readinessPromise: Promise<void> | null = null;

export function ensureDirectConnectSubmissionIdempotencyTable(): Promise<void> {
  if (readinessPromise) return readinessPromise;
  readinessPromise = db
    .execute(sql`
      CREATE TABLE IF NOT EXISTS direct_connect_submission_idempotency (
        owner_user_id text NOT NULL,
        submission_key text NOT NULL,
        request_id text NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
        payload_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_user_id, submission_key),
        UNIQUE (request_id)
      )
    `)
    .then(() => undefined)
    .catch((error) => {
      readinessPromise = null;
      throw error;
    });
  return readinessPromise;
}

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function hashDirectConnectSubmissionPayload(payload: unknown): string {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export async function createOrReuseDirectConnectSubmission(args: {
  ownerUserId: string;
  submissionKey: string;
  payloadHash: string;
  workRequestValues: typeof workRequests.$inferInsert;
}) {
  await ensureDirectConnectSubmissionIdempotencyTable();
  return db.transaction(async (tx: any) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`direct-connect-submit:${args.ownerUserId}:${args.submissionKey}`}))`
    );
    const existingResult = await tx.execute(sql`
      SELECT request_id, payload_hash
      FROM direct_connect_submission_idempotency
      WHERE owner_user_id = ${args.ownerUserId}
        AND submission_key = ${args.submissionKey}
      FOR UPDATE
    `);
    const existing = ((existingResult.rows || []) as any[])[0] || null;
    if (existing) {
      if (String(existing.payload_hash || "") !== args.payloadHash) {
        throw new Error("DIRECT_CONNECT_IDEMPOTENCY_CONFLICT");
      }
      const [request] = await tx
        .select()
        .from(workRequests)
        .where(eq(workRequests.id, String(existing.request_id)))
        .limit(1);
      if (!request || String(request.createdByUserId || "") !== args.ownerUserId) {
        throw new Error("DIRECT_CONNECT_IDEMPOTENCY_RECORD_INVALID");
      }
      return { request, replayed: true as const };
    }

    const requestId = randomUUID();
    const [request] = await tx
      .insert(workRequests)
      .values({ ...args.workRequestValues, id: requestId })
      .returning();
    if (!request) throw new Error("DIRECT_CONNECT_REQUEST_CREATE_FAILED");
    await tx.execute(sql`
      INSERT INTO direct_connect_submission_idempotency (
        owner_user_id, submission_key, request_id, payload_hash, created_at, updated_at
      )
      VALUES (
        ${args.ownerUserId},
        ${args.submissionKey},
        ${requestId},
        ${args.payloadHash},
        now(),
        now()
      )
    `);
    return { request, replayed: false as const };
  });
}
