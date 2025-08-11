import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

export function ProfileSetupRedirect({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      // Skip profile setup for admin roles
      const isAdmin = user.role === 'head_admin' || user.role === 'ops_admin' || user.role === 'moderator';
      
      // Redirect to profile setup if user hasn't completed onboarding and is not an admin
      if (!user.onboardingCompleted && !isAdmin) {
        setLocation('/profile-setup');
      }
    }
  }, [user, isLoading, setLocation]);

  // Show children if user has completed onboarding, is admin, or is still loading
  const isAdmin = user?.role === 'head_admin' || user?.role === 'ops_admin' || user?.role === 'moderator';
  if (isLoading || !user || user.onboardingCompleted || isAdmin) {
    return <>{children}</>;
  }

  // Don't render anything if redirecting to profile setup
  return null;
}