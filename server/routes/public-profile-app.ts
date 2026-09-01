import type { Express, Request } from "express";
import {
  normalizePublicProfileAppSlug,
  parsePublicProfileAppManifestFile,
} from "@shared/publicProfileApp";
import {
  buildPublicProfileWebAppManifest,
  resolvePublicProfileAppIdentity,
} from "../publicProfileApp";
import { renderProfileAppIconPng } from "../socialPreviewCardRenderer";
import {
  CANONICAL_WEB_HOST,
  resolveMappedProfileShareOrigin,
  resolveMappedProfileShareSlug,
  resolvePublicOrigin,
} from "../utils/publicOrigin";

function requestHost(req: Request): string {
  return String(req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];
}

function canServeProfileAppAsset(req: Request, slug: string): boolean {
  const mappedSlug = resolveMappedProfileShareSlug(req);
  if (mappedSlug) return mappedSlug === slug;

  return [
    CANONICAL_WEB_HOST,
    "thetradescout.com",
    "tradescoutai.onrender.com",
    "localhost",
    "127.0.0.1",
  ].includes(requestHost(req));
}

function profileAppOrigin(req: Request): string {
  return resolveMappedProfileShareOrigin(req) || resolvePublicOrigin(req);
}

export function registerPublicProfileAppRoutes(app: Express): void {
  app.get("/profile-manifests/:manifestFile", async (req, res) => {
    const slug = parsePublicProfileAppManifestFile(req.params.manifestFile);
    if (!slug || !canServeProfileAppAsset(req, slug)) {
      return res.status(404).send("Profile app manifest not found");
    }

    try {
      const manifest = await buildPublicProfileWebAppManifest({
        slug,
        origin: profileAppOrigin(req),
      });
      if (!manifest) return res.status(404).send("Profile app manifest not found");

      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      res.vary("Host");
      return res.type("application/manifest+json").send(JSON.stringify(manifest));
    } catch (error) {
      console.error("Error rendering public profile app manifest:", error);
      return res.status(500).send("Failed to render profile app manifest");
    }
  });

  app.get("/profile-app-icons/:slug/:iconFile", async (req, res) => {
    const slug = normalizePublicProfileAppSlug(req.params.slug);
    const sizeMatch = String(req.params.iconFile || "").match(/^(192|512)\.png$/);
    const size = sizeMatch ? Number(sizeMatch[1]) : 0;
    if (!slug || !sizeMatch || !canServeProfileAppAsset(req, slug)) {
      return res.status(404).send("Profile app icon not found");
    }

    try {
      const identity = await resolvePublicProfileAppIdentity(slug);
      if (!identity) return res.status(404).send("Profile app icon not found");
      const png = await renderProfileAppIconPng(
        {
          brandName: identity.displayName,
          logoUrl: identity.logoUrl,
          accentColor: identity.accentColor,
        },
        size
      );
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.vary("Host");
      return res.type("image/png").send(png);
    } catch (error) {
      console.error("Error rendering public profile app icon:", error);
      return res.status(500).send("Failed to render profile app icon");
    }
  });
}
