import { createHash } from "node:crypto";

/** A proposal derived from the already-owned canonical business and profile. */
export interface PresencePlanInput {
  businessId: string;
  profileId: string;
  /** The complete persisted preferences.onboardingOutcome, not a new identity. */
  onboardingEvidence: unknown;
  /** Read from the canonical business, never inferred from intake links. */
  externalWebsiteUrl?: string | null;
}

export type PresenceSitePath = "hosted_new" | "keep_external" | "preserve_migrate";
export type PresenceGateRole = "Business Owner" | "Platform Owner";
export type PresenceGate =
  | "confirm_profile_facts"
  | "approve_site_path"
  | "approve_public_content"
  | "approve_domain_purchase"
  | "approve_dns_cutover"
  | "approve_external_account_write"
  | "approve_contact_configuration"
  | "approve_migration"
  | "approve_release";

export interface PresenceAction {
  id:
    | "profile.review"
    | "site.prepare"
    | "domain.select_register"
    | "domain.connect"
    | "google_business.claim_configure"
    | "reviews.configure"
    | "analytics.configure"
    | "social.configure"
    | "direct_connect.configure"
    | "migration.shadow_clone_verify";
  surface:
    | "profile"
    | "site"
    | "domain"
    | "google_business"
    | "reviews"
    | "analytics"
    | "social"
    | "direct_connect"
    | "migration";
  requiredGates: ReadonlyArray<{ gate: PresenceGate; role: PresenceGateRole }>;
  tierNeutral: true;
  /** Availability of this exact operation, not a promise that its provider is connected. */
  adapterAvailability: "existing" | "planned" | "absent";
  executable: false;
}

export interface PresencePlan {
  businessId: string;
  profileId: string;
  /** Hash of the complete persisted outcome and canonical external website value. */
  evidenceDigest: string;
  planHash: string;
  sitePath: {
    recommended: "hosted_new" | "keep_external" | null;
    allowed: PresenceSitePath[];
    reason: "no_existing_website" | "existing_website" | "invalid_existing_website";
  };
  /** References only. No imported claim is accepted or copied into this plan. */
  evidenceSources: Array<{ path: string; sourceRef: string }>;
  /** Review against the persisted source record; values are deliberately omitted. */
  quarantinedEvidence: Array<{
    path: string;
    reason:
      | "missing_onboarding_evidence"
      | "unsupported_evidence_shape"
      | "identity_conflict"
      | "requires_owner_confirmation"
      | "missing_source_reference"
      | "invalid_source_url"
      | "invalid_existing_website";
    sourceRef?: string;
    sourceOrder: number;
  }>;
  actions: PresenceAction[];
}

type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };
type Quarantine = PresencePlan["quarantinedEvidence"][number];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** JSONB object key order is irrelevant; array order and all values are retained. */
function stableJson(value: unknown): string {
  const seen = new Set<object>();
  function normalize(current: unknown): JsonValue {
    if (current === null) return null;
    if (typeof current === "string" || typeof current === "boolean") return current;
    if (typeof current === "number" && Number.isFinite(current)) return current;
    if (!current || typeof current !== "object") {
      throw new TypeError("Presence evidence must be persisted JSON");
    }
    if (seen.has(current)) throw new TypeError("Presence evidence must not contain cycles");
    seen.add(current);
    try {
      if (Array.isArray(current)) return current.map(normalize);
      if (
        Object.getPrototypeOf(current) !== Object.prototype &&
        Object.getPrototypeOf(current) !== null
      ) {
        throw new TypeError("Presence evidence must be persisted JSON");
      }
      const result: { [key: string]: JsonValue } = {};
      for (const key of Object.keys(current).sort()) {
        result[key] = normalize((current as Record<string, unknown>)[key]);
      }
      return result;
    } finally {
      seen.delete(current);
    }
  }
  return JSON.stringify(normalize(value));
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return !Array.isArray(value) || value.length > 0;
}

/** Validate a public URL without making a request or resolving DNS. */
function publicUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2_000 || /[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const parsed = new URL(raw);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password ||
      (parsed.port && parsed.port !== "80" && parsed.port !== "443")
    )
      return null;
    const host = parsed.hostname.toLowerCase();
    if (
      !host.includes(".") ||
      host.endsWith(".") ||
      host === "localhost" ||
      /\.(?:localhost|local|internal|lan|home|arpa)$/.test(host) ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      host.startsWith("[") ||
      !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
    )
      return null;
    parsed.hash = "";
    parsed.search = ""; // Source references never expose possible query secrets.
    return parsed.toString();
  } catch {
    return null;
  }
}

