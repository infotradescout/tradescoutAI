import { Router } from "express";
import { getTradeSeoMatch, normalizeTradeSlug, slugifyCountyName } from "../../shared/tradeSeo";
import { isCanonicalPublicCitySlug, normalizePublicCitySlug } from "../seoDirectoryCitySlug";
import { loadExactTradeCityCountyScopes } from "../services/publicTradeCityScopeService";

const router = Router();

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStateCode(raw: unknown): string {
  const value = coerceString(raw).toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : "";
}

function normalizeCitySlug(raw: unknown): string {
  return isCanonicalPublicCitySlug(raw) ? normalizePublicCitySlug(raw) : "";
}

function titleizeCitySlug(slug: string): string {
  const cleaned = String(slug || "")
    .trim()
    .replace(/-+/g, " ")
    .trim();
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

// Public (read-only): city → counties facet. This preserves "counties are operational containers"
// by returning links/containers instead of a cross-county business list with actions.
router.get("/api/public/cities/:stateCode/:citySlug", async (req, res) => {
  const stateCode = normalizeStateCode(req.params.stateCode);
  const citySlug = normalizeCitySlug(req.params.citySlug);
  try {
    if (!stateCode) return res.status(400).json({ message: "Invalid stateCode" });
    if (!citySlug) return res.status(400).json({ message: "Invalid citySlug" });
    const rows = await loadExactTradeCityCountyScopes({ stateCode, citySlug });

    const countiesOut = rows.map((r) => ({
      countyFips: String(r.countyFips),
      countyName: String(r.countyName),
      stateCode: String(r.stateCode),
      countySlug: slugifyCountyName(
        String(r.countyName)
          .replace(/\s+County$/i, "")
          .trim()
      ),
      businessCount: Number(r.businessCount || 0),
    }));

    res.json({
      citySlug,
      stateCode,
      displayCity: titleizeCitySlug(citySlug),
      counties: countiesOut,
    });
  } catch (error: any) {
    console.warn("City facet snapshot unavailable", error);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "300");
    res.status(503).json({ message: "City directory temporarily unavailable" });
  }
});

router.get("/api/public/trade-cities/:tradeSlug/:stateCode/:citySlug", async (req, res) => {
  const tradeSlug = coerceString(req.params.tradeSlug);
  const stateCode = normalizeStateCode(req.params.stateCode);
  const citySlug = normalizeCitySlug(req.params.citySlug);
  try {
    if (!tradeSlug) return res.status(400).json({ message: "Invalid tradeSlug" });
    if (!stateCode) return res.status(400).json({ message: "Invalid stateCode" });
    if (!citySlug) return res.status(400).json({ message: "Invalid citySlug" });

    const tradeMatch = getTradeSeoMatch(tradeSlug);
    if (!tradeMatch) return res.status(404).json({ message: "Trade not found" });
    const canonicalTradeSlug = normalizeTradeSlug(tradeMatch.canonicalSlug);
    const rows = await loadExactTradeCityCountyScopes({
      tradeSlug: canonicalTradeSlug,
      stateCode,
      citySlug,
    });

    const countiesOut = rows.map((r) => ({
      countyFips: String(r.countyFips),
      countyName: String(r.countyName),
      stateCode: String(r.stateCode),
      countySlug: slugifyCountyName(
        String(r.countyName)
          .replace(/\s+County$/i, "")
          .trim()
      ),
      businessCount: Number(r.businessCount || 0),
    }));

    res.json({
      tradeSlug: canonicalTradeSlug,
      stateCode,
      citySlug,
      displayCity: titleizeCitySlug(citySlug),
      counties: countiesOut,
    });
  } catch (error: any) {
    console.warn("Trade-city facet snapshot unavailable", error);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "300");
    res.status(503).json({ message: "Trade-city directory temporarily unavailable" });
  }
});

export { router as cityPublicRouter };
