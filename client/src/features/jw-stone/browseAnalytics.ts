import type { JwStoneCatalogItem } from "./types";

export type JwStoneBrowseAction = "open" | "save" | "unsave" | "request";
export type JwStoneBrowseMode = "browse" | "search";

export type JwStoneBrowseEventInput = Readonly<{
  action: JwStoneBrowseAction;
  stone: Pick<JwStoneCatalogItem, "id" | "shareSlug">;
  surface: "full_inventory" | "color_results" | "material_results" | "mood_results";
  resultPosition: number;
  mode: JwStoneBrowseMode;
  activeFilterCount: number;
}>;

export function buildJwStoneBrowseEvent(input: JwStoneBrowseEventInput) {
  const width = typeof window === "undefined" ? 1024 : window.innerWidth;
  return {
    type: "jw_stone_browse_action",
    profileSlug: "jw-stone",
    action: input.action,
    surface: input.surface,
    stoneId: input.stone.id,
    stoneSlug: input.stone.shareSlug || input.stone.id,
    resultPosition: Math.max(1, Math.trunc(input.resultPosition)),
    mode: input.mode,
    activeFilterCount: Math.max(0, Math.trunc(input.activeFilterCount)),
    deviceType: width < 768 ? "mobile" : "desktop",
    ts: new Date().toISOString(),
  } as const;
}

/** Best-effort only. Telemetry must never delay opening, saving, or requesting a stone. */
export function trackJwStoneBrowseAction(input: JwStoneBrowseEventInput): void {
  if (typeof window === "undefined") return;

  try {
    const body = JSON.stringify(buildJwStoneBrowseEvent(input));
    if (typeof navigator.sendBeacon === "function") {
      const accepted = navigator.sendBeacon(
        "/api/analytics/shell",
        new Blob([body], { type: "application/json" })
      );
      if (accepted) return;
    }

    void fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => undefined);
  } catch {
    // Never block a customer action because measurement failed.
  }
}
