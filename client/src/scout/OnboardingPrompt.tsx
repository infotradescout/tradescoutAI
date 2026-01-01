/**
 * Client Wiring: OnboardingPrompt Component
 * 
 * Renders D1/D2 onboarding questions (Q1-Q4) in response to server-sent metadata.
 * Handles answer submission and skip button.
 * 
 * Rules (Non-Negotiable):
 * - Single question per render
 * - Skip always available
 * - Answer sends data; does not navigate
 * - Unmounts cleanly when onboarding expires (active === false)
 */

import React, { useState } from 'react';
import clsx from 'clsx';

export type OnboardingMode = 'inline' | 'card' | 'modal';

export interface OnboardingPromptProps {
  /**
   * Onboarding metadata from server response
   */
  onboarding: {
    sessionId: string;
    onboardingQuestion?: {
      key: 'Q1' | 'Q2' | 'Q3' | 'Q4';
      question: string;
      options: Array<{ label: string; value: string; why: string }>;
      skipLabel: string;
      explanation: string;
    };
    snapshot?: {
      confidence: number;
      answeredQuestions: number;
      totalQuestions: number;
    };
  };

  /**
   * Presentation mode (recommended: use prop for A/B testing)
   */
  mode?: OnboardingMode;

  /**
   * Callback when user selects an answer
   * Should send: { onboardingAnswer: value, onboardingQuestionKey: key, sessionId }
   */
  onAnswer: (payload: {
    sessionId: string;
    questionKey: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    value: string;
  }) => void;

  /**
   * Callback when user clicks skip
   * Should send: { onboardingAnswer: 'skip', onboardingQuestionKey: key, sessionId }
   */
  onSkip: (payload: {
    sessionId: string;
    questionKey: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  }) => void;
}

/**
 * Confidence bar: Simple visual indicator of how well Scout understands user intent
 */
function ConfidenceBar({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
      <div className="flex gap-0.5">
        {Array.from({ length: filled }).map((_, i) => (
          <div
            key={`filled-${i}`}
            className="h-1.5 w-2 rounded-full bg-blue-500"
          />
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="h-1.5 w-2 rounded-full bg-gray-300"
          />
        ))}
      </div>
      <span>{percent}%</span>
    </div>
  );
}

/**
 * Main component: Renders onboarding question or nothing (if no active question)
 */
export function OnboardingPrompt(props: OnboardingPromptProps) {
  const { onboarding, mode = 'card', onAnswer, onSkip } = props;
  const { sessionId, onboardingQuestion, snapshot } = onboarding;

  // If no question, don't render (onboarding expired or between questions)
  if (!onboardingQuestion) {
    return null;
  }

  const { key, question, options, skipLabel, explanation } = onboardingQuestion;
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectAnswer = (value: string) => {
    setSelectedValue(value);
    setIsSubmitting(true);

    // Fire onAnswer callback (parent will send to Scout)
    onAnswer({
      sessionId,
      questionKey: key,
      value,
    });

    // Reset state for next question
    setTimeout(() => {
      setIsSubmitting(false);
      setSelectedValue(null);
    }, 100);
  };

  const handleSkip = () => {
    setIsSubmitting(true);

    // Fire onSkip callback (parent will send to Scout)
    onSkip({
      sessionId,
      questionKey: key,
    });

    // Reset state for next question
    setTimeout(() => {
      setIsSubmitting(false);
      setSelectedValue(null);
    }, 100);
  };

  // Mode-specific wrapper
  const containerClass =
    mode === 'modal'
      ? 'fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4'
      : mode === 'card'
      ? 'mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
      : 'mt-4 space-y-3';

  const innerClass =
    mode === 'modal'
      ? 'w-full max-w-md rounded-lg bg-white p-6 shadow-lg'
      : '';

  return (
    <div className={containerClass}>
      <div className={innerClass || ''}>
        {/* Header */}
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-900">{question}</div>
          <div className="mt-1 text-xs text-gray-600">{explanation}</div>
        </div>

        {/* Options (radio-style) */}
        <div className="space-y-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectAnswer(option.value)}
              className={clsx(
                'w-full rounded-md border px-3 py-2.5 text-left text-sm transition-all',
                selectedValue === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="font-medium text-gray-900">{option.label}</div>
              <div className="mt-0.5 text-xs text-gray-600">{option.why}</div>
            </button>
          ))}
        </div>

        {/* Skip button */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSkip}
          className={clsx(
            'mt-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors',
            isSubmitting && 'opacity-50 cursor-not-allowed'
          )}
        >
          {skipLabel}
        </button>

        {/* Confidence indicator */}
        {snapshot && (
          <ConfidenceBar confidence={snapshot.confidence} />
        )}
      </div>
    </div>
  );
}
