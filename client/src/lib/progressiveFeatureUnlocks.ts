import { hasCompletedSetup } from "@/lib/setupState";
import type { RecentActivityEvent } from "@/agent/activity";

export type AdvancedFeatureId =
  | "trade_deals"
  | "exchange"
  | "share"
  | "home_scout_listings"
  | "maps"
  | "leaderboard"
  | "foundation";

export const CORE_NAV_HREFS = ["/scout", "/direct-connect", "/commercial-directory", "/community"];

export const ADVANCED_FEATURE_HREFS: Record<AdvancedFeatureId, string> = {
  trade_deals: "/trade-deals",
  exchange: "/exchange",
  share: "/share",
  home_scout_listings: "/homescout-listings",
  maps: "/maps",
  leaderboard: "/leaderboard",
  foundation: "/foundation",
};

export type ProgressiveUnlockSnapshot = {
  unlocked: Record<AdvancedFeatureId, boolean>;
  counts: {
    askScout: number;
    decisionChoices: number;
    onboardingAnswers: number;
    countySignals: number;
    meaningful: number;
  };
  setupComplete: boolean;
  hasVerifiedContact: boolean;
};

type EvaluateInput = {
  user: {
    onboardingCompleted?: boolean | null;
    profileVersion?: number | null;
    locationCommitted?: boolean | null;
    stateCode?: string | null;
    countyFips?: string | null;
    emailVerified?: boolean | null;
    verificationStatus?: string | null;
  } | null;
  recentActivity: RecentActivityEvent[];
};

const MEANINGFUL_TYPES = new Set<string>([
  "ask_scout",
  "decision_card_choice",
  "onboarding_answer",
  "community.county_default",
  "dc.county_default_applied",
]);

const COUNTY_SIGNAL_TYPES = new Set<string>([
  "community.county_default",
  "dc.county_default_applied",
  "settings_location_saved",
]);

function countByType(events: RecentActivityEvent[], type: string): number {
  return events.filter((event) => String(event?.type || "") === type).length;
}

function countByTypes(events: RecentActivityEvent[], types: Set<string>): number {
  return events.filter((event) => types.has(String(event?.type || ""))).length;
}

export function evaluateFeatureUnlocks(input: EvaluateInput): ProgressiveUnlockSnapshot {
  const user = input.user;
  const events = Array.isArray(input.recentActivity) ? input.recentActivity : [];

  const askScout = countByType(events, "ask_scout");
  const decisionChoices = countByType(events, "decision_card_choice");
  const onboardingAnswers = countByType(events, "onboarding_answer");
  const countySignals = countByTypes(events, COUNTY_SIGNAL_TYPES);
  const meaningful = countByTypes(events, MEANINGFUL_TYPES);

  const setupComplete = hasCompletedSetup(user);
  const hasVerifiedContact =
    user?.emailVerified === true ||
    String(user?.verificationStatus || "").toLowerCase() === "verified";

  const unlocked: Record<AdvancedFeatureId, boolean> = {
    trade_deals: askScout >= 1 || decisionChoices >= 1,
    exchange: meaningful >= 2,
    share: decisionChoices >= 1 || onboardingAnswers >= 1,
    home_scout_listings: setupComplete || countySignals >= 1,
    maps: countySignals >= 1 || meaningful >= 3,
    leaderboard: meaningful >= 4 || decisionChoices >= 2,
    foundation: setupComplete && (meaningful >= 6 || hasVerifiedContact),
  };

  return {
    unlocked,
    counts: {
      askScout,
      decisionChoices,
      onboardingAnswers,
      countySignals,
      meaningful,
    },
    setupComplete,
    hasVerifiedContact,
  };
}

export function isFeatureUnlocked(
  snapshot: ProgressiveUnlockSnapshot,
  featureId: AdvancedFeatureId
): boolean {
  return snapshot.unlocked[featureId] === true;
}

export function getUnlockedAdvancedHrefs(snapshot: ProgressiveUnlockSnapshot): Set<string> {
  const hrefs = new Set<string>();
  const featureIds = Object.keys(ADVANCED_FEATURE_HREFS) as AdvancedFeatureId[];

  for (const featureId of featureIds) {
    if (snapshot.unlocked[featureId]) {
      hrefs.add(ADVANCED_FEATURE_HREFS[featureId]);
    }
  }

  return hrefs;
}
