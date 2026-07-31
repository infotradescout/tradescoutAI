import { isSafeNextPath } from "@/lib/postOnboardingRoute";

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
  if (!args.onboardingCompleted) {
    return next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
  }
  return next || "/scout";
}
