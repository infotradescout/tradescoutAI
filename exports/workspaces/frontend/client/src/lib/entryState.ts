const LANDING_SEEN_KEY = "tradescout.hasSeenLanding";

export function hasSeenLanding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LANDING_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markLandingSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANDING_SEEN_KEY, "true");
  } catch {
    // ignore storage failures; this is UX state, not security state
  }
}
