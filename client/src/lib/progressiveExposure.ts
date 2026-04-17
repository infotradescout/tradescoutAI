import { hasCompletedSetup } from "@/lib/setupState";
import type { RecentActivityEvent } from "@/agent/activity";

export type ProgressiveExposureTier = 0 | 1 | 2 | 3;

export type ProgressiveExposureSignals = {
  hasCompletedSetup: boolean;
  accountAgeDays: number;
  meaningfulActivityCount: number;
  hasVerifiedContact: boolean;
};

export type ProgressiveExposureSnapshot = {
  tier: ProgressiveExposureTier;
  reasons: string[];
  signals: ProgressiveExposureSignals;
};

type EvaluateInput = {
  user: {
    onboardingCompleted?: boolean | null;
    profileVersion?: number | null;
    locationCommitted?: boolean | null;
    stateCode?: string | null;
    countyFips?: string | null;
    createdAt?: string | Date | null;
    emailVerified?: boolean | null;
    verificationStatus?: string | null;
  } | null;
  recentActivity: RecentActivityEvent[];
  now?: Date;
};

const MEANINGFUL_ACTIVITY_TYPES = new Set<string>([
  "ask_scout",
  "decision_card_choice",
  "onboarding_answer",
  "community.county_default",
  "dc.county_default_applied",
]);

function parseAccountAgeDays(createdAt: string | Date | null | undefined, now: Date): number {
  if (!createdAt) return 0;
  const dt = createdAt instanceof Date ? createdAt : new Date(String(createdAt));
  if (Number.isNaN(dt.getTime())) return 0;
  const diffMs = now.getTime() - dt.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function countMeaningfulActivity(recentActivity: RecentActivityEvent[]): number {
  if (!Array.isArray(recentActivity) || recentActivity.length === 0) return 0;
  return recentActivity.filter((event) => MEANINGFUL_ACTIVITY_TYPES.has(String(event?.type || "")))
    .length;
}

export function evaluateProgressiveExposure(input: EvaluateInput): ProgressiveExposureSnapshot {
  const now = input.now ?? new Date();
  const user = input.user;
  const recentActivity = Array.isArray(input.recentActivity) ? input.recentActivity : [];

  const completedSetup = hasCompletedSetup(user);
  const accountAgeDays = parseAccountAgeDays(user?.createdAt, now);
  const meaningfulActivityCount = countMeaningfulActivity(recentActivity);
  const hasVerifiedContact =
    user?.emailVerified === true ||
    String(user?.verificationStatus || "").toLowerCase() === "verified";

  const reasons: string[] = [];
  let tier: ProgressiveExposureTier = 0;

  if (completedSetup) {
    tier = 1;
    reasons.push("setup_complete");
  } else {
    reasons.push("setup_incomplete");
  }

  if (tier >= 1 && meaningfulActivityCount >= 3 && accountAgeDays >= 7) {
    tier = 2;
    reasons.push("activity_and_tenure_ready");
  }

  if (tier >= 2 && meaningfulActivityCount >= 8 && accountAgeDays >= 21 && hasVerifiedContact) {
    tier = 3;
    reasons.push("verified_advanced_ready");
  }

  if (!hasVerifiedContact) {
    reasons.push("verification_pending");
  }

  return {
    tier,
    reasons,
    signals: {
      hasCompletedSetup: completedSetup,
      accountAgeDays,
      meaningfulActivityCount,
      hasVerifiedContact,
    },
  };
}
