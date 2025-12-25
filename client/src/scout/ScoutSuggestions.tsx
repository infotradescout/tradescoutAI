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

  const curated: string[] = [
    "Turn this into a project with tasks and milestones",
    heroLocationLabel && heroLocationLabel !== "your area"
      ? `Draft a quote request for a top-rated pro in ${heroLocationLabel}`
      : "Draft a quote request for a top-rated pro near me",
    "Summarize my last note and turn it into a job checklist",
  ];

  const rawPrompts = autoPromptSuggestions.length ? autoPromptSuggestions.slice(0, 3) : curated;
  const prompts = sortPromptsByLength(rawPrompts.map(toResultPrompt)).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-2xl text-left space-y-3">
      <p className="text-[12px] font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>Suggested prompts</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="scout-suggestion text-left text-[14px] px-3 py-2.5 rounded-lg border transition-all hover:border-opacity-100 hover:bg-opacity-80"
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(26,34,48,0.6)',
              color: 'var(--text-primary)',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
