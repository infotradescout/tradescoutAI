import type { Express, Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import {
  readPublicExchangeListing, readPublicExchangePage, readPublicExchangeIndex,
  PUBLIC_EXCHANGE_SITEMAP_PAGE_SIZE, isPublicDiscoveryCategory,
} from "../services/exchangePublicDiscovery";
import {
  renderPublicExchangeListing, renderPublicExchangeDirectory, exchangeSitemapXml,
  exchangeSitemapIndexXml, exchangeListingMarkdown, EXCHANGE_PUBLIC_ORIGIN, EXCHANGE_PUBLIC_ROBOTS,
} from "../publicExchangeDiscoveryHtml";
import { readExchangeStoneCatalog, readExchangeStonePhoto } from "../services/exchangeStoneCatalogReader";
import { resolveMappedProfileShareSlug } from "../utils/publicOrigin";
import { logger } from "../services/logger";

type Dependencies = {
  listing: typeof readPublicExchangeListing;
  page: typeof readPublicExchangePage;
  index: typeof readPublicExchangeIndex;
  template: () => string;
  media: (id: string) => Promise<Buffer | null>;
};
let template: string | null = null;
const defaults: Dependencies = {
  listing: readPublicExchangeListing, page: readPublicExchangePage, index: readPublicExchangeIndex,
  template: () => template ||= fs.readFileSync(path.resolve(process.cwd(), "dist/public/index.html"), "utf8"),
  media: async id => {
    const catalog = await readExchangeStoneCatalog();
    const digest = catalog.assets.get(id);
    return digest ? readExchangeStonePhoto(id, digest) : null;
  },
};
function canonicalHost(req: Request): boolean {
  const host = String(req.headers.host || "").toLowerCase().split(":")[0];
  if (resolveMappedProfileShareSlug(req)) return false;
  return ["www.thetradescout.com", "thetradescout.com", "tradescoutai.onrender.com"].includes(host) ||
    process.env.NODE_ENV !== "production" && ["127.0.0.1", "localhost"].includes(host);
}
function robots(req: Request): string {
  return ["www.thetradescout.com", "thetradescout.com"].includes(String(req.headers.host || "").toLowerCase().split(":")[0]) ? EXCHANGE_PUBLIC_ROBOTS : "noindex, follow";
}
function pageNumber(value: unknown): number | null {
  if (value === undefined) return 1;
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : null;
}
function notFound(res: Response) { res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Robots-Tag", "noindex"); return res.status(404).type("text").send("Public listing not found."); }
function unavailable(res: Response, error: unknown) {
  logger.error("[exchange-discovery] public read failed", { error });
  res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Robots-Tag", "noindex"); res.setHeader("Retry-After", "60");
  return res.status(503).type("text").send("Public listings are temporarily unavailable. Please try again.");
}

/** Existing canonical Exchange URLs, all sellers and categories. No contact, order or pricing mutation. */
export function registerExchangePublicDiscoveryRoutes(app: Express, overrides: Partial<Dependencies> = {}): void {
  const deps = { ...defaults, ...overrides };
  // Reuse the root documents rather than replacing the site's other public discovery feeds.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!canonicalHost(req) || !["GET", "HEAD"].includes(req.method) || !["/robots.txt", "/llms.txt"].includes(req.path)) return next();
    const send = res.send;
    res.send = function (body: any) {
      if (res.statusCode === 200 && typeof body === "string") {
        if (req.path === "/robots.txt") {
          // Crawlers rendering the public client may read only this explicitly public projection.
          // Preserve every private API disallow and apply the exception within each existing agent group.
          body = body.replace(/^(Disallow:\s*\/api\/\s*)$/gmi, "$1\nAllow: /api/exchange/public-listings/");
          if (!body.includes("/exchange-sitemap-index.xml")) body += `\nSitemap: ${EXCHANGE_PUBLIC_ORIGIN}/exchange-sitemap-index.xml\n`;
        }
        if (req.path === "/llms.txt" && !body.includes("/exchange/llms.txt")) body += `\n## Public marketplace listings\n- [TradeScout Exchange](${EXCHANGE_PUBLIC_ORIGIN}/exchange): Public listings from individual and business sellers across all categories.\n- [Paginated listing index](${EXCHANGE_PUBLIC_ORIGIN}/exchange/llms.txt): Current public listing titles and canonical pages.\n- [Listing sitemaps](${EXCHANGE_PUBLIC_ORIGIN}/exchange-sitemap-index.xml): Every currently published listing, without a paid-user discovery tier.\n`;
      }
      return send.call(this, body);
    };
    next();
  });

  app.get("/exchange/media/:listingId", async (req, res, next) => {
    if (!canonicalHost(req)) return next("route");
    try {
      const bytes = await deps.media(req.params.listingId);
      if (!bytes) return notFound(res);
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.type("image/webp").send(bytes);
    } catch (error) { return unavailable(res, error); }
  });
  app.get("/api/exchange/public-listings/:listingId", async (req, res, next) => {
    if (!canonicalHost(req)) return next("route");
    try {
      const item = await deps.listing(req.params.listingId);
      if (!item) return notFound(res);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Robots-Tag", "noindex");
      return res.json(item);
    } catch (error) { return unavailable(res, error); }
  });
  app.get("/exchange-sitemap-index.xml", async (req, res, next) => {
    if (!canonicalHost(req)) return next("route");
    try {
      const data = await deps.index(1);
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      return res.type("application/xml").send(exchangeSitemapIndexXml(Math.ceil(data.total / PUBLIC_EXCHANGE_SITEMAP_PAGE_SIZE)));
    } catch (error) { return unavailable(res, error); }
  });
  app.get(["/sitemap-exchange-listings.xml", "/exchange/llms.txt"], async (req, res, next) => {
    if (!canonicalHost(req)) return next("route");
    const page = pageNumber(req.query.page);
    if (!page) return notFound(res);
    try {
      const data = await deps.index(page);
      if (page > 1 && (page - 1) * data.pageSize >= data.total) return notFound(res);
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      return req.path.endsWith(".xml") ? res.type("application/xml").send(exchangeSitemapXml(data.items)) : res.type("text/plain").send(exchangeListingMarkdown(data));
    } catch (error) { return unavailable(res, error); }
  });
  app.get("/exchange/:category/:listingId", async (req, res, next) => {
    if (!canonicalHost(req) || !isPublicDiscoveryCategory(req.params.category)) return next("route");
    try {
      const item = await deps.listing(req.params.listingId);
      if (!item) return notFound(res);
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      if (req.path !== item.publicDetailPath) return res.redirect(301, item.publicDetailPath);
      res.setHeader("X-Robots-Tag", robots(req));
      return res.type("html").send(renderPublicExchangeListing(deps.template(), item));
    } catch (error) { return unavailable(res, error); }
  });
  app.get(["/exchange", "/exchange/:category"], async (req, res, next) => {
    if (!canonicalHost(req)) return next("route");
    const category = req.params.category;
    // Seller dashboards, rental tools, stone-market selection and legacy promo actions retain their owners.
    if (category && !isPublicDiscoveryCategory(category) || ["item", "promo", "companyPromo", "tab"].some(key => Object.hasOwn(req.query, key))) return next("route");
    const page = pageNumber(req.query.page);
    if (!page) return notFound(res);
    try {
      const data = await deps.page(page, undefined, category);
      if (page > 1 && (page - 1) * data.pageSize >= data.total) return notFound(res);
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate"); res.setHeader("X-Robots-Tag", robots(req));
      return res.type("html").send(renderPublicExchangeDirectory(deps.template(), { ...data, category }));
    } catch (error) { return unavailable(res, error); }
  });
}
