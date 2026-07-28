import type { Express, Request, Response } from "express";
import { buildPublicProfileSocialPreview } from "../publicProfileSocialPreview";
import { buildSignedSocialPreview } from "../signedSocialPreview";
import { buildWorkRequestSocialPreview } from "../workRequestShareHtml";
import { resolvePublicOrigin } from "../utils/publicOrigin";

type PreviewRouteKind = "profile" | "inventory" | "gallery";
type PreviewImageState = {
  sourceImageRequested: boolean;
  sourceImageLoaded: boolean;
};

function sendMissing(res: Response): Response {
  res.setHeader("Cache-Control", "no-store");
  return res.status(404).send("Preview not found");
}

function normalizedInventoryPhoto(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (Array.isArray(value) || typeof value !== "string" || !/^[1-9]\d{0,2}$/.test(value)) {
    return null;
  }
  const photo = Number.parseInt(value, 10);
  return photo <= 100 ? String(photo) : null;
}

function sendPreviewPng(
  req: Request,
  res: Response,
  preview: { png: Buffer; etag: string },
  cacheControl: string
): Response | void {
  if (req.headers["if-none-match"] === preview.etag) {
    res.status(304);
    res.setHeader("ETag", preview.etag);
    res.setHeader("Cache-Control", cacheControl);
    return res.end();
  }

  res.status(200);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", String(preview.png.length));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("ETag", preview.etag);
  res.setHeader("Cache-Control", cacheControl);
  return res.send(preview.png);
}

function previewCacheControl(preview: PreviewImageState, stableCacheControl: string): string {
  return preview.sourceImageRequested && !preview.sourceImageLoaded
    ? "public, max-age=300, must-revalidate"
    : stableCacheControl;
}

function signedPreviewCacheControl(preview: { expiresAt: number }): string {
  const remainingSeconds = preview.expiresAt - Math.floor(Date.now() / 1_000);
  if (remainingSeconds <= 0) return "no-store";
  return `public, max-age=${Math.min(60, remainingSeconds)}, must-revalidate`;
}

function registerPreviewRoute(app: Express, route: string, kind: PreviewRouteKind): void {
  app.get(route, async (req: Request, res: Response) => {
    try {
      const photo = kind === "inventory" ? normalizedInventoryPhoto(req.query.photo) : undefined;
      if (photo === null) return sendMissing(res);

      const preview = await buildPublicProfileSocialPreview({
        profileSlug: String(req.params.profileSlug || ""),
        itemType: kind === "profile" ? null : kind,
        itemSlug: kind === "profile" ? undefined : req.params.itemSlug,
        photo,
        pageOrigin: resolvePublicOrigin(req),
      });
      if (!preview) return sendMissing(res);

      return sendPreviewPng(
        req,
        res,
        preview,
        previewCacheControl(preview, "public, max-age=300, must-revalidate")
      );
    } catch (error) {
      console.error("[SocialPreview] Failed to render public profile preview:", error);
      res.setHeader("Cache-Control", "no-store");
      return res.redirect(302, "/tradescout-social-preview.png?v=12");
    }
  });
}

export function registerPublicProfileSocialPreviewRoutes(app: Express): void {
  app.get("/images/social/card/:token.png", async (req: Request, res: Response) => {
    try {
      const preview = await buildSignedSocialPreview(req.params.token);
      if (!preview) return sendMissing(res);
      return sendPreviewPng(
        req,
        res,
        preview,
        signedPreviewCacheControl(preview)
      );
    } catch (error) {
      console.error("[SocialPreview] Failed to render signed public preview:", error);
      res.setHeader("Cache-Control", "no-store");
      return res.redirect(302, "/tradescout-social-preview.png?v=12");
    }
  });
  app.get("/images/social/request/:shareToken.png", async (req: Request, res: Response) => {
    try {
      const shareToken = String(req.params.shareToken || "");
      if (!/^[a-f0-9]{32}$/i.test(shareToken)) return sendMissing(res);
      const preview = await buildWorkRequestSocialPreview({
        shareToken,
        origin: resolvePublicOrigin(req),
      });
      if (!preview) return sendMissing(res);
      return sendPreviewPng(
        req,
        res,
        preview,
        "no-store"
      );
    } catch (error) {
      console.error("[SocialPreview] Failed to render shared request preview:", error);
      return sendMissing(res);
    }
  });
  registerPreviewRoute(
    app,
    "/images/social/profile/:profileSlug/inventory/:itemSlug.png",
    "inventory"
  );
  registerPreviewRoute(app, "/images/social/profile/:profileSlug/gallery/:itemSlug.png", "gallery");
  registerPreviewRoute(app, "/images/social/profile/:profileSlug.png", "profile");
}
