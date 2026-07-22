import type { Request } from "express";

export const CANONICAL_WEB_HOST = "www.thetradescout.com";

function firstHeaderValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] || "" : value || "")
    .split(",")[0]
    .trim();
}

function getForwardedProto(req: Pick<Request, "headers" | "protocol">): string {
  return firstHeaderValue(
    req.headers["x-forwarded-proto"] as string | string[] | undefined
  ).toLowerCase();
}

/**
 * Resolve the origin used by platform-owned public pages.
 *
 * Forwarded host metadata is intentionally ignored: a client-controlled
 * X-Forwarded-Host must never rewrite canonical, Open Graph, or JSON-LD URLs.
 * Profile custom-domain rendering resolves its database-mapped host separately.
 */
export function resolvePublicOrigin(req: Pick<Request, "headers" | "protocol">): string {
  const host = firstHeaderValue(req.headers.host).toLowerCase();
  const hostOnly = host.split(":")[0];
  const isLocal = hostOnly === "localhost" || hostOnly === "127.0.0.1";

  if (isLocal) {
    const proto = getForwardedProto(req) || req.protocol || "http";
    return `${proto}://${host}`;
  }

  // Every non-local platform page has one canonical origin. Mapped custom
  // profile domains use their validated database host in renderProfileOnCustomDomain.
  return `https://${CANONICAL_WEB_HOST}`;
}
