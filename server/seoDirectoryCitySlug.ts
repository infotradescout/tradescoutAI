import { sql } from "drizzle-orm";
import { businesses } from "@shared/schema";

/**
 * Canonical city slug for every server-rendered directory and sitemap surface.
 * Lowercase must happen before the regex so an uppercase first letter is not
 * replaced with a hyphen (for example, Pensacola -> -ensacola).
 */
export function slugifyDirectoryCityName(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sqlDirectoryCitySlugExpr() {
  return sql`trim(both '-' from regexp_replace(lower(coalesce(${businesses.profileData} ->> 'city', '')), '[^a-z0-9]+', '-', 'g'))`;
}
