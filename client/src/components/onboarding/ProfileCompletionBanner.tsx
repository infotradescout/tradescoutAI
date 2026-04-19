import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Building2, Sparkles } from "lucide-react";
import { hasAdminUiAccess } from "@/lib/roleChecks";
import { hasCompletedSetup } from "@/lib/setupState";
import { isBusinessUser, BUSINESS_LANDING } from "@/lib/postOnboardingRoute";

type BannerMode = "local_setup" | "onboarding" | "business_setup" | "skipped_intent";

export default function ProfileCompletionBanner() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const mode: BannerMode | null = useMemo(() => {
    if (isLoading) return null;
    if (!isAuthenticated || !user) return null;
    if (hasAdminUiAccess(user)) return null;

    const path = String(location || "");
    const isSetupRoute =
      path.startsWith("/pre-scout-setup") ||
      path.startsWith("/onboarding/profile") ||
      path.startsWith("/onboarding/intent") ||
      path.startsWith("/offer-services") ||
      path.startsWith("/profile-settings") ||
      path.startsWith("/settings") ||
      path.startsWith("/profile") ||
      path.startsWith("/profile-setup") ||
      path.startsWith("/identity-verification") ||
      path.startsWith("/address-verification") ||
      path.startsWith("/license-verification") ||
      path.startsWith("/insurance-verification");
    if (isSetupRoute) return null;

    if (!hasCompletedSetup(user as any)) return "local_setup";

    const onboardingCompleted = (user as any).onboardingCompleted === true;
    if (!onboardingCompleted) {
      // Business users who haven't completed onboarding get nudged to their hub
      if (isBusinessUser(user)) return "business_setup";
      return "onboarding";
    }

    // Business users who completed onboarding but are not yet verified
    if (
      isBusinessUser(user) &&
      user.verifiedBadge !== true &&
      user.verificationStatus !== "approved"
    ) {
      return "business_setup";
    }

    // Users who skipped the intent step get a gentle nudge to complete it.
    // We check preferences.onboardingSkippedAt and only show this once per
    // session (controlled by sessionStorage) to avoid being annoying.
    const skippedAt = (user as any)?.preferences?.onboardingSkippedAt;
    if (skippedAt) {
      const sessionKey = "ts_skipped_intent_nudge_dismissed";
      const dismissed = typeof sessionStorage !== "undefined" && sessionStorage.getItem(sessionKey);
      if (!dismissed) return "skipped_intent";
    }

    return null;
  }, [isAuthenticated, isLoading, location, user]);

  if (!mode) return null;

  type ModeConfig = { icon: React.ElementType; iconColor: string; title: string; description: string; cta: string; onClick: () => void };
  const config: Record<BannerMode, ModeConfig> = {
    local_setup: {
      icon: ShieldCheck,
      iconColor: "text-ts-orange",
      title: "Finish local setup",
      description: "This is essential. Set your primary county so Scout can route correctly.",
      cta: "Continue setup",
      onClick: () => {
        const current = String(location || "/");
        const next = encodeURIComponent(current.startsWith("/") ? current : "/");
        setLocation(`/onboarding/profile?next=${next}&source=profile_completion_banner`);
      },
    },
    onboarding: {
      icon: ShieldCheck,
      iconColor: "text-ts-orange",
      title: "Confirm your focus (1 minute)",
      description: "This is essential. Confirm what you're here to do so matches and next steps fit your needs.",
      cta: "Confirm with Scout",
      onClick: () => {
        const current = String(location || "/");
        const next = encodeURIComponent(current.startsWith("/") ? current : "/");
        setLocation(`/onboarding/profile?next=${next}&source=profile_completion_banner`);
      },
    },
    business_setup: {
      icon: Building2,
      iconColor: "text-ts-orange",
      title: "Get your verified badge",
      description: "Complete your business profile and verification to unlock your verified badge and start receiving jobs.",
      cta: "Set up business profile",
      onClick: () => setLocation(BUSINESS_LANDING),
    },
    skipped_intent: {
      icon: Sparkles,
      iconColor: "text-ts-orange",
      title: "Tell Scout what you're here for",
      description: "You skipped this earlier. It only takes 30 seconds and unlocks better matches.",
      cta: "Finish setup",
      onClick: () => {
        const current = String(location || "/");
        const next = encodeURIComponent(current.startsWith("/") ? current : "/");
        setLocation(`/onboarding/intent?next=${next}&source=skipped_nudge`);
      },
    },
  };
  const { icon: Icon, iconColor, title, description, cta, onClick } = config[mode];

  const handleDismissSkippedNudge = () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("ts_skipped_intent_nudge_dismissed", "1");
    }
    // Force a re-render by navigating to the same path
    setLocation(String(location || "/"));
  };

  return (
    <div className="fixed left-0 right-0 bottom-4 z-40 px-3 md:px-4 pointer-events-none">
      <div className="mx-auto max-w-3xl pointer-events-auto">
        <Card className="border border-white/10 bg-tsCard/95 shadow-[0_18px_52px_rgba(0,0,0,0.45)]">
          <CardContent className="p-3 md:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <span className="truncate">{title}</span>
              </div>
              <div className="mt-1 text-xs text-white/60">{description}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {mode === "skipped_intent" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/40 hover:text-white/70 text-xs px-2"
                  onClick={handleDismissSkippedNudge}
                >
                  Not now
                </Button>
              )}
              <Button onClick={onClick}>
                {cta}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
