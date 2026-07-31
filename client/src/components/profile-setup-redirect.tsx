import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { hasAdminUiAccess } from "@/lib/roleChecks";
import { getOnboardingEntryRoute } from "@/lib/postOnboardingRoute";
import { hasCompletedSetup } from "@/lib/setupState";

export function ProfileSetupRedirect({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      const isAdmin = hasAdminUiAccess(user);

      if (!isAdmin && !hasCompletedSetup(user)) {
        setLocation(getOnboardingEntryRoute(user));
      }
    }
  }, [user, isLoading, setLocation]);

  // Show children if user has completed onboarding, is admin, or is still loading
  const isAdmin = hasAdminUiAccess(user);
  if (isLoading || !user || hasCompletedSetup(user) || isAdmin) {
    return <>{children}</>;
  }

  // Don't render anything if redirecting to profile setup
  return null;
}
