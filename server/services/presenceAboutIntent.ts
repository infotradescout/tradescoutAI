import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  businessPresenceAboutIntentEvents as events,
  businessPresencePlans as plans,
  businesses,
  profiles,
  users,
} from "@shared/schema";
import { readProfileSectionConfigBlock } from "@shared/profileSectionConfig";
import { readSiteTemplateIdFromBlocks } from "@shared/profileSiteTemplates";
import { isIssaBuildProfileSlug } from "@shared/issaBuildProfile";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import { profileTargetIdentitiesEqual, type ProfileTargetIdentity } from "@shared/profileTargetIdentity";
import { profileTargetIdentityFromRow } from "../profileTargetIdentity";
import { profileTargetIdentityPredicate } from "../profileContentBlocksConcurrency";
import { derivePublishedProfileExposure } from "./ownerConfirmedDirectProfile";
import { getCurrentApprovedPresenceFact, requireCurrentPlan } from "./presenceFactReview";
import { derivePresencePlan } from "./presencePlan";
import {
  assertLiveEvidence,
  loadOwnedPresenceContext,
  PresencePlanError,
  type OwnedContext,
} from "./presencePlanService";

type OwnedStorage = Parameters<typeof loadOwnedPresenceContext>[0];
type IntentRow = typeof events.$inferSelect;
export type PresenceAboutTargetMode = "create" | "replace";
export type PresenceAboutFactKey = "about" | "description";
type AboutReason =
  | "NO_APPROVED_ABOUT"
  | "ABOUT_BLOCK_MULTIPLE"
  | "ABOUT_BLOCK_UNSUPPORTED"
  | "ABOUT_HIDDEN"
  | "UNSUPPORTED_TEMPLATE"
  | "UNSUPPORTED_SITE_PATH";

