/**
 * Profile Verification Service
 * Computes verification requirements based on user profile type.
 *
 * TRUST MODEL (Feb 2026):
 * - Users make claims. Verification gates visibility, not features.
 * - Person profile: Email + address only → can use marketplace/exchange when verified
 * - Service profile: Email + address + license/insurance → can post services when verified
 * - Business seller profile: Email + address + tax ID + business registration → can operate retail when verified
 *
 * NO PUBLIC PROFILE without verification of profile type requirements.
 * Service posting requires verified service provider profile.
 * Marketplace listing requires verified person or service profile.
 */

export interface VerificationRequirements {
  email: boolean;
  address: boolean;
  license: boolean;
  insurance: boolean;
  tax_id: boolean;
  business_registration: boolean;
}

/**
 * Compute verification requirements for a profile.
 * Required checks differ by profile type, not features.
 * - Person: Email + address for marketplace access
 * - Service: Email + address + license (if trade) + insurance for service posting
 * - Business seller: Email + address + tax ID + business registration + conditional insurance
 */
export async function computeVerificationRequirements(
  userIntent: "person" | "business",
  businessType?: "service_provider" | "seller" | "generic" | null,
  serviceTags?: string[],
  sellerTags?: string[],
  state?: string
): Promise<VerificationRequirements> {
  const requires: VerificationRequirements = {
    email: true,
    address: true,
    license: false,
    insurance: false,
    tax_id: false,
    business_registration: false,
  };

  if (userIntent === "person") {
    // Person: just email + address
    // Can use marketplace to buy/sell items once verified
    return requires;
  }

  if (userIntent === "business") {
    if (businessType === "service_provider") {
      // Service provider: license (if trade) + insurance required
      // Cannot post services until verified
      requires.license = checkLicenseRequired(serviceTags || []);
      requires.insurance = true; // All service providers need insurance
    } else if (businessType === "seller") {
      // Business seller: full business verification required
      // Cannot operate retail business until verified
      requires.tax_id = true;
      requires.business_registration = true;
      requires.insurance = checkInsuranceRequired(sellerTags || []);
    } else {
      // Generic business identities still need proof that the business exists
      // and a tax identifier. Do not silently treat a missing subtype as a
      // person profile with only email/address requirements.
      requires.tax_id = true;
      requires.business_registration = true;
    }
  }

  return requires;
}

/**
 * Check if a specific service tag requires licensing
 */
function checkLicenseRequired(serviceTags: string[]): boolean {
  const licensedTrades = [
    "electrician",
    "plumber",
    "hvac",
    "roofing",
    "general_contractor",
    "contractor",
    "specialty_tradesperson",
  ];
  return serviceTags.some((tag) => licensedTrades.some((t) => tag.toLowerCase().includes(t)));
}

/**
 * Check if a specific seller type requires insurance
 */
function checkInsuranceRequired(sellerTags: string[]): boolean {
  const highRiskSellers = ["restaurant", "salon", "food_truck", "bar", "commercial", "retail"];
  return sellerTags.some((tag) => highRiskSellers.some((h) => tag.toLowerCase().includes(h)));
}

/**
 * Describe a profile in human-readable format
 */
export function describeProfile(profile: any): string {
  if (profile.userIntent === "person") {
    return "Person Profile";
  } else if (profile.businessType === "service_provider") {
    return `Service Provider: ${(profile.serviceTags || []).join(", ") || "Services"}`;
  } else if (profile.businessType === "seller") {
    return `Seller (${profile.sellerType}): ${(profile.sellerTags || []).join(", ") || "Products"}`;
  }
  return "Profile";
}
