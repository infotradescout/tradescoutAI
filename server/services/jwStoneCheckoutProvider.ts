import Stripe from "stripe";
import { JwStoneSaleError, JW_STONE_ORDERS_PAGE, type JwStoneCheckoutAttempt, type JwStoneFinalQuote, type JwStonePaymentMethod, type JwStonePaymentOutcome } from "@shared/jwStoneCheckout";

export type JwStoneMerchant = { accountId: string; businessId: string; returnOrigin: string; live: boolean };
export type JwStonePaymentBinding = { requestId: string; buyerId: string; quote: JwStoneFinalQuote; attempt: JwStoneCheckoutAttempt };
export type JwStoneProviderSession = { id: string; url: string | null; outcome: JwStonePaymentOutcome };
export interface JwStoneCheckoutProvider {
  merchant(): JwStoneMerchant | null;
  methods(): Promise<JwStonePaymentMethod[]>;
  create(binding: JwStonePaymentBinding): Promise<JwStoneProviderSession>;
  retrieve(binding: JwStonePaymentBinding): Promise<JwStoneProviderSession>;
  webhookRequest(raw: Buffer, signature: string): Promise<string | null>;
}
const unavailable = () => new JwStoneSaleError(503, "jw_payment_unavailable", "JW Stone online payments are not activated. Your offer and quote are saved; no payment was taken.");
const mismatch = () => new JwStoneSaleError(409, "jw_payment_mismatch", "The payment needs verification. Do not submit another payment.");
function trustedCheckoutUrl(value: string | null): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password || url.port) throw mismatch();
  return url.href;
}
export function jwStoneSessionOutcome(session: Stripe.Checkout.Session): JwStonePaymentOutcome {
  const intent = session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = intent?.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  if (charge && (charge.disputed || charge.refunded || charge.amount_refunded > 0)) return "needs_review";
  if (session.payment_status === "paid") return "paid";
  if (session.status === "expired" && (!intent || ["canceled", "requires_payment_method"].includes(intent.status))) return "expired";
  if (intent?.status === "processing") return "processing";
  if (session.status === "complete" && intent && ["canceled", "requires_payment_method"].includes(intent.status)) return "failed";
  if (session.status === "open") return "open";
  return "needs_review";
}

