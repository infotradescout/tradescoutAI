import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { JW_STONE_FEATURE_KEY } from "@shared/jwStoneFeaturePolicy";
import { jwStonePriceKey, JW_STONE_MEMBER_PRICING_PRODUCT_KEY } from "@shared/jwStoneMemberPricing";
import { isStoneInventoryConfirmationFresh } from "@shared/stoneInventory";
import { initialJwStoneSale, applyJwStonePaymentOutcome, jwStoneSaleIntakeSchema, jwStoneSaleCommandSchema, jwStoneFinalQuoteSchema, JwStoneSaleError, type JwStoneSaleIntake, type JwStoneSaleState, type JwStoneSaleCommand } from "@shared/jwStoneCheckout";
import { readStoredJwStoneFeatures } from "./jwStoneFeatureStore";
import { StripeJwStoneCheckoutProvider, type JwStoneCheckoutProvider, type JwStonePaymentBinding, type JwStoneProviderSession } from "./jwStoneCheckoutProvider";

type Context = { requestId: string; buyerId: string; sellerId: string; sellerUserId: string; requestStatus: string; intake: JwStoneSaleIntake };
type Queryable = Pick<PoolClient, "query">;
function fail(code: string, message: string, status = 409): never { throw new JwStoneSaleError(status, code, message); }
const object = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const activePayment = (state: JwStoneSaleState) => state.status === "needs_review" || Boolean(state.attempt && !["payment_failed", "payment_expired"].includes(state.status));

/** Orders own durable allocations; the temporary-cart expiry worker never owns these allocations. */
export class JwStoneSales {
  constructor(private readonly database: Pick<Pool, "connect" | "query">, readonly provider: JwStoneCheckoutProvider = new StripeJwStoneCheckoutProvider()) {}

