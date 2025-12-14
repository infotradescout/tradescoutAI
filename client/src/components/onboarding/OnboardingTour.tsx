import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ArrowRight, ArrowLeft, Lightbulb, Target, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
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

interface OnboardingTourProps {
  steps: TourStep[];
  tourKey: string; // Unique key for this tour (e.g., "contractor-onboarding")
  onComplete?: () => void;
  autoStart?: boolean;
  className?: string;
}

export function OnboardingTour({ 
  steps, 
  tourKey, 
  onComplete, 
  autoStart = false,
  className 
}: OnboardingTourProps) {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Check if user has completed this tour
  const tourCompleted = user?.preferences?.completedTours?.includes(tourKey) || false;

  // Filter steps based on conditions
  const availableSteps = steps.filter(step => !step.condition || step.condition());

  useEffect(() => {
    if (autoStart && !tourCompleted && availableSteps.length > 0) {
      startTour();
    }
  }, [autoStart, tourCompleted, availableSteps.length]);

  useEffect(() => {
    if (isActive && currentStep < availableSteps.length) {
      highlightCurrentStep();
    }
  }, [isActive, currentStep, availableSteps]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActive) {
        stopTour();
      }
    };

    const handleResize = () => {
      if (isActive && highlightedElement) {
        updateTooltipPosition();
      }
    };

    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive, highlightedElement]);

  const startTour = () => {
    if (tourCompleted || availableSteps.length === 0) return;
    setIsActive(true);
    setCurrentStep(0);
    document.body.style.overflow = 'hidden';
  };

  const stopTour = () => {
    setIsActive(false);
    setHighlightedElement(null);
    document.body.style.overflow = 'auto';
    removeHighlight();
  };

  const nextStep = () => {
    if (currentStep < availableSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTour = async () => {
    stopTour();
    
    // Mark tour as completed for user
    try {
      await fetch('/api/users/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTours: [...(user?.preferences?.completedTours || []), tourKey]
        })
      });
    } catch (error) {
      console.error('Failed to save tour completion:', error);
    }

    onComplete?.();
  };

  const highlightCurrentStep = () => {
    const step = availableSteps[currentStep];
    if (!step) return;

    removeHighlight();

    // Find target element
    const targetElement = document.querySelector(step.target);
    if (!targetElement) {
      console.warn(`Onboarding: Target element not found: ${step.target}`);
      return;
    }

    setHighlightedElement(targetElement);
    
    // Add highlight class
    targetElement.classList.add('onboarding-highlight');
    
    // Scroll element into view
    targetElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    });

    // Update tooltip position
    setTimeout(() => updateTooltipPosition(), 100);
  };

  const updateTooltipPosition = () => {
    if (!highlightedElement || !tooltipRef.current) return;

    const step = availableSteps[currentStep];
    const elementRect = highlightedElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = elementRect.top - tooltipRect.height - 20;
        left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = elementRect.bottom + 20;
        left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = elementRect.top + (elementRect.height / 2) - (tooltipRect.height / 2);
        left = elementRect.left - tooltipRect.width - 20;
        break;
      case 'right':
        top = elementRect.top + (elementRect.height / 2) - (tooltipRect.height / 2);
        left = elementRect.right + 20;
        break;
    }

    // Keep tooltip within viewport
    if (left < 10) left = 10;
    if (left + tooltipRect.width > viewportWidth - 10) {
      left = viewportWidth - tooltipRect.width - 10;
    }
    if (top < 10) top = 10;
    if (top + tooltipRect.height > viewportHeight - 10) {
      top = viewportHeight - tooltipRect.height - 10;
    }

    setTooltipPosition({ top, left });
  };

  const removeHighlight = () => {
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
      el.classList.remove('onboarding-highlight');
    });
  };

  const skipTour = () => {
    completeTour();
  };

  if (!isActive || tourCompleted || availableSteps.length === 0) {
    return null;
  }

  const step = availableSteps[currentStep];
  const progress = ((currentStep + 1) / availableSteps.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div 
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
        onClick={stopTour}
      />

      {/* Tooltip */}
      <Card
        ref={tooltipRef}
        className={cn(
          "fixed z-[10000] w-80 bg-white border-orange-200 shadow-2xl",
          className
        )}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-orange-500" />
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                Step {currentStep + 1} of {availableSteps.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={stopTour}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={skipTour}
                className="text-gray-500 hover:text-gray-700"
              >
                Skip Tour
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </Button>
                
                <Button
                  size="sm"
                  onClick={nextStep}
                  className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600"
                >
                  {currentStep === availableSteps.length - 1 ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Finish
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global styles for highlighting */}
      <style>{`
        .onboarding-highlight {
          position: relative;
          z-index: 9998;
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.4), 
                      0 0 0 8px rgba(249, 115, 22, 0.2);
          border-radius: 8px;
          animation: onboarding-pulse 2s infinite;
        }

        @keyframes onboarding-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.4), 
                        0 0 0 8px rgba(249, 115, 22, 0.2);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.6), 
                        0 0 0 12px rgba(249, 115, 22, 0.1);
          }
        }
      `}</style>
    </>
  );
}

// Hook to trigger tours
export function useOnboardingTour() {
  const [activeTour, setActiveTour] = useState<string | null>(null);

  const startTour = (tourKey: string) => {
    setActiveTour(tourKey);
  };

  const stopTour = () => {
    setActiveTour(null);
  };

  return {
    activeTour,
    startTour,
    stopTour
  };
}