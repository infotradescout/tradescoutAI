import React, { useEffect, useMemo, useState } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import { inferCountyForCityState } from "@/lib/countyInference";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

function sanitizeNext(next: string) {
  if (!next.startsWith("/")) return "/scout?onboarding=true";
  if (
    next.startsWith("/pre-scout-setup") ||
    next.startsWith("/login") ||
    next.startsWith("/register")
  ) {
    return "/scout?onboarding=true";
  }
  return next;
}

function buildIntentRoute(next: string) {
  return `/onboarding/intent?next=${encodeURIComponent(next)}`;
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
  const postProfileNext = sanitizeNext(safeNext);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [countyFips, setCountyFips] = useState("");
  const [countyName, setCountyName] = useState<string | undefined>(undefined);
  const [city, setCity] = useState("");
  const [countyInferenceStatus, setCountyInferenceStatus] = useState<CountyInferenceStatus>("idle");
  const [countyInferenceNote, setCountyInferenceNote] = useState("");

  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const anyUser: any = user;
    const profileVersion: number =
      typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

    // If profile normalization is already complete, continue into intent confirmation
    // unless onboarding itself has been explicitly completed.
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

  useEffect(() => {
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
          setCountyInferenceNote("Multiple counties match this city. Select your county manually.");
          return;
        }
        setCountyInferenceStatus("error");
        setCountyInferenceNote(
          "Could not infer county from city and state. Select county manually."
        );
      } catch (error: any) {
        if (cancelled || error?.name === "AbortError") return;
        setCountyInferenceStatus("error");
        setCountyInferenceNote("Could not infer county right now. Select county manually.");
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [city, countyFips, stateCode]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/pre-scout-setup?mode=create");
    }
  }, [isAuthenticated, isLoading, navigate]);

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
        // Preserve existing preferences while allowing future profile-related hints.
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

  return (
    <div className="flex justify-center px-3 py-6 text-white">
      <div className="w-full max-w-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/scout")}
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
            <CardTitle className="text-lg font-semibold text-white">Quick profile check</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                    First name
                  </Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1"
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
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                  City (for auto county)
                </Label>
                <Input
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (countyInferenceStatus === "inferred" && countyFips) {
                      setCountyFips("");
                      setCountyName(undefined);
                    }
                  }}
                  placeholder="Enter city"
                  className="mt-1"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                  Primary county
                </Label>
                <StateCountySelector
                  selectedState={stateCode}
                  selectedCounty={countyFips}
                  onStateChange={setStateCode}
                  onCountyChange={setCountyFips}
                  className="gap-2"
                  onCountySelected={(county) => setCountyName(county?.name)}
                />
                {countyInferenceStatus !== "idle" && countyInferenceNote && (
                  <p
                    className={`text-[11px] ${
                      countyInferenceStatus === "inferred"
                        ? "text-emerald-300"
                        : countyInferenceStatus === "loading"
                          ? "text-white/60"
                          : "text-amber-300"
                    }`}
                  >
                    {countyInferenceStatus === "loading"
                      ? "Detecting county from city..."
                      : countyInferenceNote}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-white/60">
                  {canContinue
                    ? "Ready."
                    : "Complete name and county (or enter city to auto-detect county)."}
                </p>
                <Button type="submit" size="sm" disabled={!canContinue || updateProfile.isPending}>
                  {updateProfile.isPending ? "Saving..." : "Save and continue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
