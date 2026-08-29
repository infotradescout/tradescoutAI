import type { Request } from "express";

export const DIRECT_CONNECT_ANONYMOUS_SESSION_COOKIE = "ts_dc_session";

function readCookieValue(req: Request, name: string): string {
  const raw = String((req.headers as any)?.cookie || "");
  if (!raw) return "";
  const parts = raw.split(";").map((part) => part.trim());
  const hit = parts.find((part) => part.startsWith(`${name}=`));
  if (!hit) return "";
  const value = hit.slice(name.length + 1).trim();
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Resolves an existing anonymous session identifier already supplied by the
 * browser. It never derives identity from IP address, user-agent, screen
 * dimensions, or any other fingerprinting signal.
 */
export function resolveAnonymousSessionId(req: Request): string {
  const fromHeader = String(req.headers["x-anonymous-session-id"] || "").trim();
  if (fromHeader) return fromHeader;
  const fromQuery = String((req.query as any)?.anonymousSessionId || "").trim();
  if (fromQuery) return fromQuery;
  const cookieCandidates = [
    DIRECT_CONNECT_ANONYMOUS_SESSION_COOKIE,
    "anonymousSessionId",
    "anonSessionId",
    "sessionId",
    "ts_session_id",
  ];
  for (const name of cookieCandidates) {
    const value = readCookieValue(req, name);
    if (value) return value;
  }
  return "";
}
