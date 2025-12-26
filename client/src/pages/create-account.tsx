import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { US_STATES, getCountiesForState } from "@shared/us-states-counties";
import { MapPin, Users, Briefcase, Sparkles } from "lucide-react";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { RegisterForm } from "@/components/RegisterForm";

type CapabilityBundle =
  | "community_participant"
  | "creator_publisher"
  | "service_provider"
  | "property_operator"
  | "local_seller"
  | "buyer_browser"
  | "organization_admin"
  | "team_manager"
  | "finance_tools_user"
  | "tools_user"
  | "referral_partner";

type PurposeKey =
  | "find_help"
  | "offer_services"
  | "buy_sell"
  | "manage_properties"
  | "community_participate"
  | "use_tools"
  | "referrals";

interface PurposeOption {
  key: PurposeKey;
  title: string;
  description: string;
}

const PURPOSE_OPTIONS: PurposeOption[] = [
  {
    key: "find_help",
    title: "Find local help / services",
    description: "Scout trusted local help for projects, maintenance, or one-off tasks.",
  },
  {
    key: "offer_services",
    title: "Offer services / run a business",
    description: "Show your work, offer services, and connect with people, businesses, and organizations nearby.",
  },
  {
    key: "buy_sell",
    title: "Buy / sell locally",
    description: "Use Exchange to list, sell, or find local items, gear, and services.",
  },
  {
    key: "manage_properties",
    title: "Manage properties or tenants",
    description: "Manage rentals, tenants, vendors, or HOA / building activity.",
  },
  {
    key: "community_participate",
    title: "Post updates & participate in the community",
    description: "Join conversations, share updates, and participate in local decisions.",
  },
  {
    key: "use_tools",
    title: "Use tools (invoices, notes, estimates, etc.)",
    description: "Use Scout’s planning, notes, invoices, and coordination tools.",
  },
  {
    key: "referrals",
    title: "Help promote TradeScout / referrals",
    description: "Share TradeScout with others and track referrals or rewards.",
  },
];

const PURPOSE_TO_BUNDLES: Record<PurposeKey, CapabilityBundle[]> = {
  find_help: ["community_participant", "buyer_browser", "tools_user"],
  offer_services: [
    "service_provider",
    "organization_admin",
    "local_seller",
    "finance_tools_user",
    "tools_user",
  ],
  buy_sell: ["local_seller", "buyer_browser", "tools_user"],
  manage_properties: ["property_operator", "organization_admin", "team_manager", "tools_user"],
  community_participate: ["community_participant", "creator_publisher", "tools_user"],
  use_tools: ["finance_tools_user", "tools_user"],
  referrals: ["referral_partner", "community_participant"],
};

