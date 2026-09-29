import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  businessPresenceFactDecisions as decisions,
  businessPresencePlans as plans,
  users,
} from "@shared/schema";
import { sanitizePublicDiscoveryText } from "../../shared/publicListingSafety";
import { containsForbiddenProfileInference } from "./businessProfileEnrichmentService";
import { derivePresencePlan } from "./presencePlan";
import {
  assertLiveEvidence,
  loadOwnedPresenceContext,
  PresencePlanError,
  type OwnedContext,
} from "./presencePlanService";

type PlanRow = typeof plans.$inferSelect;
type DecisionRow = typeof decisions.$inferSelect;
type PlanIdentity = Pick<
  PlanRow,
  "id" | "ownerUserId" | "businessId" | "profileId" | "revision" | "evidenceDigest" | "planHash"
>;
type OwnedStorage = Parameters<typeof loadOwnedPresenceContext>[0];

export type PresenceFactDecision = "approve" | "reject" | "withdraw";
export type ReviewablePresenceFact = {
  factKey: string;
  kind: "description" | "about" | "service";
  value: string;
  /** Safe navigation references, stripped of query strings and fragments. */
  sourceRefs: string[];
  /** A shortened link may not open the exact cited page; ask the owner to verify. */
  sourceVerificationLimited: boolean;
  valueDigest: string;
};
export type OwnedPresenceFact = ReviewablePresenceFact & {
  decision: "approve" | "reject" | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Navigation and citation validation only. Nothing here fetches a remote URL. */
function publicSource(value: unknown): { key: string; display: string; limited: boolean } | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2_000 || /[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const parsed = new URL(raw);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password ||
      (parsed.port && parsed.port !== "80" && parsed.port !== "443")
    )
      return null;
    const host = parsed.hostname.toLowerCase();
    if (
      !host.includes(".") ||
      host.endsWith(".") ||
      host === "localhost" ||
      /\.(?:localhost|local|internal|lan|home|arpa)$/.test(host) ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      host.startsWith("[") ||
      !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
    ) {
      return null;
    }
    // URL parsing normalizes the hostname. Path and query case can identify
    // different resources and must remain exact for provenance matching.
    const key = parsed.toString();
    const limited = Boolean(parsed.search || parsed.hash);
    parsed.search = "";
    parsed.hash = "";
    return { key, display: parsed.toString(), limited };
  } catch {
    return null;
  }
}

function objectPhotoSource(
  value: unknown
): { key: string; display: string; limited: boolean } | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/objects/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    return null;
  try {
    let path = value.split(/[?#]/, 1)[0];
    for (let pass = 0; pass < 2; pass += 1) path = decodeURIComponent(path);
    if (
      path.startsWith("//") ||
      path.includes("\\") ||
      path.split("/").some((part) => part === "." || part === "..")
    )
      return null;
    const origin = new URL(String(process.env.PUBLIC_WEB_URL || "https://www.thetradescout.com"));
    if (
      (origin.protocol !== "http:" && origin.protocol !== "https:") ||
      origin.username ||
      origin.password
    )
      return null;
    return publicSource(new URL(value, origin.origin).toString());
  } catch {
    return null;
  }
}

function safeValue(value: unknown, kind: ReviewablePresenceFact["kind"]): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const maxLength = kind === "service" ? 80 : 4_000;
  if (
    !text ||
    text.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(text) ||
    containsForbiddenProfileInference(text) ||
    sanitizePublicDiscoveryText(text, maxLength) !== text
  )
    return null;
  if (kind === "service") {
    if (/[.!?;:]$/.test(text) || !/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}&+/'’() .-]*$/u.test(text))
      return null;
    const words = text.match(/[\p{L}\p{M}\p{N}]+/gu) || [];
    if (words.length === 0 || words.length > 8) return null;
  }
  return text;
}

