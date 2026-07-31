/**
 * Scout Onboarding Flow Handler
 * Phase 3d-A: Orchestrates claim inference → confirmation → routing
 *
 * Contract:
 * - Triggered by ?onboarding=true query param
 * - Runs once per session (sessionStorage guard)
 * - Shows 2-3 Scout messages max
 * - Writes claims only after user confirmation
 * - Routes explicitly via routeFromClaims()
 */

import { useState, useCallback } from "react";
import { useLocation as useWouterLocation } from "wouter";
import { inferClaimsFromIntent, buildConfirmationOptions } from "./claimInference";
import {
  routeFromClaims,
  type ClaimType,
  type ClaimConfirmationCard as ClaimConfirmationCardData,
} from "./claimTypes";
import type { ProfileDraft } from "@/types/profileDraft";
import { apiRequest } from "@/lib/queryClient";
import { clearScoutOnboardingSession, isScoutOnboardingCompleted } from "./scoutOnboardingSession";

function isValidCountyFips(value: unknown): value is string {
  return typeof value === "string" && /^\d{5}$/.test(value.trim());
}

function hasOnboardingSeed(provisional: any): boolean {
  if (!provisional) return false;

  const hasIntent =
    typeof provisional?.userIntent === "string" && provisional.userIntent.trim().length > 0;
  const hasUserTypes = Array.isArray(provisional?.userTypes) && provisional.userTypes.length > 0;
  const draft = provisional?.profileDraft;
  const hasDraftSignals =
    !!draft &&
    (typeof draft?.countyFips === "string" ||
      typeof draft?.presenceType === "string" ||
      typeof draft?.businessName === "string" ||
      typeof draft?.businessCategory === "string");

  return hasIntent || hasUserTypes || hasDraftSignals;
}

function buildFallbackIntentSeed(
  provisionalUserTypes: string[] = [],
  countyName: string | null,
  profileDraft?: ProfileDraft
): string {
  const parts: string[] = [];

  if (profileDraft?.presenceType === "represent_business") {
    parts.push("I represent a business.");
  } else if (profileDraft?.presenceType === "personal") {
    parts.push("I am using TradeScout for personal needs.");
  }

  if (profileDraft?.businessName) {
    parts.push(`Business name: ${profileDraft.businessName}.`);
  }

  if (profileDraft?.businessCategory) {
    parts.push(`Business category: ${profileDraft.businessCategory}.`);
  }

  if (provisionalUserTypes.length > 0) {
    parts.push(`Likely user types: ${provisionalUserTypes.join(", ")}.`);
  }

  if (countyName) {
    parts.push(`Primary local area: ${countyName}.`);
  }

  parts.push("Please suggest the best starting focus and next steps.");
  return parts.join(" ");
}

export interface OnboardingFlowState {
  phase: "idle" | "inferring" | "confirming" | "writing" | "done";
  confirmationCard: ClaimConfirmationCardData | null;
  error: string | null;
}

