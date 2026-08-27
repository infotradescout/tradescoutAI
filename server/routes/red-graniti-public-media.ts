import type { Express, NextFunction, Request, Response } from "express";
import { resolveRedGranitiPublicMediaObjectKey } from "@shared/redGranitiPublicMedia";
import { streamPublicObject, type PublicMediaStreamResult } from "../publicMediaStorage";

const RED_GRANITI_PUBLIC_MEDIA_ROUTE = "/images/businesses/red-graniti/source/*";

type PublicMediaStreamer = (args: {
  req: Request;
  res: Response;
  key: string;
}) => Promise<PublicMediaStreamResult>;

export function registerRedGranitiPublicMediaRoutes(
  app: Express,
  options: { stream?: PublicMediaStreamer } = {}
): void {
  const stream = options.stream || streamPublicObject;
  const handler = async (req: Request, res: Response, next: NextFunction) => {
    const key = resolveRedGranitiPublicMediaObjectKey(req.path);
    if (!key) return next();

    const result = await stream({ req, res, key });
    if (result === "served") return;
    if (result === "not_found" || result === "unconfigured") return next();
    if (!res.headersSent) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).send("Public media is temporarily unavailable");
    }
  };

  app.head(RED_GRANITI_PUBLIC_MEDIA_ROUTE, handler);
  app.get(RED_GRANITI_PUBLIC_MEDIA_ROUTE, handler);
}
