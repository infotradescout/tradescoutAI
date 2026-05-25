import React, { useMemo, useState } from "react";
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

export default function OnboardingIntent() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [selectedLane, setSelectedLane] = useState<OnboardingLane | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<OnboardingAsset[]>([]);

  const search = useMemo(() => {
    const raw = String(location || "");
    const query = raw.includes("?") ? raw.split("?", 2)[1] : "";
    return new URLSearchParams(query);
  }, [location]);

  const laneFromUrl = (search.get("lane") || "").trim();
  const mappedIncoming = useMemo(() => mapIncomingLane(laneFromUrl), [laneFromUrl]);
  const activeLane = selectedLane || mappedIncoming.lane;

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
      const intent = activeLane || "find_help";
      navigate(`/direct-connect?intent=${encodeURIComponent(intent)}`);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save onboarding",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const isBusy = startIntent.isPending || saveAssets.isPending;

  const handleChooseIntent = (lane: OnboardingLane) => {
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
      return;
    }
    startIntent.mutate(lane);
  };

  const toggleAsset = (asset: OnboardingAsset) => {
    setSelectedAssets((prev) =>
      prev.includes(asset) ? prev.filter((value) => value !== asset) : [...prev, asset]
    );
  };

  const handleSaveAssets = () => {
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
      return;
    }
    saveAssets.mutate(Array.from(new Set([...mappedIncoming.seedAssets, ...selectedAssets])));
  };

  const laneChosen = Boolean(activeLane);

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
                    {t("common.continue")}
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
                <p className="text-[11px] text-white/55">{t("onboarding.roleAssetHint")}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
