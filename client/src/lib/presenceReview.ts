export type PresenceSitePath = "hosted_new" | "keep_external" | "preserve_migrate";

export type OwnedPresenceProfile = {
  id: string;
  businessId: string;
  ownerUserId: string;
  slug: string;
  displayName: string;
};

export type PresenceReviewRecord = {
  businessId: string;
  profileId: string;
  revision: number;
  evidenceDigest: string;
  planHash: string;
  status: "draft" | "stale" | "site_path_selected";
  selectedSitePath: PresenceSitePath | null;
  executionAuthorized: false;
  plan: {
    businessId: string;
    profileId: string;
    evidenceDigest: string;
    planHash: string;
    sitePath: {
      recommended: PresenceSitePath | null;
      allowed: PresenceSitePath[];
      reason: string;
    };
    evidenceSources: Array<{ path: string; sourceRef: string }>;
    quarantinedEvidence: Array<{ path: string; reason: string; sourceRef?: string }>;
    actions: Array<{
      id: string;
      adapterAvailability: "existing" | "planned" | "absent";
      executable: false;
      tierNeutral: true;
      requiredGates: Array<{ gate: string; role: "Business Owner" | "Platform Owner" }>;
    }>;
  };
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isSitePath(value: unknown): value is PresenceSitePath {
  return value === "hosted_new" || value === "keep_external" || value === "preserve_migrate";
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

/** Only show a plan after its owner, canonical profile and stored proposal agree. */
export function resolvePresenceReviewContext(
  candidate: unknown,
  profiles: unknown,
  ownerUserId: unknown
): { record: PresenceReviewRecord; profile: OwnedPresenceProfile } | null {
  const record = object(candidate);
  const plan = object(record?.plan);
  const sitePath = object(plan?.sitePath);
  const ownerId = typeof ownerUserId === "string" ? ownerUserId.trim() : "";
  if (
    !record ||
    !plan ||
    !sitePath ||
    !ownerId ||
    typeof record.businessId !== "string" ||
    !record.businessId ||
    typeof record.profileId !== "string" ||
    !record.profileId ||
    record.businessId !== plan.businessId ||
    record.profileId !== plan.profileId ||
    !isDigest(record.evidenceDigest) ||
    record.evidenceDigest !== plan.evidenceDigest ||
    !isDigest(record.planHash) ||
    record.planHash !== plan.planHash ||
    !Number.isInteger(record.revision) ||
    (record.revision as number) < 1 ||
    !["draft", "stale", "site_path_selected"].includes(String(record.status)) ||
    record.executionAuthorized !== false ||
    !Array.isArray(sitePath.allowed) ||
    !sitePath.allowed.every(isSitePath) ||
    (sitePath.recommended !== null && !isSitePath(sitePath.recommended)) ||
    typeof sitePath.reason !== "string" ||
    (record.selectedSitePath !== null && !isSitePath(record.selectedSitePath)) ||
    (record.status === "site_path_selected" &&
      (!isSitePath(record.selectedSitePath) ||
        !sitePath.allowed.includes(record.selectedSitePath))) ||
    !Array.isArray(plan.evidenceSources) ||
    !plan.evidenceSources.every(
      (source) => typeof source?.path === "string" && typeof source?.sourceRef === "string"
    ) ||
    !Array.isArray(plan.quarantinedEvidence) ||
    !plan.quarantinedEvidence.every(
      (item) => typeof item?.path === "string" && typeof item?.reason === "string"
    ) ||
    !Array.isArray(plan.actions) ||
    !plan.actions.every(
      (action) =>
        typeof action?.id === "string" &&
        ["existing", "planned", "absent"].includes(action.adapterAvailability) &&
        action.executable === false &&
        action.tierNeutral === true &&
        Array.isArray(action.requiredGates) &&
        action.requiredGates.every(
          (gate) =>
            typeof gate?.gate === "string" &&
            (gate.role === "Business Owner" || gate.role === "Platform Owner")
        )
    ) ||
    !Array.isArray(profiles)
  ) {
    return null;
  }

  const matches = profiles.filter((value) => {
    const profile = object(value);
    return (
      profile !== null &&
      profile.id === record.profileId &&
      profile.businessId === record.businessId &&
      profile.ownerUserId === ownerId &&
      typeof profile.slug === "string" &&
      Boolean(profile.slug.trim()) &&
      typeof profile.displayName === "string" &&
      Boolean(profile.displayName.trim())
    );
  });
  if (matches.length !== 1) return null;
  return {
    record: candidate as PresenceReviewRecord,
    profile: matches[0] as OwnedPresenceProfile,
  };
}

/** References are navigation only. A future crawler needs its own DNS/SSRF guard. */
export function safePresenceSourceHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Human labels only: never show internal JSON paths or inferred claim values. */
export function presenceEvidenceLabel(path: unknown): string {
  if (typeof path !== "string") return "Business detail";
  const exact: Record<string, string> = {
    $: "Business setup",
    "$.kind": "Business setup type",
    "$.businessId": "Business identity",
    "$.profileId": "Business profile",
    "$.externalWebsiteUrl": "Current website",
    "$.provenance.evidence": "Business discovery information",
    "$.provenance.evidence.targetBusinessId": "Business identity",
    "$.provenance.evidence.targetProfileId": "Business profile",
    "$.provenance.evidence.name": "Business name",
    "$.provenance.evidence.notes": "Business notes",
    "$.provenance.evidence.services": "Services",
    "$.provenance.evidence.photoUrls": "Business photos",
    "$.provenance.evidence.links": "Business source links",
    "$.provenance.enrichment.output": "Imported business information",
    "$.provenance.enrichment.output.description": "Business description",
    "$.provenance.enrichment.output.about": "About the business",
    "$.provenance.enrichment.output.services": "Service information",
  };
  if (exact[path]) return exact[path];
  if (/^\$\.provenance\.evidence\.links\[\d+\]$/.test(path)) return "Business source link";
  if (/^\$\.provenance\.enrichment\.output\.(description|about)\.sourceUrls\[\d+\]$/.test(path)) {
    return "Business source link";
  }
  if (/^\$\.provenance\.enrichment\.output\.services\[\d+\](?:\.sourceUrls\[\d+\])?$/.test(path)) {
    return "Service information";
  }
  return "Business detail";
}

export function presenceRecommendationLabel(
  reason: unknown,
  recommendedPath: PresenceSitePath
): string | null {
  if (reason === "no_existing_website" && recommendedPath === "hosted_new") {
    return "Suggested because no current website is listed.";
  }
  if (reason === "existing_website" && recommendedPath === "keep_external") {
    return "Suggested because a current website is listed.";
  }
  return null;
}
