import { Router, type Request, type Response } from "express";
import { pool } from "../db/pg";
import { ensureTradePartnerTables } from "../db/ensureTradePartnerTables";

const router = Router();

function isValidCountySlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9-]+$/.test(slug) && slug.length <= 80;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter((item) => item.length > 0))
  );
}

router.get("/:countySlug", async (req: Request, res: Response) => {
  const countySlug = String(req.params.countySlug || "")
    .trim()
    .toLowerCase();

  if (!isValidCountySlug(countySlug)) {
    return res.status(400).json({ error: "Invalid county slug" });
  }

  const query = `
    SELECT
      county_slug,
      county_name,
      state_code,
      page_title,
      hero_headline,
      hero_subhead,
      seat_term_months,
      giveback_seat_revenue_pct,
      county_vault_affiliate_pct,
      allowed_categories
    FROM tradepartner_county_pages
    WHERE county_slug = $1
    LIMIT 1
  `;

  try {
    await ensureTradePartnerTables();
    const result = await pool.query(query, [countySlug]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Not found" });
    }

    const row = result.rows[0] as Record<string, unknown>;

    return res.json({
      countySlug: String(row.county_slug || ""),
      countyName: String(row.county_name || ""),
      stateCode: String(row.state_code || ""),
      pageTitle: String(row.page_title || ""),
      heroHeadline: String(row.hero_headline || ""),
      heroSubhead: String(row.hero_subhead || ""),
      seatTermMonths: Number(row.seat_term_months || 12),
      givebackSeatRevenuePct: Number(row.giveback_seat_revenue_pct || 50),
      countyVaultAffiliatePct: Number(row.county_vault_affiliate_pct || 10),
      allowedCategories: toStringArray(row.allowed_categories),
    });
  } catch (error) {
    console.error("GET tradepartner landing error:", error);
    const code = String((error as any)?.code || "");
    if (code === "42P01") {
      return res.status(503).json({ error: "Trade Partner pages are not configured yet." });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
