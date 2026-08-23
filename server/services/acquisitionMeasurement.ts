import type { Request } from "express";
import type { VerifiedDiscoveryAttribution } from "@shared/discoveryLanding";
import { PUBLIC_PROFILE_CTA_KINDS, type PublicProfileCtaKind } from "@shared/discoveryLanding";
import { verifyDiscoveryAttributionToken } from "../utils/discoveryAttribution";
import {
  recordAttributionConversionEvent,
  type AttributionConversionLedgerEvent,
  type AttributionSessionProof,
} from "../utils/attributionConversionLedger";
import { pool } from "../db";

export const ACQUISITION_DISCOVERY_SESSION_KEY = "acquisitionDiscoveryAttribution" as const;
export const ACQUISITION_REGISTRATION_COMPLETED_EVENT =
  "acquisition.registration_completed" as const;
export const ACQUISITION_ACTIVATION_COMPLETED_EVENT = "acquisition.activation_completed" as const;

export type RegistrationFlow = "standard" | "multi_profile" | "oauth_google" | "oauth_facebook";
export type ActivationKind = "business_profile" | "express_result";
export type ActivationResultClass = "public_profile_ready" | "guided_result_ready";

type AcquisitionDiscoverySession = {
  token: string;
  entryRequestId: string;
  entitySlug: string;
  businessSlug?: string;
  profileSlug?: string;
  entityType: VerifiedDiscoveryAttribution["entityType"];
  canonicalRoute: string;
  issuedAt: string;
  sourceHint?: string;
  referrerClass?: string;
  landingRecorded: boolean;
  profileDiscoveryRecorded: boolean;
  ctaKinds: PublicProfileCtaKind[];
};

type DiscoverySessionStageResult = {
  duplicateLanding: boolean;
  duplicateProfileDiscovery: boolean;
  duplicateCta: boolean;
};

const RECOGNIZED_AUTOMATION_UA =
  /(?:\bbot\b|crawler|spider|slurp|headlesschrome|lighthouse|pagespeed|pingdom|uptimerobot|statuscake|curl\/|wget\/|python-requests|postmanruntime|insomnia\/|facebookexternalhit|twitterbot|linkedinbot|discordbot|whatsapp)/i;

/** Raw user-agent is used only for a coarse exclusion decision and is never persisted. */
export function isRecognizedAutomatedAcquisitionRequest(req: Request): boolean {
  const userAgent = String(req.headers["user-agent"] || "").trim();
  return Boolean(userAgent && RECOGNIZED_AUTOMATION_UA.test(userAgent));
}

function readSession(req: Request): Record<string, any> | null {
  const session = (req as any).session;
  return session && typeof session === "object" ? session : null;
}

function isSameDiscoveryEntry(
  existing: AcquisitionDiscoverySession | null,
  verified: VerifiedDiscoveryAttribution
): existing is AcquisitionDiscoverySession {
  return Boolean(
    existing &&
    existing.entryRequestId === verified.entryRequestId &&
    existing.entitySlug === verified.entitySlug &&
    existing.canonicalRoute === verified.canonicalRoute
  );
}

/**
 * Stores only a signed, bounded discovery identity in the server session and
 * returns server-side milestone dedupe state. The raw token stays in the
 * server session solely so registration can re-verify freshness and integrity.
 */
