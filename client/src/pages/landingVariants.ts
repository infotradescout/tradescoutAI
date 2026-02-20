export type LandingVariant = {
  key: string;
  displayName: string;
  badgeText: string;
  headlineLines: string[];
  subhead: string;
  primaryCta: { label: string; href: string; newTab?: boolean };
  secondaryCta?: { label: string; scrollToId?: string; href?: string; newTab?: boolean };
  navLinks: Array<{ label: string; href: string }>;
  images: {
    logo: string;
    trust: string;
    craft: string;
  };
  audience: {
    sectionLabel: string;
    sectionTitle: string;
    sectionDesc: string;
    cards: Array<{ title: string; desc: string }>;
  };
  cta: {
    label: string;
    titleLines: string[];
    desc: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel?: string;
    secondaryHref?: string;
  };
};

const DEFAULT_VARIANT: LandingVariant = {
  key: "default",
  displayName: "Default",
  badgeText: "Trust-First Platform",
  headlineLines: ["Connection", "Without", "Compromise"],
  subhead:
    "Verified people connect through Scout-powered matching. No lead spam. No pay-to-play. Just trust.",
  primaryCta: { label: "Get Started", href: "/pre-scout-setup?mode=create" },
  secondaryCta: { label: "See How It Works", scrollToId: "how-it-works" },
  navLinks: [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Trust Model", href: "#trust" },
    { label: "Direct Connect", href: "#direct-connect" },
    { label: "For You", href: "#audience" },
    { label: "Pricing", href: "#pricing" },
  ],
  images: {
    logo: "/landing/logo.png",
    trust: "/landing/trust.jpg",
    craft: "/landing/craft.jpg",
  },
  audience: {
    sectionLabel: "Who It's For",
    sectionTitle: "Built For Real Local Work",
    sectionDesc:
      "TradeScout works across roles. Scout helps you find the right next step without turning your inbox into a dumpster fire.",
    cards: [
      { title: "For People Hiring", desc: "Clear decisions and gated contact. No spam." },
      {
        title: "For Pros & Providers",
        desc: "Earn visibility through trust and verified activity, not spend.",
      },
    ],
  },
  cta: {
    label: "Join the Trust-First Movement",
    titleLines: ["Ready to get a", "better local match?"],
    desc: "Start with Scout. Get 1-3 relevant connections and choose what happens next.",
    primaryLabel: "Get Started",
    primaryHref: "/pre-scout-setup?mode=create",
    secondaryLabel: "Sign In",
    secondaryHref: "/pre-scout-setup?mode=signin",
  },
};

