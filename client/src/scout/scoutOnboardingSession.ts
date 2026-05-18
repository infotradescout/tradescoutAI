import type { ClaimType } from "./claimTypes";

const SCOUT_ONBOARDING_SESSION_KEY = "ts:scout_onboarding_session";

const EMPTY_SESSION: ScoutOnboardingSessionState = {
  completed: false,
  claimsConfirmed: false,
  confirmedClaims: [],
  updatedAt: null,
};

export interface ScoutOnboardingSessionState {
  completed: boolean;
  claimsConfirmed: boolean;
  confirmedClaims: ClaimType[];
  updatedAt: string | null;
}

export function getScoutOnboardingSessionState(): ScoutOnboardingSessionState {
  try {
    const raw = sessionStorage.getItem(SCOUT_ONBOARDING_SESSION_KEY);
    if (!raw) return EMPTY_SESSION;

    const parsed = JSON.parse(raw) as Partial<ScoutOnboardingSessionState> | null;
    if (!parsed || typeof parsed !== "object") return EMPTY_SESSION;

    const completed = Boolean(parsed.completed);
    const claimsConfirmed = Boolean(parsed.claimsConfirmed);
    const confirmedClaims = Array.isArray(parsed.confirmedClaims)
      ? parsed.confirmedClaims.filter((value): value is ClaimType => typeof value === "string")
      : [];

    return {
      completed,
      claimsConfirmed,
      confirmedClaims: claimsConfirmed ? confirmedClaims : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

export function isScoutOnboardingCompleted(): boolean {
  return getScoutOnboardingSessionState().completed;
}

export function markScoutOnboardingComplete(input?: {
  claimsConfirmed?: boolean;
  confirmedClaims?: ClaimType[];
}): void {
  try {
    const previous = getScoutOnboardingSessionState();
    const next: ScoutOnboardingSessionState = {
      completed: true,
      claimsConfirmed: Boolean(input?.claimsConfirmed),
      confirmedClaims:
        Array.isArray(input?.confirmedClaims) && input?.confirmedClaims.length > 0
          ? Array.from(new Set(input.confirmedClaims))
          : previous.confirmedClaims,
      updatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SCOUT_ONBOARDING_SESSION_KEY, JSON.stringify(next));
  } catch {
    // Storage error - continue with in-memory behavior
  }
}

export function clearScoutOnboardingSession(): void {
  try {
    sessionStorage.removeItem(SCOUT_ONBOARDING_SESSION_KEY);
  } catch {
    // Storage error - continue
  }
}
