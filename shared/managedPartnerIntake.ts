import type {
  ManagedPartnerArchetype,
  ManagedPartnerContactMode,
  ManagedPartnerControlMode,
  ManagedPartnerExposureMode,
  ManagedPartnerRequestMode,
} from "./managedPartnerProfileRegistry";

export const MANAGED_PARTNER_INTAKE_STAGES = [
  "incoming",
  "source_review",
  "profile_build",
  "routing_review",
  "ready_to_publish",
  "live",
  "blocked",
  "archived",
] as const;

export type ManagedPartnerIntakeStage = (typeof MANAGED_PARTNER_INTAKE_STAGES)[number];

export const MANAGED_PARTNER_INTAKE_PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export type ManagedPartnerIntakePriority = (typeof MANAGED_PARTNER_INTAKE_PRIORITIES)[number];

export const MANAGED_PARTNER_ARCHETYPES = [
  "contractor",
  "inventory_supplier",
  "product_house",
  "service_creator",
  "source_company_website",
] as const satisfies readonly ManagedPartnerArchetype[];

export const MANAGED_PARTNER_CONTROL_MODES = [
  "tradescout_admin_controlled",
  "admin_stewarded_pending_owner_transfer",
  "admin_stewarded_pending_claim",
  "owner_controlled_tradescout_managed_contact",
  "owner_controlled",
] as const satisfies readonly ManagedPartnerControlMode[];

export const MANAGED_PARTNER_CONTACT_MODES = [
  "tradescout_managed",
  "business_phone_tradescout_email",
  "business_managed",
  "pending_owner_contact",
] as const satisfies readonly ManagedPartnerContactMode[];

export const MANAGED_PARTNER_EXPOSURE_MODES = [
  "public",
  "direct_only",
] as const satisfies readonly ManagedPartnerExposureMode[];

export const MANAGED_PARTNER_REQUEST_MODES = [
  "inline_profile_form",
  "profile_request_flow",
  "pending",
] as const satisfies readonly ManagedPartnerRequestMode[];

export type ManagedPartnerIntakeRecord = {
  id: string;
  displayName: string;
  slug: string | null;
  sourceUrls: string[];
  archetype: ManagedPartnerArchetype;
  controlMode: ManagedPartnerControlMode;
  contactMode: ManagedPartnerContactMode;
  exposureMode: ManagedPartnerExposureMode;
  requestMode: ManagedPartnerRequestMode;
  requestRecipientSlug: string | null;
  expectedPrimaryCta: string | null;
  expectedPhone: string | null;
  expectedEmail: string | null;
  expectedNotificationEmail: string | null;
  relationshipLabel: string | null;
  notes: string;
  stage: ManagedPartnerIntakeStage;
  priority: ManagedPartnerIntakePriority;
  latestAction: string | null;
  blockerNote: string | null;
  createdByUserId: string;
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ManagedPartnerIntakeCreateInput = {
  displayName: string;
  slug?: string | null;
  sourceUrls?: string[];
  archetype?: ManagedPartnerArchetype;
  controlMode?: ManagedPartnerControlMode;
  contactMode?: ManagedPartnerContactMode;
  exposureMode?: ManagedPartnerExposureMode;
  requestMode?: ManagedPartnerRequestMode;
  requestRecipientSlug?: string | null;
  expectedPrimaryCta?: string | null;
  expectedPhone?: string | null;
  expectedEmail?: string | null;
  expectedNotificationEmail?: string | null;
  relationshipLabel?: string | null;
  notes?: string;
  stage?: ManagedPartnerIntakeStage;
  priority?: ManagedPartnerIntakePriority;
  latestAction?: string | null;
  blockerNote?: string | null;
  assignedToUserId?: string | null;
};

export type ManagedPartnerIntakeUpdateInput = Partial<
  Omit<ManagedPartnerIntakeCreateInput, "displayName">
> & {
  displayName?: string;
};

export type ManagedPartnerIntakeReport = {
  generatedAt: string;
  summary: {
    total: number;
    incoming: number;
    activeBuilds: number;
    readyToPublish: number;
    live: number;
    blocked: number;
  };
  items: ManagedPartnerIntakeRecord[];
};

export function isManagedPartnerIntakeStage(value: unknown): value is ManagedPartnerIntakeStage {
  return MANAGED_PARTNER_INTAKE_STAGES.includes(String(value || "") as ManagedPartnerIntakeStage);
}

export function isManagedPartnerIntakePriority(
  value: unknown
): value is ManagedPartnerIntakePriority {
  return MANAGED_PARTNER_INTAKE_PRIORITIES.includes(
    String(value || "") as ManagedPartnerIntakePriority
  );
}

export function slugifyManagedPartnerName(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
