import React from "react";

interface ScoutSuggestionsProps {
  hasUserMessages: boolean;
  autoPromptSuggestions: string[];
  heroLocationLabel: string;
  heroAudienceLabel: string | null;
  onPromptClick: (prompt: string) => void;
}

function sortPromptsByLength(prompts: string[]): string[] {
  return [...prompts].sort((a, b) => a.length - b.length);
}

export function ScoutSuggestions({
  hasUserMessages,
  autoPromptSuggestions,
  heroLocationLabel,
  heroAudienceLabel,
  onPromptClick,
}: ScoutSuggestionsProps) {
  if (hasUserMessages) return null;

  const fallbacks: string[] = [
    heroLocationLabel && heroLocationLabel !== "your area"
      ? `Who is available this week in ${heroLocationLabel}?`
      : "Who is available this week near me?",
    "Show contractors neighbors are actually using",
    heroLocationLabel && heroLocationLabel !== "your area"
      ? `What are people working on around ${heroLocationLabel} right now?`
      : "What are people near me working on right now?",
  ];

  const prompts = sortPromptsByLength(
    autoPromptSuggestions.length ? autoPromptSuggestions.slice(0, 3) : fallbacks
  );

  return (
    <div className="mx-auto w-full max-w-md text-left space-y-1.5">
      <p className="text-[11px] text-slate-500">Try asking:</p>
      <div className="space-y-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="w-full text-left text-[12px] px-1.5 py-1 text-slate-300 hover:text-white hover:bg-slate-900/60 rounded-md transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
