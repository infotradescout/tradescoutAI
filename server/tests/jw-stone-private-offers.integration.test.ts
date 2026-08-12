import express, { type Express } from "express";
import request, { type SuperAgentTest } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.JW_STONE_OUTBOX_WORKER_DISABLED = "1";
process.env.SESSION_SECRET = "jw-stone-private-offer-test-secret-value";

const DATABASE_URL = String(process.env.TEST_DATABASE_URL || "");
const describeDatabase = DATABASE_URL ? describe : describe.skip;

describeDatabase("JW Stone private offers integration", () => {
  let app: Express;
  let pool: typeof import("../db").pool;
  let registerRoutes: typeof import("../routes/jw-stone-express").registerJwStoneExpressRoutes;
  let inventory: typeof import("../jw-stone-express/catalog").JW_STONE_OFFER_INVENTORY;
  let decrypt: typeof import("../jw-stone-express/security").decryptOutboxSecret;
  let drainOutbox: typeof import("../jw-stone-express/outbox").drainJwStoneOutbox;
  let emailService: typeof import("../services/emailService").emailService;

  const origin = "http://jwstone.test";
  const host = "jwstone.test";
  const idem = (label: string) => `jw-test-${label}-${crypto.randomUUID()}`;

  function json(
    agent: SuperAgentTest | ReturnType<typeof request>,
    method: "post" | "patch",
    path: string
  ) {
    return agent[method](path)
      .set("Host", host)
      .set("Origin", origin)
      .set("Content-Type", "application/json");
  }

  async function verificationTokenFor(email: string): Promise<string> {
    const result = await pool.query(
      `select o.secret_envelope
       from jw_stone_email_outbox o
       join jw_stone_express_accounts a on a.id = o.account_id
       where a.email_normalized = $1 and o.purpose = 'jw_stone_express_verification'
       order by o.created_at desc limit 1`,
      [email]
    );
    const actionUrl = decrypt(result.rows[0].secret_envelope);
    const fragment = new URL(actionUrl).hash.slice(1);
    const params = new URLSearchParams(fragment);
    return String(params.get("token") || "");
  }

  async function createVerifiedAccount(args: {
    email: string;
    phone: string;
    amount: string;
    target: { kind: "stone" | "container"; ref: string };
  }) {
    const agent = request.agent(app);
    const registration = await json(agent, "post", "/api/jw-stone/express/register")
      .set("Idempotency-Key", idem("register"))
      .send({
        legalName: `Customer ${args.email}`,
        email: args.email,
        phone: args.phone,
        isBusiness: false,
        businessName: null,
        password: "safe-password-123",
        passwordConfirmation: "safe-password-123",
        offer: { target: args.target, amount: args.amount },
      });
    expect(registration.status).toBe(202);

    const token = await verificationTokenFor(args.email);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const verified = await json(agent, "post", "/api/jw-stone/express/verification/confirm")
      .set("Idempotency-Key", idem("verify"))
      .send({ token });
    expect(verified.status).toBe(200);
    const setCookie = Array.isArray(verified.headers["set-cookie"])
      ? verified.headers["set-cookie"][0]
      : verified.headers["set-cookie"];
    const cookie = String(setCookie || "").split(";")[0];
    expect(cookie).toContain("jw-express.sid=");
    const session = await agent.get("/api/jw-stone/express/session").set("Host", host);
    expect(session.body.account.emailVerified).toBe(true);
    return { agent, cookie, csrf: String(session.body.csrfToken), account: session.body.account };
  }

  beforeAll(async () => {
    ({ pool } = await import("../db"));
    ({ registerJwStoneExpressRoutes: registerRoutes } = await import("../routes/jw-stone-express"));
    ({ JW_STONE_OFFER_INVENTORY: inventory } = await import("../jw-stone-express/catalog"));
    ({ decryptOutboxSecret: decrypt } = await import("../jw-stone-express/security"));
    ({ drainJwStoneOutbox: drainOutbox } = await import("../jw-stone-express/outbox"));
    ({ emailService } = await import("../services/emailService"));

    app = express();
    app.use(express.json({ limit: "64kb" }));
    app.use((req: any, _res, next) => {
      const anonymous = req.get("X-Test-Auth") === "none";
      req.isAuthenticated = () => !anonymous;
      req.user = anonymous
        ? undefined
        : { id: "jw-test-operator", role: "super_admin", activeRole: "super_admin" };
      next();
    });
    registerRoutes(app);
  });

  beforeEach(async () => {
    await pool.query(`
      truncate table
        jw_stone_email_outbox_attempts,
        jw_stone_email_outbox,
        jw_stone_offer_events,
        jw_stone_private_offer_versions,
        jw_stone_private_offers,
        jw_stone_idempotency_receipts,
        jw_stone_express_account_tokens,
        jw_stone_express_sessions,
        jw_stone_offer_settings,
        jw_stone_containers,
        jw_stone_express_accounts
      restart identity cascade
    `);
    await pool.query(`delete from rate_limit_buckets where bucket_key like 'jw-express:%'`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("captures an invisible pending offer, verifies it once, and preserves the JW-only boundary", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    const operatorAccess = await request(app)
      .get("/api/admin/jw-stone/offers/access")
      .set("Host", host);
    expect(operatorAccess.body).toEqual({ authorized: true, operatorRole: "super_admin" });
    const resolved = await json(request(app), "post", "/api/jw-stone/offer-targets/resolve").send({
      shareSlug: named.shareSlug,
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.target).toMatchObject({
      kind: "stone",
      ref: named.publicRef,
      acceptingOffers: true,
      minimumAmount: null,
    });

    const agent = request.agent(app);
    const registration = await json(agent, "post", "/api/jw-stone/express/register")
      .set("Idempotency-Key", idem("first-register"))
      .send({
        legalName: "Jamie Stone",
        email: "jamie@example.com",
        phone: "+18505550101",
        isBusiness: true,
        businessName: "Jamie's Surfaces",
        password: "safe-password-123",
        passwordConfirmation: "safe-password-123",
        offer: { target: { kind: "stone", ref: named.publicRef }, amount: "1250.00" },
      });
    expect(registration.status).toBe(202);
    expect(registration.headers["set-cookie"].join(";")).toContain("jw-express.sid=");

    const pending = await pool.query(
      `select o.id, v.state, v.submitted_at, a.email_verified_at
       from jw_stone_private_offers o
       join jw_stone_private_offer_versions v on v.id = o.current_version_id
       join jw_stone_express_accounts a on a.id = o.account_id`
    );
    expect(pending.rows[0]).toMatchObject({
      state: "pending_verification",
      submitted_at: null,
      email_verified_at: null,
    });

    const hiddenEvents = await request(app)
      .get(`/api/admin/jw-stone/offers/${String(pending.rows[0].id)}/events`)
      .set("Host", host);
    expect(hiddenEvents.status).toBe(404);

    const hidden = await request(app).get("/api/admin/jw-stone/offers").set("Host", host);
    expect(hidden.status).toBe(200);
    expect(hidden.body.offers).toEqual([]);

    const outbox = await pool.query(
      `select recipient_normalized, template_payload::text as payload, secret_envelope::text as envelope
       from jw_stone_email_outbox where purpose = 'jw_stone_express_verification'`
    );
    expect(outbox.rows[0].payload).not.toContain("token");
    expect(outbox.rows[0].payload).not.toContain("http");
    expect(outbox.rows[0].envelope).not.toContain("jw-express-action");

    const token = await verificationTokenFor("jamie@example.com");
    const verified = await json(agent, "post", "/api/jw-stone/express/verification/confirm")
      .set("Idempotency-Key", idem("first-verify"))
      .send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.activatedOffers).toBe(1);

    const reused = await json(agent, "post", "/api/jw-stone/express/verification/confirm")
      .set("Idempotency-Key", idem("second-verify"))
      .send({ token });
    expect(reused.status).toBe(400);

    const visible = await request(app).get("/api/admin/jw-stone/offers").set("Host", host);
    expect(visible.body.offers).toHaveLength(1);
    expect(visible.body.offers[0]).toMatchObject({
      status: "submitted",
      maskedContact: { email: "j***@example.com", phone: "***-***-0101" },
    });
    expect(JSON.stringify(visible.body)).not.toContain("jamie@example.com");

    const own = await agent.get("/api/jw-stone/express/offers").set("Host", host);
    expect(own.body.offers[0]).toMatchObject({
      offerRef: expect.any(String),
      status: "submitted",
      amount: "1250.00",
      target: { ref: named.publicRef },
    });

    const foreignKeys = await pool.query(
      `select pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conrelid::regclass::text like 'jw_stone_%' and contype = 'f'`
    );
    expect(foreignKeys.rows.map((row) => row.definition).join("\n")).not.toMatch(
      /references users/i
    );
  });

  it("replays login with one deterministic session and rejects a changed request hash", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    await createVerifiedAccount({
      email: "login@example.com",
      phone: "+18505550119",
      amount: "1400.00",
      target: { kind: "stone", ref: named.publicRef },
    });
    const before = Number(
      (await pool.query(`select count(*)::int as count from jw_stone_express_sessions`)).rows[0]
        .count
    );
    const key = idem("login-replay");
    const body = { email: "login@example.com", password: "safe-password-123" };

    const first = await json(request(app), "post", "/api/jw-stone/express/login")
      .set("Idempotency-Key", key)
      .send(body);
    const replay = await json(request(app), "post", "/api/jw-stone/express/login")
      .set("Idempotency-Key", key)
      .send(body);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    const firstCookie = String(first.headers["set-cookie"]?.[0] || "").split(";")[0];
    const replayCookie = String(replay.headers["set-cookie"]?.[0] || "").split(";")[0];
    expect(firstCookie).toContain("jw-express.sid=");
    expect(replayCookie).toBe(firstCookie);
    const after = Number(
      (await pool.query(`select count(*)::int as count from jw_stone_express_sessions`)).rows[0]
        .count
    );
    expect(after).toBe(before + 1);

    const conflict = await json(request(app), "post", "/api/jw-stone/express/login")
      .set("Idempotency-Key", key)
      .send({ ...body, email: "LOGIN@example.com" });
    expect(conflict.status).toBe(409);
  });

  it("rejects anonymous operator access and customer mutations without CSRF proof", async () => {
    const anonymous = await request(app)
      .get("/api/admin/jw-stone/offers/access")
      .set("Host", host)
      .set("X-Test-Auth", "none");
    expect([401, 403]).toContain(anonymous.status);

    const named = inventory.find((stone) => !stone.anonymous)!;
    const customer = await createVerifiedAccount({
      email: "csrf@example.com",
      phone: "+18505550123",
      amount: "1350.00",
      target: { kind: "stone", ref: named.publicRef },
    });
    const offers = await customer.agent.get("/api/jw-stone/express/offers").set("Host", host);
    const offerId = String(offers.body.offers[0].offerRef);
    const missingCsrf = await json(
      customer.agent,
      "post",
      `/api/jw-stone/express/offers/${offerId}/revisions`
    )
      .set("Idempotency-Key", idem("missing-csrf"))
      .send({ amount: "1450.00" });
    expect(missingCsrf.status).toBe(403);
  });

  it("enforces public minimums, masked contact reveal, and deterministic container award priority", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    const setMinimum = await json(
      request(app),
      "patch",
      `/api/admin/jw-stone/offers/stone-settings/${encodeURIComponent(named.sourceRef)}`
    )
      .set("Idempotency-Key", idem("stone-minimum"))
      .send({ acceptingOffers: true, minimumOffer: "1000.00" });
    expect(setMinimum.status).toBe(200);

    const below = request.agent(app);
    const rejected = await json(below, "post", "/api/jw-stone/express/register")
      .set("Idempotency-Key", idem("below-minimum"))
      .send({
        legalName: "Below Minimum",
        email: "below@example.com",
        phone: "+18505550102",
        isBusiness: false,
        businessName: null,
        password: "safe-password-123",
        passwordConfirmation: "safe-password-123",
        offer: { target: { kind: "stone", ref: named.publicRef }, amount: "999.99" },
      });
    expect(rejected.status).toBe(422);
    expect(
      await pool.query(`select count(*)::int as count from jw_stone_express_accounts`)
    ).toMatchObject({ rows: [{ count: 0 }] });

    const created = await json(request(app), "post", "/api/admin/jw-stone/offers/containers")
      .set("Idempotency-Key", idem("container-create"))
      .send({
        title: "Pensacola Container 1",
        description: "Mixed current inventory.",
        acceptingOffers: true,
        minimumOffer: null,
      });
    expect(created.status).toBe(201);
    const containerId = String(created.body.id);
    const published = await json(
      request(app),
      "post",
      `/api/admin/jw-stone/offers/containers/${containerId}/publish`
    )
      .set("Idempotency-Key", idem("container-publish"))
      .send({});
    expect(published.status).toBe(200);

    const publicContainers = await request(app).get("/api/jw-stone/containers").set("Host", host);
    expect(publicContainers.body.containers).toHaveLength(1);
    const containerRef = String(publicContainers.body.containers[0].ref);

    const low = await createVerifiedAccount({
      email: "low@example.com",
      phone: "+18505550103",
      amount: "2000.00",
      target: { kind: "container", ref: containerRef },
    });
    const high = await createVerifiedAccount({
      email: "high@example.com",
      phone: "+18505550104",
      amount: "3000.00",
      target: { kind: "container", ref: containerRef },
    });

    const queue = await request(app)
      .get("/api/admin/jw-stone/offers?targetType=container")
      .set("Host", host);
    expect(queue.body.offers.map((offer: any) => offer.amountDisplay)).toEqual([
      "$3,000.00",
      "$2,000.00",
    ]);
    expect(queue.body.offers.map((offer: any) => offer.containerPriority.position)).toEqual([1, 2]);
    const highOfferId = String(queue.body.offers[0].id);
    const lowOfferId = String(queue.body.offers[1].id);

    const lowerAcceptance = await json(
      request(app),
      "post",
      `/api/admin/jw-stone/offers/${lowOfferId}/accept`
    )
      .set("Idempotency-Key", idem("accept-low"))
      .send({});
    expect(lowerAcceptance.status).toBe(409);

    const reveal = await json(
      request(app),
      "post",
      `/api/admin/jw-stone/offers/${highOfferId}/review/reveal-contact`
    )
      .set("Idempotency-Key", idem("reveal-high"))
      .send({});
    expect(reveal.status).toBe(200);
    expect(reveal.body.contact).toEqual({ email: "high@example.com", phone: "+18505550104" });
    const revealEvent = await pool.query(
      `select count(*)::int as count from jw_stone_offer_events
       where offer_id = $1 and event_type = 'contact_revealed_after_review_decision'`,
      [highOfferId]
    );
    expect(revealEvent.rows[0].count).toBe(1);

    const anotherStone = inventory.find(
      (stone) => !stone.anonymous && stone.publicRef !== named.publicRef
    )!;
    const late = await createVerifiedAccount({
      email: "late@example.com",
      phone: "+18505550120",
      amount: "1500.00",
      target: { kind: "stone", ref: anotherStone.publicRef },
    });
    const pending = request.agent(app);
    const pendingRegistration = await json(pending, "post", "/api/jw-stone/express/register")
      .set("Idempotency-Key", idem("pending-container-register"))
      .send({
        legalName: "Pending Container Customer",
        email: "pending-container@example.com",
        phone: "+18505550121",
        isBusiness: false,
        businessName: null,
        password: "safe-password-123",
        passwordConfirmation: "safe-password-123",
        offer: { target: { kind: "container", ref: containerRef }, amount: "2500.00" },
      });
    expect(pendingRegistration.status).toBe(202);
    const pendingToken = await verificationTokenFor("pending-container@example.com");

    const [accepted, concurrentLowAcceptance, lateSubmission, pendingVerification] =
      await Promise.all([
        json(request(app), "post", `/api/admin/jw-stone/offers/${highOfferId}/accept`)
          .set("Idempotency-Key", idem("accept-high"))
          .send({}),
        json(request(app), "post", `/api/admin/jw-stone/offers/${lowOfferId}/accept`)
          .set("Idempotency-Key", idem("accept-low-concurrent"))
          .send({}),
        json(late.agent, "post", "/api/jw-stone/express/offers")
          .set("X-CSRF-Token", late.csrf)
          .set("Idempotency-Key", idem("late-container-submit"))
          .send({ target: { kind: "container", ref: containerRef }, amount: "2500.00" }),
        json(pending, "post", "/api/jw-stone/express/verification/confirm")
          .set("Idempotency-Key", idem("pending-container-verify"))
          .send({ token: pendingToken }),
      ]);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe("accepted");
    expect(concurrentLowAcceptance.status).toBe(409);
    expect([201, 404, 409]).toContain(lateSubmission.status);
    expect(pendingVerification.status).toBe(200);
    expect([0, 1]).toContain(pendingVerification.body.activatedOffers);

    const terminal = await pool.query(
      `select o.id, v.state
       from jw_stone_private_offers o
       join jw_stone_private_offer_versions v on v.id = o.current_version_id
       where o.id = any($1::uuid[]) order by o.id`,
      [[highOfferId, lowOfferId]]
    );
    expect(new Map(terminal.rows.map((row) => [String(row.id), String(row.state)]))).toEqual(
      new Map([
        [highOfferId, "accepted"],
        [lowOfferId, "expired"],
      ])
    );
    const awarded = await pool.query(
      `select status, accepting_offers, awarded_offer_id from jw_stone_containers where id = $1`,
      [containerId]
    );
    expect(awarded.rows[0]).toMatchObject({
      status: "awarded",
      accepting_offers: false,
      awarded_offer_id: highOfferId,
    });
    const remainingEligible = await pool.query(
      `select count(*)::int as count
       from jw_stone_private_offers o
       join jw_stone_private_offer_versions v on v.id = o.current_version_id
       where o.container_id = $1 and v.state in ('submitted', 'under_review')`,
      [containerId]
    );
    expect(remainingEligible.rows[0].count).toBe(0);

    const pendingOffers = await pending.get("/api/jw-stone/express/offers").set("Host", host);
    expect(pendingOffers.body.offers[0].status).toBe("expired");

    const lowOffers = await low.agent.get("/api/jw-stone/express/offers").set("Host", host);
    expect(lowOffers.body.offers[0].status).toBe("expired");
    const highOffers = await high.agent.get("/api/jw-stone/express/offers").set("Host", host);
    expect(highOffers.body.offers[0].status).toBe("accepted");
  });

  it("serializes account closure against operator acceptance without deadlock", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    const customer = await createVerifiedAccount({
      email: "closure-race@example.com",
      phone: "+18505550124",
      amount: "2100.00",
      target: { kind: "stone", ref: named.publicRef },
    });
    const queue = await request(app).get("/api/admin/jw-stone/offers").set("Host", host);
    const offerId = String(queue.body.offers[0].id);

    const [closed, accepted] = await Promise.all([
      json(customer.agent, "post", "/api/jw-stone/express/account/close")
        .set("X-CSRF-Token", customer.csrf)
        .set("Idempotency-Key", idem("closure-race-close"))
        .send({ password: "safe-password-123" }),
      json(request(app), "post", `/api/admin/jw-stone/offers/${offerId}/accept`)
        .set("Idempotency-Key", idem("closure-race-accept"))
        .send({}),
    ]);
    expect(closed.status).toBe(200);
    expect([200, 404, 409]).toContain(accepted.status);

    const final = await pool.query(
      `select a.status as account_status, o.account_id, v.state
       from jw_stone_express_accounts a
       join jw_stone_private_offers o on o.closure_pseudonym = a.closure_pseudonym
       join jw_stone_private_offer_versions v on v.id = o.current_version_id`
    );
    expect(final.rows[0].account_status).toBe("closed");
    expect(final.rows[0].account_id).toBeNull();
    expect(final.rows[0].state).toBe(accepted.status === 200 ? "accepted" : "withdrawn");
  });

  it("irreversibly closes the Express identity while preserving pseudonymous offer facts", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    const customer = await createVerifiedAccount({
      email: "close@example.com",
      phone: "+18505550105",
      amount: "1500.00",
      target: { kind: "stone", ref: named.publicRef },
    });
    const closeKey = idem("close-account");
    const closeBody = { password: "safe-password-123" };
    const closed = await json(customer.agent, "post", "/api/jw-stone/express/account/close")
      .set("X-CSRF-Token", customer.csrf)
      .set("Idempotency-Key", closeKey)
      .send(closeBody);
    expect(closed.status).toBe(200);

    const replayed = await json(request(app), "post", "/api/jw-stone/express/account/close")
      .set("Cookie", customer.cookie)
      .set("X-CSRF-Token", customer.csrf)
      .set("Idempotency-Key", closeKey)
      .send(closeBody);
    expect(replayed.status).toBe(200);
    expect(replayed.body).toEqual(closed.body);

    const conflictingReplay = await json(
      request(app),
      "post",
      "/api/jw-stone/express/account/close"
    )
      .set("Cookie", customer.cookie)
      .set("X-CSRF-Token", customer.csrf)
      .set("Idempotency-Key", closeKey)
      .send({ password: "different-safe-password-123" });
    expect(conflictingReplay.status).toBe(409);

    const account = await pool.query(`select * from jw_stone_express_accounts`);
    expect(account.rows[0]).toMatchObject({
      status: "closed",
      legal_name: null,
      display_name: null,
      email_normalized: null,
      phone_normalized: null,
      is_business: null,
      business_name: null,
      password_hash: null,
    });
    expect(String(account.rows[0].closure_pseudonym)).toMatch(/^[0-9a-f]{64}$/);
    expect(
      (await pool.query(`select count(*)::int as count from jw_stone_express_sessions`)).rows[0]
        .count
    ).toBe(0);
    expect(
      (await pool.query(`select count(*)::int as count from jw_stone_express_account_tokens`))
        .rows[0].count
    ).toBe(0);

    const offer = await pool.query(
      `select o.account_id, o.closure_pseudonym, v.state
       from jw_stone_private_offers o
       join jw_stone_private_offer_versions v on v.id = o.current_version_id`
    );
    expect(offer.rows[0]).toMatchObject({ account_id: null, state: "withdrawn" });
    expect(String(offer.rows[0].closure_pseudonym)).toBe(String(account.rows[0].closure_pseudonym));

    const serializedDatabase = JSON.stringify({
      outbox: (
        await pool.query(`
          select recipient_normalized, template_payload, secret_envelope, provider_message_id,
                 last_error_summary
          from jw_stone_email_outbox
        `)
      ).rows,
      attempts: (
        await pool.query(`
          select error_summary, provider_message_id
          from jw_stone_email_outbox_attempts
        `)
      ).rows,
      events: (await pool.query(`select actor_kind, actor_ref, note from jw_stone_offer_events`))
        .rows,
      receipts: (
        await pool.query(`
          select account_scope_hash, request_hash, response_body
          from jw_stone_idempotency_receipts
        `)
      ).rows,
    });
    expect(serializedDatabase).not.toContain("close@example.com");
    expect(serializedDatabase).not.toContain("18505550105");
    expect(serializedDatabase).not.toContain("jw-express-action");
  });

  it("fences an in-flight email before irreversible account erasure completes", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    const customer = await createVerifiedAccount({
      email: "inflight-close@example.com",
      phone: "+18505550125",
      amount: "2200.00",
      target: { kind: "stone", ref: named.publicRef },
    });
    const selected = await pool.query(
      `select id from jw_stone_email_outbox
       where purpose = 'jw_stone_offer_confirmation' order by created_at desc limit 1`
    );
    const outboxId = String(selected.rows[0].id);
    await pool.query(
      `update jw_stone_email_outbox set status = 'cancelled', cancelled_at = now()
       where id <> $1 and status in ('pending', 'retry')`,
      [outboxId]
    );

    let releaseProvider!: () => void;
    let markProviderStarted!: () => void;
    const providerReleased = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const providerStarted = new Promise<void>((resolve) => {
      markProviderStarted = resolve;
    });
    const ordering: string[] = [];
    const send = vi.spyOn(emailService, "sendEmail").mockImplementation(async () => {
      ordering.push("provider-started");
      markProviderStarted();
      await providerReleased;
      ordering.push("provider-finished");
      return { skipped: false, provider: "brevo", messageId: "brevo-inflight-close" };
    });
    try {
      const draining = drainOutbox(1);
      await providerStarted;
      let closureSettled = false;
      const closing = json(customer.agent, "post", "/api/jw-stone/express/account/close")
        .set("X-CSRF-Token", customer.csrf)
        .set("Idempotency-Key", idem("inflight-close"))
        .send({ password: "safe-password-123" })
        .then((result) => {
          closureSettled = true;
          ordering.push("closure-finished");
          return result;
        });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(closureSettled).toBe(false);
      releaseProvider();
      expect(await draining).toBe(1);
      const closed = await closing;
      expect(closed.status).toBe(200);
      expect(ordering).toEqual(["provider-started", "provider-finished", "closure-finished"]);
      expect(send).toHaveBeenCalledTimes(1);

      const erased = await pool.query(
        `select status, recipient_normalized, template_payload, secret_envelope,
                provider_message_id, claim_id
         from jw_stone_email_outbox where id = $1`,
        [outboxId]
      );
      expect(erased.rows[0]).toMatchObject({
        status: "sent",
        template_payload: {},
        secret_envelope: null,
        provider_message_id: null,
        claim_id: null,
      });
      expect(String(erased.rows[0].recipient_normalized)).toMatch(/^closed\+[0-9a-f]{24}@invalid$/);
      expect(JSON.stringify(erased.rows[0])).not.toContain("inflight-close@example.com");
    } finally {
      releaseProvider();
      send.mockRestore();
    }
  });

  it("records provider failures and exhausts the fixed six-attempt outbox schedule", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    await createVerifiedAccount({
      email: "retry@example.com",
      phone: "+18505550106",
      amount: "1750.00",
      target: { kind: "stone", ref: named.publicRef },
    });
    const selected = await pool.query(
      `select id from jw_stone_email_outbox
       where purpose = 'jw_stone_offer_confirmation' order by created_at desc limit 1`
    );
    const outboxId = String(selected.rows[0].id);
    await pool.query(
      `update jw_stone_email_outbox set status = 'cancelled', cancelled_at = now()
       where id <> $1 and status in ('pending', 'retry')`,
      [outboxId]
    );

    const expectedDelaysMs = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      expect(await drainOutbox(1)).toBe(1);
      const state = await pool.query(
        `select status, attempt_count,
                extract(epoch from (available_at - now())) * 1000 as delay_ms,
                claim_id, claimed_at, claim_expires_at
         from jw_stone_email_outbox where id = $1`,
        [outboxId]
      );
      expect(Number(state.rows[0].attempt_count)).toBe(attempt);
      expect(state.rows[0].claim_id).toBeNull();
      expect(state.rows[0].claimed_at).toBeNull();
      expect(state.rows[0].claim_expires_at).toBeNull();
      if (attempt < 6) {
        expect(state.rows[0].status).toBe("retry");
        const observed = Number(state.rows[0].delay_ms);
        expect(observed).toBeGreaterThan(expectedDelaysMs[attempt - 1] - 5_000);
        expect(observed).toBeLessThanOrEqual(expectedDelaysMs[attempt - 1] + 1_000);
        await pool.query(`update jw_stone_email_outbox set available_at = now() where id = $1`, [
          outboxId,
        ]);
      } else {
        expect(state.rows[0].status).toBe("failed");
      }
    }
    const attempts = await pool.query(
      `select attempt_number, status, error_summary
       from jw_stone_email_outbox_attempts where outbox_id = $1 order by attempt_number`,
      [outboxId]
    );
    expect(attempts.rows).toHaveLength(6);
    expect(attempts.rows.map((row) => row.attempt_number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(attempts.rows.every((row) => row.status === "failed")).toBe(true);
    expect(JSON.stringify(attempts.rows)).not.toContain("retry@example.com");
  });

  it("reschedules an expired worker claim with the fixed delay for its attempt", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    await createVerifiedAccount({
      email: "stale-claim@example.com",
      phone: "+18505550122",
      amount: "1800.00",
      target: { kind: "stone", ref: named.publicRef },
    });
    const selected = await pool.query(
      `select id from jw_stone_email_outbox
       where purpose = 'jw_stone_offer_confirmation' order by created_at desc limit 1`
    );
    const outboxId = String(selected.rows[0].id);
    const claimId = crypto.randomUUID();
    await pool.query(
      `update jw_stone_email_outbox
       set status = case when id = $1 then 'processing' else 'cancelled' end,
           attempt_count = case when id = $1 then 2 else attempt_count end,
           claim_id = case when id = $1 then $2::uuid else claim_id end,
           claimed_at = case when id = $1 then now() - interval '3 minutes' else claimed_at end,
           claim_expires_at = case when id = $1 then now() - interval '1 minute' else claim_expires_at end,
           cancelled_at = case when id = $1 then cancelled_at else now() end
       where status in ('pending', 'retry')`,
      [outboxId, claimId]
    );
    await pool.query(
      `insert into jw_stone_email_outbox_attempts
         (outbox_id, attempt_number, claim_id, status, started_at)
       values ($1, 2, $2, 'processing', now() - interval '3 minutes')`,
      [outboxId, claimId]
    );

    expect(await drainOutbox(1)).toBe(0);
    const state = await pool.query(
      `select status, attempt_count,
              extract(epoch from (available_at - now())) * 1000 as delay_ms,
              claim_id, claimed_at, claim_expires_at
       from jw_stone_email_outbox where id = $1`,
      [outboxId]
    );
    expect(state.rows[0]).toMatchObject({
      status: "retry",
      attempt_count: 2,
      claim_id: null,
      claimed_at: null,
      claim_expires_at: null,
    });
    expect(Number(state.rows[0].delay_ms)).toBeGreaterThan(295_000);
    expect(Number(state.rows[0].delay_ms)).toBeLessThanOrEqual(301_000);
    const attempt = await pool.query(
      `select status, error_summary, completed_at
       from jw_stone_email_outbox_attempts where outbox_id = $1`,
      [outboxId]
    );
    expect(attempt.rows[0]).toMatchObject({
      status: "failed",
      error_summary: "Worker claim expired.",
    });
    expect(attempt.rows[0].completed_at).toBeTruthy();
  });

  it("moves an accepted provider response to sent with JW Stone sender identity", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    await createVerifiedAccount({
      email: "sent@example.com",
      phone: "+18505550107",
      amount: "1900.00",
      target: { kind: "stone", ref: named.publicRef },
    });
    const selected = await pool.query(
      `select id from jw_stone_email_outbox
       where purpose = 'jw_stone_offer_confirmation' order by created_at desc limit 1`
    );
    const outboxId = String(selected.rows[0].id);
    await pool.query(
      `update jw_stone_email_outbox set status = 'cancelled', cancelled_at = now()
       where id <> $1 and status in ('pending', 'retry')`,
      [outboxId]
    );
    const send = vi.spyOn(emailService, "sendEmail").mockResolvedValue({
      skipped: false,
      provider: "brevo",
      messageId: "brevo-jw-test-message",
    });
    try {
      expect(await drainOutbox(1)).toBe(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "sent@example.com",
          from: expect.objectContaining({ name: "JW Stone" }),
          purpose: "jw_stone_offer_confirmation",
        })
      );
      const state = await pool.query(
        `select status, attempt_count, sent_at, provider_message_id, secret_envelope,
                claim_id, claimed_at, claim_expires_at
         from jw_stone_email_outbox where id = $1`,
        [outboxId]
      );
      expect(state.rows[0]).toMatchObject({
        status: "sent",
        attempt_count: 1,
        provider_message_id: "brevo-jw-test-message",
        secret_envelope: null,
        claim_id: null,
        claimed_at: null,
        claim_expires_at: null,
      });
      expect(state.rows[0].sent_at).toBeTruthy();
      const attempt = await pool.query(
        `select status, provider_message_id, completed_at
         from jw_stone_email_outbox_attempts where outbox_id = $1`,
        [outboxId]
      );
      expect(attempt.rows[0]).toMatchObject({
        status: "sent",
        provider_message_id: "brevo-jw-test-message",
      });
      expect(attempt.rows[0].completed_at).toBeTruthy();
    } finally {
      send.mockRestore();
    }
  });

  it("rejects cross-account mutation and makes submit/replay conflict behavior deterministic", async () => {
    const stones = inventory.filter((stone) => !stone.anonymous).slice(0, 3);
    const first = await createVerifiedAccount({
      email: "owner-a@example.com",
      phone: "+18505550108",
      amount: "1100.00",
      target: { kind: "stone", ref: stones[0].publicRef },
    });
    const second = await createVerifiedAccount({
      email: "owner-b@example.com",
      phone: "+18505550109",
      amount: "1200.00",
      target: { kind: "stone", ref: stones[1].publicRef },
    });
    const secondOffers = await second.agent.get("/api/jw-stone/express/offers").set("Host", host);
    const secondOfferId = String(secondOffers.body.offers[0].offerRef);

    const foreignRevision = await json(
      first.agent,
      "post",
      `/api/jw-stone/express/offers/${secondOfferId}/revisions`
    )
      .set("X-CSRF-Token", first.csrf)
      .set("Idempotency-Key", idem("foreign-revision"))
      .send({ amount: "5000.00" });
    expect(foreignRevision.status).toBe(404);

    const replayKey = idem("submit-replay");
    const path = "/api/jw-stone/express/offers";
    const payload = { target: { kind: "stone", ref: stones[2].publicRef }, amount: "1300.00" };
    const submitted = await json(first.agent, "post", path)
      .set("X-CSRF-Token", first.csrf)
      .set("Idempotency-Key", replayKey)
      .send(payload);
    expect(submitted.status).toBe(201);
    const replayed = await json(first.agent, "post", path)
      .set("X-CSRF-Token", first.csrf)
      .set("Idempotency-Key", replayKey)
      .send(payload);
    expect(replayed.status).toBe(201);
    expect(replayed.body).toEqual(submitted.body);
    const conflict = await json(first.agent, "post", path)
      .set("X-CSRF-Token", first.csrf)
      .set("Idempotency-Key", replayKey)
      .send({ ...payload, amount: "1400.00" });
    expect(conflict.status).toBe(409);
    const count = await pool.query(
      `select count(*)::int as count from jw_stone_private_offers
       where account_id = $1 and target_ref = $2`,
      [first.account.accountRef, stones[2].publicRef]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it("allows only one verification-token race winner and keeps duplicate signup generic", async () => {
    const named = inventory.find((stone) => !stone.anonymous)!;
    const signupBody = {
      legalName: "Race Customer",
      email: "race@example.com",
      phone: "+18505550110",
      isBusiness: false,
      businessName: null,
      password: "safe-password-123",
      passwordConfirmation: "safe-password-123",
      offer: { target: { kind: "stone", ref: named.publicRef }, amount: "1600.00" },
    };
    const [first, duplicate] = await Promise.all([
      json(request(app), "post", "/api/jw-stone/express/register")
        .set("Idempotency-Key", idem("race-register"))
        .send(signupBody),
      json(request(app), "post", "/api/jw-stone/express/register")
        .set("Idempotency-Key", idem("duplicate-register"))
        .send({
          ...signupBody,
          password: "different-safe-password",
          passwordConfirmation: "different-safe-password",
        }),
    ]);
    expect(first.status).toBe(202);
    expect(duplicate.status).toBe(202);
    expect(duplicate.body).toEqual(first.body);
    expect(
      (await pool.query(`select count(*)::int as count from jw_stone_express_accounts`)).rows[0]
        .count
    ).toBe(1);

    const token = await verificationTokenFor("race@example.com");
    const results = await Promise.all([
      json(request(app), "post", "/api/jw-stone/express/verification/confirm")
        .set("Idempotency-Key", idem("race-verify-a"))
        .send({ token }),
      json(request(app), "post", "/api/jw-stone/express/verification/confirm")
        .set("Idempotency-Key", idem("race-verify-b"))
        .send({ token }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    const versions = await pool.query(
      `select state, count(*)::int as count from jw_stone_private_offer_versions group by state order by state`
    );
    expect(versions.rows).toEqual([
      { state: "pending_verification", count: 1 },
      { state: "submitted", count: 1 },
    ]);
  });
});
