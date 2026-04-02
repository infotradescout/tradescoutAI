import { OnboardingTour } from "../OnboardingTour";
import type { TourStep } from "../types";
import { useAuth } from "@/hooks/useAuth";

const getNewUserSteps = (userRole: string): TourStep[] => {
  const baseSteps: TourStep[] = [
    {
      id: "welcome",
      target: "[data-testid='navigation-header']",
      title: `Welcome to TradeScout!`,
      description:
        "You're in. Let's take a quick tour so Scout and TradeScout can help you move real projects forward.",
      position: "bottom",
    },
    {
      id: "navigation",
      target: "[data-testid='main-navigation']",
      title: "Navigation Menu",
      description:
        "Use this menu to access different areas of TradeScout. Your navigation is customized based on your account type.",
      position: "bottom",
    },
    {
      id: "profile",
      target: "[data-testid='user-dropdown']",
      title: "Your Profile",
      description:
        "Click here to access your profile, settings, and account preferences. Keep your information up to date!",
      position: "left",
    },
  ];

  // Role-specific steps
  if (userRole === "contractor_user") {
    return [
      ...baseSteps,
      {
        id: "contractor-board",
        target: "[data-testid='nav-contractor-board']",
        title: "Contractor Board",
        description:
          "This is where homeowners find contractors. Complete your profile to appear higher in search results!",
        position: "bottom",
      },
      {
        id: "recommendations",
        target: "[data-testid='nav-recommendations']",
        title: "Get Recommendations",
        description:
          "Ask satisfied customers to recommend you here. Recommendations strengthen your visibility and credibility.",
        position: "bottom",
      },
      {
        id: "complete-profile",
        target: "[data-testid='user-dropdown']",
        title: "Complete Your Profile",
        description:
          "Ready to start? Click here and complete your contractor profile to begin attracting customers!",
        position: "left",
      },
    ];
  } else if (userRole === "homeowner") {
    return [
      ...baseSteps,
      {
        id: "find-contractors",
        target: "[data-testid='nav-contractor-board']",
        title: "Find Contractors",
        description:
          "Browse verified contractors in your area. Use filters to find specialists for your specific project.",
        position: "bottom",
      },
      {
        id: "get-quotes",
        target: "[data-nav-item='scout']",
        title: "Ask Scout for Estimates",
        description:
          "Use Scout to get a quick ballpark for your project before you start contacting contractors.",
        position: "bottom",
      },
      {
        id: "leave-recommendations",
        target: "[data-testid='nav-contractor-board']",
        title: "Leave Recommendations",
        description:
          "After working with a contractor, come back to leave a recommendation to help other homeowners.",
        position: "bottom",
      },
    ];
  }

  return baseSteps;
};

interface NewUserTourProps {
  autoStart?: boolean;
  onComplete?: () => void;
}

export function NewUserTour({ autoStart = false, onComplete }: NewUserTourProps) {
  const { user } = useAuth();

  if (!user) return null;

  const steps = getNewUserSteps(user.role);

  return (
    <OnboardingTour
      steps={steps}
      tourKey={`new-user-tour-${user.role}`}
      autoStart={autoStart}
      onComplete={onComplete}
    />
  );
}
