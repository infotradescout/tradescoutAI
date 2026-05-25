import { ClaimSource, ClaimType, isValidCountyFips } from "./claimEventSchema";
import { writeClaimEvent } from "./claimEventService";

type StorageLike = {
  getUser: (id: string) => Promise<any>;
  updateUser: (id: string, updates: Record<string, unknown>) => Promise<any>;
  logEvent?: (eventType: string, payload: Record<string, unknown>) => Promise<any>;
};

export type OnboardingLane =
  | "find_help"
  | "manage_projects"
  | "offer_services"
  | "sell_items"
  | "real_estate"
  | "business"
  | "community"
  | "browse_only";

export type OnboardingAsset = "home" | "vehicle" | "project" | "business" | "saved_search";

export type OnboardingClaimType =
  | "find_local_help"
  | "manage_local_projects"
  | "offer_local_services"
  | "sell_or_list_items"
  | "real_estate_property_work"
  | "run_local_business"
  | "see_local_activity"
  | "browse_search_only";

export type UnifiedOnboardingState = {
  startedAt: string;
  updatedAt: string;
  lane: OnboardingLane;
  claimType: OnboardingClaimType;
  legacySource?: string;
  assets: OnboardingAsset[];
  completedSteps: string[];
  verificationStartedAt?: string;
  completedAt?: string;
  minimumProfileComplete: boolean;
};

const DEFAULT_CLAIM_BY_LANE: Record<OnboardingLane, OnboardingClaimType> = {
  find_help: "find_local_help",
  manage_projects: "manage_local_projects",
  offer_services: "offer_local_services",
  sell_items: "sell_or_list_items",
  real_estate: "real_estate_property_work",
  business: "run_local_business",
  community: "see_local_activity",
  browse_only: "browse_search_only",
};

const CLAIM_EVENT_TYPE_BY_ONBOARDING_CLAIM: Record<OnboardingClaimType, ClaimType> = {
  find_local_help: ClaimType.WANTS_TO_HIRE,
  manage_local_projects: ClaimType.WANTS_TO_HIRE,
  offer_local_services: ClaimType.PROVIDES_SERVICES,
  sell_or_list_items: ClaimType.POSTS_DEALS,
  real_estate_property_work: ClaimType.REPRESENTS_BUSINESS,
  run_local_business: ClaimType.REPRESENTS_BUSINESS,
  see_local_activity: ClaimType.COMMUNITY_BUILDER,
  browse_search_only: ClaimType.EXPLORING,
};

const LEGACY_LANE_MAP: Record<
  string,
  { lane: OnboardingLane; asset?: OnboardingAsset; claimType?: OnboardingClaimType }
> = {
  homeowner: {
    lane: "manage_projects",
    asset: "home",
    claimType: "manage_local_projects",
  },
  vehicle_owner: {
    lane: "manage_projects",
    asset: "vehicle",
    claimType: "manage_local_projects",
  },
  service_provider: {
    lane: "offer_services",
    claimType: "offer_local_services",
  },
  seller: {
    lane: "sell_items",
    claimType: "sell_or_list_items",
  },
  realtor: {
    lane: "real_estate",
    claimType: "real_estate_property_work",
  },
  business_owner: {
    lane: "business",
    claimType: "run_local_business",
  },
  community_member: {
    lane: "community",
    claimType: "see_local_activity",
  },
};

function nowIso(): string {
  return new Date().toISOString();
}

async function safeLogEvent(
  storage: StorageLike,
  eventType:
    | "onboarding_started"
    | "role_selected"
    | "claim_submitted"
    | "profile_started"
    | "verification_started"
    | "setup_step_completed"
    | "onboarding_completed",
  payload: Record<string, unknown>
) {
  try {
    if (typeof storage.logEvent === "function") {
      await storage.logEvent(eventType, payload);
    }
  } catch (error) {
    console.warn(`[onboarding] event logging skipped for ${eventType}`, { error });
  }
}

function isMinimumProfileComplete(profile: {
  fullName?: string | null;
  phone?: string | null;
  location?: { state?: string | null; county?: string | null; city?: string | null } | null;
}) {
  const hasName = Boolean(String(profile.fullName || "").trim());
  const hasPhone = Boolean(String(profile.phone || "").trim());
  const hasLocation = Boolean(
    String(profile.location?.state || "").trim() || String(profile.location?.county || "").trim()
  );
  return hasName && hasPhone && hasLocation;
}

function needsVerificationByLane(lane: OnboardingLane): boolean {
  return lane === "offer_services" || lane === "business" || lane === "real_estate";
}

function getOnboardingState(user: any): UnifiedOnboardingState | null {
  const preferences = (user?.preferences ?? {}) as Record<string, any>;
  const onboarding = preferences?.onboardingUnified;
  if (!onboarding || typeof onboarding !== "object") return null;
  return onboarding as UnifiedOnboardingState;
}

async function persistOnboardingState(
  storage: StorageLike,
  userId: string,
  state: UnifiedOnboardingState
) {
  const user = await storage.getUser(userId);
  const existingPreferences = ((user?.preferences ?? {}) as Record<string, unknown>) || {};
  const nextPreferences = {
    ...existingPreferences,
    onboardingUnified: state,
  };
  await storage.updateUser(userId, {
    preferences: nextPreferences,
  });
  return state;
}