function action(
  id: PresenceAction["id"],
  surface: PresenceAction["surface"],
  adapterAvailability: PresenceAction["adapterAvailability"],
  requiredGates: PresenceAction["requiredGates"]
): PresenceAction {
  return { id, surface, requiredGates, tierNeutral: true, adapterAvailability, executable: false };
}

const businessOwner = (gate: PresenceGate) => ({ gate, role: "Business Owner" as const });
const platformOwner = (gate: PresenceGate) => ({ gate, role: "Platform Owner" as const });

function actions(hasExistingWebsite: boolean): PresenceAction[] {
  const proposed: PresenceAction[] = [
    action("profile.review", "profile", "existing", [
      businessOwner("confirm_profile_facts"),
      businessOwner("approve_public_content"),
    ]),
    action("site.prepare", "site", "planned", [
      businessOwner("approve_site_path"),
      businessOwner("approve_public_content"),
    ]),
    action("domain.select_register", "domain", "absent", [
      businessOwner("approve_domain_purchase"),
      platformOwner("approve_release"),
    ]),
    action("domain.connect", "domain", "absent", [
      businessOwner("approve_dns_cutover"),
      platformOwner("approve_release"),
    ]),
    action("google_business.claim_configure", "google_business", "absent", [
      businessOwner("approve_external_account_write"),
    ]),
    action("reviews.configure", "reviews", "planned", [businessOwner("approve_public_content")]),
    action("analytics.configure", "analytics", "planned", [
      businessOwner("approve_external_account_write"),
    ]),
    action("social.configure", "social", "absent", [
      businessOwner("approve_external_account_write"),
    ]),
    action("direct_connect.configure", "direct_connect", "existing", [
      businessOwner("approve_contact_configuration"),
    ]),
  ];
  if (hasExistingWebsite) {
    proposed.push(
      action("migration.shadow_clone_verify", "migration", "absent", [
        businessOwner("approve_migration"),
        businessOwner("approve_dns_cutover"),
        platformOwner("approve_release"),
      ])
    );
  }
  return proposed;
}