/** This allowlist reads only post-policy enrichment, never raw analyzer output. */
export function projectReviewablePresenceFacts(outcomeValue: unknown): ReviewablePresenceFact[] {
  const outcome = record(outcomeValue);
  const provenance = record(outcome?.provenance);
  const evidence = record(provenance?.evidence);
  const enrichment = record(provenance?.enrichment);
  const output = record(enrichment?.output);
  if (
    outcome?.kind !== "business_profile" ||
    !evidence ||
    enrichment?.source !== "selective_intelligence_profile_enrichment" ||
    !output
  )
    return [];

  const allowed = new Set<string>();
  for (const link of Array.isArray(evidence.links) ? evidence.links : []) {
    const parsed = publicSource(link);
    if (parsed) allowed.add(parsed.key);
  }
  for (const photo of Array.isArray(evidence.photoUrls) ? evidence.photoUrls : []) {
    const parsed = objectPhotoSource(photo) || publicSource(photo);
    if (parsed) allowed.add(parsed.key);
  }
  if (allowed.size === 0) return [];

  const facts: ReviewablePresenceFact[] = [];
  const add = (factKey: string, kind: ReviewablePresenceFact["kind"], candidate: unknown) => {
    const item = record(candidate);
    const value = safeValue(item?.[kind === "service" ? "name" : "text"], kind);
    const sourceUrls = item?.sourceUrls;
    if (!value || !Array.isArray(sourceUrls) || sourceUrls.length < 1 || sourceUrls.length > 8)
      return;
    const sourceKeys = new Set<string>();
    const sourceRefs = new Set<string>();
    let sourceVerificationLimited = false;
    for (const source of sourceUrls) {
      const parsed = publicSource(source);
      // An invalid or invented citation invalidates the whole claim.
      if (!parsed || !allowed.has(parsed.key)) return;
      sourceKeys.add(parsed.key);
      sourceRefs.add(parsed.display);
      sourceVerificationLimited ||= parsed.limited;
    }
    const canonicalSources = [...sourceKeys].sort();
    facts.push({
      factKey,
      kind,
      value,
      sourceRefs: [...sourceRefs].sort(),
      sourceVerificationLimited,
      valueDigest: sha256(
        JSON.stringify({ version: 1, factKey, kind, value, sourceUrls: canonicalSources })
      ),
    });
  };
  if (output.description !== undefined) add("description", "description", output.description);
  if (output.about !== undefined) add("about", "about", output.about);
  if (Array.isArray(output.services)) {
    output.services.slice(0, 30).forEach((item, index) => add(`service:${index}`, "service", item));
  }
  return facts;
}

function outcomeFromPreferences(preferences: unknown): unknown {
  return record(preferences)?.onboardingOutcome;
}

function identity(plan: PlanIdentity): OwnedContext {
  return {
    ownerUserId: plan.ownerUserId,
    businessId: plan.businessId,
    profileId: plan.profileId,
    onboardingEvidence: null,
    externalWebsiteUrl: null,
  };
}

async function latestDecisions(tx: any, plan: PlanIdentity): Promise<Map<string, DecisionRow>> {
  // PostgreSQL resolves the newest event per key through the plan/version/key
  // index. Neither the API nor the scheduler loads the growing audit history.
  const rows = await tx
    .selectDistinctOn([decisions.factKey])
    .from(decisions)
    .where(
      and(
        eq(decisions.planId, plan.id),
        eq(decisions.ownerUserId, plan.ownerUserId),
        eq(decisions.businessId, plan.businessId),
        eq(decisions.profileId, plan.profileId),
        eq(decisions.revision, plan.revision),
        eq(decisions.evidenceDigest, plan.evidenceDigest),
        eq(decisions.planHash, plan.planHash)
      )
    )
    .orderBy(decisions.factKey, desc(decisions.decisionEpoch));
  const latest = new Map<string, DecisionRow>();
  for (const row of rows as DecisionRow[]) {
    latest.set(row.factKey, row);
  }
  return latest;
}