  private async context(db: Queryable, requestId: string, actor: string | null, lock = false): Promise<Context> {
    const found = await db.query(
      `SELECT wr.id, wr.created_by_user_id AS buyer_id, wr.status AS request_status,
       p.id AS profile_id, p.business_id AS seller_id, b.owner_user_id AS seller_user_id
       FROM work_requests wr JOIN profiles p ON p.id=wr.source_ref_id JOIN businesses b ON b.id=p.business_id
       WHERE wr.id=$1 AND p.slug='jw-stone' AND wr.source='direct_connect'
         AND wr.visibility='private' AND ($2::text IS NULL OR wr.created_by_user_id=$2 OR b.owner_user_id=$2)
       ${lock ? "FOR UPDATE OF wr FOR SHARE OF p,b" : ""}`, [requestId, actor]);
    if (found.rows.length !== 1) fail("jw_order_not_found", "JW Stone offer not found.", 404);
    const row = found.rows[0];
    const events = await db.query("SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='created'", [requestId]);
    const original = events.rows.map(event => object(event.metadata)).filter(meta => meta.source === "tradepartner_profile" && meta.businessSlug === "jw-stone" && meta.businessId === row.seller_id && meta.profileId === row.profile_id && meta.requestType === "make_offer");
    if (original.length !== 1) fail("jw_offer_not_found", "This request does not contain a verified JW Stone offer.", 404);
    const parsed = jwStoneSaleIntakeSchema.safeParse(original[0].stoneOffer);
    if (!parsed.success) fail("jw_offer_invalid", "The original offer needs review before it can become an order.");
    if (new Set(parsed.data.lines.map(line => line.inventoryPublicId)).size !== parsed.data.lines.length) fail("jw_offer_invalid", "The original offer contains duplicate stock identities.");
    return { requestId, buyerId: row.buyer_id, sellerId: row.seller_id, sellerUserId: row.seller_user_id, requestStatus: row.request_status, intake: parsed.data };
  }
  private async state(db: Queryable, context: Context): Promise<JwStoneSaleState> {
    const result = await db.query("SELECT * FROM jw_stone_sales WHERE request_id=$1", [context.requestId]);
    if (!result.rows.length) return initialJwStoneSale();
    const row = result.rows[0];
    if (row.buyer_user_id !== context.buyerId || row.seller_business_id !== context.sellerId || row.state.revision !== row.revision) fail("jw_order_identity", "The order needs an identity review.");
    if (row.state.quote) jwStoneFinalQuoteSchema.parse(row.state.quote);
    return row.state as JwStoneSaleState;
  }
  private async locked<T>(requestId: string, actor: string | null, action: (db: PoolClient, context: Context, state: JwStoneSaleState) => Promise<T>): Promise<T> {
    const initial = await this.context(this.database, requestId, actor);
    const db = await this.database.connect();
    try {
      await db.query("BEGIN");
      await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'");
      await db.query("SELECT pg_advisory_xact_lock(891473,hashtext($1))", [initial.sellerId]);
      const context = await this.context(db, requestId, actor, true);
      if (context.sellerId !== initial.sellerId) fail("jw_seller_changed", "The seller changed. Reload this offer.");
      await db.query("INSERT INTO jw_stone_sales(request_id,seller_business_id,buyer_user_id,state) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(request_id) DO NOTHING", [requestId, context.sellerId, context.buyerId, JSON.stringify(initialJwStoneSale())]);
      await db.query("SELECT request_id FROM jw_stone_sales WHERE request_id=$1 FOR UPDATE", [requestId]);
      const result = await action(db, context, await this.state(db, context));
      await db.query("COMMIT");
      return result;
    } catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error; }
    finally { db.release(); }
  }
  private async append(db: Queryable, context: Context, previous: JwStoneSaleState, next: JwStoneSaleState, actor: string | null, command?: JwStoneSaleCommand): Promise<JwStoneSaleState> {
    const saved = { ...next, revision: previous.revision + 1 };
    const changed = await db.query("UPDATE jw_stone_sales SET state=$3::jsonb,revision=$4,updated_at=clock_timestamp() WHERE request_id=$1 AND revision=$2 RETURNING request_id", [context.requestId, previous.revision, JSON.stringify(saved), saved.revision]);
    if (changed.rowCount !== 1) fail("jw_order_changed", "The order changed. Reload before continuing.");
    await db.query("INSERT INTO jw_stone_sale_events(request_id,revision,actor_user_id,operation_id,fingerprint,state) VALUES($1,$2,$3,$4::uuid,$5,$6::jsonb)", [context.requestId, saved.revision, actor, command?.operationId || null, command ? sha(command) : null, JSON.stringify(saved)]);
    return saved;
  }
  private async admit(db: Queryable, context: Context) {
    if (["closed", "cancelled", "canceled", "completed"].includes(context.requestStatus)) fail("jw_request_closed", "This request is closed. Existing payment status remains available.");
    const flag = await db.query("SELECT enabled,config FROM feature_flags WHERE key=$1 FOR SHARE", [JW_STONE_FEATURE_KEY]);
    if (!readStoredJwStoneFeatures(flag.rows[0]).enabled) fail("JW_STONE_FEATURE_UNAVAILABLE", "New JW Stone orders are paused. Existing payments can still be reconciled.", 403);
    const membership = await db.query(
      `SELECT account.id FROM profile_accounts account
       JOIN profiles target ON target.id=account.target_profile_id
       JOIN user_profiles business ON business.id=account.business_profile_id
       JOIN profile_account_entitlements entitlement ON entitlement.profile_account_id=account.id
       WHERE account.owner_user_id=$1 AND account.target_business_id=$2 AND target.business_id=$2 AND target.slug='jw-stone'
       AND account.identity_kind='business' AND account.status='active' AND account.verification_status<>'rejected'
       AND business.user_id=$1 AND business.user_intent::text='business'
       AND COALESCE(business.verification_status::text,'pending') NOT IN ('rejected','suspended')
       AND entitlement.product_key=$3 AND entitlement.status IN ('active','pending_verification')
       FOR SHARE OF account,target,business,entitlement`, [context.buyerId, context.sellerId, JW_STONE_MEMBER_PRICING_PRODUCT_KEY]);
    if (membership.rows.length !== 1) fail("jw_membership_required", "An active JW Stone business membership is required for a new order.", 403);
  }
  private async allocate(db: Queryable, context: Context): Promise<JwStoneSaleState["allocations"]> {
    const ownHold = await db.query("SELECT id FROM jw_stone_cart_holds WHERE seller_business_id=$1 AND buyer_user_id=$2 AND status='active' LIMIT 1", [context.sellerId, context.buyerId]);
    if (ownHold.rows.length) fail("jw_existing_cart_hold", "Release your temporary cart reservation, then return to this confirmed quote to pay. Checkout reserves the selected stock separately.");
    const found = await db.query(
      `SELECT position.id,position.quantity,position.held_quantity,position.unit,position.lifecycle_status,
       position.public_availability_status,position.published_at,position.publication_evidence,
       passport.public_id,passport.asset_kind,passport.passport_status,passport.condition_json,passport.dimensions_json,material.canonical_name
       FROM stone_materials material JOIN stone_asset_passports passport ON passport.material_id=material.id
       JOIN stone_inventory_positions position ON position.asset_passport_id=passport.id
       WHERE position.holder_business_id=$1 AND passport.public_id=ANY($2::text[])
       ORDER BY material.id,passport.id,position.id FOR UPDATE OF material,passport,position`, [context.sellerId, context.intake.lines.map(line => line.inventoryPublicId)]);
    if (found.rows.length !== context.intake.lines.length || new Set(found.rows.map(row => row.public_id)).size !== found.rows.length) fail("jw_stock_unavailable", "Some selected stock is no longer available.");
    const positionIds = found.rows.map(row => row.id);
    await db.query("SELECT id FROM bidrock_listings WHERE inventory_position_id=ANY($1::uuid[]) ORDER BY id FOR UPDATE", [positionIds]);
    const auctions = await db.query("SELECT auction.id FROM bidrock_auctions auction JOIN bidrock_listings listing ON listing.id=auction.listing_id WHERE listing.inventory_position_id=ANY($1::uuid[]) AND auction.status IN ('scheduled','live','extended','ended') LIMIT 1", [positionIds]);
    if (auctions.rows.length) fail("jw_stock_in_auction", "A selected lot is committed to an auction.");
    const now = new Date((await db.query("SELECT clock_timestamp() AS now")).rows[0].now);
    const allocations: JwStoneSaleState["allocations"] = [];
    for (const line of context.intake.lines) {
      const row = found.rows.find(stock => stock.public_id === line.inventoryPublicId);
      const physical = Number(row.quantity), held = Number(row.held_quantity), condition = object(row.condition_json), dimensions = object(row.dimensions_json);
      if (!Number.isSafeInteger(physical) || !Number.isSafeInteger(held) || held < 0 || physical - held < line.quantity ||
        row.lifecycle_status !== "available" || row.passport_status !== "verified" || row.public_availability_status !== "published_current" || !row.published_at || !Object.keys(object(row.publication_evidence)).length ||
        !["slab", "bundle"].includes(row.asset_kind) || !/^slabs?$/i.test(String(row.unit).trim()) ||
        !isStoneInventoryConfirmationFresh({ lastConfirmedAt: condition.lastConfirmedAt, confirmationExpiresAt: condition.confirmationExpiresAt, now }) ||
        jwStonePriceKey(condition.ownerConfirmedName || row.canonical_name) !== jwStonePriceKey(line.materialName) ||
        dimensions.unit !== line.dimensions.unit || Number(dimensions.length ?? dimensions.width) !== line.dimensions.length || Number(dimensions.height) !== line.dimensions.height) fail("jw_stock_changed", "The stock, measurements or availability changed. JW Stone must review the order before payment.");
      const update = await db.query("UPDATE stone_inventory_positions SET held_quantity=held_quantity+$3,version=version+1,updated_at=NOW() WHERE id=$1::uuid AND holder_business_id=$2 AND quantity-held_quantity >= $3 RETURNING id", [row.id, context.sellerId, line.quantity]);
      if (update.rowCount !== 1) fail("jw_stock_unavailable", "The selected stock was allocated elsewhere.");
      allocations.push({ positionId: row.id, inventoryPublicId: line.inventoryPublicId, quantity: line.quantity });
    }
    return allocations;
  }
  private async release(db: Queryable, context: Context, state: JwStoneSaleState) {
    for (const line of [...state.allocations].sort((a, b) => a.positionId.localeCompare(b.positionId))) {
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) fail("jw_allocation_review", "The order allocation needs review.");
      const changed = await db.query("UPDATE stone_inventory_positions SET held_quantity=held_quantity-$3,version=version+1,updated_at=NOW() WHERE id=$1::uuid AND holder_business_id=$2 AND held_quantity >= $3 AND held_quantity<=quantity AND held_quantity=trunc(held_quantity) RETURNING id", [line.positionId, context.sellerId, line.quantity]);
      if (changed.rowCount !== 1) fail("jw_allocation_review", "Stock accounting requires review; no stock was released.");
    }
  }
  async list(actor: string) {
    if (!actor) fail("jw_sign_in", "Sign in to view your JW Stone offers.", 401);
    const result = await this.database.query(
      `SELECT wr.id,wr.title,wr.created_at,s.state,p.business_id,b.owner_user_id
       FROM work_requests wr JOIN profiles p ON p.id=wr.source_ref_id JOIN businesses b ON b.id=p.business_id
       LEFT JOIN jw_stone_sales s ON s.request_id=wr.id
       WHERE p.slug='jw-stone' AND wr.source='direct_connect' AND wr.visibility='private'
         AND (wr.created_by_user_id=$1 OR b.owner_user_id=$1)
         AND EXISTS (SELECT 1 FROM work_request_events e WHERE e.work_request_id=wr.id AND e.type='created' AND e.metadata->>'businessSlug'='jw-stone' AND e.metadata->>'requestType'='make_offer' AND e.metadata->'stoneOffer' IS NOT NULL)
       ORDER BY wr.created_at DESC,wr.id DESC LIMIT 100`, [actor]);
    return result.rows.map(row => ({ requestId: row.id, title: row.title, createdAt: row.created_at, status: row.state?.status || "pending_review", role: row.owner_user_id === actor ? "seller" : "buyer" }));
  }
  async read(requestId: string, actor: string) {
    const context = await this.context(this.database, requestId, actor);
    const state = await this.state(this.database, context);
    const merchant = this.provider.merchant();
    let methods: ("ach" | "card")[] = [];
    if (merchant?.businessId === context.sellerId) methods = await this.provider.methods().catch(() => []);
    return { requestId, role: actor === context.sellerUserId ? "seller" as const : "buyer" as const, intake: context.intake,
      state: { ...state, allocations: undefined, attempt: state.attempt ? { ...state.attempt, accountId: undefined, url: actor === context.buyerId && state.status === "checkout" ? state.attempt.url : null } : null },
      methods, testMode: merchant ? !merchant.live : false, paymentsConfigured: methods.length > 0,
      paymentNotice: methods.length ? "ACH can remain processing after checkout. Do not pay again while payment is pending." : "JW Stone online payments are not activated. Your offer and quote remain saved. No payment has been taken." };
  }
  async command(requestId: string, actor: string, input: unknown) {
    const command = jwStoneSaleCommandSchema.parse(input);
    const merchant = this.provider.merchant();
    const methods = command.action === "checkout" ? await this.provider.methods() : [];
    const prepared = await this.locked(requestId, actor, async (db, context, state) => {
      const replay = await db.query("SELECT fingerprint,state FROM jw_stone_sale_events WHERE request_id=$1 AND actor_user_id=$2 AND operation_id=$3::uuid", [requestId, actor, command.operationId]);
      if (replay.rows.length) {
        if (replay.rows[0].fingerprint !== sha(command)) fail("jw_command_conflict", "This action ID already belongs to different terms.");
        return { dispatch: command.action === "checkout" && state.attempt?.id === replay.rows[0].state.attempt?.id && state.attempt?.outcome === "creating" && state.status !== "needs_review" };
      }
      if (state.revision !== command.expectedRevision) fail("jw_order_changed", "This offer changed. Reload and review the current terms before continuing.");
      await this.admit(db, context);
      if (command.action === "quote" || command.action === "decline") {
        if (actor !== context.sellerUserId) fail("jw_seller_required", "Only the current JW Stone business owner can confirm or decline an offer.", 403);
        if (activePayment(state)) fail("jw_payment_in_progress", "An existing payment must be resolved before quote terms can change.");
        if (command.action === "decline") { await this.append(db, context, state, { ...state, status: "declined", quote: null, attempt: null, note: command.notes }, actor, command); return { dispatch: false }; }
        if (command.decision === "accept_offer" && command.materialCents !== context.intake.offeredTotalCents) fail("jw_offer_amount", "Accepting the offer must use the buyer's actual offered material amount. Use a counteroffer to change it.");
        if (context.intake.fulfillment.method === "pickup" && command.deliveryCents !== 0) fail("jw_pickup_freight", "Pickup cannot include a delivery charge.");
        const now = new Date((await db.query("SELECT clock_timestamp() AS now")).rows[0].now);
        const expires = Date.parse(command.expiresAt);
        if (expires <= now.getTime() || expires > now.getTime() + 30 * 86400000) fail("jw_quote_expiry", "Quote expiration must be in the next 30 days.");
        const quote = jwStoneFinalQuoteSchema.parse({ id: randomUUID(), revision: state.revision + 1, materialCents: command.materialCents, taxCents: command.taxCents, deliveryCents: command.deliveryCents, totalCents: command.materialCents + command.taxCents + command.deliveryCents, expiresAt: command.expiresAt, issuedAt: now.toISOString(), issuedBy: actor, decision: command.decision, notes: command.notes });
        await this.append(db, context, state, { ...state, status: "quoted", quote, attempt: null, note: null }, actor, command);
        return { dispatch: false };
      }
      if (actor !== context.buyerId) fail("jw_buyer_required", "Only the buyer can authorize payment.", 403);
      if (!merchant || merchant.businessId !== context.sellerId || !methods.includes(command.method)) fail("jw_payment_unavailable", "JW Stone online payments are not activated. No payment was taken.", 503);
      if (!state.quote || command.quoteId !== state.quote.id || command.totalCents !== state.quote.totalCents) fail("jw_quote_changed", "Review the latest complete quote before payment.");
      if (activePayment(state)) fail("jw_payment_in_progress", "Use the existing checkout or refresh its status. Do not start another payment.");
      const now = new Date((await db.query("SELECT clock_timestamp() AS now")).rows[0].now);
      if (Date.parse(state.quote.expiresAt) <= now.getTime()) fail("jw_quote_expired", "The quote expired. Ask JW Stone for current terms.");
      const allocations = await this.allocate(db, context);
      await this.append(db, context, state, { ...state, status: "checkout", allocations, note: null, attempt: { id: randomUUID(), quoteId: state.quote.id, method: command.method, accountId: merchant.accountId, live: merchant.live, returnOrigin: merchant.returnOrigin, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 45 * 60_000).toISOString(), sessionId: null, url: null, outcome: "creating" } }, actor, command);
      return { dispatch: true };
    });
    if (prepared.dispatch) await this.reconcile(requestId, actor);
    return this.read(requestId, actor);
  }
  /** A callback for an earlier attempt must not be mistaken for the latest session. */
  private async checkPriorPayments(context: Context, state: JwStoneSaleState, actor: string | null): Promise<boolean> {
    const prior = await this.database.query(
      `SELECT DISTINCT ON (state->'attempt'->>'id') state FROM jw_stone_sale_events
       WHERE request_id=$1 AND state->'attempt'->>'sessionId' IS NOT NULL
         AND ($2::text IS NULL OR state->'attempt'->>'id'<>$2)
       ORDER BY state->'attempt'->>'id',revision DESC LIMIT 11`,
      [context.requestId, state.quote && state.attempt ? state.attempt.id : null]);
    let review = prior.rows.length > 10;
    if (!review) {
      const outcomes = await Promise.all(prior.rows.map(async row => {
        const old = row.state as JwStoneSaleState;
        if (!old.quote || !old.attempt?.sessionId) fail("jw_payment_history", "Payment history requires review.");
        jwStoneFinalQuoteSchema.parse(old.quote);
        return this.provider.retrieve({ requestId: context.requestId, buyerId: context.buyerId, quote: old.quote, attempt: old.attempt });
      }));
      review = outcomes.some(result => result.outcome !== "failed" && result.outcome !== "expired");
    }
    if (!review) return false;
    await this.locked(context.requestId, actor, async (db, ctx, current) => {
      if (current.status !== "needs_review") await this.append(db, ctx, current, { ...current, status: "needs_review", note: "An earlier payment attempt requires review. Do not submit another payment or fulfill this order until JW Stone reconciles it." }, null);
    });
    return true;
  }
  /** Trusted webhook calls use actor=null only after provider signature/account validation. */
  async reconcile(requestId: string, actor: string | null): Promise<void> {
    const context = await this.context(this.database, requestId, actor);
    const state = await this.state(this.database, context);
    if (state.status === "needs_review") return;
    if (await this.checkPriorPayments(context, state, actor)) return;
    if (!state.attempt || !state.quote) return;
    const binding: JwStonePaymentBinding = { requestId, buyerId: context.buyerId, quote: state.quote, attempt: state.attempt };
    if (!state.attempt.sessionId && Date.parse(state.attempt.expiresAt) <= Date.now()) {
      await this.locked(requestId, actor, async (db, ctx, current) => {
        if (current.attempt?.id === state.attempt!.id && !current.attempt.sessionId) await this.append(db, ctx, current, applyJwStonePaymentOutcome(current, "needs_review"), null);
      });
      return;
    }
    const session: JwStoneProviderSession = state.attempt.sessionId ? await this.provider.retrieve(binding) : await this.provider.create(binding);
    await this.locked(requestId, actor, async (db, ctx, current) => {
      if (!current.attempt || current.attempt.id !== state.attempt!.id || current.quote?.id !== binding.quote.id) fail("jw_payment_changed", "This payment no longer matches the current order.");
      if (current.attempt.sessionId && current.attempt.sessionId !== session.id) fail("jw_payment_identity", "Payment identity requires review.");
      let next = applyJwStonePaymentOutcome({ ...current, attempt: { ...current.attempt, sessionId: session.id, url: session.url } }, session.outcome);
      if (["payment_failed", "payment_expired"].includes(next.status) && current.allocations.length) {
        await this.release(db, ctx, current);
        next = { ...next, allocations: [] };
      }
      if (JSON.stringify(next) !== JSON.stringify(current)) await this.append(db, ctx, current, next, null);
    });
  }
}
