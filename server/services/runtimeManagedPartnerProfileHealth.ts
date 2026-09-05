import {
  MANAGED_PARTNER_PROFILE_DEFINITIONS,
  type ManagedPartnerProfileDefinition,
} from "@shared/managedPartnerProfileRegistry";
import { pool } from "../db";
import {
  getBusinessManagedContactIssues,
  getManagedPartnerProfileHealth,
  type ManagedPartnerIssueSeverity,
  type ManagedPartnerProfileHealthItem,
  type ManagedPartnerProfileHealthReport,
  type ManagedPartnerProfileIssue,
} from "./managedPartnerProfileHealth";
import { getRuntimeManagedPartnerProfileDefinitions } from "./managedPartnerIntake";
import { hasVerifiedTradeScoutAdminCustody } from "./ownerConfirmedDirectProfile";

type RuntimePartnerRow = {
  requested_slug: string;
  business_id: string | null;
  business_name: string | null;
  business_status: string | null;
  claim_status: string | null;
  public_discovery_enabled: boolean | null;
  business_owner_user_id: string | null;
  profile_data: unknown;
  sources: unknown;
  profile_id: string | null;
  profile_status: string | null;
  display_name: string | null;
  headline: string | null;
  profile_owner_user_id: string | null;
  profile_business_id: string | null;
  cta_config: unknown;
  owner_role: string | null;
  owner_roles: unknown;
  verified_badge: boolean | null;
  verification_status: string | null;
  owner_provider: string | null;
  owner_email_verified: boolean | null;
};

function recordValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    } catch {
      return value
        .replace(/^\{|\}$/g, "")
        .split(",")
        .map((entry) => entry.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
  }
  return [];
}

function stringValue(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
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
  return (
    String(actual || "")
      .trim()
      .toLowerCase() === expected.trim().toLowerCase()
  );
}

function resolveStatus(
  issues: ManagedPartnerProfileIssue[]
): ManagedPartnerProfileHealthItem["status"] {
  if (issues.some((issue) => issue.severity === "blocker")) return "blocked";
  if (issues.some((issue) => issue.severity === "attention")) return "attention";
  return "ready";
}

