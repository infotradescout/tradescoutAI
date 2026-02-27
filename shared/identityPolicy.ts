export type PrimaryUserType =
  | "homeowner"
  | "contractor"
  | "realtor"
  | "notary"
  | "business_owner"
  | "community_builder"
  | "platform_admin";

export type VerificationCheck =
  | "email_verified"
  | "address_verified"
  | "identity_verified"
  | "license_verified"
  | "insurance_verified"
  | "tax_id_verified"
  | "business_registration_verified"
  | "notary_commission_active"
  | "notary_background_screened"
  | "government_id_front"
  | "government_id_back"
  | "signer_selfie";

export interface IdentityInput {
  declaredPrimaryType?: PrimaryUserType | null;
  roles?: string[] | null;
  declaredSubtypes?: string[] | null;
}

export interface IdentityResolution {
  primaryType: PrimaryUserType;
  subtypes: string[];
  droppedSubtypes: string[];
  capabilities: string[];
  requiredVerification: VerificationCheck[];
  reasonCodes: string[];
}

const SUBTYPE_CATALOG: Record<PrimaryUserType, string[]> = {
  homeowner: ["owner_occupant", "landlord", "hoa_resident"],
  contractor: [
    "general_contractor",
    "electrician",
    "plumber",
    "hvac",
    "roofer",
    "painter",
    "handyman",
  ],
  realtor: ["residential_realtor", "commercial_realtor", "buyer_agent", "listing_agent"],
  notary: ["mobile_notary", "remote_notary"],
  business_owner: ["local_retail", "restaurant", "service_firm", "ecommerce"],
  community_builder: ["county_builder", "nonprofit_builder", "cause_builder"],
  platform_admin: ["ops_admin", "super_admin", "head_admin"],
};

const CAPABILITY_MAP: Record<PrimaryUserType, string[]> = {
  homeowner: ["find_contractors", "compare_contractors", "post_in_community"],
  contractor: ["bid_on_jobs", "send_invoices", "track_projects"],
  realtor: ["manage_real_estate_listings", "run_market_analysis", "manage_realtor_contacts"],
  notary: ["mobile_notary_intake", "remote_notary_intake", "notary_compliance_review"],
  business_owner: ["post_marketplace_item", "run_promotions", "accept_payments"],
  community_builder: ["create_community_cause", "moderate_community_updates"],
  platform_admin: ["admin_control", "manage_user_roles", "audit_governance"],
};

const VERIFICATION_MAP: Record<PrimaryUserType, VerificationCheck[]> = {
  homeowner: ["email_verified", "address_verified"],
  contractor: ["email_verified", "address_verified", "license_verified", "insurance_verified"],
  realtor: ["email_verified", "address_verified", "license_verified"],
  notary: [
    "email_verified",
    "address_verified",
    "identity_verified",
    "notary_commission_active",
    "notary_background_screened",
  ],
  business_owner: [
    "email_verified",
    "address_verified",
    "tax_id_verified",
    "business_registration_verified",
  ],
  community_builder: ["email_verified", "address_verified"],
  platform_admin: ["email_verified", "identity_verified"],
};

const PRIMARY_ROLE_HINTS: Array<{ type: PrimaryUserType; roles: string[] }> = [
  { type: "platform_admin", roles: ["head_admin", "super_admin", "ops_admin", "moderator"] },
  { type: "notary", roles: ["notary", "mobile_notary", "remote_notary"] },
  { type: "realtor", roles: ["realtor"] },
  { type: "contractor", roles: ["contractor", "contractor_user"] },
  { type: "community_builder", roles: ["community_builder"] },
  { type: "business_owner", roles: ["business_owner", "restaurant_owner", "food_truck_owner"] },
  { type: "homeowner", roles: ["homeowner"] },
];

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function inferPrimaryTypeFromRoles(roles: string[]): PrimaryUserType {
  const normalizedRoles = roles.map((role) => String(role || "").toLowerCase());
  for (const hint of PRIMARY_ROLE_HINTS) {
    if (normalizedRoles.some((role) => hint.roles.includes(role))) return hint.type;
  }
  return "homeowner";
}

export function resolveUserIdentity(input: IdentityInput): IdentityResolution {
  const roles = Array.isArray(input.roles) ? input.roles : [];
  const declaredType = input.declaredPrimaryType ?? null;
  const primaryType = declaredType || inferPrimaryTypeFromRoles(roles);
  const allowedSubtypes = new Set(SUBTYPE_CATALOG[primaryType]);
  const requestedSubtypes = Array.isArray(input.declaredSubtypes) ? input.declaredSubtypes : [];

  const acceptedSubtypes: string[] = [];
  const droppedSubtypes: string[] = [];
  for (const subtype of requestedSubtypes) {
    if (allowedSubtypes.has(subtype)) acceptedSubtypes.push(subtype);
    else droppedSubtypes.push(subtype);
  }

  const reasonCodes: string[] = [];
  if (declaredType) reasonCodes.push("primary_type_declared");
  else reasonCodes.push("primary_type_inferred_from_roles");
  if (droppedSubtypes.length > 0) reasonCodes.push("subtype_scope_enforced");

  return {
    primaryType,
    subtypes: dedupe(acceptedSubtypes),
    droppedSubtypes: dedupe(droppedSubtypes),
    capabilities: CAPABILITY_MAP[primaryType],
    requiredVerification: VERIFICATION_MAP[primaryType],
    reasonCodes,
  };
}
