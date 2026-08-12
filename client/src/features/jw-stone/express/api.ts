import type { JwStoneCatalogItem } from "../types";
import {
  JW_EXPRESS_OFFER_STATUSES,
  type JwExpressAccount,
  type JwExpressOffer,
  type JwExpressOfferStatus,
  type JwExpressOfferTarget,
  type JwExpressOfferVersion,
  type JwExpressSession,
  type JwStonePublicContainer,
  type JwStoneSignupRequest,
  type SignInJwExpressInput,
} from "./types";

const EXPRESS_BASE = "/api/jw-stone/express";

export const JW_EXPRESS_ENDPOINTS = Object.freeze({
  containers: "/api/jw-stone/containers",
  resolveTarget: "/api/jw-stone/offer-targets/resolve",
  session: `${EXPRESS_BASE}/session`,
  offers: `${EXPRESS_BASE}/offers`,
  register: `${EXPRESS_BASE}/register`,
  login: `${EXPRESS_BASE}/login`,
  logout: `${EXPRESS_BASE}/logout`,
  resendVerification: `${EXPRESS_BASE}/verification/resend`,
  confirmVerification: `${EXPRESS_BASE}/verification/confirm`,
  requestPasswordReset: `${EXPRESS_BASE}/password/reset/request`,
  confirmPasswordReset: `${EXPRESS_BASE}/password/reset/confirm`,
  closeAccount: `${EXPRESS_BASE}/account/close`,
});

type JsonRecord = Record<string, unknown>;

type RequestJsonOptions = Readonly<{
  method?: "GET" | "POST";
  body?: unknown;
  csrfToken?: string | null;
  idempotencyOperation?: string;
  signal?: AbortSignal;
}>;

export class JwExpressApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "JwExpressApiError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function readBoolean(record: JsonRecord, ...keys: string[]): boolean | null {
  for (const key of keys) {
    if (typeof record[key] === "boolean") return record[key] as boolean;
  }
  return null;
}

function readNullableString(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    if (record[key] === null) return null;
    if (typeof record[key] === "string") {
      const trimmed = (record[key] as string).trim();
      return trimmed || null;
    }
  }
  return null;
}

function safeMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  return readString(payload, "message", "error") ?? fallback;
}

function secureRandomId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error("Secure randomness is unavailable; the request was not sent.");
  }
  const bytes = new Uint8Array(18);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newIdempotencyKey(operation: string): string {
  return `jw-express-${operation}-${secureRandomId()}`;
}

async function requestJson<T>(path: string, options: RequestJsonOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.csrfToken) headers["X-CSRF-Token"] = options.csrfToken;
  if (options.idempotencyOperation) {
    headers["Idempotency-Key"] = newIdempotencyKey(options.idempotencyOperation);
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "include",
    cache: "no-store",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const text = response.status === 204 ? "" : await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new JwExpressApiError(
        response.ok
          ? "JW Express returned an unreadable response."
          : "JW Express could not complete that request.",
        response.status
      );
    }
  }
  if (!response.ok) {
    throw new JwExpressApiError(
      safeMessage(payload, "JW Express could not complete that request."),
      response.status
    );
  }
  return payload as T;
}

export function normalizeUsdOfferAmount(value: string): string {
  const compact = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(?:\.\d{0,2})?$/.test(compact)) {
    throw new Error("Enter a valid USD amount with no more than two decimal places.");
  }
  const [wholePart, fractionPart = ""] = compact.split(".");
  const whole = wholePart.replace(/^0+(?=\d)/, "") || "0";
  const cents = fractionPart.padEnd(2, "0");
  if (/^0+$/.test(whole) && cents === "00") {
    throw new Error("Offer amount must be greater than zero.");
  }
  return `${whole}.${cents}`;
}

export function displayUsdAmount(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}

function normalizeTarget(value: unknown): JwExpressOfferTarget | null {
  if (!isRecord(value)) return null;
  const ref = readString(value, "ref", "targetRef", "target_ref");
  const kind = readString(value, "kind", "targetKind", "target_kind");
  const label = readString(value, "label", "targetLabel", "target_label", "title", "name");
  if (!ref || (kind !== "stone" && kind !== "container") || !label) return null;
  return Object.freeze({
    ref,
    kind,
    label,
    imageUrl: readNullableString(value, "imageUrl", "image_url"),
    acceptingOffers: readBoolean(value, "acceptingOffers", "accepting_offers") === true,
    minimumOffer: readNullableString(
      value,
      "minimumOffer",
      "minimum_offer",
      "minimumOfferDisplay",
      "minimum_offer_display",
      "minimumAmount",
      "minimum_amount"
    ),
  });
}

