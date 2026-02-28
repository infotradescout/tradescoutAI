import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ShieldCheck } from "lucide-react";

type BannerMode = "local_setup" | "onboarding";

function isAdminLike(user: any): boolean {
  if (!user) return false;
  if (user.isAdmin === true || user.isSuperAdmin === true) return true;
  const role = String(user.role || "");
  return role === "super_admin" || role === "head_admin" || role === "owner";
}

export default function ProfileCompletionBanner() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const mode: BannerMode | null = useMemo(() => {
    if (isLoading) return null;
    if (!isAuthenticated || !user) return null;
    if (isAdminLike(user)) return null;

    const path = String(location || "");
    const isSetupRoute =
      path.startsWith("/pre-scout-setup") ||
      path.startsWith("/onboarding/profile") ||
      path.startsWith("/onboarding/intent") ||
      path.startsWith("/profile-setup");
    if (isSetupRoute) return null;

    const profileVersion =
      typeof (user as any).profileVersion === "number" ? (user as any).profileVersion : 0;
    if (profileVersion < CURRENT_PROFILE_VERSION) return "local_setup";

    const onboardingCompleted = (user as any).onboardingCompleted === true;
    if (!onboardingCompleted) return "onboarding";

    return null;
  }, [isAuthenticated, isLoading, location, user]);

  if (!mode) return null;

  const title = mode === "local_setup" ? "Finish local setup" : "Confirm your focus (1 minute)";
  const description =
    mode === "local_setup"
      ? "Pick your primary county so Scout can route correctly."
      : "Tell Scout what you’re here to do so your workspace and matches are accurate.";
  const ctaLabel = mode === "local_setup" ? "Continue setup" : "Confirm with Scout";
  const onClick = () => {
    if (mode === "local_setup") {
      setLocation("/pre-scout-setup");
      return;
    }
    setLocation("/scout?onboarding=true");
  };

  return (
    <div className="fixed left-0 right-0 bottom-4 z-40 px-3 md:px-4 pointer-events-none">
      <div className="mx-auto max-w-3xl pointer-events-auto">
        <Card className="border border-white/10 bg-tsCard/95 shadow-[0_18px_52px_rgba(0,0,0,0.45)]">
          <CardContent className="p-3 md:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="h-4 w-4 text-ts-orange" />
                <span className="truncate">{title}</span>
              </div>
              <div className="mt-1 text-xs text-white/60">{description}</div>
            </div>
            <Button onClick={onClick} className="shrink-0">
              {ctaLabel}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
