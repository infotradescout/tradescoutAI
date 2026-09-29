import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { pool } from "../db";
import { storage } from "../storage";
import { toPublicExchangeListing, normalizePublicExchangeListingId } from "../publicExchangeListing";
import { toPublicProfileOffer } from "../publicProfileOffer";
import { listProfileOfferImageUrls } from "../../shared/profileOfferShare";
import { sanitizePublicListingText } from "../../shared/publicListingSafety";
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME, SELL_CATEGORY_FIELDS } from "../../shared/exchangeListingRules";
import { resolvePersistedExchangeCategorySlug } from "../publicExchangeListingHtml";
import { getPublicProfileCatalogExchangeItem, listPublicProfileCatalogExchangeItems } from "../profileCatalogExchange";
import { exposureAuthoritySqlPredicate, hasExposureAuthority } from "./exposureAuthority";
import { readExchangeStoneCatalog } from "./exchangeStoneCatalogReader";

export const PUBLIC_EXCHANGE_PAGE_SIZE = 24;
export const PUBLIC_EXCHANGE_SITEMAP_PAGE_SIZE = 1000;
export type PublicExchangeRecord = Record<string, any> & { id: string; title: string; category: string; publicDetailPath: string };
export type PublicExchangeIndexEntry = { id: string; title: string; category: string; publicDetailPath: string; updatedAt: string | null };
const dialect = new PgDialect();
const clean = (value: unknown, length = 200) => sanitizePublicListingText(value, length);

export function publicExchangePath(category: string, id: string): string {
  return `/exchange/${encodeURIComponent(category)}/${encodeURIComponent(id)}`;
}
export function validPublicExchangeId(id: string): boolean {
  return Boolean(normalizePublicExchangeListingId(id)) || /^profile-catalog-item:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 320;
}
export function isPublicDiscoveryCategory(value: string): boolean {
  return Object.hasOwn(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME, value);
}
function date(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function publicRecord(value: Record<string, any>, categoryName?: unknown): PublicExchangeRecord | null {
  const id = String(value.id || "");
  const title = clean(value.title);
  if (!validPublicExchangeId(id) || !title) return null;
  const category = resolvePersistedExchangeCategorySlug(value, categoryName);
  const common = ["source", "commerceChannel", "sellerBrand", "priceUnit", "material", "referenceSizesInches", "exactSlab", "availability", "shippingPolicy", "exchangeCategorySlug", "itemCategory", "profileOfferId", "commerceMode", "catalogKind", "reviewRequired", "fulfillmentMode", "fulfillmentPolicy", "returnPolicy", "currency", "titleStatus", "authenticated", "graded", "grade", "listingType"];
  const fields = (SELL_CATEGORY_FIELDS as Record<string, readonly { key: string }[]>)[category] || [];
  const publicKeys = new Set([...common, ...fields.map(field => field.key)]);
  const specifications = Object.fromEntries(Object.entries(value.specifications || {}).filter(([key, item]) =>
    publicKeys.has(key) && (item == null || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item) || typeof item === "string")
  ));
  const select = (input: unknown, keys: string[]) => input && typeof input === "object" ? Object.fromEntries(keys.flatMap(key => {
    const v = (input as Record<string, unknown>)[key];
    return typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v) ? [[key, v]] : [];
  })) : undefined;
  return { ...value, id, title, category, specifications,
    shippingQuote: select(value.shippingQuote, ["carrier", "serviceName", "estimatedCost", "buyerPays", "sellerAbsorbs", "labelPurchaseMode"]),
    valueGuidance: select(value.valueGuidance, ["suggestedRangeLow", "suggestedRangeHigh", "medianCompPrice", "confidence", "sampleSize"]),
    publicDetailPath: publicExchangePath(category, id) };
}
function indexEntry(value: PublicExchangeRecord): PublicExchangeIndexEntry {
  return { id: value.id, title: value.title, category: value.category, publicDetailPath: value.publicDetailPath, updatedAt: date(value.updatedAt || value.createdAt) };
}
function camelRow(row: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase()), value]));
}
function projectOffer(row: Record<string, any>): PublicExchangeRecord | null {
  const offer = toPublicProfileOffer(row);
  if (!offer || offer.offerType !== "item") return null;
  const metadata = offer.metadata;
  return publicRecord({
    id: `profile-offer-${offer.id}`, sellerId: offer.sellerUserId,
    title: offer.title, description: offer.description || "", price: row.price == null ? null : offer.price, currency: offer.currency,
    pricingMode: row.price == null ? "request_quote" : "fixed", images: listProfileOfferImageUrls(metadata),
    sourceType: "profile_offer", profileOfferId: offer.id,
    sellerName: clean(row.public_seller_name || "TradeScout seller", 160),
    condition: clean(metadata.condition || "", 40), category: metadata.exchangeCategorySlug || metadata.itemCategory,
    specifications: { source: "profile_offer", profileOfferId: offer.id, exchangeCategorySlug: metadata.exchangeCategorySlug,
      itemCategory: metadata.itemCategory, reviewRequired: true, fulfillmentMode: offer.fulfillmentMode,
      fulfillmentPolicy: clean(metadata.fulfillmentPolicy, 1000), returnPolicy: clean(metadata.returnPolicy, 1000) },
    itemStockQuantity: offer.itemStockQuantity, inStock: offer.itemStockQuantity === null ? null : offer.itemStockQuantity > 0,
    isLocalPickupOnly: offer.fulfillmentMode === "pickup", willShip: offer.fulfillmentMode === "shipping", shippingCost: offer.shippingCost,
    status: "active", createdAt: row.created_at, updatedAt: row.updated_at,
    contactAccess: { mode: "decision_card_required", decisionScope: `marketplace_listing:profile-offer-${offer.id}` },
  });
}

