import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { StateCountySelector } from "@/components/state-county-selector";
import {
  GooglePlacesLocationInput,
  type PlaceResult,
} from "@/components/GooglePlacesLocationInput";
import { apiRequest } from "@/lib/queryClient";
import { inferCountyForCityState } from "@/lib/countyInference";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  resolveDirectConnectLandingRoute,
  storeOnboardingNext,
  isSafeNextPath,
} from "@/lib/postOnboardingRoute";
import { trackShellEvent } from "@/lib/analytics";

function sanitizeNext(next: string) {
  if (!next.startsWith("/")) return "";
  if (
    next.startsWith("/pre-scout-setup") ||
    next.startsWith("/login") ||
    next.startsWith("/register") ||
    next.startsWith("/onboarding")
  ) {
    return "";
  }
  return isSafeNextPath(next) ? next : "";
}

function buildIntentRoute(next: string) {
  // Persist the deep-link so it survives the intent step
  if (next) storeOnboardingNext(next);
  return next ? `/onboarding/intent?next=${encodeURIComponent(next)}` : "/onboarding/intent";
}

type CountyInferenceStatus = "idle" | "loading" | "inferred" | "ambiguous" | "error";

export default function OnboardingProfile() {
  const { user, isAuthenticated, isLoading, refetch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const search = useMemo(() => {
    const raw = String(location || "");
    const query = raw.includes("?") ? raw.split("?", 2)[1] : "";
    return new URLSearchParams(query);
  }, [location]);

  const nextParam = (search.get("next") || "").trim();
  const safeNext = nextParam.startsWith("/") ? nextParam : "";
  const postProfileNext =
    sanitizeNext(safeNext) || resolveDirectConnectLandingRoute({ entry: "onboarding" });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [countyFips, setCountyFips] = useState("");
  const [countyName, setCountyName] = useState<string | undefined>(undefined);
  const [city, setCity] = useState("");
  const [countyInferenceStatus, setCountyInferenceStatus] = useState<CountyInferenceStatus>("idle");
  const [countyInferenceNote, setCountyInferenceNote] = useState("");
  // Track whether the location was resolved via Google Places (vs. manual typing)
  const [locationSource, setLocationSource] = useState<"places" | "manual" | "none">("none");

  // Hydrate from user record on mount
  useEffect(() => {
    if (!user || !isAuthenticated) return;
    const anyUser: any = user;
    const profileVersion: number =
      typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

    if (profileVersion >= CURRENT_PROFILE_VERSION) {
      if ((anyUser.onboardingCompleted as boolean | undefined) === true) {
        navigate(postProfileNext);
      } else {
        navigate(buildIntentRoute(postProfileNext));
      }
      return;
    }

    setFirstName(anyUser.firstName || "");
    setLastName(anyUser.lastName || "");
    setStateCode(anyUser.stateCode || "");
    setCountyFips(anyUser.countyFips || "");
    setCountyName(anyUser.countyName || undefined);
    setCity(anyUser.city || "");
  }, [user, isAuthenticated, navigate, postProfileNext]);

  // Auto-infer county from city + state when user types manually (debounced, 350 ms)
  useEffect(() => {
    // Skip inference when location came from Google Places — already resolved
    if (locationSource === "places") return;

    const normalizedCity = city.trim();
    if (!/^[A-Z]{2}$/.test(stateCode) || normalizedCity.length < 2) {
      setCountyInferenceStatus("idle");
      setCountyInferenceNote("");
      return;
    }
    if (countyFips) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCountyInferenceStatus("loading");
      setCountyInferenceNote("");
      try {
        const inferred = await inferCountyForCityState({
          city: normalizedCity,
          stateCode,
          signal: controller.signal,
        });
        if (cancelled) return;
        if (inferred?.inferred?.countyFips) {
          setCountyFips(inferred.inferred.countyFips);
          setCountyName(inferred.inferred.countyName || undefined);
          setCountyInferenceStatus("inferred");
          setCountyInferenceNote(
            `Auto-selected ${inferred.inferred.countyName}, ${inferred.inferred.stateCode}.`
          );
          return;
        }
        if (inferred?.ambiguous) {
          setCountyInferenceStatus("ambiguous");
          setCountyInferenceNote("Multiple counties match — select yours below.");
          return;
        }
        setCountyInferenceStatus("error");
        setCountyInferenceNote("Could not infer county. Select it manually below.");
      } catch (error: any) {
        if (cancelled || error?.name === "AbortError") return;
        setCountyInferenceStatus("error");
        setCountyInferenceNote("Could not infer county right now. Select it manually below.");
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [city, countyFips, stateCode, locationSource]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
    }
  }, [isAuthenticated, isLoading, navigate]);

  /**
   * Handle a place selected from Google Places Autocomplete.
   * Places API gives us city, state, and county name but NOT the FIPS code.
   * We resolve FIPS via the existing county-inference service.
   */
  const handlePlaceSelected = useCallback(async (result: PlaceResult) => {
    const newCity = result.city || "";
    const newState = result.stateCode || "";
    const newCountyName = result.countyName || "";

    setCity(newCity);
    if (newState) setStateCode(newState);
    setLocationSource("places");

    // Reset county while we resolve FIPS
    setCountyFips("");
    setCountyName(newCountyName || undefined);
    setCountyInferenceStatus("loading");
    setCountyInferenceNote("Resolving county…");

    if (!newState || (!newCity && !newCountyName)) {
      setCountyInferenceStatus("idle");
      setCountyInferenceNote("");
      return;
    }

    try {
      // Prefer county name for inference when available (more precise than city)
      const inferCity = newCountyName || newCity;
      const inferred = await inferCountyForCityState({
        city: inferCity,
        stateCode: newState,
      });

      if (inferred?.inferred?.countyFips) {
        setCountyFips(inferred.inferred.countyFips);
        setCountyName(inferred.inferred.countyName || newCountyName || undefined);
        setCountyInferenceStatus("inferred");
        setCountyInferenceNote(
          `Confirmed: ${inferred.inferred.countyName}, ${inferred.inferred.stateCode}`
        );
      } else if (inferred?.ambiguous) {
        setCountyInferenceStatus("ambiguous");
        setCountyInferenceNote("Multiple counties match — select yours below.");
      } else {
        setCountyInferenceStatus("ambiguous");
        setCountyInferenceNote(
          newCountyName
            ? `Found "${newCountyName}" — confirm your county below.`
            : "Select your county below to confirm."
        );
      }
    } catch {
      setCountyInferenceStatus("error");
      setCountyInferenceNote("Could not resolve county. Select it manually below.");
    }
  }, []);

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("Please add your name.");
      }
      if (!stateCode || !countyFips) {
        throw new Error("Please choose where you're active locally.");
      }
      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
      return apiRequest("PUT", "/api/user/profile", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city.trim() || undefined,
        stateCode,
        countyFips,
        countyName,
        preferences: existingPrefs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      try {
        refetch?.();
      } catch {
        // ignore refetch failures; invalidateQueries will still refresh eventually
      }
      toast({
        title: "Profile updated",
        description: "Profile saved. One more step so Scout can finish setting things up.",
      });
      // Funnel event: profile step completed
      void trackShellEvent({
        type: "onboarding_profile_completed",
        presenceType:
          ((user as any)?.preferences?.provisional?.profileDraft?.presenceType as
            | "personal"
            | "represent_business"
            | null) ?? null,
        profileVersion: CURRENT_PROFILE_VERSION,
        ts: new Date().toISOString(),
      });
      navigate(buildIntentRoute(postProfileNext));
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save profile",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (updateProfile.isPending) return;
    updateProfile.mutate();
  };

  const canContinue = !!firstName.trim() && !!lastName.trim() && !!stateCode && !!countyFips;

  // Inline county inference status indicator with icons
  const CountyInferenceIndicator = () => {
    if (countyInferenceStatus === "idle") return null;
    if (countyInferenceStatus === "loading") {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-white/60 mt-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Detecting county…</span>
        </div>
      );
    }
    if (countyInferenceStatus === "inferred") {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-1">
          <CheckCircle2 className="h-3 w-3" />
          <span>{countyInferenceNote}</span>
        </div>
      );
    }
    // ambiguous or error
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mt-1">
        <AlertTriangle className="h-3 w-3" />
        <span>{countyInferenceNote}</span>
      </div>
    );
  };

  return (
    <div className="flex justify-center px-3 py-6 text-white">
      <div className="w-full max-w-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(resolveDirectConnectLandingRoute({ entry: "onboarding" }))}
            className="px-0 text-white/60 hover:text-white hover:bg-transparent"
          >
            Back
          </Button>
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">Step 1/2</div>
        </div>

        <Card className="rounded-2xl border border-white/10 bg-tsCard/95 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TradeScoutLogo size="xs" />
                <span className="text-xs uppercase tracking-[0.2em] text-white/60">TRADESCOUT</span>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-white">Quick setup check</CardTitle>
            <p className="text-sm text-white/70">
              We use this to keep local matching accurate from your first request.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                    First name
                  </Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                    Last name
                  </Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Google Places city / area search */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                  City or area (optional)
                </Label>
                <GooglePlacesLocationInput
                  placeholder="Search your city or neighborhood"
                  defaultValue={city}
                  onPlaceSelected={handlePlaceSelected}
                  className="mt-1 w-full"
                  data-testid="places-city-input"
                />
                <p className="text-[10px] text-white/40">
                  Start typing to search — we'll fill in your county automatically.
                </p>
              </div>

              {/* County selector with enhanced inference feedback */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                  Main county
                </Label>
                <StateCountySelector
                  selectedState={stateCode}
                  selectedCounty={countyFips}
                  onStateChange={(code) => {
                    setStateCode(code);
                    // Reset inference when state changes manually
                    if (locationSource === "places") setLocationSource("manual");
                    setCountyFips("");
                    setCountyName(undefined);
                    setCountyInferenceStatus("idle");
                    setCountyInferenceNote("");
                  }}
                  onCountyChange={(fips) => {
                    setCountyFips(fips);
                    // Manual selection clears inference indicators
                    setCountyInferenceStatus("idle");
                    setCountyInferenceNote("");
                  }}
                  className="gap-2"
                  onCountySelected={(county) => {
                    setCountyName(county?.name);
                    if (county) {
                      setCountyInferenceStatus("inferred");
                      setCountyInferenceNote(`Selected: ${county.name}, ${stateCode}`);
                    }
                  }}
                />
                <CountyInferenceIndicator />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-white/60">
                  {canContinue ? "Looks good." : "Add your name and main county to continue."}
                </p>
                <Button type="submit" size="sm" disabled={!canContinue || updateProfile.isPending}>
                  {updateProfile.isPending ? "Saving…" : "Continue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
