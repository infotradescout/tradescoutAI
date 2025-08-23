import React, { createContext, useContext, ReactNode } from 'react';

// Simple mock help system for now to avoid hook errors
const mockHelpSystem = {
  activeTour: null,
  startTour: () => {},
  markTourCompleted: () => {},
  skipTour: () => {},
  tours: {},
  shouldShowTour: () => false,
  config: { enableTooltips: true, contextualHints: true, showOnboardingTour: false },
  updateConfig: () => {}
};

const HelpSystemContext = createContext(mockHelpSystem);

export function HelpSystemProvider({ children }: { children: ReactNode }) {
  return (
    <HelpSystemContext.Provider value={mockHelpSystem}>
      {children}
    </HelpSystemContext.Provider>
  );
}

export function useHelpSystemContext() {
  return useContext(HelpSystemContext);
}