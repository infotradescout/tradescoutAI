import type { Request } from "express";

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
 * Resolves the existing anonymous session identifier (header, query, or
 * cookie) already used for Direct Connect rate limiting. Never derives an
 * identifier from IP/user-agent -- guests without this token are simply
 * unidentified, not fingerprinted.
 */
export function resolveAnonymousSessionId(req: Request): string {
  const fromHeader = String(req.headers["x-anonymous-session-id"] || "").trim();
  if (fromHeader) return fromHeader;
  const fromQuery = String((req.query as any)?.anonymousSessionId || "").trim();
  if (fromQuery) return fromQuery;
  const cookieCandidates = ["anonymousSessionId", "anonSessionId", "sessionId", "ts_session_id"];
  for (const name of cookieCandidates) {
    const value = readCookieValue(req, name);
    if (value) return value;
  }
  return "";
}
