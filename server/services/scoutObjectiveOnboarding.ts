import { syncObjectiveFromScoutMessage } from "../scout/objectivesService";

export type OnboardingRole = "homeowner" | "contractor" | "realtor" | "admin" | "guest" | "other";

export type OnboardingObjectiveCategory =
  | "seasonal"
  | "maintenance"
  | "growth"
  | "community"
  | "compliance"
  | "trust";

export interface ObjectiveSuggestion {
  id: string;
  title: string;
  description: string;
  category: OnboardingObjectiveCategory;
  estimatedMinutes: number;
  expectedValueScore: number;
  recommendedRoute: string;
  starterPrompt: string;
  requiredSignals?: string[];
}

export interface FastWinActionCard {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  actionTarget: string;
  objectiveId: string;
  valueScore: number;
  urgency: "low" | "medium" | "high";
}

export interface OnboardingObjectiveState {
  objectiveId: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completionPct: number;
  updatedAt: string;
}

export interface ObjectiveOnboardingInput {
  userId: string;
  role?: string;
  countyFips?: string;
  stateCode?: string;
  seasonHint?: "spring" | "summer" | "fall" | "winter";
  objectiveStates?: OnboardingObjectiveState[];
}

export interface ObjectiveOnboardingBundle {
  role: OnboardingRole;
  suggestions: ObjectiveSuggestion[];
  fastWins: FastWinActionCard[];
  nextRecommendedObjectiveId?: string;
  completionSummary: {
    completedCount: number;
    inProgressCount: number;
    pendingCount: number;
    completionRate: number;
  };
}

export interface ObjectiveCompletionUpdate {
  objectiveId: string;
  completedAt?: string;
  note?: string;
}

export interface ObjectiveSyncPort {
  syncObjective: typeof syncObjectiveFromScoutMessage;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toRole(role?: string): OnboardingRole {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();

  if (!normalized) return "guest";
  if (normalized.includes("home")) return "homeowner";
  if (normalized.includes("contract") || normalized.includes("provider")) return "contractor";
  if (
    normalized.includes("realtor") ||
    normalized.includes("broker") ||
    normalized.includes("agent")
  ) {
    return "realtor";
  }
  if (normalized.includes("admin") || normalized.includes("owner")) return "admin";
  return "other";
}

function normalizeSeason(
  seasonHint?: ObjectiveOnboardingInput["seasonHint"]
): "spring" | "summer" | "fall" | "winter" {
  if (seasonHint) return seasonHint;
  const month = new Date().getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

function sortByScore<T extends { expectedValueScore?: number; valueScore?: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const av = Number(a.expectedValueScore ?? a.valueScore ?? 0);
    const bv = Number(b.expectedValueScore ?? b.valueScore ?? 0);
    if (av !== bv) return bv - av;
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });
}

