import { isSafeNextPath } from "@/lib/postOnboardingRoute";

export type OnboardingOutcomeRecovery = {
  resultRoute: string;
  resultPrompt?: string;
};

export function readPersistedOnboardingOutcomeRecovery(
  user: unknown
): OnboardingOutcomeRecovery | null {
  if (!user || typeof user !== "object") return null;
  const record = user as Record<string, any>;
  if (record.onboardingCompleted !== true) return null;
  const outcome = record.preferences?.onboardingOutcome;
  if (!outcome || typeof outcome !== "object") return null;
  const resultRoute = typeof outcome.resultRoute === "string" ? outcome.resultRoute.trim() : "";
  if (!isSafeNextPath(resultRoute)) return null;
  if (outcome.kind === "express_result") {
    const resultPrompt =
      typeof outcome.goal === "string" ? outcome.goal.trim().slice(0, 2_000) : "";
    return resultPrompt ? { resultRoute, resultPrompt } : null;
  }
  return outcome.kind === "business_profile" ? { resultRoute } : null;
}
