import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

export function ProfileSetupRedirect({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect to profile setup if user hasn't completed onboarding
      if (!user.onboardingCompleted) {
        setLocation('/profile-setup');
      }
    }
  }, [user, isLoading, setLocation]);

  // Show children if user has completed onboarding or is still loading
  if (isLoading || !user || user.onboardingCompleted) {
    return <>{children}</>;
  }

  // Don't render anything if redirecting to profile setup
  return null;
}