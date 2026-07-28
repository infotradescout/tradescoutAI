import { eq } from "drizzle-orm";
import { workRequests } from "@shared/schema";
import { db } from "../db";

const AFFILIATE_SHARE_SLUG_PATTERN = /^[a-z0-9-]{3,64}$/i;
const DIRECT_CONNECT_SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

export function isAffiliateShareSlugSyntaxValid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    AFFILIATE_SHARE_SLUG_PATTERN.test(value)
  );
}

export function isDirectConnectShareToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    DIRECT_CONNECT_SHARE_TOKEN_PATTERN.test(value)
  );
}

export async function directConnectOwnsShareSlug(
  slug: string,
  workRequestExists: (shareToken: string) => Promise<boolean>
): Promise<boolean> {
  if (!isDirectConnectShareToken(slug)) return false;
  return workRequestExists(slug);
}

export function affiliateShareSlugError(slug: string): string | null {
  if (!isAffiliateShareSlugSyntaxValid(slug)) {
    return "slug must be 3-64 chars (letters, numbers, dash)";
  }
  return isDirectConnectShareToken(slug) ? "slug format is reserved for Direct Connect" : null;
}

export async function directConnectOwnsPersistedShareSlug(slug: string): Promise<boolean> {
  return directConnectOwnsShareSlug(slug, async (shareToken) => {
    const [row] = await db
      .select({ id: workRequests.id })
      .from(workRequests)
      .where(eq(workRequests.shareToken, shareToken))
      .limit(1);
    return Boolean(row?.id);
  });
}