/** A public read is not buyer eligibility. No user tier, viewer location, cookie or user agent can hide a published listing. */
export async function readPublicExchangeListing(id: string): Promise<PublicExchangeRecord | null> {
  if (!validPublicExchangeId(id)) return null;
  const profile = await getPublicProfileCatalogExchangeItem(id);
  if (profile) return publicRecord(profile);
  if (id.startsWith("profile-catalog-")) return null;
  if (id.startsWith("tradescout-stone-")) {
    // The existing signed retail publication reader is the only source. Never read private JW pricing.
    const catalog = await readExchangeStoneCatalog();
    const item = catalog.items.find(item => item.id === id);
    return item ? publicRecord({ ...item, images: [`/exchange/media/${encodeURIComponent(id)}`] }) : null;
  }
  if (id.startsWith("profile-offer-")) {
    const result = await pool.query("SELECT * FROM profile_offers WHERE id = $1 AND is_active = true AND offer_type = 'item' LIMIT 1", [id.slice("profile-offer-".length)]);
    const row = result.rows[0];
    if (!row || !(await hasExposureAuthority(String(row.seller_user_id)))) return null;
    return projectOffer(row);
  }
  const source = await storage.getMarketplaceListing(id);
  const item = toPublicExchangeListing(source);
  if (!item || !(await hasExposureAuthority(String(item.sellerId || "")))) return null;
  const result = await pool.query("SELECT name FROM marketplace_categories WHERE id = $1 AND is_active = true LIMIT 1", [item.categoryId]);
  if (!result.rows[0]) return null;
  return publicRecord({ ...item, ...(source?.price == null ? { price: null, pricingMode: "request_quote" } : {}) }, result.rows[0].name);
}

