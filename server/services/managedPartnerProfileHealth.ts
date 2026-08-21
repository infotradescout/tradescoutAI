import { inArray } from "drizzle-orm";
import {
  MANAGED_PARTNER_PROFILE_DEFINITIONS,
  type ManagedPartnerProfileDefinition,
} from "@shared/managedPartnerProfileRegistry";
import { businesses, profiles, users } from "@shared/schema";
import { db } from "../db";
import { hasVerifiedTradeScoutAdminCustody } from "./ownerConfirmedDirectProfile";

export type ManagedPartnerIssueSeverity = "blocker" | "attention" | "info";

export type ManagedPartnerProfileIssue = {
  severity: ManagedPartnerIssueSeverity;
  code: string;
  message: string;
};

export type ManagedPartnerProfileHealthStatus = "ready" | "attention" | "blocked";

export type ManagedPartnerProfileHealthItem = {
  slug: string;
  displayName: string;
  profileUrl: string;
  archetype: ManagedPartnerProfileDefinition["archetype"];
  controlMode: ManagedPartnerProfileDefinition["controlMode"];
  contactMode: ManagedPartnerProfileDefinition["contactMode"];
  exposureMode: ManagedPartnerProfileDefinition["exposureMode"];
  requestMode: ManagedPartnerProfileDefinition["requestMode"];
  requestRecipientSlug: string;
  sourceWebsite?: string;
  relationshipLabel?: string;
  notes: string;
  status: ManagedPartnerProfileHealthStatus;
  issues: ManagedPartnerProfileIssue[];
  current: {
    businessExists: boolean;
    profileExists: boolean;
    businessStatus: string | null;
    profileStatus: string | null;
    claimStatus: string | null;
    publicDiscoveryEnabled: boolean | null;
    ownershipConsistent: boolean;
    ownerRole: string | null;
    ownerVerified: boolean;
    profileControl: string | null;
    contactManagement: string | null;
    phone: string | null;
    email: string | null;
    notificationEmail: string | null;
    primaryCta: string | null;
    headline: string | null;
  };
  expected: {
    phone: string | null;
    email: string | null;
    notificationEmail: string | null;
    primaryCta: string | null;
  };
};

export type ManagedPartnerProfileHealthReport = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    attention: number;
    blocked: number;
  };
  items: ManagedPartnerProfileHealthItem[];
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    : [];
}

function primaryCtaLabel(value: unknown): string | null {
  const primary = recordValue(recordValue(value).primary);
  return stringValue(primary.label);
}

function pushIssue(
  issues: ManagedPartnerProfileIssue[],
  severity: ManagedPartnerIssueSeverity,
  code: string,
  message: string
): void {
  issues.push({ severity, code, message });
}

function equalContact(actual: string | null, expected: string | undefined): boolean {
  if (!expected) return true;
  return String(actual || "").trim().toLowerCase() === expected.trim().toLowerCase();
}

function resolveStatus(issues: ManagedPartnerProfileIssue[]): ManagedPartnerProfileHealthStatus {
  if (issues.some((issue) => issue.severity === "blocker")) return "blocked";
  if (issues.some((issue) => issue.severity === "attention")) return "attention";
  return "ready";
}

