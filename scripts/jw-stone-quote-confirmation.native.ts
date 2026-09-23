import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { Server } from "node:http";
import type { JwStoneCheckoutProvider } from "../server/services/jwStoneCheckoutProvider";

assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.JW_SALES_FIXTURE, "true");
const url = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/ts_jw_sales_test");
const output = path.resolve(process.env.JW_SALES_OUTPUT || "test-results/jw-sales");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const keep = new Set([
  "PATH",
  "HOME",
  "TMPDIR",
  "NODE_ENV",
  "TEST_DATABASE_URL",
  "PLAYWRIGHT_BROWSERS_PATH",
  "LD_LIBRARY_PATH",
]);
for (const key of Object.keys(process.env)) if (!keep.has(key)) delete process.env[key];
const { default: dotenv } = await import("dotenv");
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
process.env.DATABASE_URL = url.href;
process.env.ALLOW_INSECURE_TEST_DATABASE = "true";
const { db, pool } = await import("../server/db");
const schema = await import("../shared/schema");
const { JwStoneSales } = await import("../server/services/jwStoneSales");
const { registerJwStoneSalesRoutes } = await import("../server/routes/jw-stone-sales");
const { queueJwStoneSaleNotifications } =
  await import("../server/services/jwStoneSaleNotifications");
const { initialJwStoneSale } = await import("../shared/jwStoneCheckout");
const { default: express } = await import("express");
const { chromium, expect } = await import("@playwright/test");
const proof = {
  head,
  passed: false,
  productionWrites: false,
  providerNetworkUsed: false,
  scope:
    "Fourth process, actual sale routes/service and persisted canonical loopback database; fixture authentication, deliberately unavailable payment provider and no external email.",
  checks: [] as string[],
  devices: [] as Record<string, unknown>[],
  error: "",
  finishedAt: "",
};
const note = (name: string) => {
  proof.checks.push(name);
  console.log("JW_QUOTE_NATIVE_CHECK " + name);
};
const reject = (work: () => Promise<unknown>, code: string) =>
  assert.rejects(work, (error: any) => error.code === code, code);
let server: Server | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let failMerchant = false,
  paymentCalls = 0;
