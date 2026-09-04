import type { Express, Request } from "express";
import {
  normalizePublicProfileAppSlug,
  parsePublicProfileAppManifestFile,
} from "@shared/publicProfileApp";
import { PROFILE_CATALOG_EXCHANGE_CATEGORY } from "@shared/profileCatalogExchange";
import {
  buildPublicProfileWebAppManifest,
  resolvePublicProfileAppIdentity,
} from "../publicProfileApp";
import {
  getPublicProfileCatalogExchangeItem,
  listPublicProfileCatalogExchangeItems,
  type PublicProfileCatalogExchangeItem,
} from "../profileCatalogExchange";
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

function sortExchangeItems<T extends { price?: number | null; createdAt?: string | null }>(
  items: T[],
  sort: string
): T[] {
  const sorted = [...items];
  if (sort === "price_asc") {
    sorted.sort((a, b) => {
      const aPrice = a.price == null ? Number.POSITIVE_INFINITY : Number(a.price);
      const bPrice = b.price == null ? Number.POSITIVE_INFINITY : Number(b.price);
      return aPrice - bPrice;
    });
  } else if (sort === "price_desc") {
    sorted.sort((a, b) => {
      const aPrice = a.price == null ? Number.NEGATIVE_INFINITY : Number(a.price);
      const bPrice = b.price == null ? Number.NEGATIVE_INFINITY : Number(b.price);
      return bPrice - aPrice;
    });
  } else if (sort === "date_asc") {
    sorted.sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
  } else {
    sorted.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }
  return sorted;
}

function pageExchangeItems<T>(items: T[], offsetValue: unknown, limitValue: unknown): T[] {
  const offset = Math.max(0, Number(offsetValue || 0) || 0);
  const rawLimit = limitValue == null || limitValue === "" ? null : Number(limitValue);
  const limit = rawLimit == null || !Number.isFinite(rawLimit) ? null : Math.max(1, rawLimit);
  return limit == null ? items.slice(offset) : items.slice(offset, offset + limit);
}

export function registerPublicProfileAppRoutes(app: Express): void {
  // Keep the code-curated Building Materials & Surfaces catalog available
  // ahead of the legacy marketplace route owner. It remains public read-only,
  // authority-gated, request-only, and carries no price or direct contact path.
  app.get("/api/exchange/items", async (req, res, next) => {
    const category = String(req.query.categoryId || "").trim();
    const isExactCatalogCategory = category === PROFILE_CATALOG_EXCHANGE_CATEGORY;
    const isUnfilteredFirstPage = !category && Math.max(0, Number(req.query.offset || 0) || 0) === 0;
    if (!isExactCatalogCategory && !isUnfilteredFirstPage) return next();

    try {
      const catalogItems = await listPublicProfileCatalogExchangeItems({
        category: isExactCatalogCategory ? category : undefined,
        search: req.query.search as string | undefined,
        hasPriceFilter: Boolean(req.query.priceMin || req.query.priceMax),
        condition: req.query.condition as string | undefined,
      });
      const sort = String(req.query.sort || "date_desc");

      if (isExactCatalogCategory) {
        return res.json(
          pageExchangeItems(sortExchangeItems(catalogItems, sort), req.query.offset, req.query.limit)
        );
      }

      // For the unfiltered first page, allow the ordinary route to provide its
      // listings, then append only authority-approved catalog records. De-dupe
      // by immutable ID and retain the route's requested sort and page limit.
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        if (!Array.isArray(body)) return originalJson(body);
        const byId = new Map<string, unknown>();
        for (const item of [...body, ...catalogItems]) {
          const id = String((item as any)?.id || "").trim();
          if (id && !byId.has(id)) byId.set(id, item);
        }
        const merged = sortExchangeItems(
          Array.from(byId.values()) as Array<
            PublicProfileCatalogExchangeItem & { price?: number | null; createdAt?: string | null }
          >,
          sort
        );
        const rawLimit = req.query.limit == null ? null : Number(req.query.limit);
        const limited =
          rawLimit == null || !Number.isFinite(rawLimit)
            ? merged
            : merged.slice(0, Math.max(1, rawLimit));
        return originalJson(limited);
      }) as typeof res.json;
      return next();
    } catch (error) {
      console.error("Error loading public profile catalog Exchange items:", error);
      return res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.get("/api/marketplace/listings/:id", async (req, res, next) => {
    try {
      const item = await getPublicProfileCatalogExchangeItem(req.params.id);
      if (!item) return next();
      return res.json(item);
    } catch (error) {
      console.error("Error loading public profile catalog Exchange item:", error);
      return res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

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
