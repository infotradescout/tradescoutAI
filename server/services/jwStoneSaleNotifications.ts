import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { JwStoneSaleState } from "@shared/jwStoneCheckout";

export type JwStoneSaleNoticeContext = {
  requestId: string;
  buyerId: string;
  sellerUserId: string;
};
export type JwStoneSaleNotice = {
  id: string;
  userId: string;
  title: string;
  message: string;
  actionUrl: string;
  metadata: Record<string, string | number>;
};
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** Build counterpart notices only for a newly persisted commercial transition. */
export function buildJwStoneSaleNotices(
  context: JwStoneSaleNoticeContext,
  previous: JwStoneSaleState,
  next: JwStoneSaleState
): JwStoneSaleNotice[] {
  if (!context.requestId || !context.buyerId || !context.sellerUserId ||
      !Number.isSafeInteger(next.revision) || next.revision !== previous.revision + 1) {
    throw new Error("JW Stone notification requires the exact persisted order transition");
  }
  let kind: string, userId: string, title: string, message: string;
  const quote = next.quote;
  if (next.status === "quoted" && quote && quote.id !== previous.quote?.id) {
    kind = "quote_issued";
    userId = context.buyerId;
    title = quote.decision === "counter_offer" ? "JW Stone sent a counteroffer" : "Your final JW Stone quote is ready";
    message = [
      quote.decision === "accept_offer" ? "JW Stone accepted your offered material amount. Review the complete final quote before confirming." : "Review the current quote and confirm the exact final total in your private workspace.",
      `Materials: ${money(quote.materialCents)}`,
      `Tax: ${money(quote.taxCents)}`,
      `Delivery: ${money(quote.deliveryCents)}`,
      `Final total: ${money(quote.totalCents)}`,
      `Expires: ${new Date(quote.expiresAt).toLocaleString("en-US", { timeZone: "America/Chicago", timeZoneName: "short" })}`,
      "Issuing this quote does not charge payment or reserve stock. A revised quote replaces any earlier confirmation.",
    ].join("\n");
  } else if (next.status === "declined" &&
             (previous.status !== "declined" || previous.note !== next.note)) {
    kind = "request_declined";
    userId = context.buyerId;
    title = "JW Stone declined your request";
    message = ["JW Stone declined this offer or purchase request.", next.note || "Open your private workspace for the current status.", "This decision does not charge a payment."].join("\n");
  } else if (next.quoteAcceptance && quote &&
             next.quoteAcceptance.quoteId === quote.id &&
             next.quoteAcceptance.quoteRevision === quote.revision &&
             next.quoteAcceptance.totalCents === quote.totalCents &&
             next.quoteAcceptance.acceptedBy === context.buyerId &&
             previous.quoteAcceptance?.quoteId !== quote.id) {
    kind = "quote_confirmed";
    userId = context.sellerUserId;
    title = "Customer confirmed the JW Stone quote";
    message = [
      `The buyer confirmed quote revision ${quote.revision} for ${money(quote.totalCents)}.`,
      "This confirmation is not a paid receipt or permission to fulfill the order. Check the current payment and stock status in the private workspace.",
    ].join("\n");
  } else {
    return [];
  }
  const digest = createHash("sha256")
    .update(JSON.stringify([context.requestId, next.revision, kind, userId])).digest("hex");
  return [{
    id: "jw-order-update:" + digest, userId, title, message,
    actionUrl: "/jw-stone/orders?request=" + encodeURIComponent(context.requestId),
    metadata: {
      source: "jw_stone_sale", kind, workRequestId: context.requestId,
      revision: next.revision,
      ...(quote ? { quoteId: quote.id, quoteRevision: quote.revision } : {}),
    },
  }];
}

export const JW_STONE_SALE_NOTICE_SQL = `
WITH added AS (
  INSERT INTO notifications (
    id,user_id,type,priority,title,message,action_url,action_text,
    icon_name,delivery_methods,metadata,sent_at
  ) VALUES ($1,$2,'project_update','high',$3,$4,$5,'Review offer or quote',
            'file-check','["in_app","email"]'::jsonb,$6::jsonb,NOW())
  ON CONFLICT (id) DO NOTHING
  RETURNING id,user_id
), jobs AS (
  INSERT INTO notification_jobs (
    id,job_type,scheduled_for,target_user_ids,notification_type,
    template_data,status,max_retries,retry_count,target_count
  ) SELECT 'notification-email:' || id,'notification_email_v1',NOW(),
           jsonb_build_array(user_id),'project_update',
           jsonb_build_object('notificationId',id),'pending',5,0,1
    FROM added
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), receipts AS (
  INSERT INTO notification_delivery_log (
    id,notification_id,user_id,delivery_method,status,delivered_at
  ) SELECT 'in-app:' || id,id,user_id,'in_app','delivered',NOW() FROM added
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT (SELECT count(*) FROM added)::int AS notifications,
       (SELECT count(*) FROM jobs)::int AS email_jobs,
       (SELECT count(*) FROM receipts)::int AS in_app_receipts
`;

/** Caller supplies the same transaction connection that saved the order/event.
 * No direct provider send. The established email worker applies preferences and
 * handles delivery; a replay never resets a completed or uncertain email job. */
export async function queueJwStoneSaleNotifications(
  client: Pick<PoolClient, "query">,
  context: JwStoneSaleNoticeContext,
  previous: JwStoneSaleState,
  next: JwStoneSaleState
): Promise<void> {
  for (const notice of buildJwStoneSaleNotices(context, previous, next)) {
    const result = await client.query(JW_STONE_SALE_NOTICE_SQL, [
      notice.id, notice.userId, notice.title, notice.message, notice.actionUrl,
      JSON.stringify(notice.metadata),
    ]);
    const row = result.rows[0];
    if (!row || Number(row.notifications) !== Number(row.email_jobs) ||
        Number(row.notifications) !== Number(row.in_app_receipts)) {
      throw new Error("JW Stone order notification intents are incomplete");
    }
  }
}
