import type { Express, NextFunction, Request, Response } from "express";
import { resolveJwStonePublicMediaObjectKey } from "@shared/jwStonePublicMedia";
import { streamPublicObject, type PublicMediaStreamResult } from "../publicMediaStorage";

const JW_STONE_PUBLIC_MEDIA_ROUTE = "/images/businesses/jw-stone/*";

type PublicMediaStreamer = (args: {
  req: Request;
  res: Response;
  key: string;
}) => Promise<PublicMediaStreamResult>;

export function registerJwStonePublicMediaRoutes(
  app: Express,
  options: { stream?: PublicMediaStreamer } = {}
): void {
  const stream = options.stream || streamPublicObject;
  const handler = async (req: Request, res: Response, next: NextFunction) => {
    const key = resolveJwStonePublicMediaObjectKey(req.path);
    if (!key) return next();

    const result = await stream({ req, res, key });
    if (result === "served") return;
    if (result === "not_found" || result === "unconfigured") return next();
    if (!res.headersSent) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).send("Public media is temporarily unavailable");
    }
  };

  // Register HEAD first so Express does not fall through to its implicit GET handling.
  app.head(JW_STONE_PUBLIC_MEDIA_ROUTE, handler);
  app.get(JW_STONE_PUBLIC_MEDIA_ROUTE, handler);
}
