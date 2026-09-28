import { isSafeNextPath } from "@/lib/postOnboardingRoute";
import { isRecommendationActionPath } from "@shared/recommendationContinuation";
import { isProfileSurfaceContinuation } from "@shared/profileSurfaceContinuation";

export function sanitizePreScoutNext(value: unknown): string {
  const next = typeof value === "string" ? value.trim() : "";
  return isSafeNextPath(next) ? next : "";
}

export function resolvePreScoutAuthenticatedRoute(args: {
  explicitNext: string;
  onboardingCompleted: boolean;
}): string {
  const next = sanitizePreScoutNext(args.explicitNext);
  if (next.startsWith("/admin")) return next;
  if (isRecommendationActionPath(next)) return next;
  // A company login is not consent to join the full TradeScout experience.
  // Keep this before the onboarding check, including for returning full users.
  if (isProfileSurfaceContinuation(next)) return next;
  if (!args.onboardingCompleted) {
    return next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
  }
  return next || "/scout";
}
