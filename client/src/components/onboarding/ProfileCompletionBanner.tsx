import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Building2, Sparkles } from "lucide-react";
import { hasAdminUiAccess } from "@/lib/roleChecks";
import { isBusinessUser, BUSINESS_LANDING } from "@/lib/postOnboardingRoute";
import { trackShellEvent } from "@/lib/analytics";
import { resolveLiveReadiness } from "@shared/liveReadiness";
import { isOnboardingSurfacePath } from "@/lib/onboardingSurface";

export type BannerMode =
  | "local_setup"
  | "profile_basics"
  | "onboarding"
  | "verification"
  | "business_setup"
  | "skipped_intent";

export function resolveProfileCompletionBannerMode(params: {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: any;
  path: string;
  skippedIntentDismissed: boolean;
}): BannerMode | null {
  const { isLoading, isAuthenticated, user, path, skippedIntentDismissed } = params;

  if (isLoading) return null;
  if (!isAuthenticated || !user) return null;
  if (hasAdminUiAccess(user)) return null;

  const isSetupRoute =
    path.startsWith("/pre-scout-setup") ||
    isOnboardingSurfacePath(path) ||
    path.startsWith("/offer-services") ||
    path.startsWith("/profile-settings") ||
    path.startsWith("/settings") ||
    path.startsWith("/profile") ||
    path.startsWith("/identity-verification") ||
    path.startsWith("/address-verification") ||
    path.startsWith("/license-verification") ||
    path.startsWith("/insurance-verification");
  if (isSetupRoute) return null;

  const isFocusedDirectConnectWorkspace =
    path.startsWith("/direct-connect/inbox") || path.startsWith("/direct-connect/active");
  if (isFocusedDirectConnectWorkspace) return null;

  const businessUser = isBusinessUser(user);
  const readiness = resolveLiveReadiness({
    user: {
      ...(user as any),
      userIntent: businessUser ? "business" : (user as any).userIntent,
    },
  });

  if (readiness.state === "needs_local_setup") return "local_setup";
  if (readiness.state === "needs_profile_basics") return "profile_basics";
  if (readiness.state === "needs_intent_confirmation") return "onboarding";
  if (readiness.state === "needs_verification") {
    return businessUser ? "business_setup" : "verification";
  }

  const skippedAt = (user as any)?.preferences?.onboardingSkippedAt;
  if (skippedAt && !skippedIntentDismissed) return "skipped_intent";

  return null;
}

export default function ProfileCompletionBanner() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const mode: BannerMode | null = useMemo(() => {
    const path = String(location || "");
    const sessionKey = "ts_skipped_intent_nudge_dismissed";
    const skippedIntentDismissed =
      typeof sessionStorage !== "undefined" && Boolean(sessionStorage.getItem(sessionKey));

    return resolveProfileCompletionBannerMode({
      isLoading,
      isAuthenticated,
      user,
      path,
      skippedIntentDismissed,
    });
  }, [isAuthenticated, isLoading, location, user]);

  if (!mode) return null;

  type ModeConfig = {
    icon: React.ElementType;
    iconColor: string;
    title: string;
    description: string;
    cta: string;
    onClick: () => void;
  };
  const config: Record<BannerMode, ModeConfig> = {
    local_setup: {
      icon: ShieldCheck,
      iconColor: "text-ts-orange",
      title: "Finish local setup",
      description: "This is essential. Set your primary local area so Scout can route correctly.",
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
      description:
        "This is essential. Confirm what you're here to do so matches and next steps fit your needs.",
      cta: "Confirm with Scout",
      onClick: () => {
        const current = String(location || "/");
        const next = encodeURIComponent(current.startsWith("/") ? current : "/");
        setLocation(`/onboarding/profile?next=${next}&source=profile_completion_banner`);
      },
    },
    profile_basics: {
      icon: ShieldCheck,
      iconColor: "text-ts-orange",
      title: "Complete profile basics",
      description:
        "Add your core identity and local details so Scout can guide the next valid step.",
      cta: "Complete profile",
      onClick: () => {
        const current = String(location || "/");
        const next = encodeURIComponent(current.startsWith("/") ? current : "/");
        setLocation(`/onboarding/profile?next=${next}&source=profile_completion_banner`);
      },
    },
    verification: {
      icon: ShieldCheck,
      iconColor: "text-ts-orange",
      title: "Complete verification",
      description:
        "Verification keeps live profile readiness separate from simply filling out fields.",
      cta: "Review verification",
      onClick: () => setLocation("/profile-settings"),
    },
    business_setup: {
      icon: Building2,
      iconColor: "text-ts-orange",
      title: "Get your verified badge",
      description:
        "Complete your business profile and verification so Scout can treat your profile as ready.",
      cta: "Set up business profile",
      onClick: () => setLocation(BUSINESS_LANDING),
    },
    skipped_intent: {
      icon: Sparkles,
      iconColor: "text-ts-orange",
      title: "Describe what you're here for",
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

  const trackBannerEvent = (
    event: "profile_readiness_banner_clicked" | "profile_readiness_banner_dismissed"
  ) => {
    void trackShellEvent({
      type: "scout_query",
      payload: {
        event,
        mode,
        route: String(location || "/"),
        cta,
        ts: new Date().toISOString(),
      },
    });
  };

  const handleCtaClick = () => {
    trackBannerEvent("profile_readiness_banner_clicked");
    onClick();
  };

  const handleDismissSkippedNudge = () => {
    trackBannerEvent("profile_readiness_banner_dismissed");
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("ts_skipped_intent_nudge_dismissed", "1");
    }
    // Force a re-render by navigating to the same path
    setLocation(String(location || "/"));
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 px-3 md:px-4 pointer-events-none"
      style={{
        bottom: "calc(var(--bottom-nav-h, 62px) + env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
      data-testid="profile-completion-banner"
    >
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
              <Button onClick={handleCtaClick}>
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
