import React, { createContext, useContext } from 'react';
import { useHelpSystem } from '@/hooks/useHelpSystem';

const HelpSystemContext = createContext<ReturnType<typeof useHelpSystem> | null>(null);

export function HelpSystemProvider({ children }: { children: React.ReactNode }) {
  const helpSystem = useHelpSystem();
  
  return (
    <HelpSystemContext.Provider value={helpSystem}>
      {children}
    </HelpSystemContext.Provider>
  );
}

export function useHelpSystemContext() {
  const context = useContext(HelpSystemContext);
  if (!context) {
    throw new Error('useHelpSystemContext must be used within a HelpSystemProvider');
  }
  return context;
}