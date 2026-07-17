import type { Pool } from "pg";
import { listProfileOfferImageUrls, normalizeProfileOfferId } from "@shared/profileOfferShare";
import { sanitizePublicListingText } from "@shared/publicListingSafety";
import { hasExposureAuthority } from "./services/exposureAuthority";

export type PublicProfileOffer = {
  id: string;
  sellerUserId: string;
  title: string;
  description: string | null;
  offerType: "service" | "item";
  price: number;
  currency: string;
  serviceCategory: string | null;
  serviceDurationMinutes: number | null;
  itemSku: string | null;
  itemStockQuantity: number | null;
  fulfillmentMode: string;
  shippingCost: number;
  isActive: true;
  metadata: {
    itemCategory?: string;
    exchangeCategorySlug?: string;
    taxCategory?: string;
    fulfillmentPolicy?: string;
    returnPolicy?: string;
    condition?: string;
    imageUrls: string[];
    images: string[];
    visibilityBoundary: string;
  };
  createdAt: unknown;
  updatedAt: unknown;
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function sanitizePublicProfileOfferText(value: unknown): string {
  return sanitizePublicListingText(value, 4000);
}

function safeMetadata(value: unknown): PublicProfileOffer["metadata"] {
  const metadata = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const images = listProfileOfferImageUrls(metadata);
  const optionalText = (key: string, maxLength: number) => {
    const text = sanitizePublicProfileOfferText(cleanText(metadata[key], maxLength));
    return text || undefined;
  };

  return {
    ...(optionalText("itemCategory", 120)
      ? { itemCategory: optionalText("itemCategory", 120) }
      : {}),
    ...(optionalText("exchangeCategorySlug", 80)
      ? { exchangeCategorySlug: optionalText("exchangeCategorySlug", 80) }
      : {}),
    ...(optionalText("taxCategory", 120) ? { taxCategory: optionalText("taxCategory", 120) } : {}),
    ...(optionalText("fulfillmentPolicy", 1000)
      ? { fulfillmentPolicy: optionalText("fulfillmentPolicy", 1000) }
      : {}),
    ...(optionalText("returnPolicy", 1000)
      ? { returnPolicy: optionalText("returnPolicy", 1000) }
      : {}),
    ...(optionalText("condition", 80) ? { condition: optionalText("condition", 80) } : {}),
    imageUrls: images,
    images,
    visibilityBoundary:
      "Profile visibility does not grant contact. Continue through TradeScout's protected request flow.",
  };
}

export function toPublicProfileOffer(row: any): PublicProfileOffer | null {
  const id = normalizeProfileOfferId(row?.id);
  const offerType = String(row?.offer_type ?? row?.offerType ?? "").trim();
  const isActive = Boolean(row?.is_active ?? row?.isActive);
  if (!id || !isActive || (offerType !== "service" && offerType !== "item")) return null;

  const title = sanitizePublicProfileOfferText(row?.title).slice(0, 100);
  if (!title) return null;
  const description = sanitizePublicProfileOfferText(row?.description);
  const sellerUserId = cleanText(row?.seller_user_id ?? row?.sellerUserId, 128);
  if (!sellerUserId) return null;
  const rawServiceDuration = row?.service_duration_minutes ?? row?.serviceDurationMinutes;
  const rawItemStock = row?.item_stock_quantity ?? row?.itemStockQuantity;
  const rawPrice = Number(row?.price || 0);
  const rawShippingCost = Number(row?.shipping_cost ?? row?.shippingCost ?? 0);
  const rawCurrency = cleanText(row?.currency, 3).toUpperCase();
  const rawFulfillmentMode = cleanText(row?.fulfillment_mode ?? row?.fulfillmentMode, 80);
  const fulfillmentMode = new Set([
    "manual_review",
    "scheduled_service",
    "shipping",
    "pickup",
    "digital",
  ]).has(rawFulfillmentMode)
    ? rawFulfillmentMode
    : "manual_review";

  return {
    id,
    sellerUserId,
    title,
    description: description || null,
    offerType,
    price: Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0,
    currency: /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "USD",
    serviceCategory:
      sanitizePublicProfileOfferText(
        cleanText(row?.service_category ?? row?.serviceCategory, 120)
      ) || null,
    serviceDurationMinutes:
      rawServiceDuration === null || rawServiceDuration === undefined
        ? null
        : Number(rawServiceDuration) || null,
    itemSku: sanitizePublicProfileOfferText(cleanText(row?.item_sku ?? row?.itemSku, 120)) || null,
    itemStockQuantity:
      rawItemStock === null || rawItemStock === undefined ? null : Number(rawItemStock) || 0,
    fulfillmentMode,
    shippingCost: Number.isFinite(rawShippingCost) && rawShippingCost >= 0 ? rawShippingCost : 0,
    isActive: true,
    metadata: safeMetadata(row?.metadata),
    createdAt: row?.created_at ?? row?.createdAt ?? null,
    updatedAt: row?.updated_at ?? row?.updatedAt ?? null,
  };
}

export async function getPublicProfileServiceOffer(
  pool: Pick<Pool, "query">,
  offerIdValue: unknown
): Promise<PublicProfileOffer | null> {
  const offerId = normalizeProfileOfferId(offerIdValue);
  if (!offerId) return null;

  try {
    const result = await pool.query(
      `SELECT *
       FROM profile_offers
       WHERE id = $1
         AND is_active = true
         AND offer_type = 'service'
       LIMIT 1`,
      [offerId]
    );
    const offer = toPublicProfileOffer(result.rows[0]);
    if (!offer || !(await hasExposureAuthority(offer.sellerUserId))) return null;
    return offer;
  } catch (error: any) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("profile_offers") || error?.code === "42P01") return null;
    throw error;
  }
}
