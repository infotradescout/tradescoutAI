/* eslint-disable @typescript-eslint/no-explicit-any -- Profile data is a schema-owned JSON document. */
import { eq } from "drizzle-orm";
import type { ManagedPartnerProfileDefinition } from "@shared/managedPartnerProfileRegistry";
import { businesses, profiles } from "@shared/schema";
import { TRADESCOUT_MANAGED_CONTACT } from "@shared/tradeScoutManagedContact";
import { db } from "../db";
import { getRuntimeManagedPartnerProfileDefinitions } from "./managedPartnerIntake";

export const JW_STONE_MANAGED_CONTACT_SOURCE = "tradescout_managed_contact";
export const TRADESCOUT_MANAGED_CONTACT_SOURCE = JW_STONE_MANAGED_CONTACT_SOURCE;

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function normalizeManagedPartnerContact(
  definition: ManagedPartnerProfileDefinition
): Promise<void> {
  await db.transaction(async (tx) => {
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, definition.slug))
      .limit(1);
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, definition.slug))
      .limit(1);

    if (!business || !profile) {
      throw new Error(`${definition.displayName} managed contact requires its canonical records`);
    }
    if (String(profile.businessId || "") !== String(business.id)) {
      throw new Error(`${definition.displayName} profile is linked to a different business`);
    }
    if (String(profile.ownerUserId || "") !== String(business.ownerUserId || "")) {
      throw new Error(`${definition.displayName} business and profile ownership records disagree`);
    }
    if (business.status !== "active" || profile.status !== "published") {
      throw new Error(`${definition.displayName} must remain active and published`);
    }

    const profileData = recordValue(business.profileData);
    const importExtras = recordValue(profileData.importExtras);
    const sources = Array.isArray(business.sources)
      ? business.sources.filter((value): value is string => typeof value === "string")
      : [];
    const phone = definition.expectedPhone || TRADESCOUT_MANAGED_CONTACT.phone;
    const email = definition.expectedEmail || TRADESCOUT_MANAGED_CONTACT.email;
    const notificationEmail =
      definition.expectedNotificationEmail || TRADESCOUT_MANAGED_CONTACT.email;

    await tx
      .update(businesses)
      .set({
        profileData: {
          ...profileData,
          phone,
          email,
          notificationEmail,
          importExtras: {
            ...importExtras,
            contact_management: "tradescout_managed",
            managed_contact_phone: phone,
            managed_contact_email: email,
          },
        } as any,
        sources: Array.from(new Set([...sources, TRADESCOUT_MANAGED_CONTACT_SOURCE])),
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, business.id));
  });
}

/**
 * Normalizes each managed profile in an independent transaction. Static
 * partners and intake-queue partners promoted to live are resolved together.
 * One missing or malformed partner cannot roll back contact corrections that
 * already completed for other partners moving concurrently.
 */
export async function provisionTradeScoutManagedPartnerContacts(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const runtimeDefinitions = await getRuntimeManagedPartnerProfileDefinitions();
  const managedDefinitions = runtimeDefinitions.filter(
    (definition) => definition.contactMode === "tradescout_managed"
  );
  const failures: string[] = [];

  for (const definition of managedDefinitions) {
    try {
      await normalizeManagedPartnerContact(definition);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${definition.slug}: ${message}`);
      console.error(
        `[profile-provisioning] ${definition.displayName} managed contact failed`,
        error
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Managed partner contact normalization incomplete: ${failures.join(" | ")}`);
  }
}

/** Compatibility export retained for the established startup bootstrap. */
export async function provisionJwStoneManagedContact(): Promise<void> {
  await provisionTradeScoutManagedPartnerContacts();
}
