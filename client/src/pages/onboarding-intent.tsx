import React, { useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { apiRequest } from "@/lib/queryClient";
import { Users, Briefcase, SlidersHorizontal, Zap } from "lucide-react";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  resolvePostOnboardingRoute,
  consumeOnboardingNext,
  isBusinessUser,
} from "@/lib/postOnboardingRoute";
import { trackShellEvent } from "@/lib/analytics";

type StartIntent = "community" | "services" | "business" | "tools";

export default function OnboardingIntent() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  // Read ?next= from the URL (set by AppRoutes when gating a protected route)
  const search = useMemo(() => {
    const raw = String(location || "");
    const query = raw.includes("?") ? raw.split("?", 2)[1] : "";
    return new URLSearchParams(query);
  }, [location]);

  const urlNextParam = (search.get("next") || "").trim();

  /**
   * Compute the final destination after onboarding.
   * Priority: ?next= URL param > sessionStorage backup > role-based default.
   */
  const resolveDestination = (chosenIntent?: StartIntent | null): string => {
    const storedNext = consumeOnboardingNext();
    const nextParam = urlNextParam || storedNext || null;
    return resolvePostOnboardingRoute({
      nextParam,
      user: user as any,
      presenceType: null, // presenceType already committed to the user record by this step
      chosenIntent: chosenIntent ?? null,
    });
  };

  // ── Save intent + complete onboarding ──────────────────────────────────────
  const saveIntent = useMutation({
    mutationFn: async (intent: StartIntent | null) => {
      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
      await apiRequest("PUT", "/api/user/profile", {
        preferences: {
          ...existingPrefs,
          startIntent: intent || undefined,
        },
      });
      return apiRequest("POST", "/api/user/complete-onboarding", {});
    },
    onSuccess: (_data, intent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const destination = resolveDestination(intent);
      // Funnel events: intent chosen + onboarding completed
      void trackShellEvent({
        type: "onboarding_intent_chosen",
        intent: intent!,
        presenceType: userIsBusiness ? "represent_business" : "personal",
        destination,
        ts: new Date().toISOString(),
      });
      void trackShellEvent({
        type: "onboarding_completed",
        presenceType: userIsBusiness ? "represent_business" : "personal",
        draftPromoted: Boolean((user as any)?.preferences?.provisional?.promotedAt),
        destination,
        ts: new Date().toISOString(),
      });
      navigate(destination);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save preference",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  // ── Skip: mark complete and route to smart default ─────────────────────────
  const skipMutation = useMutation({
    mutationFn: async () => {
      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
      await apiRequest("PUT", "/api/user/profile", {
        preferences: {
          ...existingPrefs,
          onboardingSkippedAt: new Date().toISOString(),
          onboardingSkippedFrom: "onboarding_intent",
        },
      });
      return apiRequest("POST", "/api/user/complete-onboarding", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const destination = resolveDestination(null);
      // Funnel events: intent skipped + onboarding completed
      void trackShellEvent({
        type: "onboarding_intent_skipped",
        presenceType: userIsBusiness ? "represent_business" : "personal",
        destination,
        ts: new Date().toISOString(),
      });
      void trackShellEvent({
        type: "onboarding_completed",
        presenceType: userIsBusiness ? "represent_business" : "personal",
        draftPromoted: Boolean((user as any)?.preferences?.provisional?.promotedAt),
        destination,
        ts: new Date().toISOString(),
      });
      toast({
        title: "All set",
        description: "You can update your preferences anytime in Settings.",
      });
      navigate(destination);
    },
    onError: () => {
      // Fail-soft: never trap the user in the onboarding funnel
      navigate(resolveDestination(null));
    },
  });

  const handleChoose = (intent: StartIntent) => {
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
      return;
    }
    saveIntent.mutate(intent);
  };

  const handleSkipForNow = () => {
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
      return;
    }
    skipMutation.mutate();
  };

  const isBusy = saveIntent.isPending || skipMutation.isPending;

  // Detect if this is a business/service-provider user so we can highlight the right default
  const userIsBusiness = isBusinessUser(user as any, null);

  return (
    <div className="flex justify-center px-3 py-6 text-white">
      <div className="w-full max-w-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleSkipForNow}
            disabled={isBusy}
            className="px-0 text-white/60 hover:text-white hover:bg-transparent"
          >
            {skipMutation.isPending ? "Saving…" : "Skip for now"}
          </Button>
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">Step 2/2</div>
        </div>

        <Card className="bg-tsCard border border-white/10">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TradeScoutLogo size="xs" />
                <span className="text-xs uppercase tracking-[0.2em] text-white/60">TRADESCOUT</span>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-white">
              Where do you want to start?
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="mb-3 text-xs text-white/70">
              {userIsBusiness
                ? "We'll take you to your profile & verification setup by default — or pick another surface below."
                : "We'll take you to Direct Connect by default — or pick a different surface below."}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {/* Direct Connect — default for personal users */}
              <button
                type="button"
                onClick={() => handleChoose("services")}
                disabled={isBusy}
                className={`relative text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ts-orange/70 disabled:opacity-50 ${
                  !userIsBusiness
                    ? "border-ts-orange/60 bg-ts-orange/10 hover:bg-ts-orange/20"
                    : "border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-ts-orange" />
                  <span className="font-medium text-white">Direct Connect</span>
                  {!userIsBusiness && (
                    <span className="ml-auto text-[10px] text-ts-orange font-semibold uppercase tracking-wide">
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/65">Post a job or find a pro instantly.</p>
              </button>

              {/* Offer Services — default for business users */}
              <button
                type="button"
                onClick={() => handleChoose("business")}
                disabled={isBusy}
                className={`relative text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ts-orange/70 disabled:opacity-50 ${
                  userIsBusiness
                    ? "border-ts-orange/60 bg-ts-orange/10 hover:bg-ts-orange/20"
                    : "border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-ts-orange" />
                  <span className="font-medium text-white">Offer Services</span>
                  {userIsBusiness && (
                    <span className="ml-auto text-[10px] text-ts-orange font-semibold uppercase tracking-wide">
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/65">
                  Set up your profile &amp; verification.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("community")}
                disabled={isBusy}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ts-orange/70 border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-ts-orange" />
                  <span className="font-medium text-white">Community</span>
                </div>
                <p className="mt-1 text-xs text-white/65">See local posts and updates.</p>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("tools")}
                disabled={isBusy}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ts-orange/70 border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-ts-orange" />
                  <span className="font-medium text-white">Scout Assist</span>
                </div>
                <p className="mt-1 text-xs text-white/65">Start in Direct Connect with help.</p>
              </button>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={handleSkipForNow}
                disabled={isBusy}
                className="text-xs text-white/60 underline-offset-2 hover:underline text-left disabled:opacity-50"
              >
                {skipMutation.isPending ? "Saving…" : "Skip and choose later"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
