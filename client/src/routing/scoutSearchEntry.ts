export const SCOUT_SEARCH_ENTRY_DRAFT_KEY = "scout:search-entry-draft";

/** Extract only the typed query from a legacy search URL. */
export function scoutSearchEntryDraft(sourceLocation: string): string {
  const query = sourceLocation.split("?", 2)[1]?.split("#", 1)[0] || "";
  const params = new URLSearchParams(query);
  const candidate = [params.get("q"), params.get("query"), params.get("prompt")]
    .find((value) => Boolean(value?.trim()));
  const prompt = String(candidate || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
  return prompt;
}
