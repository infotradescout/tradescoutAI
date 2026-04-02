import { Router } from "express";
import { PRIMARY_TRADE_SLUGS, getTradeBySlug } from "../../shared/tradeSeo";
import { storage } from "../storage";

const router = Router();

function coerceInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" && value.trim().length ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

// Open read-only data layer (phase 1). No writes, no contact vectors.
router.get("/api/public/datasets/trades", async (_req, res) => {
  const trades = PRIMARY_TRADE_SLUGS.map((slug) => {
    const t = getTradeBySlug(slug);
    return t ? { slug: t.slug, name: t.name } : null;
  }).filter(Boolean) as Array<{ slug: string; name: string }>;

  res.json({ items: trades });
});

router.get("/api/public/datasets/counties", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50_000, coerceInt((req.query as any)?.limit, 5_000)));
    const offset = Math.max(0, coerceInt((req.query as any)?.offset, 0));
    const items = await storage.listDirectoryCountiesForSitemap({ limit, offset });
    res.json({ items, limit, offset });
  } catch (error: any) {
    console.error("Error listing dataset counties:", error);
    res.status(500).json({ message: "Failed to list counties" });
  }
});

router.get("/api/public/datasets/cities", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50_000, coerceInt((req.query as any)?.limit, 10_000)));
    const offset = Math.max(0, coerceInt((req.query as any)?.offset, 0));
    const items = await storage.listDirectoryCitiesForSitemap({ limit, offset });
    res.json({ items, limit, offset });
  } catch (error: any) {
    console.error("Error listing dataset cities:", error);
    res.status(500).json({ message: "Failed to list cities" });
  }
});

// Businesses dataset is intentionally county-contained (platform law).
// Use /api/businesses directly for query facets; this alias keeps the datasets namespace consistent.
router.get("/api/public/datasets/businesses", async (req, res) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (typeof v === "string") qs.set(k, v);
  }
  res.redirect(302, `/api/businesses?${qs.toString()}`);
});

export { router as datasetsPublicRouter };
