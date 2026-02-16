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
    const profileVersion: number =
      typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

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
        throw new Error("Please choose where you're active locally.");
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
        description:
          "You're all set. You won't be asked to update this again unless something important changes.",
      });
      navigate("/onboarding/intent");
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save profile",
        description: error?.message || "Please try again.",
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
    <div className="min-h-screen flex justify-center px-3 py-6 text-tsTextMain">
      <div className="w-full max-w-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/scout")}
            className="px-0 text-tsTextMuted hover:text-white hover:bg-transparent"
          >
            Back
          </Button>
          <div className="text-[11px] uppercase tracking-[0.15em] text-tsTextMuted">Step 1/2</div>
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
            <CardTitle className="text-lg font-semibold text-tsTextMain">
              Quick profile check
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

              <div className="space-y-1.5">
                <Label className="text-sm">Primary county</Label>
                <StateCountySelector
                  selectedState={stateCode}
                  selectedCounty={countyFips}
                  onStateChange={setStateCode}
                  onCountyChange={setCountyFips}
                  className="gap-2"
                  onCountySelected={(county) => setCountyName(county?.name)}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-tsTextMuted">
                  {canContinue ? "Ready." : "Complete name and county."}
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
