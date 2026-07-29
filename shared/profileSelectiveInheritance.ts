/**
 * Selective inheritance: account → business → public profile site template.
 *
 * Model (LISA / OR): keep what is still true and useful; discard waste;
 * never invent contact power or silent judgment. Humans confirm merge choices.
 */

import {
  isProfileSiteTemplateGalleryId,
  seedBlocksForTemplate,
  upsertSiteTemplateBlock,
  type ProfileContentBlock,
  type ProfileSiteTemplateGalleryId,
  type ProfileSiteTemplateId,
} from "./profileSiteTemplates";

export type InheritanceDecision = "keep_source" | "keep_target" | "merge" | "discard";

export type InheritanceFieldId =
  | "displayName"
  | "headline"
  | "heroTitle"
  | "heroText"
  | "city"
  | "county"
  | "website"
  | "description"
  | "siteTemplate";

export type InheritanceFieldProposal = {
  id: InheritanceFieldId;
  label: string;
  sourceLayer: "account" | "business" | "template_seed";
  sourceValue: string | null;
  targetValue: string | null;
  /** Default decision when the user has not overridden. */
  suggested: InheritanceDecision;
  rationale: string;
};

export type AccountInheritanceSource = {
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  countyName?: string | null;
  stateCode?: string | null;
};

export type BusinessInheritanceSource = {
  name?: string | null;
  website?: string | null;
  description?: string | null;
  categories?: string[] | null;
  city?: string | null;
  countyName?: string | null;
  stateCode?: string | null;
};

export type PublicProfileInheritanceTarget = {
  displayName?: string | null;
  headline?: string | null;
  contentBlocks?: unknown;
};

export type SelectiveInheritanceInput = {
  templateId: ProfileSiteTemplateId;
  account?: AccountInheritanceSource | null;
  business?: BusinessInheritanceSource | null;
  profile?: PublicProfileInheritanceTarget | null;
};

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readHero(contentBlocks: unknown): { title: string | null; text: string | null } {
  if (!Array.isArray(contentBlocks)) return { title: null, text: null };
  const hero = contentBlocks.find(
    (block) => block && typeof block === "object" && (block as any).type === "hero"
  ) as { data?: Record<string, unknown> } | undefined;
  const data = hero?.data && typeof hero.data === "object" ? hero.data : {};
  return {
    title: nonEmpty(data.title),
    text: nonEmpty(data.text) || nonEmpty(data.body) || nonEmpty(data.description),
  };
}

function accountDisplayName(account?: AccountInheritanceSource | null): string | null {
  const first = nonEmpty(account?.firstName);
  const last = nonEmpty(account?.lastName);
  if (first && last) return `${first} ${last}`;
  return first || last;
}

