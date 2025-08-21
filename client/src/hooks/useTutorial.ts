import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { TutorialDefinition, TutorialContext, UserTutorialProgress } from '@shared/tutorial-schema';

export function useTutorial() {
  const queryClient = useQueryClient();
  const [activeTutorial, setActiveTutorial] = useState<TutorialDefinition | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Fetch user's tutorial progress (gracefully handle auth errors)
  const { data: userProgress } = useQuery({
    queryKey: ['/api/tutorials/user-progress'],
    retry: false,
    throwOnError: false,
  });

  // Fetch recommended tutorials (gracefully handle auth errors)
  const { data: recommendedTutorials } = useQuery<{
    onboarding: TutorialDefinition[];
    feature: TutorialDefinition[];
    suggested: TutorialDefinition[];
  }>({
    queryKey: ['/api/tutorials/recommended'],
    retry: false,
    throwOnError: false,
  });

  // Start tutorial mutation
  const startTutorialMutation = useMutation({
    mutationFn: async ({ tutorialId, viewport }: { tutorialId: string; viewport?: string }) => {
      const response = await apiRequest('POST', `/api/tutorials/${tutorialId}/start`, { viewport });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tutorials/user-progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tutorials/recommended'] });
    },
  });

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ 
      tutorialId, 
      stepIndex, 
      action, 
      timeSpent, 
      metadata,
      viewport 
    }: { 
      tutorialId: string; 
      stepIndex: string; 
      action: string; 
      timeSpent?: number; 
      metadata?: any;
      viewport?: string;
    }) => {
      const response = await apiRequest('PUT', `/api/tutorials/${tutorialId}/progress`, {
        stepIndex,
        action,
        timeSpent,
        metadata,
        viewport,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tutorials/user-progress'] });
    },
  });

  // Complete tutorial mutation
  const completeTutorialMutation = useMutation({
    mutationFn: async ({ tutorialId, finalStepIndex }: { tutorialId: string; finalStepIndex?: string }) => {
      const response = await apiRequest('POST', `/api/tutorials/${tutorialId}/complete`, { finalStepIndex });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tutorials/user-progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tutorials/recommended'] });
    },
  });

  // Skip tutorial mutation
  const skipTutorialMutation = useMutation({
    mutationFn: async (tutorialId: string) => {
      const response = await apiRequest('POST', `/api/tutorials/${tutorialId}/skip`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tutorials/user-progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tutorials/recommended'] });
    },
  });

  // Check if tutorial should show
  const checkTutorialMutation = useMutation({
    mutationFn: async (featureId: string) => {
      const response = await apiRequest('GET', `/api/tutorials/check/${featureId}`);
      return response.json();
    },
  });

  // Helper functions
  const getViewportSize = () => {
    return `${window.innerWidth}x${window.innerHeight}`;
  };

  const calculateTimeSpent = () => {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime) / 1000);
  };

  // Tutorial control functions
  const startTutorial = useCallback(async (tutorialId: string) => {
    try {
      const result = await startTutorialMutation.mutateAsync({
        tutorialId,
        viewport: getViewportSize(),
      });
      
      setActiveTutorial(result.tutorial);
      setCurrentStepIndex(0);
      setIsVisible(true);
      setStartTime(Date.now());
    } catch (error) {
      console.error('Failed to start tutorial:', error);
    }
  }, [startTutorialMutation]);

  const nextStep = useCallback(async () => {
    if (!activeTutorial) return;

    const timeSpent = calculateTimeSpent();
    const newStepIndex = currentStepIndex + 1;

    // Update progress for current step
    await updateProgressMutation.mutateAsync({
      tutorialId: activeTutorial.id,
      stepIndex: currentStepIndex.toString(),
      action: 'completed',
      timeSpent,
      viewport: getViewportSize(),
    });

    if (newStepIndex >= activeTutorial.steps.length) {
      // Tutorial completed
      await completeTutorialMutation.mutateAsync({
        tutorialId: activeTutorial.id,
        finalStepIndex: currentStepIndex.toString(),
      });
      setIsVisible(false);
      setActiveTutorial(null);
      setCurrentStepIndex(0);
      setStartTime(null);
    } else {
      setCurrentStepIndex(newStepIndex);
      setStartTime(Date.now()); // Reset timer for next step
    }
  }, [activeTutorial, currentStepIndex, updateProgressMutation, completeTutorialMutation]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setStartTime(Date.now()); // Reset timer
    }
  }, [currentStepIndex]);

  const skipTutorial = useCallback(async () => {
    if (!activeTutorial) return;

    try {
      await skipTutorialMutation.mutateAsync(activeTutorial.id);
      setIsVisible(false);
      setActiveTutorial(null);
      setCurrentStepIndex(0);
      setStartTime(null);
    } catch (error) {
      console.error('Failed to skip tutorial:', error);
    }
  }, [activeTutorial, skipTutorialMutation]);

  const hideTutorial = useCallback(() => {
    setIsVisible(false);
  }, []);

  const showTutorial = useCallback(() => {
    setIsVisible(true);
  }, []);

  // Check if feature tutorial should show
  const checkFeatureTutorial = useCallback(async (featureId: string) => {
    try {
      const result = await checkTutorialMutation.mutateAsync(featureId);
      if (result.shouldShow && result.tutorial) {
        await startTutorial(result.tutorial.id);
      }
      return result;
    } catch (error) {
      console.error('Failed to check feature tutorial:', error);
      return { shouldShow: false, tutorial: null };
    }
  }, [checkTutorialMutation, startTutorial]);

  // Auto-start onboarding tutorials for new users
  useEffect(() => {
    if (recommendedTutorials?.onboarding?.length && recommendedTutorials.onboarding.length > 0 && !activeTutorial) {
      const firstOnboarding = recommendedTutorials.onboarding[0];
      if (firstOnboarding.triggerCondition === 'account_creation') {
        startTutorial(firstOnboarding.id);
      }
    }
  }, [recommendedTutorials, activeTutorial, startTutorial]);

  // Tutorial context for components
  const tutorialContext: TutorialContext = {
    isActive: isVisible && !!activeTutorial,
    currentTutorial: activeTutorial,
    currentStep: activeTutorial?.steps[currentStepIndex] || null,
    stepIndex: currentStepIndex,
    totalSteps: activeTutorial?.steps.length || 0,
    canSkip: activeTutorial?.steps[currentStepIndex]?.skipable !== false,
    canGoBack: currentStepIndex > 0,
    progress: activeTutorial ? Math.round(((currentStepIndex + 1) / activeTutorial.steps.length) * 100) : 0,
  };

  return {
    // State
    tutorialContext,
    userProgress,
    recommendedTutorials,
    isLoading: startTutorialMutation.isPending || updateProgressMutation.isPending,

    // Actions
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    hideTutorial,
    showTutorial,
    checkFeatureTutorial,

    // Mutation states
    isStarting: startTutorialMutation.isPending,
    isUpdating: updateProgressMutation.isPending,
    isCompleting: completeTutorialMutation.isPending,
    isSkipping: skipTutorialMutation.isPending,
  };
}