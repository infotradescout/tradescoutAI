import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import {
  isSafeNextPath,
  resolveDirectConnectLandingRoute,
  getBusinessOnboardingRoute,
} from "@/lib/postOnboardingRoute";

type OnboardingLane =
  | "find_help"
  | "manage_projects"
  | "offer_services"
  | "sell_items"
  | "real_estate"
  | "business"
  | "community"
  | "browse_only";

type OnboardingAsset = "home" | "vehicle" | "project" | "business" | "saved_search";
type ObjectiveUrgency = "low" | "medium" | "high";

type FastWinActionCard = {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  actionTarget: string;
  objectiveId: string;
  valueScore: number;
  urgency: ObjectiveUrgency;
};

type ObjectiveSuggestion = {
  id: string;
  title: string;
  description: string;
  recommendedRoute: string;
};

type ObjectiveOnboardingBundle = {
  role: string;
  suggestions: ObjectiveSuggestion[];
  fastWins: FastWinActionCard[];
  nextRecommendedObjectiveId?: string;
  completionSummary: {
    completedCount: number;
    inProgressCount: number;
    pendingCount: number;
    completionRate: number;
  };
};

const INTENT_OPTIONS: Array<{
  labelKey: string;
  detailKey: string;
  lane: OnboardingLane;
}> = [
  {
    labelKey: "onboarding.intent.fixImprove",
    detailKey: "onboarding.intent.fixImproveDetail",
    lane: "manage_projects",
  },
  {
    labelKey: "onboarding.intent.vehicleService",
    detailKey: "onboarding.intent.vehicleServiceDetail",
    lane: "find_help",
  },
  {
    labelKey: "onboarding.intent.findPersonBusiness",
    detailKey: "onboarding.intent.findPersonBusinessDetail",
    lane: "find_help",
  },
  {
    labelKey: "onboarding.intent.sellList",
    detailKey: "onboarding.intent.sellListDetail",
    lane: "sell_items",
  },
  {
    labelKey: "onboarding.intent.propertyRealEstate",
    detailKey: "onboarding.intent.propertyRealEstateDetail",
    lane: "real_estate",
  },
  {
    labelKey: "onboarding.intent.offerServices",
    detailKey: "onboarding.intent.offerServicesDetail",
    lane: "offer_services",
  },
  {
    labelKey: "onboarding.intent.browseActivity",
    detailKey: "onboarding.intent.browseActivityDetail",
    lane: "community",
  },
  {
    labelKey: "onboarding.intent.justLooking",
    detailKey: "onboarding.intent.justLookingDetail",
    lane: "browse_only",
  },
];

const ASSET_OPTIONS: Array<{ labelKey: string; asset: OnboardingAsset }> = [
  { labelKey: "onboarding.assets.home", asset: "home" },
  { labelKey: "onboarding.assets.vehicle", asset: "vehicle" },
  { labelKey: "onboarding.assets.project", asset: "project" },
  { labelKey: "onboarding.assets.business", asset: "business" },
  { labelKey: "onboarding.assets.savedSearch", asset: "saved_search" },
];

const LEGACY_LANE_MAP: Record<string, { lane: OnboardingLane; asset?: OnboardingAsset }> = {
  homeowner: { lane: "manage_projects", asset: "home" },
  vehicle_owner: { lane: "manage_projects", asset: "vehicle" },
  service_provider: { lane: "offer_services" },
  seller: { lane: "sell_items" },
  realtor: { lane: "real_estate" },
  business_owner: { lane: "business" },
  community_member: { lane: "community" },
};

function mapIncomingLane(rawLane: string): {
  lane: OnboardingLane | null;
  seedAssets: OnboardingAsset[];
} {
  if (!rawLane) return { lane: null, seedAssets: [] };
  const direct = INTENT_OPTIONS.find((opt) => opt.lane === rawLane);
  if (direct) return { lane: direct.lane, seedAssets: [] };
  const legacy = LEGACY_LANE_MAP[rawLane];
  if (!legacy) return { lane: null, seedAssets: [] };
  return {
    lane: legacy.lane,
    seedAssets: legacy.asset ? [legacy.asset] : [],
  };
}

function inferObjectiveRole(lane: OnboardingLane | null, user: any): string | undefined {
  if (typeof user?.role === "string" && user.role.trim()) return user.role;
  switch (lane) {
    case "offer_services":
      return "contractor";
    case "real_estate":
      return "realtor";
    case "manage_projects":
    case "find_help":
    case "community":
    case "browse_only":
      return "homeowner";
    default:
      return undefined;
  }
}