const SPECIAL_SLUGS = new Set([
  "jw-stone",
  "jrs-auto-glass",
  "red-graniti",
  "dean-damaskos",
  "honey-onyx",
  "la-plumbing-solutions",
]);

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function projectSupportedAboutTarget(
  profile: Pick<typeof profiles.$inferSelect,
    "id" | "slug" | "status" | "contentBlocks" | "contentBlocksRevision" |
    "ownerUserId" | "businessId" | "roleContext" | "publiclyReleased" | "seoMeta">,
  ownerPreferences: unknown,
  businessProfileData: unknown
):
  | {
      ok: true;
      presentationDigest: string;
      target: {
        targetMode: PresenceAboutTargetMode;
        contentBlocksRevision: number;
        profileTargetIdentity: ProfileTargetIdentity;
        currentText: string;
        contentBlocksDigest: string;
        aboutBlockDigest: string;
        aboutBlockId: string;
        field: "text" | "description" | "body";
      };
    }
  | { ok: false; reason: AboutReason } {
  const blocks = profile.contentBlocks;
  if (!Array.isArray(blocks)) return { ok: false, reason: "ABOUT_BLOCK_UNSUPPORTED" };
  if (!Number.isSafeInteger(profile.contentBlocksRevision) || profile.contentBlocksRevision < 1)
    return { ok: false, reason: "ABOUT_BLOCK_UNSUPPORTED" };
  const slug = String(profile.slug || "").toLowerCase();
  const siteTemplateBlocks = blocks.filter((block) => object(block)?.type === "siteTemplate");
  if (
    siteTemplateBlocks.length !== 1 ||
    readSiteTemplateIdFromBlocks(blocks) !== "default" ||
    SPECIAL_SLUGS.has(slug) ||
    isIssaBuildProfileSlug(slug) ||
    object(businessProfileData)?.tradePartner === true ||
    blocks.some((block) => object(block)?.type === "localServiceProfile")
  ) {
    return { ok: false, reason: "UNSUPPORTED_TEMPLATE" };
  }
  if (profile.status !== "published" || profile.publiclyReleased !== true)
    return { ok: false, reason: "ABOUT_HIDDEN" };
  const ownerSections = object(object(ownerPreferences)?.profileSections);
  const scopedBlocks = blocks.filter((block) => object(block)?.type === "profileSections");
  if (scopedBlocks.length > 1) return { ok: false, reason: "ABOUT_BLOCK_UNSUPPORTED" };
  const scopedSections = readProfileSectionConfigBlock(blocks);
  if ((scopedSections ?? ownerSections)?.about === false)
    return { ok: false, reason: "ABOUT_HIDDEN" };

  const aboutBlocks = blocks.filter((block) => object(block)?.type === "about");
  if (aboutBlocks.length > 1) return { ok: false, reason: "ABOUT_BLOCK_MULTIPLE" };
  const targetMode: PresenceAboutTargetMode = aboutBlocks.length === 0 ? "create" : "replace";
  const aboutBlock = targetMode === "create" ? null : object(aboutBlocks[0]);
  const data = targetMode === "create" ? { body: "" } : object(aboutBlock?.data);
  if (!data) return { ok: false, reason: "ABOUT_BLOCK_UNSUPPORTED" };
  const fields = (["text", "description", "body"] as const).filter((key) => key in data);
  if (fields.length !== 1 || typeof data[fields[0]] !== "string")
    return { ok: false, reason: "ABOUT_BLOCK_UNSUPPORTED" };
  const field = fields[0];
  const currentText = data[field] as string;
  if (currentText.length > 4_000 || sanitizePublicDiscoveryText(currentText, 4_000) !== currentText)
    return { ok: false, reason: "ABOUT_BLOCK_UNSUPPORTED" };
  const aboutBlockDigest = digest(aboutBlock);
  return {
    ok: true,
    presentationDigest: digest({
      version: 2,
      profileStatus: profile.status,
      profileSlug: slug,
      siteTemplate: readSiteTemplateIdFromBlocks(blocks),
      effectiveSections: scopedSections ?? ownerSections ?? null,
      tradePartner: object(businessProfileData)?.tradePartner === true,
    }),
    target: {
      targetMode,
      contentBlocksRevision: profile.contentBlocksRevision,
      profileTargetIdentity: profileTargetIdentityFromRow(profile as typeof profiles.$inferSelect),
      currentText,
      contentBlocksDigest: digest(blocks),
      aboutBlockDigest,
      // This ID is stable for this exact stored block snapshot. The complete
      // content-block digest invalidates an intent after any profile edit.
      aboutBlockId: digest({ version: 2, profileId: profile.id, targetMode, aboutBlockDigest }),
      field,
    },
  };
}

function sameBinding(row: IntentRow, preview: Awaited<ReturnType<typeof readPreviewTx>>): boolean {
  return Boolean(
    preview.eligible &&
    preview.fact &&
    preview.target &&
    row.planId === preview.plan.id &&
    row.ownerUserId === preview.plan.ownerUserId &&
    row.businessId === preview.plan.businessId &&
    row.profileId === preview.plan.profileId &&
    row.revision === preview.plan.revision &&
    row.evidenceDigest === preview.plan.evidenceDigest &&
    row.planHash === preview.plan.planHash &&
    row.decisionId === preview.fact.decisionId &&
    row.decisionEpoch === preview.fact.decisionEpoch &&
    row.valueDigest === preview.fact.valueDigest &&
    row.factKey === preview.fact.key &&
    row.publicationAcknowledged === true &&
    row.targetMode === preview.target.targetMode &&
    row.contentBlocksRevision === preview.target.contentBlocksRevision &&
    row.profileTargetIdentity !== null &&
    profileTargetIdentitiesEqual(row.profileTargetIdentity, preview.target.profileTargetIdentity) &&
    row.contentBlocksDigest === preview.target.contentBlocksDigest &&
    row.aboutBlockDigest === preview.target.aboutBlockDigest &&
    row.aboutBlockId === preview.target.aboutBlockId &&
    row.previewDigest === preview.previewDigest
  );
}

function presentIntent(row: IntentRow, status: "active" | "withdrawn" | "expired" | "stale" | "applied", applied?: IntentRow) {
  return {
    id: row.id,
    authorizedAt: row.createdAt,
    expiresAt: row.expiresAt,
    status,
    publicationApplied: status === "applied",
    ...(applied ? { receipt: presentAppliedReceipt(applied) } : {}),
  };
}