/** Only an explicitly mapped JW merchant is supported. Never silently charge the platform account. */
export class StripeJwStoneCheckoutProvider implements JwStoneCheckoutProvider {
  private readonly config: JwStoneMerchant | null;
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string;
  constructor(environment: NodeJS.ProcessEnv = process.env, client?: Stripe) {
    const accountId = environment.JW_STONE_STRIPE_CONNECTED_ACCOUNT || "";
    const businessId = environment.JW_STONE_PAYMENT_BUSINESS_ID || "";
    const mode = environment.JW_STONE_CHECKOUT_MODE;
    const key = environment.STRIPE_SECRET_KEY || "";
    this.webhookSecret = environment.JW_STONE_STRIPE_WEBHOOK_SECRET || "";
    let origin: URL | null = null;
    try { origin = new URL(environment.JW_STONE_CHECKOUT_RETURN_ORIGIN || ""); } catch { /* Not configured. */ }
    const allowedHost = origin && ["www.thetradescout.com", "thetradescout.com", "jwstonelogistics.com", "www.jwstonelogistics.com"].includes(origin.hostname);
    this.config = /^[a-zA-Z0-9_-]{1,180}$/.test(businessId) && /^acct_[a-zA-Z0-9]+$/.test(accountId) &&
      (mode === "live" || mode === "test") && key.startsWith(mode === "live" ? "sk_live_" : "sk_test_") &&
      this.webhookSecret.startsWith("whsec_") && origin?.protocol === "https:" && allowedHost && !origin.username && !origin.password && !origin.port && origin.pathname === "/" && !origin.search && !origin.hash
      ? { accountId, businessId, returnOrigin: origin.origin, live: mode === "live" } : null;
    this.stripe = this.config ? client || new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000 }) : null;
  }
  merchant(): JwStoneMerchant | null { return this.config ? { ...this.config } : null; }
  private checked(binding: JwStonePaymentBinding) {
    if (!this.config || !this.stripe) throw unavailable();
    if (binding.attempt.accountId !== this.config.accountId || binding.attempt.live !== this.config.live || binding.attempt.returnOrigin !== this.config.returnOrigin || binding.attempt.quoteId !== binding.quote.id) throw mismatch();
    return { stripe: this.stripe, config: this.config };
  }
  async methods(): Promise<JwStonePaymentMethod[]> {
    if (!this.config || !this.stripe) return [];
    const account = await this.stripe.accounts.retrieve(this.config.accountId);
    if (!account.charges_enabled || account.country !== "US") return [];
    const methods: JwStonePaymentMethod[] = [];
    if (account.capabilities?.us_bank_account_ach_payments === "active") methods.push("ach");
    if (account.capabilities?.card_payments === "active") methods.push("card");
    return methods;
  }
  private project(binding: JwStonePaymentBinding, session: Stripe.Checkout.Session): JwStoneProviderSession {
    if (session.mode !== "payment" || session.currency !== "usd" || session.amount_total !== binding.quote.totalCents ||
      session.livemode !== binding.attempt.live || session.client_reference_id !== binding.requestId ||
      session.metadata?.jwRequestId !== binding.requestId || session.metadata?.jwQuoteId !== binding.quote.id ||
      session.metadata?.jwAttemptId !== binding.attempt.id || session.metadata?.jwBuyerId !== binding.buyerId ||
      (binding.attempt.sessionId && session.id !== binding.attempt.sessionId)) throw mismatch();
    return { id: session.id, url: trustedCheckoutUrl(session.url), outcome: jwStoneSessionOutcome(session) };
  }
  async create(binding: JwStonePaymentBinding): Promise<JwStoneProviderSession> {
    const { stripe, config } = this.checked(binding);
    if (!(await this.methods()).includes(binding.attempt.method)) throw unavailable();
    const metadata = { jwRequestId: binding.requestId, jwQuoteId: binding.quote.id, jwAttemptId: binding.attempt.id, jwBuyerId: binding.buyerId };
    const price = (name: string, amount: number): Stripe.Checkout.SessionCreateParams.LineItem => ({ quantity: 1, price_data: { currency: "usd", unit_amount: amount, product_data: { name } } });
    const lines = [price("JW Stone — confirmed materials", binding.quote.materialCents)];
    if (binding.quote.taxCents) lines.push(price("Sales tax — confirmed by JW Stone", binding.quote.taxCents));
    if (binding.quote.deliveryCents) lines.push(price("Delivery — confirmed by JW Stone", binding.quote.deliveryCents));
    const back = config.returnOrigin + JW_STONE_ORDERS_PAGE + "?request=" + encodeURIComponent(binding.requestId);
    const session = await stripe.checkout.sessions.create({
      mode: "payment", client_reference_id: binding.requestId, currency: "usd", metadata,
      payment_method_types: [binding.attempt.method === "ach" ? "us_bank_account" : "card"],
      line_items: lines, payment_intent_data: { metadata },
      expires_at: Math.floor(Date.parse(binding.attempt.expiresAt) / 1000),
      success_url: back + "&payment=return", cancel_url: back + "&payment=return",
    }, { stripeAccount: config.accountId, idempotencyKey: "jw-stone:" + binding.requestId + ":" + binding.attempt.id });
    const created = this.project(binding, session);
    // A retried idempotent POST returns its original body, not necessarily current
    // payment status. Refresh the recovered identity before acknowledging a callback.
    return this.retrieve({ ...binding, attempt: { ...binding.attempt, sessionId: created.id } });
  }
  async retrieve(binding: JwStonePaymentBinding): Promise<JwStoneProviderSession> {
    const { stripe, config } = this.checked(binding);
    if (!binding.attempt.sessionId) throw mismatch();
    const session = await stripe.checkout.sessions.retrieve(binding.attempt.sessionId, { expand: ["payment_intent.latest_charge"] }, { stripeAccount: config.accountId });
    return this.project(binding, session);
  }
  async webhookRequest(raw: Buffer, signature: string): Promise<string | null> {
    if (!this.config || !this.stripe) throw unavailable();
    const event = this.stripe.webhooks.constructEvent(raw, signature, this.webhookSecret);
    if (event.account !== this.config.accountId || event.livemode !== this.config.live) throw mismatch();
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      return session.metadata?.jwRequestId || null;
    }
    if (["charge.refunded", "charge.dispute.created"].includes(event.type)) {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute;
      let intentId = object.payment_intent;
      if (!intentId) return null;
      if (typeof intentId !== "string") intentId = intentId.id;
      const intent = await this.stripe.paymentIntents.retrieve(intentId, {}, { stripeAccount: this.config.accountId });
      return intent.metadata.jwRequestId || null;
    }
    return null;
  }
}