function summarizeEvidence(outcomeValue: unknown, businessId: string, profileId: string) {
  const evidenceSources: PresencePlan["evidenceSources"] = [];
  const quarantinedEvidence: Quarantine[] = [];
  let nextSourceOrder = 0;
  const addQuarantine = (
    path: string,
    reason: Quarantine["reason"],
    sourceOrder = Number.MAX_SAFE_INTEGER,
    sourceRef?: string
  ) => {
    quarantinedEvidence.push({ path, reason, ...(sourceRef ? { sourceRef } : {}), sourceOrder });
  };
  const outcome = record(outcomeValue);
  if (!outcome) {
    addQuarantine("$", "missing_onboarding_evidence");
    return { evidenceSources, quarantinedEvidence };
  }
  if (outcome.kind !== "business_profile") addQuarantine("$.kind", "unsupported_evidence_shape");
  if (outcome.businessId !== businessId) addQuarantine("$.businessId", "identity_conflict");
  if (outcome.profileId !== profileId) addQuarantine("$.profileId", "identity_conflict");
  const provenance = record(outcome.provenance);
  const evidence = record(provenance?.evidence);
  if (!evidence) {
    addQuarantine("$.provenance.evidence", "missing_onboarding_evidence");
  } else {
    if (hasValue(evidence.targetBusinessId) && evidence.targetBusinessId !== businessId) {
      addQuarantine("$.provenance.evidence.targetBusinessId", "identity_conflict");
    }
    if (hasValue(evidence.targetProfileId) && evidence.targetProfileId !== profileId) {
      addQuarantine("$.provenance.evidence.targetProfileId", "identity_conflict");
    }
    for (const key of ["name", "notes", "services", "photoUrls"] as const) {
      if (hasValue(evidence[key]))
        addQuarantine(`$.provenance.evidence.${key}`, "requires_owner_confirmation");
    }
    if (Array.isArray(evidence.links)) {
      evidence.links.forEach((link, index) => {
        const path = `$.provenance.evidence.links[${index}]`;
        const sourceRef = publicUrl(link);
        const sourceOrder = nextSourceOrder++;
        if (sourceRef) evidenceSources.push({ path, sourceRef });
        else addQuarantine(path, "invalid_source_url", sourceOrder);
      });
    } else if (hasValue(evidence.links)) {
      addQuarantine("$.provenance.evidence.links", "unsupported_evidence_shape");
    }
  }

  const enrichment = record(provenance?.enrichment);
  const output = record(enrichment?.output);
  if (output) {
    const cited = (claim: unknown, path: string) => {
      const entry = record(claim);
      if (!entry) {
        addQuarantine(path, "unsupported_evidence_shape");
        return;
      }
      const refs = entry.sourceUrls;
      if (!Array.isArray(refs) || refs.length === 0) {
        addQuarantine(path, "missing_source_reference");
        return;
      }
      refs.forEach((ref, index) => {
        const sourceRef = publicUrl(ref);
        const sourceOrder = nextSourceOrder++;
        if (sourceRef) evidenceSources.push({ path, sourceRef });
        else addQuarantine(`${path}.sourceUrls[${index}]`, "invalid_source_url", sourceOrder);
      });
    };
    if (hasValue(output.description))
      cited(output.description, "$.provenance.enrichment.output.description");
    if (hasValue(output.about)) cited(output.about, "$.provenance.enrichment.output.about");
    if (Array.isArray(output.services)) {
      output.services.forEach((service, index) =>
        cited(service, `$.provenance.enrichment.output.services[${index}]`)
      );
    } else if (hasValue(output.services)) {
      addQuarantine("$.provenance.enrichment.output.services", "unsupported_evidence_shape");
    }
  } else if (hasValue(enrichment?.output)) {
    addQuarantine("$.provenance.enrichment.output", "unsupported_evidence_shape");
  }
  evidenceSources.sort(
    (a, b) => a.path.localeCompare(b.path) || a.sourceRef.localeCompare(b.sourceRef)
  );
  quarantinedEvidence.sort((a, b) => a.sourceOrder - b.sourceOrder || a.path.localeCompare(b.path));
  return { evidenceSources, quarantinedEvidence };
}

/**
 * Build a reviewable, tier-neutral proposal. This function has no I/O and
 * never confirms imported facts, selects a site path for the owner, or writes
 * to a public/provider surface. Callers must rederive and compare the digest
 * before every review decision because the persisted outcome can change.
 */
export function derivePresencePlan(input: PresencePlanInput): PresencePlan {
  const businessId = input.businessId?.trim();
  const profileId = input.profileId?.trim();
  if (!businessId || !profileId || businessId.length > 200 || profileId.length > 200) {
    throw new TypeError("Canonical business and profile IDs are required");
  }
  const websiteValue = input.externalWebsiteUrl ?? null;
  const hasWebsite =
    websiteValue !== null && (typeof websiteValue !== "string" || websiteValue.trim().length > 0);
  const normalizedWebsite = hasWebsite ? publicUrl(websiteValue) : null;
  const sitePath: PresencePlan["sitePath"] = hasWebsite
    ? normalizedWebsite
      ? {
          recommended: "keep_external",
          allowed: ["keep_external", "preserve_migrate"],
          reason: "existing_website",
        }
      : { recommended: null, allowed: [], reason: "invalid_existing_website" }
    : { recommended: "hosted_new", allowed: ["hosted_new"], reason: "no_existing_website" };
  const evidenceDigest = sha256(
    stableJson({ onboardingEvidence: input.onboardingEvidence, externalWebsiteUrl: websiteValue })
  );
  const summary = summarizeEvidence(input.onboardingEvidence, businessId, profileId);
  if (hasWebsite && !normalizedWebsite) {
    summary.quarantinedEvidence.push({
      path: "$.externalWebsiteUrl",
      reason: "invalid_existing_website",
      sourceOrder: Number.MAX_SAFE_INTEGER,
    });
    summary.quarantinedEvidence.sort(
      (a, b) => a.sourceOrder - b.sourceOrder || a.path.localeCompare(b.path)
    );
  }
  const body = {
    businessId,
    profileId,
    evidenceDigest,
    sitePath,
    ...summary,
    actions: actions(Boolean(normalizedWebsite)),
  };
  return { ...body, planHash: sha256(stableJson(body)) };
}