const BASE_VARIANTS: Record<string, Partial<LandingVariant>> = {
  contractor: {
    displayName: "Contractors",
    badgeText: "Trusted Work Pipeline",
    headlineLines: ["Earn Local", "Trust-Based", "Work"],
    subhead:
      "Scout sends relevant local requests to pros who match the work. No bidding chaos, no lead reselling.",
    audience: {
      sectionLabel: "For Contractors",
      sectionTitle: "Get Better Jobs, Not Bigger Spam Lists",
      sectionDesc:
        "TradeScout helps you compete on trust and delivery. Visibility comes from verified work, not ad spend.",
      cards: [
        { title: "Qualified Demand", desc: "Intent-based requests with clear context." },
        { title: "Fair Exposure", desc: "Ranking follows trust signals and consistency." },
      ],
    } as LandingVariant["audience"],
  },
  homeowner: {
    displayName: "Homeowners",
    badgeText: "Local Help Without Headaches",
    headlineLines: ["Find The", "Right Pro", "Faster"],
    subhead:
      "Scout helps you connect with 1-3 relevant local pros so you can move your project forward without spam calls.",
    audience: {
      sectionLabel: "For Homeowners",
      sectionTitle: "Less Noise. Better Decisions.",
      sectionDesc:
        "You get clear steps and trust-backed options before contact is shared. Your inbox and phone stay under control.",
      cards: [
        { title: "Fewer Calls", desc: "No selling your info to 10-20 contractors." },
        { title: "Clear Choice", desc: "Compare trust and fit before you decide." },
      ],
    } as LandingVariant["audience"],
  },
  realtor: {
    displayName: "Realtors",
    badgeText: "Local Network, On Demand",
    headlineLines: ["Move Faster", "With Local", "Trust"],
    subhead:
      "Scout helps you line up reliable local pros for showings, repairs, and timeline-sensitive work.",
    audience: {
      sectionLabel: "For Realtors",
      sectionTitle: "Make The Work Part Easy",
      sectionDesc:
        "Scout helps you coordinate the right people locally so your clients stay confident and your timelines stay tight.",
      cards: [
        { title: "Showings & Punch Lists", desc: "Get the right help fast, without chaos." },
        { title: "Client Confidence", desc: "Trust signals you can explain, not guesswork." },
      ],
    } as LandingVariant["audience"],
  },
  hoa: {
    displayName: "HOA",
    badgeText: "Community Operations",
    headlineLines: ["Local Work,", "Handled With", "Receipts"],
    subhead:
      "Scout helps communities coordinate local providers with clear approvals and gated contact.",
    audience: {
      sectionLabel: "For Communities",
      sectionTitle: "Decisions You Can Audit",
      sectionDesc:
        "Scout supports clear routing: intent, decision, then contact. Stakeholders stay aligned.",
      cards: [
        { title: "Boards & Managers", desc: "Reduce churn and miscommunication." },
        { title: "Residents", desc: "Understand what is happening and why." },
      ],
    } as LandingVariant["audience"],
  },
  "property-manager": {
    displayName: "Property Managers",
    badgeText: "Multi-Property Coordination",
    headlineLines: ["Coordinate", "Reliable", "Local Teams"],
    subhead:
      "Scout helps property teams route maintenance demand to trusted local providers without contact chaos.",
    audience: {
      sectionLabel: "For Property Teams",
      sectionTitle: "Portfolio Workflows, Simplified",
      sectionDesc:
        "Standardize how requests are handled across units and properties while keeping trust and accountability visible.",
      cards: [
        { title: "Faster Turnover", desc: "Route urgent jobs quickly to available pros." },
        { title: "Audit Trail", desc: "Keep decision quality consistent across sites." },
      ],
    } as LandingVariant["audience"],
  },
  lender: {
    displayName: "Lenders",
    badgeText: "Trusted Service Network",
    headlineLines: ["Protect Deals", "With Better", "Execution"],
    subhead:
      "Scout helps your borrowers access trustworthy local service pathways that reduce friction before close.",
    audience: {
      sectionLabel: "For Lenders",
      sectionTitle: "Less Friction, Better Outcomes",
      sectionDesc:
        "Keep projects moving with trusted local options while preserving compliance-minded routing.",
      cards: [
        { title: "Deal Velocity", desc: "Reduce delays from unresolved local tasks." },
        { title: "Borrower Experience", desc: "Lower stress with clear next steps." },
      ],
    } as LandingVariant["audience"],
  },
  "insurance-agent": {
    displayName: "Insurance Agents",
    badgeText: "Claims Support Network",
    headlineLines: ["Support", "Clients With", "Trusted Help"],
    subhead:
      "Scout helps policyholders connect to relevant local providers when speed, documentation, and trust matter.",
    audience: {
      sectionLabel: "For Insurance Teams",
      sectionTitle: "Claims Support Without Noise",
      sectionDesc:
        "Guide clients to clearer next steps and fewer dead ends during stressful claim cycles.",
      cards: [
        { title: "Client Retention", desc: "Deliver practical help when it matters most." },
        { title: "Better Coordination", desc: "Reduce back-and-forth and confusion." },
      ],
    } as LandingVariant["audience"],
  },
  supplier: {
    displayName: "Suppliers",
    badgeText: "Local Distribution Intelligence",
    headlineLines: ["Reach Local", "Pros Through", "Trusted Paths"],
    subhead:
      "Scout helps suppliers and vendors connect with real local demand without spam-based distribution.",
    audience: {
      sectionLabel: "For Suppliers",
      sectionTitle: "Higher-Quality Local Reach",
      sectionDesc:
        "Build relationships around trusted activity and relevant workflows instead of noisy ad funnels.",
      cards: [
        { title: "Demand Context", desc: "Understand local needs and timing signals." },
        { title: "Stronger Fit", desc: "Put offers in front of relevant audiences." },
      ],
    } as LandingVariant["audience"],
  },
  affiliate: {
    displayName: "Affiliates",
    badgeText: "Audience-Specific Routing",
    headlineLines: ["Send People", "To Their", "Right Start"],
    subhead:
      "Use dedicated TradeScout landing links for each audience so visitors see language and paths that fit.",
    audience: {
      sectionLabel: "For Growth Partners",
      sectionTitle: "One Template, Many Audiences",
      sectionDesc:
        "You can run campaign-specific pages without cloning frontend code for every video.",
      cards: [
        { title: "Role-Specific Copy", desc: "Speak directly to each audience segment." },
        { title: "Attribution Ready", desc: "Track campaign flow from landing to intent." },
      ],
    } as LandingVariant["audience"],
  },
};

