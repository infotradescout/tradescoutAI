export interface TourStep {
  id: string;
  target: string; // CSS selector for the element to highlight
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
  action?: {
    type: "click" | "hover" | "input";
    element?: string;
    value?: string;
  };
  condition?: () => boolean; // Optional condition to show this step
}

export interface TourConfig {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
  triggers: {
    autoStart?: boolean;
    onPageLoad?: boolean;
    onFirstVisit?: boolean;
    userRole?: string[];
  };
}