/** Apply publication, expiry and the existing Trust/CVS exposure decision BEFORE pagination. Never rank by paid plan. */
function ordinaryPublicRows() {
  return sql`
    SELECT 'marketplace'::text AS source_kind, l.id::text AS source_id, to_jsonb(l) AS payload, c.name AS category_name
    FROM marketplace_listings l JOIN marketplace_categories c ON c.id = l.category_id
    WHERE l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > now()) AND c.is_active = true
      AND l.id NOT LIKE 'tradescout-stone-%' AND COALESCE(l.specifications->>'commerceChannel', '') <> 'tradescout_stone_retail'
      AND ${exposureAuthoritySqlPredicate(sql`l.seller_id`)}
    UNION ALL
    SELECT 'profile_offer'::text, ('profile-offer-' || p.id::text), to_jsonb(p), COALESCE(p.metadata->>'exchangeCategorySlug', 'other')
    FROM profile_offers p WHERE p.is_active = true AND p.offer_type = 'item'
      AND ${exposureAuthoritySqlPredicate(sql`p.seller_user_id`)}
  `;
}
function dbCategorySql() {
  const categories = Object.entries(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME);
  const candidates = [sql`payload->'specifications'->>'exchangeCategorySlug'`, sql`payload->>'category'`,
    sql`payload->'metadata'->>'exchangeCategorySlug'`, sql`category_name`,
    sql`payload->'specifications'->>'itemCategory'`, sql`payload->'metadata'->>'itemCategory'`];
  return sql`CASE ${sql.join(candidates.flatMap(candidate => categories.map(([slug, name]) =>
    sql`WHEN lower(trim(COALESCE(${candidate}, ''))) IN (${slug}, ${name.toLowerCase()}) THEN ${slug}`
  )), sql` `)} ELSE 'other' END`;
}
async function projectedCatalogs(category?: string): Promise<PublicExchangeRecord[]> {
  const [profiles, stone] = await Promise.all([listPublicProfileCatalogExchangeItems({ category }), readExchangeStoneCatalog()]);
  return [...profiles, ...stone.items].flatMap(item => {
    const record = publicRecord(item.id.startsWith("tradescout-stone-") ? { ...item, images: [`/exchange/media/${encodeURIComponent(item.id)}`] } : item);
    return record && (!category || record.category === category) ? [record] : [];
  }).sort((a, b) => a.id.localeCompare(b.id, "en"));
}

export async function readPublicExchangePage(page: number, pageSize = PUBLIC_EXCHANGE_PAGE_SIZE, category?: string): Promise<{ items: PublicExchangeRecord[]; total: number; page: number; pageSize: number }> {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > PUBLIC_EXCHANGE_SITEMAP_PAGE_SIZE) throw new Error("Invalid public Exchange page");
  if (category && !isPublicDiscoveryCategory(category)) return { items: [], total: 0, page, pageSize };
  const catalogs = await projectedCatalogs(category);
  const filter = category ? sql`WHERE ${dbCategorySql()} = ${category}` : sql``;
  const countSql = dialect.sqlToQuery(sql`SELECT count(*)::text AS n FROM (${ordinaryPublicRows()}) public_items ${filter}`);
  const countResult = await pool.query(countSql.sql, countSql.params);
  const ordinaryCount = Number(countResult.rows[0]?.n || 0);
  if (!Number.isSafeInteger(ordinaryCount) || ordinaryCount < 0) throw new Error("Invalid public Exchange count");
  const offset = (page - 1) * pageSize;
  const ordinaryLimit = Math.max(0, Math.min(pageSize, ordinaryCount - offset));
  const rowsSql = dialect.sqlToQuery(sql`SELECT * FROM (${ordinaryPublicRows()}) public_items ${filter} ORDER BY source_id COLLATE "C", source_kind LIMIT ${ordinaryLimit} OFFSET ${offset}`);
  const result = ordinaryLimit ? await pool.query(rowsSql.sql, rowsSql.params) : { rows: [] };
  const ordinary = result.rows.flatMap(row => {
    const item = row.source_kind === "profile_offer" ? projectOffer(row.payload) : toPublicExchangeListing(camelRow(row.payload));
    const record = item ? publicRecord({ ...item, ...(row.source_kind === "marketplace" && row.payload.price == null ? { price: null, pricingMode: "request_quote" } : {}) }, row.category_name) : null;
    return record ? [record] : [];
  });
  const catalogOffset = Math.max(0, offset - ordinaryCount);
  const remaining = Math.max(0, pageSize - ordinaryLimit);
  return { items: [...ordinary, ...catalogs.slice(catalogOffset, catalogOffset + remaining)], total: ordinaryCount + catalogs.length, page, pageSize };
}
export async function readPublicExchangeIndex(page: number, pageSize = PUBLIC_EXCHANGE_SITEMAP_PAGE_SIZE) {
  const result = await readPublicExchangePage(page, pageSize);
  return { ...result, items: result.items.map(indexEntry) };
}