/** Propose keep/merge/discard for each field when promoting into a public profile. */
export function proposeProfileSelectiveInheritance(
  input: SelectiveInheritanceInput
): InheritanceFieldProposal[] {
  const businessName = nonEmpty(input.business?.name);
  const accountName = accountDisplayName(input.account);
  const profileName = nonEmpty(input.profile?.displayName);
  const hero = readHero(input.profile?.contentBlocks);
  const description = nonEmpty(input.business?.description) || nonEmpty(input.profile?.headline);
  const city = nonEmpty(input.business?.city) || nonEmpty(input.account?.city);
  const county = nonEmpty(input.business?.countyName) || nonEmpty(input.account?.countyName);
  const website = nonEmpty(input.business?.website);
  const categoryHint = Array.isArray(input.business?.categories)
    ? input
        .business!.categories!.filter((value) => typeof value === "string" && value.trim())
        .slice(0, 3)
        .join(", ")
    : null;

  const proposals: InheritanceFieldProposal[] = [
    {
      id: "siteTemplate",
      label: "Public profile template",
      sourceLayer: "template_seed",
      sourceValue: input.templateId,
      targetValue: null,
      suggested: "keep_source",
      rationale: "Starting layout for this business type. You can change it later.",
    },
    {
      id: "displayName",
      label: "Public display name",
      sourceLayer: businessName ? "business" : "account",
      sourceValue: businessName || accountName,
      targetValue: profileName,
      suggested:
        profileName && businessName && profileName !== businessName ? "merge" : "keep_source",
      rationale: businessName
        ? "Business name is the usual public brand."
        : "No business name yet — fall back to account name until you set one.",
    },
    {
      id: "headline",
      label: "Headline",
      sourceLayer: description ? "business" : "template_seed",
      sourceValue: description || categoryHint,
      targetValue: nonEmpty(input.profile?.headline),
      suggested: "keep_source",
      rationale: "Reuse business description or category when present; otherwise template seed.",
    },
    {
      id: "heroTitle",
      label: "Hero title",
      sourceLayer: businessName ? "business" : "template_seed",
      sourceValue: businessName || accountName,
      targetValue: hero.title,
      suggested: hero.title ? "keep_target" : "keep_source",
      rationale: "Prefer an existing hero title; otherwise inherit the business/account name.",
    },
    {
      id: "heroText",
      label: "Hero supporting text",
      sourceLayer: description ? "business" : "template_seed",
      sourceValue: description,
      targetValue: hero.text,
      suggested: hero.text ? "keep_target" : description ? "keep_source" : "discard",
      rationale: "Carry business about-copy into the hero when the public hero is empty.",
    },
    {
      id: "city",
      label: "City",
      sourceLayer: nonEmpty(input.business?.city) ? "business" : "account",
      sourceValue: city,
      targetValue: null,
      suggested: city ? "keep_source" : "discard",
      rationale: "Location already captured on account/business — do not re-ask.",
    },
    {
      id: "county",
      label: "County",
      sourceLayer: nonEmpty(input.business?.countyName) ? "business" : "account",
      sourceValue: county,
      targetValue: null,
      suggested: county ? "keep_source" : "discard",
      rationale: "County is the operational container; inherit when known.",
    },
    {
      id: "website",
      label: "Website",
      sourceLayer: "business",
      sourceValue: website,
      targetValue: null,
      suggested: website ? "keep_source" : "discard",
      rationale: "Optional external site from the business record.",
    },
    {
      id: "description",
      label: "About / description",
      sourceLayer: "business",
      sourceValue: nonEmpty(input.business?.description),
      targetValue: null,
      suggested: nonEmpty(input.business?.description) ? "keep_source" : "discard",
      rationale: "Business about text can seed the public about/hero body.",
    },
  ];

  return proposals.filter((entry) => entry.suggested !== "discard" || entry.sourceValue);
}

export type ApplyInheritanceOptions = {
  decisions?: Partial<Record<InheritanceFieldId, InheritanceDecision>>;
  displayNameFallback?: string;
};

function pickValue(
  proposal: InheritanceFieldProposal,
  decision: InheritanceDecision
): string | null {
  if (decision === "discard") return null;
  if (decision === "keep_target") return proposal.targetValue || proposal.sourceValue;
  if (decision === "merge") {
    if (proposal.sourceValue && proposal.targetValue) {
      if (proposal.sourceValue === proposal.targetValue) return proposal.sourceValue;
      return proposal.sourceValue;
    }
    return proposal.sourceValue || proposal.targetValue;
  }
  return proposal.sourceValue || proposal.targetValue;
}

/**
 * Apply confirmed decisions into contentBlocks + display fields for the public profile.
 * Does not invent contact channels or bypass gating.
 */
