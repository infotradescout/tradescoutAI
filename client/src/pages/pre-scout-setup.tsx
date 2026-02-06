import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StateCountySelector } from "@/components/state-county-selector";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProfileDraft, PresenceType } from "@/types/profileDraft";

export default function PreScoutSetup() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const provisional = useMemo(() => (user as any)?.preferences?.provisional || {}, [user]);
  const existingDraft: ProfileDraft | undefined = provisional?.profileDraft;

  const [presenceType, setPresenceType] = useState<PresenceType>(
    existingDraft?.presenceType || "personal"
  );
  const [stateCode, setStateCode] = useState(existingDraft?.stateCode || "");
  const [countyFips, setCountyFips] = useState(existingDraft?.countyFips || "");
  const [countyName, setCountyName] = useState<string | undefined>(existingDraft?.countyName);
  const [city, setCity] = useState(existingDraft?.city || "");
  const [businessName, setBusinessName] = useState(existingDraft?.businessName || "");
  const [businessCategory, setBusinessCategory] = useState(existingDraft?.businessCategory || "");
  const [website, setWebsite] = useState(existingDraft?.website || "");
  const [description, setDescription] = useState(existingDraft?.description || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!existingDraft) return;

    setPresenceType(existingDraft.presenceType || "personal");
    setStateCode(existingDraft.stateCode || "");
    setCountyFips(existingDraft.countyFips || "");
    setCountyName(existingDraft.countyName);
    setCity(existingDraft.city || "");
    setBusinessName(existingDraft.businessName || "");
    setBusinessCategory(existingDraft.businessCategory || "");
    setWebsite(existingDraft.website || "");
    setDescription(existingDraft.description || "");
  }, [existingDraft]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/create-account");
    }
  }, [isAuthenticated, isLoading, navigate]);

  const canContinue = useMemo(() => {
    if (!presenceType || !stateCode || !countyFips) return false;
    if (presenceType === "represent_business" && !businessName.trim()) return false;
    return true;
  }, [presenceType, stateCode, countyFips, businessName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canContinue) return;

    setSubmitting(true);
    try {
      const draft: ProfileDraft = {
        presenceType,
        stateCode,
        countyFips,
        countyName: countyName || undefined,
        city: city.trim() || undefined,
        businessName: presenceType === "represent_business" ? businessName.trim() : undefined,
        businessCategory: businessCategory.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        serviceAreas: [
          {
            countyFips,
            countyName: countyName || undefined,
            stateCode,
            primary: true,
          },
        ],
        capturedAt: new Date().toISOString(),
      };

      const provisionalNext = {
        ...provisional,
        profileDraft: draft,
      };

      await apiRequest("/api/user/preferences", {
        method: "PATCH",
        body: { provisional: provisionalNext },
      });

      toast({
        title: "Saved",
        description: "Thanks. Scout will tailor the next steps to this setup.",
      });

      navigate("/scout?onboarding=true");
    } catch (error: any) {
      console.error("[PRE_SCOUT_SETUP] Failed to save", error);
      toast({
        title: "Couldn't save",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen  flex items-center justify-center px-4 py-10 text-tsTextMain">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/scout")}
            className="flex items-center gap-2 text-tsTextMuted hover:text-white hover:bg-white/5 pl-0"
          >
            <span className="text-sm">Back to Scout</span>
          </Button>

          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-tsBorder/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
              Step 1 of 2
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Set your local setup before Scout takes over.
            </h1>
            <p className="text-sm md:text-base text-tsTextMuted max-w-xl">
              This quick check locks in where you operate and whether you&apos;re here as yourself
              or representing a business. Scout uses it to show only relevant actions and deals.
            </p>

            <div className="rounded-2xl border border-tsBorder bg-black/30 p-4 text-xs text-tsTextMuted space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-2 w-full bg-tsBorder/50 rounded-full overflow-hidden">
                  <div className="h-full bg-tsAccent" style={{ width: "60%" }} />
                </div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-tsAccentSoft">
                  Setup
                </span>
              </div>
              <p>
                We only use this for routing and relevance. It does not publish or share your
                details until you choose to.
              </p>
            </div>
          </div>
        </div>

        <Card className="bg-tsCard border border-tsBorder shadow-2xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-[0.2em] text-tsTextMuted">
                  Pre-Scout setup
                </span>
                <CardTitle className="text-lg font-semibold text-tsTextMain">
                  Your starting point
                </CardTitle>
              </div>
              <div className="text-xs text-tsTextMuted">Required</div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm">How are you showing up today?</Label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setPresenceType("personal")}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                      presenceType === "personal"
                        ? "border-tsAccent bg-tsAccent/10"
                        : "border-tsBorder hover:border-tsAccent/60"
                    }`}
                  >
                    <div className="text-sm font-semibold text-tsTextMain">Just me</div>
                    <div className="text-xs text-tsTextMuted">
                      Plan projects, browse, and ask for help.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceType("represent_business")}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                      presenceType === "represent_business"
                        ? "border-tsAccent bg-tsAccent/10"
                        : "border-tsBorder hover:border-tsAccent/60"
                    }`}
                  >
                    <div className="text-sm font-semibold text-tsTextMain">
                      I&apos;m representing a business
                    </div>
                    <div className="text-xs text-tsTextMuted">
                      Share services, deals, or hiring needs.
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Where is this activity based?</Label>
                <StateCountySelector
                  selectedState={stateCode}
                  selectedCounty={countyFips}
                  onStateChange={setStateCode}
                  onCountyChange={setCountyFips}
                  onCountySelected={(county) => {
                    setCountyName(county?.name);
                  }}
                />
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City (optional)"
                  className="mt-3"
                />
                <p className="text-[11px] text-tsTextMuted">
                  County is required so Scout can keep results local. City helps narrow things
                  further.
                </p>
              </div>

              {presenceType === "represent_business" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Business name</Label>
                      <Input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g., Northside Builders"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Category (optional)</Label>
                      <Input
                        value={businessCategory}
                        onChange={(e) => setBusinessCategory(e.target.value)}
                        placeholder="e.g., Roofing, HVAC, Restaurant"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Website (optional)</Label>
                      <Input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Short blurb (optional)</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="One sentence on what you do or offer."
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed border-tsBorder/80 bg-black/20 p-3 text-xs text-tsTextMuted">
                    Service area defaults to this county. You can expand it later after Scout
                    suggests the right tools.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-tsTextMuted max-w-xs">
                  This is required so Scout can do its job. Nothing is shared publicly unless you
                  choose to publish.
                </div>
                <Button type="submit" disabled={!canContinue || submitting}>
                  {submitting ? "Saving..." : "Continue to Scout"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
