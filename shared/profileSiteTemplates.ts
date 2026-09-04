/**
 * First-class public profile site templates.
 *
 * Selection is stored in contentBlocks as:
 *   { type: "siteTemplate", data: { id: ProfileSiteTemplateId } }
 *
 * V1 selectable gallery (anyone can pick and run):
 *   wholesaler | auto-glass | plumbing-company | electrician-solo | videographer
 *
 * Profile-specific templates may also exist without appearing in the public
 * gallery. Those stay bound to a reconciled profile until their taxonomy and
 * regulated-language requirements are ready for general use.
 *
 * `default` is the canonical launch profile used by onboarding and by profiles
 * that have not purchased or selected a specialized theme. It stays out of the
 * theme picker because it is the baseline product, not an upgrade.
 *
 * HARD LAW (every template / renderer, no exceptions):
 * - Trust section is always present (PublicProfileTrustActions)
 * - TradeScout site footer identity is always present through one qualified
 *   Powered by TradeScout link
 * - All contact / request / call entry goes through Direct Connect
 *   (ExpressDirectConnectPanel / startDirectConnect) — never public tel:/mailto:
 * - Visibility ≠ access; Intent → Decision Card → Contact stays gated
 */

/** Non-negotiable chrome every public profile site template must ship. */
export const PROFILE_SITE_LAW_INVARIANTS = [
  "trust_section",
  "tradescout_footer",
  "direct_connect_only_contact",
] as const;

export type ProfileSiteLawInvariant = (typeof PROFILE_SITE_LAW_INVARIANTS)[number];

export const PROFILE_SITE_TEMPLATE_IDS = [
  "wholesaler",
  "auto-glass",
  "plumbing-company",
  "electrician-solo",
  "videographer",
  "financial-professional",
  "default",
] as const;

export type ProfileSiteTemplateId = (typeof PROFILE_SITE_TEMPLATE_IDS)[number];

/** Templates shown in the owner/admin gallery. */
export const PROFILE_SITE_TEMPLATE_GALLERY_IDS = [
  "wholesaler",
  "auto-glass",
  "plumbing-company",
  "electrician-solo",
  "videographer",
] as const satisfies ReadonlyArray<Exclude<ProfileSiteTemplateId, "default">>;

export type ProfileSiteTemplateGalleryId = (typeof PROFILE_SITE_TEMPLATE_GALLERY_IDS)[number];

export type ProfileSiteTemplateMeta = {
  id: ProfileSiteTemplateId;
  label: string;
  description: string;
  bestFor: string;
  /** Family used to group the future ~200 business-specific templates. */
  family:
    | "inventory"
    | "vehicle"
    | "mechanical-trades"
    | "electrical"
    | "creative"
    | "professional-services"
    | "generic";
  selectable: boolean;
};

export const PROFILE_SITE_TEMPLATES: ProfileSiteTemplateMeta[] = [
  {
    id: "wholesaler",
    label: "Wholesaler",
    description: "Inventory catalog, featured materials, Direct Connect for sourcing.",
    bestFor: "Stone, materials, and trade-partner wholesale inventory",
    family: "inventory",
    selectable: true,
  },
  {
    id: "auto-glass",
    label: "Auto glass",
    description: "Dark trade page for windshield and auto glass work with Direct Connect.",
    bestFor: "Mobile and shop auto glass replacement and repair",
    family: "vehicle",
    selectable: true,
  },
  {
    id: "plumbing-company",
    label: "Plumbing company",
    description: "Full local plumbing company layout: hero, services, gallery, trust, request.",
    bestFor: "Residential and commercial plumbing firms",
    family: "mechanical-trades",
    selectable: true,
  },
  {
    id: "electrician-solo",
    label: "Electrician (solo)",
    description:
      "Lean electrician profile for an independent or small crew — clear services and request path.",
    bestFor: "Solo electricians and small electrical shops",
    family: "electrical",
    selectable: true,
  },
  {
    id: "videographer",
    label: "Videographer",
    description: "Media-first portfolio with services, social links, and Direct Connect.",
    bestFor: "Videographers, photographers, drone creators, and production professionals",
    family: "creative",
    selectable: true,
  },
  {
    id: "financial-professional",
    label: "Financial professional",
    description:
      "Profile-specific presentation for protection, benefits, retirement, and wealth-strategy conversations.",
    bestFor: "Reconciled financial-professional profiles with bounded public claims",
    family: "professional-services",
    selectable: false,
  },
  {
    id: "default",
    label: "Default profile",
    description:
      "Premium landing page personalized with the business's colors, media, services, and sections.",
    bestFor: "Every new business before an optional specialized theme upgrade",
    family: "generic",
    selectable: false,
  },
];