export async function getManagedPartnerProfileHealth(): Promise<ManagedPartnerProfileHealthReport> {
  const definitions: ManagedPartnerProfileDefinition[] = [
    ...MANAGED_PARTNER_PROFILE_DEFINITIONS,
  ];
  const slugs: string[] = definitions.map((definition) => definition.slug);

  const [businessRows, profileRows] = await Promise.all([
    db
      .select({
        id: businesses.id,
        slug: businesses.slug,
        name: businesses.name,
        status: businesses.status,
        claimStatus: businesses.claimStatus,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        ownerUserId: businesses.ownerUserId,
        profileData: businesses.profileData,
        sources: businesses.sources,
      })
      .from(businesses)
      .where(inArray(businesses.slug, slugs)),
    db
      .select({
        id: profiles.id,
        slug: profiles.slug,
        status: profiles.status,
        displayName: profiles.displayName,
        headline: profiles.headline,
        ownerUserId: profiles.ownerUserId,
        businessId: profiles.businessId,
        ctaConfig: profiles.ctaConfig,
      })
      .from(profiles)
      .where(inArray(profiles.slug, slugs)),
  ]);

  const ownerIds = Array.from(
    new Set(
      [...businessRows.map((row) => row.ownerUserId), ...profileRows.map((row) => row.ownerUserId)]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
  const ownerRows = ownerIds.length
    ? await db
        .select({
          id: users.id,
          role: users.role,
          roles: users.roles,
          verifiedBadge: users.verifiedBadge,
          verificationStatus: users.verificationStatus,
        })
        .from(users)
        .where(inArray(users.id, ownerIds))
    : [];

  const businessBySlug = new Map<string, (typeof businessRows)[number]>(
    businessRows.map((row) => [String(row.slug), row] as const)
  );
  const profileBySlug = new Map<string, (typeof profileRows)[number]>(
    profileRows.map((row) => [String(row.slug), row] as const)
  );
  const ownerById = new Map<string, (typeof ownerRows)[number]>(
    ownerRows.map((row) => [String(row.id), row] as const)
  );

  const items: ManagedPartnerProfileHealthItem[] = definitions.map((definition) => {
    const business = businessBySlug.get(definition.slug);
    const profile = profileBySlug.get(definition.slug);
    const ownerId = String(business?.ownerUserId || profile?.ownerUserId || "").trim();
    const owner = ownerById.get(ownerId);
    const profileData = recordValue(business?.profileData);
    const importExtras = recordValue(profileData.importExtras);
    const phone = stringValue(profileData.phone);
    const email = stringValue(profileData.email);
    const notificationEmail = stringValue(profileData.notificationEmail);
    const profileControl = stringValue(importExtras.profile_control);
    const contactManagement = stringValue(importExtras.contact_management);
    const ownershipConsistent = Boolean(
      business &&
        profile &&
        String(profile.businessId || "") === String(business.id) &&
        String(profile.ownerUserId || "") === String(business.ownerUserId || "")
    );
    const ownerVerified = Boolean(
      owner && (owner.verifiedBadge === true || owner.verificationStatus === "approved")
    );
    const ownerIsVerifiedAdmin = Boolean(
      owner &&
        hasVerifiedTradeScoutAdminCustody({
          ownerRole: owner.role,
          ownerRoles: owner.roles,
          ownerVerifiedBadge: owner.verifiedBadge,
          ownerVerificationStatus: owner.verificationStatus,
        })
    );
    const issues: ManagedPartnerProfileIssue[] = [];

    if (!business) {
      pushIssue(issues, "blocker", "business_missing", "The canonical business record is missing.");
    }
    if (!profile) {
      pushIssue(issues, "blocker", "profile_missing", "The canonical public profile record is missing.");
    }
    if (business && business.status !== "active") {
      pushIssue(
        issues,
        "blocker",
        "business_not_active",
        `The business is ${business.status || "not active"}.`
      );
    }
    if (profile && profile.status !== "published") {
      pushIssue(
        issues,
        "blocker",
        "profile_not_published",
        `The profile is ${profile.status || "not published"}.`
      );
    }
    if (business && profile && !ownershipConsistent) {
      pushIssue(
        issues,
        "blocker",
        "ownership_mismatch",
        "Business, profile, and owner links do not agree."
      );
    }

    if (
      definition.exposureMode === "public" &&
      booleanValue(business?.publicDiscoveryEnabled) !== true
    ) {
      pushIssue(
        issues,
        "attention",
        "public_discovery_off",
        "This partner is intended to be public, but public discovery is off."
      );
    }
    if (
      definition.exposureMode === "direct_only" &&
      booleanValue(business?.publicDiscoveryEnabled) !== false
    ) {
      pushIssue(
        issues,
        "attention",
        "direct_only_discovery_on",
        "This direct-only profile is currently discoverable."
      );
    }

    if (definition.controlMode === "tradescout_admin_controlled") {
      if (!ownerIsVerifiedAdmin) {
        pushIssue(
          issues,
          "blocker",
          "admin_custody_missing",
          "A verified TradeScout admin is not controlling the profile."
        );
      }
      if (profileControl !== "tradescout_admin_controlled") {
        pushIssue(
          issues,
          "attention",
          "admin_control_marker_missing",
          "The TradeScout-admin-controlled marker is missing from the business record."
        );
      }
      if (business?.claimStatus !== "admin_managed") {
        pushIssue(
          issues,
          "attention",
          "admin_claim_state_mismatch",
          "The business claim state is not marked admin managed."
        );
      }
    }

    if (definition.controlMode === "admin_stewarded_pending_owner_transfer") {
      if (!ownerIsVerifiedAdmin) {
        pushIssue(
          issues,
          "blocker",
          "temporary_admin_steward_missing",
          "The temporary verified TradeScout steward is missing."
        );
      }
      if (business?.claimStatus !== "owner_confirmed_pending_transfer") {
        pushIssue(
          issues,
          "attention",
          "owner_transfer_state_missing",
          "The pending owner-account transfer state is not recorded."
        );
      }
    }

    if (definition.controlMode === "admin_stewarded_pending_claim") {
      const sources = stringList(business?.sources);
      if (!sources.includes("admin_provisioned_business_profile")) {
        pushIssue(
          issues,
          "attention",
          "narrow_steward_marker_missing",
          "The narrow admin-steward authority marker is missing."
        );
      }
    }

    if (definition.contactMode === "tradescout_managed") {
      if (!equalContact(phone, definition.expectedPhone)) {
        pushIssue(
          issues,
          "blocker",
          "managed_phone_mismatch",
          `Managed phone is ${phone || "missing"}; expected ${definition.expectedPhone}.`
        );
      }
      if (!equalContact(email, definition.expectedEmail)) {
        pushIssue(
          issues,
          "blocker",
          "managed_email_mismatch",
          `Managed email is ${email || "missing"}; expected ${definition.expectedEmail}.`
        );
      }
      if (!equalContact(notificationEmail, definition.expectedNotificationEmail)) {
        pushIssue(
          issues,
          "attention",
          "notification_email_mismatch",
          `Notification email is ${notificationEmail || "missing"}; expected ${
            definition.expectedNotificationEmail
          }.`
        );
      }
      if (contactManagement !== "tradescout_managed") {
        pushIssue(
          issues,
          "attention",
          "managed_contact_marker_missing",
          "The shared TradeScout-managed contact marker is missing."
        );
      }
    }

    if (definition.contactMode === "business_phone_tradescout_email") {
      if (!phone) {
        pushIssue(issues, "blocker", "business_phone_missing", "The public business phone is missing.");
      }
      if (!equalContact(email, definition.expectedEmail)) {
        pushIssue(
          issues,
          "blocker",
          "managed_message_email_mismatch",
          `Message email is ${email || "missing"}; expected ${definition.expectedEmail}.`
        );
      }
      if (!equalContact(notificationEmail, definition.expectedNotificationEmail)) {
        pushIssue(
          issues,
          "attention",
          "managed_notification_mismatch",
          `Notification email is ${notificationEmail || "missing"}; expected ${
            definition.expectedNotificationEmail
          }.`
        );
      }
    }

    if (definition.contactMode === "pending_owner_contact") {
      pushIssue(
        issues,
        "attention",
        "contact_pending",
        "The final public contact is intentionally unresolved and needs an owner decision."
      );
    }

    const currentPrimaryCta = primaryCtaLabel(profile?.ctaConfig);
    if (
      definition.expectedPrimaryCta &&
      currentPrimaryCta !== definition.expectedPrimaryCta
    ) {
      pushIssue(
        issues,
        "attention",
        "primary_cta_mismatch",
        `Primary action is ${currentPrimaryCta || "missing"}; expected ${
          definition.expectedPrimaryCta
        }.`
      );
    }
    if (currentPrimaryCta && /direct connect/i.test(currentPrimaryCta)) {
      pushIssue(
        issues,
        "attention",
        "legacy_direct_connect_copy",
        "The public action still uses legacy Direct Connect wording."
      );
    }

    if (definition.requestRecipientSlug !== definition.slug) {
      const recipientBusiness = businessBySlug.get(definition.requestRecipientSlug);
      const recipientProfile = profileBySlug.get(definition.requestRecipientSlug);
      if (
        !recipientBusiness ||
        !recipientProfile ||
        recipientBusiness.status !== "active" ||
        recipientProfile.status !== "published"
      ) {
        pushIssue(
          issues,
          "blocker",
          "request_recipient_unavailable",
          `The operating request recipient ${definition.requestRecipientSlug} is not ready.`
        );
      } else {
        pushIssue(
          issues,
          "info",
          "separate_request_recipient",
          `Requests are intentionally handled by ${definition.requestRecipientSlug}.`
        );
      }
    }

    return {
      slug: definition.slug,
      displayName: definition.displayName,
      profileUrl: `/u/${encodeURIComponent(definition.slug)}`,
      archetype: definition.archetype,
      controlMode: definition.controlMode,
      contactMode: definition.contactMode,
      exposureMode: definition.exposureMode,
      requestMode: definition.requestMode,
      requestRecipientSlug: definition.requestRecipientSlug,
      sourceWebsite: definition.sourceWebsite,
      relationshipLabel: definition.relationshipLabel,
      notes: definition.notes,
      status: resolveStatus(issues),
      issues,
      current: {
        businessExists: Boolean(business),
        profileExists: Boolean(profile),
        businessStatus: stringValue(business?.status),
        profileStatus: stringValue(profile?.status),
        claimStatus: stringValue(business?.claimStatus),
        publicDiscoveryEnabled: booleanValue(business?.publicDiscoveryEnabled),
        ownershipConsistent,
        ownerRole: stringValue(owner?.role),
        ownerVerified,
        profileControl,
        contactManagement,
        phone,
        email,
        notificationEmail,
        primaryCta: currentPrimaryCta,
        headline: stringValue(profile?.headline),
      },
      expected: {
        phone: stringValue(definition.expectedPhone),
        email: stringValue(definition.expectedEmail),
        notificationEmail: stringValue(definition.expectedNotificationEmail),
        primaryCta: stringValue(definition.expectedPrimaryCta),
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: items.length,
      ready: items.filter((item) => item.status === "ready").length,
      attention: items.filter((item) => item.status === "attention").length,
      blocked: items.filter((item) => item.status === "blocked").length,
    },
    items,
  };
}
