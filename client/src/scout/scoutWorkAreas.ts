import type { ScoutAction } from "./state";

export const SCOUT_WORK_AREA_PREFIXES = [
  "/profile-settings",
  "/settings",
  "/notifications",
  "/utilities/supply-run",
  "/direct-connect",
  "/finances",
  "/messages",
  "/exchange",
  "/community-feed",
  "/community",
  "/homescout-listings",
  "/homescout",
  "/homes",
  "/vehicles",
  "/vehicle-marketplace",
  "/marketplace",
  "/procurement",
] as const;

export function canOpenScoutWorkArea(to: string | null | undefined): boolean {
  const raw = typeof to === "string" ? to.trim() : "";
  if (!raw.startsWith("/")) return false;
  return SCOUT_WORK_AREA_PREFIXES.some((prefix) => raw.startsWith(prefix));
}

export function titleFromScoutWorkAreaUrl(url: string): string {
  if (!url) return "Page";
  const path = url.split("?")[0] || url;
  if (path.startsWith("/profile-settings")) return "Profile & settings";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/notifications")) return "Notifications";
  if (path.startsWith("/utilities/supply-run")) return "Supply Run";
  if (path.startsWith("/direct-connect")) return "Direct Connect";
  if (path.startsWith("/finances")) return "Invoices & payments";
  if (path.startsWith("/messages")) return "Messages";
  if (path.startsWith("/procurement")) return "Supply Run";
  if (path.startsWith("/marketplace") || path.startsWith("/vehicle-marketplace")) {
    return "Marketplace";
  }
  if (path.startsWith("/exchange")) return "Exchange";
  if (path.startsWith("/community-feed") || path.startsWith("/community")) return "Community";
  if (path.startsWith("/homes")) return "Homes";
  if (path.startsWith("/vehicles")) return "Vehicles";
  if (path.startsWith("/homescout-listings") || path.startsWith("/homescout")) {
    return "Exchange Real Estate";
  }
  return "Page";
}

export function resolveScoutWorkAreaAction(
  action: ScoutAction
): { url: string; title?: string } | null {
  if (action.type !== "NAVIGATE") return null;
  const target = action.to ?? action.path;
  if (!canOpenScoutWorkArea(target)) return null;
  return {
    url: String(target),
    title: action.label,
  };
}
