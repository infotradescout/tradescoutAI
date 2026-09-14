import type { RequestHandler } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRecommendationContinuationPath } from "@shared/recommendationContinuation";
import { storage } from "./storage";
import { renderPublicContractorProfileHtml } from "./publicContractorProfileHtml";
import { resolvePublicOrigin } from "./utils/publicOrigin";

/**
 * The recommendation route owner is registered before the production metadata
 * routes. Keep this precise action on its existing contractor page rather than
 * losing it to the ordinary /business canonical redirect on a full navigation.
 * This serves the same public HTML renderer; it grants no account, publication,
 * contact, or verification permission and contains no saved recommendation text.
 */
export function recommendationContinuationPage(
  readTemplate: () => Promise<string> = () =>
    readFile(path.resolve("dist/public/index.html"), "utf8")
): RequestHandler {
  return async (req, res, next) => {
    if (
      process.env.NODE_ENV === "development" ||
      !isRecommendationContinuationPath(req.originalUrl)
    ) {
      return next();
    }
    const slug = String(req.params.slug || "");
    // The action grammar must match this exact route, not a different profile.
    const pathname = new URL(req.originalUrl, "https://tradescout.internal").pathname;
    if (pathname.replace(/\/$/, "") !== `/contractors/${encodeURIComponent(slug)}`) return next();
    // Reserved legacy entry routes retain their existing meaning and redirects.
    if (["apply", "signup", "accelerator", "dashboard"].includes(slug)) return next();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    try {
      const contractor = await storage.getContractorBySlug(slug);
      if (!contractor || contractor.isActive === false) {
        res.status(404).type("text").send("Local provider not found");
        return;
      }
      const html = renderPublicContractorProfileHtml({
        contractor,
        origin: resolvePublicOrigin(req),
        templateHtml: await readTemplate(),
        gallerySlug: req.query.gallery,
      });
      res.type("html").send(html);
    } catch (error) {
      console.error("[recommendations] continuation page failed", error);
      res.status(503).type("text").send(
        "The recommendation page is temporarily unavailable. Reload to return to your saved draft."
      );
    }
  };
}
