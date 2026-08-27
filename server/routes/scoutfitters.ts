import express from "express";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import multer from "multer";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { runtimePaths } from "../runtimePaths";

type TierKey = string;
type PlacementKey = "front_center" | "left_chest";

const ALLOWED_TIER_KEYS = new Set(["high", "medium", "low", "budget", "promo"]);
const SCOUTFITTERS_TIER_KEYS = Array.from(ALLOWED_TIER_KEYS).sort();

type Recipient = {
  name: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  zip: string;
  country_code: string;
  phone?: string;
};

function resolvePublicOrigin(req: Request): string {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = forwardedHost || String(req.headers.host || "").trim();
  if (!host) return "https://www.thetradescout.com";
  const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";
  return `${proto}://${host}`;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function parsePositiveMoney(value: unknown): number | null {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sanitizeTierKey(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return null;
  if (raw.length > 64) return null;
  if (!/^[a-z0-9_-]+$/.test(raw)) return null;
  if (!ALLOWED_TIER_KEYS.has(raw)) return null;
  return raw;
}

async function getVariantMapFromSiteSettings(): Promise<Record<string, number> | null> {
  try {
    const settings = await storage.getSiteSettings("marketing");
    const candidates = settings
      .filter((s) => s && s.key === "scoutfitters_printful_variants" && s.isActive !== false)
      .sort((a: any, b: any) => {
        const aT = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bT = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bT - aT;
      });

    const value: any = candidates[0]?.value;
    if (!value || typeof value !== "object") return null;

    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(value)) {
      const key = sanitizeTierKey(k);
      const parsed = parsePositiveInt(v);
      if (key && parsed) {
        out[key] = parsed;
      }
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

async function getRetailPriceMapFromSiteSettings(): Promise<Record<string, number> | null> {
  try {
    const settings = await storage.getSiteSettings("marketing");
    const candidates = settings
      .filter((s) => s && s.key === "scoutfitters_catalog_prices" && s.isActive !== false)
      .sort((a: any, b: any) => {
        const aT = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bT = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bT - aT;
      });

    const value: any = candidates[0]?.value;
    if (!value || typeof value !== "object") return null;

    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(value)) {
      const key = sanitizeTierKey(k);
      const parsed = parsePositiveMoney(v);
      if (key && parsed) {
        out[key] = parsed;
      }
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

async function getVariantIdForTier(tier: string): Promise<number | null> {
  const key = sanitizeTierKey(tier);
  if (!key) return null;

  const fromSiteSettings = await getVariantMapFromSiteSettings();
  const configured = fromSiteSettings?.[key];
  if (configured) {
    return configured;
  }

  const env =
    key === "high"
      ? process.env.SCOUTFITTERS_PRINTFUL_VARIANT_ID_HIGH
      : key === "medium"
        ? process.env.SCOUTFITTERS_PRINTFUL_VARIANT_ID_MEDIUM
        : key === "low"
          ? process.env.SCOUTFITTERS_PRINTFUL_VARIANT_ID_LOW
          : null;

  return parsePositiveInt(env);
}

async function getRetailPriceForTier(tier: string): Promise<number | null> {
  const key = sanitizeTierKey(tier);
  if (!key) return null;

  const fromSiteSettings = await getRetailPriceMapFromSiteSettings();
  const configuredRetail = fromSiteSettings?.[key];
  if (configuredRetail) {
    return configuredRetail;
  }

  const apiKey = String(process.env.PRINTFUL_API_KEY || "").trim();
  if (!apiKey) return null;

  const variantId = await getVariantIdForTier(key);
  if (!variantId) return null;

  try {
    const resp = await fetch(`https://api.printful.com/store/variants/${variantId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) return null;
    const json: any = await resp.json().catch(() => null);
    const retail = json?.result?.retail_price ?? json?.result?.price ?? json?.price;
    return parsePositiveMoney(retail);
  } catch {
    return null;
  }
}

function getTechniqueForTier(tier: TierKey): "EMBROIDERY" | "DTG" {
  const key = sanitizeTierKey(tier);
  return key === "high" ? "EMBROIDERY" : "DTG";
}

function sanitizePrintfulFileType(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (!/^[a-z0-9_]+$/i.test(raw)) return null;
  return raw;
}

async function getPrintfulFileTypeOverridesFromSiteSettings(): Promise<{
  embroidery?: Partial<Record<PlacementKey, string>>;
} | null> {
  try {
    const settings = await storage.getSiteSettings("marketing");
    const candidates = settings
      .filter((s) => s && s.key === "scoutfitters_printful_file_types" && s.isActive !== false)
      .sort((a: any, b: any) => {
        const aT = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bT = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bT - aT;
      });

    const value: any = candidates[0]?.value;
    if (!value || typeof value !== "object") return null;

    const embroidery =
      value.embroidery && typeof value.embroidery === "object" ? value.embroidery : null;
    if (!embroidery) return null;

    const left = sanitizePrintfulFileType(embroidery.left_chest);
    const front = sanitizePrintfulFileType(embroidery.front_center);

    return {
      embroidery: {
        ...(left ? { left_chest: left } : {}),
        ...(front ? { front_center: front } : {}),
      },
    };
  } catch {
    return null;
  }
}

function buildPrintFile(args: {
  technique: "EMBROIDERY" | "DTG";
  placement: PlacementKey;
  designUrl: string;
  fileTypeOverrides?: { embroidery?: Partial<Record<PlacementKey, string>> } | null;
}) {
  const { technique, placement, designUrl, fileTypeOverrides } = args;

  // Printful file `type` controls placement + (for embroidery products) technique routing.
  // DTG placement is simulated via `position` on the "front" print area.
  if (technique === "EMBROIDERY") {
    const override = fileTypeOverrides?.embroidery?.[placement];
    return {
      type: override || (placement === "left_chest" ? "embroidery_chest_left" : "embroidery_front"),
      url: designUrl,
    };
  }

  const position =
    placement === "left_chest"
      ? {
          area_width: 12,
          area_height: 16,
          width: 4,
          height: 4,
          top: 3,
          left: 1,
          limit_to_print_area: true,
        }
      : {
          area_width: 12,
          area_height: 16,
          width: 12,
          height: 12,
          top: 2,
          left: 0,
          limit_to_print_area: true,
        };

  return {
    type: "front",
    url: designUrl,
    position,
  };
}

export function registerScoutFittersRoutes(app: any) {
  const router = express.Router();

  // NOTE: We intentionally use multipart upload for the design PNG so we do not need to raise
  // the global JSON body size limit (default 1mb). Canvas exports can easily exceed that.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== "image/png") {
        cb(new Error("Only PNG uploads are supported"));
        return;
      }
      cb(null, true);
    },
  });

  const uploadDesign: express.RequestHandler = (req, res, next) => {
    upload.single("design")(req, res, (err: any) => {
      if (!err) return next();

      const message = typeof err?.message === "string" ? err.message : "Upload failed";
      const isTooLarge = err?.code === "LIMIT_FILE_SIZE";
      res.status(isTooLarge ? 413 : 400).json({ message });
    });
  };

  router.get("/config", async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const variantEntries = await Promise.all(
      SCOUTFITTERS_TIER_KEYS.map(
        async (key) => [key, Boolean(await getVariantIdForTier(key))] as const
      )
    );
    const variantsConfigured = Object.fromEntries(variantEntries);
    const configuredTierKeys = variantEntries
      .filter(([, configured]) => configured)
      .map(([key]) => key);
    const variantMap = await getVariantMapFromSiteSettings();
    const fileTypeOverrides = await getPrintfulFileTypeOverridesFromSiteSettings();
    const catalog = await Promise.all(
      SCOUTFITTERS_TIER_KEYS.map(async (key) => ({
        key,
        technique: getTechniqueForTier(key),
        configured: Boolean(variantsConfigured[key]),
        retailPrice: variantsConfigured[key] ? await getRetailPriceForTier(key) : null,
      }))
    );
    res.status(200).json({
      catalog,
      fulfillment: {
        printfulConfigured: Boolean(String(process.env.PRINTFUL_API_KEY || "").trim()),
        variantsConfigured,
        configuredTierKeys,
        // Not secrets; helpful for UI/admin debugging.
        allowedTierKeys: Object.keys(variantMap || {}).sort(),
        fileTypeOverridesConfigured: Boolean(
          fileTypeOverrides?.embroidery?.left_chest || fileTypeOverrides?.embroidery?.front_center
        ),
      },
      quality: {
        minShortestSidePx: 2000,
        minDpi: 300,
      },
    });
  });

  router.post("/design", isAuthenticated, uploadDesign, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file?.buffer?.length) {
        return res.status(400).json({ message: "Missing design upload" });
      }
      if (file.buffer.length > 10 * 1024 * 1024) {
        return res.status(413).json({ message: "Design too large" });
      }

      const uploadDir = runtimePaths.publicUploads;
      const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const outDir = path.join(uploadDir, "scoutfitters", safeUserId);
      fs.mkdirSync(outDir, { recursive: true });

      const filename = `${Date.now()}-${randomUUID()}.png`;
      const outPath = path.join(outDir, filename);
      fs.writeFileSync(outPath, file.buffer);

      const origin = resolvePublicOrigin(req);
      const publicPath = `/uploads/scoutfitters/${encodeURIComponent(safeUserId)}/${encodeURIComponent(
        filename
      )}`;

      res.status(200).json({ url: `${origin}${publicPath}` });
    } catch (err) {
      console.error("[scoutfitters] design upload failed", err);
      res.status(500).json({ message: "Failed to save design" });
    }
  });

  router.post("/order", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const apiKey = String(process.env.PRINTFUL_API_KEY || "").trim();
      if (!apiKey) {
        return res
          .status(503)
          .json({ message: "Printful is not configured (PRINTFUL_API_KEY missing)" });
      }

      const tier = String((req.body ?? {}).tier || (req.body ?? {}).productKey || "").toLowerCase();
      const placement = String((req.body ?? {}).placement || "").toLowerCase() as PlacementKey;
      const quantityRaw = Number((req.body ?? {}).quantity);
      const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.floor(quantityRaw)) : 1;
      const confirm = Boolean((req.body ?? {}).confirm);
      const designUrl = String((req.body ?? {}).designUrl || "").trim();
      const recipient = (req.body ?? {}).recipient as Recipient | undefined;

      const normalizedTier = sanitizeTierKey(tier);
      if (!normalizedTier) {
        return res.status(400).json({ message: "Invalid tier" });
      }
      if (!["front_center", "left_chest"].includes(placement)) {
        return res.status(400).json({ message: "Invalid placement" });
      }
      if (!designUrl || !/^https?:\/\//i.test(designUrl)) {
        return res.status(400).json({ message: "Invalid designUrl" });
      }
      if (!recipient || !recipient.name || !recipient.email || !recipient.address1) {
        return res.status(400).json({ message: "Invalid recipient" });
      }

      const variantId = await getVariantIdForTier(normalizedTier);
      if (!variantId) {
        return res.status(503).json({
          message:
            "ScoutFitters variant IDs are not configured. Set site setting marketing/scoutfitters_printful_variants or SCOUTFITTERS_PRINTFUL_VARIANT_ID_HIGH/MEDIUM/LOW.",
        });
      }

      const technique = getTechniqueForTier(normalizedTier);
      const fileTypeOverrides = await getPrintfulFileTypeOverridesFromSiteSettings();
      const file = buildPrintFile({ technique, placement, designUrl, fileTypeOverrides });

      const payload: any = {
        confirm,
        recipient,
        items: [
          {
            variant_id: variantId,
            quantity,
            files: [file],
          },
        ],
      };

      const resp = await fetch("https://api.printful.com/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json: any = await resp.json().catch(() => null);
      if (!resp.ok) {
        const msg =
          json?.result?.message ||
          json?.error?.message ||
          json?.message ||
          `Printful request failed (${resp.status})`;
        return res.status(502).json({ message: msg, printfulStatus: resp.status, details: json });
      }

      res.status(200).json({ ok: true, result: json?.result ?? json });
    } catch (err) {
      console.error("[scoutfitters] order failed", err);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.use("/api/scoutfitters", router);
}
