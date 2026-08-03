import type { NextFunction, Request, Response } from "express";

const CANONICAL_PUBLIC_PATHS = [
  "/community-feed",
  "/find-local-businesses",
  "/direct-connect",
  "/about",
] as const;

function originalQuery(req: Request) {
  const queryIndex = req.originalUrl.indexOf("?");
  return queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
}

export function publicDiscoveryRouteNormalization(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  const lowerPath = req.path.toLowerCase().replace(/\/+$/, "") || "/";
  const query = originalQuery(req);

  if (lowerPath === "/homescout-listings") {
    return res.redirect(308, `/exchange/real-estate${query}`);
  }

  const canonicalPath = CANONICAL_PUBLIC_PATHS.find((path) => path === lowerPath);
  if (canonicalPath && req.path !== canonicalPath) {
    return res.redirect(308, `${canonicalPath}${query}`);
  }

  return next();
}
