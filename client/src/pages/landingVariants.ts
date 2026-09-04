import { COMPREHENSIVE_TRADES, type Trade } from "@shared/trades-data";
import type { StablePublicLandingBaseVariant } from "@shared/publicLandingIndexability";

export type LandingVariant = {
  key: string;
  displayName: string;
  badgeText: string;
  showBadge?: boolean;
  headlineMode?: "stacked" | "inline";
  headlineNoBreakAfterIndices?: number[];
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
  badgeText: "Start Here",
  showBadge: false,
  headlineMode: "inline",
  headlineNoBreakAfterIndices: [2],
  headlineLines: ["Trusted Local Help", "Routed by Scout"],
  subhead:
    "Describe what you need, review clearer local options, and open contact only when the fit looks right.",
  primaryCta: { label: "Open Scout", href: "/scout" },
  secondaryCta: { label: "Create Account", href: "/pre-scout-setup?mode=create" },
  navLinks: [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Trust Model", href: "#trust" },
    { label: "Direct Connect", href: "#direct-connect" },
    { label: "For You", href: "#audience" },
    { label: "Pricing", href: "#pricing" },
  ],
  images: {
    logo: "/tradescout-logo-circle.png",
    trust: "/landing/hero.jpg",
    craft: "/landing/community.jpg",
  },
  audience: {
    sectionLabel: "Who It's For",
    sectionTitle: "Built To Run Local Decisions Clearly",
    sectionDesc:
      "Scout shows people move from uncertainty to action with clearer next steps and less back-and-forth.",
    cards: [
      {
        title: "For People Hiring",
        desc: "Clear next steps, better local matches, and less outreach chaos.",
      },
      {
        title: "For Businesses & Providers",
        desc: "Earn visibility through trust, verified work, and local relevance, not spend.",
      },
    ],
  },
  cta: {
    label: "Start With Scout",
    titleLines: ["Need help with something", "local? Start here."],
    desc: "Open Scout first. You can figure out the right path before you create an account or open contact.",
    primaryLabel: "Open Scout",
    primaryHref: "/scout",
    secondaryLabel: "Create Account",
    secondaryHref: "/pre-scout-setup?mode=create",
  },
};