export async function resolveJwStoneOfferTarget(
  stone: Pick<JwStoneCatalogItem, "shareSlug" | "images">,
  signal?: AbortSignal
): Promise<JwExpressOfferTarget> {
  const locator = stone.shareSlug
    ? { shareSlug: stone.shareSlug }
    : stone.images[0]
      ? { imageUrl: stone.images[0] }
      : null;
  if (!locator) throw new JwExpressApiError("This stone cannot be offered on yet.", 422);
  const payload = await requestJson<unknown>(JW_EXPRESS_ENDPOINTS.resolveTarget, {
    method: "POST",
    body: locator,
    signal,
  });
  const source = isRecord(payload) && "target" in payload ? payload.target : payload;
  const target = normalizeTarget(source);
  if (!target || target.kind !== "stone") {
    throw new JwExpressApiError("JW Stone returned an invalid offer target.", 502);
  }
  return target;
}

function normalizeContainer(value: unknown): JwStonePublicContainer | null {
  if (!isRecord(value)) return null;
  if ("published" in value && value.published !== true) return null;
  const source = isRecord(value.target) ? value.target : value;
  const target = normalizeTarget(source);
  if (!target || target.kind !== "container") return null;
  return Object.freeze({
    target: Object.freeze({ ...target, kind: "container" as const }),
    description: readNullableString(value, "description", "summary"),
  });
}

export async function getPublishedContainers(
  signal?: AbortSignal
): Promise<JwStonePublicContainer[]> {
  const payload = await requestJson<unknown>(JW_EXPRESS_ENDPOINTS.containers, { signal });
  const source = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.containers)
      ? payload.containers
      : null;
  if (!source) throw new JwExpressApiError("Published containers could not be read.", 502);
  return source.flatMap((entry) => {
    const container = normalizeContainer(entry);
    return container ? [container] : [];
  });
}

function normalizeAccount(value: unknown): JwExpressAccount | null {
  if (!isRecord(value)) return null;
  const legalName = readString(value, "legalName", "legal_name", "name");
  const email = readString(value, "email");
  if (!legalName || !email) return null;
  return Object.freeze({
    legalName,
    email,
    phone: readString(value, "phone") ?? "",
    isBusiness: readBoolean(value, "isBusiness", "is_business") === true,
    businessName: readNullableString(value, "businessName", "business_name"),
    emailVerified: readBoolean(value, "emailVerified", "email_verified", "verified") === true,
  });
}

function normalizeSession(payload: unknown): JwExpressSession {
  if (!isRecord(payload)) return Object.freeze({ account: null, csrfToken: null });
  return Object.freeze({
    account: normalizeAccount(payload.account),
    csrfToken: readNullableString(payload, "csrfToken", "csrf_token"),
  });
}

export async function getJwExpressSession(signal?: AbortSignal): Promise<JwExpressSession> {
  try {
    return normalizeSession(await requestJson<unknown>(JW_EXPRESS_ENDPOINTS.session, { signal }));
  } catch (error) {
    if (error instanceof JwExpressApiError && error.status === 401) {
      return Object.freeze({ account: null, csrfToken: null });
    }
    throw error;
  }
}

function isOfferStatus(value: string | null): value is JwExpressOfferStatus {
  return Boolean(value && (JW_EXPRESS_OFFER_STATUSES as readonly string[]).includes(value));
}

function normalizeOfferVersion(value: unknown): JwExpressOfferVersion | null {
  if (!isRecord(value)) return null;
  const id =
    readString(value, "id", "versionId", "version_id") ??
    (typeof value.version === "number" && Number.isInteger(value.version)
      ? String(value.version)
      : null);
  const amount = readString(value, "amount", "amountDisplay", "amount_display");
  const status = readString(value, "status");
  if (!id || !amount || !isOfferStatus(status)) return null;
  return Object.freeze({
    id,
    amount,
    status,
    submittedAt: readNullableString(
      value,
      "submittedAt",
      "submitted_at",
      "createdAt",
      "created_at"
    ),
  });
}

