import type { Request, Response } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { affiliateAccounts, affiliateReferrals, users } from "@shared/schema";
import { mirrorInfinityTouch } from "../integrations/infinityShadow";

// Shared by every surface that can attribute a visit or signup to an
// affiliate: the normal www routes (server/routes.ts), the generic /r/:slug
// share-link redirect, the universal /ref/:tag bridge, and a profile's own
// verified custom domain (server/index.ts), which renders outside the normal
// route stack and would otherwise get none of this.

export function getCookieValue(req: Request, key: string): string | null {
  const header = String(req.headers.cookie || "");
  if (!header) return null;
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    if (k !== key) continue;
    try {
      return decodeURIComponent(part.slice(idx + 1));
    } catch {
      return part.slice(idx + 1);
    }
  }
  return null;
}

export function setReferralCookie(res: Response, referralCode: string) {
  const safe = String(referralCode || "").trim();
  if (!safe) return;
  const maxAgeDays = 30;
  const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;
  const cookie = [
    `ts_ref=${encodeURIComponent(safe)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "SameSite=Lax",
    // Let the CDN/app decide; in production always secure.
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  const arr = Array.isArray(existing) ? existing : [String(existing)];
  res.setHeader("Set-Cookie", [...arr, cookie]);
}

export async function recordReferralClick(params: {
  referralCode: string;
  destination: string;
  source: string;
  conversionType?: string;
}) {
  const referralCode = String(params.referralCode || "").trim();
  if (!referralCode) return;

  const [account] = await db
    .select()
    .from(affiliateAccounts)
    .where(eq(affiliateAccounts.referralCode, referralCode))
    .limit(1);

  if (!account) return;

  await storage.trackReferralClick({
    affiliateId: account.id,
    referredUserId: null,
    shareLinkId: null,
    customLink: params.destination || null,
    conversionSource: params.source || "unknown",
    conversionType: params.conversionType || "click",
    couponCode: null,
  } as any);
  void mirrorInfinityTouch({
    partnerId: String(account.affiliateId || account.id),
    affiliateTag: referralCode,
    canonicalPath: params.destination,
    source: params.source || "unknown",
    carrier: params.source === "universal_ref" ? "path_segment" : "query_ref",
  });
}

export async function persistLifetimeReferralOwner(params: {
  referredUserId: string;
  referralCode: string;
  conversionSource: string;
  conversionType: string;
  destination?: string;
}) {
  const referredUserId = String(params.referredUserId || "").trim();
  const referralCode = String(params.referralCode || "").trim();
  if (!referredUserId || !referralCode) return;

  try {
    const [account] = await db
      .select({
        id: affiliateAccounts.id,
        affiliateId: affiliateAccounts.affiliateId,
      })
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.referralCode, referralCode))
      .limit(1);

    if (!account?.id) return;
    if (String(account.affiliateId) === referredUserId) return; // no self-attribution

    const [current] = await db
      .select({ referredByAffiliateAccountId: users.referredByAffiliateAccountId })
      .from(users)
      .where(eq(users.id, referredUserId))
      .limit(1);

    const existingOwner = current?.referredByAffiliateAccountId
      ? String(current.referredByAffiliateAccountId)
      : "";

    // First-touch lifetime: never overwrite once set to a different affiliate.
    if (existingOwner && existingOwner !== account.id) return;

    if (!existingOwner) {
      await db
        .update(users)
        .set({
          referredByAffiliateAccountId: account.id,
          referredAt: new Date(),
        } as any)
        .where(and(eq(users.id, referredUserId), isNull(users.referredByAffiliateAccountId)));
    }

    const [existingReferral] = await db
      .select({ id: affiliateReferrals.id })
      .from(affiliateReferrals)
      .where(
        and(
          eq(affiliateReferrals.affiliateId, account.id),
          eq(affiliateReferrals.referredUserId, referredUserId)
        )
      )
      .limit(1);

    if (!existingReferral?.id) {
      await db
        .insert(affiliateReferrals)
        .values({
          affiliateId: account.id,
          referredUserId,
          shareLinkId: null,
          customLink: params.destination || null,
          conversionSource: params.conversionSource || "unknown",
          conversionType: params.conversionType || "signup",
          couponCode: null,
        } as any)
        .catch(() => {});
    }
  } catch {
    // Never block auth flows on referral persistence.
  }
}

/**
 * Supplemental referral attribution after the registration flow succeeds.
 * This does not define account existence; the canonical users row does, while
 * the acquisition lifecycle event is also only a fail-soft projection.
 * Failures here never fail or roll back account creation.
 */
export async function recordSignupReferralAttribution(params: {
  req: Request;
  referredUserId: string;
  destination?: string;
}): Promise<boolean> {
  const referralCode = getCookieValue(params.req, "ts_ref");
  const referredUserId = String(params.referredUserId || "").trim();
  if (!referralCode || !referredUserId) return false;

  try {
    const destination = params.destination || "/create-account";
    await persistLifetimeReferralOwner({
      referredUserId,
      referralCode,
      conversionSource: "signup",
      conversionType: "signup",
      destination,
    });
    await recordReferralClick({
      referralCode,
      destination,
      source: "signup",
      conversionType: "signup",
    });
    await storage.convertReferral(referralCode, referredUserId);
    return true;
  } catch (error) {
    console.error("[affiliate] Failed to convert referral on signup", error);
    return false;
  }
}

// Handles an explicit ?ref=CODE on any request: records a click, and (if no
// existing attribution cookie) sets the first-touch cookie. Also short-
// circuits if the visitor already carries an attribution cookie (first-touch
// wins for the lifetime of the cookie). Returns true if the caller should
// stop here -- there's nothing left for owner-fallback attribution to do.
export async function handleExplicitOrExistingReferral(
  req: Request,
  res: Response
): Promise<boolean> {
  const explicitRef =
    typeof (req.query as any)?.ref === "string" ? String((req.query as any).ref).trim() : "";
  const existingRef = getCookieValue(req, "ts_ref");

  if (explicitRef) {
    await recordReferralClick({
      referralCode: explicitRef,
      destination: req.originalUrl || req.path || "",
      source: "query_ref",
      conversionType: "click",
    }).catch(() => {});
    if (!existingRef) {
      setReferralCookie(res, explicitRef);
    }
    return true;
  }

  return Boolean(existingRef);
}

// A visitor landing on a page with no ?ref=... and no existing attribution
// cookie is attributed to that page's owner -- clean URLs still count.
// No-op for self-views (an owner browsing their own page) or if the owner
// has no affiliate account and one can't be created.
export async function attributeCleanPageViewToOwner(params: {
  req: Request;
  res: Response;
  ownerUserId: string;
  destination: string;
  source: string;
  conversionType: string;
}): Promise<void> {
  const { req, res, ownerUserId, destination, source, conversionType } = params;
  if (!ownerUserId) return;

  const authedUserId =
    ((req as any)?.user as any)?.id || ((req as any)?.user as any)?.claims?.sub || null;
  if (authedUserId && String(authedUserId) === ownerUserId) return;

  let program = await storage.getAffiliateProgram(ownerUserId).catch(() => undefined);
  if (!program) {
    program = await storage
      .createAffiliateProgram({ userId: ownerUserId } as any)
      .catch(() => undefined);
  }
  const referralCode = String((program as any)?.referralCode || "").trim();
  if (!referralCode) return;

  setReferralCookie(res, referralCode);
  await recordReferralClick({
    referralCode,
    destination,
    source,
    conversionType,
  }).catch(() => {});
}