function presentAppliedReceipt(row: IntentRow) {
  return {
    id: row.id,
    profileId: row.profileId,
    targetMode: row.targetMode as PresenceAboutTargetMode,
    contentBlocksRevision: row.appliedContentBlocksRevision!,
    contentBlocksDigest: row.appliedContentBlocksDigest!,
    appliedAt: row.createdAt,
  };
}

async function appliedReceipt(tx: any, authorizationId: string): Promise<IntentRow | undefined> {
  const [row] = await tx.select().from(events)
    .where(and(eq(events.authorizationId, authorizationId), eq(events.eventKind, "apply")))
    .limit(1);
  return row;
}

async function latestAuthorization(
  tx: any,
  ownerUserId: string,
  businessId: string,
  profileId: string
) {
  const [latest] = await tx
    .select()
    .from(events)
    .where(
      and(
        eq(events.ownerUserId, ownerUserId),
        eq(events.businessId, businessId),
        eq(events.profileId, profileId),
        eq(events.eventKind, "authorize")
      )
    )
    .orderBy(desc(events.eventSequence))
    .limit(1);
  return latest as IntentRow | undefined;
}

async function intentStatus(
  tx: any,
  row: IntentRow,
  preview: Awaited<ReturnType<typeof readPreviewTx>>,
  latest?: IntentRow
) {
  const newest =
    latest ?? (await latestAuthorization(tx, row.ownerUserId, row.businessId, row.profileId));
  if (newest?.id !== row.id) return "stale" as const;
  if (await appliedReceipt(tx, row.id)) return "applied" as const;
  const [withdrawal] = await tx
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.authorizationId, row.id), eq(events.eventKind, "withdraw")))
    .limit(1);
  if (withdrawal) return "withdrawn" as const;
  // Publication uses the same database clock. App nodes
  // can disagree at the 30-day boundary, so no JavaScript clock participates.
  const [clock] = await tx
    .select({ isUnexpired: sql<boolean>`${events.expiresAt} > clock_timestamp()` })
    .from(events)
    .where(eq(events.id, row.id))
    .limit(1);
  if (clock?.isUnexpired !== true) return "expired" as const;
  return sameBinding(row, preview) ? ("active" as const) : ("stale" as const);
}

