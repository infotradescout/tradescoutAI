import fs from "node:fs";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import {
  getCatalogItemById,
  getNamedCatalogItemByShareSlug,
} from "../../client/src/features/jw-stone/catalog";
import {
  isStoneDesignerPhotoKey,
  resolveStoneDesignerPhotoIndex,
} from "../../client/src/pages/profile-sites/steel-home-project-tools/stoneDesignerImages";

const LEGACY_INDEX_ROUTE = "/images/stone-designer/:stoneId/:imageNumber.webp";
const NAMED_PHOTO_ROUTE = "/images/stone-designer/named/:stoneShareSlug/:photoKey.webp";

function resolvePublicImageFile(imageHref: string): string | null {
  const relativePath = imageHref.replace(/^\/+/, "");
  if (!relativePath.startsWith("images/") || relativePath.includes("..")) return null;

  const publicRoots = [
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(process.cwd(), "client/public"),
  ];
  for (const root of publicRoots) {
    const candidate = path.resolve(root, relativePath);
    if (!candidate.startsWith(`${root}${path.sep}`)) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Serves an exact named catalog photo through the vendor-neutral URL used by
 * the TradeScout stone designer. Anonymous arrivals are intentionally denied.
 */
export function registerStoneDesignerImageRoutes(app: Express): void {
  app.get(NAMED_PHOTO_ROUTE, (req: Request, res: Response, next: NextFunction) => {
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
    const imageFile = imageHref ? resolvePublicImageFile(imageHref) : null;
    if (!imageFile) return next();

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(imageFile);
  });

  app.get(LEGACY_INDEX_ROUTE, (req: Request, res: Response, next: NextFunction) => {
    const stoneId = String(req.params.stoneId || "").trim();
    const imageNumber = Number(req.params.imageNumber);
    if (!/^[a-z0-9-]+$/.test(stoneId) || !Number.isInteger(imageNumber) || imageNumber < 1) {
      return next();
    }

    const stone = getCatalogItemById(stoneId);
    if (!stone || stone.anonymous) return next();

    const imageHref = stone.images[imageNumber - 1];
    if (!imageHref) return next();
    const imageFile = resolvePublicImageFile(imageHref);
    if (!imageFile) return next();

    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(imageFile);
  });
}
