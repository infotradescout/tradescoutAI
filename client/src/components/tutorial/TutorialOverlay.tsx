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
      border: 3px solid #f97316;
      border-radius: 8px;
      background: rgba(249, 115, 22, 0.1);
      box-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
      pointer-events: none;
      z-index: 9998;
      animation: tutorialPulse 2s infinite;
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tutorialPulse {
        0%, 100% { box-shadow: 0 0 20px rgba(249, 115, 22, 0.3); }
        50% { box-shadow: 0 0 30px rgba(249, 115, 22, 0.6); }
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
        <Card className="w-96 max-w-[90vw] bg-navy-800 border-navy-600 shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-orange-500 text-white">
                  Step {stepIndex + 1} of {totalSteps}
                </Badge>
                <Badge variant="outline" className="border-navy-500 text-navy-300">
                  Tutorial
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 text-navy-400 hover:text-white hover:bg-navy-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-lg text-white">
              {currentStep.title}
            </CardTitle>
            <Progress value={progress} className="h-2 bg-navy-700">
              <div 
                className="h-full bg-orange-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </Progress>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-navy-200 leading-relaxed">
              {currentStep.content}
            </p>

            {currentStep.multimedia && (
              <div className="rounded-lg overflow-hidden border border-navy-600">
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
              <div className="bg-navy-700 rounded-lg p-3 border border-navy-600">
                <div className="flex items-center gap-2 text-sm text-navy-300">
                  <Play className="h-4 w-4 text-orange-500" />
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
                    className="bg-navy-700 border-navy-600 text-navy-200 hover:bg-navy-600 hover:text-white"
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
                    className="text-navy-400 hover:text-white hover:bg-navy-700"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip Tour
                  </Button>
                )}
              </div>

              <Button
                onClick={onNext}
                disabled={isLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
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