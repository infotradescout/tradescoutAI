import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface AuthFlowProps {
  onComplete: () => void;
  initialType?: 'homeowner' | 'professional';
}

export function AuthFlow({ onComplete }: AuthFlowProps) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) return;

    if (user && (user as any).onboardingCompleted) {
      onComplete();
    } else {
      navigate("/create-account");
    }
  }, [isAuthenticated, user, navigate, onComplete]);

  return null;
}