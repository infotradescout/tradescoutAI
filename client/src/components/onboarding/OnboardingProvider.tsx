import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface OnboardingContextType {
  currentTour: string | null;
  startTour: (tourKey: string) => void;
  stopTour: () => void;
  completeTour: (tourKey: string) => void;
  isTourCompleted: (tourKey: string) => boolean;
  showFeatureIntro: (feature: string) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [currentTour, setCurrentTour] = useState<string | null>(null);
  const [completedTours, setCompletedTours] = useState<string[]>([]);

  // Load completed tours from user preferences
  useEffect(() => {
    if (user?.preferences?.completedTours) {
      setCompletedTours(user.preferences.completedTours);
    }
  }, [user?.preferences?.completedTours]);

  // Disable all auto-starting tours - using subtle hints instead
  useEffect(() => {
    // Tours are disabled in favor of subtle hint system
    return;
  }, [isAuthenticated, user, location]);

  const startTour = (tourKey: string) => {
    if (isTourCompleted(tourKey)) return;
    setCurrentTour(tourKey);
  };

  const stopTour = () => {
    setCurrentTour(null);
  };

  const completeTour = async (tourKey: string) => {
    const newCompletedTours = [...completedTours, tourKey];
    setCompletedTours(newCompletedTours);
    setCurrentTour(null);

    // Save to backend
    try {
      await fetch('/api/auth/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTours: newCompletedTours
        })
      });

      // Mark onboarding as completed if this was a new user tour
      if (tourKey.startsWith('new-user-tour') && user && !user.onboardingCompleted) {
        await fetch('/api/auth/user', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onboardingCompleted: true
          })
        });
      }
    } catch (error) {
      console.error('Failed to save tour completion:', error);
    }
  };

  const isTourCompleted = (tourKey: string) => {
    return completedTours.includes(tourKey);
  };

  const showFeatureIntro = (feature: string) => {
    const tourKey = `feature-tour-${feature}`;
    if (!isTourCompleted(tourKey)) {
      startTour(tourKey);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        currentTour,
        startTour,
        stopTour,
        completeTour,
        isTourCompleted,
        showFeatureIntro
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}