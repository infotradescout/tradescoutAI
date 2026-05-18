/**
 * useScoutMode Hook
 * Manages the Scout state machine with explicit transitions and telemetry
 *
 * Responsibilities:
 * - Determine initial mode based on guards + session state
 * - Handle transitions with side effects and event logging
 * - Coordinate with onboarding flow and action selection
 */

import { useState, useCallback, useEffect } from "react";
import { useLocation as useWouterLocation } from "wouter";
import type { ScoutMode } from "./scoutModeTypes";
import {
  canEnterOnboarding,
  canEnterPostOnboarding,
  type OnboardingGuardInput,
} from "./scoutModeTypes";
import type { ClaimType } from "./claimTypes";
import { isScoutOnboardingCompleted, markScoutOnboardingComplete } from "./scoutOnboardingSession";

/**
 * Hook: Scout mode management
 */
export function useScoutMode(input: {
  userId?: string;
  profileDraftComplete?: boolean;
  profileDraftPublished?: boolean;
  claimsConfirmed?: boolean;
  confirmedClaims?: ClaimType[];
  publishedProfileSlug?: string;
}) {
  const [location] = useWouterLocation();
  const [scoutMode, setScoutMode] = useState<ScoutMode>("freeform");

  /**
   * Determine if onboarding was completed in this session
   */
  const isOnboardingCompleted = useCallback((): boolean => {
    return isScoutOnboardingCompleted();
  }, []);

  /**
   * Mark onboarding as complete in session
   */
  const markOnboardingComplete = useCallback(
    (options?: { claimsConfirmed?: boolean; confirmedClaims?: ClaimType[] }): void => {
      markScoutOnboardingComplete(options);
    },
    []
  );

  /**
   * Parse query params from location
   */
  const parseQuery = useCallback((): Record<string, string> => {
    const searchPart = location.split("?")[1] || "";
    const params = new URLSearchParams(searchPart);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }, [location]);

  /**
   * Determine mode based on guards
   */
  const determineMode = useCallback((): ScoutMode => {
    const query = parseQuery();
    const onboardingCompleted = isOnboardingCompleted();

    const guardInput: OnboardingGuardInput = {
      route: location.split("?")[0] || "/",
      query,
      profileDraftComplete: input.profileDraftComplete ?? false,
      profileDraftPublished: input.profileDraftPublished ?? false,
      claimsConfirmed: input.claimsConfirmed ?? false,
      onboardingCompleted,
    };

    // Priority order: onboarding → post_onboarding → freeform
    if (canEnterOnboarding(guardInput)) {
      return "onboarding";
    }

    if (canEnterPostOnboarding(guardInput)) {
      return "post_onboarding";
    }

    return "freeform";
  }, [
    location,
    input.profileDraftComplete,
    input.profileDraftPublished,
    input.claimsConfirmed,
    parseQuery,
    isOnboardingCompleted,
  ]);

  /**
   * Initialize mode on mount and when deps change
   */
  useEffect(() => {
    const mode = determineMode();
    setScoutMode(mode);
  }, [determineMode]);

  /**
   * Transition: onboarding → post_onboarding
   * Called after user confirms claims and profile is published
   */
  const completeOnboarding = useCallback(
    (confirmedClaims: ClaimType[]): void => {
      console.log("[SCOUT_MODE] onboarding → post_onboarding", {
        claims: confirmedClaims,
      });

      // Side effect: mark session as complete
      markOnboardingComplete({ claimsConfirmed: true, confirmedClaims });

      // Side effect: telemetry
      if (typeof window !== "undefined" && window.__telemetry) {
        window.__telemetry("scout_onboarding_completed", {
          claims: confirmedClaims,
          profileType: input.profileDraftComplete ? "complete" : "partial",
        });
      }

      setScoutMode("post_onboarding");
    },
    [input.profileDraftComplete, markOnboardingComplete]
  );

  /**
   * Transition: post_onboarding → freeform
   * Called when user selects an action
   */
  const selectPostOnboardingAction = useCallback(
    (actionId: string): void => {
      console.log("[SCOUT_MODE] post_onboarding → freeform", {
        actionId,
        claims: input.confirmedClaims,
      });

      // Side effect: telemetry
      if (typeof window !== "undefined" && window.__telemetry) {
        window.__telemetry("post_onboarding_action_selected", {
          actionId,
          claims: input.confirmedClaims || [],
        });
      }

      setScoutMode("freeform");
    },
    [input.confirmedClaims]
  );

  /**
   * Transition: onboarding → freeform (escape hatch)
   * Called when user skips onboarding
   */
  const skipOnboarding = useCallback((): void => {
    console.log("[SCOUT_MODE] onboarding → freeform (skipped)");

    // Side effect: mark session as complete (to prevent re-entry)
    markOnboardingComplete({ claimsConfirmed: false, confirmedClaims: [] });

    // Side effect: telemetry
    if (typeof window !== "undefined" && window.__telemetry) {
      window.__telemetry("scout_onboarding_skipped", {
        reason: "user_skip",
      });
    }

    setScoutMode("freeform");
  }, [markOnboardingComplete]);

  /**
   * Explicit transition to freeform (for any other case)
   */
  const enterFreeform = useCallback((from?: ScoutMode): void => {
    if (from) {
      console.log(`[SCOUT_MODE] ${from} → freeform`);
    }

    if (typeof window !== "undefined" && window.__telemetry && from) {
      window.__telemetry("scout_entered_freeform", {
        from: from as "onboarding" | "post_onboarding",
      });
    }

    setScoutMode("freeform");
  }, []);

  return {
    scoutMode,
    setScoutMode,
    completeOnboarding,
    selectPostOnboardingAction,
    skipOnboarding,
    enterFreeform,
    // Expose input data for rendering post-onboarding actions
    confirmedClaims: input.confirmedClaims,
    publishedProfileSlug: input.publishedProfileSlug,
  };
}

/**
 * Global telemetry handler (stub)
 * In production, this will be wired to real analytics service
 */
declare global {
  interface Window {
    __telemetry?: (event: string, payload: Record<string, any>) => void;
  }
}
