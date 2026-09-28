import type { ScoutMessage } from "./state";

// A Scout result can open a full-page detail before the normal saved-task timer
// runs. Keep that exact result only in this tab's live app memory for the trip
// back; returning does not create a saved task or send anything to the server.
const RETURN_WINDOW_MS = 15 * 60 * 1000;

type ScoutReturnSnapshot = {
  owner: string;
  sourceLocation: string;
  destinationPath: string | null;
  returnedByHistory: boolean;
  expiresAt: number;
  messages: ScoutMessage[];
  activeSavedThreadId: string | null;
};

let pendingReturn: ScoutReturnSnapshot | null = null;

function markScoutHistoryReturn(): void {
  if (!pendingReturn || typeof window === "undefined") return;
  const currentLocation = `${window.location.pathname}${window.location.search}`;
  if (currentLocation === pendingReturn.sourceLocation) {
    pendingReturn.returnedByHistory = true;
  }
}

function stopWatchingHistoryReturn(): void {
  if (typeof window !== "undefined") {
    window.removeEventListener("popstate", markScoutHistoryReturn);
  }
}

export function rememberScoutForReturn(
  owner: string | null,
  messages: ScoutMessage[],
  activeSavedThreadId: string | null,
  sourceLocation: string,
  now = Date.now(),
  destinationPath: string | null = null
): boolean {
  if (
    !owner ||
    !(sourceLocation === "/scout" || sourceLocation.startsWith("/scout?")) ||
    !messages.some((message) => message.role === "user" && message.content.trim())
  ) {
    return false;
  }
  stopWatchingHistoryReturn();
  pendingReturn = {
    owner,
    sourceLocation,
    destinationPath,
    returnedByHistory: false,
    expiresAt: now + RETURN_WINDOW_MS,
    messages: messages.slice(),
    activeSavedThreadId,
  };
  if (typeof window !== "undefined") {
    window.addEventListener("popstate", markScoutHistoryReturn);
  }
  return true;
}

export function hasPendingScoutResultReturnForPath(path: string, now = Date.now()): boolean {
  return Boolean(
    pendingReturn &&
    pendingReturn.destinationPath === path &&
    now <= pendingReturn.expiresAt
  );
}

export function clearScoutReturnForNewLaunch(
  currentLocation: string,
  explicitLaunch: boolean
): void {
  if (
    explicitLaunch &&
    (pendingReturn?.sourceLocation !== currentLocation || !pendingReturn.returnedByHistory)
  ) {
    clearScoutReturnSnapshot();
  }
}

export function takeScoutReturnSnapshot(
  owner: string | null,
  now = Date.now()
): Pick<ScoutReturnSnapshot, "messages" | "activeSavedThreadId"> | null {
  const snapshot = pendingReturn;
  clearScoutReturnSnapshot();
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
  stopWatchingHistoryReturn();
}
