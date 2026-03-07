import type { APIRequestContext } from "@playwright/test";

type BusinessCandidate = {
  slug?: string | null;
  name?: string | null;
  id?: string | null;
};

function normalizeBusinessRows(payload: any): BusinessCandidate[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.businesses)) return payload.businesses;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

async function canLoadPublicBusiness(request: APIRequestContext, slug: string): Promise<boolean> {
  const safeSlug = String(slug || "").trim();
  if (!safeSlug) return false;
  const checks = [
    `/api/public/businesses/${encodeURIComponent(safeSlug)}`,
    `/api/business-profile/slug/${encodeURIComponent(safeSlug)}`,
    `/business/${encodeURIComponent(safeSlug)}`,
  ];

  for (const url of checks) {
    try {
      const res = await request.get(url);
      if (res.ok()) return true;
    } catch {
      // fail-soft
    }
  }
  return false;
}

export async function resolveBusinessSlug(
  request: APIRequestContext,
  preferredSlug?: string
): Promise<string | null> {
  if (preferredSlug && (await canLoadPublicBusiness(request, preferredSlug))) {
    return preferredSlug;
  }

  const authUserEndpoints = ["/api/auth/user", "/api/user"];
  for (const endpoint of authUserEndpoints) {
    try {
      const res = await request.get(endpoint);
      if (!res.ok()) continue;
      const payload = await res.json().catch(() => null);
      const candidates = [
        payload?.businessSlug,
        payload?.business?.slug,
        payload?.businessProfileSlug,
        payload?.profile?.slug,
      ]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean);
      for (const slug of candidates) {
        if (await canLoadPublicBusiness(request, slug)) return slug;
      }
    } catch {
      // fail-soft
    }
  }

  const directoryEndpoints = [
    "/api/public/businesses?limit=50",
    "/api/businesses?limit=50",
    "/api/businesses?limit=50&offset=0",
    "/api/recent-businesses?limit=50",
  ];

  for (const endpoint of directoryEndpoints) {
    try {
      const res = await request.get(endpoint);
      if (!res.ok()) continue;
      const payload = await res.json().catch(() => null);
      const rows = normalizeBusinessRows(payload);
      const rankedCandidates = rows
        .map((row) => (typeof row?.slug === "string" ? row.slug.trim() : ""))
        .filter(Boolean);
      for (const slug of rankedCandidates) {
        if (await canLoadPublicBusiness(request, slug)) {
          return slug;
        }
      }
    } catch {
      // fail-soft
    }
  }

  return null;
}