export async function startUnifiedOnboarding(
  storage: StorageLike,
  args: {
    userId: string;
    lane: OnboardingLane;
    claimType?: OnboardingClaimType;
    assets?: OnboardingAsset[];
    legacySource?: string;
    profile?: {
      fullName?: string | null;
      phone?: string | null;
      location?: { state?: string | null; county?: string | null; city?: string | null } | null;
    };
  }
) {
  const startedAt = nowIso();
  const claimType = args.claimType || DEFAULT_CLAIM_BY_LANE[args.lane];
  const assets = Array.from(new Set(args.assets ?? []));
  const minimumProfileComplete = isMinimumProfileComplete(args.profile ?? {});
  const state: UnifiedOnboardingState = {
    startedAt,
    updatedAt: startedAt,
    lane: args.lane,
    claimType,
    legacySource: args.legacySource,
    assets,
    completedSteps: [],
    minimumProfileComplete,
  };

  await persistOnboardingState(storage, args.userId, state);

  await safeLogEvent(storage, "onboarding_started", {
    userId: args.userId,
    lane: args.lane,
    claimType,
    legacySource: args.legacySource || null,
  });
  await safeLogEvent(storage, "role_selected", {
    userId: args.userId,
    lane: args.lane,
  });
  await safeLogEvent(storage, "profile_started", {
    userId: args.userId,
    minimumProfileComplete,
  });

  if (needsVerificationByLane(args.lane)) {
    const verificationStartedAt = nowIso();
    state.verificationStartedAt = verificationStartedAt;
    state.updatedAt = verificationStartedAt;
    await persistOnboardingState(storage, args.userId, state);
    await safeLogEvent(storage, "verification_started", {
      userId: args.userId,
      lane: args.lane,
    });
  }

  return state;
}

export async function submitUnifiedOnboardingClaim(
  storage: StorageLike,
  args: {
    userId: string;
    lane: OnboardingLane;
    claimType: OnboardingClaimType;
    assets?: OnboardingAsset[];
    countyFips?: string | null;
    countyName?: string | null;
    legacySource?: string;
  }
) {
  const user = await storage.getUser(args.userId);
  const existing = getOnboardingState(user);
  const started = existing
    ? existing
    : await startUnifiedOnboarding(storage, {
        userId: args.userId,
        lane: args.lane,
        claimType: args.claimType,
        legacySource: args.legacySource,
      });

  const next: UnifiedOnboardingState = {
    ...started,
    lane: args.lane,
    claimType: args.claimType,
    legacySource: args.legacySource ?? started.legacySource,
    assets: Array.from(new Set([...(started.assets || []), ...(args.assets || [])])),
    updatedAt: nowIso(),
  };
  await persistOnboardingState(storage, args.userId, next);

  const countyFips = String(args.countyFips || "").trim();
  const countyName = String(args.countyName || "").trim();
  if (countyFips && countyName && isValidCountyFips(countyFips)) {
    try {
      await writeClaimEvent({
        userId: args.userId,
        claimType: CLAIM_EVENT_TYPE_BY_ONBOARDING_CLAIM[args.claimType],
        countyFips,
        countyName,
        source: ClaimSource.SIGNUP,
        claimTimestamp: new Date(),
        metadata: {
          lane: args.lane,
          onboardingClaimType: args.claimType,
          legacySource: args.legacySource || null,
        },
      });
    } catch (error) {
      console.warn("[onboarding] claim event write skipped", { error });
    }
  }

  await safeLogEvent(storage, "claim_submitted", {
    userId: args.userId,
    lane: args.lane,
    claimType: args.claimType,
    legacySource: args.legacySource || null,
  });

  return next;
}

export async function completeUnifiedOnboardingStep(
  storage: StorageLike,
  args: {
    userId: string;
    stepKey: string;
    completeOnboarding?: boolean;
    assets?: OnboardingAsset[];
  }
) {
  const user = await storage.getUser(args.userId);
  const current = getOnboardingState(user);
  if (!current) return null;

  const completedSteps = Array.from(new Set([...current.completedSteps, args.stepKey]));
  const next: UnifiedOnboardingState = {
    ...current,
    assets: Array.from(new Set([...(current.assets || []), ...(args.assets || [])])),
    completedSteps,
    updatedAt: nowIso(),
  };

  if (args.completeOnboarding) {
    next.completedAt = nowIso();
  }

  await persistOnboardingState(storage, args.userId, next);
  await safeLogEvent(storage, "setup_step_completed", {
    userId: args.userId,
    stepKey: args.stepKey,
    lane: next.lane,
  });

  if (args.completeOnboarding) {
    await safeLogEvent(storage, "onboarding_completed", {
      userId: args.userId,
      lane: next.lane,
      claimType: next.claimType,
    });
  }

  return next;
}

export function mapLegacyLaneToUnified(legacyLane?: string | null): {
  lane?: OnboardingLane;
  asset?: OnboardingAsset;
  claimType?: OnboardingClaimType;
} {
  const key = String(legacyLane || "")
    .trim()
    .toLowerCase();
  return LEGACY_LANE_MAP[key] || {};
}

export async function getUnifiedOnboardingStatus(storage: StorageLike, userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;
  return getOnboardingState(user);
}
