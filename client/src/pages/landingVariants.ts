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

const SAFE_IMAGE_PREFIXES = ["/landing/"];

function isSafeSameOriginHref(href: string): boolean {
  // Allow relative paths and same-origin absolute URLs only.
  if (!href) return false;
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function coerceText(value: string | null, maxLen: number): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function coerceImagePath(value: string | null): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (!SAFE_IMAGE_PREFIXES.some((p) => s.startsWith(p))) return null;
  // Prevent protocol-relative or weird traversal.
  if (s.includes("..") || s.startsWith("//")) return null;
  return s;
}

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

const VARIANTS: Record<string, Partial<LandingVariant>> = {
  realtor: {
    displayName: "Realtor",
    badgeText: "Local Network, On Demand",
    headlineLines: ["Move Faster", "With Local", "Trust"],
    subhead:
      "Scout helps you line up reliable local pros for showings, repairs, and timelines without lead spam.",
    audience: {
      sectionLabel: "For Realtors",
      sectionTitle: "Make the Work Part Easy",
      sectionDesc:
        "Scout helps you coordinate the right people locally so your clients stay confident and your timelines stay tight.",
      cards: [
        { title: "Showings & Punch Lists", desc: "Get the right help fast, without chaos." },
        { title: "Client Confidence", desc: "Trust signals you can explain, not vibes." },
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
        "Scout supports clear routing: intent, decision, then contact. So stakeholders stay aligned.",
      cards: [
        { title: "Boards & Managers", desc: "Reduce churn and miscommunication." },
        { title: "Residents", desc: "Understand what’s happening and why." },
      ],
    } as LandingVariant["audience"],
  },
};

export function resolveLandingVariant(input: {
  pathVariant?: string | null;
  query?: URLSearchParams | null;
}): LandingVariant {
  const rawKey = String(input.pathVariant || "").trim().toLowerCase();
  const key = rawKey.replace(/[^a-z0-9_-]/g, "").slice(0, 48);
  const base: LandingVariant = {
    ...DEFAULT_VARIANT,
    ...(key && VARIANTS[key] ? (VARIANTS[key] as Partial<LandingVariant>) : null),
    key: key || DEFAULT_VARIANT.key,
  };

  // Optional URL overrides so you can do 90+ video-specific pages without code changes.
  // All are constrained + sanitized.
  const q = input.query;
  if (!q) return base;

  const badgeText = coerceText(q.get("badge"), 60);
  const headline = coerceText(q.get("headline"), 140);
  const subhead = coerceText(q.get("subhead"), 240);
  const ctaLabel = coerceText(q.get("ctaLabel"), 32);
  const ctaHref = coerceText(q.get("ctaHref"), 240);

  const trustImg = coerceImagePath(q.get("trustImg"));
  const craftImg = coerceImagePath(q.get("craftImg"));
  const logoImg = coerceImagePath(q.get("logoImg"));

  const next: LandingVariant = { ...base };

  if (badgeText) next.badgeText = badgeText;
  if (headline) next.headlineLines = headline.split("|").map((s) => s.trim()).filter(Boolean);
  if (subhead) next.subhead = subhead;

  if (ctaLabel) next.primaryCta = { ...next.primaryCta, label: ctaLabel };
  if (ctaHref && isSafeSameOriginHref(ctaHref)) next.primaryCta = { ...next.primaryCta, href: ctaHref };

  if (logoImg) next.images = { ...next.images, logo: logoImg };
  if (trustImg) next.images = { ...next.images, trust: trustImg };
  if (craftImg) next.images = { ...next.images, craft: craftImg };

  return next;
}