export const SITE_TEMPLATE_BLOCK_TYPE = "siteTemplate" as const;

export type ProfileContentBlock = {
  type?: string;
  data?: Record<string, unknown> | null;
};

const TEMPLATE_ID_SET = new Set<string>(PROFILE_SITE_TEMPLATE_IDS);

export function isProfileSiteTemplateId(value: unknown): value is ProfileSiteTemplateId {
  return typeof value === "string" && TEMPLATE_ID_SET.has(value);
}

export function isProfileSiteTemplateGalleryId(
  value: unknown
): value is ProfileSiteTemplateGalleryId {
  return (
    typeof value === "string" &&
    (PROFILE_SITE_TEMPLATE_GALLERY_IDS as readonly string[]).includes(value)
  );
}

export function getProfileSiteTemplateMeta(
  id: ProfileSiteTemplateId
): ProfileSiteTemplateMeta | undefined {
  return PROFILE_SITE_TEMPLATES.find((entry) => entry.id === id);
}

export function listSelectableProfileSiteTemplates(): Array<
  ProfileSiteTemplateMeta & { id: ProfileSiteTemplateGalleryId }
> {
  return PROFILE_SITE_TEMPLATES.filter(
    (entry): entry is ProfileSiteTemplateMeta & { id: ProfileSiteTemplateGalleryId } =>
      entry.selectable && isProfileSiteTemplateGalleryId(entry.id)
  );
}

export function readSiteTemplateIdFromBlocks(contentBlocks: unknown): ProfileSiteTemplateId | null {
  if (!Array.isArray(contentBlocks)) return null;
  for (const block of contentBlocks) {
    if (!block || typeof block !== "object") continue;
    const typed = block as ProfileContentBlock;
    if (typed.type !== SITE_TEMPLATE_BLOCK_TYPE) continue;
    const id = typed.data && typeof typed.data === "object" ? (typed.data as any).id : null;
    if (isProfileSiteTemplateId(id)) return id;
  }
  return null;
}

export type ResolveSiteTemplateInput = {
  slug?: string | null;
  contentBlocks?: unknown;
  tradePartner?: boolean | null;
  hasLocalServicePresentation?: boolean;
};

/**
 * Explicit block wins. Otherwise seed from known branded slugs / partner flags.
 * Unknown profiles fall back to `default` (not shown in the gallery).
 */
export function resolveSiteTemplateId(input: ResolveSiteTemplateInput): ProfileSiteTemplateId {
  const fromBlocks = readSiteTemplateIdFromBlocks(input.contentBlocks);
  if (fromBlocks) return fromBlocks;

  const slug = String(input.slug || "")
    .trim()
    .toLowerCase();
  if (slug === "jw-stone" || slug === "issa-build" || slug === "honey-onyx") return "wholesaler";
  if (slug === "jrs-auto-glass") return "auto-glass";
  if (slug === "la-plumbing-solutions") return "plumbing-company";
  if (slug === "dean-damaskos") return "financial-professional";
  if (input.hasLocalServicePresentation) return "plumbing-company";
  if (input.tradePartner === true) return "wholesaler";
  return "default";
}

export function upsertSiteTemplateBlock(
  contentBlocks: unknown,
  templateId: ProfileSiteTemplateId
): ProfileContentBlock[] {
  const blocks = Array.isArray(contentBlocks)
    ? (contentBlocks.filter(Boolean) as ProfileContentBlock[])
    : [];
  const next = blocks.filter((block) => block?.type !== SITE_TEMPLATE_BLOCK_TYPE);
  next.unshift({ type: SITE_TEMPLATE_BLOCK_TYPE, data: { id: templateId } });
  return next;
}

export function readFeaturedStoneSlugs(contentBlocks: unknown): string[] {
  if (!Array.isArray(contentBlocks)) return [];
  const inventory = contentBlocks.find(
    (block) => block && typeof block === "object" && (block as any).type === "inventoryCatalog"
  ) as ProfileContentBlock | undefined;
  const raw =
    inventory?.data && typeof inventory.data === "object"
      ? (inventory.data as any).featuredStoneSlugs
      : null;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .slice(0, 12);
}

