export type OutcomeOnboardingClaimContinuation = {
  version: 1;
  businessId?: string;
  claimQuery?: string;
  goal: string;
  next?: string;
  business: {
    name?: string;
    notes?: string;
    services?: string[];
    links?: string[];
    photoUrls?: string[];
  };
  createdAt: number;
};

const STORAGE_KEY = "ts_outcome_onboarding_claim_continuation";
const MAX_AGE_MS = 30 * 60 * 1000;
let inMemoryClaimContinuation: OutcomeOnboardingClaimContinuation | null = null;

function cleanId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function cleanQuery(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

function cleanBusinessEvidence(value: unknown): OutcomeOnboardingClaimContinuation["business"] {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const cleanString = (candidate: unknown, maxLength: number) =>
    typeof candidate === "string" ? candidate.trim().slice(0, maxLength) : "";
  const cleanList = (candidate: unknown, maxItems: number, maxLength: number) =>
    Array.isArray(candidate)
      ? candidate
          .flatMap((item) => {
            const clean = cleanString(item, maxLength);
            return clean ? [clean] : [];
          })
          .slice(0, maxItems)
      : [];
  const name = cleanString(record.name, 180);
  const notes = cleanString(record.notes, 4_000);
  const services = cleanList(record.services, 50, 180);
  const links = cleanList(record.links, 20, 2_000);
  const photoUrls = cleanList(record.photoUrls, 12, 2_000);
  return {
    ...(name ? { name } : {}),
    ...(notes ? { notes } : {}),
    ...(services.length ? { services } : {}),
    ...(links.length ? { links } : {}),
    ...(photoUrls.length ? { photoUrls } : {}),
  };
}

export function storeOutcomeOnboardingClaimContinuation(
  value: Omit<OutcomeOnboardingClaimContinuation, "version" | "createdAt">
): void {
  const businessId = cleanId(value.businessId);
  const claimQuery = cleanQuery(value.claimQuery);
  const goal = typeof value.goal === "string" ? value.goal.trim().slice(0, 2_000) : "";
  if ((!businessId && !claimQuery) || !goal) return;
  const continuation: OutcomeOnboardingClaimContinuation = {
    ...value,
    business: cleanBusinessEvidence(value.business),
    ...(businessId ? { businessId } : {}),
    ...(claimQuery ? { claimQuery } : {}),
    goal,
    version: 1,
    createdAt: Date.now(),
  };
  inMemoryClaimContinuation = continuation;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(continuation));
  } catch {
    // The module-scoped continuation still protects this SPA claim handoff.
  }
}

export function readOutcomeOnboardingClaimContinuation(): OutcomeOnboardingClaimContinuation | null {
  let parsed: Partial<OutcomeOnboardingClaimContinuation> | null = null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    parsed = raw
      ? (JSON.parse(raw) as Partial<OutcomeOnboardingClaimContinuation>)
      : inMemoryClaimContinuation;
  } catch {
    parsed = inMemoryClaimContinuation;
  }
  if (!parsed) return null;
  try {
    const businessId = cleanId(parsed.businessId);
    const claimQuery = cleanQuery(parsed.claimQuery);
    const goal = typeof parsed.goal === "string" ? parsed.goal.trim().slice(0, 2_000) : "";
    const createdAt = Number(parsed.createdAt);
    if (
      parsed.version !== 1 ||
      (!businessId && !claimQuery) ||
      !goal ||
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > MAX_AGE_MS ||
      Date.now() < createdAt
    ) {
      clearOutcomeOnboardingClaimContinuation();
      return null;
    }
    return {
      version: 1,
      ...(businessId ? { businessId } : {}),
      ...(claimQuery ? { claimQuery } : {}),
      goal,
      ...(typeof parsed.next === "string" && parsed.next ? { next: parsed.next } : {}),
      business: cleanBusinessEvidence(parsed.business),
      createdAt,
    };
  } catch {
    return null;
  }
}

export function clearOutcomeOnboardingClaimContinuation(): void {
  inMemoryClaimContinuation = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // No-op when session storage is unavailable.
  }
}

export function isOutcomeOnboardingClaimContinuationPath(path: string): boolean {
  const continuation = readOutcomeOnboardingClaimContinuation();
  if (!continuation) return false;
  try {
    const parsed = new URL(path, "https://tradescout.internal");
    const isExactClaimPage =
      parsed.origin === "https://tradescout.internal" &&
      parsed.pathname.replace(/\/+$/, "") === "/claim-my-business" &&
      parsed.searchParams.get("source") === "outcome_onboarding_match";
    if (!isExactClaimPage) return false;
    return continuation.businessId
      ? parsed.searchParams.get("businessId") === continuation.businessId
      : parsed.searchParams.get("q") === continuation.claimQuery;
  } catch {
    return false;
  }
}

export function getOutcomeOnboardingClaimResumeRoute(
  claimPath: string,
  claimedBusinessId: string
): string | null {
  const businessId = cleanId(claimedBusinessId);
  if (!businessId || !isOutcomeOnboardingClaimContinuationPath(claimPath)) return null;
  const pending = readOutcomeOnboardingClaimContinuation();
  if (!pending || (pending.businessId && pending.businessId !== businessId)) return null;
  return `/onboarding?resumeClaimedBusinessId=${encodeURIComponent(businessId)}`;
}
