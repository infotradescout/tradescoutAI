import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "../db";
import { counties, userHomes, userHomeRecords } from "../../shared/schema";
import {
  HOME_IDENTITY_FIELDS, HOME_IDENTITY_LABELS, HOME_LOCATION_FIELDS,
  homeIdentityUpdateSchema, type HomeIdentity, type HomeIdentitySnapshot, type HomeIdentityField,
} from "../../shared/homeIdentity";

type Database = NodePgDatabase<typeof import("../../shared/schema")>;
export class HomeIdentityError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors?: Partial<Record<HomeIdentityField, string>>) {
    super(message);
  }
}
const selection = {
  id: userHomes.id, nickname: userHomes.nickname, propertyType: userHomes.propertyType,
  yearBuilt: userHomes.yearBuilt, address1: userHomes.address1, address2: userHomes.address2,
  city: userHomes.city, stateCode: userHomes.stateCode, countyFips: userHomes.countyFips, zipCode: userHomes.zipCode,
};
function snapshot(row: HomeIdentity): HomeIdentitySnapshot {
  const identity = { id: row.id, ...Object.fromEntries(HOME_IDENTITY_FIELDS.map((field) => [field, row[field] ?? null])) } as HomeIdentity;
  const revision = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
  return { identity, revision };
}
function requirePrincipal(userId: string, homeId: string) {
  if (!userId.trim()) throw new HomeIdentityError(401, "AUTHENTICATION_REQUIRED", "Sign in before editing a property.");
  if (!homeId.trim() || homeId.length > 120) throw new HomeIdentityError(400, "INVALID_HOME_ID", "Choose a property first.");
}
export async function loadHomeIdentity(userId: string, homeId: string, database: Database = db): Promise<HomeIdentitySnapshot> {
  requirePrincipal(userId, homeId);
  const [home] = await database.select(selection).from(userHomes)
    .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId))).limit(1);
  if (!home) throw new HomeIdentityError(404, "HOME_NOT_FOUND", "This property is not available to your account.");
  return snapshot(home);
}

/** Updates canonical property fields only. Does not grant authority, contact, or verification. */
export async function saveHomeIdentity(userId: string, homeId: string, input: unknown, database: Database = db): Promise<HomeIdentitySnapshot> {
  requirePrincipal(userId, homeId);
  return database.transaction(async (tx) => {
    // Lock the owned record before comparing the identity-specific revision. Concurrent
    // edits cannot both succeed with the same revision, and ancillary document saves
    // do not invalidate a property draft merely by touching userHomes.updatedAt.
    const [current] = await tx.select(selection).from(userHomes)
      .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId))).limit(1).for("update");
    if (!current) throw new HomeIdentityError(404, "HOME_NOT_FOUND", "This property is not available to your account.");
    const parsed = homeIdentityUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<HomeIdentityField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === "changes" ? issue.path[1] : undefined;
        if (typeof field === "string" && HOME_IDENTITY_FIELDS.includes(field as HomeIdentityField)) {
          fieldErrors[field as HomeIdentityField] = issue.message;
        }
      }
      throw new HomeIdentityError(400, "INVALID_PROPERTY_DETAILS", "Check the highlighted property details.", fieldErrors);
    }
    if (snapshot(current).revision !== parsed.data.revision) {
      throw new HomeIdentityError(409, "PROPERTY_CHANGED", "This property changed in another session. Review the latest details before saving.");
    }
    const changes = parsed.data.changes;
    const next = { ...current, ...changes } as HomeIdentity;
    const changedFields = HOME_IDENTITY_FIELDS.filter((field) => Object.hasOwn(changes, field) && next[field] !== current[field]);
    if (changedFields.length === 0) return snapshot(current);

    if (HOME_LOCATION_FIELDS.some((field) => changedFields.includes(field))) {
      const hasLocation = HOME_LOCATION_FIELDS.some((field) => next[field] != null);
      if (hasLocation && (!next.stateCode || !next.countyFips)) {
        throw new HomeIdentityError(400, "PROPERTY_LOCATION_REQUIRED", "Choose the property's state and county or parish before saving its location.", {
          ...(!next.stateCode ? { stateCode: "Choose a state." } : {}),
          ...(!next.countyFips ? { countyFips: "Choose a county or parish." } : {}),
        });
      }
      if (next.stateCode && next.countyFips) {
        const [county] = await tx.select({ fips: counties.fips }).from(counties)
          .where(and(eq(counties.fips, next.countyFips), eq(counties.stateCode, next.stateCode))).limit(1);
        if (!county) throw new HomeIdentityError(400, "PROPERTY_COUNTY_MISMATCH", "The selected county or parish does not belong to that state.", { countyFips: "Choose a county or parish from the selected state." });
      }
    }
    const [saved] = await tx.update(userHomes).set({ ...changes, updatedAt: new Date() })
      .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId))).returning(selection);
    if (!saved) throw new HomeIdentityError(404, "HOME_NOT_FOUND", "This property is not available to your account.");
    // A saved history event is atomic with the edit. Do not duplicate addresses in
    // analytics/logs or turn a self-reported edit into a verified ownership claim.
    await tx.insert(userHomeRecords).values({
      homeId, createdByUserId: userId, recordType: "note", title: "Property details updated",
      details: `Updated ${changedFields.map((field) => HOME_IDENTITY_LABELS[field].toLowerCase()).join(", ")}.`,
      tags: ["homeid", "property_details"], updatedAt: new Date(),
    });
    return snapshot(saved);
  });
}
