import type { PoolClient } from "pg";

import { pool } from "../db";
import { formatJwStoneUsdFromCents, type JwStoneOfferState } from "@shared/jwStoneExpress";
import { resolveOfferTarget } from "./catalog";
import { queueJwStoneEmail } from "./outbox";
import { hmacScope, requestPublicBaseUrl } from "./security";
import type { Request } from "express";

export async function withJwStoneTransaction<T>(
  action: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const value = await action(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function appendOfferVersion(
  client: PoolClient,
  args: {
    offerId: string;
    state: JwStoneOfferState;
    amountCents: number;
    submittedAt: Date | null;
  }
): Promise<{ id: string; versionNumber: number }> {
  const current = await client.query(
    `
      select v.id, v.version_number
      from jw_stone_private_offers o
      left join jw_stone_private_offer_versions v on v.id = o.current_version_id
      where o.id = $1
      for update of o
    `,
    [args.offerId]
  );
  if (!current.rows[0]) throw Object.assign(new Error("Private offer not found."), { status: 404 });
  const priorId = current.rows[0].id ? String(current.rows[0].id) : null;
  const versionNumber = Number(current.rows[0].version_number || 0) + 1;
  const inserted = await client.query(
    `
      insert into jw_stone_private_offer_versions
        (offer_id, version_number, state, amount_cents, submitted_at, supersedes_version_id)
      values ($1, $2, $3, $4, $5, $6)
      returning id
    `,
    [args.offerId, versionNumber, args.state, args.amountCents, args.submittedAt, priorId]
  );
  const id = String(inserted.rows[0].id);
  await client.query(
    `update jw_stone_private_offers set current_version_id = $2, updated_at = now() where id = $1`,
    [args.offerId, id]
  );
  return { id, versionNumber };
}

export async function insertOfferEvent(
  client: PoolClient,
  args: {
    offerId: string;
    versionId?: string | null;
    eventType: string;
    actorKind: "requester" | "operator" | "system";
    actorRef?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const safeMetadata = args.metadata || {};
  if (JSON.stringify(safeMetadata).length > 2_000)
    throw new Error("Offer event metadata is too large.");
  const note = args.note
    ? String(args.note)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
        .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted]")
        .slice(0, 500)
    : null;
  await client.query(
    `
      insert into jw_stone_offer_events
        (offer_id, version_id, event_type, actor_kind, actor_ref, note, metadata)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      args.offerId,
      args.versionId ?? null,
      String(args.eventType).slice(0, 64),
      args.actorKind,
      args.actorKind === "operator" ? String(args.actorRef || "unknown").slice(0, 200) : null,
      note,
      JSON.stringify(safeMetadata),
    ]
  );
}

async function jwStoneOperatorEmail(client: PoolClient): Promise<string | null> {
  const result = await client.query(
    `
      select lower(u.email) as email
      from profiles p
      join users u on u.id = p.owner_user_id
      where lower(p.slug) = 'jw-stone' and u.email is not null
      order by p.updated_at desc nulls last, p.id asc
      limit 1
    `
  );
  const email = String(result.rows[0]?.email || "").trim();
  return email || null;
}

export async function queueSubmittedOfferEmails(
  client: PoolClient,
  args: {
    req: Request;
    accountId: string;
    offerId: string;
    customerEmail: string;
    customerName: string;
    targetLabel: string;
    amountCents: number;
  }
): Promise<void> {
  await queueJwStoneEmail(client, {
    accountId: args.accountId,
    offerId: args.offerId,
    purpose: "jw_stone_offer_confirmation",
    recipient: args.customerEmail,
    template: {
      recipientName: args.customerName,
      targetLabel: args.targetLabel,
      amountCents: args.amountCents,
    },
  });

  const staffEmail = await jwStoneOperatorEmail(client);
  if (staffEmail) {
    await queueJwStoneEmail(client, {
      accountId: args.accountId,
      offerId: args.offerId,
      purpose: "jw_stone_offer_staff_alert",
      recipient: staffEmail,
      template: {
        targetLabel: args.targetLabel,
        actionUrl: `${requestPublicBaseUrl(args.req)}/admin/jw-stone-offers`,
      },
    });
  }
}

export async function queueOfferStatusEmail(
  client: PoolClient,
  args: {
    accountId: string;
    offerId: string;
    customerEmail: string;
    customerName: string;
    targetLabel: string;
    status: string;
  }
): Promise<void> {
  await queueJwStoneEmail(client, {
    accountId: args.accountId,
    offerId: args.offerId,
    purpose: "jw_stone_offer_status",
    recipient: args.customerEmail,
    template: {
      recipientName: args.customerName,
      targetLabel: args.targetLabel,
      offerStatus: args.status,
    },
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export type IdempotencyScope = {
  accountId?: string | null;
  scopeValue: string;
  operation: string;
  targetKind: string;
  targetRef: string;
  key: string;
  requestBody: unknown;
};

export async function lockJwStoneOfferTarget(
  client: PoolClient,
  targetKind: "stone" | "container",
  targetRef: string
): Promise<void> {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `jw-stone-offer-target:${targetKind}:${targetRef}`,
  ]);
}

export async function lockJwStoneOfferTargets(
  client: PoolClient,
  targets: ReadonlyArray<{ targetKind: "stone" | "container"; targetRef: string }>
): Promise<void> {
  const ordered = Array.from(
    new Map(
      targets.map((target) => [
        `${target.targetKind}:${target.targetRef}`,
        { targetKind: target.targetKind, targetRef: target.targetRef },
      ])
    ).values()
  ).sort((left, right) =>
    `${left.targetKind}:${left.targetRef}`.localeCompare(`${right.targetKind}:${right.targetRef}`)
  );
  for (const target of ordered) {
    await lockJwStoneOfferTarget(client, target.targetKind, target.targetRef);
  }
}

export async function lockJwStoneExpressIdentity(
  client: PoolClient,
  normalizedEmail: string
): Promise<void> {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `jw-stone-express-identity:${normalizedEmail}`,
  ]);
}

export async function readIdempotencyReceipt(
  client: PoolClient,
  scope: IdempotencyScope
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  const accountScopeHash = hmacScope(scope.scopeValue, "idempotency-scope");
  const lockKey = `${accountScopeHash}:${scope.operation}:${scope.targetKind}:${scope.targetRef}:${scope.key}`;
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);
  const result = await client.query(
    `
      select request_hash, response_status, response_body
      from jw_stone_idempotency_receipts
      where account_scope_hash = $1 and operation = $2 and target_kind = $3
        and target_ref = $4 and idempotency_key = $5 and expires_at > now()
      limit 1
    `,
    [accountScopeHash, scope.operation, scope.targetKind, scope.targetRef, scope.key]
  );
  const row = result.rows[0];
  if (!row) return null;
  const requestHash = hmacScope(stableJson(scope.requestBody), "idempotency-request");
  if (String(row.request_hash) !== requestHash) {
    throw Object.assign(new Error("That Idempotency-Key was already used for different input."), {
      status: 409,
    });
  }
  return { status: Number(row.response_status), body: row.response_body || {} };
}

export async function storeIdempotencyReceipt(
  client: PoolClient,
  scope: IdempotencyScope,
  response: { status: number; body: Record<string, unknown> }
): Promise<void> {
  await client.query(
    `
      insert into jw_stone_idempotency_receipts
        (account_id, account_scope_hash, operation, target_kind, target_ref,
         idempotency_key, request_hash, response_status, response_body, expires_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now() + interval '24 hours')
    `,
    [
      scope.accountId ?? null,
      hmacScope(scope.scopeValue, "idempotency-scope"),
      scope.operation,
      scope.targetKind,
      scope.targetRef,
      scope.key,
      hmacScope(stableJson(scope.requestBody), "idempotency-request"),
      response.status,
      JSON.stringify(response.body),
    ]
  );
}

export function amountDisplay(cents: number, includeSymbol = false): string {
  const exact = formatJwStoneUsdFromCents(Number(cents));
  if (!includeSymbol) return exact;
  const [whole, fraction] = exact.split(".");
  return `$${Number(whole).toLocaleString("en-US")}.${fraction}`;
}

export async function serializeRequesterOffer(client: PoolClient, row: any) {
  const target = await resolveOfferTarget(
    client,
    { kind: row.target_kind, ref: row.target_ref },
    { includeNonPublicContainer: true }
  );
  const versions = await client.query(
    `
      select version_number, state, amount_cents, submitted_at, created_at
      from jw_stone_private_offer_versions
      where offer_id = $1
      order by version_number desc
    `,
    [row.id]
  );
  return {
    offerRef: String(row.id),
    target: target.publicTarget,
    status: String(row.state),
    amount: amountDisplay(Number(row.amount_cents)),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    history: versions.rows.map((version) => ({
      version: Number(version.version_number),
      status: String(version.state),
      amount: amountDisplay(Number(version.amount_cents)),
      submittedAt: version.submitted_at ? new Date(version.submitted_at).toISOString() : null,
      createdAt: new Date(version.created_at).toISOString(),
    })),
  };
}
