import React, { createContext, useContext, ReactNode } from 'react';

// Minimal, disabled help system to avoid hook errors until a real
// knowledge/tour engine is wired. UI should treat this as "help off".
const emptyHelpSystem = {
  activeTour: null as string | null,
  startTour: (_id?: string) => {},
  markTourCompleted: (_id?: string) => {},
  skipTour: (_id?: string) => {},
  tours: {} as Record<string, unknown>,
  shouldShowTour: () => false,
  config: { enableTooltips: false, contextualHints: false, showOnboardingTour: false },
  updateConfig: (_partial: Partial<{ enableTooltips: boolean; contextualHints: boolean; showOnboardingTour: boolean }>) => {},
};

const HelpSystemContext = createContext(emptyHelpSystem);

export function HelpSystemProvider({ children }: { children: ReactNode }) {
  return (
    <HelpSystemContext.Provider value={emptyHelpSystem}>
      {children}
    </HelpSystemContext.Provider>
  );
}

export function useHelpSystemContext() {
  return useContext(HelpSystemContext);
}