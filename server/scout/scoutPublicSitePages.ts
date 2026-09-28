import {
  CLIENT_ROUTE_EXPOSURE_POLICIES,
  resolveClientRoute,
} from "../../config/production-readiness-registry.mjs";

type PublicSitePage = {
  path: string;
  title: string;
  summary: string;
  match: RegExp;
};

// These are exact, rendered guest destinations. The route registry alone also
// contains tokenized pages, protected work areas, and redirects.
const PUBLIC_SITE_PAGES: PublicSitePage[] = [
  {
    path: "/datasets/trades",
    title: "Public trade datasets",
    summary: "Browse the published trade directory dataset.",
    match: /\b(?:trade|trades)\s+(?:directory\s+)?datasets?\b|\bdatasets?\s+(?:for\s+)?trades\b/i,
  },
  {
    path: "/datasets/counties",
    title: "Public county datasets",
    summary: "Browse the published county directory dataset.",
    match: /\b(?:county|counties)\s+(?:directory\s+)?datasets?\b|\bdatasets?\s+(?:for\s+)?counties\b/i,
  },
  {
    path: "/datasets/cities",
    title: "Public city datasets",
    summary: "Browse the published city directory dataset.",
    match: /\b(?:city|cities)\s+(?:directory\s+)?datasets?\b|\bdatasets?\s+(?:for\s+)?cities\b/i,
  },
  {
    path: "/datasets",
    title: "Public datasets",
    summary: "Browse TradeScout's published directory datasets.",
    match: /\b(?:public\s+)?datasets?\b/i,
  },
  {
    path: "/services/remote-notary",
    title: "Notary services and state policy",
    summary: "Review the notary page's current state policy and availability before starting a request.",
    match: /\b(?:remote|online)\s+notary\b/i,
  },
  {
    path: "/services/mobile-notary",
    title: "Mobile notary services and state policy",
    summary: "Review the notary page's current state policy and availability before starting a request.",
    match: /\bmobile\s+notary\b/i,
  },
  {
    path: "/help/scout",
    title: "Scout help",
    summary: "Read the public guide to using Scout.",
    match: /\bscout\s+(?:help|guide|information|info)\b|\bhelp\s+(?:with|for|on)\s+scout\b/i,
  },
  {
    path: "/trust-model",
    title: "TradeScout trust model",
    summary: "Read the public explanation of TradeScout's trust model.",
    match: /\btrust\s+model\b/i,
  },
];

function isGuestDestination(path: string): boolean {
  if (!/^\/[a-z0-9/-]+$/.test(path)) return false;
  const exposure = CLIENT_ROUTE_EXPOSURE_POLICIES.find((entry) => entry.path === path);
  if (exposure?.kind === "public_redirect") return false;
  const family = resolveClientRoute(path);
  if (!family?.roles.includes("anonymous")) return false;
  if (family.readiness === "production" || family.readiness === "public_beta") return true;
  return exposure?.kind === "public_entry" || exposure?.kind === "public_read_only" || exposure?.kind === "public_preview";
}

export function resolvePublicSitePageQuery(message: string): Omit<PublicSitePage, "match"> | null {
  const wantsPage = /\b(?:page|pages|website|site|navigate|open|where is|where can i find)\b/i.test(message)
    || /\b(?:search|find)\s+tradescout(?:'s)?\b/i.test(message);
  if (!wantsPage) return null;
  if (/\b(?:providers?|contractors?|near me|hire|book|quotes?)\b/i.test(message)
    && !/\b(?:page|pages|website|site)\b/i.test(message)) return null;

  const page = PUBLIC_SITE_PAGES.find((entry) => entry.match.test(message) && isGuestDestination(entry.path));
  return page ? { path: page.path, title: page.title, summary: page.summary } : null;
}
