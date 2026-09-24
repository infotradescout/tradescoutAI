import type { ScoutMessage } from "./state";

// A Scout result can open a full-page detail before the normal saved-task timer
// runs. Keep that exact result only in this tab's live app memory for the trip
// back; returning does not create a saved task or send anything to the server.
const RETURN_WINDOW_MS = 15 * 60 * 1000;

type ScoutReturnSnapshot = {
  owner: string;
  expiresAt: number;
  messages: ScoutMessage[];
  activeSavedThreadId: string | null;
};

let pendingReturn: ScoutReturnSnapshot | null = null;

export function rememberScoutForReturn(
  owner: string | null,
  messages: ScoutMessage[],
  activeSavedThreadId: string | null,
  now = Date.now()
): boolean {
  if (!owner || !messages.some((message) => message.role === "user" && message.content.trim())) {
    return false;
  }
  pendingReturn = {
    owner,
    expiresAt: now + RETURN_WINDOW_MS,
    messages: messages.slice(),
    activeSavedThreadId,
  };
  return true;
}

export function takeScoutReturnSnapshot(
  owner: string | null,
  now = Date.now()
): Pick<ScoutReturnSnapshot, "messages" | "activeSavedThreadId"> | null {
  const snapshot = pendingReturn;
  pendingReturn = null;
  if (!snapshot || !owner || snapshot.owner !== owner || now > snapshot.expiresAt) {
    return null;
  }
  return {
    messages: snapshot.messages,
    activeSavedThreadId: snapshot.activeSavedThreadId,
  };
}

export function clearScoutReturnSnapshot(): void {
  pendingReturn = null;
}