function decisionFor(
  fact: ReviewablePresenceFact,
  latest: Map<string, DecisionRow>
): OwnedPresenceFact {
  const event = latest.get(fact.factKey);
  return {
    ...fact,
    decision:
      event?.valueDigest === fact.valueDigest &&
      (event.decision === "approve" || event.decision === "reject")
        ? event.decision
        : null,
  };
}

/** For the server scheduler only; no private claim or source value escapes. */
export async function getCurrentPresenceFactSummary(tx: any, plan: PlanIdentity) {
  const live = await assertLiveEvidence(tx, identity(plan), plan.evidenceDigest, plan.planHash);
  if (
    live.profileId !== plan.profileId ||
    live.quarantinedEvidence.some((item) => item.reason === "identity_conflict")
  ) {
    throw new PresencePlanError(
      "PRESENCE_IDENTITY_CONFLICT",
      "Resolve business identity first.",
      422
    );
  }
  const [user] = await tx
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, plan.ownerUserId))
    .limit(1);
  const facts = projectReviewablePresenceFacts(outcomeFromPreferences(user?.preferences));
  const latest = await latestDecisions(tx, plan);
  const resolved = facts.map((fact) => decisionFor(fact, latest));
  return {
    reviewableCount: resolved.length,
    unresolvedCount: resolved.filter((fact) => fact.decision === null).length,
    approvedCount: resolved.filter((fact) => fact.decision === "approve").length,
    rejectedCount: resolved.filter((fact) => fact.decision === "reject").length,
  };
}

function requireCurrentPlan(
  record: PlanRow | undefined,
  context: OwnedContext,
  current: ReturnType<typeof derivePresencePlan>
): PlanRow {
  if (!record) {
    throw new PresencePlanError("PRESENCE_PLAN_REQUIRED", "Prepare the presence plan first.", 409);
  }
  if (
    record.ownerUserId !== context.ownerUserId ||
    record.businessId !== context.businessId ||
    record.profileId !== context.profileId ||
    record.evidenceDigest !== current.evidenceDigest ||
    record.planHash !== current.planHash
  ) {
    throw new PresencePlanError(
      "PRESENCE_PLAN_STALE",
      "Refresh the presence plan before reviewing facts.",
      409
    );
  }
  if (current.quarantinedEvidence.some((item) => item.reason === "identity_conflict")) {
    throw new PresencePlanError(
      "PRESENCE_IDENTITY_CONFLICT",
      "Resolve business identity first.",
      422
    );
  }
  return record;
}

export async function getOwnedPresenceFactReview(storage: OwnedStorage, ownerUserId: string) {
  const context = await loadOwnedPresenceContext(storage, ownerUserId);
  const candidate = derivePresencePlan({
    businessId: context.businessId,
    profileId: context.profileId,
    onboardingEvidence: context.onboardingEvidence,
    externalWebsiteUrl: context.externalWebsiteUrl,
  });
  const { db } = await import("../db");
  return db.transaction(async (tx: any) => {
    const live = await assertLiveEvidence(
      tx,
      context,
      candidate.evidenceDigest,
      candidate.planHash
    );
    const [row] = await tx
      .select()
      .from(plans)
      .where(
        and(eq(plans.ownerUserId, context.ownerUserId), eq(plans.businessId, context.businessId))
      )
      .limit(1)
      .for("share");
    const plan = requireCurrentPlan(row, context, live);
    const latest = await latestDecisions(tx, plan);
    return {
      planId: plan.id,
      businessId: plan.businessId,
      profileId: plan.profileId,
      revision: plan.revision,
      evidenceDigest: plan.evidenceDigest,
      planHash: plan.planHash,
      facts: projectReviewablePresenceFacts(context.onboardingEvidence).map((fact) =>
        decisionFor(fact, latest)
      ),
    };
  });
}

export type SubmitPresenceFactDecision = {
  ownerUserId: string;
  expectedPlanId: string;
  expectedProfileId: string;
  expectedRevision: number;
  expectedDigest: string;
  expectedPlanHash: string;
  factKey: string;
  valueDigest: string;
  decision: PresenceFactDecision;
  idempotencyKey: string;
};

