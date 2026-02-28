import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Info, Lightbulb, Star, Target, Wrench, Hammer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface HelpBubbleProps {
  id: string;
  title: string;
  content: string;
  illustration?: 'hammer' | 'wrench' | 'lightbulb' | 'star' | 'target' | 'info';
  variant?: 'info' | 'tip' | 'success' | 'warning';
  trigger?: 'hover' | 'click' | 'focus';
  position?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
}

const iconMap = {
  hammer: Hammer,
  wrench: Wrench,
  lightbulb: Lightbulb,
  star: Star,
  target: Target,
  info: Info,
};

const variantColors = {
  info: 'border-ts-orange/30 bg-ts-orange/10',
  tip: 'border-amber-500 bg-amber-500/10',
  success: 'border-green-500 bg-green-500/10',
  warning: 'border-ts-orange/30 bg-ts-orange/10',
};

export function HelpBubble({
  id,
  title,
  content,
  illustration = 'info',
  variant = 'info',
  trigger = 'hover',
  position = 'top',
  children
}: HelpBubbleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = iconMap[illustration];

  const handleMouseEnter = () => {
    if (trigger === 'hover') setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') setIsVisible(false);
  };

  const handleClick = () => {
    if (trigger === 'click') setIsVisible(!isVisible);
  };

  const handleFocus = () => {
    if (trigger === 'focus') setIsVisible(true);
  };

  const handleBlur = () => {
    if (trigger === 'focus') setIsVisible(false);
  };

  return (
    <div className="relative inline-block">
      <button
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ts-orange/20 text-ts-orange hover:bg-ts-orange/30 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-testid={`help-bubble-${id}`}
      >
        <HelpCircle className="w-3 h-3" />
      </button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className={`absolute z-50 w-80 ${
              position === 'top' ? 'bottom-full mb-2' :
              position === 'bottom' ? 'top-full mt-2' :
              position === 'left' ? 'right-full mr-2' :
              'left-full ml-2'
            }`}
          >
            <Card className={`${variantColors[variant]} border shadow-lg`}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <Icon className="w-5 h-5 text-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-white mb-1">{title}</h4>
                    <p className="text-sm text-white/70 leading-relaxed">{content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}

// Simple tour component for guided experience
export function GuidedTour({ steps, isActive, onComplete, onSkip }: {
  steps: any[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}) {
  if (!isActive || !steps.length) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <Card className="bg-[color:var(--surface-card)] border-[color:var(--border-subtle)] max-w-md">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Welcome Tour</h3>
          <p className="text-white/70 mb-4">
            Would you like a quick tour of the features on this page?
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onComplete}
              className="flex-1 bg-ts-orange-dark hover:bg-ts-orange-dark text-white px-4 py-2 rounded"
            >
              Start Tour
            </button>
            <button
              onClick={onSkip}
              className="flex-1 bg-white/10 hover:bg-white/10 text-white px-4 py-2 rounded"
            >
              Skip
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}