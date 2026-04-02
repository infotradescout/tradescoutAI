import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { useLocation } from "wouter";
import { hasAdminUiAccess } from "@/lib/roleChecks";

export function ProfileSetupRedirect({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      const isAdmin = hasAdminUiAccess(user);

      // Redirect to the canonical profile update flow if profile basics
      // have not been normalized onto the current schema version.
      const anyUser: any = user;
      const profileVersion: number =
        typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

      if (!isAdmin && profileVersion < CURRENT_PROFILE_VERSION) {
        setLocation("/pre-scout-setup");
      }
    }
  }, [user, isLoading, setLocation]);

  // Show children if user has completed onboarding, is admin, or is still loading
  const isAdmin = hasAdminUiAccess(user);
  const anyUser: any = user || {};
  const profileVersion: number =
    typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

  if (isLoading || !user || profileVersion >= CURRENT_PROFILE_VERSION || isAdmin) {
    return <>{children}</>;
  }

  // Don't render anything if redirecting to profile setup
  return null;
}
