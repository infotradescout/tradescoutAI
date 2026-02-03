import React, { createContext, useContext } from "react";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "./TutorialOverlay";

interface TutorialProviderProps {
  children: React.ReactNode;
}

type TutorialContextType = ReturnType<typeof useTutorial>;

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: TutorialProviderProps) {
  const tutorialState = useTutorial();

  return (
    <TutorialContext.Provider value={tutorialState}>
      {children}
      <TutorialOverlay
        isVisible={tutorialState.tutorialContext.isActive}
        currentStep={tutorialState.tutorialContext.currentStep}
        stepIndex={tutorialState.tutorialContext.stepIndex}
        totalSteps={tutorialState.tutorialContext.totalSteps}
        progress={tutorialState.tutorialContext.progress}
        canSkip={tutorialState.tutorialContext.canSkip}
        canGoBack={tutorialState.tutorialContext.canGoBack}
        onNext={tutorialState.nextStep}
        onPrevious={tutorialState.previousStep}
        onSkip={tutorialState.skipTutorial}
        onClose={tutorialState.hideTutorial}
        isLoading={tutorialState.isLoading}
      />
    </TutorialContext.Provider>
  );
}

export function useTutorialContext() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorialContext must be used within a TutorialProvider");
  }
  return context;
}
