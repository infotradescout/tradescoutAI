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
        "You're in. Let's take a quick tour so Scout surfaces local context and TradeScout routes your next real project step.",
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
        title: "Business Requests",
        description:
          "This is where local customers can discover trusted businesses and start gated requests. Complete your profile to improve trust context.",
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
          "Ready to start? Complete your business profile, offers, and verification to begin attracting customers.",
        position: "left",
      },
    ];
  } else if (userRole === "homeowner") {
    return [
      ...baseSteps,
      {
        id: "find-contractors",
        target: "[data-testid='nav-contractor-board']",
        title: "Find Local Help",
        description: "Use Direct Connect and Scout to route requests to trusted local businesses.",
        position: "bottom",
      },
      {
        id: "get-quotes",
        target: "[data-nav-item='scout']",
        title: "Start an Estimate Request",
        description: "Use Scout to get a quick ballpark before you start a gated request.",
        position: "bottom",
      },
      {
        id: "leave-recommendations",
        target: "[data-testid='nav-contractor-board']",
        title: "Leave Recommendations",
        description:
          "After working with a business, come back to leave a recommendation to help other local customers.",
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
