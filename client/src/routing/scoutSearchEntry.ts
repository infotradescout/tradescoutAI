export const SCOUT_SEARCH_ENTRY_DRAFT_KEY = "scout:search-entry-draft";

type SearchEntryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function normalizeDraft(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

/** Extract only the typed query from a legacy search URL. */
export function scoutSearchEntryDraft(sourceLocation: string): string {
  const query = sourceLocation.split("?", 2)[1]?.split("#", 1)[0] || "";
  const params = new URLSearchParams(query);
  const candidate = [params.get("q"), params.get("query"), params.get("prompt")]
    .find((value) => Boolean(value?.trim()));
  return normalizeDraft(String(candidate || ""));
}

/** The one-use alias query belongs to the account that opened the search route. */
export function writeScoutSearchEntryDraft(
  prompt: string,
  owner: string | null,
  storage: SearchEntryStorage
): boolean {
  storage.removeItem(SCOUT_SEARCH_ENTRY_DRAFT_KEY);
  const normalized = normalizeDraft(prompt);
  if (!normalized || !owner) return false;
  storage.setItem(SCOUT_SEARCH_ENTRY_DRAFT_KEY, JSON.stringify({ owner, prompt: normalized }));
  return true;
}

/** Consume once, including when the account changed or the payload is malformed. */
export function takeScoutSearchEntryDraft(owner: string, storage: SearchEntryStorage): string {
  const raw = storage.getItem(SCOUT_SEARCH_ENTRY_DRAFT_KEY);
  storage.removeItem(SCOUT_SEARCH_ENTRY_DRAFT_KEY);
  if (!raw) return "";
  try {
    const payload = JSON.parse(raw) as { owner?: unknown; prompt?: unknown };
    return payload?.owner === owner && typeof payload.prompt === "string"
      ? normalizeDraft(payload.prompt)
      : "";
  } catch {
    return "";
  }
}
