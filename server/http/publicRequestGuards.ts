import type { NextFunction, Request, Response } from "express";

const CORS_DENIAL_PREFIX = "CORS: Origin not allowed:";

export function isCorsOriginDeniedError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(CORS_DENIAL_PREFIX);
}

export function handleCorsOriginDeniedError(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (!isCorsOriginDeniedError(error)) return next(error);
  return res.status(403).json({ error: "Origin not allowed", code: "CORS_ORIGIN_DENIED" });
}

export function isUnsupportedCmsProbeRequest(req: {
  path?: string;
  query?: Record<string, unknown>;
}): boolean {
  const requestPath = String(req.path || "").trim().toLowerCase();
  if (
    requestPath === "/wp-json" ||
    requestPath.startsWith("/wp-json/") ||
    requestPath === "/wordpress/wp-json" ||
    requestPath.startsWith("/wordpress/wp-json/") ||
    requestPath === "/blog/wp-json" ||
    requestPath.startsWith("/blog/wp-json/")
  ) {
    return true;
  }

  if (requestPath !== "/" && requestPath !== "/index.php") return false;
  const restRouteValue = req.query?.rest_route;
  const restRoute = Array.isArray(restRouteValue) ? restRouteValue[0] : restRouteValue;
  return typeof restRoute === "string" && restRoute.trim().startsWith("/");
}

export function rejectUnsupportedCmsProbe(req: Request, res: Response, next: NextFunction) {
  if (!isUnsupportedCmsProbeRequest(req)) return next();
  res.setHeader("Cache-Control", "no-store");
  return res.status(404).end();
}
