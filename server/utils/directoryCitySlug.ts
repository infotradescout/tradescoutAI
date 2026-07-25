import { sql } from "drizzle-orm";
import { businesses } from "@shared/schema";

/**
 * Canonical SQL projection for directory city slugs.
 *
 * Lowercase before replacing punctuation so capital letters remain part of
 * the slug, then trim separator runs from both ends.
 */
export function sqlDirectoryBusinessCitySlug() {
  return sql`trim(both '-' from regexp_replace(lower(coalesce(${businesses.profileData} ->> 'city', '')), '[^a-z0-9]+', '-', 'g'))`;
}