function auditRuntimeDefinition(args: {
  definition: ManagedPartnerProfileDefinition;
  row: RuntimePartnerRow | undefined;
  rowBySlug: Map<string, RuntimePartnerRow>;
}): ManagedPartnerProfileHealthItem {
  const { definition, row, rowBySlug } = args;
  const profileData = recordValue(row?.profile_data);
  const importExtras = recordValue(profileData.importExtras);
  const phone = stringValue(profileData.phone);
  const email = stringValue(profileData.email);
  const notificationEmail = stringValue(profileData.notificationEmail);
  const profileControl = stringValue(importExtras.profile_control);
  const contactManagement =
    definition.contactMode === "business_managed"
      ? stringValue(profileData.contactManagement)
      : stringValue(importExtras.contact_management);
  const businessExists = Boolean(row?.business_id);
  const profileExists = Boolean(row?.profile_id);
  const ownershipConsistent = Boolean(
    row?.business_id &&
    row.profile_id &&
    row.profile_business_id === row.business_id &&
    row.profile_owner_user_id === row.business_owner_user_id
  );
  const ownerVerified = Boolean(
    row && (row.verified_badge === true || row.verification_status === "approved")
  );
  const ownerIsVerifiedAdmin = Boolean(
    row &&
    hasVerifiedTradeScoutAdminCustody({
      ownerRole: row.owner_role,
      ownerRoles: stringList(row.owner_roles),
      ownerVerifiedBadge: row.verified_badge,
      ownerVerificationStatus: row.verification_status,
    })
  );
  const issues: ManagedPartnerProfileIssue[] = [];

  if (!businessExists) {
    pushIssue(issues, "blocker", "business_missing", "The canonical business record is missing.");
  }
  if (!profileExists) {
    pushIssue(
      issues,
      "blocker",
      "profile_missing",
      "The canonical public profile record is missing."
    );
  }
  if (businessExists && row?.business_status !== "active") {
    pushIssue(
      issues,
      "blocker",
      "business_not_active",
      `The business is ${row?.business_status || "not active"}.`
    );
  }
  if (profileExists && row?.profile_status !== "published") {
    pushIssue(
      issues,
      "blocker",
      "profile_not_published",
      `The profile is ${row?.profile_status || "not published"}.`
    );
  }
  if (businessExists && profileExists && !ownershipConsistent) {
    pushIssue(
      issues,
      "blocker",
      "ownership_mismatch",
      "Business, profile, and owner links do not agree."
    );
  }

  if (definition.exposureMode === "public" && row?.public_discovery_enabled !== true) {
    pushIssue(
      issues,
      "attention",
      "public_discovery_off",
      "This partner is intended to be public, but public discovery is off."
    );
  }
  if (definition.exposureMode === "direct_only" && row?.public_discovery_enabled !== false) {
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
    if (row?.claim_status !== "admin_managed") {
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
    if (row?.claim_status !== "owner_confirmed_pending_transfer") {
      pushIssue(
        issues,
        "attention",
        "owner_transfer_state_missing",
        "The pending owner-account transfer state is not recorded."
      );
    }
  }

  if (definition.controlMode === "admin_stewarded_pending_claim") {
    const sources = stringList(row?.sources);
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
      pushIssue(
        issues,
        "blocker",
        "business_phone_missing",
        "The public business phone is missing."
      );
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

  issues.push(
    ...getBusinessManagedContactIssues({
      definition,
      phone,
      email,
      notificationEmail,
      contactManagement,
      claimStatus: stringValue(row?.claim_status),
      ownerUserId: stringValue(row?.business_owner_user_id),
      ownerProvider: stringValue(row?.owner_provider),
      ownerEmailVerified: row?.owner_email_verified ?? null,
    })
  );

  const currentPrimaryCta = primaryCtaLabel(row?.cta_config);
  if (definition.expectedPrimaryCta && currentPrimaryCta !== definition.expectedPrimaryCta) {
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
    const recipient = rowBySlug.get(definition.requestRecipientSlug);
    if (
      !recipient?.business_id ||
      !recipient.profile_id ||
      recipient.business_status !== "active" ||
      recipient.profile_status !== "published"
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
      businessExists,
      profileExists,
      businessStatus: stringValue(row?.business_status),
      profileStatus: stringValue(row?.profile_status),
      claimStatus: stringValue(row?.claim_status),
      publicDiscoveryEnabled:
        typeof row?.public_discovery_enabled === "boolean" ? row.public_discovery_enabled : null,
      ownershipConsistent,
      ownerRole: stringValue(row?.owner_role),
      ownerVerified,
      profileControl,
      contactManagement,
      phone,
      email,
      notificationEmail,
      primaryCta: currentPrimaryCta,
      headline: stringValue(row?.headline),
    },
    expected: {
      phone: stringValue(definition.expectedPhone),
      email: stringValue(definition.expectedEmail),
      notificationEmail: stringValue(definition.expectedNotificationEmail),
      primaryCta: stringValue(definition.expectedPrimaryCta),
    },
  };
}

async function loadRuntimeRows(slugs: string[]): Promise<Map<string, RuntimePartnerRow>> {
  if (slugs.length === 0) return new Map();
  const result = await pool.query<RuntimePartnerRow>(
    `WITH requested AS (
       SELECT unnest($1::text[]) AS requested_slug
     )
     SELECT
       requested.requested_slug,
       b.id AS business_id,
       b.name AS business_name,
       b.status AS business_status,
       b.claim_status,
       b.public_discovery_enabled,
       b.owner_user_id AS business_owner_user_id,
       b.profile_data,
       b.sources,
       p.id AS profile_id,
       p.status AS profile_status,
       p.display_name,
       p.headline,
       p.owner_user_id AS profile_owner_user_id,
       p.business_id AS profile_business_id,
       p.cta_config,
       u.role AS owner_role,
       u.roles AS owner_roles,
       u.verified_badge,
       u.verification_status,
       u.provider AS owner_provider,
       u.email_verified AS owner_email_verified
     FROM requested
     LEFT JOIN businesses b ON b.slug = requested.requested_slug
     LEFT JOIN profiles p ON p.slug = requested.requested_slug
     LEFT JOIN users u ON u.id = COALESCE(b.owner_user_id, p.owner_user_id)`,
    [slugs]
  );
  return new Map(result.rows.map((row) => [row.requested_slug, row]));
}

/**
 * Extends the established static-profile audit with intake records promoted to
 * live. The permanent five profiles stay protected by their checked-in
 * contracts while every future live partner joins the same operations board
 * without another registry edit.
 */
export async function getRuntimeManagedPartnerProfileHealth(): Promise<ManagedPartnerProfileHealthReport> {
  const [staticReport, runtimeDefinitions] = await Promise.all([
    getManagedPartnerProfileHealth(),
    getRuntimeManagedPartnerProfileDefinitions(),
  ]);
  const staticSlugs = new Set<string>(
    MANAGED_PARTNER_PROFILE_DEFINITIONS.map((definition) => definition.slug)
  );
  const dynamicDefinitions = runtimeDefinitions.filter(
    (definition) => !staticSlugs.has(definition.slug)
  );
  if (dynamicDefinitions.length === 0) return staticReport;

  const requestedSlugs = Array.from(
    new Set(
      dynamicDefinitions.flatMap((definition) => [definition.slug, definition.requestRecipientSlug])
    )
  );
  const rowBySlug = await loadRuntimeRows(requestedSlugs);
  const dynamicItems = dynamicDefinitions.map((definition) =>
    auditRuntimeDefinition({
      definition,
      row: rowBySlug.get(definition.slug),
      rowBySlug,
    })
  );
  const items = [...staticReport.items, ...dynamicItems].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

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
