import { z } from "zod";

export const HOME_IDENTITY_TYPES = [
  ["single_family", "Single-family home"], ["townhome", "Townhome"], ["condo", "Condo"],
  ["duplex", "Duplex"], ["triplex_fourplex", "Triplex or fourplex"], ["multi_family", "Multifamily"],
  ["manufactured_home", "Manufactured home"], ["mobile_home", "Mobile home"],
  ["new_build", "New build"], ["land_lot", "Land or lot"],
  ["commercial_residential_mixed", "Mixed-use property"], ["rental_unit", "Rental unit"], ["other", "Other"],
] as const;

export const HOME_IDENTITY_LABELS = {
  nickname: "Property name", propertyType: "Property type", yearBuilt: "Year built",
  address1: "Street address", address2: "Unit or address line 2", city: "City",
  stateCode: "State", countyFips: "County or parish", zipCode: "ZIP code",
} as const;
export type HomeIdentityField = keyof typeof HOME_IDENTITY_LABELS;
export const HOME_IDENTITY_FIELDS = Object.keys(HOME_IDENTITY_LABELS) as HomeIdentityField[];
export const HOME_LOCATION_FIELDS = ["address1", "address2", "city", "stateCode", "countyFips", "zipCode"] as const;

const text = (max: number) => z.string().trim().min(1).max(max)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Use a single line of text.").nullable();
const identityFields = {
  nickname: text(160), propertyType: text(64), yearBuilt: z.number().int().min(1600).max(2100).nullable(),
  address1: text(180), address2: text(180), city: text(120),
  stateCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Choose a state.").nullable(),
  countyFips: z.string().regex(/^\d{5}$/, "Choose a county or parish.").nullable(),
  zipCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/, "Use a five-digit ZIP or ZIP+4.").nullable(),
};

export type HomeIdentity = {
  id: string; nickname: string | null; propertyType: string | null; yearBuilt: number | null;
  address1: string | null; address2: string | null; city: string | null;
  stateCode: string | null; countyFips: string | null; zipCode: string | null;
};
export type HomeIdentitySnapshot = { identity: HomeIdentity; revision: string };
export const homeIdentityChangesSchema = z.object(identityFields).partial().strict()
  .refine((value) => Object.keys(value).length > 0, "Change at least one property field.")
  .refine((value) => value.propertyType == null || HOME_IDENTITY_TYPES.some(([type]) => type === value.propertyType), {
    message: "Choose a supported property type.", path: ["propertyType"],
  });
export const homeIdentityUpdateSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/, "Reload this property before saving."),
  changes: homeIdentityChangesSchema,
}).strict();
export type HomeIdentityUpdate = z.infer<typeof homeIdentityUpdateSchema>;
export type HomeIdentityDraft = Record<HomeIdentityField, string>;

export function homeIdentityDraft(identity: HomeIdentity): HomeIdentityDraft {
  return Object.fromEntries(HOME_IDENTITY_FIELDS.map((field) => [field, identity[field] == null ? "" : String(identity[field])])) as HomeIdentityDraft;
}

/** Only changed fields are sent. Blank values deliberately clear an existing value. */
export function homeIdentityChanges(identity: HomeIdentity, draft: HomeIdentityDraft): HomeIdentityUpdate["changes"] {
  const changes: Record<string, unknown> = {};
  for (const field of HOME_IDENTITY_FIELDS) {
    const value = draft[field].trim();
    const normalized = field === "stateCode" ? value.toUpperCase() : value;
    const next = normalized === "" ? null : field === "yearBuilt" ? Number(normalized) : normalized;
    const current = identity[field];
    if (next !== current) changes[field] = next;
  }
  return changes as HomeIdentityUpdate["changes"];
}

export function parseHomeIdentitySnapshot(value: unknown, expectedHomeId: string): HomeIdentitySnapshot {
  if (!value || typeof value !== "object") throw new Error("The property response could not be read.");
  const row = value as HomeIdentitySnapshot;
  if (!row.identity || row.identity.id !== expectedHomeId || !/^[a-f0-9]{64}$/.test(row.revision || "")) {
    throw new Error("The selected property could not be loaded.");
  }
  // Reading existing records must not fail because older data used a different ZIP or type format.
  for (const field of HOME_IDENTITY_FIELDS) {
    const data = row.identity[field];
    if (data !== null && (field === "yearBuilt" ? typeof data !== "number" || !Number.isFinite(data) : typeof data !== "string")) {
      throw new Error("The property response could not be read.");
    }
  }
  return row;
}
