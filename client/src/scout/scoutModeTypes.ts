/**
 * ScoutMode State Machine Types & Guards
 * LOCKED: Phase 3d-B Post-Onboarding Action Router
 * 
 * Purpose:
 * - Prevent mode confusion
 * - Enforce onboarding → action selection → freeform
 * - Make transitions explicit, testable, and measurable
 * - Decouple UX copy from control flow
 */

/**
 * Finite Scout modes: no other modes allowed at this layer
 */
export type ScoutMode =
  | 'onboarding'       // bounded: inference + claim confirmation
  | 'post_onboarding'  // bounded: action selection
  | 'freeform';        // unbounded: normal Scout

/**
 * Single post-onboarding action (deterministic, no LLM)
 */
export interface PostOnboardingAction {
  id: string;           // e.g., 'setup_services', 'post_request'
  label: string;        // User-facing button text
  destination: string;  // Route to navigate to
  primary?: boolean;    // True for top action
}

/**
 * Entry condition guards: stateless check functions
 */

export interface OnboardingGuardInput {
  route: string;
  query: Record<string, string>;
  profileDraftComplete: boolean;
  profileDraftPublished: boolean;
  claimsConfirmed: boolean;
  onboardingCompleted: boolean;
}

/**
 * Guard: Can enter onboarding mode?
 */
export function canEnterOnboarding(input: OnboardingGuardInput): boolean {
  const {
    route,
    query,
    profileDraftComplete,
    claimsConfirmed,
    onboardingCompleted,
  } = input;

  // Must be on /scout route
  if (route !== '/scout') return false;

  // Must have onboarding=true query param
  if (query.onboarding !== 'true') return false;

  // Must have completed pre-Scout setup (profileDraft.complete)
  if (!profileDraftComplete) return false;

  // Must not have confirmed claims yet
  if (claimsConfirmed) return false;

  // Must not have completed onboarding in this session
  if (onboardingCompleted) return false;

  return true;
}

/**
 * Guard: Can enter post_onboarding mode?
 */
export function canEnterPostOnboarding(input: OnboardingGuardInput): boolean {
  const {
    claimsConfirmed,
    profileDraftPublished,
    onboardingCompleted,
  } = input;

  // Must have confirmed claims
  if (!claimsConfirmed) return false;

  // Must have published profile
  if (!profileDraftPublished) return false;

  // Must not have completed onboarding in this session
  if (onboardingCompleted) return false;

  return true;
}

/**
 * Guard: Can enter freeform mode?
 */
export function canEnterFreeform(): boolean {
  // Freeform is always available; either all modes transition to it
  // or users skip the bounded modes
  return true;
}

/**
 * Transition metadata
 */

export interface TransitionMetadata {
  fromMode: ScoutMode;
  toMode: ScoutMode;
  triggeredBy: string;  // 'claim_confirmation' | 'action_selected' | 'skip' | etc.
}

/**
 * Telemetry event payloads
 */

export interface ScoutOnboardingStartedEvent {
  profileType: string;
  countyFips?: string;
}

export interface ScoutOnboardingCompletedEvent {
  claims: string[];
  profileType: string;
  countyFips?: string;
}

export interface ScoutOnboardingSkippedEvent {
  reason: 'user_skip';
}

export interface PostOnboardingActionSelectedEvent {
  actionId: string;
  claims: string[];
  destination: string;
}

export interface ScoutEnteredFreeformEvent {
  from: 'onboarding' | 'post_onboarding' | 'direct';
}
