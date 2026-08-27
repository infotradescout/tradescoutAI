import type { Express, NextFunction, Request, Response } from "express";
import { resolveJwStonePublicMediaObjectKey } from "@shared/jwStonePublicMedia";
import {
  getCatalogItemById,
  getNamedCatalogItemByShareSlug,
} from "../../client/src/features/jw-stone/catalog";
import {
  isStoneDesignerPhotoKey,
  resolveStoneDesignerPhotoIndex,
} from "../../client/src/pages/profile-sites/steel-home-project-tools/stoneDesignerImages";
import { streamPublicObject, type PublicMediaStreamResult } from "../publicMediaStorage";

const LEGACY_INDEX_ROUTE = "/images/stone-designer/:stoneId/:imageNumber.webp";
const NAMED_PHOTO_ROUTE = "/images/stone-designer/named/:stoneShareSlug/:photoKey.webp";

type PublicMediaStreamer = (args: {
  req: Request;
  res: Response;
  key: string;
  cacheControl?: string;
}) => Promise<PublicMediaStreamResult>;

async function serveCatalogImage(
  req: Request,
  res: Response,
  next: NextFunction,
  imageHref: string,
  cacheControl: string,
  stream: PublicMediaStreamer
): Promise<void> {
  const key = resolveJwStonePublicMediaObjectKey(imageHref);
  if (!key) return next();
  const result = await stream({ req, res, key, cacheControl });
  if (result === "served") return;
  if (result === "not_found" || result === "unconfigured") return next();
  if (!res.headersSent) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).send("Stone image is temporarily unavailable");
  }
}

/**
 * Serves an exact named catalog photo through the vendor-neutral URL used by
 * the TradeScout stone designer. Anonymous arrivals are intentionally denied.
 */
export function registerStoneDesignerImageRoutes(
  app: Express,
  options: { stream?: PublicMediaStreamer } = {}
): void {
  const stream = options.stream || streamPublicObject;
  const namedHandler = async (req: Request, res: Response, next: NextFunction) => {
    const stoneShareSlug = String(req.params.stoneShareSlug || "").trim();
    const photoKey = String(req.params.photoKey || "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stoneShareSlug) || !isStoneDesignerPhotoKey(photoKey)) {
      return next();
    }

    const stone = getNamedCatalogItemByShareSlug(stoneShareSlug);
    if (!stone) return next();
    const imageIndex = resolveStoneDesignerPhotoIndex(stone.images, photoKey);
    if (imageIndex < 0) return next();
    const imageHref = stone.images[imageIndex];
    if (!imageHref) return next();
    return serveCatalogImage(
      req,
      res,
      next,
      imageHref,
      "public, max-age=31536000, immutable",
      stream
    );
  };

  const legacyHandler = async (req: Request, res: Response, next: NextFunction) => {
    const stoneId = String(req.params.stoneId || "").trim();
    const imageNumber = Number(req.params.imageNumber);
    if (!/^[a-z0-9-]+$/.test(stoneId) || !Number.isInteger(imageNumber) || imageNumber < 1) {
      return next();
    }

    const stone = getCatalogItemById(stoneId);
    if (!stone || stone.anonymous) return next();

    const imageHref = stone.images[imageNumber - 1];
    if (!imageHref) return next();
    return serveCatalogImage(
      req,
      res,
      next,
      imageHref,
      "public, max-age=86400, stale-while-revalidate=604800",
      stream
    );
  };

  app.head(NAMED_PHOTO_ROUTE, namedHandler);
  app.get(NAMED_PHOTO_ROUTE, namedHandler);
  app.head(LEGACY_INDEX_ROUTE, legacyHandler);
  app.get(LEGACY_INDEX_ROUTE, legacyHandler);
}
