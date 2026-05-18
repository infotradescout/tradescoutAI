import { OnboardingTour } from "../OnboardingTour";
import type { TourStep } from "../types";

const contractorBoardSteps: TourStep[] = [
  {
    id: "welcome",
    target: "h1",
    title: "Welcome to TradeScout!",
    description:
      "This is a legacy local business discovery surface where customers can inspect trusted providers. Let's take a quick tour so you know how to show up well here.",
    position: "bottom",
  },
  {
    id: "facebook-signup",
    target: "[data-testid='button-contractor-facebook-signup']",
    title: "Quick Business Signup",
    description:
      "Ready to join? Click here to sign up with Facebook in seconds and start building your business profile.",
    position: "bottom",
    condition: () =>
      !document
        .querySelector("[data-testid='button-contractor-facebook-signup']")
        ?.getAttribute("data-authenticated"),
  },
  {
    id: "search-filters",
    target: "[data-testid='contractor-search']",
    title: "Find Your Area",
    description:
      "Use these filters to explore businesses by location and category. Customers use this to find local help in their specific area.",
    position: "bottom",
  },
  {
    id: "contractor-cards",
    target: "[data-testid='contractor-card']:first-child",
    title: "Business Profiles",
    description:
      "Each business has a profile showing services, experience, proof, and recommendations from real customers.",
    position: "right",
    condition: () => !!document.querySelector("[data-testid='contractor-card']"),
  },
  {
    id: "recommendations",
    target: "[data-testid='recommendation-count']:first-child",
    title: "Customer Recommendations",
    description:
      "This shows real recommendations from homeowners. The thumbs up/down system helps build trust and credibility.",
    position: "top",
    condition: () => !!document.querySelector("[data-testid='recommendation-count']"),
  },
  {
    id: "scout-estimates",
    target: "[data-nav-item='scout']",
    title: "Scout Estimates",
    description:
      "Customers can ask Scout for ballpark estimates before starting a gated request. Clear estimates create better-fit demand for your business.",
    position: "bottom",
    condition: () => !!document.querySelector("[data-nav-item='scout']"),
  },
  {
    id: "sorting",
    target: "[data-testid='contractor-sorting']",
    title: "Smart Sorting",
    description:
      "Businesses are sorted by trust (CVS), recommendations, and relevance. Verified, reliable activity improves exposure over time.",
    position: "left",
    condition: () => !!document.querySelector("[data-testid='contractor-sorting']"),
  },
];

interface ContractorBoardTourProps {
  autoStart?: boolean;
  onComplete?: () => void;
}

export function ContractorBoardTour({ autoStart = false, onComplete }: ContractorBoardTourProps) {
  return (
    <OnboardingTour
      steps={contractorBoardSteps}
      tourKey="contractor-board-tour"
      autoStart={autoStart}
      onComplete={onComplete}
    />
  );
}
