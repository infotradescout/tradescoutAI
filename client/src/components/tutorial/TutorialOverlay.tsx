import React, { useEffect, useRef } from 'react';
import { X, ArrowLeft, ArrowRight, SkipForward, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { TutorialStep } from '@shared/tutorial-schema';

interface TutorialOverlayProps {
  isVisible: boolean;
  currentStep: TutorialStep | null;
  stepIndex: number;
  totalSteps: number;
  progress: number;
  canSkip: boolean;
  canGoBack: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function TutorialOverlay({
  isVisible,
  currentStep,
  stepIndex,
  totalSteps,
  progress,
  canSkip,
  canGoBack,
  onNext,
  onPrevious,
  onSkip,
  onClose,
  isLoading = false,
}: TutorialOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !currentStep?.targetElement) return;

    const targetElement = document.querySelector(currentStep.targetElement);
    if (!targetElement) return;

    // Create highlight effect
    const rect = targetElement.getBoundingClientRect();
    const spotlight = document.createElement('div');
    spotlight.className = 'tutorial-spotlight';
    spotlight.style.cssText = `
      position: fixed;
      top: ${rect.top - 8}px;
      left: ${rect.left - 8}px;
      width: ${rect.width + 16}px;
      height: ${rect.height + 16}px;
      border: 3px solid var(--theme-accent-primary);
      border-radius: 8px;
      background: color-mix(in srgb, var(--theme-accent-primary) 10%, transparent);
      box-shadow: 0 0 20px color-mix(in srgb, var(--theme-accent-primary) 30%, transparent);
      pointer-events: none;
      z-index: 9998;
      animation: tutorialPulse 2s infinite;
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tutorialPulse {
        0%, 100% { box-shadow: 0 0 20px color-mix(in srgb, var(--theme-accent-primary) 30%, transparent); }
        50% { box-shadow: 0 0 30px color-mix(in srgb, var(--theme-accent-primary) 60%, transparent); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(spotlight);

    // Scroll element into view if needed
    targetElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest' 
    });

    return () => {
      spotlight.remove();
      style.remove();
    };
  }, [isVisible, currentStep?.targetElement, stepIndex]);

  if (!isVisible || !currentStep) return null;

  const getPositionStyles = () => {
    if (!currentStep.targetElement) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
      };
    }

    const targetElement = document.querySelector(currentStep.targetElement);
    if (!targetElement) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
      };
    }

    const rect = targetElement.getBoundingClientRect();
    const position = currentStep.position || 'bottom';

    switch (position) {
      case 'top':
        return {
          position: 'fixed' as const,
          top: `${rect.top - 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
          zIndex: 9999,
        };
      case 'bottom':
        return {
          position: 'fixed' as const,
          top: `${rect.bottom + 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, 0)',
          zIndex: 9999,
        };
      case 'left':
        return {
          position: 'fixed' as const,
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.left - 20}px`,
          transform: 'translate(-100%, -50%)',
          zIndex: 9999,
        };
      case 'right':
        return {
          position: 'fixed' as const,
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + 20}px`,
          transform: 'translate(0, -50%)',
          zIndex: 9999,
        };
      case 'center':
      default:
        return {
          position: 'fixed' as const,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
        };
    }
  };

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-9997" />
      
      {/* Tutorial card */}
      <div ref={overlayRef} style={getPositionStyles()}>
        <Card className="w-96 max-w-[90vw] bg-tsCard border-white/10 shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-ts-orange text-white">
                  Step {stepIndex + 1} of {totalSteps}
                </Badge>
                <Badge variant="outline" className="border-white/10 text-navy-300">
                  Tutorial
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 text-navy-400 hover:text-white hover:bg-tsCard"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-lg text-white">
              {currentStep.title}
            </CardTitle>
            <Progress value={progress} className="h-2 bg-tsCard">
              <div 
                className="h-full bg-ts-orange transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </Progress>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-navy-200 leading-relaxed">
              {currentStep.content}
            </p>

            {currentStep.multimedia && (
              <div className="rounded-lg overflow-hidden border border-white/10">
                {currentStep.multimedia.type === 'image' && (
                  <img 
                    src={currentStep.multimedia.url} 
                    alt={currentStep.multimedia.alt || currentStep.title}
                    className="w-full h-auto"
                  />
                )}
                {currentStep.multimedia.type === 'video' && (
                  <video 
                    src={currentStep.multimedia.url} 
                    controls 
                    className="w-full h-auto"
                    poster={currentStep.multimedia.alt}
                  />
                )}
                {currentStep.multimedia.type === 'gif' && (
                  <img 
                    src={currentStep.multimedia.url} 
                    alt={currentStep.multimedia.alt || currentStep.title}
                    className="w-full h-auto"
                  />
                )}
              </div>
            )}

            {currentStep.action && (
              <div className="bg-tsCard rounded-lg p-3 border border-white/10">
                <div className="flex items-center gap-2 text-sm text-navy-300">
                  <Play className="h-4 w-4 text-ts-orange" />
                  <span>
                    {currentStep.action === 'click' && 'Click the highlighted element to continue'}
                    {currentStep.action === 'type' && `Type "${currentStep.actionValue}" in the highlighted field`}
                    {currentStep.action === 'navigate' && 'Navigate to the specified page'}
                    {currentStep.action === 'wait' && 'Wait for the action to complete'}
                    {currentStep.action === 'highlight' && 'Review the highlighted area'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                {canGoBack && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPrevious}
                    disabled={isLoading}
                    className="bg-tsCard border-white/10 text-navy-200 hover:bg-tsCard hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                {canSkip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSkip}
                    disabled={isLoading}
                    className="text-navy-400 hover:text-white hover:bg-tsCard"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip Tour
                  </Button>
                )}
              </div>

              <Button
                onClick={onNext}
                disabled={isLoading}
                className="bg-ts-orange hover:bg-ts-orange-dark text-white"
              >
                {stepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
                {stepIndex < totalSteps - 1 && <ArrowRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}