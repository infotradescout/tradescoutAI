export type PensacolaCluster = {
  slug: string;
  title: string;
  shortLabel: string;
  summary: string;
  consumerIntent: string;
  providerIntent: string;
  tradeHref: string;
  searchSignals: string[];
};

export const PENSACOLA_COUNTY_CODE = "12033";

export const PENSACOLA_CLUSTERS: PensacolaCluster[] = [
  {
    slug: "hvac-repair",
    title: "Pensacola HVAC Repair",
    shortLabel: "HVAC repair",
    summary:
      "Fast HVAC diagnostics, system repair, and seasonal maintenance demand in Escambia County.",
    consumerIntent: "Cooling and heating issues where response time and reliability matter most.",
    providerIntent:
      "Certified HVAC teams who can handle urgent calls, replacements, and maintenance plans.",
    tradeHref: "/trade/hvac/fl",
    searchSignals: ["hvac contractors", "hvac repair near me", "ac repair pensacola"],
  },
  {
    slug: "electrical-contractors",
    title: "Pensacola Electrical Contractors",
    shortLabel: "Electrical",
    summary: "Residential and light commercial electrical demand across Pensacola neighborhoods.",
    consumerIntent:
      "Panel upgrades, troubleshooting, rewiring, and fixture installs with licensed contractors.",
    providerIntent:
      "Licensed electricians looking for county-scoped demand and trust-first exposure.",
    tradeHref: "/trade/electrical/fl",
    searchSignals: ["electrical contractor", "electricians near me", "electrical services"],
  },
  {
    slug: "drywall-repair",
    title: "Pensacola Drywall Repair",
    shortLabel: "Drywall",
    summary: "Patch, texture matching, and interior wall repair for homes and small businesses.",
    consumerIntent:
      "Drywall cracks, holes, and remodel cleanup where quality finishing affects final appearance.",
    providerIntent: "Drywall specialists with dependable timeline performance and clean execution.",
    tradeHref: "/trade/drywall-contractor/fl",
    searchSignals: ["drywall repair", "drywall contractor", "sheetrock repair"],
  },
  {
    slug: "fence-installation",
    title: "Pensacola Fence Installation",
    shortLabel: "Fence installation",
    summary: "Privacy, security, and perimeter fence work for residential and commercial sites.",
    consumerIntent:
      "Fence install or repair with county-aware permitting and property-fit options.",
    providerIntent: "Fence builders focused on high-intent installation and repair requests.",
    tradeHref: "/trade/fence-contractor/fl",
    searchSignals: ["fence company", "fence contractor", "fence installation"],
  },
  {
    slug: "garage-door-repair",
    title: "Pensacola Garage Door Repair",
    shortLabel: "Garage door",
    summary: "Emergency and scheduled garage door repair, replacement, and opener service.",
    consumerIntent: "Broken springs, openers, and door alignment issues that need quick response.",
    providerIntent: "Garage door specialists for urgent service calls and planned replacements.",
    tradeHref: "/trade/garage-door/fl",
    searchSignals: [
      "garage door repair near me",
      "garage door service",
      "garage door installation",
    ],
  },
  {
    slug: "handyman-services",
    title: "Pensacola Handyman Services",
    shortLabel: "Handyman",
    summary: "General repair, punch-list work, and small project support in Escambia County.",
    consumerIntent:
      "Multiple small repairs where one reliable provider can complete tasks in fewer visits.",
    providerIntent: "Handyman pros with broad service menus and strong reliability history.",
    tradeHref: "/trade/handyman/fl",
    searchSignals: ["handyman services", "local handyman", "home repair services"],
  },
  {
    slug: "gutter-installation",
    title: "Pensacola Gutter Installation",
    shortLabel: "Gutters",
    summary: "Gutter replacement, installation, and repair demand for weather-driven upkeep.",
    consumerIntent: "Water management fixes to protect roofing, siding, and foundations.",
    providerIntent: "Gutter contractors for install and service demand across Pensacola homes.",
    tradeHref: "/trade/gutter-contractor/fl",
    searchSignals: ["gutter company", "gutter installation", "gutter repair"],
  },
  {
    slug: "kitchen-remodel",
    title: "Pensacola Kitchen Remodel",
    shortLabel: "Kitchen remodel",
    summary: "Cabinet, layout, and finish updates for kitchen renovation projects.",
    consumerIntent: "Kitchen upgrades needing trusted planning, budget control, and sequencing.",
    providerIntent: "Remodeling businesses ready for scoped projects and staged decisions.",
    tradeHref: "/trade/kitchen-remodel/fl",
    searchSignals: ["kitchen remodeling", "kitchen contractor", "kitchen remodelers"],
  },
];

export function findPensacolaCluster(slug?: string | null): PensacolaCluster | null {
  if (!slug) return null;
  const normalized = String(slug).trim().toLowerCase();
  return PENSACOLA_CLUSTERS.find((cluster) => cluster.slug === normalized) ?? null;
}
