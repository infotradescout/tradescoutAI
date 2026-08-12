import type { Express, Request, Response } from "express";
import { z, ZodError } from "zod";

import { hashPassword, validatePassword } from "../auth";
import { pool } from "../db";
import {
  JW_STONE_EXPRESS_PASSWORD_RESET_TTL_MS,
  JW_STONE_EXPRESS_VERIFICATION_TTL_MS,
  jwStoneCloseAccountRequestSchema,
  jwStoneOfferRefSchema,
  jwStonePasswordResetCompleteSchema,
  jwStonePasswordResetRequestSchema,
  jwStoneReviseOfferRequestSchema,
  jwStoneSignInRequestSchema,
  jwStoneSignupRequestSchema,
  jwStoneSubmitOfferRequestSchema,
  jwStoneVerifyRequestSchema,
  jwStoneWithdrawOfferRequestSchema,
} from "@shared/jwStoneExpress";
import {
  ensureTargetAcceptsAmount,
  getStonePublicTarget,
  listPublishedContainers,
  resolveOfferTarget,
  resolvePublicStoneInput,
} from "../jw-stone-express/catalog";
import {
  kickJwStoneOutbox,
  queueJwStoneEmail,
  startJwStoneOutboxWorker,
} from "../jw-stone-express/outbox";
import {
  clearJwStoneSessionCookie,
  createJwStoneSession,
  deriveJwStoneLoginSessionToken,
  enforceJwStoneRateLimit,
  hmacScope,
  jwStoneMarketplaceActionUrl,
  jwStoneSessionReplayScope,
  randomOpaqueToken,
  readJwStoneSession,
  requireIdempotencyKey,
  requireJwStoneCsrf,
  requireSameOriginJson,
  setJwStoneSessionCookie,
  sha256,
} from "../jw-stone-express/security";
import {
  appendOfferVersion,
  insertOfferEvent,
  lockJwStoneExpressIdentity,
  lockJwStoneOfferTarget,
  lockJwStoneOfferTargets,
  queueSubmittedOfferEmails,
  readIdempotencyReceipt,
  serializeRequesterOffer,
  storeIdempotencyReceipt,
  withJwStoneTransaction,
  type IdempotencyScope,
} from "../jw-stone-express/store";
import { registerAdminJwStoneOfferRoutes } from "./admin-jw-stone-offers";

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

function route(handler: AsyncHandler) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error) => {
      const status =
        error instanceof ZodError
          ? 400
          : Math.max(400, Math.min(599, Number((error as any)?.status || 500)));
      if ((error as any)?.retryAfter)
        res.setHeader("Retry-After", String((error as any).retryAfter));
      const message =
        status >= 500
          ? "JW Stone Express could not complete that request. Please try again."
          : error instanceof ZodError
            ? error.issues[0]?.message || "Check the submitted information."
            : error instanceof Error
              ? error.message
              : "The request could not be completed.";
      if (status >= 500) {
        console.error("[jw-stone-express] request failed", {
          method: req.method,
          path: req.path,
          status,
          code: (error as any)?.code || null,
        });
      }
      if (!res.headersSent) res.status(status).json({ message });
    });
  };
}

function accountJson(session: NonNullable<Awaited<ReturnType<typeof readJwStoneSession>>>) {
  return {
    accountRef: session.accountId,
    legalName: session.legalName,
    displayName: session.displayName,
    email: session.email,
    phone: session.phone,
    isBusiness: session.isBusiness,
    businessName: session.businessName,
    emailVerified: Boolean(session.emailVerifiedAt),
    createdAt: session.createdAt.toISOString(),
  };
}

async function replaceAccountToken(args: {
  client: import("pg").PoolClient;
  req: Request;
  accountId: string;
  email: string;
  recipientName: string;
  purpose: "email_verification" | "password_reset";
}): Promise<void> {
  const rawToken = randomOpaqueToken();
  const emailPurpose =
    args.purpose === "email_verification"
      ? "jw_stone_express_verification"
      : "jw_stone_express_password_reset";
  const action = args.purpose === "email_verification" ? "verify" : "reset";
  const ttl =
    args.purpose === "email_verification"
      ? JW_STONE_EXPRESS_VERIFICATION_TTL_MS
      : JW_STONE_EXPRESS_PASSWORD_RESET_TTL_MS;

  await args.client.query(
    `update jw_stone_express_account_tokens
     set consumed_at = now()
     where account_id = $1 and purpose = $2 and consumed_at is null`,
    [args.accountId, args.purpose]
  );
  await args.client.query(
    `
      insert into jw_stone_express_account_tokens
        (account_id, purpose, token_hash, expires_at)
      values ($1, $2, $3, now() + ($4::int * interval '1 millisecond'))
    `,
    [args.accountId, args.purpose, sha256(rawToken), ttl]
  );
  await args.client.query(
    `
      update jw_stone_email_outbox
      set status = 'cancelled', cancelled_at = now(), secret_envelope = null,
          claim_id = null, claimed_at = null, claim_expires_at = null, updated_at = now()
      where account_id = $1 and purpose = $2 and status in ('pending', 'retry')
    `,
    [args.accountId, emailPurpose]
  );
  await queueJwStoneEmail(args.client, {
    accountId: args.accountId,
    purpose: emailPurpose,
    recipient: args.email,
    template: { recipientName: args.recipientName },
    secretActionUrl: jwStoneMarketplaceActionUrl(args.req, action, rawToken),
  });
}

