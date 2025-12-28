import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";

interface AuthFlowProps {
  onComplete: () => void;
  initialType?: 'homeowner' | 'professional';
}

export function AuthFlow({ onComplete }: AuthFlowProps) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) return;

    if (!user) return;

    const anyUser: any = user;
    const profileVersion: number = typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

    if (profileVersion >= CURRENT_PROFILE_VERSION || anyUser.onboardingCompleted) {
      onComplete();
    } else {
      navigate("/onboarding/profile");
    }
  }, [isAuthenticated, user, navigate, onComplete]);

  return null;
}