async function readPreviewTx(tx: any, context: OwnedContext, planLock: "share" | "update") {
  const candidate = derivePresencePlan({
    businessId: context.businessId,
    profileId: context.profileId,
    onboardingEvidence: context.onboardingEvidence,
    externalWebsiteUrl: context.externalWebsiteUrl,
  });
  const live = await assertLiveEvidence(tx, context, candidate.evidenceDigest, candidate.planHash);
  const [planRow] = await tx
    .select()
    .from(plans)
    .where(
      and(eq(plans.ownerUserId, context.ownerUserId), eq(plans.businessId, context.businessId))
    )
    .limit(1)
    .for(planLock);
  const plan = requireCurrentPlan(planRow, context, live);
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, plan.profileId))
    .limit(1)
    .for("share");
  if (
    !profile ||
    profile.ownerUserId !== context.ownerUserId ||
    profile.businessId !== context.businessId
  ) {
    throw new PresencePlanError(
      "PRESENCE_OWNERSHIP_MISMATCH",
      "The profile is no longer owned by this account.",
      403
    );
  }
  const [owner] = await tx
    .select()
    .from(users)
    .where(eq(users.id, context.ownerUserId))
    .limit(1);
  const [business] = await tx
    .select()
    .from(businesses)
    .where(eq(businesses.id, context.businessId))
    .limit(1);
  // Normalized link ingestion emits description and services. Historical About
  // evidence remains supported; both require explicit owner fact approval.
  const approvedAbout = await getCurrentApprovedPresenceFact(
    tx,
    plan,
    context.onboardingEvidence,
    "about"
  );
  const approved = approvedAbout ?? await getCurrentApprovedPresenceFact(
    tx, plan, context.onboardingEvidence, "description"
  );
  const targetResult = projectSupportedAboutTarget(
    profile,
    owner?.preferences,
    business?.profileData
  );
  const exposure = derivePublishedProfileExposure({
    profileId: profile.id,
    profilePubliclyReleased: profile.publiclyReleased,
    profileSlug: profile.slug,
    profileStatus: profile.status,
    profileOwnerUserId: profile.ownerUserId,
    profileRoleContext: profile.roleContext,
    profileHeadline: profile.headline,
    profileContentBlocks: profile.contentBlocks,
    businessId: profile.businessId,
    businessOwnerUserId: business?.ownerUserId,
    businessStatus: business?.status,
    publicDiscoveryEnabled: business?.publicDiscoveryEnabled,
    businessSources: business?.sources,
    businessClaimStatus: business?.claimStatus,
    businessProfileData: business?.profileData,
    ownerRole: owner?.role,
    ownerRoles: owner?.roles,
    ownerVerifiedBadge: owner?.verifiedBadge,
    ownerVerificationStatus: owner?.verificationStatus,
    ownerProvider: owner?.provider,
    ownerEmailVerified: owner?.emailVerified,
    ownerPreferences: owner?.preferences,
  });
  const planView = {
    id: plan.id,
    ownerUserId: plan.ownerUserId,
    businessId: plan.businessId,
    profileId: plan.profileId,
    revision: plan.revision,
    evidenceDigest: plan.evidenceDigest,
    planHash: plan.planHash,
    sitePath: plan.sitePath,
    sitePathSelectedBy: plan.sitePathSelectedBy,
    sitePathSelectedAt: plan.reviewedAt,
    sitePathReviewEpoch: plan.sitePathReviewEpoch,
  };
  const fact = approved
    ? {
        key: approved.fact.factKey as PresenceAboutFactKey,
        value: approved.fact.value,
        valueDigest: approved.fact.valueDigest,
        sourceRefs: approved.fact.sourceRefs,
        sourceVerificationLimited: approved.fact.sourceVerificationLimited,
        decisionId: approved.decision.id,
        decisionEpoch: approved.decision.decisionEpoch,
        approvedAt: approved.decision.createdAt,
      }
    : null;
  const target = targetResult.ok && exposure.mode === "public" ? targetResult.target : null;
  const supportedSitePath =
    (plan.sitePath === "hosted_new" || plan.sitePath === "preserve_migrate") &&
    plan.sitePathSelectedBy === context.ownerUserId &&
    plan.reviewedAt instanceof Date &&
    plan.sitePathReviewEpoch > 0;
  const eligible = Boolean(fact && target && supportedSitePath);
  const previewDigest =
    fact && target && supportedSitePath
      ? digest({
          version: 2,
          plan: planView,
          decisionId: fact.decisionId,
          factKey: fact.key,
          valueDigest: fact.valueDigest,
          target,
          presentationDigest: targetResult.ok ? targetResult.presentationDigest : null,
          exposure,
        })
      : null;
  return {
    eligible,
    reason: !supportedSitePath
      ? ("UNSUPPORTED_SITE_PATH" as const)
      : targetResult.ok
        ? exposure.mode !== "public"
          ? ("ABOUT_HIDDEN" as const)
          : fact
            ? null
            : ("NO_APPROVED_ABOUT" as const)
        : targetResult.reason,
    plan: planView,
    fact,
    target,
    previewDigest,
    replacementRequired: Boolean(target?.currentText),
    publicationApplied: false as const,
  };
}

export async function getOwnedPresenceAboutPreview(storage: OwnedStorage, ownerUserId: string) {
  const context = await loadOwnedPresenceContext(storage, ownerUserId);
  const { db } = await import("../db");
  return db.transaction(async (tx: any) => {
    const preview = await readPreviewTx(tx, context, "share");
    const latest = await latestAuthorization(
      tx,
      ownerUserId,
      context.businessId,
      context.profileId
    );
    const applied = latest ? await appliedReceipt(tx, latest.id) : undefined;
    return {
      ...preview,
      intent: latest ? presentIntent(latest, await intentStatus(tx, latest, preview), applied) : null,
      publicationApplied: Boolean(applied),
    };
  });
}