export async function submitOwnedPresenceFactDecision(
  storage: OwnedStorage,
  args: SubmitPresenceFactDecision
) {
  const context = await loadOwnedPresenceContext(storage, args.ownerUserId);
  const { db } = await import("../db");
  const event = await db.transaction(async (tx: any): Promise<DecisionRow> => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${context.ownerUserId}|${context.businessId}`}))`
    );
    const live = await assertLiveEvidence(tx, context, args.expectedDigest, args.expectedPlanHash);
    const [row] = await tx
      .select()
      .from(plans)
      .where(
        and(eq(plans.ownerUserId, context.ownerUserId), eq(plans.businessId, context.businessId))
      )
      .limit(1)
      .for("update");
    const plan = requireCurrentPlan(row, context, live);
    if (
      plan.id !== args.expectedPlanId ||
      plan.profileId !== args.expectedProfileId ||
      plan.revision !== args.expectedRevision
    ) {
      throw new PresencePlanError(
        "PRESENCE_PLAN_STALE",
        "Refresh the fact review before deciding.",
        409
      );
    }
    const fact = projectReviewablePresenceFacts(context.onboardingEvidence).find(
      (item) => item.factKey === args.factKey
    );
    if (!fact) {
      throw new PresencePlanError(
        "PRESENCE_FACT_UNREVIEWABLE",
        "This fact is not available for review.",
        422
      );
    }
    if (fact.valueDigest !== args.valueDigest) {
      throw new PresencePlanError(
        "PRESENCE_FACT_STALE",
        "This fact changed. Reload it before deciding.",
        409
      );
    }
    const [existing] = await tx
      .select()
      .from(decisions)
      .where(
        and(
          eq(decisions.ownerUserId, context.ownerUserId),
          eq(decisions.businessId, context.businessId),
          eq(decisions.idempotencyKey, args.idempotencyKey)
        )
      )
      .limit(1);
    if (existing) {
      if (
        existing.planId === plan.id &&
        existing.profileId === plan.profileId &&
        existing.revision === plan.revision &&
        existing.evidenceDigest === plan.evidenceDigest &&
        existing.planHash === plan.planHash &&
        existing.factKey === args.factKey &&
        existing.valueDigest === args.valueDigest &&
        existing.decision === args.decision
      )
        return existing;
      throw new PresencePlanError(
        "PRESENCE_DECISION_REPLAY_CONFLICT",
        "This request identifier was already used for a different decision.",
        409
      );
    }
    const epoch = plan.factReviewEpoch + 1;
    await tx
      .update(plans)
      .set({ factReviewEpoch: epoch, updatedAt: new Date() })
      .where(eq(plans.id, plan.id));
    const [inserted] = await tx
      .insert(decisions)
      .values({
        planId: plan.id,
        ownerUserId: context.ownerUserId,
        businessId: context.businessId,
        profileId: context.profileId,
        revision: plan.revision,
        evidenceDigest: plan.evidenceDigest,
        planHash: plan.planHash,
        factKey: args.factKey,
        valueDigest: args.valueDigest,
        decision: args.decision,
        decisionEpoch: epoch,
        idempotencyKey: args.idempotencyKey,
      })
      .returning();
    if (!inserted) throw new Error("Presence fact decision insert returned no row");
    return inserted;
  });
  try {
    const { reconcilePresenceFactTask } = await import("./presenceFactCustomerTasks");
    await reconcilePresenceFactTask(event.planId);
  } catch (error) {
    // The customer's decision committed. A priority sweep retries the task projection.
    console.error("[presence.fact-review] post-commit task reconcile failed", error);
  }
  return {
    factKey: event.factKey,
    valueDigest: event.valueDigest,
    decision: event.decision as PresenceFactDecision,
    decidedAt: event.createdAt,
  };
}