export function upsertFeaturedStoneSlugs(
  contentBlocks: unknown,
  featuredStoneSlugs: string[]
): ProfileContentBlock[] {
  const blocks = Array.isArray(contentBlocks)
    ? (contentBlocks.filter(Boolean) as ProfileContentBlock[])
    : [];
  const cleaned = featuredStoneSlugs
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .slice(0, 12);

  let found = false;
  const next = blocks.map((block) => {
    if (block?.type !== "inventoryCatalog") return block;
    found = true;
    return {
      ...block,
      data: {
        ...(block.data && typeof block.data === "object" ? block.data : {}),
        featuredStoneSlugs: cleaned,
      },
    };
  });
  if (!found) {
    next.push({
      type: "inventoryCatalog",
      data: { categories: [], featuredStoneSlugs: cleaned },
    });
  }
  return next;
}

/** Preferred catalog lead image URL per stone slug (owner/admin override). */
export function readInventoryLeadImageBySlug(contentBlocks: unknown): Record<string, string> {
  if (!Array.isArray(contentBlocks)) return {};
  const inventory = contentBlocks.find(
    (block) => block && typeof block === "object" && (block as any).type === "inventoryCatalog"
  ) as ProfileContentBlock | undefined;
  const raw =
    inventory?.data && typeof inventory.data === "object"
      ? (inventory.data as any).leadImageBySlug
      : null;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [slug, image] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof slug !== "string" || !slug.trim()) continue;
    if (typeof image !== "string" || !image.trim()) continue;
    out[slug.trim()] = image.trim();
  }
  return out;
}

export function upsertInventoryLeadImage(
  contentBlocks: unknown,
  stoneSlug: string,
  imageUrl: string
): ProfileContentBlock[] {
  const blocks = Array.isArray(contentBlocks)
    ? (contentBlocks.filter(Boolean) as ProfileContentBlock[])
    : [];
  const slug = stoneSlug.trim();
  const image = imageUrl.trim();
  if (!slug || !image) return blocks;

  let found = false;
  const next = blocks.map((block) => {
    if (block?.type !== "inventoryCatalog") return block;
    found = true;
    const previous =
      block.data && typeof block.data === "object"
        ? recordLeadMap((block.data as any).leadImageBySlug)
        : {};
    return {
      ...block,
      data: {
        ...(block.data && typeof block.data === "object" ? block.data : {}),
        leadImageBySlug: { ...previous, [slug]: image },
      },
    };
  });
  if (!found) {
    next.push({
      type: "inventoryCatalog",
      data: { categories: [], leadImageBySlug: { [slug]: image } },
    });
  }
  return next;
}

function recordLeadMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [slug, image] of Object.entries(value as Record<string, unknown>)) {
    if (typeof slug === "string" && slug.trim() && typeof image === "string" && image.trim()) {
      out[slug.trim()] = image.trim();
    }
  }
  return out;
}

/** Move each stone's preferred lead image to index 0 when the override is present. */
export function applyInventoryLeadImageOverrides<
  T extends {
    slug: string;
    images: string[];
    shareImageOrder?: number[];
    imageFinishes?: unknown[];
  },
>(stones: T[], leadImageBySlug: Record<string, string>): T[] {
  return stones.map((stone) => {
    const preferred = leadImageBySlug[stone.slug];
    if (!preferred || !Array.isArray(stone.images) || stone.images.length < 2) return stone;
    const index = stone.images.findIndex((image) => image === preferred);
    if (index <= 0) return stone;
    const images = [...stone.images];
    const [picked] = images.splice(index, 1);
    images.unshift(picked);
    const imageFinishes = Array.isArray(stone.imageFinishes)
      ? (() => {
          if (stone.imageFinishes.length !== stone.images.length) return stone.imageFinishes;
          const reordered = [...stone.imageFinishes];
          const [pickedFinish] = reordered.splice(index, 1);
          reordered.unshift(pickedFinish);
          return reordered;
        })()
      : undefined;
    const explicitShareOrder = stone.shareImageOrder;
    const hasValidShareOrder =
      Array.isArray(explicitShareOrder) &&
      explicitShareOrder.length === stone.images.length &&
      new Set(explicitShareOrder).size === stone.images.length &&
      explicitShareOrder.every(
        (displayIndex) =>
          Number.isInteger(displayIndex) && displayIndex >= 0 && displayIndex < stone.images.length
      );
    const shareImageOrder = (
      hasValidShareOrder ? explicitShareOrder : stone.images.map((_, displayIndex) => displayIndex)
    ).map((displayIndex) => {
      if (displayIndex === index) return 0;
      return displayIndex < index ? displayIndex + 1 : displayIndex;
    });
    return {
      ...stone,
      images,
      shareImageOrder,
      ...(imageFinishes ? { imageFinishes } : {}),
    };
  });
}

