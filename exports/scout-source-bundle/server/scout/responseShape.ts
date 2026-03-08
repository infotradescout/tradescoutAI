export function ensureFollowUpQuestion(message: string): string {
  const trimmed = (message || "").trim();
  if (!trimmed) return "What should I help you with next?";
  if (trimmed.includes("?")) return trimmed;
  return `${trimmed}\n\nWhat should I help you with next?`;
}
