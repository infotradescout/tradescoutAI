import { OnboardingTour } from "../OnboardingTour";
import type { TourStep } from "../types";

const contractorBoardSteps: TourStep[] = [
  {
    id: "welcome",
    target: "h1",
    title: "Welcome to TradeScout!",
    description: "This is your contractor board where homeowners find and recommend trusted contractors. Let's take a quick tour to show you around.",
    position: "bottom"
  },
  {
    id: "facebook-signup",
    target: "[data-testid='button-contractor-facebook-signup']",
    title: "Quick Contractor Signup",
    description: "Ready to join? Click here to sign up with Facebook in seconds and start building your contractor profile.",
    position: "bottom",
    condition: () => !document.querySelector("[data-testid='button-contractor-facebook-signup']")?.getAttribute('data-authenticated')
  },
  {
    id: "search-filters",
    target: "[data-testid='contractor-search']",
    title: "Find Your Area",
    description: "Use these filters to explore contractors by location and trade. Homeowners use this to find contractors in their specific area.",
    position: "bottom"
  },
  {
    id: "contractor-cards",
    target: "[data-testid='contractor-card']:first-child",
    title: "Contractor Profiles",
    description: "Each contractor has a detailed profile showing their services, experience, and most importantly - recommendations from real customers.",
    position: "right",
    condition: () => !!document.querySelector("[data-testid='contractor-card']")
  },
  {
    id: "recommendations",
    target: "[data-testid='recommendation-count']:first-child",
    title: "Customer Recommendations",
    description: "This shows real recommendations from homeowners. The thumbs up/down system helps build trust and credibility.",
    position: "top",
    condition: () => !!document.querySelector("[data-testid='recommendation-count']")
  },
  {
    id: "quote-calculator",
    target: "[data-testid='link-quote-calculator']",
    title: "Quote Calculator",
    description: "Homeowners can get instant estimates for their projects. This drives qualified leads to contractors in their area.",
    position: "bottom",
    condition: () => !!document.querySelector("[data-testid='link-quote-calculator']")
  },
  {
    id: "sorting",
    target: "[data-testid='contractor-sorting']",
    title: "Smart Sorting",
    description: "Contractors are sorted by recommendations and ratings. The more positive feedback you get, the higher you appear!",
    position: "left",
    condition: () => !!document.querySelector("[data-testid='contractor-sorting']")
  }
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