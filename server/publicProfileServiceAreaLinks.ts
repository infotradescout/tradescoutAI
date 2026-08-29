import type { Request, Response } from "express";
import {
  buildProfileServiceAreaUrl,
  resolveProfileServiceAreaHub,
} from "@shared/profileServiceAreaShare";
import { listFactBearingProfileServices } from "@shared/profileServiceShare";
import { storage } from "./storage";
import { resolvePublicOrigin } from "./utils/publicOrigin";
import { buildCanonicalPublicProfileProjection } from "./publicProfileProjection";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Gives platform-host profile roots one crawlable link to the substantial
 * service-area hub generated from the same published profile content. Custom
 * domains already advertise the hub through their host-local sitemap.
 */
export async function attachPublicProfileServiceAreaLink(
  req: Request,
  res: Response
): Promise<void> {
  const requestPath = String(req.path || "").replace(/\/+$/, "") || "/";
  const match = requestPath.match(/^\/u\/([^/]+)$/i);
  if (!match) return;

  let profileSlug = "";
  try {
    profileSlug = decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    return;
  }

  const storedProfile = await storage.getProfileBySlugPublic(profileSlug);
  if (!storedProfile) return;
  const projection = buildCanonicalPublicProfileProjection({ profile: storedProfile });
  if (!projection) return;
  const profile = projection.profile;
  if (profile.seoMeta?.customDomain) return;
  const hub = resolveProfileServiceAreaHub(profile.contentBlocks);
  const services = listFactBearingProfileServices(profile.contentBlocks);
  if (!hub || services.length === 0) return;

  const profileUrl = `${resolvePublicOrigin(req)}/u/${encodeURIComponent(profile.slug)}`;
  const hubUrl = buildProfileServiceAreaUrl(profileUrl);
  if (!hubUrl) return;

  const summary = hub.description || `Published service coverage: ${hub.areas.join(" · ")}`;
  const section = `<section data-seo-profile-service-area-link="true"><h2>Service areas</h2><p>${escapeHtml(summary)}</p><p><a href="${escapeHtml(hubUrl)}">View published service areas</a></p></section>`;
  const originalSend = res.send.bind(res);
  res.send = ((body?: any) => {
    if (
      typeof body === "string" &&
      /<html[\s>]/i.test(body) &&
      !body.includes('data-seo-profile-service-area-link="true"')
    ) {
      const updated = /<\/article>/i.test(body)
        ? body.replace(/<\/article>/i, `${section}</article>`)
        : body.replace(/<\/main>/i, `${section}</main>`);
      return originalSend(updated);
    }
    return originalSend(body);
  }) as typeof res.send;
}
