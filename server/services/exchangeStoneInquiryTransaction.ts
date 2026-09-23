import { createHash, randomUUID } from "node:crypto";
import { appendStoneFunnelEvent } from "./exchangeStoneFunnelStore";
import { comparableOfferKey, privateBuyerKey, type Acquisition } from "./exchangeStoneFunnel";

export type StoneQueryClient = {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
  release(error?: Error): void;
};
export type StoneQueryPool = { connect(): Promise<StoneQueryClient> };
export type StoneInquiryCommand = {
  buyerId: string;
  listingId: string;
  decisionId: string;
  requestKey?: string;
  message: string;
  inquiryIntent: "availability" | "callback";
};
export type StoneInquiryReceipt = {
  id: string;
  listingId: string;
  conversationId: string;
  messageId: string;
  notificationId: string;
  status: "pending";
  createdAt: string;
};
export type AuthorizedStoneOffer = {
  sellerId: string;
  title: string;
  priceCents: number;
  unit: "sqft" | "slab";
  fulfillmentTermsKey: string;
  marketKey: string;
};
export type StoneInquiryDependencies = {
  pool: StoneQueryPool;
  metricsSecret: string;
  environment: "production" | "test";
  acquisition: Acquisition;
  journeyKey: string;
  // Must use this transaction's connection and the canonical exposure predicate.
  // The adapter also validates the server-owned TradeScout seller identity.
  authorizeOffer(tx: StoneQueryClient, command: StoneInquiryCommand): Promise<AuthorizedStoneOffer>;
  insertNotification(tx: StoneQueryClient, input: {
    id: string; sellerId: string; conversationId: string; listingId: string;
    inquiryId: string; title: string; inquiryIntent: StoneInquiryCommand["inquiryIntent"];
  }): Promise<void>;
};

export class StoneInquiryError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = "StoneInquiryError";
  }
}
const boundedId = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_:.-]{1,160}$/.test(v);
const fail = (code: string, status: number, message: string): never => { throw new StoneInquiryError(code, status, message); };

export function validateStoneInquiryCommand(c: StoneInquiryCommand): void {
  if (!boundedId(c.buyerId) || !boundedId(c.decisionId) ||
      typeof c.listingId !== "string" || c.listingId.length > 160 ||
      !/^tradescout-stone-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.listingId)) {
    fail("INVALID_INQUIRY", 400, "A valid stone listing and Decision Card are required.");
  }
  if (c.requestKey !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(c.requestKey))
    fail("INVALID_REQUEST_KEY", 400, "The request identity is invalid. Review the inquiry again.");
  if (typeof c.message !== "string" || !c.message.trim() || c.message.length > 4000 ||
      !["availability", "callback"].includes(c.inquiryIntent)) {
    fail("INVALID_INQUIRY", 400, "A message and valid inquiry type are required.");
  }
}

export function stoneInquiryFingerprint(c: StoneInquiryCommand): string {
  return createHash("sha256").update(JSON.stringify([c.buyerId, c.listingId, c.message, c.inquiryIntent])).digest("hex");
}

/** One connection owns receipt, Decision Card, inbox message, notification and metric.
 * No external notifications are sent here. A COMMIT acknowledgement can be lost;
 * retrying the same request returns the stored receipt instead of re-sending it.
 */
