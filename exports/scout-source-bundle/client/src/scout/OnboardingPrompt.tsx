/**
 * OnboardingPrompt
 *
 * Minimal, server-controlled onboarding UI.
 * Renders Q1-Q4 based on server metadata only.
 *
 * Rules:
 * - Server decides everything (question, options, skip)
 * - No client-side state or inference
 * - Disappears cleanly when active === false
 */

import type { OnboardingMetadata } from "./state";

type Props = {
  onboarding: OnboardingMetadata;
  onAnswer: (value: string) => void;
  onSkip: () => void;
  mode?: "inline" | "card" | "modal";
};

export function OnboardingPrompt({ onboarding, onAnswer, onSkip, mode = "card" }: Props) {
  const { question, confidence } = onboarding;

  if (!question) return null;

  return (
    <div className={`onboarding-prompt onboarding-${mode}`}>
      <div className="onboarding-header">
        <div className="onboarding-prompt-text">{question.prompt}</div>
        <div className="onboarding-confidence">Getting to know you - {Math.round(confidence)}%</div>
      </div>

      <div className="onboarding-options">
        {question.options.map((opt) => (
          <button key={opt.value} className="onboarding-option" onClick={() => onAnswer(opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>

      {question.skippable && (
        <button className="onboarding-skip" onClick={onSkip}>
          Skip for now
        </button>
      )}
    </div>
  );
}