export function stageAcquisitionDiscoverySession(args: {
  req: Request;
  discoveryAttributionToken: string;
  verifiedAttribution: VerifiedDiscoveryAttribution;
  safeEvent: Record<string, unknown>;
  milestone: "landing" | "cta";
  ctaKind?: PublicProfileCtaKind;
}): DiscoverySessionStageResult {
  const session = readSession(args.req);
  if (!session) {
    return {
      duplicateLanding: false,
      duplicateProfileDiscovery: false,
      duplicateCta: false,
    };
  }

  const current = session[ACQUISITION_DISCOVERY_SESSION_KEY] as
    | AcquisitionDiscoverySession
    | undefined;
  const existing = isSameDiscoveryEntry(current || null, args.verifiedAttribution)
    ? (current as AcquisitionDiscoverySession)
    : null;
  const sameEntry = Boolean(existing);
  const existingCtaKinds = existing && Array.isArray(existing.ctaKinds) ? existing.ctaKinds : [];
  const ctaKinds = existingCtaKinds.filter((kind): kind is PublicProfileCtaKind =>
    PUBLIC_PROFILE_CTA_KINDS.includes(kind)
  );

  const duplicateLanding = Boolean(existing?.landingRecorded);
  const duplicateProfileDiscovery = Boolean(existing?.profileDiscoveryRecorded);
  const duplicateCta = Boolean(
    args.milestone === "cta" && args.ctaKind && ctaKinds.includes(args.ctaKind)
  );

  if (args.milestone === "cta" && args.ctaKind && !ctaKinds.includes(args.ctaKind)) {
    ctaKinds.push(args.ctaKind);
  }

  const sourceHint =
    typeof args.safeEvent.sourceHint === "string"
      ? args.safeEvent.sourceHint
      : sameEntry
        ? existing?.sourceHint
        : undefined;
  const referrerClass =
    typeof args.safeEvent.referrerClass === "string"
      ? args.safeEvent.referrerClass
      : sameEntry
        ? existing?.referrerClass
        : undefined;

  session[ACQUISITION_DISCOVERY_SESSION_KEY] = {
    token: String(args.discoveryAttributionToken).slice(0, 4096),
    entryRequestId: args.verifiedAttribution.entryRequestId,
    entitySlug: args.verifiedAttribution.entitySlug,
    ...(args.verifiedAttribution.entityType === "public_profile"
      ? { profileSlug: args.verifiedAttribution.profileSlug }
      : { businessSlug: args.verifiedAttribution.businessSlug }),
    entityType: args.verifiedAttribution.entityType,
    canonicalRoute: args.verifiedAttribution.canonicalRoute,
    issuedAt: args.verifiedAttribution.issuedAt,
    ...(sourceHint ? { sourceHint } : {}),
    ...(referrerClass ? { referrerClass } : {}),
    landingRecorded: existing
      ? existing.landingRecorded || args.milestone === "landing"
      : args.milestone === "landing",
    profileDiscoveryRecorded:
      args.verifiedAttribution.entityType !== "business_marketplace" &&
      (sameEntry
        ? existing?.profileDiscoveryRecorded || args.milestone === "landing"
        : args.milestone === "landing"),
    ctaKinds: ctaKinds.slice(0, PUBLIC_PROFILE_CTA_KINDS.length),
  } satisfies AcquisitionDiscoverySession;

  return { duplicateLanding, duplicateProfileDiscovery, duplicateCta };
}

function getVerifiedSessionDiscovery(req: Request): AcquisitionDiscoverySession | null {
  const session = readSession(req);
  const stored = session?.[ACQUISITION_DISCOVERY_SESSION_KEY] as
    | AcquisitionDiscoverySession
    | undefined;
  if (!stored?.token) return null;

  const verified = verifyDiscoveryAttributionToken(stored.token);
  if (
    !verified ||
    verified.entryRequestId !== stored.entryRequestId ||
    verified.entitySlug !== stored.entitySlug ||
    verified.entityType !== stored.entityType ||
    verified.canonicalRoute !== stored.canonicalRoute
  ) {
    return null;
  }
  return stored;
}

/**
 * Re-establishes a signed discovery identity after a custom-domain handoff.
 * Verification is local and synchronous; no client-provided source or profile
 * fields are accepted. Existing same-entry source hints remain server-owned.
 */
export function stageAcquisitionDiscoveryTokenHandoff(
  req: Request,
  rawToken: unknown
): AcquisitionDiscoverySession | null {
  const token = String(rawToken || "").trim();
  const verified = verifyDiscoveryAttributionToken(token);
  if (!verified) return null;

  stageAcquisitionDiscoverySession({
    req,
    discoveryAttributionToken: token,
    verifiedAttribution: verified,
    safeEvent: {},
    milestone: "cta",
  });
  return getVerifiedSessionDiscovery(req);
}

export function isNewSocialRegistrationUser(user: unknown): boolean {
  return Boolean(user && typeof user === "object" && (user as any)._wasNewSocialUser === true);
}

function normalizeUserId(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) return null;
  return value;
}

