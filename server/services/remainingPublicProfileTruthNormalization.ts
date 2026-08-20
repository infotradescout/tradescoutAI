import { and, eq } from "drizzle-orm";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import {
  PRECISION_AERIAL_BUSINESS_NAME,
  PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_PUBLIC_HEADLINE,
  PRECISION_AERIAL_PUBLIC_SEO_DESCRIPTION,
  PRECISION_AERIAL_STEWARD_PROVIDER,
} from "@shared/precisionAerialProfile";
import { businesses, profiles, users } from "@shared/schema";
import { db } from "../db";
import { ADMIN_MANAGED_PROFILE_SOURCE } from "./ownerConfirmedDirectProfile";

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

async function normalizePrecisionAerialPublicTruth(): Promise<void> {
  await db.transaction(async (tx) => {
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, PRECISION_AERIAL_PROFILE_SLUG))
      .limit(1);
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, PRECISION_AERIAL_PROFILE_SLUG))
      .limit(1);
    if (!business || !profile) {
      throw new Error(`${PRECISION_AERIAL_BUSINESS_NAME} truth normalization requires its records`);
    }
    if (business.status !== "active" || profile.status !== "published") {
      throw new Error(`${PRECISION_AERIAL_BUSINESS_NAME} must remain active and published`);
    }
    if (business.claimStatus !== "unclaimed" || business.publicDiscoveryEnabled !== false) {
      throw new Error(
        `${PRECISION_AERIAL_BUSINESS_NAME} is no longer an unclaimed direct-only profile`
      );
    }
    if (String(profile.businessId || "") !== String(business.id)) {
      throw new Error(`${PRECISION_AERIAL_BUSINESS_NAME} profile is linked to another business );
    }
    if (String(profile.ownerUserId || "") !== String(business.ownerUserId || "")) {
      throw new Error(`${PRECISION_AERIAL_BUSINESS_NAME} ownership records disagree`);
    }

    const [owner] = await tx
      .select({ provider: users.provider, preferences: users.preferences })
      .from(users)
      .where(eq(users.id, String(profile.ownerUserId)))
      .limit(1);
    const preferences = recordValue(owner?.preferences);
    const marker = recordValue(preferences.internalProfileSteward);
    if (
      owner?.provider !== PRECISION_AERIAL_STEWARD_PROVIDER ||
      marker.profileSlug !== PRECISION_AERIAL_PROFILE_SLUG ||
      marker.source !== ADMIN_MANAGED_PROFILE_SOURCE
    ) {
      throw new Error(`${PRECISION_AERIAL_BUSINESS_NAME} is not under the exact profile steward`);
    }

    const seoMeta = recordValue(profile.seoMeta);
    await tx
      .update(profiles)
      .set({
        headline: PRECISION_AERIAL_PUBLIC_HEADLINE,
        contentBlocks: PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS as any,
        ctaConfig: {
          primary: {
            label: "Start a Request",
            kind: "message",
            value: "/direct-connect",
            action: "direct_connect",
          },
        } as any,
        seoMeta: {
          ...seoMeta,
          title: "Precision Aerial Services | Pensacola Drone Photo and Video",
          description: PRECISION_AERIAL_PUBLIC_SEO_DESCRIPTION,
        } as any,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(profiles.id, profile.id),
          eq(profiles.ownerUserId, String(profile.ownerUserId)),
          eq(profiles.status, "published")
        )
      );
  });
}

async function normalizeJwStoneRequestLanguage(): Promise<void> {
  await db.transaction(async (tx) => {
    const [business] = await tx
      .select({ id: businesses.id, status: businesses.status })
      .from(businesses)
      .where(eq(businesses.slug, JW_STONE_PROFILE_SLUG))
      .limit(1);
    const [profile] = await tx
      .select({ id: profiles.id, businessId: profiles.businessId, status: profiles.status })
      .from(profiles)
      .where(eq(profiles.slug, JW_STONE_PROFILE_SLUG))
      .limit(1);
    if (!business || !profile)
      throw new Error("JW Stone request normalization requires its records");
    if (business.status !== "active" || profile.status !== "published") {
      throw new Error("JW Stone must remain active and published");
    }
    if (String(profile.businessId || "") !== String(business.id)) {
      throw new Error("JW Stone profile is linked to another business");
    }

    await tx
      .update(profiles)
      .set({
        ctaConfig: {
          primary: {
            label: "Start a Request",
            kind: "message",
            value: "/direct-connect",
          },
        } as any,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, profile.id));
  });
}

export async function normalizeRemainingPublicProfileTruth(): Promise<void> {
  await normalizePrecisionAerialPublicTruth();
  await normalizeJwStoneRequestLanguage();
}
