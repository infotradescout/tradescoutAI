export function getCanonicalAppOrigin(): string {
  if (typeof window === "undefined") return "https://www.thetradescout.com";

  const host = window.location.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return window.location.origin;

  // In production, always prefer the canonical www host in user-facing URLs.
  // This avoids copying links from apex (which may be misconfigured) or Render preview domains.
  if (host === "thetradescout.com") return "https://www.thetradescout.com";
  if (host.endsWith(".thetradescout.com")) return "https://www.thetradescout.com";
  if (host.endsWith(".onrender.com")) return "https://www.thetradescout.com";

  return window.location.origin;
}