function electricianSoloPresentationSeed(displayName: string) {
  return {
    template: "local-service",
    eyebrow: "Licensed electrician",
    heroTitle: `${displayName} — clear electrical work, done right.`,
    heroDescription:
      "From troubleshooting and panel work to lighting and rewires, get a clear scope and Direct Connect when you are ready.",
    heroImage: "",
    heroImageAlt: displayName,
    logoImage: "",
    logoAlt: displayName,
    locationLabel: "Your service area",
    serviceNote: "Residential and light commercial electrical service.",
    servicesEyebrow: "Electrical service",
    servicesTitle: "What I take on",
    highlights: ["Licensed", "Insured", "Solo / small crew", "Clear pricing talk"],
    services: [
      {
        title: "Troubleshooting & repairs",
        description: "Outlets, breakers, fixtures, and mystery electrical issues.",
        icon: "repair",
      },
      {
        title: "Panels & circuits",
        description: "Panel upgrades, new circuits, and capacity planning.",
        icon: "construction",
      },
      {
        title: "Lighting & installs",
        description: "Fixtures, fans, and finish electrical for remodels.",
        icon: "bath",
      },
    ],
    aboutTitle: "About the electrician",
    aboutBody: "",
    aboutEyebrow: "About",
    serviceAreas: [],
    serviceAreaDescription: "Counties and cities you cover.",
    galleryEyebrow: "Recent work",
    galleryTitle: "Jobs worth showing",
    galleryDescription: "",
    galleryShareText: `See electrical work from ${displayName}`,
    credentialLabel: "Credentials",
    credentials: [],
    requestTitle: "Request electrical help",
    requestDescription: "",
    brand: {
      primary: "#f59e0b",
      primaryDark: "#b45309",
      surface: "#111827",
      background: "#0b1220",
    },
  };
}

function plumbingCompanyPresentationSeed(displayName: string) {
  return {
    template: "local-service",
    eyebrow: "Plumbing company",
    heroTitle: `${displayName} — plumbing handled professionally.`,
    heroDescription:
      "Repairs, replacements, and project work with clear communication from first call to finish.",
    heroImage: "",
    heroImageAlt: displayName,
    logoImage: "",
    logoAlt: displayName,
    locationLabel: "Your service area",
    serviceNote: "Residential and commercial plumbing.",
    servicesEyebrow: "Plumbing services",
    servicesTitle: "From the first repair to a full system.",
    highlights: ["Licensed", "Insured", "Residential + commercial"],
    services: [
      {
        title: "Repairs & replacements",
        description: "Leaks, fixtures, and system replacements with a clear plan.",
        icon: "repair",
      },
      {
        title: "Water heaters",
        description: "Tank and tankless service, install, and replacement.",
        icon: "water-heater",
      },
      {
        title: "Drains & diagnostics",
        description: "Clogs, camera work, and drain line repair.",
        icon: "drain",
      },
    ],
    aboutTitle: "Our company",
    aboutBody: "",
    aboutEyebrow: "About",
    serviceAreas: [],
    serviceAreaDescription: "Cities and counties you cover.",
    galleryEyebrow: "Work",
    galleryTitle: "Recent plumbing work",
    galleryDescription: "",
    galleryShareText: `See plumbing work from ${displayName}`,
    credentialLabel: "Credentials",
    credentials: [],
    requestTitle: "Request plumbing service",
    requestDescription: "",
    brand: {
      primary: "#0ea5e9",
      primaryDark: "#0369a1",
      surface: "#0f172a",
      background: "#041017",
    },
  };
}