const provider: JwStoneCheckoutProvider = {
  merchant() {
    if (failMerchant) throw new Error("Synthetic unavailable merchant configuration");
    return null;
  },
  async methods() {
    return [];
  },
  async create() {
    paymentCalls++;
    throw new Error("Quote confirmation must not create a payment");
  },
  async retrieve() {
    paymentCalls++;
    throw new Error("Quote confirmation must not retrieve a payment");
  },
  async webhookRequest() {
    throw new Error("No payment callbacks belong to this proof");
  },
};
const sales = new JwStoneSales(pool, provider);
try {
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    "ts_jw_sales_test"
  );
  const found = await pool.query(`SELECT wr.created_by_user_id AS buyer, p.id AS profile,
    b.id AS seller, b.owner_user_id AS owner, e.metadata
    FROM work_requests wr JOIN profiles p ON p.id=wr.source_ref_id
    JOIN businesses b ON b.id=p.business_id
    JOIN work_request_events e ON e.work_request_id=wr.id AND e.type='created'
    WHERE p.slug='jw-stone' AND wr.created_by_user_id LIKE 'jw-sales-buyer-%'
      AND e.metadata->>'requestType'='make_offer'
    ORDER BY wr.created_at,wr.id LIMIT 1`);
  assert.equal(
    found.rows.length,
    1,
    "Reuse the preceding canonical native fixture, not new production identities"
  );
  const fixture = found.rows[0],
    buyer: string = fixture.buyer,
    owner: string = fixture.owner;
  const outsider = (
    await pool.query("SELECT id FROM users WHERE id LIKE 'jw-sales-outsider-%' LIMIT 1")
  ).rows[0]?.id;
  assert(outsider);
  const inventory = async () =>
    (
      await pool.query(
        "SELECT id,quantity,held_quantity,version FROM stone_inventory_positions WHERE holder_business_id=$1 ORDER BY id",
        [fixture.seller]
      )
    ).rows;
  const initialStock = await inventory();
  async function offer() {
    const [row] = await db
      .insert(schema.workRequests)
      .values({
        createdByUserId: buyer,
        title: "Synthetic quote confirmation",
        description: "Isolated no-payment acceptance",
        category: "business_request",
        scope: "personal",
        source: "direct_connect",
        sourceRefId: fixture.profile,
        status: "routed",
        visibility: "private",
        exposureMode: "guided",
        competitionMode: "none",
      })
      .returning();
    await db
      .insert(schema.workRequestEvents)
      .values({
        workRequestId: row.id,
        type: "created",
        actorUserId: buyer,
        metadata: fixture.metadata,
      });
    return row.id;
  }
  const notices = async (id: string) =>
    (
      await pool.query(
        `SELECT n.id,n.user_id,n.title,n.metadata,j.status AS job_status,j.retry_count,
    (SELECT count(*)::int FROM notification_delivery_log d WHERE d.notification_id=n.id AND d.delivery_method='in_app') AS inbox_receipts
    FROM notifications n JOIN notification_jobs j ON j.id='notification-email:' || n.id
    WHERE n.metadata->>'workRequestId'=$1 AND n.metadata->>'source'='jw_stone_sale'
    ORDER BY (n.metadata->>'revision')::int`,
        [id]
      )
    ).rows;
  const read = async (id: string) => (await sales.read(id, buyer)).state;
  const quote = (revision = 0) => ({
    action: "quote",
    operationId: randomUUID(),
    expectedRevision: revision,
    decision: "accept_offer",
    materialCents: fixture.metadata.stoneOffer.offeredTotalCents,
    taxCents: 500,
    deliveryCents: 2050,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    notes: "Synthetic explicit quote terms",
  });
  const acceptance = (state: any) => ({
    action: "accept_quote",
    operationId: randomUUID(),
    expectedRevision: state.revision,
    quoteId: state.quote.id,
    totalCents: state.quote.totalCents,
    acceptFinalQuote: true,
  });
  const requestId = await offer(),
    command = quote();
  failMerchant = true;
  await sales.command(requestId, owner, command);
  const first = await read(requestId);
  assert(first.quote);
  let alerts = await notices(requestId);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].user_id, buyer);
  assert.equal(alerts[0].metadata.kind, "quote_issued");
  assert.equal(alerts[0].inbox_receipts, 1);
  assert.equal(alerts[0].job_status, "pending");
  await sales.command(requestId, owner, command);
  assert.equal((await notices(requestId)).length, 1);
  note(
    "Seller quote persists one buyer inbox alert and durable email intent, even with unavailable merchant configuration"
  );

  const accept = acceptance(first);
  await reject(() => sales.command(requestId, owner, accept), "jw_buyer_required");
  await reject(() => sales.command(requestId, outsider, accept), "jw_order_not_found");
  await reject(
    () => sales.command(requestId, buyer, { ...accept, quoteId: randomUUID() }),
    "jw_quote_changed"
  );
  await reject(
    () => sales.command(requestId, buyer, { ...accept, totalCents: accept.totalCents - 1 }),
    "jw_quote_changed"
  );
  await assert.rejects(() =>
    sales.command(requestId, buyer, { ...accept, acceptFinalQuote: false })
  );
  await sales.command(requestId, buyer, accept);
  const confirmed = await read(requestId);
  assert.deepEqual(confirmed.quoteAcceptance, {
    quoteId: first.quote.id,
    quoteRevision: first.quote.revision,
    totalCents: first.quote.totalCents,
    acceptedBy: buyer,
    acceptedAt: confirmed.quoteAcceptance?.acceptedAt,
  });
  assert(Number.isFinite(Date.parse(confirmed.quoteAcceptance!.acceptedAt)));
  assert.equal(confirmed.status, "quoted");
  assert.equal(confirmed.attempt, null);
  assert.equal(paymentCalls, 0);
  alerts = await notices(requestId);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[1].user_id, owner);
  assert.equal(alerts[1].metadata.kind, "quote_confirmed");
  await sales.command(requestId, buyer, accept);
  await sales.command(requestId, buyer, acceptance(confirmed));
  assert.equal((await notices(requestId)).length, 2);
  assert.equal((await read(requestId)).revision, confirmed.revision);
  await reject(
    () => sales.command(requestId, buyer, { ...accept, totalCents: accept.totalCents + 1 }),
    "jw_command_conflict"
  );
  note(
    "Only the actual buyer confirms the exact quote; retry and repeated confirmation cannot duplicate notifications or payment effects"
  );

  const counter = {
    ...quote(confirmed.revision),
    decision: "counter_offer",
    materialCents: command.materialCents + 200,
  };
  await sales.command(requestId, owner, counter);
  const revised = await read(requestId);
  assert(revised.quote);
  assert.equal(revised.quoteAcceptance, null);
  await reject(
    () => sales.command(requestId, buyer, { ...acceptance(revised), quoteId: first.quote.id }),
    "jw_quote_changed"
  );
  assert.equal((await notices(requestId))[2].title, "JW Stone sent a counteroffer");
  await sales.command(requestId, buyer, acceptance(revised));
  const acceptedAgain = await read(requestId);
  await sales.reconcile(requestId, buyer);
  assert.equal((await notices(requestId)).length, 4);
  assert.equal(paymentCalls, 0);
  await sales.command(requestId, owner, {
    action: "decline",
    operationId: randomUUID(),
    expectedRevision: acceptedAgain.revision,
    notes: "Synthetic supplier decline",
  });
  assert.equal((await read(requestId)).quoteAcceptance, null);
  assert.equal((await notices(requestId))[4].metadata.kind, "request_declined");
  note(
    "Counteroffer invalidates prior consent, alerts the buyer, and requires new exact confirmation; decline clears consent and alerts once"
  );

  const faultId = await offer();
  await pool.query(`CREATE FUNCTION jw_quote_fault_test() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.template_data->>'notificationId' LIKE 'jw-order-update:%' THEN
      RAISE EXCEPTION 'Synthetic notification outbox write failed'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER jw_quote_fault_test BEFORE INSERT ON notification_jobs FOR EACH ROW EXECUTE FUNCTION jw_quote_fault_test()`);
  try {
    await assert.rejects(() => sales.command(faultId, owner, quote()), /Synthetic notification/);
  } finally {
    await pool.query(
      "DROP TRIGGER jw_quote_fault_test ON notification_jobs; DROP FUNCTION jw_quote_fault_test()"
    );
  }
  assert.equal(
    (
      await pool.query("SELECT count(*)::int AS n FROM jw_stone_sales WHERE request_id=$1", [
        faultId,
      ])
    ).rows[0].n,
    0
  );
  assert.equal(
    (
      await pool.query("SELECT count(*)::int AS n FROM jw_stone_sale_events WHERE request_id=$1", [
        faultId,
      ])
    ).rows[0].n,
    0
  );
  assert.equal((await notices(faultId)).length, 0);
  note(
    "A real outbox insert failure rolls back the quote, event, inbox notification and channel intents together"
  );

  await sales.command(faultId, owner, quote());
  const faultState = await read(faultId),
    faultAlerts = await notices(faultId);
  for (const terminal of ["completed", "uncertain"]) {
    await pool.query(
      "UPDATE notification_jobs SET status=$2,retry_count=3 WHERE id='notification-email:' || $1",
      [faultAlerts[0].id, terminal]
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await queueJwStoneSaleNotifications(
        client,
        { requestId: faultId, buyerId: buyer, sellerUserId: owner },
        initialJwStoneSale(),
        faultState as any
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const after = await notices(faultId);
    assert.equal(after.length, 1);
    assert.equal(after[0].job_status, terminal);
    assert.equal(after[0].retry_count, 3);
  }
  note(
    "Duplicate enrollment preserves completed and uncertain email jobs rather than resetting their delivery history"
  );

  await pool.query("UPDATE work_requests SET status='cancelled' WHERE id=$1", [faultId]);
  await reject(() => sales.command(faultId, buyer, acceptance(faultState)), "jw_request_closed");
  await pool.query("UPDATE work_requests SET status='routed' WHERE id=$1", [faultId]);
  await pool.query(
    "UPDATE profile_account_entitlements e SET status='revoked' FROM profile_accounts a WHERE e.profile_account_id=a.id AND a.owner_user_id=$1 AND e.product_key='jw_stone_member_pricing'",
    [buyer]
  );
  try {
    await reject(
      () => sales.command(faultId, buyer, acceptance(faultState)),
      "jw_membership_required"
    );
  } finally {
    await pool.query(
      "UPDATE profile_account_entitlements e SET status='pending_verification' FROM profile_accounts a WHERE e.profile_account_id=a.id AND a.owner_user_id=$1 AND e.product_key='jw_stone_member_pricing'",
      [buyer]
    );
  }
  const expiredId = await offer(),
    expiring = { ...quote(), expiresAt: new Date(Date.now() + 2000).toISOString() };
  await sales.command(expiredId, owner, expiring);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  const expiredState = await read(expiredId);
  await reject(() => sales.command(expiredId, buyer, acceptance(expiredState)), "jw_quote_expired");
  note("Closed requests, revoked memberships and expired quotes cannot gain buyer confirmation");
  failMerchant = false;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const value = req.get("x-jw-fixture-actor");
    if ([buyer, owner, outsider].includes(value)) req.user = { id: value } as any;
    next();
  });
  registerJwStoneSalesRoutes(app, sales, (req, res, next) =>
    req.user ? next() : void res.status(401).json({ message: "Fixture sign-in required" })
  );
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const origin = "http://127.0.0.1:" + address.port;
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["touch", { width: 390, height: 844 }],
  ] as const) {
    const id = await offer();
    await sales.command(id, owner, quote());
    const context = await browser.newContext({
      viewport,
      isMobile: device === "touch",
      hasTouch: device === "touch",
      extraHTTPHeaders: { "x-jw-fixture-actor": buyer },
    });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
    );
    const page = await context.newPage(),
      posts: string[] = [],
      errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "POST")
        posts.push(request.postDataJSON()?.action || new URL(request.url()).pathname);
    });
    await page.goto(origin + "/jw-stone/orders?request=" + id);
    const click = async (name: string) => {
      const button = page.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      if (device === "touch") await button.tap();
      else await button.click();
    };
    await expect(
      page.getByRole("button", { name: "Confirm quote without payment", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Pay by/ })).toHaveCount(0);
    await click("Confirm quote without payment");
    await expect(page.getByRole("alert")).toContainText("accept the final quote");
    assert.equal(posts.length, 0);
    await page.getByRole("checkbox").check();
    await click("Confirm quote without payment");
    await expect(page.getByTestId("jw-quote-confirmed")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("jw-quote-confirmed")).toBeVisible();
    assert.equal((await notices(id)).length, 2);
    assert.equal((await read(id)).attempt, null);
    const confirmedState = await read(id);
    await sales.command(id, owner, {
      ...quote(confirmedState.revision),
      decision: "counter_offer",
      materialCents: command.materialCents + 500,
    });
    await page.reload();
    await expect(page.getByTestId("jw-quote-confirmed")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Confirm quote without payment", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    assert.deepEqual(posts, ["accept_quote"]);
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2),
      false
    );
    await fs.mkdir(output, { recursive: true });
    await page.screenshot({
      path: path.join(output, device + "-quote-confirmation.png"),
      fullPage: true,
    });
    proof.devices.push({
      device,
      actualRoutes: true,
      methodsUnavailable: true,
      explicitConsent: true,
      persistedConfirmation: true,
      reloadRecovery: true,
      revisedQuoteRequiresNewConsent: true,
      noPayment: true,
    });
    await context.close();
  }
  assert.equal(paymentCalls, 0);
  assert.deepEqual(await inventory(), initialStock);
  note(
    "Desktop and touch confirm without payment, recover on reload, and require new consent after changed terms; inventory is unchanged"
  );
  proof.passed = true;
} catch (error) {
  proof.error = String(error instanceof Error ? error.stack : error).replace(
    /postgres(?:ql)?:\/\/[^\s"']+/g,
    "[DISPOSABLE_DATABASE]"
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await pool.end();
  proof.finishedAt = new Date().toISOString();
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    path.join(output, "quote-confirmation-evidence.json"),
    JSON.stringify(proof, null, 2)
  );
  console.log("JW_QUOTE_NATIVE_RESULT " + JSON.stringify(proof));
}
assert.equal(proof.passed, true, "Native quote confirmation failed");