export type AuthorizePresenceAboutIntent = {
  ownerUserId: string;
  expectedPlanId: string;
  expectedProfileId: string;
  expectedRevision: number;
  expectedDigest: string;
  expectedPlanHash: string;
  decisionId: string;
  factKey: PresenceAboutFactKey;
  valueDigest: string;
  contentBlocksDigest: string;
  aboutBlockDigest: string;
  aboutBlockId: string;
  previewDigest: string;
  targetMode: PresenceAboutTargetMode;
  contentBlocksRevision: number;
  publicationAcknowledged: boolean;
  replacementAcknowledged: boolean;
  idempotencyKey: string;
};

export async function authorizeOwnedPresenceAboutIntent(
  storage: OwnedStorage,
  args: AuthorizePresenceAboutIntent
) {
  const context = await loadOwnedPresenceContext(storage, args.ownerUserId);
  const { db } = await import("../db");
  return db.transaction(async (tx: any) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${context.ownerUserId}|${context.businessId}`}))`
    );
    const [existing] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.ownerUserId, context.ownerUserId),
          eq(events.businessId, context.businessId),
          eq(events.idempotencyKey, args.idempotencyKey)
        )
      )
      .limit(1);
    const preview = await readPreviewTx(tx, context, "update");
    if (!preview.eligible || !preview.fact || !preview.target || !preview.previewDigest) {
      throw new PresencePlanError(
        "PRESENCE_ABOUT_UNAVAILABLE",
        "This About change is not available.",
        422
      );
    }
    if (
      preview.plan.id !== args.expectedPlanId ||
      preview.plan.profileId !== args.expectedProfileId ||
      preview.plan.revision !== args.expectedRevision ||
      preview.plan.evidenceDigest !== args.expectedDigest ||
      preview.plan.planHash !== args.expectedPlanHash ||
      preview.fact.decisionId !== args.decisionId ||
      preview.fact.key !== args.factKey ||
      preview.fact.valueDigest !== args.valueDigest ||
      preview.target.contentBlocksDigest !== args.contentBlocksDigest ||
      preview.target.aboutBlockDigest !== args.aboutBlockDigest ||
      preview.target.aboutBlockId !== args.aboutBlockId ||
      preview.target.targetMode !== args.targetMode ||
      preview.target.contentBlocksRevision !== args.contentBlocksRevision ||
      preview.previewDigest !== args.previewDigest
    ) {
      throw new PresencePlanError(
        "PRESENCE_ABOUT_PREVIEW_STALE",
        "Reload the About preview before approving it.",
        409
      );
    }
    if (args.publicationAcknowledged !== true) {
      throw new PresencePlanError(
        "PRESENCE_ABOUT_PUBLICATION_ACK_REQUIRED",
        "Confirm that this exact About text will be published on your public profile.",
        422
      );
    }
    if (preview.replacementRequired && !args.replacementAcknowledged) {
      throw new PresencePlanError(
        "PRESENCE_ABOUT_REPLACEMENT_ACK_REQUIRED",
        "Confirm that this will replace the current About text.",
        422
      );
    }
    if (existing) {
      if (
        existing.eventKind === "authorize" &&
        existing.planId === preview.plan.id &&
        existing.profileId === preview.plan.profileId &&
        existing.revision === preview.plan.revision &&
        existing.evidenceDigest === preview.plan.evidenceDigest &&
        existing.planHash === preview.plan.planHash &&
        existing.decisionId === preview.fact.decisionId &&
        existing.factKey === args.factKey &&
        existing.valueDigest === preview.fact.valueDigest &&
        existing.contentBlocksDigest === preview.target.contentBlocksDigest &&
        existing.aboutBlockDigest === preview.target.aboutBlockDigest &&
        existing.aboutBlockId === preview.target.aboutBlockId &&
        existing.previewDigest === preview.previewDigest &&
        existing.targetMode === args.targetMode &&
        existing.contentBlocksRevision === args.contentBlocksRevision &&
        existing.publicationAcknowledged === true &&
        existing.replacementAcknowledged === args.replacementAcknowledged &&
        (await intentStatus(tx, existing, preview)) === "active"
      )
        return presentIntent(existing, "active");
      throw new PresencePlanError(
        "PRESENCE_ABOUT_INTENT_REPLAY_CONFLICT",
        "This request identifier is no longer current or was reused.",
        409
      );
    }
    const [inserted] = await tx
      .insert(events)
      .values({
        eventKind: "authorize",
        ownerUserId: context.ownerUserId,
        businessId: context.businessId,
        profileId: context.profileId,
        planId: preview.plan.id,
        revision: preview.plan.revision,
        evidenceDigest: preview.plan.evidenceDigest,
        planHash: preview.plan.planHash,
        factKey: preview.fact.key,
        valueDigest: preview.fact.valueDigest,
        decisionId: preview.fact.decisionId,
        decisionEpoch: preview.fact.decisionEpoch,
        contentBlocksDigest: preview.target.contentBlocksDigest,
        aboutBlockDigest: preview.target.aboutBlockDigest,
        aboutBlockId: preview.target.aboutBlockId,
        previewDigest: preview.previewDigest,
        targetMode: preview.target.targetMode,
        contentBlocksRevision: preview.target.contentBlocksRevision,
        profileTargetIdentity: preview.target.profileTargetIdentity,
        publicationAcknowledged: true,
        replacementAcknowledged: args.replacementAcknowledged,
        idempotencyKey: args.idempotencyKey,
        expiresAt: sql`now() + interval '30 days'`,
      })
      .returning();
    if (!inserted) throw new Error("Presence About intent insert returned no row");
    return presentIntent(inserted, "active");
  });
}

