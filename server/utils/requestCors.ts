import type { Request } from "express";

function firstHeaderValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "")
    .split(",")[0]
    .trim();
}

export function normalizeHttpOrigin(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.pathname !== "/") return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function resolveRequestHttpOrigin(req: Request): string | null {
  // Host is the authority received by this application. X-Forwarded-Host is
  // intentionally ignored here because it is proxy metadata and may be
  // attacker-controlled on misconfigured edges.
  const host = firstHeaderValue(req.headers.host);
  const protocol =
    firstHeaderValue(req.headers["x-forwarded-proto"]) || String(req.protocol || "").trim();
  if (!host || (protocol !== "http" && protocol !== "https")) return null;
  if (/[/\\\s]/.test(host)) return null;
  return normalizeHttpOrigin(`${protocol}://${host}`);
}

export function isSameRequestHttpOrigin(req: Request, origin: unknown): boolean {
  const normalizedOrigin = normalizeHttpOrigin(origin);
  const requestOrigin = resolveRequestHttpOrigin(req);
  return Boolean(normalizedOrigin && requestOrigin && normalizedOrigin === requestOrigin);
}