function resolveLaneDestination(
  lane: OnboardingLane,
  user: any,
  nextPath?: string | null,
  bundle?: ObjectiveOnboardingBundle | null
): string {
  const trimmedNext = String(nextPath || "").trim();
  if (trimmedNext && isSafeNextPath(trimmedNext)) {
    return trimmedNext;
  }

  const fastWinTarget = String(bundle?.fastWins?.[0]?.actionTarget || "").trim();
  if (fastWinTarget.startsWith("/")) {
    return fastWinTarget;
  }

  switch (lane) {
    case "offer_services":
    case "business":
      return getBusinessOnboardingRoute(user) || "/offer-services?onboarding=business";
    case "sell_items":
      return "/exchange";
    case "real_estate":
      return "/homescout-listings";
    case "community":
      return "/community";
    case "browse_only":
      return "/scout?resumeSetup=1";
    case "find_help":
    case "manage_projects":
    default:
      return resolveDirectConnectLandingRoute({ entry: "intent" });
  }
}

function formatUrgencyTone(urgency: ObjectiveUrgency): string {
  switch (urgency) {
    case "high":
      return "Best first move";
    case "medium":
      return "Good next step";
    default:
      return "Worth setting up";
  }
}

export default function OnboardingIntent() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [selectedLane, setSelectedLane] = useState<OnboardingLane | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<OnboardingAsset[]>([]);
  const [objectiveBundle, setObjectiveBundle] = useState<ObjectiveOnboardingBundle | null>(null);

  const search = useMemo(() => {
    const raw = String(location || "");
    const query = raw.includes("?") ? raw.split("?", 2)[1] : "";
    return new URLSearchParams(query);
  }, [location]);

  const laneFromUrl = (search.get("lane") || "").trim();
  const nextParam = (search.get("next") || "").trim();
  const safeNext = nextParam.startsWith("/") ? nextParam : "";
  const mappedIncoming = useMemo(() => mapIncomingLane(laneFromUrl), [laneFromUrl]);
  const activeLane = selectedLane || mappedIncoming.lane;
  const resolvedAssets = useMemo(
    () => Array.from(new Set([...mappedIncoming.seedAssets, ...selectedAssets])),
    [mappedIncoming.seedAssets, selectedAssets]
  );

  const startIntent = useMutation({
    mutationFn: async (lane: OnboardingLane) => {
      const anyUser = (user || {}) as any;
      const fullName = [anyUser.firstName, anyUser.lastName].filter(Boolean).join(" ").trim();
      return apiRequest("POST", "/api/onboarding/start", {
        lane,
        assets: mappedIncoming.seedAssets,
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
      setSelectedAssets((prev) => Array.from(new Set([...mappedIncoming.seedAssets, ...prev])));
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save intent",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const objectiveBundleMutation = useMutation({
    mutationFn: async ({ lane, assets }: { lane: OnboardingLane; assets: OnboardingAsset[] }) => {
      const anyUser = (user || {}) as any;
      return apiRequest("POST", "/api/scout/onboarding/objective-bundle", {
        role: inferObjectiveRole(lane, anyUser),
        countyFips: anyUser.countyFips,
        stateCode: anyUser.stateCode,
        objectiveStates: [],
        assets,
      }) as Promise<ObjectiveOnboardingBundle>;
    },
    onSuccess: (bundle) => {
      setObjectiveBundle(bundle);
    },
    onError: () => {
      setObjectiveBundle(null);
    },
  });

  const saveAssets = useMutation({
    mutationFn: async (assets: OnboardingAsset[]) => {
      if (!activeLane) throw new Error("Select an intent first.");
      await apiRequest("POST", "/api/onboarding/complete-step", {
        stepKey: "assets_selected",
        assets,
      });
      return apiRequest("POST", "/api/onboarding/complete-step", {
        stepKey: "intent_assets_complete",
        completeOnboarding: true,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const lane = activeLane || "find_help";
      navigate(resolveLaneDestination(lane, user, safeNext, objectiveBundle));
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save onboarding",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isAuthenticated || !activeLane) return;
    objectiveBundleMutation.mutate({
      lane: activeLane,
      assets: resolvedAssets,
    });
  }, [activeLane, isAuthenticated, resolvedAssets]);

  const isBusy = startIntent.isPending || saveAssets.isPending || objectiveBundleMutation.isPending;

  const handleChooseIntent = (lane: OnboardingLane) => {
    if (!isAuthenticated) {
      navigate(`/pre-scout-setup?mode=create&next=${encodeURIComponent("/onboarding/intent")}`);
      return;
    }
    setObjectiveBundle(null);
    startIntent.mutate(lane);
  };

  const toggleAsset = (asset: OnboardingAsset) => {
    setSelectedAssets((prev) =>
      prev.includes(asset) ? prev.filter((value) => value !== asset) : [...prev, asset]
    );
  };

  const handleSaveAssets = () => {
    if (!isAuthenticated) {
      navigate(`/pre-scout-setup?mode=create&next=${encodeURIComponent("/onboarding/intent")}`);
      return;
    }
    saveAssets.mutate(resolvedAssets);
  };

  const laneChosen = Boolean(activeLane);
  const primaryFastWin = objectiveBundle?.fastWins?.[0] || null;
  const destinationPreview = activeLane
    ? resolveLaneDestination(activeLane, user, safeNext, objectiveBundle)
    : null;

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
            {t("common.back")}
          </Button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">
              {laneChosen
                ? t("onboarding.step", { current: 2, total: 2 })
                : t("onboarding.step", { current: 1, total: 2 })}
            </div>
          </div>
        </div>

        <Card className="bg-tsCard border border-white/10">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <TradeScoutLogo size="xs" />
              <span className="text-xs uppercase tracking-[0.2em] text-white/60">TRADESCOUT</span>
            </div>
            <CardTitle className="text-lg font-semibold text-white">
              {laneChosen ? t("onboarding.assetTitle") : t("onboarding.intentTitle")}
            </CardTitle>
            {laneChosen ? (
              <p className="text-sm text-white/65">
                TradeScout is turning your answers into a first-use plan so your next screen is
                useful, not generic.
              </p>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-3">
            {!laneChosen ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {INTENT_OPTIONS.map((option) => (
                  <button
                    key={option.lane}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleChooseIntent(option.lane)}
                    className="rounded-xl border border-white/10 bg-tsBg px-3 py-2.5 text-left transition hover:border-ts-orange/60 hover:bg-black/40"
                  >
                    <div className="text-sm font-semibold text-white">{t(option.labelKey)}</div>
                    <div className="mt-1 text-xs text-white/65">{t(option.detailKey)}</div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {objectiveBundleMutation.isPending ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-ts-orange" />
                      <span>Building your first-run plan from this setup.</span>
                    </div>
                  </div>
                ) : primaryFastWin ? (
                  <div className="rounded-xl border border-ts-orange/30 bg-ts-orange/10 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ts-orange">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{formatUrgencyTone(primaryFastWin.urgency)}</span>
                        </div>
                        <div className="mt-2 text-base font-semibold text-white">
                          {primaryFastWin.title}
                        </div>
                        <p className="mt-1 text-sm text-white/70">{primaryFastWin.body}</p>
                      </div>
                      <div className="rounded-full border border-ts-orange/35 px-2.5 py-1 text-[11px] font-semibold text-ts-orange">
                        Score {primaryFastWin.valueScore}
                      </div>
                    </div>
                    {objectiveBundle?.fastWins && objectiveBundle.fastWins.length > 1 ? (
                      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                        {objectiveBundle.fastWins.slice(1, 3).map((card) => (
                          <div
                            key={card.id}
                            className="flex items-start gap-2 text-xs text-white/65"
                          >
                            <ArrowRight className="mt-0.5 h-3.5 w-3.5 text-ts-orange" />
                            <span>
                              <span className="font-medium text-white/85">{card.title}.</span>{" "}
                              {card.body}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ASSET_OPTIONS.map((option) => {
                    const active =
                      selectedAssets.includes(option.asset) ||
                      mappedIncoming.seedAssets.includes(option.asset);
                    return (
                      <button
                        key={option.asset}
                        type="button"
                        disabled={isBusy}
                        onClick={() => toggleAsset(option.asset)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-ts-orange/70 bg-ts-orange/10"
                            : "border-white/10 bg-tsBg hover:border-ts-orange/60 hover:bg-black/40"
                        }`}
                      >
                        <div className="text-sm font-semibold text-white">{t(option.labelKey)}</div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleSaveAssets}
                    className="rounded-xl border border-white/10 bg-tsBg px-3 py-2.5 text-left transition hover:border-ts-orange/60 hover:bg-black/40"
                  >
                    <div className="text-sm font-semibold text-white">
                      {t("onboarding.nothingYet")}
                    </div>
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveAssets} disabled={isBusy}>
                    {primaryFastWin ? primaryFastWin.actionLabel : t("common.continue")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedLane(null)}
                    disabled={isBusy}
                  >
                    {t("onboarding.changeIntent")}
                  </Button>
                </div>
                {destinationPreview ? (
                  <p className="text-[11px] text-white/45">
                    Next up: <span className="text-white/70">{destinationPreview}</span>
                  </p>
                ) : null}
                <p className="text-[11px] text-white/55">{t("onboarding.roleAssetHint")}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