const SUGGESTION_LIBRARY: Record<OnboardingRole, ObjectiveSuggestion[]> = {
  guest: [
    {
      id: "guest_local_discovery",
      title: "Explore trusted local activity",
      description: "Scan what is happening nearby before starting a request.",
      category: "community",
      estimatedMinutes: 3,
      expectedValueScore: 71,
      recommendedRoute: "/community",
      starterPrompt: "Show me recent verified local activity in my county",
    },
  ],
  homeowner: [
    {
      id: "homeowner_spring_maintenance",
      title: "Start Spring Maintenance Plan",
      description: "Create a maintenance objective and shortlist local providers.",
      category: "seasonal",
      estimatedMinutes: 12,
      expectedValueScore: 92,
      recommendedRoute: "/direct-connect",
      starterPrompt: "Help me start my spring maintenance plan",
      requiredSignals: ["county_fips"],
    },
    {
      id: "homeowner_trust_baseline",
      title: "Set trust baseline before contact",
      description: "Review CVS proof before sending any direct request.",
      category: "trust",
      estimatedMinutes: 6,
      expectedValueScore: 86,
      recommendedRoute: "/community",
      starterPrompt: "Show provider trust proof before I contact anyone",
    },
    {
      id: "homeowner_local_network",
      title: "Build your local support network",
      description: "Follow local professionals and neighbors relevant to your objectives.",
      category: "community",
      estimatedMinutes: 8,
      expectedValueScore: 80,
      recommendedRoute: "/community-feed",
      starterPrompt: "Help me build a local homeowner network",
    },
  ],
  contractor: [
    {
      id: "contractor_profile_hardening",
      title: "Harden profile trust signals",
      description: "Verify activity and improve proof quality for routing confidence.",
      category: "trust",
      estimatedMinutes: 10,
      expectedValueScore: 93,
      recommendedRoute: "/my-profile",
      starterPrompt: "Help me improve my trust signals and proof visibility",
    },
    {
      id: "contractor_fast_quote_pipeline",
      title: "Launch Fast Quote Pipeline",
      description: "Set up a repeatable flow for quote turnaround under 24 hours.",
      category: "growth",
      estimatedMinutes: 14,
      expectedValueScore: 88,
      recommendedRoute: "/direct-connect/requests",
      starterPrompt: "Build a fast quote workflow for this week",
    },
    {
      id: "contractor_county_presence",
      title: "Strengthen county presence",
      description: "Increase visibility in your active county without paid boosts.",
      category: "growth",
      estimatedMinutes: 9,
      expectedValueScore: 82,
      recommendedRoute: "/community",
      starterPrompt: "How do I increase county visibility the right way?",
    },
  ],
  realtor: [
    {
      id: "realtor_partner_network",
      title: "Build partner network for listings",
      description: "Connect trusted inspector/lender/trade partners by county.",
      category: "growth",
      estimatedMinutes: 12,
      expectedValueScore: 90,
      recommendedRoute: "/real-estate-marketplace",
      starterPrompt: "Help me build a county partner network for listings",
    },
    {
      id: "realtor_listing_intel",
      title: "Activate listing intelligence snapshot",
      description: "Track market shifts and route buyers/sellers with local confidence.",
      category: "maintenance",
      estimatedMinutes: 11,
      expectedValueScore: 85,
      recommendedRoute: "/homescout-county",
      starterPrompt: "Show me county listing intelligence for this week",
    },
  ],
  admin: [
    {
      id: "admin_county_governance_audit",
      title: "Run county governance audit",
      description: "Check county routing, trust exposure, and active objective health.",
      category: "compliance",
      estimatedMinutes: 16,
      expectedValueScore: 95,
      recommendedRoute: "/admin",
      starterPrompt: "Run a county governance and trust audit",
    },
    {
      id: "admin_community_health",
      title: "Review community health pulse",
      description: "Inspect engagement drop-offs and blocked objective cohorts.",
      category: "community",
      estimatedMinutes: 10,
      expectedValueScore: 84,
      recommendedRoute: "/admin/analytics",
      starterPrompt: "Show me this week's community health pulse",
    },
  ],
  other: [
    {
      id: "other_local_start",
      title: "Start with local objective",
      description: "Pick one local objective and move it to a concrete next action.",
      category: "maintenance",
      estimatedMinutes: 7,
      expectedValueScore: 74,
      recommendedRoute: "/direct-connect",
      starterPrompt: "Help me choose one objective and start now",
    },
  ],
};

/**
 * Objective-first onboarding orchestration.
 */
export class ScoutObjectiveOnboarding {
  /**
   * Suggest objective set for current role + season + objective state.
   */
  static suggestObjectives(input: ObjectiveOnboardingInput): ObjectiveSuggestion[] {
    const role = toRole(input.role);
    const season = normalizeSeason(input.seasonHint);
    const base = SUGGESTION_LIBRARY[role] ?? SUGGESTION_LIBRARY.other;

    const tuned = base.map((item) => {
      let bonus = 0;
      if (role === "homeowner" && item.id.includes(season)) bonus += 6;
      if (item.requiredSignals?.includes("county_fips") && input.countyFips) bonus += 4;
      if (role === "contractor" && item.category === "growth") bonus += 3;
      if (role === "admin" && item.category === "compliance") bonus += 4;
      return {
        ...item,
        expectedValueScore: clamp(item.expectedValueScore + bonus, 0, 100),
      };
    });

    const states = input.objectiveStates ?? [];
    const completedIds = new Set(
      states.filter((s) => s.status === "completed").map((s) => s.objectiveId)
    );
    const filtered = tuned.filter((item) => !completedIds.has(item.id));
    return sortByScore(filtered).slice(0, 4);
  }

