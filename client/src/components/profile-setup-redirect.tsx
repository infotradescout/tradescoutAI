import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

export function ProfileSetupRedirect({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      // Skip account setup redirect for admin users (boolean flag)
      const isAdmin = user.isAdmin === true;

      // Redirect to the canonical account setup portal if onboarding is incomplete
      if (!user.onboardingCompleted && !isAdmin) {
        setLocation('/create-account');
      }
    }
  }, [user, isLoading, setLocation]);

  // Show children if user has completed onboarding, is admin, or is still loading
  const isAdmin = user?.isAdmin === true;
  if (isLoading || !user || user.onboardingCompleted || isAdmin) {
    return <>{children}</>;
  }

  // Don't render anything if redirecting to profile setup
  return null;
}