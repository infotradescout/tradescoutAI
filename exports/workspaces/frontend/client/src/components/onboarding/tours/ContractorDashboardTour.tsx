import { TourStep } from "@/components/onboarding/types";

const contractorDashboardSteps: TourStep[] = [
  {
    id: "welcome",
    target: "h1",
    title: "Welcome to TradeScout!",
    description:
      "This is your control panel. Use the help button anytime for guided tours and tips.",
    position: "bottom",
  },
  {
    id: "manage-connections",
    target: "[data-testid='projects-widget']",
    title: "Manage Connections",
    description: "Review and respond to new customer inquiries",
    position: "bottom",
    primaryAction: {
      label: "View Connections",
      href: "/project-tracker",
    },
  },
  {
    id: "revenue-tracking",
    target: "[data-testid='revenue-widget']",
    title: "Track Revenue",
    description: "Monitor your earnings and business growth",
    position: "top",
  },
  {
    id: "trust-overview",
    target: "[data-testid='trust-widget']",
    title: "Trust (CVS)",
    description:
      "CVS reflects verification and reliability signals. It helps govern exposure and eligibility.",
    position: "top",
  },
  {
    id: "active-jobs",
    target: "[data-testid='jobs-widget']",
    title: "Active Jobs",
    description: "Track your current projects and deadlines",
    position: "bottom",
  },
];

export default contractorDashboardSteps;