  /**
   * Build immediate fast-win cards from objective suggestions.
   */
  static buildFastWinCards(
    role: OnboardingRole,
    suggestions: ObjectiveSuggestion[],
    objectiveStates?: OnboardingObjectiveState[]
  ): FastWinActionCard[] {
    const stateMap = new Map((objectiveStates ?? []).map((s) => [s.objectiveId, s]));

    const cards = suggestions.map((suggestion) => {
      const state = stateMap.get(suggestion.id);
      const completionPct = state?.completionPct ?? 0;
      const urgency: "low" | "medium" | "high" =
        completionPct >= 80 ? "low" : completionPct >= 35 ? "medium" : "high";

      const rolePhrase =
        role === "contractor"
          ? "Capture local demand quickly"
          : role === "homeowner"
            ? "Lock in one practical next step"
            : "Move this objective forward";

      return {
        id: `fastwin_${suggestion.id}`,
        title: suggestion.title,
        body: `${rolePhrase}. Estimated ${suggestion.estimatedMinutes} minutes.`,
        actionLabel: completionPct > 0 ? "Continue" : "Start now",
        actionTarget: suggestion.recommendedRoute,
        objectiveId: suggestion.id,
        valueScore: clamp(Math.round(suggestion.expectedValueScore - completionPct * 0.25), 1, 100),
        urgency,
      };
    });

    return sortByScore(cards).slice(0, 3);
  }

  /**
   * Update objective state after completion and pick next recommendation.
   */
  static trackCompletion(
    states: OnboardingObjectiveState[],
    update: ObjectiveCompletionUpdate,
    suggestions: ObjectiveSuggestion[]
  ): {
    states: OnboardingObjectiveState[];
    nextRecommendedObjectiveId?: string;
    completionRate: number;
  } {
    const nowIso = update.completedAt ?? new Date().toISOString();
    const nextStates = states.map((state) => {
      if (state.objectiveId !== update.objectiveId) return state;
      return {
        ...state,
        status: "completed" as const,
        completionPct: 100,
        updatedAt: nowIso,
      };
    });

    if (!nextStates.some((s) => s.objectiveId === update.objectiveId)) {
      nextStates.push({
        objectiveId: update.objectiveId,
        status: "completed",
        completionPct: 100,
        updatedAt: nowIso,
      });
    }

    const completed = nextStates.filter((s) => s.status === "completed").length;
    const completionRate = nextStates.length > 0 ? completed / nextStates.length : 0;

    const completedIds = new Set(
      nextStates.filter((s) => s.status === "completed").map((s) => s.objectiveId)
    );
    const nextObjective = sortByScore(suggestions).find((s) => !completedIds.has(s.id));

    return {
      states: nextStates,
      nextRecommendedObjectiveId: nextObjective?.id,
      completionRate,
    };
  }

  /**
   * Build complete onboarding bundle for UI surfaces.
   */
  static buildBundle(input: ObjectiveOnboardingInput): ObjectiveOnboardingBundle {
    const role = toRole(input.role);
    const suggestions = this.suggestObjectives(input);
    const fastWins = this.buildFastWinCards(role, suggestions, input.objectiveStates);

    const states = input.objectiveStates ?? [];
    const completedCount = states.filter((s) => s.status === "completed").length;
    const inProgressCount = states.filter((s) => s.status === "in_progress").length;
    const pendingCount = Math.max(0, suggestions.length - completedCount - inProgressCount);

    const completionRate = suggestions.length > 0 ? completedCount / suggestions.length : 0;

    const completedIds = new Set(
      states.filter((s) => s.status === "completed").map((s) => s.objectiveId)
    );
    const nextRecommendedObjectiveId = sortByScore(suggestions).find(
      (s) => !completedIds.has(s.id)
    )?.id;

    return {
      role,
      suggestions,
      fastWins,
      nextRecommendedObjectiveId,
      completionSummary: {
        completedCount,
        inProgressCount,
        pendingCount,
        completionRate,
      },
    };
  }

  /**
   * Sync a chosen fast-win with the existing Scout objectives service.
   */
  static async syncFastWinToObjective(
    params: {
      userId: string;
      objective: ObjectiveSuggestion;
      role?: string;
      countyFips?: string;
      stateCode?: string;
    },
    port?: Partial<ObjectiveSyncPort>
  ) {
    const syncFn = port?.syncObjective ?? syncObjectiveFromScoutMessage;

    return await syncFn({
      userId: params.userId,
      messageText: params.objective.starterPrompt,
      userRole: params.role,
      countyFips: params.countyFips,
      stateCode: params.stateCode,
    });
  }
}

export default ScoutObjectiveOnboarding;