export function useScoutOnboarding() {
  const [, navigate] = useWouterLocation();
  const [flowState, setFlowState] = useState<OnboardingFlowState>({
    phase: "idle",
    confirmationCard: null,
    error: null,
  });

  /**
   * Check if onboarding should trigger
   */
  const shouldTriggerOnboarding = useCallback(
    (location: string, userId: string | undefined, provisional: any): boolean => {
      // Check for onboarding=true param
      const params = new URLSearchParams(location.split("?")[1] || "");
      if (params.get("onboarding") !== "true") return false;

      // Must be authenticated
      if (!userId) return false;

      // Must have enough seed data to infer a useful first focus.
      if (!hasOnboardingSeed(provisional)) {
        return false;
      }

      if (isScoutOnboardingCompleted()) return false;

      return true;
    },
    []
  );

  /**
   * Start onboarding flow - infer claims from provisional intent
   */
  const startOnboardingFlow = useCallback(
    async (
      userIntentText: string,
      provisionalUserTypes: string[] = [],
      countyName: string | null = null,
      profileDraft?: ProfileDraft
    ) => {
      console.log("[ONBOARDING] Starting claim inference...");
      setFlowState({ phase: "inferring", confirmationCard: null, error: null });

      try {
        const normalizedUserIntent =
          userIntentText.trim().length > 0
            ? userIntentText
            : buildFallbackIntentSeed(provisionalUserTypes, countyName, profileDraft);

        const inference = await inferClaimsFromIntent(
          normalizedUserIntent,
          provisionalUserTypes,
          countyName,
          profileDraft
        );

        const options = buildConfirmationOptions(inference);

        const confirmationCard: ClaimConfirmationCardData = {
          kind: "claim_confirmation",
          title: "Quick confirmation",
          preface: inference.summary,
          options,
          secondaryAction: {
            label: "Edit what I wrote",
            action: "edit_intent",
          },
          skipAction: {
            label: "Skip for now",
            action: "skip",
          },
        };

        setFlowState({ phase: "confirming", confirmationCard, error: null });
      } catch (error: any) {
        console.error("[ONBOARDING] Inference failed:", error);
        setFlowState({
          phase: "idle",
          confirmationCard: null,
          error: "Unable to process your intent. Please try again.",
        });
      }
    },
    []
  );

  /**
   * Handle user confirmation - write claims and route
   */
  const confirmClaims = useCallback(
    async (
      confirmedClaims: ClaimType[],
      metadata: {
        confidenceByClaim: Record<string, number>;
        evidenceByClaim: Record<string, string>;
        rawUserIntentText: string;
      },
      countyFips?: string | null
    ) => {
      console.log("[ONBOARDING] Writing confirmed claims:", confirmedClaims);
      setFlowState((prev) => ({ ...prev, phase: "writing" }));

      try {
        // Write claims to backend
        const normalizedCountyFips = typeof countyFips === "string" ? countyFips.trim() : "";
        if (!isValidCountyFips(normalizedCountyFips)) {
          setFlowState((prev) => ({
            ...prev,
            phase: "confirming",
            error: "Finish local setup first so Scout can show the right nearby results.",
          }));
          clearScoutOnboardingSession();
          return;
        }

        const response = await apiRequest("/api/claims/write", {
          method: "POST",
          body: {
            confirmedClaimTypes: confirmedClaims,
            countyFips: normalizedCountyFips,
            metadata: {
              confidenceByClaim: metadata.confidenceByClaim,
              evidenceByClaim: metadata.evidenceByClaim,
              textSource: "provisional_userIntent",
              rawUserIntentText: metadata.rawUserIntentText,
            },
          },
        });

        if (!response.success) {
          throw new Error("Failed to write some claims");
        }

        // Route based on confirmed claims
        const routing = routeFromClaims(confirmedClaims);
        console.log("[ONBOARDING] Routing to:", routing);

        setFlowState({ phase: "done", confirmationCard: null, error: null });

        // Navigate after a brief moment
        setTimeout(() => {
          navigate(`/onboarding?next=${encodeURIComponent(routing.path)}`);
        }, 300);
      } catch (error: any) {
        console.error("[ONBOARDING] Claim write failed:", error);
        setFlowState((prev) => ({
          ...prev,
          phase: "confirming",
          error: "Failed to save your preferences. Please try again.",
        }));
      }
    },
    [navigate]
  );

  /**
   * Skip onboarding - route to neutral fallback
   */
  const skipOnboarding = useCallback(async () => {
    console.log("[ONBOARDING] User skipped onboarding");
    clearScoutOnboardingSession();
    setFlowState({ phase: "done", confirmationCard: null, error: null });
    navigate("/onboarding?next=%2Fdirect-connect%2Fboard");
  }, [navigate]);

  /**
   * Reset flow (for edit intent action)
   */
  const resetFlow = useCallback(() => {
    setFlowState({ phase: "idle", confirmationCard: null, error: null });
  }, []);

  return {
    flowState,
    shouldTriggerOnboarding,
    startOnboardingFlow,
    confirmClaims,
    skipOnboarding,
    resetFlow,
  };
}