const BASE_ALIASES: Record<string, string> = {
  pro: "contractor",
  contractor: "contractor",
  home: "homeowner",
  homeowner: "homeowner",
  realestate: "realtor",
  realtor: "realtor",
  hoa: "hoa",
  pm: "property-manager",
  property: "property-manager",
  lender: "lender",
  insurance: "insurance-agent",
  agent: "insurance-agent",
  vendor: "supplier",
  supplier: "supplier",
  creator: "affiliate",
  affiliate: "affiliate",
};

function normalizeKey(value: string | null | undefined, maxLen = 64): string {
  if (!value) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, maxLen);
}

function coerceText(value: string | null | undefined, maxLen: number): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function coerceHeadingLines(value: string | null | undefined, fallback: string[]): string[] {
  const raw = coerceText(value, 180);
  if (!raw) return fallback;
  const lines = raw
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);
  return lines.length ? lines : fallback;
}

function getWindowOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.origin;
}

function isSafeSameOriginHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("/")) return true;
  if (href.startsWith("#")) return true;
  try {
    const url = new URL(href);
    const origin = getWindowOrigin();
    return !!origin && url.origin === origin;
  } catch {
    return false;
  }
}

function coerceHref(value: string | null | undefined): string | null {
  const s = coerceText(value, 320);
  if (!s) return null;
  return isSafeSameOriginHref(s) ? s : null;
}

