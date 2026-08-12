import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import { pool } from "../db";
import { emailService } from "../services/emailService";
import {
  buildJwStoneEmailTemplate,
  type JwStoneEmailPurpose,
  type JwStoneEmailTemplateInput,
} from "../services/jwStoneEmailTemplates";
import { JW_STONE_OUTBOX_RETRY_DELAYS_MS } from "@shared/jwStoneExpress";
import type { JwStoneOutboxSecretEnvelope } from "@shared/schema/jwStoneExpress";
import { decryptOutboxSecret, encryptOutboxSecret, safeErrorSummary } from "./security";

type QueueInput = {
  accountId?: string | null;
  offerId?: string | null;
  retryOfId?: string | null;
  purpose: JwStoneEmailPurpose;
  recipient: string;
  template: Omit<JwStoneEmailTemplateInput, "purpose" | "actionUrl"> & {
    actionUrl?: string | null;
  };
  secretActionUrl?: string | null;
};

function boundedTemplatePayload(value: QueueInput["template"]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (value.recipientName) payload.recipientName = String(value.recipientName).slice(0, 160);
  if (value.targetLabel) payload.targetLabel = String(value.targetLabel).slice(0, 180);
  if (Number.isSafeInteger(value.amountCents) && Number(value.amountCents) > 0) {
    payload.amountCents = Number(value.amountCents);
  }
  if (value.offerStatus) payload.offerStatus = String(value.offerStatus).slice(0, 40);
  if (value.actionUrl) payload.actionUrl = String(value.actionUrl).slice(0, 2_048);
  if (JSON.stringify(payload).length > 8_000)
    throw new Error("JW Stone email payload is too large.");
  return payload;
}

export async function queueJwStoneEmail(client: PoolClient, input: QueueInput): Promise<string> {
  const payload = boundedTemplatePayload(input.template);
  const envelope = input.secretActionUrl ? encryptOutboxSecret(input.secretActionUrl) : null;
  const result = await client.query(
    `
      insert into jw_stone_email_outbox
        (account_id, offer_id, retry_of_id, purpose, recipient_normalized,
         template_payload, secret_envelope, status, available_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'pending', now())
      returning id
    `,
    [
      input.accountId ?? null,
      input.offerId ?? null,
      input.retryOfId ?? null,
      input.purpose,
      input.recipient.trim().toLowerCase(),
      JSON.stringify(payload),
      envelope ? JSON.stringify(envelope) : null,
    ]
  );
  return String(result.rows[0].id);
}

type ClaimedEmail = {
  id: string;
  claimId: string;
  attemptNumber: number;
  purpose: JwStoneEmailPurpose;
  recipient: string;
  templatePayload: Record<string, unknown>;
  secretEnvelope: JwStoneOutboxSecretEnvelope | null;
};

