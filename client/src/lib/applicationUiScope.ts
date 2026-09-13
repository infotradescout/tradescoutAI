import { isOnboardingSurfacePath } from "./onboardingSurface";

export function getUiPathname(location: string): string {
  return (location.split(/[?#]/, 1)[0] || "/").replace(/\/+$/, "") || "/";
}

function isWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

/** Presentation boundary only; this must never grant access or change routing. */
export function isPublicProfileLikePath(location: string): boolean {
  const path = getUiPathname(location).toLowerCase();
  if (/^\/(?:u|p|business|profile|helpers)\/[^/]+(?:\/|$)/.test(path)) return true;
  if (["/jw-stone", "/issa-build"].some((root) => isWithin(path, root))) return true;
  if (path.startsWith("/contractors/")) {
    return !["/contractors/top", "/contractors/board"].some((root) => isWithin(path, root));
  }
  return false;
}

export function isApplicationUiSurface(location: string, customDomainProfileSlug = ""): boolean {
  if (customDomainProfileSlug.trim() || isPublicProfileLikePath(location)) return false;
  const path = getUiPathname(location).toLowerCase();
  if (isOnboardingSurfacePath(path)) return false;
  return ![
    "/admin", "/login", "/register", "/signup", "/create-account", "/pre-scout-setup",
    "/auth", "/reset-password", "/verify-email", "/check-email", "/landing", "/lp",
    "/r", "/bidrock", "/trade-up-for-trade-schools",
  ].some((root) => isWithin(path, root));
}