function coerceImagePath(value: string | null | undefined): string | null {
  const s = coerceText(value, 320);
  if (!s) return null;
  if (s.includes("..") || s.includes("\\") || s.startsWith("//")) return null;
  if (s.startsWith("/")) return s;
  try {
    const url = new URL(s);
    const origin = getWindowOrigin();
    if (!origin || url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function coerceNavLinks(
  value: string | null | undefined
): Array<{ label: string; href: string }> | null {
  const raw = coerceText(value, 600);
  if (!raw) return null;
  const links = raw
    .split("|")
    .map((entry) => {
      const [rawLabel, rawHref] = entry.split("::");
      const label = coerceText(rawLabel, 28);
      const href = coerceHref(rawHref);
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((x): x is { label: string; href: string } => !!x)
    .slice(0, 8);
  return links.length ? links : null;
}

function mergeVariant(
  base: LandingVariant,
  patch: Partial<LandingVariant>,
  key: string
): LandingVariant {
  return {
    ...base,
    ...patch,
    key,
    headlineLines: patch.headlineLines ?? base.headlineLines,
    primaryCta: { ...base.primaryCta, ...(patch.primaryCta || {}) },
    secondaryCta:
      patch.secondaryCta === undefined
        ? base.secondaryCta
        : patch.secondaryCta
          ? { ...(base.secondaryCta || {}), ...patch.secondaryCta }
          : undefined,
    navLinks: patch.navLinks ?? base.navLinks,
    images: { ...base.images, ...(patch.images || {}) },
    audience: {
      ...base.audience,
      ...(patch.audience || {}),
      cards: patch.audience?.cards ?? base.audience.cards,
    },
    cta: { ...base.cta, ...(patch.cta || {}) },
  };
}

function titleCaseSlug(value: string): string {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function resolveBasePatch(
  pathVariant: string,
  queryBase: string
): {
  patch: Partial<LandingVariant> | null;
  baseKey: string;
} {
  const directBase =
    (queryBase && BASE_VARIANTS[queryBase] ? queryBase : "") ||
    (pathVariant && BASE_VARIANTS[pathVariant] ? pathVariant : "");
  if (directBase) return { patch: BASE_VARIANTS[directBase], baseKey: directBase };

  const prefix = pathVariant.split(/[-_]/g)[0] || "";
  const alias = BASE_ALIASES[prefix] || "";
  if (alias && BASE_VARIANTS[alias]) {
    return { patch: BASE_VARIANTS[alias], baseKey: alias };
  }

  return { patch: null, baseKey: DEFAULT_VARIANT.key };
}

export function resolveLandingVariant(input: {
  pathVariant?: string | null;
  query?: URLSearchParams | null;
}): LandingVariant {
  const q = input.query;
  const pathVariant = normalizeKey(input.pathVariant);
  const queryBase = normalizeKey(q?.get("base"));

  const { patch, baseKey } = resolveBasePatch(pathVariant, queryBase);
  const resolvedKey = pathVariant || baseKey || DEFAULT_VARIANT.key;
  let next = patch
    ? mergeVariant(DEFAULT_VARIANT, patch, resolvedKey)
    : { ...DEFAULT_VARIANT, key: resolvedKey };

  // Preserve a readable display name for campaign slugs like /landing/realtor-austin-video1
  if (pathVariant && !BASE_VARIANTS[pathVariant] && pathVariant !== baseKey) {
    next.displayName = titleCaseSlug(pathVariant);
  }

  if (!q) return next;

  const displayName = coerceText(q.get("name"), 72);
  const badgeText = coerceText(q.get("badge"), 60);
  const subhead = coerceText(q.get("subhead"), 280);
  const headlineLines = coerceHeadingLines(q.get("headline"), next.headlineLines);

  const primaryLabel = coerceText(q.get("primaryLabel") || q.get("ctaLabel"), 36);
  const primaryHref = coerceHref(q.get("primaryHref") || q.get("ctaHref"));
  const secondaryLabel = coerceText(q.get("secondaryLabel"), 36);
  const secondaryHref = coerceHref(q.get("secondaryHref"));
  const secondaryScroll = coerceText(q.get("secondaryScroll"), 80);
  const hideSecondary = q.get("hideSecondary") === "1";

  const logoImg = coerceImagePath(q.get("logoImg"));
  const trustImg = coerceImagePath(q.get("trustImg") || q.get("image1"));
  const craftImg = coerceImagePath(q.get("craftImg") || q.get("image2"));
  const navOverride = coerceNavLinks(q.get("nav"));

  const audienceLabel = coerceText(q.get("audLabel"), 50);
  const audienceTitle = coerceText(q.get("audTitle"), 120);
  const audienceDesc = coerceText(q.get("audDesc"), 280);
  const audienceCard1Title = coerceText(q.get("audCard1Title"), 72);
  const audienceCard1Desc = coerceText(q.get("audCard1Desc"), 180);
  const audienceCard2Title = coerceText(q.get("audCard2Title"), 72);
  const audienceCard2Desc = coerceText(q.get("audCard2Desc"), 180);

  const ctaKicker = coerceText(q.get("ctaKicker"), 72);
  const ctaTitle = coerceHeadingLines(q.get("ctaTitle"), next.cta.titleLines);
  const ctaDesc = coerceText(q.get("ctaDesc"), 220);
  const ctaPrimaryLabel = coerceText(q.get("ctaPrimaryLabel"), 36);
  const ctaPrimaryHref = coerceHref(q.get("ctaPrimaryHref"));
  const ctaSecondaryLabel = coerceText(q.get("ctaSecondaryLabel"), 36);
  const ctaSecondaryHref = coerceHref(q.get("ctaSecondaryHref"));
  const hideCtaSecondary = q.get("hideCtaSecondary") === "1";

  if (displayName) next.displayName = displayName;
  if (badgeText) next.badgeText = badgeText;
  if (subhead) next.subhead = subhead;
  next.headlineLines = headlineLines;

  if (primaryLabel) next.primaryCta = { ...next.primaryCta, label: primaryLabel };
  if (primaryHref) next.primaryCta = { ...next.primaryCta, href: primaryHref };

  if (hideSecondary) {
    next.secondaryCta = undefined;
  } else if (secondaryLabel || secondaryHref || secondaryScroll) {
    next.secondaryCta = {
      label: secondaryLabel || next.secondaryCta?.label || "Learn More",
      href: secondaryHref || undefined,
      scrollToId: secondaryScroll || undefined,
    };
  }

  if (logoImg) next.images = { ...next.images, logo: logoImg };
  if (trustImg) next.images = { ...next.images, trust: trustImg };
  if (craftImg) next.images = { ...next.images, craft: craftImg };
  if (navOverride) next.navLinks = navOverride;

  if (
    audienceLabel ||
    audienceTitle ||
    audienceDesc ||
    audienceCard1Title ||
    audienceCard1Desc ||
    audienceCard2Title ||
    audienceCard2Desc
  ) {
    const card0 = next.audience.cards[0] || { title: "Audience 1", desc: "" };
    const card1 = next.audience.cards[1] || { title: "Audience 2", desc: "" };
    next.audience = {
      ...next.audience,
      sectionLabel: audienceLabel || next.audience.sectionLabel,
      sectionTitle: audienceTitle || next.audience.sectionTitle,
      sectionDesc: audienceDesc || next.audience.sectionDesc,
      cards: [
        {
          title: audienceCard1Title || card0.title,
          desc: audienceCard1Desc || card0.desc,
        },
        {
          title: audienceCard2Title || card1.title,
          desc: audienceCard2Desc || card1.desc,
        },
      ],
    };
  }

  next.cta = {
    ...next.cta,
    label: ctaKicker || next.cta.label,
    titleLines: ctaTitle,
    desc: ctaDesc || next.cta.desc,
    primaryLabel: ctaPrimaryLabel || next.cta.primaryLabel,
    primaryHref: ctaPrimaryHref || next.cta.primaryHref,
    secondaryLabel: hideCtaSecondary ? undefined : ctaSecondaryLabel || next.cta.secondaryLabel,
    secondaryHref: hideCtaSecondary ? undefined : ctaSecondaryHref || next.cta.secondaryHref,
  };

  return next;
}
