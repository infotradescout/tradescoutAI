import { OnboardingTour } from "../OnboardingTour";
import type { TourStep } from "../types";

interface FeatureTourProps {
  feature: "recommendations" | "quote-calculator" | "marketplace" | "search";
  autoStart?: boolean;
  onComplete?: () => void;
}

const getFeatureSteps = (feature: string): TourStep[] => {
  switch (feature) {
    case "recommendations":
      return [
        {
          id: "recommendation-intro",
          target: "[data-testid='recommendation-form']",
          title: "Leave a Recommendation",
          description:
            "Help other homeowners by sharing your experience with this contractor. Your feedback builds trust in the community.",
          position: "top",
        },
        {
          id: "thumbs-system",
          target: "[data-testid='recommendation-thumbs']",
          title: "Thumbs Up or Down",
          description:
            "Simple but powerful - give a thumbs up for good work or thumbs down if you had issues. This directly affects contractor rankings.",
          position: "bottom",
        },
        {
          id: "add-details",
          target: "[data-testid='recommendation-details']",
          title: "Share Details",
          description:
            "Add specific details about the work quality, timeliness, and professionalism. This helps other homeowners make informed decisions.",
          position: "bottom",
        },
      ];

    case "quote-calculator":
      return [
        {
          id: "scout-estimates-intro",
          target: "[data-nav-item='scout']",
          title: "Ask Scout for Estimates",
          description:
            "Use Scout to get ballpark pricing for your project in seconds, based on local context and your project details.",
          position: "bottom",
          condition: () => !!document.querySelector("[data-nav-item='scout']"),
        },
      ];

    case "search":
      return [
        {
          id: "search-intro",
          target: "[data-testid='contractor-search']",
          title: "Smart Contractor Search",
          description:
            "Find exactly the right contractor for your project using our advanced search and filtering system.",
          position: "bottom",
        },
        {
          id: "location-filter",
          target: "[data-testid='location-filter']",
          title: "Search by Location",
          description:
            "Start with your city or local area so you only see contractors who actually work there.",
          position: "bottom",
        },
        {
          id: "trade-filter",
          target: "[data-testid='trade-filter']",
          title: "Filter by Trade",
          description:
            "Narrow down to contractors who specialize in exactly what you need - from plumbing to roofing to electrical work.",
          position: "bottom",
        },
        {
          id: "sorting-options",
          target: "[data-testid='contractor-sorting']",
          title: "Sort Results",
          description:
            "Sort by recommendations, trust (CVS), or experience. Verified, reliable activity improves exposure over time.",
          position: "left",
        },
      ];

    default:
      return [];
  }
};

export function FeatureTour({ feature, autoStart = false, onComplete }: FeatureTourProps) {
  const steps = getFeatureSteps(feature);

  if (steps.length === 0) return null;

  return (
    <OnboardingTour
      steps={steps}
      tourKey={`feature-tour-${feature}`}
      autoStart={autoStart}
      onComplete={onComplete}
    />
  );
}
