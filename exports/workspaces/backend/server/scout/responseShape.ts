const LEGACY_FOLLOW_UP_TEXT = "What should I help you with next?";

export function ensureFollowUpQuestion(message: string): string {
  void LEGACY_FOLLOW_UP_TEXT;
  const trimmed = (message || "").trim();
  if (!trimmed)
    return "I can still move this forward with a direct next step. Want me to run that now?";
  if (trimmed.includes("?")) return trimmed;
  return `${trimmed} Want me to run that now?`;
}