const BASE_VARIANTS: Record<string, Partial<LandingVariant>> &
  Record<StablePublicLandingBaseVariant, Partial<LandingVariant>> = {
  contractor: {
    displayName: "Business Providers",
    badgeText: "Trusted Work Pipeline",
    headlineLines: ["Operate Inside", "The Trusted", "Local Work System"],
    subhead:
      "TradeScout shows serious businesses get better local opportunities without bidding chaos or lead reselling.",
    audience: {
      sectionLabel: "For Businesses",
      sectionTitle: "Get Better Jobs, Not Bigger Spam Lists",
      sectionDesc:
        "TradeScout supports trust-based competition and delivery. Visibility comes from verified work, not ad spend.",
      cards: [
        { title: "Better Leads", desc: "Requests come with clearer context and less noise." },
        { title: "Fair Exposure", desc: "The best providers rise through trust and consistency." },
      ],
    } as LandingVariant["audience"],
  },
  homeowner: {
    displayName: "Homeowners",
    badgeText: "Local Help Without Headaches",
    headlineLines: ["Use Scout To", "Run The", "Right Local Decision"],
    subhead:
      "Scout shows a local project path from uncertainty to clarity with 1-3 relevant options, visible trust context, and no spam calls.",
    audience: {
      sectionLabel: "For Homeowners",
      sectionTitle: "Less Noise. Better Decisions.",
      sectionDesc:
        "You get 100% community-driven direction and trust-backed options before contact is shared. Your inbox and phone stay under control.",
      cards: [
        { title: "Fewer Calls", desc: "No selling your info to 10-20 contractors." },
        { title: "Clear Choice", desc: "Compare trust and fit before you decide." },
      ],
    } as LandingVariant["audience"],
  },
  realtor: {
    displayName: "Realtors",
    badgeText: "Local Network, On Demand",
    headlineLines: ["Run Deal-Critical", "Local Work", "Through Scout"],
    subhead:
      "Scout shows how to line up reliable local businesses for showings, repairs, and timeline-sensitive work.",
    audience: {
      sectionLabel: "For Realtors",
      sectionTitle: "Make The Work Part Easy",
      sectionDesc:
        "Scout shows how to coordinate the right people locally so your clients stay confident and your timelines stay tight.",
      cards: [
        { title: "Showings & Punch Lists", desc: "Get the right help fast, without chaos." },
        { title: "Client Confidence", desc: "Trust signals you can explain, not guesswork." },
      ],
    } as LandingVariant["audience"],
  },
  hoa: {
    displayName: "HOA",
    badgeText: "Community Operations",
    headlineLines: ["Community Work", "Run With", "Governed Clarity"],
    subhead:
      "Scout shows communities coordinate local providers with clear approvals and cleaner communication.",
    audience: {
      sectionLabel: "For Communities",
      sectionTitle: "Decisions You Can Audit",
      sectionDesc:
        "Scout keeps everyone aligned on what needs to happen next and who should be involved.",
      cards: [
        { title: "Boards & Managers", desc: "Reduce churn and miscommunication." },
        { title: "Residents", desc: "Understand what is happening and why." },
      ],
    } as LandingVariant["audience"],
  },
  "property-manager": {
    displayName: "Property Managers",
    badgeText: "Multi-Property Coordination",
    headlineLines: ["Coordinate", "Local Operations", "Without Contact Chaos"],
    subhead: "Scout shows property teams line up trusted local providers without contact chaos.",
    audience: {
      sectionLabel: "For Property Teams",
      sectionTitle: "Portfolio Workflows, Simplified",
      sectionDesc:
        "Standardize how requests are handled across units and properties while keeping trust and accountability visible.",
      cards: [
        { title: "Faster Turnover", desc: "Route urgent jobs quickly to available businesses." },
        { title: "Audit Trail", desc: "Keep decision quality consistent across sites." },
      ],
    } as LandingVariant["audience"],
  },
  lender: {
    displayName: "Lenders",
    badgeText: "Trusted Service Network",
    headlineLines: ["Protect Deals", "With Governed", "Local Execution"],
    subhead:
      "Scout shows trustworthy local service pathways for borrowers that reduce friction before close.",
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
    headlineLines: ["Guide Claims", "Through Trusted", "Local Response"],
    subhead:
      "Scout shows policyholders connect to relevant local providers when speed, documentation, and trust matter.",
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
    headlineLines: ["Reach Local", "Demand Through", "Better Paths"],
    subhead:
      "Scout shows suppliers and vendors connect with real local demand without spam-based distribution.",
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
  "local-operating-system": {
    displayName: "Local Operating System",
    badgeText: "Local Operating System",
    showBadge: true,
    headlineMode: "stacked",
    headlineLines: ["The Local", "Operating System", "for Community Interaction"],
    subhead:
      "Scout coordinates discovery, trust, intent, decision, and contact so local interaction works the way it should.",
    audience: {
      sectionLabel: "How Scout Works",
      sectionTitle: "The Full Local Interaction Stack",
      sectionDesc:
        "From first search to governed contact, Scout runs the local operating flow from discovery to governed action.",
      cards: [
        { title: "Discovery", desc: "Find the right local options without noise or lead selling." },
        { title: "Trust", desc: "Verify and compare before committing to contact." },
      ],
    } as LandingVariant["audience"],
  },
};

const BASE_ALIASES: Record<string, string> = {
  pro: "contractor",
  contractor: "contractor",
  service: "contractor",
  services: "contractor",
  provider: "contractor",
  providers: "contractor",
  trades: "contractor",
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

const TRADE_BY_SLUG = new Map<string, Trade>(
  COMPREHENSIVE_TRADES.map((trade) => [trade.slug, trade])
);
const TRADE_SLUGS_DESC = Array.from(TRADE_BY_SLUG.keys()).sort((a, b) => b.length - a.length);

const TRADE_CATEGORY_BADGE: Record<Trade["category"], string> = {
  construction: "Construction Match",
  home_improvement: "Home Improvement Match",
  maintenance: "Maintenance Match",
  specialty: "Specialty Service Match",
  exterior: "Exterior Project Match",
  interior: "Interior Project Match",
};

const AUDIENCE_LABEL_BY_BASE_KEY: Record<string, string> = {
  contractor: "Contractors",
  homeowner: "Homeowners",
  realtor: "Realtors",
  hoa: "HOA Teams",
  "property-manager": "Property Managers",
  lender: "Lenders",
  "insurance-agent": "Insurance Agents",
  supplier: "Suppliers",
  affiliate: "Affiliates",
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

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanTradeLabel(rawName: string): string {
  const cleaned = rawName
    .replace(/\b(contractor|services?|specialist)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || rawName;
}

function resolveTradeFromVariant(pathVariant: string, queryTrade: string): Trade | null {
  const queryKey = normalizeKey(queryTrade, 120).replace(/_/g, "-");
  if (queryKey && TRADE_BY_SLUG.has(queryKey)) return TRADE_BY_SLUG.get(queryKey) || null;

  const normalized = normalizeKey(pathVariant, 120).replace(/_/g, "-");
  if (!normalized) return null;
  if (TRADE_BY_SLUG.has(normalized)) return TRADE_BY_SLUG.get(normalized) || null;

  for (const slug of TRADE_SLUGS_DESC) {
    const pattern = new RegExp(`(^|[-_])${escapeForRegex(slug)}($|[-_])`);
    if (pattern.test(normalized)) {
      return TRADE_BY_SLUG.get(slug) || null;
    }
  }

  return null;
}

function buildTradePatch(trade: Trade): Partial<LandingVariant> {
  const tradeLabel = cleanTradeLabel(trade.name);
  const tradeLower = tradeLabel.toLowerCase();
  const badge = TRADE_CATEGORY_BADGE[trade.category] || "Trade Match";
  const ctaTarget = tradeLabel.length > 28 ? "a Local Business" : tradeLabel;

  return {
    displayName: trade.name,
    badgeText: `${badge} • ${trade.name}`,
    headlineLines: ["Find Local", tradeLabel, "You Can Trust"],
    subhead: `Scout shows trusted local ${tradeLower} providers. ${trade.description}. No lead reselling. No pay-to-play.`,
    primaryCta: {
      label: `Find ${ctaTarget}`,
      href: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
    },
    audience: {
      sectionLabel: `For ${trade.name}`,
      sectionTitle: `Built For ${trade.name} Decisions`,
      sectionDesc:
        "Scout keeps contact gated and quality-first so you can move forward with fewer dead ends.",
      cards: [
        {
          title: `Hiring ${tradeLabel}?`,
          desc: `Get 1-3 relevant ${tradeLower} matches with clear trust signals before contact is shared.`,
        },
        {
          title: `Are You a ${tradeLabel} Business?`,
          desc: "Earn visibility through trust and completed work, not ad spend or price pressure.",
        },
      ],
    },
    cta: {
      label: `${trade.name} On TradeScout`,
      titleLines: ["Need", tradeLabel, "Done Right?"],
      desc: `Start with Scout for your ${tradeLower} request and get high-fit local options without spam.`,
      primaryLabel: `Start ${tradeLabel} Request`,
      primaryHref: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
    },
  };
}

function buildAudienceTradePatch(baseKey: string, trade: Trade): Partial<LandingVariant> | null {
  const audienceLabel = AUDIENCE_LABEL_BY_BASE_KEY[baseKey];
  if (!audienceLabel) return null;

  const tradeLabel = cleanTradeLabel(trade.name);
  const tradeLower = tradeLabel.toLowerCase();
  const audienceTradeName = `${audienceLabel} • ${trade.name}`;
  const ctaTarget = tradeLabel.length > 28 ? "a Local Business" : tradeLabel;

  if (baseKey === "contractor") {
    return {
      displayName: audienceTradeName,
      badgeText: `${trade.name} • Business Growth`,
      headlineLines: ["Win Better", tradeLabel, "Work Locally"],
      subhead: `Scout routes relevant ${tradeLower} demand to trusted businesses. No lead reselling and no pay-to-play ranking.`,
      primaryCta: {
        label: `Grow ${tradeLabel} Pipeline`,
        href: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
      audience: {
        sectionLabel: `For ${trade.name} Businesses`,
        sectionTitle: `Turn ${tradeLabel} Skill Into Better Jobs`,
        sectionDesc:
          "Exposure follows trust and delivery signals, so serious operators can stand out.",
        cards: [
          {
            title: `Qualified ${tradeLabel} Requests`,
            desc: "Get routed demand with context instead of cold leads sold to dozens of businesses.",
          },
          {
            title: "Compete On Trust, Not Spend",
            desc: "Ranking reflects credibility and outcomes, not ad budget.",
          },
        ],
      },
      cta: {
        label: `${trade.name} Business Access`,
        titleLines: ["Ready for Better", tradeLabel, "Opportunities?"],
        desc: `Set up your ${tradeLower} profile and grow with trust-first local demand.`,
        primaryLabel: `Start ${tradeLabel} Profile`,
        primaryHref: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
    };
  }

  if (baseKey === "homeowner") {
    return {
      displayName: audienceTradeName,
      badgeText: `${trade.name} • Homeowner Match`,
      headlineLines: ["Find Trusted", tradeLabel, "Near You"],
      subhead: `Scout shows homeowners connect with trusted local ${tradeLower} providers without spam calls or bidding chaos.`,
      primaryCta: {
        label: `Find ${ctaTarget}`,
        href: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
      audience: {
        sectionLabel: `For ${trade.name} Projects`,
        sectionTitle: `Homeowner-Friendly ${tradeLabel} Matching`,
        sectionDesc: "Get relevant local options and decide before contact is shared.",
        cards: [
          {
            title: `Need ${tradeLabel} Work Done?`,
            desc: `Scout narrows your search to 1-3 relevant ${tradeLower} businesses.`,
          },
          {
            title: "Keep Control Of Contact",
            desc: "No information blast to 10-20 contractors.",
          },
        ],
      },
      cta: {
        label: `${trade.name} Help For Homeowners`,
        titleLines: ["Need Reliable", tradeLabel, "Support?"],
        desc: "Start with Scout and get clearer local choices without inbox overload.",
        primaryLabel: `Start ${tradeLabel} Request`,
        primaryHref: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
    };
  }

  if (baseKey === "realtor") {
    return {
      displayName: audienceTradeName,
      badgeText: `${trade.name} • Realtor Workflow`,
      headlineLines: ["Close Faster With", tradeLabel, "Support"],
      subhead: `Scout shows Realtors source trusted local ${tradeLower} providers for timeline-sensitive property work.`,
      primaryCta: {
        label: `Find ${tradeLabel} Businesses`,
        href: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
      audience: {
        sectionLabel: `For Realtor ${trade.name} Needs`,
        sectionTitle: `Keep Deals Moving With Better ${tradeLabel} Coordination`,
        sectionDesc: "Use trust-backed local routing for fast decisions and fewer project delays.",
        cards: [
          {
            title: "Transaction Timeline Support",
            desc: `Coordinate ${tradeLower} help for inspections, repairs, and closing prep.`,
          },
          {
            title: "Client Confidence",
            desc: "Show trust signals clients can understand and act on.",
          },
        ],
      },
    };
  }

  if (baseKey === "hoa" || baseKey === "property-manager") {
    const opsAudience = baseKey === "hoa" ? "HOA Teams" : "Property Managers";
    return {
      displayName: `${opsAudience} • ${trade.name}`,
      badgeText: `${trade.name} • Operations Routing`,
      headlineLines: ["Coordinate", tradeLabel, "With Audit Clarity"],
      subhead: `Scout shows ${opsAudience.toLowerCase()} route ${tradeLower} work with clear intent and accountability.`,
      primaryCta: {
        label: `Coordinate ${tradeLabel}`,
        href: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
      audience: {
        sectionLabel: `For ${opsAudience}`,
        sectionTitle: `${tradeLabel} Workflows With Less Churn`,
        sectionDesc:
          "Decision quality stays visible while contact and action remain properly gated.",
        cards: [
          {
            title: "Operational Control",
            desc: "Track why each routing decision was made and who acted.",
          },
          {
            title: "Resident Communication",
            desc: "Reduce confusion with cleaner, trust-first process flow.",
          },
        ],
      },
    };
  }

  if (baseKey === "lender" || baseKey === "insurance-agent") {
    const financeAudience = baseKey === "lender" ? "Lenders" : "Insurance Agents";
    return {
      displayName: `${financeAudience} • ${trade.name}`,
      badgeText: `${trade.name} • Client Support`,
      headlineLines: ["Support Clients With", tradeLabel, "That Delivers"],
      subhead: `Scout shows ${financeAudience.toLowerCase()} route clients to trusted ${tradeLower} pathways when timing matters.`,
      primaryCta: {
        label: `Start ${tradeLabel} Routing`,
        href: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
      audience: {
        sectionLabel: `For ${financeAudience}`,
        sectionTitle: `${tradeLabel} Support Without Chaos`,
        sectionDesc: "Reduce friction in high-stress workflows with clear local execution paths.",
        cards: [
          {
            title: "Lower Coordination Drag",
            desc: `Move ${tradeLower} support forward with less back-and-forth.`,
          },
          {
            title: "Better Client Experience",
            desc: "Provide practical next steps your clients can trust.",
          },
        ],
      },
    };
  }

  if (baseKey === "supplier") {
    return {
      displayName: audienceTradeName,
      badgeText: `${trade.name} • Supplier Reach`,
      headlineLines: ["Reach", tradeLabel, "Businesses Locally"],
      subhead: `Scout shows suppliers connect offers to relevant ${tradeLower} audiences through trust-shaped local flows.`,
      primaryCta: {
        label: `Reach ${tradeLabel} Businesses`,
        href: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
      audience: {
        sectionLabel: `For ${trade.name} Suppliers`,
        sectionTitle: `Better ${tradeLabel} Distribution Context`,
        sectionDesc:
          "Put offers in front of relevant local professionals without spam-first targeting.",
        cards: [
          {
            title: "Local Demand Context",
            desc: "Align supply campaigns with real local work signals.",
          },
          {
            title: "Higher Fit Visibility",
            desc: "Get in front of the right businesses for the right project stage.",
          },
        ],
      },
    };
  }

  if (baseKey === "affiliate") {
    return {
      displayName: audienceTradeName,
      badgeText: `${trade.name} • Campaign Landing`,
      headlineLines: ["Send", tradeLabel, "Traffic Right"],
      subhead: `Use this ${tradeLower}-specific page for role-targeted content while preserving affiliate attribution.`,
      primaryCta: {
        label: `Open ${tradeLabel} Landing`,
        href: `/pre-scout-setup?mode=create&trade=${encodeURIComponent(trade.slug)}`,
      },
      audience: {
        sectionLabel: "For Campaign Builders",
        sectionTitle: `${tradeLabel} Message-Match Landing`,
        sectionDesc: "Keep message and intent aligned from video click through CTA.",
        cards: [
          {
            title: "Audience Fit",
            desc: "Role and trade language stay aligned with campaign intent.",
          },
          {
            title: "Attribution Friendly",
            desc: "Directly shareable links with referral tracking parameters.",
          },
        ],
      },
    };
  }

  return null;
}

export function resolveLandingVariant(input: {
  pathVariant?: string | null;
  query?: URLSearchParams | null;
}): LandingVariant {
  const q = input.query;
  const pathVariant = normalizeKey(input.pathVariant);
  const queryBase = normalizeKey(q?.get("base"));
  const queryTrade = normalizeKey(q?.get("trade") || q?.get("service") || q?.get("provider"), 120);

  const { patch, baseKey } = resolveBasePatch(pathVariant, queryBase);
  const matchedTrade = resolveTradeFromVariant(pathVariant, queryTrade);
  const tradePatch = matchedTrade ? buildTradePatch(matchedTrade) : null;
  const resolvedKey = pathVariant || baseKey || DEFAULT_VARIANT.key;
  let next = patch
    ? mergeVariant(DEFAULT_VARIANT, patch, resolvedKey)
    : { ...DEFAULT_VARIANT, key: resolvedKey };
  if (tradePatch) {
    next = mergeVariant(next, tradePatch, resolvedKey);
  }
  if (matchedTrade) {
    const audienceTradePatch = buildAudienceTradePatch(baseKey, matchedTrade);
    if (audienceTradePatch) {
      next = mergeVariant(next, audienceTradePatch, resolvedKey);
    }
  }

  // Preserve a readable display name for campaign slugs like /landing/realtor-austin-video1
  if (pathVariant && !tradePatch && !BASE_VARIANTS[pathVariant] && pathVariant !== baseKey) {
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
