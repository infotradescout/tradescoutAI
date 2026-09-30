/** Only same-origin page destinations may survive auth and onboarding handoffs. */
export function isSafeNextPath(path: string): boolean {
  if (!path || path.length > 2_048 || !path.startsWith("/") || path.startsWith("//")) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return false;

  let parsed: URL;
  try {
    parsed = new URL(path, "https://tradescout.internal");
  } catch {
    return false;
  }
  if (parsed.origin !== "https://tradescout.internal") return false;

  let decodedPathname = parsed.pathname;
  try {
    decodedPathname = decodeURIComponent(decodeURIComponent(decodedPathname));
  } catch {
    return false;
  }
  if (
    decodedPathname.startsWith("//") ||
    decodedPathname.includes("\\") ||
    /[?#]/.test(decodedPathname) ||
    /[\u0000-\u001f\u007f]/.test(decodedPathname) ||
    /^\/(?:https?:|javascript:|data:|file:)/i.test(decodedPathname)
  ) {
    return false;
  }

  let canonicalPathname: string;
  try {
    const canonical = new URL(decodedPathname, "https://tradescout.internal");
    if (canonical.origin !== "https://tradescout.internal") return false;
    canonicalPathname = canonical.pathname;
  } catch {
    return false;
  }

  const normalizedPath = canonicalPathname.replace(/\/+$/, "") || "/";
  const normalizedLower = normalizedPath.toLocaleLowerCase();
  const isNonPageNamespace =
    normalizedLower.startsWith("/_") ||
    ["/api", "/.well-known", "/assets", "/static", "/src", "/node_modules"].some(
      (prefix) => normalizedLower === prefix || normalizedLower.startsWith(`${prefix}/`)
    );
  if (isNonPageNamespace) return false;
  const createsAuthLoop = [
    "/pre-scout-setup",
    "/login",
    "/register",
    "/signup",
    "/create-account",
    "/verify-email",
    "/check-email",
    "/reset-password",
    "/onboarding",
    "/profile-setup",
    "/logout",
    "/auth",
    "/signin",
    "/sign-in",
  ].some((prefix) => normalizedLower === prefix || normalizedLower.startsWith(`${prefix}/`));
  return !createsAuthLoop;
}
