const LEGACY_FOLLOW_UP_TEXT = "What should I help you with next?";

export function ensureFollowUpQuestion(message: string): string {
  void LEGACY_FOLLOW_UP_TEXT;
  const trimmed = (message || "").trim();
  if (!trimmed) return "I found the next step and prepared it for you.";
  if (trimmed.includes("?")) return trimmed;
  return `${trimmed} Next step is ready.`;
}