function normalizeOffer(value: unknown): JwExpressOffer | null {
  if (!isRecord(value)) return null;
  const id = readString(value, "id", "offerId", "offer_id", "offerRef");
  const nestedTarget = isRecord(value.target) ? value.target : null;
  const targetRef =
    readString(value, "targetRef", "target_ref") ??
    (nestedTarget ? readString(nestedTarget, "ref") : null);
  const targetLabel =
    readString(value, "targetLabel", "target_label", "label") ??
    (nestedTarget ? readString(nestedTarget, "label") : null);
  const targetKindValue =
    readString(value, "targetKind", "target_kind") ??
    (nestedTarget ? readString(nestedTarget, "kind") : null);
  const amount = readString(value, "amount", "amountDisplay", "amount_display");
  const status = readString(value, "status");
  if (!id || !targetRef || !targetLabel || !amount || !isOfferStatus(status)) return null;
  const versionsSource = Array.isArray(value.versions)
    ? value.versions
    : Array.isArray(value.history)
      ? value.history
      : [];
  return Object.freeze({
    id,
    targetRef,
    targetKind: targetKindValue === "container" ? "container" : "stone",
    targetLabel,
    amount,
    status,
    submittedAt: readNullableString(value, "submittedAt", "submitted_at"),
    updatedAt: readNullableString(value, "updatedAt", "updated_at"),
    versions: Object.freeze(
      versionsSource.flatMap((entry) => {
        const version = normalizeOfferVersion(entry);
        return version ? [version] : [];
      })
    ),
  });
}

export async function getOwnJwExpressOffers(signal?: AbortSignal): Promise<JwExpressOffer[]> {
  const payload = await requestJson<unknown>(JW_EXPRESS_ENDPOINTS.offers, { signal });
  const source = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.offers)
      ? payload.offers
      : null;
  if (!source) throw new JwExpressApiError("Your offer history could not be read.", 502);
  return source.flatMap((entry) => {
    const offer = normalizeOffer(entry);
    return offer ? [offer] : [];
  });
}

export async function registerJwExpressAccountAndOffer(input: JwStoneSignupRequest): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.register, {
    method: "POST",
    idempotencyOperation: "register-offer",
    body: input,
  });
}

export async function signInJwExpress(input: SignInJwExpressInput): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.login, {
    method: "POST",
    idempotencyOperation: "sign-in",
    body: input,
  });
}

export async function signOutJwExpress(csrfToken: string): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.logout, {
    method: "POST",
    csrfToken,
    idempotencyOperation: "logout",
    body: {},
  });
}

export async function resendJwExpressVerification(email: string): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.resendVerification, {
    method: "POST",
    idempotencyOperation: "resend-verification",
    body: { email },
  });
}

export async function confirmJwExpressVerification(token: string): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.confirmVerification, {
    method: "POST",
    idempotencyOperation: "verify",
    body: { token },
  });
}

export async function requestJwExpressPasswordReset(email: string): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.requestPasswordReset, {
    method: "POST",
    idempotencyOperation: "request-password-reset",
    body: { email },
  });
}

export async function confirmJwExpressPasswordReset(args: {
  token: string;
  password: string;
  passwordConfirmation: string;
}): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.confirmPasswordReset, {
    method: "POST",
    idempotencyOperation: "complete-password-reset",
    body: args,
  });
}

export async function closeJwExpressAccount(args: {
  password: string;
  csrfToken: string;
}): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.closeAccount, {
    method: "POST",
    csrfToken: args.csrfToken,
    idempotencyOperation: "close-account",
    body: { password: args.password },
  });
}

export async function submitJwExpressOffer(args: {
  target: Pick<JwExpressOfferTarget, "kind" | "ref">;
  amount: string;
  csrfToken: string;
}): Promise<void> {
  await requestJson(JW_EXPRESS_ENDPOINTS.offers, {
    method: "POST",
    csrfToken: args.csrfToken,
    idempotencyOperation: "submit-offer",
    body: { target: args.target, amount: args.amount },
  });
}

export async function reviseJwExpressOffer(args: {
  offerId: string;
  amount: string;
  csrfToken: string;
}): Promise<void> {
  await requestJson(
    `${JW_EXPRESS_ENDPOINTS.offers}/${encodeURIComponent(args.offerId)}/revisions`,
    {
      method: "POST",
      csrfToken: args.csrfToken,
      idempotencyOperation: "revise-offer",
      body: { amount: args.amount },
    }
  );
}

export async function withdrawJwExpressOffer(args: {
  offerId: string;
  csrfToken: string;
}): Promise<void> {
  await requestJson(`${JW_EXPRESS_ENDPOINTS.offers}/${encodeURIComponent(args.offerId)}/withdraw`, {
    method: "POST",
    csrfToken: args.csrfToken,
    idempotencyOperation: "withdraw-offer",
    body: {},
  });
}