export async function saveStoneInquiry(
  command: StoneInquiryCommand,
  deps: StoneInquiryDependencies
): Promise<{ receipt: StoneInquiryReceipt; replayed: boolean }> {
  validateStoneInquiryCommand(command);
  if (deps.metricsSecret.length < 24 || !["production", "test"].includes(deps.environment))
    fail("INQUIRY_UNAVAILABLE", 503, "Stone inquiries are temporarily unavailable. Your message has not been discarded.");
  const fingerprint = stoneInquiryFingerprint(command);
  const requestKey = command.requestKey || `decision:${command.decisionId}`;
  const scope = `marketplace_listing:${command.listingId}`;
  const tx = await deps.pool.connect();
  let begun = false;
  let releaseError: Error | undefined;
  try {
    await tx.query("BEGIN");
    begun = true;
    // Same buyer/request key is serialized even if a conflicting retry names another listing.
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      JSON.stringify(["stone-inquiry-request-v1", command.buyerId, requestKey]),
    ]);
    const previous = await tx.query(
      `SELECT fingerprint, response FROM exchange_stone_inquiry_receipts
       WHERE buyer_id = $1 AND request_key = $2`, [command.buyerId, requestKey]
    );
    if (previous.rows.length) {
      if (previous.rows[0].fingerprint !== fingerprint)
        fail("REQUEST_CONFLICT", 409, "This request identity was already used for a different inquiry.");
      // Only the authenticated buyer's previously committed receipt is returned.
      // No new contact authority or current inventory promise is granted by replay.
      await tx.query("COMMIT"); begun = false;
      return { receipt: previous.rows[0].response, replayed: true };
    }

    const decision = await tx.query(
      `SELECT id, status, intent, decision_scope FROM decision_cards
       WHERE id = $1 AND user_id = $2 FOR UPDATE`, [command.decisionId, command.buyerId]
    );
    const card = decision.rows[0];
    if (!card || card.status !== "active" || card.intent !== "collaborate" || card.decision_scope !== scope)
      fail("INVALID_DECISION_CARD", 400, "Decision Card not found, inactive, or mismatched.");

    const offer = await deps.authorizeOffer(tx, command);
    if (!boundedId(offer.sellerId) || offer.sellerId === command.buyerId)
      fail("INVALID_SELLER", 400, "You cannot inquire about your own listing.");
    const offerKey = comparableOfferKey({
      materialKey: command.listingId, priceCents: offer.priceCents,
      unit: offer.unit, fulfillmentTermsKey: offer.fulfillmentTermsKey,
    });
    // Serializes conversation creation for distinct legitimate requests to the same seller.
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      JSON.stringify(["stone-inquiry-participants-v1", command.listingId, command.buyerId, offer.sellerId]),
    ]);
    const completeCard = async () => {
      const completed = await tx.query(
        `UPDATE decision_cards SET status = 'completed', decided_at = now(), updated_at = now()
         WHERE id = $1 AND user_id = $2 AND status = 'active' AND intent = 'collaborate'
           AND decision_scope = $3 RETURNING id`, [command.decisionId, command.buyerId, scope]
      );
      if (completed.rows.length !== 1) fail("INVALID_DECISION_CARD", 409, "The Decision Card changed before the inquiry was saved.");
    };
    const writeReceipt = async (receipt: StoneInquiryReceipt) => {
      await tx.query(
        `INSERT INTO exchange_stone_inquiry_receipts
         (buyer_id, request_key, decision_card_id, listing_id, seller_id, fingerprint, inquiry_id, response)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [command.buyerId, requestKey, command.decisionId, command.listingId, offer.sellerId,
          fingerprint, receipt.id, JSON.stringify(receipt)]
      );
    };
    // Compatibility for older clients that mint a new card after a lost response.
    // Only legacy requests are coalesced, for 30 minutes and exact safe content/intent.
    // New clients use explicit UUID identities and can intentionally send new requests.
    if (!command.requestKey) {
      const legacy = await tx.query(
        `SELECT response FROM exchange_stone_inquiry_receipts
         WHERE buyer_id = $1 AND listing_id = $2 AND seller_id = $3 AND fingerprint = $4
           AND created_at >= now() - interval '30 minutes'
         ORDER BY created_at DESC LIMIT 1`, [command.buyerId, command.listingId, offer.sellerId, fingerprint]
      );
      if (legacy.rows.length) {
        await completeCard(); await writeReceipt(legacy.rows[0].response);
        await tx.query("COMMIT"); begun = false;
        return { receipt: legacy.rows[0].response, replayed: true };
      }
    }

    const conversations = await tx.query(
      `SELECT id, status, authority_gate, intent, decision_scope FROM marketplace_conversations
       WHERE listing_id = $1 AND buyer_id = $2 AND seller_id = $3
       ORDER BY created_at, id FOR UPDATE`, [command.listingId, command.buyerId, offer.sellerId]
    );
    if (conversations.rows.some((row: any) => row.status === "blocked"))
      fail("CONTACT_BLOCKED", 403, "This conversation is not available for new inquiries.");
    let conversationId = conversations.rows.find((row: any) => row.status === "active" &&
      row.authority_gate === "decision_card" && row.intent === "collaborate" && row.decision_scope === scope)?.id;
    if (!conversationId) {
      conversationId = randomUUID();
      await tx.query(
        `INSERT INTO marketplace_conversations
         (id,listing_id,buyer_id,seller_id,status,intent,authority_gate,source_decision_card_id,decision_scope)
         VALUES ($1,$2,$3,$4,'active','collaborate','decision_card',$5,$6)`,
        [conversationId, command.listingId, command.buyerId, offer.sellerId, command.decisionId, scope]
      );
    }
    const inquiryId = randomUUID(), messageId = randomUUID(), notificationId = randomUUID();
    const saved = await tx.query(
      `INSERT INTO marketplace_inquiries
       (id,listing_id,buyer_id,seller_id,message,offer_amount,buyer_phone,buyer_email,preferred_contact_method)
       VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL,'message')
       RETURNING created_at`, [inquiryId, command.listingId, command.buyerId, offer.sellerId, command.message]
    );
    if (saved.rows.length !== 1) throw new Error("Inquiry insert did not return its saved timestamp");
    const createdAt = new Date(saved.rows[0].created_at).toISOString();
    await tx.query(
      `INSERT INTO marketplace_messages
       (id,conversation_id,sender_id,sender_type,content,message_type,metadata)
       VALUES ($1,$2,$3,'buyer',$4,'text',$5::jsonb)`,
      [messageId, conversationId, command.buyerId, command.message,
        JSON.stringify({ inquiryId, inquiryIntent: command.inquiryIntent, sourceDecisionCardId: command.decisionId })]
    );
    await tx.query(
      `UPDATE marketplace_conversations SET last_message_at = now(), updated_at = now(),
       is_read_by_buyer = true, is_read_by_seller = false WHERE id = $1`, [conversationId]
    );
    await deps.insertNotification(tx, {
      id: notificationId, sellerId: offer.sellerId, conversationId, listingId: command.listingId,
      inquiryId, title: offer.title, inquiryIntent: command.inquiryIntent,
    });
    await completeCard();
    const eventBase = {
      journeyKey: deps.journeyKey, buyerKey: privateBuyerKey(command.buyerId, deps.metricsSecret),
      offerKey, occurredAt: createdAt, acquisition: deps.acquisition,
      evidence: "saved_inquiry" as const, evidenceId: inquiryId,
      environment: deps.environment, marketKey: offer.marketKey,
    };
    await appendStoneFunnelEvent(tx as any, { ...eventBase, eventKey: `inquiry:${inquiryId}`, stage: "inquiry_submitted" });
    if (command.inquiryIntent === "callback")
      await appendStoneFunnelEvent(tx as any, { ...eventBase, eventKey: `callback:${inquiryId}`, stage: "callback_requested" });
    const receipt: StoneInquiryReceipt = { id: inquiryId, listingId: command.listingId, conversationId,
      messageId, notificationId, status: "pending", createdAt };
    await writeReceipt(receipt);
    await tx.query("COMMIT"); begun = false;
    return { receipt, replayed: false };
  } catch (error) {
    if (begun) {
      try { await tx.query("ROLLBACK"); }
      catch (rollbackError) { releaseError = rollbackError instanceof Error ? rollbackError : new Error("Rollback failed"); }
    }
    throw error;
  } finally { tx.release(releaseError); }
}