const targetResolverSchema = z
  .object({
    shareSlug: z.string().trim().min(1).max(160).optional(),
    imageUrl: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.shareSlug) !== Boolean(value.imageUrl), {
    message: "Provide one public stone locator.",
  });

export function registerJwStoneExpressRoutes(app: Express): void {
  app.get(
    "/api/jw-stone/containers",
    route(async (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      res.json({ containers: await listPublishedContainers(pool) });
    })
  );

  app.post(
    "/api/jw-stone/offer-targets/resolve",
    route(async (req, res) => {
      requireSameOriginJson(req);
      await enforceJwStoneRateLimit({
        req,
        scope: "resolve-target",
        maximum: 120,
        windowMs: 60_000,
      });
      const input = targetResolverSchema.parse(req.body);
      const stone = resolvePublicStoneInput(input);
      if (!stone)
        throw Object.assign(new Error("That JW Stone selection is unavailable."), { status: 404 });
      res.json({ target: await getStonePublicTarget(pool, stone) });
    })
  );

  app.get(
    "/api/jw-stone/express/targets/:ref",
    route(async (req, res) => {
      const ref = String(req.params.ref || "");
      const kind = ref.startsWith("jwc_") ? "container" : "stone";
      const target = await resolveOfferTarget(pool, { kind, ref });
      res.setHeader("Cache-Control", "no-store");
      res.json({ target: target.publicTarget });
    })
  );

  app.get(
    "/api/jw-stone/express/session",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const session = await readJwStoneSession(req, { rotateCsrf: true });
      if (!session) {
        clearJwStoneSessionCookie(res);
        res.json({ account: null, csrfToken: null });
        return;
      }
      res.json({ account: accountJson(session), csrfToken: session.csrfToken });
    })
  );

  app.post(
    "/api/jw-stone/express/register",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const input = jwStoneSignupRequestSchema.parse(req.body);
      const idempotencyKey = requireIdempotencyKey(req);
      await enforceJwStoneRateLimit({
        req,
        scope: "register",
        normalizedEmail: input.email,
        maximum: 5,
        windowMs: 60 * 60_000,
      });
      const passwordHash = await hashPassword(input.password);
      let newSession: { rawToken: string; csrfToken: string } | null = null;
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          scopeValue: `register:${input.email}`,
          operation: "signup",
          targetKind: input.offer.target.kind,
          targetRef: input.offer.target.ref,
          key: idempotencyKey,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;

        await lockJwStoneExpressIdentity(client, input.email);
        const existing = await client.query(
          `select id from jw_stone_express_accounts
           where email_normalized = $1 and status = 'active' and closed_at is null limit 1`,
          [input.email]
        );
        const generic = {
          status: 202,
          body: { ok: true, verificationRequired: true, offerStatus: "pending_verification" },
        };
        if (existing.rows[0]) {
          await storeIdempotencyReceipt(client, scope, generic);
          return generic;
        }

        await lockJwStoneOfferTarget(client, input.offer.target.kind, input.offer.target.ref);
        const resolved = await resolveOfferTarget(client, input.offer.target);
        ensureTargetAcceptsAmount(resolved.publicTarget, input.offer.amount);
        const account = await client.query(
          `
            insert into jw_stone_express_accounts
              (legal_name, display_name, email_normalized, phone_normalized,
               is_business, business_name, password_hash)
            values ($1, $2, $3, $4, $5, $6, $7)
            returning id
          `,
          [
            input.legalName,
            input.displayName || input.legalName,
            input.email,
            input.phone,
            input.isBusiness,
            input.isBusiness ? input.businessName : null,
            passwordHash,
          ]
        );
        const accountId = String(account.rows[0].id);
        const offer = await client.query(
          `
            insert into jw_stone_private_offers
              (account_id, target_kind, target_ref, stone_source_ref, container_id)
            values ($1, $2, $3, $4, $5)
            returning id
          `,
          [
            accountId,
            input.offer.target.kind,
            input.offer.target.ref,
            resolved.stoneSourceRef,
            resolved.containerId,
          ]
        );
        const offerId = String(offer.rows[0].id);
        const version = await appendOfferVersion(client, {
          offerId,
          state: "pending_verification",
          amountCents: input.offer.amount,
          submittedAt: null,
        });
        await insertOfferEvent(client, {
          offerId,
          versionId: version.id,
          eventType: "offer_captured_pending_verification",
          actorKind: "requester",
        });
        await replaceAccountToken({
          client,
          req,
          accountId,
          email: input.email,
          recipientName: input.displayName || input.legalName,
          purpose: "email_verification",
        });
        newSession = await createJwStoneSession(client, req, accountId);
        scope.accountId = accountId;
        await storeIdempotencyReceipt(client, scope, generic);
        return generic;
      });
      const committedSession = newSession as { rawToken: string; csrfToken: string } | null;
      if (committedSession) setJwStoneSessionCookie(res, committedSession.rawToken);
      kickJwStoneOutbox();
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/login",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const input = jwStoneSignInRequestSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      await enforceJwStoneRateLimit({
        req,
        scope: "login",
        normalizedEmail: input.email,
        maximum: 10,
        windowMs: 15 * 60_000,
      });
      const account = await pool.query(
        `select id, password_hash from jw_stone_express_accounts
         where email_normalized = $1 and status = 'active' and closed_at is null limit 1`,
        [input.email]
      );
      const row = account.rows[0];
      const valid = row?.password_hash
        ? await validatePassword(input.password, String(row.password_hash))
        : false;
      if (!valid) {
        throw Object.assign(new Error("The email or password is incorrect."), { status: 401 });
      }
      const accountId = String(row.id);
      let session: { rawToken: string; csrfToken: string } | null = null;
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          accountId,
          scopeValue: `account:${accountId}`,
          operation: "login",
          targetKind: "account",
          targetRef: "session",
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        session = await createJwStoneSession(client, req, accountId, {
          rawToken: deriveJwStoneLoginSessionToken(req, accountId, key),
        });
        if (cached) return cached;
        const success = { status: 200, body: { ok: true } };
        await storeIdempotencyReceipt(client, scope, success);
        return success;
      });
      const committedSession = session as { rawToken: string; csrfToken: string } | null;
      if (!committedSession) throw new Error("JW Stone Express could not establish that session.");
      setJwStoneSessionCookie(res, committedSession.rawToken);
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/logout",
    route(async (req, res) => {
      requireSameOriginJson(req);
      z.object({}).strict().parse(req.body);
      const key = requireIdempotencyKey(req);
      const session = await readJwStoneSession(req);
      let response = { status: 200, body: { ok: true } };
      if (session) {
        requireJwStoneCsrf(req, session);
        response = await withJwStoneTransaction(async (client) => {
          const scope: IdempotencyScope = {
            accountId: session.accountId,
            scopeValue: `account:${session.accountId}`,
            operation: "logout",
            targetKind: "account",
            targetRef: session.id,
            key,
            requestBody: req.body,
          };
          const cached = await readIdempotencyReceipt(client, scope);
          if (cached) return cached as typeof response;
          await client.query(
            `update jw_stone_express_sessions set revoked_at = now() where id = $1 and revoked_at is null`,
            [session.id]
          );
          await storeIdempotencyReceipt(client, scope, response);
          return response;
        });
      }
      clearJwStoneSessionCookie(res);
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/verification/resend",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const input = jwStonePasswordResetRequestSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      await enforceJwStoneRateLimit({
        req,
        scope: "verification-resend",
        normalizedEmail: input.email,
        maximum: 4,
        windowMs: 60 * 60_000,
      });
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          scopeValue: `verification:${input.email}`,
          operation: "verify",
          targetKind: "account",
          targetRef: "resend",
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;
        const account = await client.query(
          `select id, display_name, email_normalized from jw_stone_express_accounts
           where email_normalized = $1 and status = 'active' and email_verified_at is null
           for update`,
          [input.email]
        );
        if (account.rows[0]) {
          await replaceAccountToken({
            client,
            req,
            accountId: String(account.rows[0].id),
            email: String(account.rows[0].email_normalized),
            recipientName: String(account.rows[0].display_name),
            purpose: "email_verification",
          });
          scope.accountId = String(account.rows[0].id);
        }
        const generic = { status: 202, body: { ok: true } };
        await storeIdempotencyReceipt(client, scope, generic);
        return generic;
      });
      kickJwStoneOutbox();
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/verification/confirm",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const input = jwStoneVerifyRequestSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      await enforceJwStoneRateLimit({ req, scope: "verify", maximum: 12, windowMs: 60 * 60_000 });
      let newSession: { rawToken: string; csrfToken: string } | null = null;
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          scopeValue: `verify-token:${sha256(input.token)}`,
          operation: "verify",
          targetKind: "account",
          targetRef: "confirm",
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;
        const tokenPreview = await client.query(
          `
            select t.account_id
            from jw_stone_express_account_tokens t
            join jw_stone_express_accounts a on a.id = t.account_id
            where t.token_hash = $1 and t.purpose = 'email_verification'
              and t.consumed_at is null and t.expires_at > now()
              and a.status = 'active'
          `,
          [sha256(input.token)]
        );
        const previewAccountId = tokenPreview.rows[0]?.account_id;
        if (!previewAccountId) {
          throw Object.assign(new Error("That verification link is invalid or expired."), {
            status: 400,
          });
        }
        const targetRows = await client.query(
          `
            select distinct o.target_kind, o.target_ref
            from jw_stone_private_offers o
            join jw_stone_private_offer_versions v on v.id = o.current_version_id
            where o.account_id = $1 and v.state = 'pending_verification'
          `,
          [previewAccountId]
        );
        await lockJwStoneOfferTargets(
          client,
          targetRows.rows.map((row) => ({
            targetKind: String(row.target_kind) as "stone" | "container",
            targetRef: String(row.target_ref),
          }))
        );
        const token = await client.query(
          `
            select t.id as token_id, a.*
            from jw_stone_express_account_tokens t
            join jw_stone_express_accounts a on a.id = t.account_id
            where t.token_hash = $1 and t.purpose = 'email_verification'
              and t.consumed_at is null and t.expires_at > now()
              and a.status = 'active'
            for update of t, a
          `,
          [sha256(input.token)]
        );
        const account = token.rows[0];
        if (!account) {
          throw Object.assign(new Error("That verification link is invalid or expired."), {
            status: 400,
          });
        }
        const accountId = String(account.id);
        await client.query(
          `update jw_stone_express_accounts
           set email_verified_at = coalesce(email_verified_at, now()), updated_at = now()
           where id = $1`,
          [accountId]
        );
        const pending = await client.query(
          `
            select o.id, o.target_kind, o.target_ref, v.amount_cents
            from jw_stone_private_offers o
            join jw_stone_private_offer_versions v on v.id = o.current_version_id
            where o.account_id = $1 and v.state = 'pending_verification'
            order by o.created_at asc, o.id asc
            for update of o
          `,
          [accountId]
        );
        let activatedOffers = 0;
        for (const offer of pending.rows) {
          let state: "submitted" | "expired" = "submitted";
          let resolved: Awaited<ReturnType<typeof resolveOfferTarget>> | null = null;
          try {
            resolved = await resolveOfferTarget(client, {
              kind: offer.target_kind,
              ref: offer.target_ref,
            });
            ensureTargetAcceptsAmount(resolved.publicTarget, Number(offer.amount_cents));
          } catch (error) {
            const status = Number((error as { status?: unknown } | null)?.status || 0);
            if (![404, 409, 422].includes(status)) throw error;
            state = "expired";
          }
          const version = await appendOfferVersion(client, {
            offerId: String(offer.id),
            state,
            amountCents: Number(offer.amount_cents),
            submittedAt: new Date(),
          });
          await insertOfferEvent(client, {
            offerId: String(offer.id),
            versionId: version.id,
            eventType:
              state === "submitted" ? "offer_submitted" : "offer_expired_before_activation",
            actorKind: "system",
          });
          if (state === "submitted" && resolved) {
            activatedOffers += 1;
            await queueSubmittedOfferEmails(client, {
              req,
              accountId,
              offerId: String(offer.id),
              customerEmail: String(account.email_normalized),
              customerName: String(account.display_name),
              targetLabel: resolved.publicTarget.label,
              amountCents: Number(offer.amount_cents),
            });
          }
        }
        await client.query(
          `update jw_stone_express_account_tokens
           set consumed_at = now()
           where account_id = $1 and purpose = 'email_verification' and consumed_at is null`,
          [accountId]
        );
        await client.query(
          `update jw_stone_email_outbox
           set status = 'cancelled', cancelled_at = now(), secret_envelope = null,
               claim_id = null, claimed_at = null, claim_expires_at = null, updated_at = now()
           where account_id = $1 and purpose = 'jw_stone_express_verification'
             and status in ('pending', 'retry')`,
          [accountId]
        );
        await client.query(
          `update jw_stone_express_sessions set revoked_at = now()
           where account_id = $1 and revoked_at is null`,
          [accountId]
        );
        newSession = await createJwStoneSession(client, req, accountId);
        scope.accountId = accountId;
        const success = { status: 200, body: { ok: true, activatedOffers } };
        await storeIdempotencyReceipt(client, scope, success);
        return success;
      });
      const committedSession = newSession as { rawToken: string; csrfToken: string } | null;
      if (committedSession) setJwStoneSessionCookie(res, committedSession.rawToken);
      kickJwStoneOutbox();
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/password/reset/request",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const input = jwStonePasswordResetRequestSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      await enforceJwStoneRateLimit({
        req,
        scope: "password-reset-request",
        normalizedEmail: input.email,
        maximum: 4,
        windowMs: 60 * 60_000,
      });
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          scopeValue: `reset:${input.email}`,
          operation: "request_password_reset",
          targetKind: "account",
          targetRef: "password",
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;
        const account = await client.query(
          `select id, display_name, email_normalized from jw_stone_express_accounts
           where email_normalized = $1 and status = 'active' for update`,
          [input.email]
        );
        if (account.rows[0]) {
          await replaceAccountToken({
            client,
            req,
            accountId: String(account.rows[0].id),
            email: String(account.rows[0].email_normalized),
            recipientName: String(account.rows[0].display_name),
            purpose: "password_reset",
          });
          scope.accountId = String(account.rows[0].id);
        }
        const generic = { status: 202, body: { ok: true } };
        await storeIdempotencyReceipt(client, scope, generic);
        return generic;
      });
      kickJwStoneOutbox();
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/password/reset/confirm",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const input = jwStonePasswordResetCompleteSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      await enforceJwStoneRateLimit({
        req,
        scope: "password-reset-confirm",
        maximum: 12,
        windowMs: 60 * 60_000,
      });
      const passwordHash = await hashPassword(input.password);
      let newSession: { rawToken: string; csrfToken: string } | null = null;
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          scopeValue: `reset-token:${sha256(input.token)}`,
          operation: "complete_password_reset",
          targetKind: "account",
          targetRef: "password",
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;
        const token = await client.query(
          `
            select t.id as token_id, a.id as account_id
            from jw_stone_express_account_tokens t
            join jw_stone_express_accounts a on a.id = t.account_id
            where t.token_hash = $1 and t.purpose = 'password_reset'
              and t.consumed_at is null and t.expires_at > now()
              and a.status = 'active'
            for update of t, a
          `,
          [sha256(input.token)]
        );
        const row = token.rows[0];
        if (!row)
          throw Object.assign(new Error("That password reset link is invalid or expired."), {
            status: 400,
          });
        const accountId = String(row.account_id);
        await client.query(
          `update jw_stone_express_accounts set password_hash = $2, updated_at = now() where id = $1`,
          [accountId, passwordHash]
        );
        await client.query(
          `update jw_stone_express_account_tokens set consumed_at = now()
           where account_id = $1 and purpose = 'password_reset' and consumed_at is null`,
          [accountId]
        );
        await client.query(
          `update jw_stone_email_outbox
           set status = 'cancelled', cancelled_at = now(), secret_envelope = null,
               claim_id = null, claimed_at = null, claim_expires_at = null, updated_at = now()
           where account_id = $1 and purpose = 'jw_stone_express_password_reset'
             and status in ('pending', 'retry')`,
          [accountId]
        );
        await client.query(
          `update jw_stone_express_sessions set revoked_at = now()
           where account_id = $1 and revoked_at is null`,
          [accountId]
        );
        newSession = await createJwStoneSession(client, req, accountId);
        scope.accountId = accountId;
        const success = { status: 200, body: { ok: true } };
        await storeIdempotencyReceipt(client, scope, success);
        return success;
      });
      const committedSession = newSession as { rawToken: string; csrfToken: string } | null;
      if (committedSession) setJwStoneSessionCookie(res, committedSession.rawToken);
      res.status(response.status).json(response.body);
    })
  );

  app.get(
    "/api/jw-stone/express/offers",
    route(async (req, res) => {
      const session = await readJwStoneSession(req);
      if (!session)
        throw Object.assign(new Error("Sign in to view your private offers."), { status: 401 });
      const offers = await withJwStoneTransaction(async (client) => {
        const result = await client.query(
          `
            select o.*, v.state, v.amount_cents, v.submitted_at
            from jw_stone_private_offers o
            join jw_stone_private_offer_versions v on v.id = o.current_version_id
            where o.account_id = $1
            order by o.updated_at desc, o.id desc
          `,
          [session.accountId]
        );
        return Promise.all(result.rows.map((row) => serializeRequesterOffer(client, row)));
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({ offers });
    })
  );

  app.post(
    "/api/jw-stone/express/offers",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const input = jwStoneSubmitOfferRequestSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      const session = await readJwStoneSession(req);
      if (!session)
        throw Object.assign(new Error("Sign in to make a private offer."), { status: 401 });
      requireJwStoneCsrf(req, session);
      if (!session.emailVerifiedAt) {
        throw Object.assign(new Error("Verify your email before making another offer."), {
          status: 403,
        });
      }
      await enforceJwStoneRateLimit({
        req,
        scope: "submit-offer",
        maximum: 20,
        windowMs: 60 * 60_000,
      });
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          accountId: session.accountId,
          scopeValue: `account:${session.accountId}`,
          operation: "submit_offer",
          targetKind: input.target.kind,
          targetRef: input.target.ref,
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;
        await lockJwStoneOfferTarget(client, input.target.kind, input.target.ref);
        const activeAccount = await client.query(
          `select id from jw_stone_express_accounts
           where id = $1 and status = 'active' and closed_at is null
           for update`,
          [session.accountId]
        );
        if (!activeAccount.rows[0]) {
          throw Object.assign(new Error("Sign in to make a private offer."), { status: 401 });
        }
        const resolved = await resolveOfferTarget(client, input.target);
        ensureTargetAcceptsAmount(resolved.publicTarget, input.amount);
        const existing = await client.query(
          `select id from jw_stone_private_offers
           where account_id = $1 and target_kind = $2 and target_ref = $3 limit 1`,
          [session.accountId, input.target.kind, input.target.ref]
        );
        if (existing.rows[0]) {
          throw Object.assign(
            new Error("You already have an offer for this selection. Revise it instead."),
            { status: 409 }
          );
        }
        const offer = await client.query(
          `
            insert into jw_stone_private_offers
              (account_id, target_kind, target_ref, stone_source_ref, container_id)
            values ($1, $2, $3, $4, $5)
            returning id
          `,
          [
            session.accountId,
            input.target.kind,
            input.target.ref,
            resolved.stoneSourceRef,
            resolved.containerId,
          ]
        );
        const offerId = String(offer.rows[0].id);
        const version = await appendOfferVersion(client, {
          offerId,
          state: "submitted",
          amountCents: input.amount,
          submittedAt: new Date(),
        });
        await insertOfferEvent(client, {
          offerId,
          versionId: version.id,
          eventType: "offer_submitted",
          actorKind: "requester",
        });
        await queueSubmittedOfferEmails(client, {
          req,
          accountId: session.accountId,
          offerId,
          customerEmail: session.email,
          customerName: session.displayName,
          targetLabel: resolved.publicTarget.label,
          amountCents: input.amount,
        });
        const success = { status: 201, body: { ok: true, offerRef: offerId, status: "submitted" } };
        await storeIdempotencyReceipt(client, scope, success);
        return success;
      });
      kickJwStoneOutbox();
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/offers/:offerId/revisions",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const offerId = jwStoneOfferRefSchema.parse(req.params.offerId);
      const input = jwStoneReviseOfferRequestSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      const session = await readJwStoneSession(req);
      if (!session)
        throw Object.assign(new Error("Sign in to revise your private offer."), { status: 401 });
      requireJwStoneCsrf(req, session);
      if (!session.emailVerifiedAt)
        throw Object.assign(new Error("Verify your email first."), { status: 403 });
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          accountId: session.accountId,
          scopeValue: `account:${session.accountId}`,
          operation: "revise_offer",
          targetKind: "offer",
          targetRef: offerId,
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;
        const target = await client.query(
          `select target_kind, target_ref
           from jw_stone_private_offers
           where id = $1 and account_id = $2`,
          [offerId, session.accountId]
        );
        if (!target.rows[0])
          throw Object.assign(new Error("Private offer not found."), { status: 404 });
        await lockJwStoneOfferTarget(
          client,
          String(target.rows[0].target_kind) as "stone" | "container",
          String(target.rows[0].target_ref)
        );
        const offer = await client.query(
          `
            select o.*, v.state
            from jw_stone_private_offers o
            join jw_stone_private_offer_versions v on v.id = o.current_version_id
            join jw_stone_express_accounts a on a.id = o.account_id
            where o.id = $1 and o.account_id = $2
              and a.status = 'active' and a.closed_at is null
            for update of o, a
          `,
          [offerId, session.accountId]
        );
        const row = offer.rows[0];
        if (!row) throw Object.assign(new Error("Private offer not found."), { status: 404 });
        if (!["submitted", "under_review"].includes(String(row.state))) {
          throw Object.assign(new Error("That offer can no longer be revised."), { status: 409 });
        }
        const resolved = await resolveOfferTarget(client, {
          kind: row.target_kind,
          ref: row.target_ref,
        });
        ensureTargetAcceptsAmount(resolved.publicTarget, input.amount);
        const version = await appendOfferVersion(client, {
          offerId,
          state: "submitted",
          amountCents: input.amount,
          submittedAt: new Date(),
        });
        await insertOfferEvent(client, {
          offerId,
          versionId: version.id,
          eventType: "offer_revised_and_resubmitted",
          actorKind: "requester",
        });
        await queueSubmittedOfferEmails(client, {
          req,
          accountId: session.accountId,
          offerId,
          customerEmail: session.email,
          customerName: session.displayName,
          targetLabel: resolved.publicTarget.label,
          amountCents: input.amount,
        });
        const success = { status: 200, body: { ok: true, offerRef: offerId, status: "submitted" } };
        await storeIdempotencyReceipt(client, scope, success);
        return success;
      });
      kickJwStoneOutbox();
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/offers/:offerId/withdraw",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const offerId = jwStoneOfferRefSchema.parse(req.params.offerId);
      jwStoneWithdrawOfferRequestSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      const session = await readJwStoneSession(req);
      if (!session)
        throw Object.assign(new Error("Sign in to withdraw your private offer."), { status: 401 });
      requireJwStoneCsrf(req, session);
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          accountId: session.accountId,
          scopeValue: `account:${session.accountId}`,
          operation: "withdraw_offer",
          targetKind: "offer",
          targetRef: offerId,
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;
        const target = await client.query(
          `select target_kind, target_ref
           from jw_stone_private_offers
           where id = $1 and account_id = $2`,
          [offerId, session.accountId]
        );
        if (!target.rows[0])
          throw Object.assign(new Error("Private offer not found."), { status: 404 });
        await lockJwStoneOfferTarget(
          client,
          String(target.rows[0].target_kind) as "stone" | "container",
          String(target.rows[0].target_ref)
        );
        const offer = await client.query(
          `
            select o.id, v.state, v.amount_cents, v.submitted_at
            from jw_stone_private_offers o
            join jw_stone_private_offer_versions v on v.id = o.current_version_id
            join jw_stone_express_accounts a on a.id = o.account_id
            where o.id = $1 and o.account_id = $2
              and a.status = 'active' and a.closed_at is null
            for update of o, a
          `,
          [offerId, session.accountId]
        );
        const row = offer.rows[0];
        if (!row) throw Object.assign(new Error("Private offer not found."), { status: 404 });
        if (!["pending_verification", "submitted", "under_review"].includes(String(row.state))) {
          throw Object.assign(new Error("That offer can no longer be withdrawn."), { status: 409 });
        }
        const version = await appendOfferVersion(client, {
          offerId,
          state: "withdrawn",
          amountCents: Number(row.amount_cents),
          submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
        });
        await insertOfferEvent(client, {
          offerId,
          versionId: version.id,
          eventType: "offer_withdrawn",
          actorKind: "requester",
        });
        const success = { status: 200, body: { ok: true, offerRef: offerId, status: "withdrawn" } };
        await storeIdempotencyReceipt(client, scope, success);
        return success;
      });
      res.status(response.status).json(response.body);
    })
  );

  app.post(
    "/api/jw-stone/express/account/close",
    route(async (req, res) => {
      requireSameOriginJson(req);
      const input = jwStoneCloseAccountRequestSchema.parse(req.body);
      const key = requireIdempotencyKey(req);
      const replayScopeValue = jwStoneSessionReplayScope(req);
      const session = await readJwStoneSession(req);
      if (!session) {
        if (!replayScopeValue) {
          throw Object.assign(new Error("Sign in to close your JW Stone Express Account."), {
            status: 401,
          });
        }
        const replay = await withJwStoneTransaction((client) =>
          readIdempotencyReceipt(client, {
            scopeValue: `close-session:${replayScopeValue}`,
            operation: "close_account",
            targetKind: "account",
            targetRef: "closure",
            key,
            requestBody: req.body,
          })
        );
        if (!replay) {
          throw Object.assign(new Error("Sign in to close your JW Stone Express Account."), {
            status: 401,
          });
        }
        clearJwStoneSessionCookie(res);
        res.status(replay.status).json(replay.body);
        return;
      }
      if (!replayScopeValue)
        throw new Error("JW Stone Express could not scope that closure request.");
      requireJwStoneCsrf(req, session);
      await enforceJwStoneRateLimit({
        req,
        scope: "close-account",
        maximum: 5,
        windowMs: 60 * 60_000,
      });
      const valid = await validatePassword(input.password, session.passwordHash);
      if (!valid) throw Object.assign(new Error("The password is incorrect."), { status: 403 });
      const closurePseudonym = hmacScope(`${session.accountId}:${randomOpaqueToken()}`, "closure");
      const response = await withJwStoneTransaction(async (client) => {
        const scope: IdempotencyScope = {
          scopeValue: `close-session:${replayScopeValue}`,
          operation: "close_account",
          targetKind: "account",
          targetRef: "closure",
          key,
          requestBody: req.body,
        };
        const cached = await readIdempotencyReceipt(client, scope);
        if (cached) return cached;
        const success = { status: 200, body: { ok: true } };
        const targets = await client.query(
          `select distinct target_kind, target_ref
           from jw_stone_private_offers
           where account_id = $1`,
          [session.accountId]
        );
        await lockJwStoneOfferTargets(
          client,
          targets.rows.map((row) => ({
            targetKind: String(row.target_kind) as "stone" | "container",
            targetRef: String(row.target_ref),
          }))
        );
        const account = await client.query(
          `select id from jw_stone_express_accounts
           where id = $1 and status = 'active' for update`,
          [session.accountId]
        );
        if (!account.rows[0]) {
          await storeIdempotencyReceipt(client, scope, success);
          return success;
        }
        const offers = await client.query(
          `
            select o.id, v.state, v.amount_cents, v.submitted_at
            from jw_stone_private_offers o
            join jw_stone_private_offer_versions v on v.id = o.current_version_id
            where o.account_id = $1
            order by o.id
            for update of o
          `,
          [session.accountId]
        );
        for (const offer of offers.rows) {
          if (["pending_verification", "submitted", "under_review"].includes(String(offer.state))) {
            const version = await appendOfferVersion(client, {
              offerId: String(offer.id),
              state: "withdrawn",
              amountCents: Number(offer.amount_cents),
              submittedAt: offer.submitted_at ? new Date(offer.submitted_at) : null,
            });
            await insertOfferEvent(client, {
              offerId: String(offer.id),
              versionId: version.id,
              eventType: "offer_withdrawn_on_account_closure",
              actorKind: "system",
            });
          }
        }
        await client.query(`delete from jw_stone_express_sessions where account_id = $1`, [
          session.accountId,
        ]);
        await client.query(`delete from jw_stone_express_account_tokens where account_id = $1`, [
          session.accountId,
        ]);
        const closureOutbox = await client.query(
          `select id from jw_stone_email_outbox
           where account_id = $1 order by id for update`,
          [session.accountId]
        );
        const closureOutboxIds = closureOutbox.rows.map((row) => String(row.id));
        if (closureOutboxIds.length > 0) {
          await client.query(
            `
              update jw_stone_email_outbox_attempts
              set status = 'failed', error_summary = 'Cancelled by irreversible account closure.',
                  completed_at = now()
              where outbox_id = any($1::uuid[]) and status = 'processing'
            `,
            [closureOutboxIds]
          );
          await client.query(
            `
              update jw_stone_email_outbox
              set account_id = null,
                  recipient_normalized = $2,
                  template_payload = '{}'::jsonb,
                  secret_envelope = null,
                  status = case when status in ('pending','retry','processing') then 'cancelled' else status end,
                  cancelled_at = case when status in ('pending','retry','processing') then now() else cancelled_at end,
                  claim_id = null, claimed_at = null, claim_expires_at = null,
                  provider_message_id = null, last_error_summary = null, updated_at = now()
              where id = any($1::uuid[])
            `,
            [closureOutboxIds, `closed+${closurePseudonym.slice(0, 24)}@invalid`]
          );
        }
        await client.query(
          `update jw_stone_private_offers
           set account_id = null, closure_pseudonym = $2, updated_at = now()
           where account_id = $1`,
          [session.accountId, closurePseudonym]
        );
        await client.query(`delete from jw_stone_idempotency_receipts where account_id = $1`, [
          session.accountId,
        ]);
        await client.query(
          `
            update jw_stone_express_accounts
            set status = 'closed', legal_name = null, display_name = null,
                email_normalized = null, phone_normalized = null, is_business = null,
                business_name = null, password_hash = null, email_verified_at = null,
                closed_at = now(), closure_pseudonym = $2, updated_at = now()
            where id = $1
          `,
          [session.accountId, closurePseudonym]
        );
        await storeIdempotencyReceipt(client, scope, success);
        return success;
      });
      clearJwStoneSessionCookie(res);
      res.status(response.status).json(response.body);
    })
  );

  registerAdminJwStoneOfferRoutes(app);
  startJwStoneOutboxWorker();
}
