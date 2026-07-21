export type PresenceType = "personal" | "represent_business";

export interface ProfileDraftServiceArea {
  countyFips: string;
  countyName?: string;
  stateCode?: string;
  primary?: boolean;
}

export interface ProfileDraft {
  presenceType: PresenceType;
  stateCode: string;
  countyFips: string;
  countyName?: string;
  city?: string;
  businessName?: string;
  businessType?:
    | "contractor_trades"
    | "home_services"
    | "retail"
    | "restaurant_food"
    | "health_wellness"
    | "professional_services"
    | "automotive"
    | "real_estate_property"
    | "manufacturing"
    | "nonprofit_community"
    | "other";
  businessCategory?: string;
  website?: string;
  description?: string;
  serviceAreas?: ProfileDraftServiceArea[];
  /** Public profile starting template from onboarding gallery. */
  siteTemplateId?: "wholesaler" | "auto-glass" | "plumbing-company" | "electrician-solo";
  /** Optional per-field inheritance overrides (keep_source | keep_target | merge | discard). */
  inheritanceDecisions?: Record<string, string>;
  capturedAt?: string;
}
