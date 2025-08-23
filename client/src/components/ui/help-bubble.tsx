import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface HelpBubbleProps {
  id: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  trigger?: 'hover' | 'click' | 'focus' | 'auto';
  delay?: number;
  variant?: 'tip' | 'warning' | 'info' | 'success';
  illustration?: string;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  onDismiss?: () => void;
  showOnce?: boolean;
  className?: string;
}

const illustrations = {
  hammer: "🔨",
  wrench: "🔧", 
  screwdriver: "🪛",
  drill: "🪃",
  saw: "🪚",
  measure: "📏",
  blueprint: "📋",
  hardhat: "👷",
  house: "🏠",
  lightbulb: "💡",
  star: "⭐",
  target: "🎯"
};

export function HelpBubble({
  id,
  title,
  content,
  position = 'auto',
  trigger = 'hover',
  delay = 500,
  variant = 'info',
  illustration,
  actions,
  onDismiss,
  showOnce = false,
  className = ''
}: HelpBubbleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenShown, setHasBeenShown] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Check if this help bubble has been dismissed before
  useEffect(() => {
    if (showOnce) {
      const dismissed = localStorage.getItem(`help-bubble-${id}`);
      if (dismissed) {
        setHasBeenShown(true);
      }
    }
  }, [id, showOnce]);

  // Auto-trigger for new users or important tips
  useEffect(() => {
    if (trigger === 'auto' && !hasBeenShown) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [trigger, delay, hasBeenShown]);

  // Calculate optimal position based on viewport
  useEffect(() => {
    if (position === 'auto' && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      let optimalPosition = 'top';
      
      if (rect.top < 200) optimalPosition = 'bottom';
      else if (rect.bottom > viewport.height - 200) optimalPosition = 'top';
      else if (rect.left < 300) optimalPosition = 'right';
      else if (rect.right > viewport.width - 300) optimalPosition = 'left';

      setActualPosition(optimalPosition);
    }
  }, [position, isVisible]);

  const handleShow = () => {
    if (hasBeenShown && showOnce) return;
    
    if (trigger === 'hover') {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      setIsVisible(true);
    }
  };

  const handleHide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setHasBeenShown(true);
    
    if (showOnce) {
      localStorage.setItem(`help-bubble-${id}`, 'true');
    }
    
    if (onDismiss) {
      onDismiss();
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'tip':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-300';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300';
      case 'success':
        return 'bg-green-500/10 border-green-500/20 text-green-300';
      default:
        return 'bg-slate-700/95 border-slate-600/50 text-slate-200';
    }
  };

  const getPositionStyles = () => {
    const base = 'absolute z-50';
    switch (actualPosition) {
      case 'top':
        return `${base} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${base} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${base} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${base} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      default:
        return `${base} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  const bubbleVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      y: actualPosition === 'top' ? 10 : actualPosition === 'bottom' ? -10 : 0,
      x: actualPosition === 'left' ? 10 : actualPosition === 'right' ? -10 : 0
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 20
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      transition: { duration: 0.2 }
    }
  };

  if (hasBeenShown && showOnce) {
    return (
      <div ref={triggerRef} className={className}>
        {/* Trigger element - rendered but help bubble won't show */}
        <HelpCircle className="w-4 h-4 text-slate-400 opacity-50" />
      </div>
    );
  }

  return (
    <div 
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={trigger === 'hover' ? handleShow : undefined}
      onMouseLeave={trigger === 'hover' ? handleHide : undefined}
      onClick={trigger === 'click' ? () => setIsVisible(!isVisible) : undefined}
      onFocus={trigger === 'focus' ? handleShow : undefined}
      onBlur={trigger === 'focus' ? handleHide : undefined}
      data-testid={`help-bubble-trigger-${id}`}
    >
      {/* Trigger Icon */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="cursor-help"
      >
        <HelpCircle className="w-4 h-4 text-slate-400 hover:text-blue-400 transition-colors" />
      </motion.div>

      {/* Help Bubble */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={bubbleRef}
            variants={bubbleVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={getPositionStyles()}
            data-testid={`help-bubble-${id}`}
          >
            <Card className={`w-80 max-w-sm border backdrop-blur-sm ${getVariantStyles()}`}>
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {illustration && (
                      <span className="text-lg" role="img" aria-label="illustration">
                        {illustrations[illustration as keyof typeof illustrations] || illustration}
                      </span>
                    )}
                    <h3 className="font-semibold text-sm">{title}</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="h-6 w-6 p-0 hover:bg-slate-600/50"
                    data-testid={`help-bubble-close-${id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>

                {/* Content */}
                <p className="text-xs leading-relaxed mb-3 opacity-90">
                  {content}
                </p>

                {/* Actions */}
                {actions && actions.length > 0 && (
                  <div className="flex space-x-2">
                    {actions.map((action, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant={action.variant === 'primary' ? 'default' : 'outline'}
                        onClick={action.action}
                        className="text-xs h-7"
                        data-testid={`help-bubble-action-${index}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Arrow */}
            <div 
              className={`absolute w-2 h-2 bg-slate-700 border-slate-600 transform rotate-45 ${
                actualPosition === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2' :
                actualPosition === 'bottom' ? 'bottom-full -mb-1 left-1/2 -translate-x-1/2' :
                actualPosition === 'left' ? 'left-full -ml-1 top-1/2 -translate-y-1/2' :
                'right-full -mr-1 top-1/2 -translate-y-1/2'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Guided tour component for onboarding
interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  illustration?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface GuidedTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  isActive: boolean;
}

export function GuidedTour({ steps, onComplete, onSkip, isActive }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive && steps.length > 0) {
      setIsVisible(true);
      setCurrentStep(0);
    } else {
      setIsVisible(false);
    }
  }, [isActive, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsVisible(false);
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible || !steps[currentStep]) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" data-testid="guided-tour-overlay">
      {/* Spotlight effect could be added here */}
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
      >
        <Card className="w-96 bg-slate-800/95 border-slate-600 backdrop-blur-sm">
          <CardContent className="p-6">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex space-x-1">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentStep ? 'bg-blue-500' : 
                      index < currentStep ? 'bg-green-500' : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-400">
                {currentStep + 1} of {steps.length}
              </span>
            </div>

            {/* Content */}
            <div className="mb-6">
              <div className="flex items-center space-x-2 mb-3">
                {step.illustration && (
                  <span className="text-2xl" role="img">
                    {illustrations[step.illustration as keyof typeof illustrations] || step.illustration}
                  </span>
                )}
                <h2 className="text-lg font-semibold text-white">{step.title}</h2>
              </div>
              <p className="text-slate-300 leading-relaxed">{step.content}</p>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={handleSkip} className="text-slate-400">
                Skip Tour
              </Button>
              
              <div className="flex space-x-2">
                {currentStep > 0 && (
                  <Button variant="outline" onClick={handlePrev}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                )}
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                  {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                  {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default HelpBubble;