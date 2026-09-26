import { useSyncExternalStore } from "react";
import {
  JW_STONE_FEATURES_PATH, parseJwStoneFeatureManifest, unavailableJwStoneFeatures,
} from "@shared/jwStoneFeaturePolicy";
const unavailable = unavailableJwStoneFeatures();
let snapshot = unavailable;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let controller: AbortController | undefined;
function publish(next: typeof snapshot) { snapshot = next; for (const listener of listeners) listener(); }
async function refresh() {
  if (controller) return;
  const request = new AbortController(); controller = request;
  const deadline = setTimeout(() => request.abort(), 10_000);
  try {
    const response = await fetch(JW_STONE_FEATURES_PATH, { cache: "no-store", credentials: "same-origin", signal: request.signal });
    if (!response.ok) throw new Error("Feature state unavailable");
    const state = parseJwStoneFeatureManifest(await response.json());
    if (controller === request) publish(state);
  } catch { if (controller === request) publish(unavailable); }
  finally { clearTimeout(deadline); if (controller === request) controller = undefined; }
}
function onFocus() { void refresh(); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    // No persistent or inherited grant; an old tab must ask the server again.
    snapshot = unavailable;
    void refresh();
    timer = setInterval(onFocus, 15_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer); controller?.abort(); controller = undefined; snapshot = unavailable;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    }
  };
}
/** Availability is not membership, employee authority, payment authority, or access to data. */
export function useJwStoneFeatures() {
  return useSyncExternalStore(subscribe, () => snapshot, () => unavailable);
}
