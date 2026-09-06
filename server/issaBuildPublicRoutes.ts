import type { Express, Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { storage } from "./storage";
import { buildPublicProfileHtml } from "./publicProfileHtml";
import { resolvePublicOrigin } from "./utils/publicOrigin";
import { ISSA_BUILD_LOCAL_DISCOVERY, ISSA_BUILD_PROFILE_SLUG } from "@shared/issaBuildProfile";
import { ISSA_BUILD_ONYX_PAGE_TITLE, ISSA_BUILD_ONYX_PAGE_DESCRIPTION, issaBuildBusinessText } from "@shared/issaBuildPageContent";
import {
  ISSA_BUILD_PUBLIC_PATH, ISSA_BUILD_ONYX_PATH,
  resolveIssaBuildPublicPage, resolveIssaBuildCanonicalRedirect, resolveIssaBuildOnyxItem,
} from "@shared/issaBuildRoutes";

/** Rewrite URL identities only. Never substitute headings, descriptions or product facts. */
export function canonicalizeIssaBuildDocumentUrls(html: string): string {
  return html
    .replace(/\/u\/issa-build\/categories\/onyx(?=[?#\s"'<>]|$)/g, ISSA_BUILD_ONYX_PATH)
    .replace(/\/u\/issa-build\/inventory\/(honey-onyx|multi-green-onyx)(?=[?#\s"'<>]|$)/g, `${ISSA_BUILD_ONYX_PATH}/inventory/$1`)
    .replace(/(?<!\/api)\/u\/issa-build(?=[/#?\s"'<>]|$)/g, ISSA_BUILD_PUBLIC_PATH);
}

type RouteDependencies = {
  readTemplate: () => string;
  readProfile: typeof storage.getProfileBySlugPublic;
  renderProfile: typeof buildPublicProfileHtml;
};
let cachedTemplate: string | null = null;
const defaultDependencies: RouteDependencies = {
  readTemplate: () => cachedTemplate ||= fs.readFileSync(path.resolve(process.cwd(), "dist/public/index.html"), "utf8"),
  readProfile: (slug) => storage.getProfileBySlugPublic(slug),
  renderProfile: buildPublicProfileHtml,
};

/** Registered before legacy /u aliases and static fallback, for GET/HEAD only. */
export function registerIssaBuildPublicRoutes(app: Express, overrides: Partial<RouteDependencies> = {}): void {
  const dependencies = { ...defaultDependencies, ...overrides };
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const redirect = resolveIssaBuildCanonicalRedirect(req.originalUrl);
    if (redirect) {
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      return res.redirect(308, redirect);
    }
    const page = resolveIssaBuildPublicPage(req.path);
    if (!page) {
      if (req.path.startsWith(`${ISSA_BUILD_PUBLIC_PATH}/`)) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).send("Page not found");
      }
      return next();
    }
    try {
      const profile = await dependencies.readProfile(ISSA_BUILD_PROFILE_SLUG);
      if (!profile) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Robots-Tag", "noindex");
        return res.status(404).send("Profile not available");
      }
      const origin = resolvePublicOrigin(req);
      const itemSlug = resolveIssaBuildOnyxItem(req.path) || (typeof req.query.stone === "string" ? req.query.stone : undefined);
      if (itemSlug && !["honey-onyx", "multi-green-onyx"].includes(itemSlug)) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).send("Stone not found");
      }
      const canonicalPath = itemSlug
        ? `${ISSA_BUILD_ONYX_PATH}/inventory/${itemSlug}`
        : page === "onyx" ? ISSA_BUILD_ONYX_PATH : ISSA_BUILD_PUBLIC_PATH;
      const isOnyx = page === "onyx";
      const html = await dependencies.renderProfile({
        slug: ISSA_BUILD_PROFILE_SLUG,
        origin,
        templateHtml: dependencies.readTemplate(),
        itemSlug: isOnyx ? itemSlug : undefined,
        itemPhoto: isOnyx ? req.query.photo : undefined,
        categorySlug: isOnyx && !itemSlug ? "onyx" : undefined,
        gallerySlug: !isOnyx ? req.query.gallery : undefined,
        pageMetadata: {
          canonical: `${origin}${canonicalPath}`,
          documentTitle: itemSlug ? undefined : isOnyx ? ISSA_BUILD_ONYX_PAGE_TITLE : issaBuildBusinessText(profile.seoMeta?.title, ISSA_BUILD_LOCAL_DISCOVERY.title),
          socialTitle: itemSlug ? undefined : isOnyx ? ISSA_BUILD_ONYX_PAGE_TITLE : issaBuildBusinessText(profile.seoMeta?.title, ISSA_BUILD_LOCAL_DISCOVERY.title),
          description: isOnyx ? ISSA_BUILD_ONYX_PAGE_DESCRIPTION : issaBuildBusinessText(profile.seoMeta?.description, ISSA_BUILD_LOCAL_DISCOVERY.description),
          ogType: itemSlug ? "product" : isOnyx ? "website" : "profile",
        },
      });
      if (!html) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).send("Profile not available");
      }
      // These HTML pages have no private prices or owner/session data.
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      return res.type("html").send(canonicalizeIssaBuildDocumentUrls(html));
    } catch (error) {
      console.error("[issa-build] Public page rendering failed", error);
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).send("This page could not load. Please try again.");
    }
  });
}