/** Starter blocks when switching templates. Preserves gallery/inventory unless reset. */
export function seedBlocksForTemplate(
  templateId: ProfileSiteTemplateId,
  existingBlocks: unknown,
  options?: { reset?: boolean; displayName?: string }
): ProfileContentBlock[] {
  const reset = options?.reset === true;
  const existing = Array.isArray(existingBlocks)
    ? (existingBlocks.filter(Boolean) as ProfileContentBlock[])
    : [];
  const base = reset
    ? existing.filter((block) => block?.type === "gallery" || block?.type === "inventoryCatalog")
    : existing.filter((block) => block?.type !== "localServiceProfile");

  let next = upsertSiteTemplateBlock(base, templateId);
  const name = options?.displayName?.trim() || "Your business";

  const hasHero = next.some((block) => block?.type === "hero");
  if (!hasHero) {
    next = [
      ...next,
      {
        type: "hero",
        data: {
          title: name,
          ...(templateId === "videographer" ? { text: "Photo and video." } : {}),
        },
      },
    ];
  }

  if (templateId === "plumbing-company" || templateId === "electrician-solo") {
    const presentation =
      templateId === "electrician-solo"
        ? electricianSoloPresentationSeed(name)
        : plumbingCompanyPresentationSeed(name);
    next = [
      ...next.filter((block) => block?.type !== "localServiceProfile"),
      { type: "localServiceProfile", data: presentation },
    ];
  }

  if (templateId === "wholesaler") {
    const hasInventory = next.some((block) => block?.type === "inventoryCatalog");
    if (!hasInventory) {
      next = [
        ...next,
        { type: "inventoryCatalog", data: { categories: [], featuredStoneSlugs: [] } },
      ];
    }
  }

  if (templateId === "videographer") {
    const hasServices = next.some((block) => block?.type === "services");
    if (!hasServices) {
      next.push({
        type: "services",
        data: { items: ["Photo and video"] },
      });
    }
  }

  return next;
}

export function readHeroEditorFields(contentBlocks: unknown): {
  title: string;
  text: string;
} {
  if (!Array.isArray(contentBlocks)) return { title: "", text: "" };
  const hero = contentBlocks.find(
    (block) => block && typeof block === "object" && (block as { type?: string }).type === "hero"
  ) as { data?: Record<string, unknown> } | undefined;
  const data = hero?.data && typeof hero.data === "object" ? hero.data : {};
  const title =
    (typeof data.headerLabel === "string" && data.headerLabel) ||
    (typeof data.title === "string" && data.title) ||
    "";
  const text =
    (typeof data.teaser === "string" && data.teaser) ||
    (typeof data.text === "string" && data.text) ||
    (typeof data.body === "string" && data.body) ||
    (typeof data.description === "string" && data.description) ||
    "";
  return { title, text };
}

export function patchHeroBlock(
  contentBlocks: unknown,
  patch: { title?: string; text?: string; imageUrl?: string }
): ProfileContentBlock[] {
  const blocks = Array.isArray(contentBlocks)
    ? (contentBlocks.filter(Boolean) as ProfileContentBlock[])
    : [];
  let found = false;
  const next = blocks.map((block) => {
    if (block?.type !== "hero") return block;
    found = true;
    return {
      ...block,
      data: {
        ...(block.data && typeof block.data === "object" ? block.data : {}),
        // Wholesaler themes (incl. ISSA Build) render headerLabel + teaser.
        // Keep title/text aliases so older templates and JSON editors stay compatible.
        ...(patch.title !== undefined ? { title: patch.title, headerLabel: patch.title } : {}),
        ...(patch.text !== undefined ? { text: patch.text, teaser: patch.text } : {}),
        ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
      },
    };
  });
  if (!found) {
    next.push({
      type: "hero",
      data: {
        title: patch.title || "",
        headerLabel: patch.title || "",
        text: patch.text || "",
        teaser: patch.text || "",
        ...(patch.imageUrl ? { imageUrl: patch.imageUrl } : {}),
      },
    });
  }
  return next;
}

export function patchLocalServicePresentation(
  contentBlocks: unknown,
  patch: Record<string, unknown>
): ProfileContentBlock[] {
  const blocks = Array.isArray(contentBlocks)
    ? (contentBlocks.filter(Boolean) as ProfileContentBlock[])
    : [];
  let found = false;
  const next = blocks.map((block) => {
    if (block?.type !== "localServiceProfile") return block;
    found = true;
    return {
      ...block,
      data: {
        ...(block.data && typeof block.data === "object" ? block.data : {}),
        ...patch,
      },
    };
  });
  if (!found) {
    next.push({ type: "localServiceProfile", data: { template: "local-service", ...patch } });
  }
  return next;
}
