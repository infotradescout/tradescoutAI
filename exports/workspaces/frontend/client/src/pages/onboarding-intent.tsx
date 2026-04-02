import React, { useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Users, Briefcase, SlidersHorizontal } from "lucide-react";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type StartIntent = "community" | "services" | "business" | "tools";

const INTENT_ROUTES: Record<StartIntent, string> = {
  community: "/community-feed",
  services: "/contractors",
  business: "/offer-services",
  tools: "/scout",
} as const;

export default function OnboardingIntent() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const search = useMemo(() => {
    const raw = String(location || "");
    const query = raw.includes("?") ? raw.split("?", 2)[1] : "";
    return new URLSearchParams(query);
  }, [location]);
  const nextParam = (search.get("next") || "").trim();
  const postIntentNext = nextParam.startsWith("/") ? nextParam : routeForIntentFallback();

  const saveIntent = useMutation({
    mutationFn: async (intent: StartIntent | null) => {
      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
      const mergedPreferences = {
        ...existingPrefs,
        startIntent: intent || undefined,
      };

      await apiRequest("PUT", "/api/user/profile", {
        preferences: mergedPreferences,
      });
      return apiRequest("POST", "/api/user/complete-onboarding", {});
    },
    onSuccess: (_data, intent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate(postIntentNext || routeForIntent(intent));
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save preference",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const routeForIntent = (intent: StartIntent | null): string => {
    if (!intent) return INTENT_ROUTES.community;
    return INTENT_ROUTES[intent];
  };

  function routeForIntentFallback(): string {
    return INTENT_ROUTES.community;
  }

  const handleChoose = (intent: StartIntent | null) => {
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
      return;
    }

    saveIntent.mutate(intent);
  };

  const handleSkipForNow = async () => {
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
      return;
    }

    try {
      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
      await apiRequest("PUT", "/api/user/profile", {
        preferences: {
          ...existingPrefs,
          onboardingDeferredAt: new Date().toISOString(),
          onboardingDeferredFrom: "onboarding_intent",
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Setup paused",
        description:
          "You can continue now. Finish onboarding soon so Scout can route and rank next steps correctly.",
      });
    } catch {
      // fail-soft: never trap users on skip
    }

    navigate(postIntentNext || routeForIntentFallback());
  };

  return (
    <div className="flex justify-center px-3 py-6 text-white">
      <div className="w-full max-w-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleSkipForNow}
            className="px-0 text-white/60 hover:text-white hover:bg-transparent"
          >
            Skip for now
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
            <CardTitle className="text-lg font-semibold text-white">Pick your start</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="mb-3 text-xs text-white/70">
              This step is essential to Scout quality. You can skip for now, but your matches, next
              steps, and routing will stay less accurate until you finish onboarding.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChoose("community")}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ts-orange/70/80 border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-ts-orange" />
                  <span className="font-medium text-white">Community</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("services")}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ts-orange/70/80 border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-ts-orange" />
                  <span className="font-medium text-white">Find pros</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("business")}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ts-orange/70/80 border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-ts-orange" />
                  <span className="font-medium text-white">Business</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("tools")}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ts-orange/70/80 border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-ts-orange" />
                  <span className="font-medium text-white">Scout</span>
                </div>
              </button>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={handleSkipForNow}
                className="text-xs text-white/60 underline-offset-2 hover:underline text-left"
              >
                Skip for now and continue
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
