/* eslint-disable @typescript-eslint/no-explicit-any -- Profile data is a schema-owned JSON document. */
import { eq } from "drizzle-orm";
import { businesses, profiles } from "@shared/schema";
import {
  JW_STONE_MANAGED_CONTACT,
  JW_STONE_PROFILE_SLUG,
} from "@shared/jwStonePresentation";
import { db } from "../db";

export const JW_STONE_MANAGED_CONTACT_SOURCE = "tradescout_managed_contact";

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

/**
 * Keeps the public JW Stone response destination under TradeScout management
 * without changing the business or profile owner. The physical address,
 * inventory, profile presentation, and owner account remain untouched.
 */
export async function provisionJwStoneManagedContact(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await db.transaction(async (tx) => {
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, JW_STONE_PROFILE_SLUG))
      .limit(1);
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, JW_STONE_PROFILE_SLUG))
      .limit(1);

    if (!business || !profile) {
      throw new Error("JW Stone managed contact requires the canonical business and profile");
    }
    if (String(profile.businessId || "") !== String(business.id)) {
      throw new Error("JW Stone profile is linked to a different business");
    }
    if (String(profile.ownerUserId || "") !== String(business.ownerUserId || "")) {
      throw new Error("JW Stone business and profile ownership records disagree");
    }
    if (business.status !== "active" || profile.status !== "published") {
      throw new Error("JW Stone must remain active and published before contact normalization");
    }

    const profileData = recordValue(business.profileData);
    const importExtras = recordValue(profileData.importExtras);
    const sources = Array.isArray(business.sources)
      ? business.sources.filter((value): value is string => typeof value === "string")
      : [];

    await tx
      .update(businesses)
      .set({
        profileData: {
          ...profileData,
          phone: JW_STONE_MANAGED_CONTACT.phone,
          email: JW_STONE_MANAGED_CONTACT.email,
          notificationEmail: JW_STONE_MANAGED_CONTACT.email,
          importExtras: {
            ...importExtras,
            contact_management: "tradescout_managed",
            managed_contact_phone: JW_STONE_MANAGED_CONTACT.phone,
            managed_contact_email: JW_STONE_MANAGED_CONTACT.email,
          },
        } as any,
        sources: Array.from(new Set([...sources, JW_STONE_MANAGED_CONTACT_SOURCE])),
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, business.id));
  });
}
