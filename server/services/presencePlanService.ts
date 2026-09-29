import { and, eq, sql } from "drizzle-orm";
import { businessPresencePlans, businesses, profiles, users } from "@shared/schema";
import { derivePresencePlan, type PresencePlan, type PresenceSitePath } from "./presencePlan";

type OwnedReadStorage = {
  getUser: (userId: string) => Promise<any>;
  getBusinessByIdForOwner: (userId: string, businessId: string) => Promise<any>;
  getProfileByIdForOwner: (userId: string, profileId: string) => Promise<any>;
};

type OwnedContext = {
  ownerUserId: string;
  businessId: string;
  profileId: string;
  onboardingEvidence: unknown;
  externalWebsiteUrl: string | null;
};

type PlanRecord = typeof businessPresencePlans.$inferSelect;

export class PresencePlanError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "PresencePlanError";
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonempty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function outcomeFromPreferences(preferences: unknown): Record<string, unknown> | null {
  const outcome = object(object(preferences)?.onboardingOutcome);
  if (outcome?.kind !== "business_profile") return null;
  if (!object(object(outcome.provenance)?.evidence)) return null;
  return outcome;
}

/** The only identity path used by this slice. All three storage calls are reads. */
export async function loadOwnedPresenceContext(
  storage: OwnedReadStorage,
  ownerUserId: string
): Promise<OwnedContext> {
  const user = await storage.getUser(ownerUserId);
  const outcome = outcomeFromPreferences(user?.preferences);
  const businessId = nonempty(outcome?.businessId);
  const profileId = nonempty(outcome?.profileId);
  if (!user || !outcome || !businessId || !profileId) {
    throw new PresencePlanError(
      "COMPLETED_BUSINESS_ONBOARDING_REQUIRED",
      "Complete and own a business profile before preparing its presence plan.",
      409
    );
  }

  const [business, profile] = await Promise.all([
    storage.getBusinessByIdForOwner(ownerUserId, businessId),
    storage.getProfileByIdForOwner(ownerUserId, profileId),
  ]);
  if (
    !business ||
    !profile ||
    nonempty(business.id) !== businessId ||
    nonempty(profile.id) !== profileId ||
    nonempty(business.ownerUserId) !== ownerUserId ||
    nonempty(profile.ownerUserId) !== ownerUserId ||
    nonempty(profile.businessId) !== businessId
  ) {
    throw new PresencePlanError(
      "PRESENCE_OWNERSHIP_MISMATCH",
      "The completed business and profile are no longer linked to this account.",
      403
    );
  }

  return {
    ownerUserId,
    businessId,
    profileId,
    onboardingEvidence: outcome,
    externalWebsiteUrl: nonempty(object(business.profileData)?.website) || null,
  };
}

function derive(context: OwnedContext): PresencePlan {
  return derivePresencePlan({
    businessId: context.businessId,
    profileId: context.profileId,
    onboardingEvidence: context.onboardingEvidence,
    externalWebsiteUrl: context.externalWebsiteUrl,
  });
}

function wherePlan(context: OwnedContext) {
  return and(
    eq(businessPresencePlans.ownerUserId, context.ownerUserId),
    eq(businessPresencePlans.businessId, context.businessId)
  );
}

async function assertLiveEvidence(tx: any, context: OwnedContext, expectedDigest: string) {
  const [user] = await tx
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, context.ownerUserId))
    .limit(1);
  const [business] = await tx
    .select({ ownerUserId: businesses.ownerUserId, profileData: businesses.profileData })
    .from(businesses)
    .where(eq(businesses.id, context.businessId))
    .limit(1);
  const [profile] = await tx
    .select({ ownerUserId: profiles.ownerUserId, businessId: profiles.businessId })
    .from(profiles)
    .where(eq(profiles.id, context.profileId))
    .limit(1);
  const outcome = outcomeFromPreferences(user?.preferences);
  if (
    !outcome ||
    nonempty(outcome.businessId) !== context.businessId ||
    nonempty(outcome.profileId) !== context.profileId ||
    business?.ownerUserId !== context.ownerUserId ||
    profile?.ownerUserId !== context.ownerUserId ||
    profile?.businessId !== context.businessId
  ) {
    throw new PresencePlanError(
      "PRESENCE_OWNERSHIP_MISMATCH",
      "The completed business and profile are no longer linked to this account.",
      403
    );
  }
  const live = derive({
    ...context,
    onboardingEvidence: outcome,
    externalWebsiteUrl: nonempty(object(business.profileData)?.website) || null,
  });
  if (live.evidenceDigest !== expectedDigest) {
    throw new PresencePlanError(
      "PRESENCE_PLAN_STALE",
      "Business evidence changed. Refresh the presence plan before reviewing it.",
      409
    );
  }
  return live;
}

