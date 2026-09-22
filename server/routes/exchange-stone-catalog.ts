import type { Express } from "express";
import { renderExchangeStoneLanding } from "../publicExchangeStoneHtml";
import { exchangePageWindow, mergeExchangeDiscoveryItems } from "../exchangeDiscovery";
import { readExchangeStoneCatalog, readExchangeStonePhoto } from "../services/exchangeStoneCatalogReader";
import { STONE_STATES, filterStoneDiscovery, resolveStoneAudience, stoneDiscoveryContext, withStoneDiscovery, type StoneMarket } from "../services/exchangeStoneDiscovery";
import { CANONICAL_WEB_HOST, resolveMappedProfileShareSlug } from "../utils/publicOrigin";

function canonical(req: any): boolean {
  const host = String(req.headers.host || "").toLowerCase().split(":")[0];
  const hosts = [CANONICAL_WEB_HOST, "thetradescout.com", "tradescoutai.onrender.com"];
  if (process.env.NODE_ENV !== "production") hosts.push("localhost", "127.0.0.1");
  return !resolveMappedProfileShareSlug(req) && hosts.includes(host);
}

/** Later route headers cannot make one market's response reusable by another market. */
export function protectStoneResponseCache(res: any): void {
  const headers = ["Cache-Control", "CDN-Cache-Control", "Surrogate-Control"];
  for (const key of headers) res.setHeader(key, "private, no-store");
  const writeHead = res.writeHead;
  if (typeof writeHead !== "function") return;
  res.writeHead = function (...args: any[]) {
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (let index = arg.length - 2; index >= 0; index -= 2) if (headers.some(key => key.toLowerCase() === String(arg[index]).toLowerCase())) arg.splice(index, 2);
      } else if (arg && typeof arg === "object") {
        for (const key of Object.keys(arg)) if (headers.some(header => header.toLowerCase() === key.toLowerCase())) delete arg[key];
      }
    }
    for (const key of headers) this.setHeader(key, "private, no-store");
    return writeHead.apply(this, args);
  };
}

/** Mounted after the existing journey-capture middleware and effective-account binding. */
export function registerExchangeStoneCatalogRoutes(app: Express): void {
  const assets = new WeakMap<object, Map<string, string>>();
  app.use(async (req: any, res: any, next: any) => {
    const path = String(req.path || "");
    const scoped = req.method === "GET" && (/^\/exchange(?:\/|$)/.test(path) || /^\/api\/(?:exchange|marketplace\/(?:listings|favorites))(?:\/|$)/.test(path));
    const scoutRead = ["GET", "POST"].includes(req.method) && /^\/api\/scout(?:\/|$)/.test(path);
    if (!scoped && !scoutRead) return next();
    protectStoneResponseCache(res);
    const q = req.query || {};
    const selected: StoneMarket | undefined = ["audienceCity", "audienceState", "audienceCountry"].some(key => Object.hasOwn(q, key))
      ? { city: q.audienceCity, state: q.audienceState, country: q.audienceCountry } : undefined;
    const user = req.user;
    const audience = resolveStoneAudience(user ? { city: user.city, state: user.stateCode || user.state_code || user.state, country: user.countryCode || user.country_code || user.country } : undefined, selected, req.session?.exchangeStoneMarket);
    const context = { audience, items: [], query: q, feed: path === "/api/exchange/items", publicationReady: false } as NonNullable<ReturnType<typeof stoneDiscoveryContext>>;
    if (!canonical(req)) {
      context.audience = resolveStoneAudience();
      return withStoneDiscovery(context, next);
    }
    if (selected && req.session) {
      // Retain excluded selections too: a following image/detail request must not fall back to another area.
      req.session.exchangeStoneMarket = audience.reason === "location_required" ? {} : audience.market;
    }
    try {
      const catalog = await readExchangeStoneCatalog();
      context.publicationReady = catalog.items.length > 0;
      if (audience.allowed) { context.items = catalog.items; assets.set(req, catalog.assets); }
    } catch {
      // Ordinary marketplace content can still render, but no stale retail catalog is substituted.
      context.unavailable = true;
      console.warn("[stone-catalog] publication read unavailable; retail discovery withheld");
    }
    return withStoneDiscovery(context, next);
  });

  app.get("/exchange/stone", (req: any, res: any, next: any) => {
    if (!canonical(req)) return next("route");
    const context = stoneDiscoveryContext()!;
    const items = filterStoneDiscovery(context.items, req.query || {});
    const rendered = renderExchangeStoneLanding({ audience: context.audience, items,
      publicationReady: context.publicationReady, market: context.audience.market,
      acquisitionTags: req.query, states: STONE_STATES, search: typeof req.query.q === "string" ? req.query.q.slice(0, 160) : "" });
    res.setHeader("X-Robots-Tag", context.unavailable ? "noindex, follow" : rendered.robots);
    res.status(context.unavailable ? 503 : 200).type("html").send(rendered.html);
  });
  app.get("/api/exchange/stone", (req: any, res: any) => {
    if (!canonical(req)) return res.status(404).json({ message: "Not found." });
    const context = stoneDiscoveryContext()!;
    if (context.unavailable) return res.status(503).json({ message: "Stone catalog temporarily unavailable." });
    const items = filterStoneDiscovery(context.items, req.query || {});
    const page = exchangePageWindow(req.query || {});
    // This context is not the Exchange feed, so merge never injects a second copy.
    return res.json({ items: mergeExchangeDiscoveryItems([items], req.query), total: items.length,
      offset: page.offset, limit: page.limit, audience: context.audience.reason, publicationReady: context.publicationReady });
  });
  app.get("/api/exchange/stone-media/:id", async (req: any, res: any) => {
    if (!canonical(req)) return res.status(404).end();
    const context = stoneDiscoveryContext()!;
    if (context.unavailable) return res.status(503).end();
    const digest = context.audience.allowed ? assets.get(req)?.get(req.params.id) : undefined;
    if (!digest) return res.status(404).end();
    try {
      const bytes = await readExchangeStonePhoto(req.params.id, digest);
      if (!bytes) return res.status(404).end();
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.type("image/webp").send(bytes);
    } catch { return res.status(503).end(); }
  });
}
