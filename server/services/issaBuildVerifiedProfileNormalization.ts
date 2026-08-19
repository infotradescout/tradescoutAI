/* eslint-disable @typescript-eslint/no-explicit-any -- ISSA Build profile content is schema-owned JSON. */
import { eq } from "drizzle-orm";
import {
  ISSA_BUILD_BUSINESS_NAME,
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
  ISSA_BUILD_PROFILE_SLUG,
} from "@shared/issaBuildProfile";
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

const VERIFIED_HERO_COPY =
  "100% verified full-service Honey Onyx and Multi Green Onyx—from material sourcing, availability, and selection through custom fabrication, backlighting, installation, and project fulfillment.";
const VERIFIED_ABOUT_COPY =
  "ISSA Build is 100% verified by TradeScout for its business identity and full-service onyx scope. TradeScout manages the inquiry; ISSA Build handles material sourcing and availability, selection, custom fabrication, backlighting, installation, project-location review, and fulfillment for residential and commercial projects.";
const VERIFIED_SEO_COPY =
  "100% verified full-service Honey Onyx and Multi Green Onyx for residential and commercial projects, including sourcing, availability, material selection, custom fabrication, backlighting, installation, and fulfillment.";

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function buildVerifiedIssaBuildContentBlocks(): any[] {
  const blocks = JSON.parse(JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS)) as Array<
    Record<string, any>
  >;

  return blocks.map((block) => {
    const data = recordValue(block.data);

    if (block.type === "hero") {
      return {
        ...block,
        data: {
          ...data,
          teaser: VERIFIED_HERO_COPY,
        },
      };
    }

    if (block.type === "about") {
      return {
        ...block,
        data: {
          ...data,
          text: VERIFIED_ABOUT_COPY,
        },
      };
    }

    if (block.type === "trust") {
      return {
        ...block,
        data: {
          ...data,
          items: [
            "100% Verified by TradeScout",
            "Verified full-service scope: sourcing, availability, selection, fabrication, backlighting, installation, and fulfillment",
          ],
        },
      };
    }

    if (block.type === "premiumProduct") {
      const luxuryHouse = recordValue(data.luxuryHouse);
      return {
        ...block,
        data: {
          ...data,
          luxuryHouse: {
            ...luxuryHouse,
            designedWithLight: {
              ...recordValue(luxuryHouse.designedWithLight),
              body: "ISSA Build takes the project from material sourcing, availability, and selection through custom fabrication, backlighting design, installation, and final project fulfillment.",
            },
            capabilities: {
              ...recordValue(luxuryHouse.capabilities),
              body: "ISSA Build handles the complete project: material sourcing and availability, selection, custom fabrication, backlighting, installation, project-location review, and fulfillment for residential and commercial interiors.",
              items: ISSA_BUILD_FULL_SERVICE_SCOPE.map((title) => ({ title })),
            },
            consultation: {
              ...recordValue(luxuryHouse.consultation),
              title: "Start a Request.",
              body: "Tell TradeScout about the room, material, scale, location, and timing. TradeScout manages the inquiry and ISSA Build handles sourcing, availability, fabrication, backlighting, installation, and fulfillment.",
            },
          },
        },
      };
    }

    if (block.type === "cta") {
      return {
        ...block,
        data: {
          ...data,
          heading: "Start a Request",
          description:
            "Tell TradeScout about the space, material, scale, location, and timing. ISSA Build handles sourcing, availability, fabrication, backlighting, installation, and fulfillment.",
        },
      };
    }

    return block;
  });
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
    const sources = Array.isArray(business.sources)
      ? business.sources.filter((value): value is string => typeof value === "string")
      : [];

    await tx
      .update(businesses)
      .set({
        publicDiscoveryEnabled: true,
        profileData: {
          ...profileData,
          tagline: "100% verified full-service onyx, crafted for light.",
          description:
            "ISSA Build handles complete Honey Onyx and Multi Green Onyx projects for residential and commercial interiors, including material sourcing and availability, selection, custom fabrication, backlighting design and installation, custom onyx installation, project-location review, and fulfillment.",
          category: "Custom translucent onyx",
          services: [...ISSA_BUILD_FULL_SERVICE_SCOPE],
          importExtras: {
            ...importExtras,
            business_verification: ISSA_BUILD_VERIFICATION_STATUS,
            verification_percent: 100,
            verification_label: "100% Verified by TradeScout",
            verification_source: ISSA_BUILD_VERIFIED_BUSINESS_SOURCE,
            verification_scope: ["business_identity", "full_service_capability"],
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
        headline: "100% verified full-service onyx, crafted for light.",
        contentBlocks: buildVerifiedIssaBuildContentBlocks(),
        ctaConfig: {
          primary: {
            label: "Start a Request",
            kind: "message",
            value: "/direct-connect",
          },
        } as any,
        seoMeta: {
          ...recordValue(profile.seoMeta),
          title: "ISSA Build | 100% Verified Full-Service Onyx",
          description: VERIFIED_SEO_COPY,
        } as any,
        updatedAt: now,
      })
      .where(eq(profiles.id, profile.id));
  });
}
