import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type OnboardingLane =
  | "homeowner"
  | "vehicle_owner"
  | "service_provider"
  | "seller"
  | "realtor"
  | "business_owner"
  | "community_member"
  | "browse_only";

type LaneChoice = {
  label: string;
  detail: string;
  lane: OnboardingLane;
};

const LANE_CHOICES: LaneChoice[] = [
  { label: "Manage my home", detail: "Repairs, records, projects, and upkeep", lane: "homeowner" },
  {
    label: "Manage my vehicle",
    detail: "Service, records, listings, and value",
    lane: "vehicle_owner",
  },
  {
    label: "Find local help",
    detail: "Post requests and review trusted replies",
    lane: "community_member",
  },
  {
    label: "Provide services",
    detail: "Offer work locally with trust-gated exposure",
    lane: "service_provider",
  },
  {
    label: "Sell or list something",
    detail: "Create local listings and track activity",
    lane: "seller",
  },
  {
    label: "Real estate / property work",
    detail: "Property-focused workflows and setup",
    lane: "realtor",
  },
  {
    label: "Run a local business",
    detail: "Business profile, verification, and operations",
    lane: "business_owner",
  },
  {
    label: "Just browse for now",
    detail: "Explore first and set up more later",
    lane: "browse_only",
  },
];

const NEXT_STEPS: Record<
  OnboardingLane,
  {
    title: string;
    primary: { label: string; to: string };
    secondary?: { label: string; to: string };
  }
> = {
  homeowner: {
    title: "Next: add your home profile or continue for now.",
    primary: { label: "Add home", to: "/homes" },
    secondary: { label: "Skip to Scout", to: "/scout" },
  },
  vehicle_owner: {
    title: "Next: add your vehicle or continue for now.",
    primary: { label: "Add vehicle", to: "/vehicles" },
    secondary: { label: "Skip to Scout", to: "/scout" },
  },
  service_provider: {
    title: "Next: start your provider/business profile setup.",
    primary: { label: "Start provider profile", to: "/offer-services?onboarding=business" },
    secondary: { label: "Open Direct Connect", to: "/direct-connect" },
  },
  seller: {
    title: "Next: create your first listing or set up seller basics.",
    primary: { label: "Create listing", to: "/exchange/new" },
    secondary: { label: "Open Exchange", to: "/exchange" },
  },
  realtor: {
    title: "Next: start your property/business profile setup.",
    primary: { label: "Start profile", to: "/offer-services?onboarding=business" },
    secondary: { label: "Open Scout", to: "/scout" },
  },
  business_owner: {
    title: "Next: start your business profile and verification flow.",
    primary: { label: "Start business profile", to: "/offer-services?onboarding=business" },
    secondary: { label: "Open Direct Connect", to: "/direct-connect" },
  },
  community_member: {
    title: "Next: set your location/interests and start your first request.",
    primary: { label: "Open Direct Connect", to: "/direct-connect" },
    secondary: { label: "Open Community", to: "/community" },
  },
  browse_only: {
    title: "Next: continue to Scout and explore your local area.",
    primary: { label: "Continue to Scout", to: "/scout" },
  },
};

export default function OnboardingIntent() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [selectedLane, setSelectedLane] = useState<OnboardingLane | null>(null);

  const search = useMemo(() => {
    const raw = String(location || "");
    const query = raw.includes("?") ? raw.split("?", 2)[1] : "";
    return new URLSearchParams(query);
  }, [location]);

  const laneFromUrl = (search.get("lane") || "").trim() as OnboardingLane;
  const activeLane =
    selectedLane || (LANE_CHOICES.some((c) => c.lane === laneFromUrl) ? laneFromUrl : null);

  const startLane = useMutation({
    mutationFn: async (lane: OnboardingLane) => {
      const anyUser = (user || {}) as any;
      const fullName = [anyUser.firstName, anyUser.lastName].filter(Boolean).join(" ").trim();
      return apiRequest("POST", "/api/onboarding/start", {
        lane,
        profile: {
          fullName,
          phone: anyUser.phone || "",
          location: {
            state: anyUser.stateCode || "",
            county: anyUser.countyName || "",
            city: anyUser.city || "",
          },
        },
      });
    },
    onSuccess: async (_data, lane) => {
      setSelectedLane(lane);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Onboarding started",
        description: "Great. We saved your lane. Next step is ready below.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't start onboarding",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const handlePickLane = (lane: OnboardingLane) => {
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
      return;
    }
    startLane.mutate(lane);
  };

  const handleContinue = (to: string) => {
    navigate(to);
  };

  const isBusy = startLane.isPending;
  const nextStep = activeLane ? NEXT_STEPS[activeLane] : null;

  return (
    <div className="flex justify-center px-3 py-6 text-white">
      <div className="w-full max-w-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/onboarding/profile")}
            disabled={isBusy}
            className="px-0 text-white/60 hover:text-white hover:bg-transparent"
          >
            Back
          </Button>
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">Step 2/2</div>
        </div>

        <Card className="bg-tsCard border border-white/10">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <TradeScoutLogo size="xs" />
              <span className="text-xs uppercase tracking-[0.2em] text-white/60">TRADESCOUT</span>
            </div>
            <CardTitle className="text-lg font-semibold text-white">
              What are you here to do?
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LANE_CHOICES.map((choice) => {
                const isActive = activeLane === choice.lane;
                return (
                  <button
                    key={choice.lane}
                    type="button"
                    onClick={() => handlePickLane(choice.lane)}
                    disabled={isBusy}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      isActive
                        ? "border-ts-orange/70 bg-ts-orange/10"
                        : "border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40"
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{choice.label}</div>
                    <div className="mt-1 text-xs text-white/65">{choice.detail}</div>
                  </button>
                );
              })}
            </div>

            {nextStep ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm text-white">{nextStep.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleContinue(nextStep.primary.to)}>
                    {nextStep.primary.label}
                  </Button>
                  {nextStep.secondary ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleContinue(nextStep.secondary!.to)}
                    >
                      {nextStep.secondary.label}
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] text-white/55">
                  Lane selection records intent only. Capability access still follows trust and
                  verification rules.
                </p>
              </div>
            ) : (
              <p className="text-xs text-white/60">
                Pick one lane to continue. You can adjust this later in settings.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
