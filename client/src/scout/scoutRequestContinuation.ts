import { buildScoutRequestContinuationPrompt, SCOUT_REQUEST_ID_PATTERN } from "@shared/scoutRequestContext";

/** Fresh read on each deliberate selection. Never submit the stored action again. */
export async function loadScoutRequestContinuation(
  requestId: string,
  ownerId: string,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}
): Promise<string> {
  if (!SCOUT_REQUEST_ID_PATTERN.test(requestId) || !ownerId.trim()) {
    throw new Error("Choose a saved request to continue.");
  }
  const response = await (options.fetcher || fetch)(`/api/scout/work/requests/${encodeURIComponent(requestId)}`, {
    method: "GET", credentials: "include", cache: "no-store", signal: options.signal,
  });
  if (!response.ok) throw new Error("This request could not be loaded. Refresh your work and try again.");
  return buildScoutRequestContinuationPrompt(await response.json(), ownerId, requestId);
}
