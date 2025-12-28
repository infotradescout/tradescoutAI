import React, { useEffect, useState } from "react";
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
import { CURRENT_PROFILE_VERSION } from "@shared/profile";

export default function OnboardingProfile() {
  const { user, isAuthenticated, isLoading, refetch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [countyFips, setCountyFips] = useState("");
  const [countyName, setCountyName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const anyUser: any = user;
    const profileVersion: number = typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

    // If already on or above the current profile version, skip ahead.
    if (profileVersion >= CURRENT_PROFILE_VERSION) {
      navigate("/onboarding/intent");
      return;
    }

    setFirstName(anyUser.firstName || "");
    setLastName(anyUser.lastName || "");
    setStateCode(anyUser.stateCode || "");
    setCountyFips(anyUser.countyFips || "");
    setCountyName(anyUser.countyName || undefined);
  }, [user, isAuthenticated, navigate]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/create-account");
    }
  }, [isAuthenticated, isLoading, navigate]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("Please add your name.");
      }
      if (!stateCode || !countyFips) {
        throw new Error("Please choose where youre active locally.");
      }

      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;

      return apiRequest("PUT", "/api/user/profile", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
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
        description: "Youre all set. You can change this anytime in Settings.",
      });
      navigate("/onboarding/intent");
    },
    onError: (error: any) => {
      toast({
        title: "Couldnt save profile",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (updateProfile.isLoading) return;
    updateProfile.mutate();
  };

  const canContinue = !!firstName.trim() && !!lastName.trim() && !!stateCode && !!countyFips;

  return (
    <div className="min-h-screen bg-gradient-to-b from-tsBg via-slate-950 to-tsBg flex items-center justify-center px-4 py-10 text-tsTextMain">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-tsTextMuted hover:text-white hover:bg-white/5 pl-0"
          >
            <span className="text-sm">Back to Scout</span>
          </Button>

          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-tsBorder/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
              PROFILE UPDATE
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Weve improved how profiles work.
            </h1>
            <p className="text-sm md:text-base text-tsTextMuted max-w-xl">
              TradeScout now uses a simpler, more flexible profile setup that better reflects how people actually use the platform.
              This quick update helps reduce duplicate badges, fix location issues, and make your profile clearer to others.
            </p>

            <div className="rounded-2xl border border-tsBorder bg-black/30 p-4 text-xs text-tsTextMuted">
              <p className="mb-2 font-semibold text-tsTextMain">This takes about 30 seconds.</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Confirm your name so people recognize you.</li>
                <li>Set a single, trusted location for local activity.</li>
                <li>Keep everything elsebadges, posts, jobs, and messagesexactly as-is.</li>
              </ul>
            </div>
          </div>
        </div>

        <Card className="bg-tsCard border border-tsBorder shadow-2xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TradeScoutLogo size="xs" />
                <span className="text-xs uppercase tracking-[0.2em] text-tsTextMuted">TRADESCOUT</span>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-tsTextMain">
              Quick profile check
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">First name</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-slate-900 border-tsBorder text-tsTextMain"
                  />
                </div>
                <div>
                  <Label className="text-sm">Last name</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-slate-900 border-tsBorder text-tsTextMain"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Where are you active locally?</Label>
                <StateCountySelector
                  selectedState={stateCode}
                  selectedCounty={countyFips}
                  onStateChange={setStateCode}
                  onCountyChange={setCountyFips}
                  onCountySelected={(county) => setCountyName(county?.name)}
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <p className="text-[11px] text-tsTextMuted max-w-xs">
                  We only use this to power local feeds and matching. You can change it anytime in Settings.
                </p>
                <Button type="submit" size="sm" disabled={!canContinue || updateProfile.isLoading}>
                  {updateProfile.isLoading ? "Saving..." : "Update profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