function response(record: PlanRecord, current: PresencePlan) {
  const stale = record.evidenceDigest !== current.evidenceDigest;
  return {
    id: record.id,
    businessId: record.businessId,
    profileId: record.profileId,
    revision: record.revision,
    evidenceDigest: record.evidenceDigest,
    planHash: record.planHash,
    plan: record.plan,
    status: stale ? ("stale" as const) : record.reviewedAt ? ("reviewed" as const) : ("draft" as const),
    selectedSitePath: stale ? null : record.sitePath,
    reviewedAt: stale ? null : record.reviewedAt,
    // A reviewed plan confirms accuracy and path selection only. No action is executable.
    executionAuthorized: false as const,
  };
}

export async function getOwnedPresencePlan(storage: OwnedReadStorage, ownerUserId: string) {
  const context = await loadOwnedPresenceContext(storage, ownerUserId);
  const current = derive(context);
  const { db } = await import("../db");
  const [record] = await db.select().from(businessPresencePlans).where(wherePlan(context)).limit(1);
  return record ? response(record, current) : null;
}

export async function refreshOwnedPresencePlan(storage: OwnedReadStorage, ownerUserId: string) {
  const context = await loadOwnedPresenceContext(storage, ownerUserId);
  const candidate = derive(context);
  const { db } = await import("../db");
  const record = await db.transaction(async (tx: any): Promise<PlanRecord> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${context.ownerUserId}|${context.businessId}`}))`);
    const live = await assertLiveEvidence(tx, context, candidate.evidenceDigest);
    const [existing] = await tx
      .select()
      .from(businessPresencePlans)
      .where(wherePlan(context))
      .limit(1);
    if (existing?.evidenceDigest === live.evidenceDigest && existing.planHash === live.planHash) {
      return existing;
    }
    if (existing) {
      const [updated] = await tx
        .update(businessPresencePlans)
        .set({
          profileId: context.profileId,
          evidenceDigest: live.evidenceDigest,
          planHash: live.planHash,
          plan: live as unknown as Record<string, unknown>,
          revision: existing.revision + 1,
          sitePath: null,
          sitePathSelectedBy: null,
          reviewedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(businessPresencePlans.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(businessPresencePlans)
      .values({
        ownerUserId: context.ownerUserId,
        businessId: context.businessId,
        profileId: context.profileId,
        evidenceDigest: live.evidenceDigest,
        planHash: live.planHash,
        plan: live as unknown as Record<string, unknown>,
      })
      .returning();
    return created;
  });
  return response(record, candidate);
}

export async function reviewOwnedPresencePlan(
  storage: OwnedReadStorage,
  args: {
    ownerUserId: string;
    expectedDigest: string;
    expectedRevision: number;
    sitePath: PresenceSitePath;
  }
) {
  const context = await loadOwnedPresenceContext(storage, args.ownerUserId);
  const current = derive(context);
  if (current.evidenceDigest !== args.expectedDigest) {
    throw new PresencePlanError("PRESENCE_PLAN_STALE", "Business evidence changed. Refresh the plan.", 409);
  }
  if (!current.sitePath.allowed.includes(args.sitePath)) {
    throw new PresencePlanError(
      "SITE_PATH_UNAVAILABLE",
      "That site path needs a valid existing website or more business evidence.",
      422
    );
  }
  const { db } = await import("../db");
  const record = await db.transaction(async (tx: any): Promise<PlanRecord> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${context.ownerUserId}|${context.businessId}`}))`);
    await assertLiveEvidence(tx, context, args.expectedDigest);
    const [existing] = await tx
      .select()
      .from(businessPresencePlans)
      .where(wherePlan(context))
      .limit(1);
    if (
      !existing ||
      existing.evidenceDigest !== args.expectedDigest ||
      existing.revision !== args.expectedRevision ||
      existing.planHash !== current.planHash
    ) {
      throw new PresencePlanError("PRESENCE_PLAN_STALE", "Refresh the plan before reviewing it.", 409);
    }
    if (existing.reviewedAt && existing.sitePath === args.sitePath) return existing;
    const [updated] = await tx
      .update(businessPresencePlans)
      .set({
        sitePath: args.sitePath,
        sitePathSelectedBy: args.ownerUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(businessPresencePlans.id, existing.id))
      .returning();
    return updated;
  });
  return response(record, current);
}