export default function CreateAccountPortal() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPurposes, setSelectedPurposes] = useState<PurposeKey[]>([]);

  const [stateCode, setStateCode] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  const [errors, setErrors] = useState<{ intent?: string; location?: string; business?: string }>({});

  const countiesForState = useMemo(() => {
    if (!stateCode) return [] as string[];
    return (getCountiesForState(stateCode) || []).map((c) => c.name);
  }, [stateCode]);
  const hasBusinessOrOrgPurpose = useMemo(
    () =>
      selectedPurposes.includes("offer_services") ||
      selectedPurposes.includes("manage_properties"),
    [selectedPurposes]
  );

  // If user is already fully onboarded, send them to their dashboard

  useEffect(() => {
    if (user && (user as any).onboardingCompleted) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      if (selectedPurposes.length === 0) {
        throw new Error("Please choose what you’re here to do.");
      }

      const participationModes = Array.from(
        new Set<string>([
          "self",
          ...(hasBusinessOrOrgPurpose ? ["business"] : []),
        ])
      );

      const capabilityBundleSet = new Set<CapabilityBundle>();
      for (const purpose of selectedPurposes) {
        for (const bundle of PURPOSE_TO_BUNDLES[purpose] || []) {
          capabilityBundleSet.add(bundle);
        }
      }
      const capabilityBundles = Array.from(capabilityBundleSet);

      const body: any = {
        firstName: user?.firstName,
        lastName: user?.lastName,
        phone: (user as any)?.phone,
        address,
        city,
        state: stateCode,
        zipCode,
        county,
        participationModes,
        capabilityBundles,
      };

      if (hasBusinessOrOrgPurpose) {
        body.businessName = businessName || undefined;
        body.specialties = specialties || undefined;
        body.yearsExperience = yearsExperience || undefined;
        body.licenseNumber = licenseNumber || undefined;
      }

      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const code = data?.code;
        if (code === "ONBOARDING_REQUIRED") {
          throw new Error("Please finish creating your account before continuing.");
        }
        throw new Error(data?.message || "Failed to complete account setup.");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "You’re ready to use TradeScout",
        description: "Your account is now set up for local projects, services, and community activity.",
      });
      navigate("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Couldn’t finish account setup",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const goNextFromIntent = () => {
    if (selectedPurposes.length === 0) {
      setErrors((prev) => ({ ...prev, intent: "Choose at least one to continue." }));
      return;
    }
    setErrors((prev) => ({ ...prev, intent: undefined }));
    setStep(2);
  };

  const goNextFromLocation = () => {
    if (!stateCode || !county) {
      setErrors((prev) => ({ ...prev, location: "State and neighborhood / area are required." }));
      return;
    }
    setErrors((prev) => ({ ...prev, location: undefined }));
    if (hasBusinessOrOrgPurpose) {
      setStep(3);
    } else {
      setStep(4);
    }
  };

  const canSubmit = selectedPurposes.length > 0 && !!stateCode && !!county;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || completeOnboarding.isLoading) return;
    completeOnboarding.mutate();
  };

  const isOnboardingFlow = isAuthenticated && !(user as any)?.onboardingCompleted;

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
              ACCOUNT SETUP
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Finish creating your TradeScout account.
            </h1>
            <p className="text-sm md:text-base text-tsTextMuted max-w-xl">
              We’ll use this to tailor your local experiencefrom services and projects to community activity and toolswithout exposing internal roles.
            </p>

            <div className="rounded-2xl border border-tsBorder bg-black/30 p-4 text-xs text-tsTextMuted">
              <p className="mb-2 font-semibold text-tsTextMain">What this unlocks</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Join conversations and activity feeds for where you live.</li>
                <li>Show up correctly in local directories and profiles.</li>
                <li>Use messaging, recommendations, and higher-trust features.</li>
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
              {isOnboardingFlow && (
                <span className="text-xs text-tsTextMuted">Step {step} of 4</span>
              )}
            </div>
            <CardTitle className="text-lg font-semibold text-tsTextMain">
              {!isOnboardingFlow && "Create your TradeScout account"}
              {isOnboardingFlow && step === 1 && "What are you here to do?"}
              {isOnboardingFlow && step === 2 && "Where are you active locally?"}
              {isOnboardingFlow && step === 3 && "Tell us about your work"}
              {isOnboardingFlow && step === 4 && "Review and finish"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {!isOnboardingFlow && (
              <RegisterForm
                onSuccess={() => {
                  // After successful registration, the auth hook will refresh and
                  // this page will automatically switch into onboarding mode.
                }}
                onSwitchToLogin={() => navigate("/login?redirect=/create-account")}
              />
            )}

            {isOnboardingFlow && step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {PURPOSE_OPTIONS.map((option) => {
                    const isSelected = selectedPurposes.includes(option.key);
                    const Icon =
                      option.key === "offer_services"
                        ? Briefcase
                        : option.key === "community_participate"
                        ? Users
                        : option.key === "use_tools"
                        ? Sparkles
                        : MapPin;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setSelectedPurposes((prev) =>
                            prev.includes(option.key)
                              ? prev.filter((k) => k !== option.key)
                              : [...prev, option.key]
                          );
                        }}
                        className={`text-left rounded-xl border px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-tsAccent/80 ${
                          isSelected
                            ? "border-tsAccent bg-tsBg"
                            : "border-tsBorder bg-tsBg hover:border-tsAccent/60 hover:bg-black/40"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-1">
                          <Icon className="h-4 w-4 text-tsAccent" />
                          <span className="font-medium text-tsTextMain">{option.title}</span>
                        </div>
                        <p className="text-xs text-tsTextMuted">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
                {errors.intent && <p className="text-xs text-red-400 mt-1">{errors.intent}</p>}
                <div className="flex justify-end mt-4">
                  <Button size="sm" onClick={goNextFromIntent}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {isOnboardingFlow && step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    State
                  </Label>
                  <select
                    className="w-full rounded-md border border-tsBorder bg-slate-900 px-3 py-2 text-sm text-tsTextMain"
                    value={stateCode}
                    onChange={(e) => {
                      setStateCode(e.target.value);
                      setCounty("");
                    }}
                  >
                    <option value="">Select state</option>
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    Neighborhood / area
                  </Label>
                  {stateCode ? (
                    <select
                      className="w-full rounded-md border border-tsBorder bg-slate-900 px-3 py-2 text-sm text-tsTextMain"
                      value={county}
                      onChange={(e) => setCounty(e.target.value)}
                    >
                      <option value="">Select area</option>
                      {countiesForState.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={county}
                      onChange={(e) => setCounty(e.target.value)}
                      placeholder="Your neighborhood or local area"
                      className="bg-slate-900 border-tsBorder text-tsTextMain"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">City (optional)</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-slate-900 border-tsBorder text-tsTextMain"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">ZIP code (optional)</Label>
                    <Input
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="bg-slate-900 border-tsBorder text-tsTextMain"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Street address (optional)</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Used only to improve local matching, never sold."
                    className="bg-slate-900 border-tsBorder text-tsTextMain"
                  />
                </div>

                {errors.location && <p className="text-xs text-red-400 mt-1">{errors.location}</p>}

                <div className="flex justify-between mt-4">
                  <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button size="sm" onClick={goNextFromLocation}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {isOnboardingFlow && step === 3 && hasBusinessOrOrgPurpose && (
              <div className="space-y-4">
                <p className="text-xs text-tsTextMuted">
                  If you offer services or run a business, share a few details so locals know who they’re working with.
                </p>
                <div className="space-y-2">
                  <Label className="text-sm">Business or project name</Label>
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="What people should see on your profile"
                    className="bg-slate-900 border-tsBorder text-tsTextMain"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">What kind of work do you do? (optional)</Label>
                  <Input
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    placeholder="e.g., residential remodeling, community organizing, local services"
                    className="bg-slate-900 border-tsBorder text-tsTextMain"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Years of experience (optional)</Label>
                    <Input
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(e.target.value)}
                      type="number"
                      min={0}
                      className="bg-slate-900 border-tsBorder text-tsTextMain"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">License number (optional)</Label>
                    <Input
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="bg-slate-900 border-tsBorder text-tsTextMain"
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-4">
                  <Button size="sm" variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button size="sm" onClick={() => setStep(4)}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {isOnboardingFlow && step === 4 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg border border-tsBorder bg-black/30 p-3 text-xs text-tsTextMuted space-y-2">
                  <p className="font-semibold text-tsTextMain">How you’ll show up</p>
                  <p>
                    Intent: <span className="text-white">{
                      intent
                        ? INTENT_OPTIONS.find((o) => o.key === intent)?.title
                        : "Not selected"
                    }</span>
                  </p>
                  <p>
                    Area: <span className="text-white">{county || "Not set"}</span>
                    {stateCode && <span className="text-tsTextMuted">, {stateCode}</span>}
                  </p>
                </div>

                <p className="text-xs text-tsTextMuted">
                  When you finish, Scout will use this information to place you correctly in local feeds, directories, and toolswithout exposing internal role labels.
                </p>

                <div className="flex justify-between mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setStep(hasBusinessOrOrgPurpose ? 3 : 2)}
                  >
                    Back
                  </Button>
                  <Button size="sm" type="submit" disabled={!canSubmit || completeOnboarding.isLoading}>
                    {completeOnboarding.isLoading ? "Finishing..." : "Finish"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
