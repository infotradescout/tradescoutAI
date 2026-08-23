import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  isValidDiscoveryAttributionIdentity,
  normalizeDiscoveryAttributionToken,
  normalizeDiscoveryBusinessSlug,
  normalizeDiscoveryCanonicalRoute,
  normalizeDiscoveryEntitySlug,
  normalizeDiscoveryEntryRequestId,
  normalizeDiscoveryProfileSlug,
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
  entitySlug?: string;
  businessSlug?: string;
  profileSlug?: string;
  entityType: DiscoveryLandingEntityType;
  canonicalRoute: string;
  issuedAt?: string;
}): string | null {
  const entitySlug = normalizeDiscoveryEntitySlug(
    args.entitySlug || args.profileSlug || args.businessSlug
  );
  const canonicalRoute = normalizeDiscoveryCanonicalRoute(args.canonicalRoute);
  const secret = getSigningSecret();
  if (!secret || !entitySlug || !canonicalRoute) return null;

  const issuedAt = args.issuedAt || new Date().toISOString();
  const issuedMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedMs)) return null;

  const identity: VerifiedDiscoveryAttribution = {
    entryRequestId: randomUUID(),
    entitySlug,
    ...(args.entityType === "public_profile"
      ? { profileSlug: normalizeDiscoveryProfileSlug(args.profileSlug || entitySlug) }
      : { businessSlug: normalizeDiscoveryBusinessSlug(args.businessSlug || entitySlug) }),
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
    entitySlug?: string | null;
    businessSlug?: string | null;
    profileSlug?: string | null;
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

  const entitySlug = normalizeDiscoveryEntitySlug(
    parsed.entitySlug || parsed.profileSlug || parsed.businessSlug
  );
  const businessSlug = normalizeDiscoveryBusinessSlug(parsed.businessSlug);
  const profileSlug = normalizeDiscoveryProfileSlug(parsed.profileSlug);
  const canonicalRoute = normalizeDiscoveryCanonicalRoute(parsed.canonicalRoute);
  const entryRequestId = normalizeDiscoveryEntryRequestId(parsed.entryRequestId);
  const issuedAt = typeof parsed.issuedAt === "string" ? parsed.issuedAt : "";
  const issuedMs = Date.parse(issuedAt);
  if (!entitySlug || !canonicalRoute || !entryRequestId || !Number.isFinite(issuedMs)) {
    return null;
  }

  const identity: VerifiedDiscoveryAttribution = {
    entryRequestId,
    entitySlug,
    ...(parsed.entityType === "public_profile"
      ? { profileSlug: profileSlug || entitySlug }
      : { businessSlug: businessSlug || entitySlug }),
    entityType: parsed.entityType,
    canonicalRoute,
    issuedAt: new Date(issuedMs).toISOString(),
  };
  if (!isValidDiscoveryAttributionIdentity(identity)) return null;

  const now = Date.now();
  if (issuedMs > now + MAX_CLOCK_SKEW_MS || now - issuedMs > MAX_TOKEN_AGE_MS) return null;

  if (
    (expected?.entitySlug && identity.entitySlug !== expected.entitySlug.trim().toLowerCase()) ||
    (expected?.businessSlug &&
      identity.businessSlug !== expected.businessSlug.trim().toLowerCase()) ||
    (expected?.profileSlug && identity.profileSlug !== expected.profileSlug.trim().toLowerCase()) ||
    (expected?.entityType && identity.entityType !== expected.entityType) ||
    (expected?.canonicalRoute && identity.canonicalRoute !== expected.canonicalRoute)
  ) {
    return null;
  }

  return identity;
}
