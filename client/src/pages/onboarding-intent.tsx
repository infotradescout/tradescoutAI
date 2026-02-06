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
      navigate("/create-account");
      return;
    }

    saveIntent.mutate(intent);
    navigate(routeForIntent(intent));
  };

  return (
    <div className="min-h-screen  flex items-center justify-center px-4 py-10 text-tsTextMain">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate(INTENT_ROUTES.community)}
            className="flex items-center gap-2 text-tsTextMuted hover:text-white hover:bg-white/5 pl-0"
          >
            <span className="text-sm">Skip for now</span>
          </Button>

          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-tsBorder/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
              WHAT DO YOU WANT TO DO FIRST?
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              What would you like to focus on right now?
            </h1>
            <p className="text-sm md:text-base text-tsTextMuted max-w-xl">
              This doesn't lock you into a role or limit what you can do. It just tells Scout what
              to open first - you can always explore everything from the navigation.
            </p>
          </div>
        </div>

        <Card className="bg-tsCard border border-tsBorder shadow-2xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TradeScoutLogo size="xs" />
                <span className="text-xs uppercase tracking-[0.2em] text-tsTextMuted">
                  TRADESCOUT
                </span>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-tsTextMain">
              Choose a starting point
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => handleChoose("community")}
                className="text-left rounded-xl border px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-3 mb-1">
                  <Users className="h-4 w-4 text-tsAccent" />
                  <span className="font-medium text-tsTextMain">Explore my neighborhood</span>
                </div>
                <p className="text-xs text-tsTextMuted">
                  See posts, updates, and activity from people near you.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("services")}
                className="text-left rounded-xl border px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-3 mb-1">
                  <Briefcase className="h-4 w-4 text-tsAccent" />
                  <span className="font-medium text-tsTextMain">Find local pros</span>
                </div>
                <p className="text-xs text-tsTextMuted">
                  Browse licensed and verified pros for projects and repairs.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("business")}
                className="text-left rounded-xl border px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-3 mb-1">
                  <MessageCircle className="h-4 w-4 text-tsAccent" />
                  <span className="font-medium text-tsTextMain">Share my work or business</span>
                </div>
                <p className="text-xs text-tsTextMuted">
                  Start from your business tools and dashboards.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleChoose("tools")}
                className="text-left rounded-xl border px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
              >
                <div className="flex items-center gap-3 mb-1">
                  <SlidersHorizontal className="h-4 w-4 text-tsAccent" />
                  <span className="font-medium text-tsTextMain">Use Scout tools</span>
                </div>
                <p className="text-xs text-tsTextMuted">
                  Jump into dashboards, notes, and planners.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleChoose(null)}
                className="mt-2 text-xs text-tsTextMuted underline-offset-2 hover:underline text-left"
              >
                Just take me to the community
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