/**
 * Lifetime-idempotent lifecycle projection persistence. Migration 0121 provides the
 * partial unique invariant for these two event types, so concurrent retries
 * become a single indexed INSERT instead of scanning the event ledger.
 */
export async function persistAcquisitionLifecycleEventOnce(
  event: Record<string, unknown>
): Promise<boolean> {
  const userId = normalizeUserId(event.userId);
  const eventType = String(event.type || "");
  if (
    !userId ||
    (eventType !== ACQUISITION_REGISTRATION_COMPLETED_EVENT &&
      eventType !== ACQUISITION_ACTIVATION_COMPLETED_EVENT)
  ) {
    return false;
  }

  const result = await pool.query(
    `insert into events (event_type, user_id, data)
     values ($1, $2, $3::jsonb)
     on conflict do nothing
     returning id`,
    [eventType, userId, JSON.stringify(event)]
  );
  return Boolean(result.rowCount && result.rowCount > 0);
}

export const persistAcquisitionRegistrationEventOnce = persistAcquisitionLifecycleEventOnce;
export const persistAcquisitionActivationEventOnce = persistAcquisitionLifecycleEventOnce;

export async function hasAcquisitionRegistrationProjection(userId: string): Promise<boolean> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return false;
  const result = await pool.query(
    `select 1
       from events
      where event_type = $1
        and user_id = $2
        and data->>'type' = $1
        and data->>'serverConfirmed' = 'true'
        and data->>'projectionOf' = 'users.created_at'
        and data->>'flow' in ('standard', 'multi_profile', 'oauth_google', 'oauth_facebook')
      limit 1`,
    [ACQUISITION_REGISTRATION_COMPLETED_EVENT, normalizedUserId]
  );
  return Boolean(result.rowCount && result.rowCount > 0);
}

/**
 * Server-only registration attribution projection. users.created_at remains
 * the authority that an account exists; callers invoke this only after the
 * account transaction and authenticated session have succeeded. Persistence
 * is fail-soft, so projection coverage must be reconciled in reporting and
 * telemetry can never undo registration.
 */
export async function recordServerConfirmedRegistration(args: {
  req: Request;
  userId: string;
  flow: RegistrationFlow;
  profileCount: number;
  emailVerificationRequired: boolean;
  discoveryAttributionToken?: string | null;
  persistEventOnce: (event: Record<string, unknown>) => Promise<boolean>;
  sessionAttribution?: AttributionSessionProof | null;
  cookieAttributionTag?: string | null;
  persistAffiliateConversion?: (event: AttributionConversionLedgerEvent) => Promise<void>;
  now?: () => Date;
}): Promise<{ eventRecorded: boolean; affiliateConversionRecorded: boolean }> {
  const userId = normalizeUserId(args.userId);
  if (!userId) return { eventRecorded: false, affiliateConversionRecorded: false };

  const now = args.now ? args.now() : new Date();
  const discovery =
    getVerifiedSessionDiscovery(args.req) ||
    stageAcquisitionDiscoveryTokenHandoff(args.req, args.discoveryAttributionToken);
  const profileCount = Math.max(1, Math.min(24, Math.trunc(Number(args.profileCount) || 1)));
  const event: Record<string, unknown> = {
    type: ACQUISITION_REGISTRATION_COMPLETED_EVENT,
    schemaVersion: 1,
    serverConfirmed: true,
    projectionOf: "users.created_at",
    flow: args.flow,
    userId,
    registrationKey: `user:${userId}`,
    profileCount,
    emailVerificationRequired: args.emailVerificationRequired === true,
    attributionStatus: discovery ? "verified_public_discovery" : "unattributed",
    ts: now.toISOString(),
  };

  if (discovery) {
    Object.assign(event, {
      attributionModel: "last_verified_public_profile_touch",
      entryRequestId: discovery.entryRequestId,
      entitySlug: discovery.entitySlug,
      ...(discovery.entityType === "public_profile"
        ? { profileSlug: discovery.profileSlug }
        : { businessSlug: discovery.businessSlug }),
      entityType: discovery.entityType,
      canonicalRoute: discovery.canonicalRoute,
      landingIssuedAt: discovery.issuedAt,
      ...(discovery.sourceHint ? { sourceHint: discovery.sourceHint } : {}),
      ...(discovery.referrerClass ? { referrerClass: discovery.referrerClass } : {}),
    });
  }

  let eventRecorded = false;
  try {
    eventRecorded = await args.persistEventOnce(event);
  } catch (error) {
    console.error("[acquisition] Failed to persist registration completion", error);
  }

  let affiliateConversionRecorded = false;
  if (
    eventRecorded &&
    args.persistAffiliateConversion &&
    (args.sessionAttribution?.referralCode || args.cookieAttributionTag)
  ) {
    try {
      const result = await recordAttributionConversionEvent({
        input: {
          sessionAttribution: args.sessionAttribution || null,
          cookieAttributionTag: args.cookieAttributionTag || null,
          conversionType: "signup_completed",
          source: args.sessionAttribution?.source || "signup",
          targetPath:
            args.flow === "multi_profile"
              ? "/api/auth/register-multi"
              : args.flow === "oauth_google"
                ? "/api/auth/google/callback"
                : args.flow === "oauth_facebook"
                  ? "/api/auth/facebook/callback"
                  : "/api/auth/register",
          targetId: userId,
        },
        persist: args.persistAffiliateConversion,
        now: () => now,
      });
      affiliateConversionRecorded = result.ok;
    } catch (error) {
      console.error("[acquisition] Failed to persist attributed registration", error);
    }
  }

  return { eventRecorded, affiliateConversionRecorded };
}