export type ApplyPresenceAboutIntent = {
  ownerUserId: string;
  intentId: string;
  idempotencyKey: string;
};

/** Locks the same ownership rows as assertLiveEvidence, in the same order.
 * The exclusive profile lock also serializes every direct content writer.
 */
async function lockOwnedPublicationTarget(tx: any, context: OwnedContext) {
  await tx.select({ id: users.id }).from(users)
    .where(eq(users.id, context.ownerUserId)).limit(1).for("update");
  const [business] = await tx.select({ ownerUserId: businesses.ownerUserId }).from(businesses)
    .where(eq(businesses.id, context.businessId)).limit(1).for("update");
  const [profile] = await tx.select().from(profiles)
    .where(eq(profiles.id, context.profileId)).limit(1).for("update");
  if (!profile || business?.ownerUserId !== context.ownerUserId ||
      profile.ownerUserId !== context.ownerUserId || profile.businessId !== context.businessId) {
    throw new PresencePlanError(
      "PRESENCE_OWNERSHIP_MISMATCH", "The business and profile are no longer owned by this account.", 403
    );
  }
  return profile as typeof profiles.$inferSelect;
}

/** Explicit publication only. Preview, onboarding and fact approval never call this. */
export async function applyOwnedPresenceAboutIntent(storage: OwnedStorage, args: ApplyPresenceAboutIntent) {
  const context = await loadOwnedPresenceContext(storage, args.ownerUserId);
  const { db } = await import("../db");
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${context.ownerUserId}|${context.businessId}`}))`);
    const profile = await lockOwnedPublicationTarget(tx, context);
    const [authorization] = await tx.select().from(events).where(and(
      eq(events.id, args.intentId),
      eq(events.eventKind, "authorize"),
      eq(events.ownerUserId, context.ownerUserId),
      eq(events.businessId, context.businessId),
      eq(events.profileId, context.profileId)
    )).limit(1).for("update");
    if (!authorization) {
      throw new PresencePlanError("PRESENCE_ABOUT_INTENT_NOT_FOUND", "Intent not found.", 404);
    }
    const [existingKey] = await tx.select().from(events).where(and(
      eq(events.ownerUserId, context.ownerUserId),
      eq(events.businessId, context.businessId),
      eq(events.idempotencyKey, args.idempotencyKey)
    )).limit(1);
    if (existingKey && (existingKey.eventKind !== "apply" || existingKey.authorizationId !== authorization.id)) {
      throw new PresencePlanError(
        "PRESENCE_ABOUT_INTENT_REPLAY_CONFLICT", "This request identifier was used for a different action.", 409
      );
    }
    // A retry returns historical proof before comparing the pre-apply snapshot.
    // It never replays the write, even after subsequent owner edits or expiry.
    const applied = await appliedReceipt(tx, authorization.id);
    if (applied) return presentIntent(authorization, "applied", applied);
    if (!authorization.publicationAcknowledged || !authorization.targetMode ||
        !authorization.contentBlocksRevision || !authorization.profileTargetIdentity) {
      throw new PresencePlanError(
        "PRESENCE_ABOUT_FRESH_CONSENT_REQUIRED", "Reload the preview and give fresh publication consent.", 409
      );
    }
    const preview = await readPreviewTx(tx, context, "update");
    const status = await intentStatus(tx, authorization, preview);
    if (status !== "active" || !preview.fact || !preview.target || !preview.eligible) {
      const code = status === "withdrawn" ? "PRESENCE_ABOUT_INTENT_WITHDRAWN"
        : status === "expired" ? "PRESENCE_ABOUT_INTENT_EXPIRED" : "PRESENCE_ABOUT_INTENT_STALE";
      throw new PresencePlanError(code, "This publication consent is no longer current. Reload the preview.", 409);
    }
    if (preview.replacementRequired && authorization.replacementAcknowledged !== true) {
      throw new PresencePlanError(
        "PRESENCE_ABOUT_REPLACEMENT_ACK_REQUIRED", "Confirm replacement before publishing this About text.", 422
      );
    }
    // The target projector guarantees either zero blocks or one supported block.
    // Only this narrowly selected block changes; every other block is preserved.
    const currentBlocks = profile.contentBlocks!;
    const nextBlocks = preview.target.targetMode === "create"
      ? [...currentBlocks, { type: "about", data: { body: preview.fact.value } }]
      : currentBlocks.map((block) => object(block)?.type === "about"
        ? { ...block, data: { ...block.data, [preview.target!.field]: preview.fact!.value } }
        : block);
    const [updated] = await tx.update(profiles)
      .set({ contentBlocks: nextBlocks, updatedAt: sql`clock_timestamp()` })
      .where(and(
        eq(profiles.id, context.profileId),
        eq(profiles.contentBlocksRevision, authorization.contentBlocksRevision),
        profileTargetIdentityPredicate(authorization.profileTargetIdentity),
        sql`EXISTS (SELECT 1 FROM business_presence_about_intent_events
          WHERE id = ${authorization.id} AND expires_at > clock_timestamp())`
      )).returning();
    if (!updated) {
      const nowStatus = await intentStatus(tx, authorization, preview);
      throw new PresencePlanError(
        nowStatus === "expired" ? "PRESENCE_ABOUT_INTENT_EXPIRED" : "PRESENCE_ABOUT_INTENT_STALE",
        "The profile or publication consent changed. Reload the preview.", 409
      );
    }
    const [receipt] = await tx.insert(events).values({
      eventKind: "apply",
      authorizationId: authorization.id,
      ownerUserId: authorization.ownerUserId,
      businessId: authorization.businessId,
      profileId: authorization.profileId,
      planId: authorization.planId,
      revision: authorization.revision,
      evidenceDigest: authorization.evidenceDigest,
      planHash: authorization.planHash,
      factKey: authorization.factKey,
      valueDigest: authorization.valueDigest,
      decisionId: authorization.decisionId,
      decisionEpoch: authorization.decisionEpoch,
      contentBlocksDigest: authorization.contentBlocksDigest,
      aboutBlockDigest: authorization.aboutBlockDigest,
      aboutBlockId: authorization.aboutBlockId,
      previewDigest: authorization.previewDigest,
      targetMode: authorization.targetMode,
      contentBlocksRevision: authorization.contentBlocksRevision,
      profileTargetIdentity: authorization.profileTargetIdentity,
      publicationAcknowledged: true,
      replacementAcknowledged: authorization.replacementAcknowledged,
      appliedContentBlocksRevision: updated.contentBlocksRevision,
      appliedContentBlocksDigest: digest(updated.contentBlocks),
      idempotencyKey: args.idempotencyKey,
      expiresAt: authorization.expiresAt,
      createdAt: sql`clock_timestamp()`,
    }).returning();
    if (!receipt) throw new Error("Presence About publication receipt insert returned no row");
    return presentIntent(authorization, "applied", receipt);
  });
}

