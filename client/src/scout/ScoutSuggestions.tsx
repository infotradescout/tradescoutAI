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

function toResultPrompt(p: string): string {
  const s = p.trim();
  // Common transforms from question to result-focused commands
  if (/^how\s+do\s+i\s+/i.test(s)) return s.replace(/^how\s+do\s+i\s+/i, "Show me ");
  if (/^what\s+are\s+/i.test(s)) return s.replace(/^what\s+are\s+/i, "Show ");
  if (/^who\s+is\s+/i.test(s)) return s.replace(/^who\s+is\s+/i, "Show ");
  if (/^can\s+you\s+/i.test(s)) return s.replace(/^can\s+you\s+/i, "Show ");
  // Default to imperative if not question-like
  return s;
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
      ? `Show the top 3 contractors working in ${heroLocationLabel} this week`
      : "Show the top 3 contractors near me this week",
    "Show contractors my neighbors actually hire",
    heroLocationLabel && heroLocationLabel !== "your area"
      ? `Show what people around ${heroLocationLabel} are working on right now`
      : "Show what people near me are working on right now",
  ];

  const rawPrompts = autoPromptSuggestions.length ? autoPromptSuggestions.slice(0, 2) : fallbacks.slice(0, 2);
  const prompts = sortPromptsByLength(rawPrompts.map(toResultPrompt)).slice(0, 2);

  return (
    <div className="mx-auto w-full max-w-md text-left space-y-2">
      <p className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>Try these:</p>
      <div className="space-y-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="scout-suggestion w-full text-left text-[15px] px-3 py-2 rounded-md"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
