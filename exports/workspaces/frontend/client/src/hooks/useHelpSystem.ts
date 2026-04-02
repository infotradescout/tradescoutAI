import { useState, useEffect } from "react";

interface HelpSystemConfig {
  enableTooltips: boolean;
  showOnboardingTour: boolean;
  contextualHints: boolean;
  autoShowDelay: number;
}

interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  illustration?: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function useHelpSystem() {
  const [config, setConfig] = useState<HelpSystemConfig>({
    enableTooltips: true,
    showOnboardingTour: false,
    contextualHints: true,
    autoShowDelay: 1000,
  });

  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [completedTours, setCompletedTours] = useState<string[]>([]);

  // Load user preferences
  useEffect(() => {
    const savedConfig = localStorage.getItem("tradescout-help-config");
    const savedTours = localStorage.getItem("tradescout-completed-tours");

    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }

    if (savedTours) {
      setCompletedTours(JSON.parse(savedTours));
    }
  }, []);

  // Save preferences
  const updateConfig = (newConfig: Partial<HelpSystemConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem("tradescout-help-config", JSON.stringify(updated));
  };

  const markTourCompleted = (tourId: string) => {
    const updated = [...completedTours, tourId];
    setCompletedTours(updated);
    localStorage.setItem("tradescout-completed-tours", JSON.stringify(updated));
    setActiveTour(null);
  };

  const startTour = (tourId: string) => {
    if (!completedTours.includes(tourId)) {
      setActiveTour(tourId);
    }
  };

  const skipTour = (tourId: string) => {
    markTourCompleted(tourId);
  };

  // Pre-defined tours for different pages
  const tours: Record<string, TourStep[]> = {
    "contractor-search": [
      {
        id: "search-welcome",
        target: ".contractor-search-form",
        title: "Welcome to Contractor Search!",
        content:
          "Find verified local contractors for your next project. Use the filters to narrow down your search by location, trade, and services.",
        illustration: "hammer",
        position: "bottom",
      },
      {
        id: "search-filters",
        target: ".search-filters",
        title: "Smart Filtering",
        content:
          "Use our advanced filters to find contractors who match your specific needs. Filter by trade, location, trust (CVS), and availability.",
        illustration: "target",
        position: "right",
      },
      {
        id: "search-results",
        target: ".contractor-results",
        title: "Verified Contractors",
        content:
          "All contractors are verified with licenses, insurance, and background checks. View profiles, trust (CVS), and past work.",
        illustration: "hardhat",
        position: "top",
      },
    ],
    "daily-deals": [
      {
        id: "deals-intro",
        target: ".daily-deals-grid",
        title: "TradeDeals & LuckyBucks",
        content:
          "Discover amazing deals from local contractors and suppliers. Earn LuckyBucks with every purchase!",
        illustration: "lightbulb",
        position: "bottom",
      },
      {
        id: "deals-savings",
        target: ".deal-card",
        title: "Exclusive Savings",
        content:
          "These deals are only available through TradeScout. Save up to 50% on home improvement services and materials.",
        illustration: "target",
        position: "top",
      },
    ],
    groups: [
      {
        id: "groups-intro",
        target: ".groups-grid",
        title: "Community Groups",
        content:
          "Join local communities of residents, pros, and leaders. Share projects, get advice, and build connections.",
        illustration: "house",
        position: "bottom",
      },
      {
        id: "groups-types",
        target: ".group-types",
        title: "Different Group Types",
        content:
          "Explore local communities, specialty trade groups, and interest-based discussions. Find your perfect community!",
        illustration: "blueprint",
        position: "right",
      },
    ],
    connections: [
      {
        id: "connections-intro",
        target: ".connections-header",
        title: "Connections",
        content:
          "Connections are people you've approved contact with. The moment first-contact is accepted, they appear here. Social follows live under the Social tab.",
        illustration: "users",
        position: "bottom",
      },
      {
        id: "connections-social",
        target: ".connections-social-tab",
        title: "Social follows",
        content:
          "Use the Social tab to view followers/following and suggested mutuals without granting contact authority.",
        illustration: "sparkles",
        position: "right",
      },
    ],
  };

  return {
    config,
    updateConfig,
    activeTour,
    completedTours,
    startTour,
    skipTour,
    markTourCompleted,
    tours,
    shouldShowTour: (tourId: string) => !completedTours.includes(tourId),
  };
}
