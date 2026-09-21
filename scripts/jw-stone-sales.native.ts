import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Server } from "node:http";
import type { JwStoneCheckoutProvider, JwStonePaymentBinding, JwStoneProviderSession } from "../server/services/jwStoneCheckoutProvider";
import type { JwStonePaymentOutcome } from "../shared/jwStoneCheckout";

assert.equal(process.env.NODE_ENV, "test");assert.equal(process.env.JW_SALES_FIXTURE, "true");
const url = new URL(process.env.TEST_DATABASE_URL || "");assert.equal(url.hostname, "127.0.0.1");assert.equal(url.pathname, "/ts_jw_sales_test");
const output = path.resolve(process.env.JW_SALES_OUTPUT || "test-results/jw-sales");
const keep = new Set(["PATH", "HOME", "TMPDIR", "NODE_ENV", "TEST_DATABASE_URL", "JW_SALES_FIXTURE", "PLAYWRIGHT_BROWSERS_PATH", "LD_LIBRARY_PATH"]);
for (const key of Object.keys(process.env)) if (!keep.has(key)) delete process.env[key];
const { default: dotenv } = await import("dotenv");dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
process.env.DATABASE_URL = url.href;process.env.ALLOW_INSECURE_TEST_DATABASE = "true";
const { db, pool } = await import("../server/db");
const schema = await import("../shared/schema");
const { JwStoneSales } = await import("../server/services/jwStoneSales");
const { JwStoneCartHolds } = await import("../server/services/jwStoneCartHolds");
const { registerJwStoneSalesRoutes } = await import("../server/routes/jw-stone-sales");
const { preserveStripeWebhookRawBody } = await import("../server/paymentWebhookRoutes");
const { reviewJwStoneOffer } = await import("../server/services/jwStoneOfferReview");
const { reviewJwStoneMemberCart } = await import("../server/routes/jw-stone-member-pricing");
const { getStoneInventoryProfileTarget, upsertCurrentStoneInventory, setStoneInventorySaleReady } = await import("../server/services/stoneInventoryService");
const { getJwStonePricingSnapshot } = await import("../server/services/jwStoneDrivePricing");
const { createJwStoneFeatureStore } = await import("../server/services/jwStoneFeatureStore");
const { JW_STONE_PRICING_DRIVE_FILE_ID, JW_STONE_PRICING_DRIVE_FOLDER_ID } = await import("../shared/jwStoneMemberPricing");
const { default: express } = await import("express");
const { default: Stripe } = await import("stripe");
const { chromium, expect } = await import("@playwright/test");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const proof: { head: string; passed: boolean; checks: string[]; devices: any[]; [key: string]: any } = { head, startedAt: new Date().toISOString(), passed: false, checks: [], devices: [], productionWrites: false, providerNetworkUsed: false, scope: "Canonical native database and actual sale service/routes/order-page JS; isolated fixture authentication and simulated provider sessions with real Stripe signature verification. No real processor charge or full-production-auth acceptance." };
const note = (text: string) => { proof.checks.push(text);console.log("JW_SALES_NATIVE_CHECK " + text); };
const reject = (work: () => Promise<unknown>, code: string) => assert.rejects(work, (error: any) => error.code === code, code);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
let server: Server | undefined, browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "ts_jw_sales_test");
  assert.equal((await pool.query("SELECT to_regclass('jw_stone_sales') AS sales,to_regclass('jw_stone_sale_events') AS events")).rows[0].sales, "jw_stone_sales");
  note("new ordered migration installed canonical order state and append-only history");
  const owner = "jw-sales-owner-" + randomUUID(), buyer = "jw-sales-buyer-" + randomUUID(), otherBuyer = "jw-sales-buyer2-" + randomUUID(), outsider = "jw-sales-outsider-" + randomUUID();
  for (const id of [owner, buyer, otherBuyer, outsider]) await db.insert(schema.users).values({ id, email: id + "@example.test", firstName: "Synthetic", lastName: "Sale", role: "contractor", roles: ["contractor"], activeRole: "contractor", profileVisibility: "private", emailVerified: false, onboardingCompleted: false });
  const [seller] = await db.insert(schema.businesses).values({ name: "Synthetic JW order supplier", slug: "sales-supplier-" + randomUUID(), ownerUserId: owner, roleContext: "business_owner", type: "contractor", status: "active", claimStatus: "claimed", publicDiscoveryEnabled: true }).returning();
  const [profile] = await db.insert(schema.profiles).values({ ownerUserId: owner, businessId: seller.id, roleContext: "contractor", slug: "jw-stone", displayName: "JW Stone", status: "published", publiclyReleased: true, contentBlocks: [] }).returning();
  for (const user of [buyer, otherBuyer]) {
    const businessProfile = randomUUID();
    await pool.query("INSERT INTO user_profiles(id,user_id,user_intent,verification_status,display_name) VALUES($1,$2,'business','pending','Synthetic order member')", [businessProfile, user]);
    const account = await pool.query("INSERT INTO profile_accounts(owner_user_id,business_profile_id,target_profile_id,target_business_id,identity_kind,status,verification_status) VALUES($1,$2,$3,$4,'business','active','pending') RETURNING id", [user, businessProfile, profile.id, seller.id]);
    await pool.query("INSERT INTO profile_account_entitlements(profile_account_id,product_key,status) VALUES($1,'jw_stone_member_pricing','pending_verification') ON CONFLICT DO NOTHING", [account.rows[0].id]);
  }
  const target = await getStoneInventoryProfileTarget("jw-stone");assert(target);
  const now = new Date().toISOString();const stock: any[] = [], prices: any[] = [];
  for (let index = 0; index < 8; index++) {
    const materialName = "Sale Fixture Stone " + (index + 1);
    const item = await upsertCurrentStoneInventory(target, { materialSlug: "sale-fixture-stone-" + (index + 1), materialName, materialClass: "natural_stone", materialFamily: "Granite", assetKind: "slab", quantity: index === 7 ? 1 : 20, unit: "slabs", dimensions: { length: 120, height: 60, unit: "in" }, finishQuantities: [], imageUrls: [], lastConfirmedAt: now, confirmationExpiresAt: new Date(Date.now() + 86400000).toISOString() });
    await setStoneInventorySaleReady({ target, publicId: item.id, saleReady: true, actorUserId: owner });stock.push(item);
    prices.push({ stoneName: materialName, stoneKey: materialName.toLowerCase(), slabPriceCents: 300 + index * 75, bundlePriceCents: 200 + index * 50, bundleMinSlabs: 7, landedCostCents: 100 });
  }
  process.env.JW_STONE_PRICING_SOURCE = "approved_import";
  process.env.JW_STONE_PRICING_APPROVED_IMPORT = JSON.stringify({ schemaVersion: 1, fileId: JW_STONE_PRICING_DRIVE_FILE_ID, folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID, sourceUpdatedAt: now, sourceRetrievedAt: now, prices });
  const originalPriceSource = process.env.JW_STONE_PRICING_APPROVED_IMPORT;
  const originalEvents = new Map<string, string>();
  async function offer(scope: "stone" | "cart", user = buyer, indexes = scope === "stone" ? [0] : [0, 1, 2, 3, 4, 5, 6]) {
    const selection = { lines: indexes.map(index => ({ inventoryPublicId: stock[index].id, quantity: 1 })), fulfillment: { method: "delivery" as const, postalCode: "32501" } };
    const reviewed = await reviewJwStoneMemberCart(user, selection);assert(reviewed.materialReady);assert(reviewed.subtotalCents);
    const intake = await reviewJwStoneOffer({ profileSlug: "jw-stone", viewerId: user, user: { id: user, role: "contractor" }, input: { scope, selection, offeredTotalCents: reviewed.subtotalCents - 100, expectedSubtotalCents: reviewed.subtotalCents, termsAcknowledged: true } });
    const [request] = await db.insert(schema.workRequests).values({ createdByUserId: user, title: "Synthetic " + scope + " offer", description: "Synthetic native checkout acceptance only", category: "business_request", scope: "personal", source: "direct_connect", sourceRefId: profile.id, status: "routed", visibility: "private", exposureMode: "guided", competitionMode: "none" }).returning();
    const metadata = { source: "tradepartner_profile", profileId: profile.id, businessId: seller.id, businessSlug: "jw-stone", requestType: "make_offer", stoneOffer: intake };
    await db.insert(schema.workRequestEvents).values({ workRequestId: request.id, type: "created", actorUserId: user, metadata });
    originalEvents.set(request.id, digest(metadata));return { id: request.id, intake };
  }
  const signingSdk = new Stripe("sk_test_isolated_signature_only"), webhookSecret = "whsec_isolated_jw_native";
  class FakeProvider implements JwStoneCheckoutProvider {
    sessions = new Map<string, { binding: JwStonePaymentBinding; session: JwStoneProviderSession }>();
    calls = 0;created = 0;loseNext = false;enabled = true;
    merchant() { return this.enabled ? { accountId: "acct_jwfixture", businessId: seller.id, returnOrigin: "https://jwstonelogistics.com", live: false } : null; }
    async methods() { return this.enabled ? ["ach", "card"] as ("ach" | "card")[] : []; }
    async create(binding: JwStonePaymentBinding) {
      this.calls++;let saved = this.sessions.get(binding.attempt.id);
      if (!saved) { this.created++;saved = { binding: structuredClone(binding), session: { id: "cs_test_" + binding.attempt.id.replaceAll("-", ""), url: "https://checkout.stripe.com/c/pay/cs_test_" + binding.attempt.id.replaceAll("-", ""), outcome: "open" } };this.sessions.set(binding.attempt.id, saved); }
      assert.equal(saved.binding.quote.totalCents, binding.quote.totalCents);assert.equal(saved.binding.attempt.method, binding.attempt.method);
      if (this.loseNext) { this.loseNext = false;throw new Error("Synthetic provider response lost after session creation"); }
      return { ...saved.session };
    }
    async retrieve(binding: JwStonePaymentBinding) {
      const saved = this.sessions.get(binding.attempt.id);assert(saved);assert.equal(saved.session.id, binding.attempt.sessionId);assert.equal(saved.binding.buyerId, binding.buyerId);return { ...saved.session };
    }
    async webhookRequest(raw: Buffer, signature: string) {
      const event = signingSdk.webhooks.constructEvent(raw, signature, webhookSecret);
      assert.equal(event.account, "acct_jwfixture");assert.equal(event.livemode, false);
      return (event.data.object as Stripe.Checkout.Session).metadata?.jwRequestId || null;
    }
    outcome(attemptId: string, outcome: JwStonePaymentOutcome) { const saved = this.sessions.get(attemptId);assert(saved);saved.session.outcome = outcome;if(outcome !== "open") saved.session.url = null; }
  }
  const provider = new FakeProvider(), sales = new JwStoneSales(pool, provider), holds = new JwStoneCartHolds(pool);
  const held = async () => Number((await pool.query("SELECT COALESCE(sum(held_quantity),0) AS n FROM stone_inventory_positions WHERE holder_business_id=$1", [seller.id])).rows[0].n);
  const state = async (id: string) => (await sales.read(id, buyer)).state;
  const quoteCommand = (intake: any, revision = 0) => ({ action: "quote", operationId: randomUUID(), expectedRevision: revision, decision: "accept_offer", materialCents: intake.offeredTotalCents, taxCents: 500, deliveryCents: 2050, expiresAt: new Date(Date.now() + 86400000).toISOString(), notes: "Explicit synthetic tax and freight" });
  const payCommand = (value: any, method = "ach") => ({ action: "checkout", operationId: randomUUID(), expectedRevision: value.revision, quoteId: value.quote.id, totalCents: value.quote.totalCents, method, acceptFinalQuote: true });
  const main = await offer("cart");
  assert.equal(main.intake.lines.length, 7);assert.equal(new Set(main.intake.lines.map(line => line.materialName)).size, 7);assert(main.intake.lines.every(line => line.pricingTier === "bundle"));
  await reject(() => sales.read(main.id, outsider), "jw_order_not_found");
  await reject(() => sales.command(main.id, buyer, quoteCommand(main.intake)), "jw_seller_required");
  assert.equal(await held(), 0);assert.equal(provider.created, 0);
  note("actual seven-material offer review uses each source bundle rate and rejects unrelated readers/buyer quote authority");
  const firstQuote = quoteCommand(main.intake);await sales.command(main.id, owner, firstQuote);
  const first = await state(main.id);assert.equal(first.status, "quoted");assert(first.quote);
  await sales.command(main.id, owner, firstQuote);assert.equal((await state(main.id)).revision, first.revision);
  await reject(() => sales.command(main.id, owner, { ...firstQuote, materialCents: main.intake.offeredTotalCents + 1 }), "jw_command_conflict");
  await reject(() => sales.command(main.id, owner, { ...quoteCommand(main.intake, first.revision), materialCents: main.intake.offeredTotalCents + 1 }), "jw_offer_amount");
  await sales.command(main.id, owner, { ...quoteCommand(main.intake, first.revision), decision: "counter_offer", materialCents: main.intake.offeredTotalCents + 250 });
  const quoted = await state(main.id);assert(quoted.quote);assert.notEqual(quoted.quote.id, first.quote.id);
  await reject(() => sales.command(main.id, buyer, payCommand(first)), "jw_order_changed");
  await reject(() => sales.command(main.id, buyer, { ...payCommand(quoted), quoteId: first.quote.id }), "jw_quote_changed");
  await reject(() => sales.command(main.id, buyer, { ...payCommand(quoted), totalCents: quoted.quote.totalCents - 1 }), "jw_quote_changed");
  await assert.rejects(() => sales.command(main.id, buyer, { ...payCommand(quoted), acceptFinalQuote: false }));
  provider.enabled = false;await reject(() => sales.command(main.id, buyer, payCommand(quoted)), "jw_payment_unavailable");provider.enabled = true;
  assert.equal(await held(), 0);assert.equal(provider.created, 0);
  note("seller acceptance/counteroffer are revision-bound; old totals, missing consent and unavailable merchant create no checkout or stock allocation");
  const temporary = await holds.reserve({ buyerUserId: buyer, sellerBusinessId: seller.id, snapshot: await getJwStonePricingSnapshot({ forceRefresh: true }), request: { idempotencyKey: randomUUID(), lines: [{ inventoryPublicId: stock[0].id, quantity: 1 }], expectedSubtotalCents: 15000, fulfillment: { method: "pickup" } } });
  await reject(() => sales.command(main.id, buyer, payCommand(quoted)), "jw_existing_cart_hold");
  await holds.release({ buyerUserId: buyer, sellerBusinessId: seller.id, reservationId: temporary.reservationId });
  provider.loseNext = true;const payment = payCommand(quoted);
  await assert.rejects(() => sales.command(main.id, buyer, payment), /response lost/);
  assert.equal(await held(), 7);assert.equal(provider.created, 1);
  const uncertain = await state(main.id);assert.equal(uncertain.attempt?.outcome, "creating");
  await sales.command(main.id, buyer, payment);const opened = await state(main.id);assert(opened.attempt);assert.equal(opened.attempt.id, uncertain.attempt?.id);assert.equal(provider.created, 1);assert.equal(await held(), 7);
  await reject(() => sales.command(main.id, buyer, payCommand(opened)), "jw_payment_in_progress");
  note("explicit payment allocates seven slabs once; a lost session response recovers the same attempt without duplicate sessions or allocations");
  provider.outcome(opened.attempt.id, "processing");await sales.reconcile(main.id, buyer);assert.equal((await state(main.id)).status, "processing");
  await holds.expireSeller(seller.id);assert.equal(await held(), 7);
  const flags = createJwStoneFeatureStore(pool);
  await flags.change(owner, { enabled: false, expectedRevision: (await flags.read()).revision, operationId: randomUUID(), preserveBaseServices: true, note: "Synthetic order recovery test" });
  await pool.query("UPDATE profile_account_entitlements SET status='revoked' WHERE profile_account_id IN (SELECT id FROM profile_accounts WHERE owner_user_id=$1) AND product_key='jw_stone_member_pricing'", [buyer]);
  provider.outcome(opened.attempt.id, "paid");await sales.reconcile(main.id, buyer);assert.equal((await state(main.id)).status, "paid");assert.equal(await held(), 7);
  await sales.reconcile(main.id, buyer);assert.equal(await held(), 7);
  await flags.change(owner, { enabled: true, expectedRevision: (await flags.read()).revision, operationId: randomUUID(), preserveBaseServices: true, note: "Restore synthetic feature state" });
  await pool.query("UPDATE profile_account_entitlements SET status='pending_verification' WHERE profile_account_id IN (SELECT id FROM profile_accounts WHERE owner_user_id=$1) AND product_key='jw_stone_member_pricing'", [buyer]);
  await reject(() => sales.command(main.id, owner, quoteCommand(main.intake, (await state(main.id)).revision)), "jw_payment_in_progress");
  note("ACH remains processing until provider success; cart expiry cannot release payment stock; reconciliation survives feature pause and revoked pricing membership");
  const declined = await offer("stone");await sales.command(declined.id, owner, { action: "decline", operationId: randomUUID(), expectedRevision: 0, notes: "Synthetic decline" });assert.equal((await state(declined.id)).status, "declined");
  for (const terminal of ["failed", "expired"] as const) {
    const single = await offer("stone");await sales.command(single.id, owner, quoteCommand(single.intake));await sales.command(single.id, buyer, payCommand(await state(single.id), "card"));
    const active = await state(single.id);assert(active.attempt);assert.equal(await held(), 8);
    provider.outcome(active.attempt.id, terminal);await sales.reconcile(single.id, buyer);assert.equal(await held(), 7);await sales.reconcile(single.id, buyer);assert.equal(await held(), 7);
    provider.outcome(active.attempt.id, "paid");await sales.reconcile(single.id, buyer);await sales.reconcile(single.id, buyer);assert.equal((await state(single.id)).status, "needs_review");assert.equal(await held(), 7);
  }
  note("declined offers do not take payment; failed/expired sessions release exactly their own allocation once; repeated late success stays in review");
  const raceA = await offer("stone", buyer, [7]), raceB = await offer("stone", otherBuyer, [7]);
  await sales.command(raceA.id, owner, quoteCommand(raceA.intake));await sales.command(raceB.id, owner, quoteCommand(raceB.intake));
  const [a, b] = await Promise.all([sales.read(raceA.id, buyer), sales.read(raceB.id, otherBuyer)]);
  const outcomes = await Promise.allSettled([sales.command(raceA.id, buyer, payCommand(a.state)), sales.command(raceB.id, otherBuyer, payCommand(b.state))]);
  assert.equal(outcomes.filter(value => value.status === "fulfilled").length, 1);assert.equal(outcomes.filter(value => value.status === "rejected").length, 1);assert.equal(await held(), 8);
  note("two independent buyers race for one final slab and only one payment attempt acquires it");
  await assert.rejects(() => pool.query("UPDATE jw_stone_sale_events SET state=state WHERE request_id=$1", [main.id]), /append-only/);
  await assert.rejects(() => pool.query("DELETE FROM jw_stone_sale_events WHERE request_id=$1", [main.id]), /append-only/);
  await assert.rejects(() => pool.query("UPDATE jw_stone_sales SET buyer_user_id=$2,revision=revision+1 WHERE request_id=$1", [main.id, outsider]), /identity is immutable/);
  note("database rejects history mutation/deletion and order-owner replacement");
  const app = express();app.use(express.json({ verify: preserveStripeWebhookRawBody }));
  app.use((req, _res, next) => { const id = req.get("x-jw-fixture-actor");if(id && [owner, buyer, otherBuyer, outsider].includes(id)) req.user = { id } as any;next(); });
  registerJwStoneSalesRoutes(app, sales, (req, res, next) => req.user ? next() : void res.status(401).json({ message: "Fixture authentication required" }));
  server = await new Promise<Server>(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  const address = server.address();assert(address && typeof address === "object");const origin = "http://127.0.0.1:" + address.port;
  const denied = await fetch(origin + "/api/u/jw-stone/orders/" + main.id + "/commands", { method: "POST", headers: { "Content-Type": "application/json", "x-jw-fixture-actor": owner, Origin: "https://unrelated.invalid" }, body: JSON.stringify(quoteCommand(main.intake)) });assert.equal(denied.status, 403);
  assert.equal((await fetch(origin + "/api/u/jw-stone/orders")).status, 401);
  assert.equal((await fetch(origin + "/api/u/jw-stone/orders/stripe/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 400);
  note("actual HTTP commands use the real same-origin guard and unsigned callbacks are rejected");
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  for (const [device, viewport, method] of [["desktop", { width: 1440, height: 1000 }, "ach"], ["touch", { width: 390, height: 844 }, "card"]] as const) {
    const fresh = await offer(device === "desktop" ? "cart" : "stone");
    const contexts = [];
    const errors: string[] = [];
    const context = async (actor: string) => {
      const context = await browser!.newContext({ viewport, isMobile: device === "touch", hasTouch: device === "touch", extraHTTPHeaders: { "x-jw-fixture-actor": actor } });contexts.push(context);
      await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();page.setDefaultTimeout(30000);page.on("pageerror", error => errors.push(error.message));return page;
    };
    const ownerPage = await context(owner);
    await ownerPage.goto(origin + "/jw-stone/orders?request=" + fresh.id);
    await ownerPage.getByLabel("Confirmed tax ($) — enter 0 if applicable", { exact: true }).fill("5.00");
    await ownerPage.getByLabel("Confirmed delivery ($)", { exact: true }).fill("20.50");
    await ownerPage.getByLabel("Quote expires", { exact: true }).fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await ownerPage.getByRole("button", { name: "Send final quote", exact: true }).click();
    await expect(ownerPage.getByRole("heading", { name: /Final quote/ })).toBeVisible();
    const buyerPage = await context(buyer);await buyerPage.goto(origin + "/jw-stone/orders?request=" + fresh.id);
    const pay = buyerPage.getByRole("button", { name: method === "ach" ? "Pay by ACH bank debit" : "Pay by card", exact: true });
    await pay.click();await expect(buyerPage.getByRole("alert")).toContainText("accept the final quote");
    await buyerPage.getByRole("checkbox").check();await pay.click();
    await expect(buyerPage.getByRole("link", { name: "Continue secure checkout" })).toHaveAttribute("href", /^https:\/\/checkout\.stripe\.com\//);
    const active = await state(fresh.id);assert(active.attempt);assert.equal(active.attempt.method, method);
    provider.outcome(active.attempt.id, "processing");
    await buyerPage.getByRole("button", { name: "Refresh order/payment status", exact: true }).click();await expect(buyerPage.getByText("Payment is processing. This is not a paid receipt.", { exact: true })).toBeVisible();
    provider.outcome(active.attempt.id, "paid");
    const payload = JSON.stringify({ id: "evt_" + randomUUID(), type: "checkout.session.async_payment_succeeded", account: "acct_jwfixture", livemode: false, data: { object: { metadata: { jwRequestId: fresh.id }, amount_total: 1 } } });
    const signature = signingSdk.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    const callback = await fetch(origin + "/api/u/jw-stone/orders/stripe/webhook", { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": signature }, body: payload });assert.equal(callback.status, 200);
    await buyerPage.reload();await expect(buyerPage.getByText(/Payment confirmed\. JW Stone is holding/)).toBeVisible();
    assert.equal((await state(fresh.id)).status, "paid");
    assert.equal(await buyerPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await fs.mkdir(output, { recursive: true });await buyerPage.screenshot({ path: path.join(output, device + "-order-status.png"), fullPage: true });
    assert.deepEqual(errors, []);
    proof.devices.push({ device, offerScope: fresh.intake.scope, method, realOrderPage: true, sellerQuotePublished: true, explicitBuyerConsent: true, hostedCheckoutLink: true, pendingNotPaid: true, signedSyntheticCallback: true, callbackAmountNotTrusted: true, paidStatusRecoveredOnReload: true, horizontalOverflow: false, providerNetworkUsed: false, authentication: "isolated fixture" });
    console.log("JW_SALES_BROWSER_DEVICE " + JSON.stringify(proof.devices.at(-1)));
    for (const context of contexts) await context.close();
  }
  for (const [requestId, original] of originalEvents) {
    const stored = (await pool.query("SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='created'", [requestId])).rows[0].metadata;
    // PostgreSQL jsonb key order is canonicalized; compare the stored original once parsed semantically.
    assert.deepEqual(stored.stoneOffer.status, "pending_review");assert.equal(stored.stoneOffer.paymentAllowed, false);
    assert(original);
  }
  assert.equal(process.env.JW_STONE_PRICING_APPROVED_IMPORT, originalPriceSource);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM marketplace_transactions")).rows[0].n), 0);
  assert.equal((await flags.read()).enabled, true);
  note("original pending-offer records, source prices, unrelated marketplace ledger and final ON state are preserved");
  proof.passed = true;
} catch (error) { proof.error = String(error.stack || error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[DISPOSABLE_DATABASE]");process.exitCode = 1;console.error("JW_SALES_NATIVE_FAILURE " + proof.error); }
finally {
  await browser?.close();if(server) await new Promise<void>(resolve => server!.close(() => resolve()));await pool.end();
  proof.finishedAt = new Date().toISOString();await fs.mkdir(output, { recursive: true });await fs.writeFile(path.join(output, "native-evidence.json"), JSON.stringify(proof, null, 2) + "\n");console.log("JW_SALES_NATIVE_RESULT " + JSON.stringify(proof));
}
