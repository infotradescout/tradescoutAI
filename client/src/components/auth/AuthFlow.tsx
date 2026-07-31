import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getOnboardingEntryRoute } from "@/lib/postOnboardingRoute";
import { hasCompletedSetup } from "@/lib/setupState";

interface AuthFlowProps {
  onComplete: () => void;
  initialType?: "homeowner" | "professional";
}

export function AuthFlow({ onComplete }: AuthFlowProps) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) return;

    if (!user) return;

    if (hasCompletedSetup(user)) {
      onComplete();
    } else {
      navigate(getOnboardingEntryRoute(user));
    }
  }, [isAuthenticated, user, navigate, onComplete]);

  return null;
}
