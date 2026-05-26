import type { NextFunction, Request, Response } from "express";

export function resolveBuildRevision(): string {
  return (
    process.env.RENDER_GIT_COMMIT ||
    process.env.BUILD_COMMIT ||
    process.env.SOURCE_VERSION ||
    process.env.GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_REF ||
    "unknown"
  );
}

export function buildIdentityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  const buildRevision = resolveBuildRevision();
  res.setHeader("x-tradescout-build", buildRevision);
  res.setHeader("X-TradeScout-Build", buildRevision);
  next();
}
