export function formatContextTag(input: unknown): string {
  const cleaned = String(input ?? "")
    .trim()
    .replace(/^#+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  // If it's all lowercase, Title Case it for scanability in feeds.
  const shouldTitleCase = cleaned === cleaned.toLowerCase();
  if (!shouldTitleCase) return cleaned;

  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}
