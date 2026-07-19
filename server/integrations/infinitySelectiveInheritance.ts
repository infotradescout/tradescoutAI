export type InfinityInheritanceSourceKind =
  | "owner_verified"
  | "product_record"
  | "screen_pass"
  | "public_credential"
  | "public_catalog"
  | "public_reputation"
  | "public_website";

type FieldRule = {
  field: string;
  action: "inherit" | "exclude";
  allowedSourceKinds: InfinityInheritanceSourceKind[];
  minimumConfidence: number;
  requireVerifiedEvidence: boolean;
  sourcePriority: InfinityInheritanceSourceKind[];
};

const inherit = (
  field: string,
  minimumConfidence: number,
  sourcePriority: InfinityInheritanceSourceKind[]
): FieldRule => ({
  field,
  action: "inherit",
  allowedSourceKinds: sourcePriority,
  minimumConfidence,
  requireVerifiedEvidence: true,
  sourcePriority,
});

const exclude = (field: string): FieldRule => ({
  field,
  action: "exclude",
  allowedSourceKinds: [],
  minimumConfidence: 1,
  requireVerifiedEvidence: true,
  sourcePriority: [],
});

export function tradeScoutSelectiveInheritancePolicy(tenantId: string) {
  return {
    id: "tradescout-public-profile-selective-inheritance",
    tenantId,
    objectType: "public_profile",
    version: "1",
    status: "active" as const,
    defaultAction: "exclude" as const,
    fields: [
      inherit("businessName", 0.95, ["owner_verified", "product_record", "public_website"]),
      inherit("description", 0.9, ["owner_verified", "product_record", "public_website"]),
      inherit("logo", 0.9, ["owner_verified", "screen_pass", "product_record", "public_website"]),
      inherit("coverImage", 0.9, [
        "owner_verified",
        "screen_pass",
        "product_record",
        "public_website",
      ]),
      inherit("services", 0.9, [
        "owner_verified",
        "product_record",
        "public_catalog",
        "public_website",
      ]),
      inherit("products", 0.9, [
        "owner_verified",
        "product_record",
        "public_catalog",
        "public_website",
      ]),
      inherit("inventory", 0.95, ["owner_verified", "product_record", "public_catalog"]),
      inherit("credentials", 0.98, ["owner_verified", "public_credential", "product_record"]),
      inherit("gallery", 0.9, [
        "owner_verified",
        "screen_pass",
        "product_record",
        "public_website",
      ]),
      inherit("socialLinks", 0.95, ["owner_verified", "product_record", "public_website"]),
      exclude("directConnect"),
      exclude("contactAccess"),
      exclude("countyAssignments"),
      exclude("ownerIdentity"),
      exclude("ranking"),
      exclude("trustScore"),
    ],
  };
}

export type TradeScoutInheritanceCandidate = {
  field: string;
  value: unknown;
  sourceKind: InfinityInheritanceSourceKind;
  sourceReference: string;
  evidenceDigest: string;
  observedAt: string;
  confidence: number;
  verified: boolean;
  screenPass?: {
    publicId: string;
    authoritative: boolean;
    changed: boolean | null;
  };
};

export type TradeScoutInheritanceOverride = {
  field: string;
  value: unknown;
  reason: string;
  evidenceDigest: string;
  actorReference: string;
  authorizedAt: string;
};

export function filterTradeScoutInheritanceCandidates(
  tenantId: string,
  candidates: TradeScoutInheritanceCandidate[]
): TradeScoutInheritanceCandidate[] {
  const policy = tradeScoutSelectiveInheritancePolicy(tenantId);
  const allowedFields = new Set(
    policy.fields.filter((field) => field.action === "inherit").map((field) => field.field)
  );
  return candidates.filter((candidate) => allowedFields.has(candidate.field));
}
