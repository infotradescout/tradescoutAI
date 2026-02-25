import React from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Users, Briefcase, SlidersHorizontal } from "lucide-react";

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
  const [, navigate] = useLocation();

  const saveIntent = useMutation({
    mutationFn: async (intent: StartIntent | null) => {
      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
      const mergedPreferences = {
        ...existingPrefs,
        startIntent: intent || undefined,
      };

      return apiRequest("PUT", "/api/user/profile", {
        preferences: mergedPreferences,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save preference",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const routeForIntent = (intent: StartIntent | null): string => {
    if (!intent) return INTENT_ROUTES.community;
    return INTENT_ROUTES[intent];
  };

  const handleChoose = (intent: StartIntent | null) => {
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
      return;
    }

    saveIntent.mutate(intent);
    navigate(routeForIntent(intent));
  };

  return (
    <div className="flex justify-center px-3 py-6 text-tsTextMain">
      <div className="w-full max-w-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(INTENT_ROUTES.community)}
            className="px-0 text-tsTextMuted hover:text-white hover:bg-transparent"
          >
            Skip
          </Button>
          <div className="text-[11px] uppercase tracking-[0.15em] text-tsTextMuted">Step 2/2</div>
        </div>

        <Card className="bg-tsCard border border-tsBorder">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TradeScoutLogo size="xs" />
                <span className="text-xs uppercase tracking-[0.2em] text-tsTextMuted">
                  TRADESCOUT
                </span>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-tsTextMain">Pick your start</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChoose("community")}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-tsAccent" />
                  <span className="font-medium text-tsTextMain">Community</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("services")}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-tsAccent" />
                  <span className="font-medium text-tsTextMain">Find pros</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("business")}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-tsAccent" />
                  <span className="font-medium text-tsTextMain">Business</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("tools")}
                className="text-left rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-tsAccent" />
                  <span className="font-medium text-tsTextMain">Scout</span>
                </div>
              </button>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => handleChoose(null)}
                className="text-xs text-tsTextMuted underline-offset-2 hover:underline text-left"
              >
                Open community
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
