import type { Express, NextFunction, Request, Response } from "express";
import { resolveProfilePublicMediaObjectKey } from "@shared/profilePublicMedia";
import { streamPublicObject, type PublicMediaStreamResult } from "../publicMediaStorage";

type PublicMediaStreamer = (args: {
  req: Request;
  res: Response;
  key: string;
}) => Promise<PublicMediaStreamResult>;

export function registerProfilePublicMediaRoutes(
  app: Express,
  options: { stream?: PublicMediaStreamer } = {}
): void {
  const stream = options.stream || streamPublicObject;
  const handler = async (req: Request, res: Response, next: NextFunction) => {
    const key = resolveProfilePublicMediaObjectKey(req.path);
    if (!key) return next();
    try {
      const result = await stream({ req, res, key });
      if (result === "served") return;
    } catch (error) {
      console.error("[profile-public-media] storage read failed", {
        path: req.path,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
    if (!res.headersSent) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).send("Public media is temporarily unavailable");
    }
  };

  app.head("/images/*", handler);
  app.get("/images/*", handler);
}
