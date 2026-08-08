import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  isValidDiscoveryAttributionIdentity,
  normalizeDiscoveryAttributionToken,
  normalizeDiscoveryBusinessSlug,
  normalizeDiscoveryCanonicalRoute,
  normalizeDiscoveryEntryRequestId,
  type DiscoveryLandingEntityType,
  type VerifiedDiscoveryAttribution,
} from "@shared/discoveryLanding";

const TOKEN_VERSION = 1;
const MAX_TOKEN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function getSigningSecret(): string | null {
  const secret = String(
    process.env.DISCOVERY_ATTRIBUTION_SECRET || process.env.SESSION_SECRET || ""
  ).trim();
  return secret || null;
}

function encodePayload(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function issueDiscoveryAttributionToken(args: {
  businessSlug: string;
  entityType: DiscoveryLandingEntityType;
  canonicalRoute: string;
  issuedAt?: string;
}): string | null {
  const businessSlug = normalizeDiscoveryBusinessSlug(args.businessSlug);
  const canonicalRoute = normalizeDiscoveryCanonicalRoute(args.canonicalRoute);
  const secret = getSigningSecret();
  if (!secret || !businessSlug || !canonicalRoute) return null;

  const issuedAt = args.issuedAt || new Date().toISOString();
  const issuedMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedMs)) return null;

  const identity: VerifiedDiscoveryAttribution = {
    entryRequestId: randomUUID(),
    businessSlug,
    entityType: args.entityType,
    canonicalRoute,
    issuedAt: new Date(issuedMs).toISOString(),
  };
  if (!isValidDiscoveryAttributionIdentity(identity)) return null;

  const encodedPayload = encodePayload({ v: TOKEN_VERSION, ...identity });
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function verifyDiscoveryAttributionToken(
  rawToken: unknown,
  expected?: {
    businessSlug?: string | null;
    entityType?: DiscoveryLandingEntityType | null;
    canonicalRoute?: string | null;
  }
): VerifiedDiscoveryAttribution | null {
  const token = normalizeDiscoveryAttributionToken(rawToken);
  const secret = getSigningSecret();
  if (!token || !secret) return null;

  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) return null;
  const expectedSignature = signPayload(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expectedBytes = Buffer.from(expectedSignature, "base64url");
  if (supplied.length !== expectedBytes.length || !timingSafeEqual(supplied, expectedBytes)) {
    return null;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== TOKEN_VERSION) return null;

  const businessSlug = normalizeDiscoveryBusinessSlug(parsed.businessSlug);
  const canonicalRoute = normalizeDiscoveryCanonicalRoute(parsed.canonicalRoute);
  const entryRequestId = normalizeDiscoveryEntryRequestId(parsed.entryRequestId);
  const issuedAt = typeof parsed.issuedAt === "string" ? parsed.issuedAt : "";
  const issuedMs = Date.parse(issuedAt);
  if (!businessSlug || !canonicalRoute || !entryRequestId || !Number.isFinite(issuedMs)) {
    return null;
  }

  const identity: VerifiedDiscoveryAttribution = {
    entryRequestId,
    businessSlug,
    entityType: parsed.entityType,
    canonicalRoute,
    issuedAt: new Date(issuedMs).toISOString(),
  };
  if (!isValidDiscoveryAttributionIdentity(identity)) return null;

  const now = Date.now();
  if (issuedMs > now + MAX_CLOCK_SKEW_MS || now - issuedMs > MAX_TOKEN_AGE_MS) return null;

  if (
    (expected?.businessSlug &&
      identity.businessSlug !== expected.businessSlug.trim().toLowerCase()) ||
    (expected?.entityType && identity.entityType !== expected.entityType) ||
    (expected?.canonicalRoute && identity.canonicalRoute !== expected.canonicalRoute)
  ) {
    return null;
  }

  return identity;
}
