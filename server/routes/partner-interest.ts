import { Router, type Request, type Response } from "express";
import { pool } from "../db/pg";

const router = Router();

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanString(value: unknown, maxLen: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > maxLen) return trimmed.slice(0, maxLen);
  return trimmed;
}

function parseBool(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "on" || normalized === "1";
}

function extractAllowedCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter((item) => item.length > 0);
}

router.post("/", async (req: Request, res: Response) => {
  const countySlug = cleanString(req.body?.countySlug, 80).toLowerCase();
  const businessName = cleanString(req.body?.businessName, 160);
  const serviceCategory = cleanString(req.body?.serviceCategory, 120);
  const contactName = cleanString(req.body?.contactName, 120);
  const email = cleanString(req.body?.email, 200).toLowerCase();
  const phone = cleanString(req.body?.phone, 60);
  const message = cleanString(req.body?.message, 2000);

  const acknowledgesExclusivity = parseBool(req.body?.acknowledgesExclusivity);
  const acknowledgesTerm = parseBool(req.body?.acknowledgesTerm);

  if (!countySlug || !/^[a-z0-9-]+$/.test(countySlug)) {
    return res.status(400).json({ error: "Invalid county" });
  }

  if (!businessName || !serviceCategory || !contactName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }

  if (!acknowledgesExclusivity || !acknowledgesTerm) {
    return res.status(400).json({ error: "Acknowledgements required" });
  }

  const countyQuery = `
    SELECT allowed_categories
    FROM tradepartner_county_pages
    WHERE county_slug = $1
    LIMIT 1
  `;

  try {
    const countyResult = await pool.query(countyQuery, [countySlug]);
    if (!countyResult.rows.length) {
      return res.status(404).json({ error: "County not found" });
    }

    const allowedCategories = extractAllowedCategories(countyResult.rows[0]?.allowed_categories);
    if (allowedCategories.length > 0) {
      const normalizedCategory = serviceCategory.trim().toLowerCase();
      const normalizedAllowed = new Set(allowedCategories.map((item) => item.toLowerCase()));
      if (!normalizedAllowed.has(normalizedCategory)) {
        return res.status(400).json({ error: "Category not allowed for this county" });
      }
    }

    const insertQuery = `
      INSERT INTO tradepartner_interest_submissions (
        county_slug,
        business_name,
        service_category,
        contact_name,
        email,
        phone,
        message,
        acknowledges_exclusivity,
        acknowledges_term,
        user_agent,
        ip_address
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
    `;

    const userAgent = cleanString(req.headers["user-agent"], 300);
    const forwardedFor = String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim();
    const ipAddress = cleanString(forwardedFor || req.ip, 80);

    const insertResult = await pool.query(insertQuery, [
      countySlug,
      businessName,
      serviceCategory,
      contactName,
      email,
      phone || null,
      message || null,
      acknowledgesExclusivity,
      acknowledgesTerm,
      userAgent || null,
      ipAddress || null,
    ]);

    return res.json({ ok: true, submissionId: insertResult.rows[0]?.id });
  } catch (error) {
    console.error("POST partner interest error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