/**
 * Server-only activation attribution projection. Canonical onboardingOutcome
 * state remains activation authority; missing registration projections are
 * named and never represented by a dangling registrationKey.
 */
export async function recordServerConfirmedActivation(args: {
  req: Request;
  userId: string;
  activationKind: ActivationKind;
  resultClass: ActivationResultClass;
  persistEventOnce: (event: Record<string, unknown>) => Promise<boolean>;
  hasRegistrationProjection?: (userId: string) => Promise<boolean>;
  now?: () => Date;
}): Promise<{ eventRecorded: boolean }> {
  const userId = normalizeUserId(args.userId);
  if (!userId) return { eventRecorded: false };

  const discovery = getVerifiedSessionDiscovery(args.req);
  let registrationProjectionStatus:
    | "linked"
    | "registration_missing"
    | "registration_lookup_failed" = "registration_missing";
  try {
    const hasRegistration = await (
      args.hasRegistrationProjection || hasAcquisitionRegistrationProjection
    )(userId);
    registrationProjectionStatus = hasRegistration ? "linked" : "registration_missing";
  } catch (error) {
    registrationProjectionStatus = "registration_lookup_failed";
    console.error("[acquisition] Failed to resolve registration projection", error);
  }

  const event: Record<string, unknown> = {
    type: ACQUISITION_ACTIVATION_COMPLETED_EVENT,
    schemaVersion: 1,
    serverConfirmed: true,
    projectionOf: "users.preferences.onboardingOutcome.completedAt",
    userId,
    activationKey: `user:${userId}`,
    registrationProjectionStatus,
    ...(registrationProjectionStatus === "linked" ? { registrationKey: `user:${userId}` } : {}),
    activationKind: args.activationKind,
    resultClass: args.resultClass,
    attributionStatus: discovery ? "verified_public_discovery" : "unattributed",
    ts: (args.now ? args.now() : new Date()).toISOString(),
  };

  if (discovery) {
    Object.assign(event, {
      attributionModel: "last_verified_public_profile_touch",
      entryRequestId: discovery.entryRequestId,
      entitySlug: discovery.entitySlug,
      ...(discovery.entityType === "public_profile"
        ? { profileSlug: discovery.profileSlug }
        : { businessSlug: discovery.businessSlug }),
      entityType: discovery.entityType,
      canonicalRoute: discovery.canonicalRoute,
      landingIssuedAt: discovery.issuedAt,
      ...(discovery.sourceHint ? { sourceHint: discovery.sourceHint } : {}),
      ...(discovery.referrerClass ? { referrerClass: discovery.referrerClass } : {}),
    });
  }

  try {
    return { eventRecorded: await args.persistEventOnce(event) };
  } catch (error) {
    console.error("[acquisition] Failed to persist activation completion", error);
    return { eventRecorded: false };
  }
}