export function applyProfileSelectiveInheritance(
  input: SelectiveInheritanceInput,
  options?: ApplyInheritanceOptions
): {
  displayName: string;
  headline: string | null;
  contentBlocks: ProfileContentBlock[];
  applied: Array<{ id: InheritanceFieldId; decision: InheritanceDecision; value: string | null }>;
} {
  const templateId: ProfileSiteTemplateGalleryId | ProfileSiteTemplateId =
    isProfileSiteTemplateGalleryId(input.templateId)
      ? input.templateId
      : input.templateId === "default"
        ? "plumbing-company"
        : (input.templateId as ProfileSiteTemplateId);

  const galleryId: ProfileSiteTemplateGalleryId = isProfileSiteTemplateGalleryId(templateId)
    ? templateId
    : "plumbing-company";

  const proposals = proposeProfileSelectiveInheritance({ ...input, templateId: galleryId });
  const applied: Array<{
    id: InheritanceFieldId;
    decision: InheritanceDecision;
    value: string | null;
  }> = [];

  const resolved: Partial<Record<InheritanceFieldId, string | null>> = {};
  for (const proposal of proposals) {
    const decision = options?.decisions?.[proposal.id] || proposal.suggested;
    const value = pickValue(proposal, decision);
    resolved[proposal.id] = value;
    applied.push({ id: proposal.id, decision, value });
  }

  const displayName =
    resolved.displayName ||
    options?.displayNameFallback ||
    nonEmpty(input.business?.name) ||
    accountDisplayName(input.account) ||
    "Your business";

  const headline = resolved.headline || resolved.description || null;

  let contentBlocks = seedBlocksForTemplate(galleryId, input.profile?.contentBlocks, {
    displayName,
  });
  contentBlocks = upsertSiteTemplateBlock(contentBlocks, galleryId);

  const heroTitle = resolved.heroTitle || displayName;
  const heroText = resolved.heroText || headline || "";
  const heroIndex = contentBlocks.findIndex((block) => block.type === "hero");
  if (heroIndex >= 0) {
    contentBlocks[heroIndex] = {
      ...contentBlocks[heroIndex],
      data: {
        ...(contentBlocks[heroIndex].data || {}),
        title: heroTitle,
        text: heroText,
      },
    };
  } else {
    contentBlocks.push({ type: "hero", data: { title: heroTitle, text: heroText } });
  }

  if (
    (galleryId === "plumbing-company" || galleryId === "electrician-solo") &&
    (resolved.city || resolved.county)
  ) {
    contentBlocks = contentBlocks.map((block) => {
      if (block.type !== "localServiceProfile") return block;
      const locationLabel = [resolved.city, resolved.county].filter(Boolean).join(", ");
      return {
        ...block,
        data: {
          ...(block.data || {}),
          ...(locationLabel ? { locationLabel } : {}),
          ...(resolved.description ? { aboutBody: resolved.description } : {}),
          ...(heroTitle ? { heroTitle } : {}),
          ...(heroText ? { heroDescription: heroText } : {}),
        },
      };
    });
  }

  return {
    displayName,
    headline,
    contentBlocks,
    applied,
  };
}

/** Business-facing lanes that should pick a starting public-profile template. */
export function onboardingLaneNeedsSiteTemplate(lane: string | null | undefined): boolean {
  const normalized = String(lane || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "offer_services" || normalized === "business" || normalized === "real_estate"
  );
}

export function suggestTemplateFromBusinessType(
  businessType?: string | null,
  businessCategory?: string | null
): ProfileSiteTemplateGalleryId {
  const haystack = `${businessType || ""} ${businessCategory || ""}`.toLowerCase();
  if (/glass|windshield|auto\s*glass/.test(haystack)) return "auto-glass";
  if (/plumb/.test(haystack)) return "plumbing-company";
  if (/electr/.test(haystack)) return "electrician-solo";
  if (
    /\b(?:video(?:grapher|graphy)?|photo(?:grapher|graphy)?|film(?:maker|making|ography)?|aerial|drone|media\s+production|content\s+creator)\b/.test(
      haystack
    )
  ) {
    return "videographer";
  }
  if (/wholesale|stone|supply|inventory|material/.test(haystack)) return "wholesaler";
  if (/automotive|vehicle/.test(haystack)) return "auto-glass";
  if (/contractor|home_services|trade/.test(haystack)) return "plumbing-company";
  return "electrician-solo";
}
