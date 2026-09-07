/* eslint-disable @typescript-eslint/no-explicit-any -- ISSA Build profile content is schema-owned JSON. */
import { eq } from "drizzle-orm";
import {
  ISSA_BUILD_BUSINESS_NAME,
  ISSA_BUILD_PROFILE_SLUG,
  ISSA_BUILD_LOCAL_DISCOVERY,
} from "@shared/issaBuildProfile";
import { buildIssaBuildBusinessContentBlocks, issaBuildBusinessText } from "@shared/issaBuildPageContent";
import { LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE } from "@shared/businessDiscoveryAuthority";
import { businesses, profiles } from "@shared/schema";
import { db } from "../db";

export const ISSA_BUILD_VERIFIED_BUSINESS_SOURCE = "operator_verified_business_profile";
export const ISSA_BUILD_VERIFICATION_STATUS = "fully_verified";
export const ISSA_BUILD_FULL_SERVICE_SCOPE = [
  "Material selection",
  "Material sourcing and availability",
  "Custom onyx fabrication",
  "Backlighting design and installation",
  "Custom onyx installation",
  "Residential and commercial projects",
  "Project location and fulfillment",
  "Project consultation",
] as const;

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

/** Verification decorates the business record; it does not replace it with a product page. */
export function buildVerifiedIssaBuildContentBlocks(existingContentBlocks: unknown = []): any[] {
  return buildIssaBuildBusinessContentBlocks(existingContentBlocks);
}

/**
 * Final ISSA Build normalization after the general profile provisioner and the
 * shared managed-contact pass. Verification belongs to this exact business
 * profile; it must not be projected from the TradeScout steward onto sibling
 * profiles. The pending owner-account attachment remains an administrative
 * control state only and does not reduce ISSA Build's verified operating scope.
 */
export async function normalizeIssaBuildVerifiedFullServiceProfile(): Promise<void> {
  await db.transaction(async (tx) => {
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, ISSA_BUILD_PROFILE_SLUG))
      .limit(1);
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, ISSA_BUILD_PROFILE_SLUG))
      .limit(1);

    if (!business || !profile) {
      throw new Error(`${ISSA_BUILD_BUSINESS_NAME} verification requires its canonical records`);
    }
    if (String(profile.businessId || "") !== String(business.id)) {
      throw new Error(`${ISSA_BUILD_BUSINESS_NAME} profile is linked to a different business`);
    }
    if (String(profile.ownerUserId || "") !== String(business.ownerUserId || "")) {
      throw new Error(
        `${ISSA_BUILD_BUSINESS_NAME} business and profile ownership records disagree`
      );
    }
    if (business.status !== "active" || profile.status !== "published") {
      throw new Error(`${ISSA_BUILD_BUSINESS_NAME} must remain active and published`);
    }

    const now = new Date();
    const profileData = recordValue(business.profileData);
    const importExtras = recordValue(profileData.importExtras);
    const seoMeta = recordValue(profile.seoMeta);
    const sources = Array.isArray(business.sources)
      ? business.sources.filter((value): value is string => typeof value === "string")
      : [];

    await tx
      .update(businesses)
      .set({
        publicDiscoveryEnabled: true,
        profileData: {
          ...profileData,
          tagline: issaBuildBusinessText(profileData.tagline, ISSA_BUILD_LOCAL_DISCOVERY.headline),
          description: issaBuildBusinessText(profileData.description, ISSA_BUILD_LOCAL_DISCOVERY.description),
          category: profileData.category && profileData.category !== "Natural Onyx"
            ? profileData.category : ISSA_BUILD_LOCAL_DISCOVERY.primaryCategory,
          services: Array.from(new Set([
            ...(Array.isArray(profileData.services) ? profileData.services : []),
            ...ISSA_BUILD_LOCAL_DISCOVERY.tradeServices,
            ...ISSA_BUILD_LOCAL_DISCOVERY.services.map((service) => service.title),
            ...ISSA_BUILD_FULL_SERVICE_SCOPE,
          ])),
          importExtras: {
            ...importExtras,
            business_verification: ISSA_BUILD_VERIFICATION_STATUS,
            verification_percent: 100,
            verification_label: "100% Verified by TradeScout",
            verification_source: ISSA_BUILD_VERIFIED_BUSINESS_SOURCE,
            verification_scope: ["business_identity", "full_service_capability"],
            service_area_mode: LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE,
            service_area_resolution: "project_location_reviewed_through_request",
            request_routing: "tradescout_managed_inquiry_funnel",
            service_delivery: "issa_build",
          },
        } as any,
        sources: Array.from(new Set([...sources, ISSA_BUILD_VERIFIED_BUSINESS_SOURCE])),
        updatedAt: now,
      })
      .where(eq(businesses.id, business.id));

    await tx
      .update(profiles)
      .set({
        headline: issaBuildBusinessText(profile.headline, ISSA_BUILD_LOCAL_DISCOVERY.headline),
        contentBlocks: buildVerifiedIssaBuildContentBlocks(profile.contentBlocks),
        ctaConfig: {
          primary: {
            label: "Start a Request",
            kind: "message",
            value: "/direct-connect",
          },
        } as any,
        seoMeta: {
          ...seoMeta,
          title: issaBuildBusinessText(seoMeta.title, ISSA_BUILD_LOCAL_DISCOVERY.title),
          description: issaBuildBusinessText(seoMeta.description, ISSA_BUILD_LOCAL_DISCOVERY.description),
        } as any,
        updatedAt: now,
      })
      .where(eq(profiles.id, profile.id));
  });
}