export async function withdrawOwnedPresenceAboutIntent(
  ownerUserId: string,
  intentId: string,
  idempotencyKey: string
) {
  const { db } = await import("../db");
  const [candidate] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, intentId),
        eq(events.ownerUserId, ownerUserId),
        eq(events.eventKind, "authorize")
      )
    )
    .limit(1);
  if (!candidate)
    throw new PresencePlanError("PRESENCE_ABOUT_INTENT_NOT_FOUND", "Intent not found.", 404);
  return db.transaction(async (tx: any) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${ownerUserId}|${candidate.businessId}`}))`
    );
    const [authorization] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.id, intentId),
          eq(events.ownerUserId, ownerUserId),
          eq(events.eventKind, "authorize")
        )
      )
      .limit(1)
      .for("update");
    if (
      !authorization ||
      authorization.businessId !== candidate.businessId ||
      authorization.profileId !== candidate.profileId ||
      authorization.planId !== candidate.planId
    )
      throw new PresencePlanError("PRESENCE_ABOUT_INTENT_NOT_FOUND", "Intent not found.", 404);
    const latest = await latestAuthorization(
      tx,
      ownerUserId,
      authorization.businessId,
      authorization.profileId
    );
    if (latest?.id !== authorization.id)
      throw new PresencePlanError(
        "PRESENCE_ABOUT_INTENT_STALE",
        "Reload the current About authorization before withdrawing it.",
        409
      );
    if (await appliedReceipt(tx, authorization.id)) {
      throw new PresencePlanError(
        "PRESENCE_ABOUT_INTENT_APPLIED", "This About text was already published. Edit your profile to change it.", 409
      );
    }
    const [existingKey] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.ownerUserId, ownerUserId),
          eq(events.businessId, authorization.businessId),
          eq(events.idempotencyKey, idempotencyKey)
        )
      )
      .limit(1);
    if (existingKey) {
      if (existingKey.eventKind === "withdraw" && existingKey.authorizationId === authorization.id)
        return presentIntent(authorization, "withdrawn");
      throw new PresencePlanError(
        "PRESENCE_ABOUT_INTENT_REPLAY_CONFLICT",
        "This request identifier was used for a different action.",
        409
      );
    }
    const [priorWithdrawal] = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.authorizationId, authorization.id), eq(events.eventKind, "withdraw")))
      .limit(1);
    if (priorWithdrawal)
      throw new PresencePlanError(
        "PRESENCE_ABOUT_INTENT_WITHDRAWN",
        "This intent was already withdrawn.",
        409
      );
    await tx.insert(events).values({
      eventKind: "withdraw",
      authorizationId: authorization.id,
      ownerUserId: authorization.ownerUserId,
      businessId: authorization.businessId,
      profileId: authorization.profileId,
      planId: authorization.planId,
      revision: authorization.revision,
      evidenceDigest: authorization.evidenceDigest,
      planHash: authorization.planHash,
      factKey: authorization.factKey,
      valueDigest: authorization.valueDigest,
      decisionId: authorization.decisionId,
      decisionEpoch: authorization.decisionEpoch,
      contentBlocksDigest: authorization.contentBlocksDigest,
      aboutBlockDigest: authorization.aboutBlockDigest,
      aboutBlockId: authorization.aboutBlockId,
      previewDigest: authorization.previewDigest,
      replacementAcknowledged: authorization.replacementAcknowledged,
      targetMode: authorization.targetMode,
      contentBlocksRevision: authorization.contentBlocksRevision,
      profileTargetIdentity: authorization.profileTargetIdentity,
      publicationAcknowledged: authorization.publicationAcknowledged,
      idempotencyKey,
      expiresAt: authorization.expiresAt,
    });
    return presentIntent(authorization, "withdrawn");
  });
}