async function claimOne(): Promise<ClaimedEmail | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const stale = await client.query(
      `
        update jw_stone_email_outbox
        set status = case when attempt_count >= 6 then 'failed' else 'retry' end,
            available_at = case
              when attempt_count >= 6 then available_at
              when attempt_count = 1 then now() + ($1::int * interval '1 millisecond')
              when attempt_count = 2 then now() + ($2::int * interval '1 millisecond')
              when attempt_count = 3 then now() + ($3::int * interval '1 millisecond')
              when attempt_count = 4 then now() + ($4::int * interval '1 millisecond')
              else now() + ($5::int * interval '1 millisecond')
            end,
            failed_at = case when attempt_count >= 6 then now() else failed_at end,
            last_error_summary = 'Worker claim expired before provider confirmation.',
            claim_id = null, claimed_at = null, claim_expires_at = null, updated_at = now()
        where status = 'processing' and claim_expires_at <= now()
        returning id
      `,
      [...JW_STONE_OUTBOX_RETRY_DELAYS_MS]
    );
    if (stale.rowCount) {
      await client.query(
        `
          update jw_stone_email_outbox_attempts a
          set status = 'failed', error_summary = 'Worker claim expired.', completed_at = now()
          from jw_stone_email_outbox o
          where a.outbox_id = o.id and a.status = 'processing'
            and o.id = any($1::uuid[])
        `,
        [stale.rows.map((row) => row.id)]
      );
    }

    const due = await client.query(
      `
        select id
        from jw_stone_email_outbox
        where status in ('pending', 'retry') and available_at <= now()
        order by available_at asc, id asc
        for update skip locked
        limit 1
      `
    );
    if (!due.rows[0]) {
      await client.query("commit");
      return null;
    }

    const claimId = randomUUID();
    const claimed = await client.query(
      `
        update jw_stone_email_outbox
        set status = 'processing', attempt_count = attempt_count + 1,
            claim_id = $2, claimed_at = now(), claim_expires_at = now() + interval '2 minutes',
            updated_at = now()
        where id = $1
        returning id, purpose, recipient_normalized, template_payload, secret_envelope, attempt_count
      `,
      [due.rows[0].id, claimId]
    );
    const row = claimed.rows[0];
    await client.query(
      `
        insert into jw_stone_email_outbox_attempts
          (outbox_id, attempt_number, claim_id, status)
        values ($1, $2, $3, 'processing')
      `,
      [row.id, row.attempt_count, claimId]
    );
    await client.query("commit");
    return {
      id: String(row.id),
      claimId,
      attemptNumber: Number(row.attempt_count),
      purpose: row.purpose as JwStoneEmailPurpose,
      recipient: String(row.recipient_normalized),
      templatePayload: (row.template_payload || {}) as Record<string, unknown>,
      secretEnvelope: (row.secret_envelope || null) as JwStoneOutboxSecretEnvelope | null,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function templateInput(claimed: ClaimedEmail): JwStoneEmailTemplateInput {
  const payload = claimed.templatePayload;
  const secretActionUrl = claimed.secretEnvelope
    ? decryptOutboxSecret(claimed.secretEnvelope)
    : null;
  return {
    purpose: claimed.purpose,
    recipientName: typeof payload.recipientName === "string" ? payload.recipientName : null,
    targetLabel: typeof payload.targetLabel === "string" ? payload.targetLabel : null,
    amountCents: Number.isSafeInteger(payload.amountCents) ? Number(payload.amountCents) : null,
    offerStatus: typeof payload.offerStatus === "string" ? payload.offerStatus : null,
    actionUrl:
      secretActionUrl || (typeof payload.actionUrl === "string" ? payload.actionUrl : null),
  };
}

async function markSent(
  client: PoolClient,
  claimed: ClaimedEmail,
  providerMessageId?: string
): Promise<void> {
  await client.query(
    `
      with updated as (
        update jw_stone_email_outbox
        set status = 'sent', sent_at = now(), provider_message_id = $3,
            secret_envelope = null, claim_id = null, claimed_at = null,
            claim_expires_at = null, last_error_summary = null, updated_at = now()
        where id = $1 and status = 'processing' and claim_id = $2
        returning id
      )
      update jw_stone_email_outbox_attempts a
      set status = 'sent', provider_message_id = $3, completed_at = now()
      from updated
      where a.outbox_id = updated.id and a.claim_id = $2 and a.status = 'processing'
    `,
    [claimed.id, claimed.claimId, providerMessageId || null]
  );
}

async function markFailed(
  client: PoolClient,
  claimed: ClaimedEmail,
  error: unknown
): Promise<void> {
  const summary = safeErrorSummary(error);
  const terminal = claimed.attemptNumber >= 6;
  const delay = terminal
    ? 0
    : JW_STONE_OUTBOX_RETRY_DELAYS_MS[Math.min(claimed.attemptNumber - 1, 4)];
  await client.query(
    `
      with updated as (
        update jw_stone_email_outbox
        set status = $3::varchar,
            available_at = case when $3::varchar = 'retry'
              then now() + ($4::int * interval '1 millisecond') else available_at end,
            failed_at = case when $3::varchar = 'failed' then now() else null end,
            last_error_summary = $5,
            claim_id = null, claimed_at = null, claim_expires_at = null, updated_at = now()
        where id = $1 and status = 'processing' and claim_id = $2
        returning id
      )
      update jw_stone_email_outbox_attempts a
      set status = 'failed', error_summary = $5, completed_at = now()
      from updated
      where a.outbox_id = updated.id and a.claim_id = $2 and a.status = 'processing'
    `,
    [claimed.id, claimed.claimId, terminal ? "failed" : "retry", delay, summary]
  );
}

async function deliverClaimed(claimed: ClaimedEmail): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const active = await client.query(
      `select id
       from jw_stone_email_outbox
       where id = $1 and status = 'processing' and claim_id = $2
       for update`,
      [claimed.id, claimed.claimId]
    );
    if (!active.rows[0]) {
      await client.query("commit");
      return;
    }

    try {
      const template = buildJwStoneEmailTemplate(templateInput(claimed));
      const fromEmail =
        process.env.JW_STONE_FROM_EMAIL ||
        process.env.SENDGRID_FROM_EMAIL ||
        process.env.BREVO_FROM_EMAIL ||
        process.env.DEFAULT_FROM_EMAIL ||
        "noreply@tradescout.app";
      const result = await emailService.sendEmail({
        to: claimed.recipient,
        from: { name: "JW Stone", email: fromEmail },
        subject: template.subject,
        text: template.text,
        html: template.html,
        purpose: claimed.purpose,
        correlationId: claimed.id,
      });
      if (result.skipped) {
        throw new Error(`Provider did not accept email (${result.skippedReason || "skipped"}).`);
      }
      await markSent(client, claimed, result.messageId);
    } catch (error) {
      await markFailed(client, claimed, error);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function drainJwStoneOutbox(limit = 10): Promise<number> {
  let processed = 0;
  while (processed < Math.max(1, Math.min(limit, 50))) {
    const claimed = await claimOne();
    if (!claimed) break;
    processed += 1;
    await deliverClaimed(claimed);
  }
  return processed;
}

let draining = false;
export function kickJwStoneOutbox(): void {
  if (process.env.JW_STONE_OUTBOX_WORKER_DISABLED === "1") return;
  if (draining) return;
  draining = true;
  setImmediate(() => {
    void drainJwStoneOutbox()
      .catch((error) => {
        console.error("[jw-stone-outbox] drain failed", { error: safeErrorSummary(error) });
      })
      .finally(() => {
        draining = false;
      });
  });
}

let workerTimer: NodeJS.Timeout | null = null;
export function startJwStoneOutboxWorker(): void {
  if (process.env.JW_STONE_OUTBOX_WORKER_DISABLED === "1") return;
  if (workerTimer) return;
  workerTimer = setInterval(kickJwStoneOutbox, 30_000);
  workerTimer.unref?.();
  kickJwStoneOutbox();
}

export async function retryFailedJwStoneEmail(
  client: PoolClient,
  args: { outboxId: string; offerId: string }
): Promise<string> {
  const source = await client.query(
    `
      select * from jw_stone_email_outbox
      where id = $1 and offer_id = $2 and status = 'failed'
      for update
    `,
    [args.outboxId, args.offerId]
  );
  const row = source.rows[0];
  if (!row) {
    throw Object.assign(new Error("Only a failed notification can be retried."), { status: 409 });
  }
  const result = await client.query(
    `
      insert into jw_stone_email_outbox
        (account_id, offer_id, retry_of_id, purpose, recipient_normalized,
         template_payload, secret_envelope, status, available_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'pending', now())
      returning id
    `,
    [
      row.account_id,
      row.offer_id,
      row.id,
      row.purpose,
      row.recipient_normalized,
      JSON.stringify(row.template_payload || {}),
      row.secret_envelope ? JSON.stringify(row.secret_envelope) : null,
    ]
  );
  return String(result.rows[0].id);
}
