import { ISSA_BUILD_BUSINESS_NAME, ISSA_BUILD_PROFILE_SLUG } from "./issaBuildProfile";
import { JW_STONE_PROFILE_SLUG, JW_STONE_PUBLIC_IDENTITY } from "./jwStonePresentation";
import {
  PRECISION_AERIAL_BUSINESS_NAME,
  PRECISION_AERIAL_PROFILE_SLUG,
} from "./precisionAerialProfile";
import { RED_GRANITI_BUSINESS_NAME, RED_GRANITI_PROFILE_SLUG } from "./redGranitiProfile";
import { TRADESCOUT_MANAGED_CONTACT } from "./tradeScoutManagedContact";

export type ManagedPartnerControlMode =
  | "tradescout_admin_controlled"
  | "admin_stewarded_pending_owner_transfer"
  | "admin_stewarded_pending_claim"
  | "owner_controlled_tradescout_managed_contact";

export type ManagedPartnerContactMode =
  | "tradescout_managed"
  | "business_phone_tradescout_email"
  | "pending_owner_contact";

export type ManagedPartnerExposureMode = "public" | "direct_only";

export type ManagedPartnerRequestMode = "inline_profile_form" | "profile_request_flow" | "pending";

export type ManagedPartnerArchetype =
  | "contractor"
  | "inventory_supplier"
  | "product_house"
  | "service_creator"
  | "source_company_website";

export type ManagedPartnerProfileDefinition = {
  slug: string;
  displayName: string;
  archetype: ManagedPartnerArchetype;
  controlMode: ManagedPartnerControlMode;
  contactMode: ManagedPartnerContactMode;
  exposureMode: ManagedPartnerExposureMode;
  requestMode: ManagedPartnerRequestMode;
  requestRecipientSlug: string;
  expectedPrimaryCta?: string;
  expectedPhone?: string;
  expectedEmail?: string;
  expectedNotificationEmail?: string;
  sourceWebsite?: string;
  relationshipLabel?: string;
  notes: string;
};

export const MANAGED_PARTNER_PROFILE_DEFINITIONS = [
  {
    slug: RED_GRANITI_PROFILE_SLUG,
    displayName: RED_GRANITI_BUSINESS_NAME,
    archetype: "source_company_website",
    controlMode: "tradescout_admin_controlled",
    contactMode: "tradescout_managed",
    exposureMode: "public",
    requestMode: "inline_profile_form",
    requestRecipientSlug: JW_STONE_PROFILE_SLUG,
    expectedPrimaryCta: "Start a Request",
    expectedPhone: TRADESCOUT_MANAGED_CONTACT.phone,
    expectedEmail: TRADESCOUT_MANAGED_CONTACT.email,
    expectedNotificationEmail: TRADESCOUT_MANAGED_CONTACT.email,
    sourceWebsite: "https://www.redgraniti.com/en/",
    relationshipLabel: "Exclusive first-cut distribution through JW Stone",
    notes:
      "Independent source company. TradeScout controls the profile; JW Stone receives first-cut requests without owning the company or source catalog.",
  },
  {
    slug: JW_STONE_PROFILE_SLUG,
    displayName: JW_STONE_PUBLIC_IDENTITY.brandName,
    archetype: "inventory_supplier",
    controlMode: "owner_controlled_tradescout_managed_contact",
    contactMode: "tradescout_managed",
    exposureMode: "public",
    requestMode: "profile_request_flow",
    requestRecipientSlug: JW_STONE_PROFILE_SLUG,
    expectedPrimaryCta: "Start a Request",
    expectedPhone: TRADESCOUT_MANAGED_CONTACT.phone,
    expectedEmail: TRADESCOUT_MANAGED_CONTACT.email,
    expectedNotificationEmail: TRADESCOUT_MANAGED_CONTACT.email,
    sourceWebsite: "https://jwstonelogistics.com/",
    notes:
      "Owner-controlled business and inventory profile. TradeScout manages the public response destination without changing ownership or physical inventory.",
  },
  {
    slug: ISSA_BUILD_PROFILE_SLUG,
    displayName: ISSA_BUILD_BUSINESS_NAME,
    archetype: "product_house",
    controlMode: "admin_stewarded_pending_owner_transfer",
    contactMode: "tradescout_managed",
    exposureMode: "public",
    requestMode: "profile_request_flow",
    requestRecipientSlug: ISSA_BUILD_PROFILE_SLUG,
    expectedPrimaryCta: "Start a Request",
    expectedPhone: TRADESCOUT_MANAGED_CONTACT.phone,
    expectedEmail: TRADESCOUT_MANAGED_CONTACT.email,
    expectedNotificationEmail: TRADESCOUT_MANAGED_CONTACT.email,
    relationshipLabel: "Verified full-service translucent onyx projects",
    notes:
      "Fully verified independent business. TradeScout manages the public profile and inquiry funnel while ISSA Build performs material selection, custom fabrication, backlighting, and installation for residential and commercial projects. Temporary admin stewardship is only an account-control state and does not reduce verification.",
  },
  {
    slug: "property-blessings",
    displayName: "Property Blessings LLC",
    archetype: "contractor",
    controlMode: "tradescout_admin_controlled",
    contactMode: "business_phone_tradescout_email",
    exposureMode: "public",
    requestMode: "profile_request_flow",
    requestRecipientSlug: "property-blessings",
    expectedPrimaryCta: "Start a Request",
    expectedEmail: TRADESCOUT_MANAGED_CONTACT.email,
    expectedNotificationEmail: TRADESCOUT_MANAGED_CONTACT.email,
    notes:
      "TradeScout-admin-controlled contractor profile pending owner claim. The verified public business phone remains the call destination while TradeScout manages message delivery.",
  },
  {
    slug: PRECISION_AERIAL_PROFILE_SLUG,
    displayName: PRECISION_AERIAL_BUSINESS_NAME,
    archetype: "service_creator",
    controlMode: "admin_stewarded_pending_claim",
    contactMode: "pending_owner_contact",
    exposureMode: "direct_only",
    requestMode: "pending",
    requestRecipientSlug: PRECISION_AERIAL_PROFILE_SLUG,
    expectedPrimaryCta: "Start a Request",
    notes:
      "Direct-only profile under a narrow admin steward authority. Public contact and final owner claim remain intentionally unresolved and must stay visible as an operations gap.",
  },
] as const satisfies readonly ManagedPartnerProfileDefinition[];

const definitionBySlug = new Map<string, ManagedPartnerProfileDefinition>(
  MANAGED_PARTNER_PROFILE_DEFINITIONS.map((definition) => [definition.slug, definition])
);

export function getManagedPartnerProfileDefinition(
  slug: unknown
): ManagedPartnerProfileDefinition | null {
  const normalized = String(slug || "")
    .trim()
    .toLowerCase();
  return definitionBySlug.get(normalized) || null;
}

export function isManagedPartnerProfileSlug(slug: unknown): boolean {
  return Boolean(getManagedPartnerProfileDefinition(slug));
}
