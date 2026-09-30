import type { OwnedPresenceProfile, PresenceReviewRecord } from "./presenceReview";

export type PresenceFact = {
  factKey: string;
  kind: "description" | "about" | "service";
  value: string;
  sourceRefs: string[];
  sourceVerificationLimited: boolean;
  valueDigest: string;
  decision: "approve" | "reject" | null;
};

export type PresenceFactReview = {
  planId: string;
  businessId: string;
  profileId: string;
  revision: number;
  evidenceDigest: string;
  planHash: string;
  facts: PresenceFact[];
};

const DIGEST = /^[a-f0-9]{64}$/;
const FACT_KEY = /^(description|about|service:[0-9]+)$/;

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function safeFactSourceHref(source: unknown): string | null {
  if (typeof source !== "string") return null;
  try {
    const url = new URL(source);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Accept only the current, owned plan's facts; never trust a response from another account. */
export function resolvePresenceFactReview(
  candidate: unknown,
  record: PresenceReviewRecord,
  profile: OwnedPresenceProfile,
  ownerUserId: string
): PresenceFactReview | null {
  const review = object(candidate);
  if (
    !review ||
    profile.ownerUserId !== ownerUserId ||
    typeof review.planId !== "string" ||
    !review.planId ||
    review.businessId !== record.businessId ||
    review.businessId !== profile.businessId ||
    review.profileId !== record.profileId ||
    review.profileId !== profile.id ||
    review.revision !== record.revision ||
    review.evidenceDigest !== record.evidenceDigest ||
    review.planHash !== record.planHash ||
    !Array.isArray(review.facts) ||
    review.facts.length > 100
  )
    return null;

  const keys = new Set<string>();
  for (const candidateFact of review.facts) {
    const fact = object(candidateFact);
    if (
      !fact ||
      typeof fact.factKey !== "string" ||
      !FACT_KEY.test(fact.factKey) ||
      keys.has(fact.factKey) ||
      fact.kind !== (fact.factKey.startsWith("service:") ? "service" : fact.factKey) ||
      typeof fact.value !== "string" ||
      !fact.value.trim() ||
      fact.value.length > 4000 ||
      typeof fact.valueDigest !== "string" ||
      !DIGEST.test(fact.valueDigest) ||
      ![null, "approve", "reject"].includes(fact.decision as string | null) ||
      typeof fact.sourceVerificationLimited !== "boolean" ||
      !Array.isArray(fact.sourceRefs) ||
      !fact.sourceRefs.length ||
      fact.sourceRefs.length > 20 ||
      !fact.sourceRefs.every((source) => safeFactSourceHref(source) !== null)
    )
      return null;
    keys.add(fact.factKey);
  }
  return candidate as PresenceFactReview;
}
