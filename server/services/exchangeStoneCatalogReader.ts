import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { sanitizePublicListingText } from "@shared/publicListingSafety";
import { pool } from "../db";
import { readPublicObjectBuffer } from "../publicMediaStorage";
import { exposureAuthoritySqlPredicate } from "./exposureAuthority";
import { stoneCatalog } from "../data/exchangeStoneCatalogIdentity";
import { projectPublicStone, validStonePublication, type StonePublicItem } from "./exchangeStoneDiscovery";

export function normalizeStoneDatabaseRow(row: Record<string, any>): Record<string, any> {
  return { ...row, sellerId: row.seller_id, categoryId: row.category_id, expiresAt: row.expires_at,
    createdAt: row.created_at, updatedAt: row.updated_at, isSellerVerified: row.is_seller_verified,
    requiresBuyerVerification: row.requires_buyer_verification, priceNegotiable: row.price_negotiable === true || row.price_type === "negotiable" };
}
export type StoneCatalogRead = { items: StonePublicItem[]; assets: Map<string, string>; configured: boolean };

/** One bounded read for this request. No supplier query, no public cost/margin fields. */
export async function readExchangeStoneCatalog(): Promise<StoneCatalogRead> {
  const secret = process.env.SESSION_SECRET || "";
  const empty = { items: [], assets: new Map<string, string>(), configured: false };
  if (secret.length < 24) return empty;
  const settings = await pool.query(`SELECT value FROM site_settings WHERE category = 'general'
    AND key = 'exchange_stone_retail_seller_user_id' AND is_active = true ORDER BY id LIMIT 2`);
  if (settings.rows.length !== 1 || typeof settings.rows[0].value !== "string" || !settings.rows[0].value.trim()) return empty;
  const sellerId = settings.rows[0].value;
  const query = new PgDialect().sqlToQuery(sql`
    SELECT l.* FROM marketplace_listings l
    JOIN marketplace_categories c ON c.id = l.category_id
    WHERE l.id IN ${[...stoneCatalog.keys()]} AND l.seller_id = ${sellerId}
      AND l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > now())
      AND c.name = 'Building Materials & Surfaces' AND c.is_active = true
      AND ${exposureAuthoritySqlPredicate(sql`l.seller_id`)}
    ORDER BY l.id COLLATE "C"
  `);
  const records = await pool.query(query.sql, query.params);
  const rows = records.rows.map(normalizeStoneDatabaseRow).filter(row =>
    stoneCatalog.has(row.id) && validStonePublication(row, sellerId, secret) &&
    sanitizePublicListingText(row.title, 200) === row.title &&
    sanitizePublicListingText(row.description, 4000) === row.description &&
    [row.condition, row.specifications.material, row.specifications.referenceSizesInches, row.specifications.exactSlab].every(value => value == null || (typeof value === "string" && value.length <= 1000 && sanitizePublicListingText(value, 1000) === value)));
  return { configured: true, items: rows.map(projectPublicStone), assets: new Map(rows.map(row => [row.id, row.specifications.retailPublication.assetSha256])) };
}

/** Only the reviewed immutable TradeScout copy is served; never redirect to a supplier/Drive URL. */
export async function readExchangeStonePhoto(id: string, digest: string): Promise<Buffer | null> {
  if (!stoneCatalog.has(id) || !/^[a-f0-9]{64}$/.test(digest)) return null;
  // Retail publication stores the photo and listing in one PostgreSQL transaction.
  // Do not let unrelated R2/S3 credentials change the read owner after that commit.
  // Reuse the existing object adapter and bounded read rather than a second decoder.
  const client = {
    async send(command: unknown) {
      const { createPostgresPublicMediaS3Client } = await import("../../shared/postgresPublicMediaS3Client.mjs");
      const store = createPostgresPublicMediaS3Client({
        query: (text: string, values: unknown[] = []) => pool.query(text, values),
      });
      return store.send(command);
    },
  };
  const bytes = await readPublicObjectBuffer({
    key: `public-media/images/exchange/stone/${id}/${digest}.webp`,
    maxBytes: 12000000, client, bucketName: "postgres-public-media",
  });
  if (!bytes || bytes.length < 12 || bytes.length > 12000000 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  return createHash("sha256").update(bytes).digest("hex") === digest ? bytes : null;
}
