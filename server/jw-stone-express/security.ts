import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import type { PoolClient } from "pg";

import { pool } from "../db";
import {
  JW_STONE_EXPRESS_COOKIE_NAME_DEVELOPMENT,
  JW_STONE_EXPRESS_COOKIE_NAME_PRODUCTION,
  JW_STONE_EXPRESS_SESSION_TTL_MS,
  jwStoneIdempotencyKeySchema,
} from "@shared/jwStoneExpress";
import type { JwStoneOutboxSecretEnvelope } from "@shared/schema/jwStoneExpress";

const DEVELOPMENT_SECRET = "jw-stone-express-local-development-only";
const SESSION_COOKIE_PATH = "/";

export type JwStoneExpressSession = {
  id: string;
  accountId: string;
  csrfTokenHash: string;
  host: string;
  legalName: string;
  displayName: string;
  email: string;
  phone: string;
  isBusiness: boolean;
  businessName: string | null;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  createdAt: Date;
};

function secret(): string {
  const configured = String(process.env.SESSION_SECRET || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required for JW Stone Express Account security.");
  }
  return DEVELOPMENT_SECRET;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hmacScope(value: string, domain = "scope"): string {
  return createHmac("sha256", secret())
    .update(`jw-stone-express:${domain}\0${value}`, "utf8")
    .digest("hex");
}

export function randomOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function randomPublicRef(prefix: "jwc_" | "jws_"): string {
  return `${prefix}${randomOpaqueToken()}`;
}

export function deterministicStonePublicRef(sourceRef: string): string {
  const digest = createHash("sha256")
    .update(`jw-stone-offer-target:v1\0${sourceRef}`, "utf8")
    .digest("base64url");
  return `jws_${digest}`;
}

export function constantTimeHashMatch(raw: string, expectedHash: string): boolean {
  const actual = Buffer.from(sha256(raw), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requestHost(req: Request): string {
  return String(req.get("host") || req.hostname || "")
    .trim()
    .toLowerCase()
    .slice(0, 253);
}

function requestIp(req: Request): string {
  return String(req.ip || req.socket?.remoteAddress || "unknown")
    .trim()
    .toLowerCase();
}

function parseCookies(req: Request): Record<string, string> {
  const result: Record<string, string> = {};
  const header = String(req.headers.cookie || "");
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

export function jwStoneSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? JW_STONE_EXPRESS_COOKIE_NAME_PRODUCTION
    : JW_STONE_EXPRESS_COOKIE_NAME_DEVELOPMENT;
}

export function setJwStoneSessionCookie(res: Response, rawToken: string): void {
  res.cookie(jwStoneSessionCookieName(), rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: SESSION_COOKIE_PATH,
    maxAge: JW_STONE_EXPRESS_SESSION_TTL_MS,
  });
}

export function clearJwStoneSessionCookie(res: Response): void {
  res.clearCookie(jwStoneSessionCookieName(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: SESSION_COOKIE_PATH,
  });
}

export async function createJwStoneSession(
  client: PoolClient,
  req: Request,
  accountId: string,
  options: { rawToken?: string } = {}
): Promise<{ rawToken: string; csrfToken: string }> {
  const rawToken = options.rawToken || randomOpaqueToken();
  const csrfToken = randomOpaqueToken();
  await client.query(
    `
      insert into jw_stone_express_sessions
        (account_id, token_hash, csrf_token_hash, host, ip_hash, expires_at)
      values ($1, $2, $3, $4, $5, now() + ($6::bigint * interval '1 millisecond'))
      on conflict (token_hash) do update
      set account_id = excluded.account_id,
          csrf_token_hash = excluded.csrf_token_hash,
          host = excluded.host,
          ip_hash = excluded.ip_hash,
          revoked_at = null,
          expires_at = excluded.expires_at,
          last_seen_at = now()
    `,
    [
      accountId,
      sha256(rawToken),
      sha256(csrfToken),
      requestHost(req),
      hmacScope(requestIp(req), "session-ip"),
      JW_STONE_EXPRESS_SESSION_TTL_MS,
    ]
  );
  return { rawToken, csrfToken };
}

export function deriveJwStoneLoginSessionToken(
  req: Request,
  accountId: string,
  idempotencyKey: string
): string {
  return hmacScope(`${requestHost(req)}\0${accountId}\0${idempotencyKey}`, "login-session-token");
}

export function jwStoneSessionReplayScope(req: Request): string | null {
  const token = parseCookies(req)[jwStoneSessionCookieName()];
  if (!token) return null;
  return `${requestHost(req)}\0${sha256(token)}`;
}

export async function readJwStoneSession(
  req: Request,
  options: { client?: PoolClient; rotateCsrf?: boolean } = {}
): Promise<(JwStoneExpressSession & { csrfToken?: string }) | null> {
  const token = parseCookies(req)[jwStoneSessionCookieName()];
  if (!token) return null;

  const executor = options.client ?? pool;
  const result = await executor.query(
    `
      select
        s.id,
        s.account_id,
        s.csrf_token_hash,
        s.host,
        a.legal_name,
        a.display_name,
        a.email_normalized,
        a.phone_normalized,
        a.is_business,
        a.business_name,
        a.email_verified_at,
        a.password_hash,
        a.created_at
      from jw_stone_express_sessions s
      join jw_stone_express_accounts a on a.id = s.account_id
      where s.token_hash = $1
        and s.host = $2
        and s.revoked_at is null
        and s.expires_at > now()
        and a.status = 'active'
        and a.closed_at is null
      limit 1
    `,
    [sha256(token), requestHost(req)]
  );
  const row = result.rows[0];
  if (!row) return null;

  let csrfToken: string | undefined;
  let csrfTokenHash = String(row.csrf_token_hash);
  if (options.rotateCsrf) {
    csrfToken = randomOpaqueToken();
    csrfTokenHash = sha256(csrfToken);
    await executor.query(
      `update jw_stone_express_sessions
       set csrf_token_hash = $2, last_seen_at = now()
       where id = $1 and revoked_at is null`,
      [row.id, csrfTokenHash]
    );
  } else {
    await executor.query(
      `update jw_stone_express_sessions set last_seen_at = now()
       where id = $1 and last_seen_at < now() - interval '5 minutes'`,
      [row.id]
    );
  }

  return {
    id: String(row.id),
    accountId: String(row.account_id),
    csrfTokenHash,
    host: String(row.host),
    legalName: String(row.legal_name),
    displayName: String(row.display_name),
    email: String(row.email_normalized),
    phone: String(row.phone_normalized),
    isBusiness: Boolean(row.is_business),
    businessName: row.business_name ? String(row.business_name) : null,
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
    passwordHash: String(row.password_hash),
    createdAt: new Date(row.created_at),
    ...(csrfToken ? { csrfToken } : {}),
  };
}

export function requireJwStoneCsrf(req: Request, session: JwStoneExpressSession): void {
  const raw = String(req.get("X-CSRF-Token") || "").trim();
  if (!raw || !constantTimeHashMatch(raw, session.csrfTokenHash)) {
    const error = new Error("Your JW Stone Express session changed. Refresh and try again.");
    (error as any).status = 403;
    throw error;
  }
}

export function requireSameOriginJson(req: Request): void {
  if (!req.is("application/json")) {
    const error = new Error("This endpoint accepts JSON requests only.");
    (error as any).status = 415;
    throw error;
  }

  const fetchSite = String(req.get("Sec-Fetch-Site") || "").toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    const error = new Error("Cross-site requests are not allowed.");
    (error as any).status = 403;
    throw error;
  }

  const origin = String(req.get("Origin") || "").trim();
  if (!origin) {
    if (process.env.NODE_ENV === "test") return;
    const error = new Error("A same-origin request is required.");
    (error as any).status = 403;
    throw error;
  }
  try {
    const parsed = new URL(origin);
    if (parsed.host.toLowerCase() !== requestHost(req)) throw new Error("host mismatch");
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("scheme");
  } catch {
    const error = new Error("A same-origin request is required.");
    (error as any).status = 403;
    throw error;
  }
}

export function requestPublicBaseUrl(req: Request): string {
  const origin = String(req.get("Origin") || "").trim();
  try {
    const parsed = new URL(origin);
    if (parsed.host.toLowerCase() === requestHost(req)) return parsed.origin;
  } catch {
    // Fall through to the verified request host.
  }
  const forwarded = String(req.get("X-Forwarded-Proto") || "")
    .split(",")[0]
    .trim();
  const protocol = forwarded === "https" || forwarded === "http" ? forwarded : req.protocol;
  return `${protocol}://${requestHost(req)}`;
}

export function jwStoneMarketplaceActionUrl(
  req: Request,
  action: "verify" | "reset",
  token: string
): string {
  let path = "/";
  const referer = String(req.get("Referer") || "").trim();
  try {
    const parsed = new URL(referer);
    if (
      parsed.host.toLowerCase() === requestHost(req) &&
      (parsed.pathname === "/jw-stone" || parsed.pathname.startsWith("/jw-stone/"))
    ) {
      path = "/jw-stone";
    }
  } catch {
    // Custom-domain marketplace remains at root.
  }
  const fragment = new URLSearchParams({ token }).toString();
  return `${requestPublicBaseUrl(req)}${path}#jw-express-action=${action}&${fragment}`;
}

function envelopeKey(): Buffer {
  return createHmac("sha256", secret()).update("jw-stone-outbox-envelope:v1", "utf8").digest();
}

export function encryptOutboxSecret(value: string): JwStoneOutboxSecretEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", envelopeKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptOutboxSecret(envelope: JwStoneOutboxSecretEnvelope): string {
  if (envelope?.version !== 1 || envelope?.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported JW Stone outbox secret envelope.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    envelopeKey(),
    Buffer.from(envelope.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function enforceJwStoneRateLimit(args: {
  req: Request;
  scope: string;
  normalizedEmail?: string | null;
  maximum: number;
  windowMs: number;
}): Promise<void> {
  const identity = hmacScope(
    `${requestIp(args.req)}\0${String(args.normalizedEmail || "-").toLowerCase()}`,
    "rate-limit"
  );
  const key = `jw-express:${args.scope}:${identity}`;
  try {
    const result = await pool.query(
      `
        insert into rate_limit_buckets (bucket_key, hits, reset_at, created_at, updated_at)
        values ($1, 1, now() + ($2::int * interval '1 millisecond'), now(), now())
        on conflict (bucket_key) do update set
          hits = case when rate_limit_buckets.reset_at > now()
            then rate_limit_buckets.hits + 1 else 1 end,
          reset_at = case when rate_limit_buckets.reset_at > now()
            then rate_limit_buckets.reset_at
            else now() + ($2::int * interval '1 millisecond') end,
          updated_at = now()
        returning hits, reset_at
      `,
      [key, args.windowMs]
    );
    if (Number(result.rows[0]?.hits || 0) > args.maximum) {
      const error = new Error("Too many attempts. Please wait and try again.");
      (error as any).status = 429;
      (error as any).retryAfter = Math.max(
        1,
        Math.ceil((new Date(result.rows[0].reset_at).getTime() - Date.now()) / 1000)
      );
      throw error;
    }
  } catch (error) {
    if ((error as any)?.status === 429) throw error;
    const unavailable = new Error("JW Stone Express is temporarily unavailable. Please try again.");
    (unavailable as any).status = 503;
    throw unavailable;
  }
}

export function requireIdempotencyKey(req: Request): string {
  const parsed = jwStoneIdempotencyKeySchema.safeParse(String(req.get("Idempotency-Key") || ""));
  if (!parsed.success) {
    const error = new Error("A valid Idempotency-Key header is required.");
    (error as any).status = 400;
    throw error;
  }
  return parsed.data;
}

export function maskJwStoneEmail(email: string): string {
  const [local = "", domain = ""] = String(email).split("@");
  return domain ? `${local.slice(0, 1) || "*"}***@${domain}` : "***";
}

export function maskJwStonePhone(phone: string): string {
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "***";
}

export function safeErrorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "Email delivery failed");
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]")
    .replace(/[A-Za-z0-9_-]{40,}/g, "[secret]")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .slice(0, 500);
}
