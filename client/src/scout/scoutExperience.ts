import type { ScoutAction, ScoutCluster } from "./state";
import type { ScoutIntentDetail } from "./intentDetails";
import {
  hasMaterialOrSupplierIntent,
  inferMaterialCategory,
  materialProductSummary,
} from "./scoutMaterialSignals";
import { optionBudgetForConfidence, type ScoutConfidenceBand } from "./scoutLearningOptions";

export type ScoutCapabilityId =
  | "plan"
  | "local_help"
  | "materials"
  | "prices"
  | "exchange"
  | "homescout"
  | "community_vault"
  | "finance"
  | "compare"
  | "trust"
  | "saved"
  | "community"
  | "intake";

export type ScoutCapabilityCopy = {
  id: ScoutCapabilityId;
  title: string;
  detail: string;
  prompt: string;
};

export type ScoutSupplierProductSnapshot = {
  sourceUrl: string;
  host: string;
  title?: string;
  brand?: string;
  sku?: string;
  imageUrl?: string;
  priceCents?: number;
  currency?: string;
  availability?: string;
  status?: "resolved" | "partial" | "unavailable";
  message?: string;
};

export type ScoutSourceSignalSnapshot = {
  countyName?: string | null;
  stateName?: string | null;
  activeListings?: number;
  verifiedPros?: number;
  eventsThisWeek?: number;
  communityMembers?: number;
  priceSignals?: Array<{
    id?: string;
    label?: string;
    description?: string;
    metricKey?: string;
    value?: number;
    updatedAt?: string | null;
    sourceLabel?: string;
    sourceKind?: string;
    confidence?: string;
  }>;
  opportunityMoves?: Array<{
    id?: string;
    type?: string;
    title?: string;
    whyItMatters?: string;
    actionLabel?: string;
    prompt?: string;
    sourceLabel?: string;
    confidence?: string;
    updatedAt?: string | null;
  }>;
  trendingPrompts?: Array<{ text?: string; category?: string; count?: number; intent?: string }>;
  recentActivity?: Array<{ query?: string; timestamp?: string }>;
};

export const SCOUT_CAPABILITY_COPY: ScoutCapabilityCopy[] = [
  {
    id: "plan",
    title: "Plan work",
    detail: "Scope, materials, permits, timing, and next steps",
    prompt:
      "Help me plan this work. Show findings, what has to be checked, and the best next paths.",
  },
  {
    id: "intake",
    title: "Collect the right details",
    detail: "Scout narrows the job without trapping you in a long form",
    prompt: "Help me collect the right details for this. Ask only what changes the best next path.",
  },
  {
    id: "local_help",
    title: "Find local help",
    detail: "Pros, requests, saved options, and what to ask first",
    prompt:
      "Find local help for this. Show the best options and what I should know before contacting anyone.",
  },
  {
    id: "materials",
    title: "Materials",
    detail: "Supply Run, supplier links, local products, and Exchange items",
    prompt:
      "Help with materials. I can send a material list or supplier link and Scout will turn it into a Supply Run draft.",
  },
  {
    id: "prices",
    title: "Prices and trends",
    detail: "Local ranges, recent signals, and changes worth checking",
    prompt:
      "Check prices and local trends for this. Show what looks normal, what changed, and what to verify.",
  },
  {
    id: "compare",
    title: "Compare options",
    detail: "When there are multiple paths, Scout lays them out",
    prompt:
      "Compare my options. Put the most likely path first and show the other reasonable choices.",
  },
  {
    id: "trust",
    title: "Trust checks",
    detail: "Before contact opens, Scout keeps the safety steps visible",
    prompt: "Help me check trust and safety before I contact anyone. Show what to verify first.",
  },
  {
    id: "saved",
    title: "Saved conversations",
    detail: "Keep findings so you can come back later",
    prompt:
      "Help me continue or save this Scout conversation so I can come back to the findings later.",
  },
  {
    id: "community",
    title: "Community activity",
    detail: "Nearby posts, projects, events, and local signals",
    prompt:
      "Show what is happening near me: local posts, requests, projects, events, and recent changes.",
  },
  {
    id: "exchange",
    title: "Exchange",
    detail: "Materials, tools, equipment, vehicles, property, and local listings",
    prompt:
      "Help me check Exchange options for this. Show relevant listings, safe next steps, and what to verify before buying or selling.",
  },
  {
    id: "homescout",
    title: "HomeScout",
    detail: "Listings, Home Vault records, inspections, and sell-flow prep",
    prompt:
      "Help me connect this to HomeScout. Use listings, Home Vault details, inspection context, and sell-flow prep where relevant.",
  },
  {
    id: "community_vault",
    title: "Community Vault",
    detail: "Local reinvestment, transparency, builder contributions, and county context",
    prompt:
      "Show how this relates to the Community Vault, local reinvestment, and county transparency without implying payouts or paid placement.",
  },
  {
    id: "finance",
    title: "Finance tools",
    detail: "Invoices, expenses, records, reports, and bookkeeping rebuild paths",
    prompt:
      "Help me connect this to finance tools. Be clear about what works today and what still needs bookkeeping rebuild work.",
  },
];

function askScout(label: string, prompt: string): ScoutAction {
  return { type: "ASK_SCOUT", label, prompt };
}

function actionKey(action: ScoutAction): string {
  return [action.type, action.label || "", action.to || "", action.path || "", action.prompt || ""]
    .join("|")
    .toLowerCase();
}

function uniqueActions(actions: ScoutAction[]): ScoutAction[] {
  const seen = new Set<string>();
  const out: ScoutAction[] = [];
  for (const action of actions) {
    const key = actionKey(action);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

function cleanMessage(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function confidenceActionBudget(band?: ScoutConfidenceBand | string | null): number {
  return Math.max(3, optionBudgetForConfidence(band));
}

function takeActions(actions: ScoutAction[], budget: number): ScoutAction[] {
  return actions.slice(0, budget);
}

export function firstSupplierUrl(value: string): string | null {
  return value.match(/https?:\/\/[^\s)]+/i)?.[0] ?? null;
}

function formatProductPrice(product?: ScoutSupplierProductSnapshot | null): string | null {
  if (!product || typeof product.priceCents !== "number") return null;
  const currency = product.currency || "USD";
  return (product.priceCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency,
  });
}

function supplierSnapshotItems(product?: ScoutSupplierProductSnapshot | null) {
  if (!product) return [];
  const price = formatProductPrice(product);
  const title = product.title || product.host || "Supplier link";
  const details = [
    product.brand,
    product.sku ? `SKU ${product.sku}` : null,
    price ? `${price} listed` : null,
    product.availability
      ? String(product.availability).replace(/^https?:\/\/schema.org\//i, "")
      : null,
  ].filter(Boolean);

  return [
    {
      id: "supplier-snapshot",
      label: product.status === "unavailable" ? "Supplier page needs review" : "Supplier page read",
      description:
        product.status === "unavailable"
          ? product.message || "Scout could not read product details from that link"
          : `${title}${details.length ? ` | ${details.join(" | ")}` : ""}`,
    },
  ];
}

function hasPriceOrTrendIntent(value: string): boolean {
  return /\b(price|prices|cost|costs|estimate|quote|bid|range|trend|trends|deal|deals|supplier|material|materials)\b/i.test(
    value
  );
}

function hasExchangeIntent(value: string): boolean {
  return /\b(exchange|marketplace|listing|listings|buy|sell|selling|for sale|tools?|equipment|materials?|vehicle|vehicles|metals?|rental)\b/i.test(
    value
  );
}

function hasHomeScoutIntent(value: string): boolean {
  return /\b(homescout|home scout|home listing|house listing|sell my home|sell this home|real estate|inspection|inspector|presale|home vault|property listing)\b/i.test(
    value
  );
}

function hasCommunityVaultIntent(value: string): boolean {
  return /\b(community vault|county vault|foundation|giveback|give back|reinvest|reinvestment|community builder|local dollars|transparent funding|transparency)\b/i.test(
    value
  );
}

function hasFinanceIntent(value: string): boolean {
  return /\b(finance|finances|bookkeep|bookkeeping|accounting|invoice|invoices|expense|expenses|receipt|receipts|estimate|estimates|record|records|ledger|report|reports|payroll|vendor|vendors|bank account|tax)\b/i.test(
    value
  );
}

export function formatPriceSignalFreshness(updatedAt?: string | null, now = new Date()): string {
  if (!updatedAt) return "Snapshot freshness unavailable";

  const updatedMs = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedMs)) return "Snapshot freshness unavailable";

  const diffMs = Math.max(0, now.getTime() - updatedMs);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `Updated ${days}d ago`;

  return `Updated ${new Date(updatedAt).toLocaleDateString()}`;
}

export function formatPriceSignalSource(signal: {
  sourceLabel?: string | null;
  confidence?: string | null;
}): string {
  const source = cleanMessage(signal.sourceLabel || "County metric");
  const confidence = cleanMessage(signal.confidence || "");
  return confidence ? `${source} | ${confidence} confidence` : source;
}

export function priceSignalEvidenceSources(
  snapshot?: ScoutSourceSignalSnapshot | null,
  message = ""
): string[] {
  if (!snapshot || !hasPriceOrTrendIntent(message)) return [];
  const sources = new Set<string>();

  for (const signal of snapshot.priceSignals || []) {
    if (!signal?.sourceLabel) continue;
    sources.add(formatPriceSignalSource(signal));
    if (sources.size >= 3) break;
  }

  return Array.from(sources);
}

function sourceBackedPriceItems(snapshot?: ScoutSourceSignalSnapshot | null) {
  if (!snapshot) return [];
  const items: Array<{ id: string; label: string; description: string }> = [];
  const countyLabel = [snapshot.countyName, snapshot.stateName].filter(Boolean).join(", ");

  for (const signal of snapshot.priceSignals || []) {
    if (!signal?.label || !signal.description) continue;
    items.push({
      id: signal.id || signal.metricKey || `price-signal-${items.length}`,
      label: signal.label,
      description: [
        countyLabel ? `${signal.description} around ${countyLabel}` : signal.description,
        formatPriceSignalSource(signal),
        formatPriceSignalFreshness(signal.updatedAt),
      ].join(" | "),
    });
    if (items.length >= 3) return items;
  }

  if (typeof snapshot.activeListings === "number" && snapshot.activeListings > 0) {
    items.push({
      id: "active-listings-signal",
      label: "Exchange activity",
      description: `${snapshot.activeListings} active listing${snapshot.activeListings === 1 ? "" : "s"}${countyLabel ? ` around ${countyLabel}` : ""}`,
    });
  }

  if (typeof snapshot.verifiedPros === "number" && snapshot.verifiedPros > 0) {
    items.push({
      id: "verified-pro-signal",
      label: "Local help signal",
      description: `${snapshot.verifiedPros} verified pro${snapshot.verifiedPros === 1 ? "" : "s"} in the current TradeScout snapshot`,
    });
  }

  const trend = snapshot.trendingPrompts?.find((prompt) => {
    const text = `${prompt.text || ""} ${prompt.category || ""} ${prompt.intent || ""}`;
    return /\b(price|prices|cost|deal|market|contractor|material|gas)\b/i.test(text);
  });
  if (trend?.text) {
    items.push({
      id: "local-trend-signal",
      label: "Local trend signal",
      description: `${trend.text}${trend.count ? ` (${trend.count} recent signal${trend.count === 1 ? "" : "s"})` : ""}`,
    });
  }

  if (typeof snapshot.eventsThisWeek === "number" && snapshot.eventsThisWeek > 0) {
    items.push({
      id: "event-demand-signal",
      label: "Timing signal",
      description: `${snapshot.eventsThisWeek} event${snapshot.eventsThisWeek === 1 ? "" : "s"} this week may affect availability and timing`,
    });
  }

  return items.slice(0, 3);
}

function sourceBackedLocalItems(snapshot?: ScoutSourceSignalSnapshot | null) {
  if (!snapshot) return [];
  const items: Array<{ id: string; label: string; description: string }> = [];
  const countyLabel = [snapshot.countyName, snapshot.stateName].filter(Boolean).join(", ");

  if (typeof snapshot.verifiedPros === "number") {
    items.push({
      id: "verified-pro-count",
      label: "Verified local help",
      description:
        snapshot.verifiedPros > 0
          ? `${snapshot.verifiedPros} verified pro${snapshot.verifiedPros === 1 ? "" : "s"} found${countyLabel ? ` for ${countyLabel}` : ""}`
          : "No verified pro count is available in this snapshot yet",
    });
  }

  if (typeof snapshot.communityMembers === "number" && snapshot.communityMembers > 0) {
    items.push({
      id: "community-count",
      label: "Community signal",
      description: `${snapshot.communityMembers} local member${snapshot.communityMembers === 1 ? "" : "s"} in the current snapshot`,
    });
  }

  const recent = snapshot.recentActivity?.[0];
  if (recent?.query) {
    items.push({
      id: "recent-activity",
      label: "Recent Scout activity",
      description: recent.query,
    });
  }

  return items.slice(0, 3);
}

function sourceBackedOpportunityItems(snapshot?: ScoutSourceSignalSnapshot | null) {
  if (!snapshot) return [];
  const items: Array<{ id: string; label: string; description: string }> = [];

  for (const move of snapshot.opportunityMoves || []) {
    if (!move?.title || !move.whyItMatters) continue;
    items.push({
      id: move.id || `opportunity-move-${items.length}`,
      label: move.title,
      description: [
        move.whyItMatters,
        move.sourceLabel ? `Source: ${cleanMessage(move.sourceLabel)}` : "",
        move.confidence ? `${cleanMessage(move.confidence)} confidence` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    });
    if (items.length >= 3) return items;
  }

  return items;
}

export function buildScoutExperienceClusters(args: {
  message: string;
  confidenceBand?: ScoutConfidenceBand | string | null;
  intentDetails?: ScoutIntentDetail;
  existingLabels?: string[];
  supplierProduct?: ScoutSupplierProductSnapshot | null;
  sourceSignals?: ScoutSourceSignalSnapshot | null;
}): ScoutCluster[] {
  const message = cleanMessage(args.message);
  if (!message) return [];

  const existing = new Set((args.existingLabels || []).map((label) => label.toLowerCase()));
  const detail = args.intentDetails;
  const isMaterialNeed = detail?.context === "materials" || hasMaterialOrSupplierIntent(message);
  const supplierUrl = firstSupplierUrl(message);
  const supplierProduct = args.supplierProduct;
  const sourceSignals = args.sourceSignals;
  const materialCategory = inferMaterialCategory(message);
  const actionBudget = confidenceActionBudget(args.confidenceBand);

  const clusters: ScoutCluster[] = [];
  const overviewActions = uniqueActions([
    askScout(
      "Compare the paths",
      `Compare the realistic paths for this. Put the best next path first, then show the other reasonable choices: ${message}`
    ),
    askScout(
      "Plan the work",
      `Plan this with scope, required checks, materials, labor, timing, and next steps: ${message}`
    ),
    { type: "NAVIGATE", label: "Find local help", to: "/direct-connect/pros" },
    askScout(
      "Check prices",
      `Check price factors, local ranges, and what could change the cost for: ${message}`
    ),
    { type: "NAVIGATE", label: "See nearby activity", to: "/community" },
    { type: "NAVIGATE", label: "Browse Exchange", to: "/exchange" },
    { type: "NAVIGATE", label: "Open HomeScout", to: "/homescout-listings" },
    { type: "NAVIGATE", label: "Open Community Vault", to: "/foundation" },
    { type: "NAVIGATE", label: "Open finance tools", to: "/finances" },
    supplierUrl
      ? {
          type: "NAVIGATE",
          label: "Use supplier link",
          to: `/utilities/supply-run/new?supplierUrl=${encodeURIComponent(supplierUrl)}`,
          subtitle: "Review before anything is sent",
        }
      : {
          type: "NAVIGATE",
          label: "Start a material run",
          to: "/utilities/supply-run/new",
          subtitle: "Review before anything is sent",
        },
  ]).slice(0, actionBudget);

  if (!existing.has("full scout view")) {
    clusters.push({
      id: `full-scout-view-${Date.now()}`,
      title: "Full Scout view",
      kind: "site",
      body: "Scout checks the main angles before you choose: what you expect, what has to be checked, feasible paths, local help, materials, prices, trust, and what details still matter.",
      items: [
        {
          id: "expectation",
          label: detail?.expectation ? "Expected result found" : "Expected result still matters",
          description: detail?.expectation || "Add what good looks like if you want a tighter path",
        },
        {
          id: "requirements",
          label: "Required checks",
          description: "Scope, materials, labor, rules, and safety can change the right answer",
        },
        {
          id: "right-details",
          label: "Right details only",
          description: "Scout collects details that change the path instead of forcing a long form",
        },
        ...sourceBackedLocalItems(sourceSignals),
        ...sourceBackedOpportunityItems(sourceSignals).slice(0, 2),
        {
          id: "community-exchange-homescout",
          label: "Local surfaces connected",
          description:
            "Community, Exchange, HomeScout, Community Vault, and finance tools stay available as real app paths",
        },
        {
          id: "feasible-paths",
          label: "Recommended paths",
          description:
            "Scout puts the most likely path forward and keeps alternatives one tap away",
        },
      ],
      actions: overviewActions,
    });
  }

  const opportunityItems = sourceBackedOpportunityItems(sourceSignals);
  if (opportunityItems.length > 0 && !existing.has("opportunity radar")) {
    clusters.push({
      id: `opportunity-radar-${Date.now()}`,
      title: "Opportunity Radar",
      kind: "site",
      body: "Scout found source-backed local moves from county intelligence. These are prompts to review, package, or audit a move; they do not expose contact or complete outreach.",
      items: opportunityItems,
      actions: takeActions(
        [
          ...((sourceSignals?.opportunityMoves || [])
            .filter((move) => move?.prompt && move?.actionLabel)
            .map((move) =>
              askScout(
                cleanMessage(move.actionLabel || "Review move"),
                cleanMessage(move.prompt || "Review this Opportunity Radar move.")
              )
            ) as ScoutAction[]),
          askScout(
            "Explain the upside",
            `Use the Opportunity Radar signals to explain what is worth reviewing next for: ${message}`
          ),
        ],
        actionBudget
      ),
    });
  }

  if (hasExchangeIntent(message) && !existing.has("exchange options")) {
    clusters.push({
      id: `exchange-options-${Date.now()}`,
      title: "Exchange options",
      kind: "marketplace",
      body: "Scout can connect the work to Exchange listings without implying a purchase, sale, message, or payment has happened.",
      items: [
        {
          id: "exchange-browse",
          label: "Browse first",
          description:
            "Compare local materials, tools, equipment, property, vehicles, and other listings",
        },
        {
          id: "exchange-sell",
          label: "Sell flow stays reviewed",
          description: "Listings are created and reviewed through the app, not silently from chat",
        },
      ],
      actions: takeActions(
        [
          { type: "NAVIGATE", label: "Browse Exchange", to: "/exchange", primary: true },
          { type: "NAVIGATE", label: "Open tools", to: "/exchange/tools" },
          { type: "NAVIGATE", label: "Open construction", to: "/exchange/construction" },
          { type: "NAVIGATE", label: "Seller dashboard", to: "/exchange/seller-dashboard" },
        ],
        actionBudget
      ),
    });
  }

  if (hasHomeScoutIntent(message) && !existing.has("homescout and home vault")) {
    clusters.push({
      id: `homescout-home-vault-${Date.now()}`,
      title: "HomeScout and Home Vault",
      kind: "site",
      body: "Scout can connect listings, Home Vault records, inspections, and sell-flow prep while keeping listing discovery separate from direct contact.",
      items: [
        {
          id: "homescout-listings",
          label: "HomeScout Listings",
          description: "Browse hyperlocal home inventory and listing context",
        },
        {
          id: "home-vault",
          label: "Home Vault",
          description: "Use private home records only where they help the task",
        },
        {
          id: "inspection-context",
          label: "Inspection context",
          description: "Inspection reports and follow-up requests stay gated by the HomeScout flow",
        },
      ],
      actions: takeActions(
        [
          { type: "NAVIGATE", label: "Browse HomeScout", to: "/homescout-listings", primary: true },
          { type: "NAVIGATE", label: "Open Home Vault", to: "/homes" },
          {
            type: "NAVIGATE",
            label: "Start sell flow",
            to: "/exchange?tab=sell&category=real-estate",
            subtitle: "Review before listing",
          },
        ],
        actionBudget
      ),
    });
  }

  if (hasCommunityVaultIntent(message) && !existing.has("community vault context")) {
    clusters.push({
      id: `community-vault-${Date.now()}`,
      title: "Community Vault context",
      kind: "community",
      body: "Scout can show the community reinvestment path and transparency surfaces without implying payout access, paid ranking, or lead selling.",
      items: [
        {
          id: "vault-transparency",
          label: "Transparency first",
          description:
            "Community Vault context is read-only until a real builder or contribution action is chosen",
        },
        {
          id: "no-paid-rank",
          label: "No paid exposure",
          description: "Vault and giveback language must not turn into pay-to-play placement",
        },
      ],
      actions: takeActions(
        [
          { type: "NAVIGATE", label: "Open foundation", to: "/foundation", primary: true },
          { type: "NAVIGATE", label: "Community Builder", to: "/community-builder/dashboard" },
          { type: "NAVIGATE", label: "See community", to: "/community" },
        ],
        actionBudget
      ),
    });
  }

  if (hasFinanceIntent(message) && !existing.has("finance tools and bookkeeping")) {
    clusters.push({
      id: `finance-tools-${Date.now()}`,
      title: "Finance tools and bookkeeping",
      kind: "account",
      body: "Scout can open current invoices, expenses, records, reports, and job finance views. The broader bookkeeping system still needs rebuild work, so Scout should not imply full ledger, tax, payroll, or bank automation is finished.",
      items: [
        {
          id: "finance-current",
          label: "Works today",
          description:
            "Invoices, expenses, records, reports, job flows, materials, estimates, vendors, and exports",
        },
        {
          id: "bookkeeping-rebuild",
          label: "Bookkeeping rebuild needed",
          description:
            "Use finance tools as the current place to organize records, not as a finished accounting engine",
        },
        {
          id: "approval-boundary",
          label: "Approval boundary",
          description:
            "Scout never marks paid, sends invoices, posts records, or moves money without review",
        },
      ],
      actions: takeActions(
        [
          { type: "NAVIGATE", label: "Open finance tools", to: "/finances", primary: true },
          { type: "NAVIGATE", label: "Invoices", to: "/finances/invoices" },
          { type: "NAVIGATE", label: "Expenses", to: "/finances/expenses" },
          { type: "NAVIGATE", label: "Records", to: "/finances/records" },
          { type: "NAVIGATE", label: "Reports", to: "/finances/reports" },
        ],
        actionBudget
      ),
    });
  }

  if (isMaterialNeed && !existing.has("materials and local options")) {
    clusters.push({
      id: `materials-local-${Date.now()}`,
      title: "Materials and local options",
      kind: "marketplace",
      body: "Scout surfaces products, supplier links, nearby supplier options, and Exchange materials before you order or share anything.",
      items: [
        ...supplierSnapshotItems(supplierProduct),
        {
          id: "products",
          label: materialCategory.label,
          description: materialProductSummary(message),
        },
        {
          id: "supplier-link",
          label: "Material list or supplier link",
          description: "Send it here and Scout will turn it into a Supply Run draft",
        },
        {
          id: "approval",
          label: "Review before action",
          description:
            "Nothing is ordered, paid, quoted, invoiced, posted, or messaged automatically",
        },
      ],
      actions: takeActions(
        [
          supplierUrl
            ? {
                type: "NAVIGATE",
                label: "Use supplier link",
                to: `/utilities/supply-run/new?supplierUrl=${encodeURIComponent(supplierUrl)}`,
                primary: true,
                subtitle: "Review before anything is sent",
              }
            : {
                type: "NAVIGATE",
                label: "Start a material run",
                to: "/utilities/supply-run/new",
                primary: true,
                subtitle: "Review before anything is sent",
              },
          {
            type: "NAVIGATE",
            label: "Find local suppliers",
            to: "/direct-connect/pros?trade=supplier",
          },
          {
            type: "NAVIGATE",
            label: "Browse Exchange materials",
            to: materialCategory.exchangePath,
          },
          askScout(
            "Compare products",
            `Compare product choices, quantities, specs, and gotchas for: ${message}`
          ),
        ],
        actionBudget
      ),
    });
  }

  if (hasPriceOrTrendIntent(message) && !existing.has("price and trend checks")) {
    clusters.push({
      id: `price-trend-${Date.now()}`,
      title: "Price and trend checks",
      kind: "rules",
      body: "Scout can compare price factors, material signals, nearby posts, and recent local activity before you call, quote, or order.",
      items: [
        ...sourceBackedPriceItems(sourceSignals),
        {
          id: "materials-source",
          label: "Material price signals",
          description:
            "Use the materials view and supplier links as the source of truth when available",
        },
        {
          id: "community-source",
          label: "Nearby activity",
          description: "Local posts and projects can explain timing, availability, and demand",
        },
        {
          id: "verify-before-use",
          label: "Verify before committing",
          description: "Scout can guide the check, but a supplier or pro confirms the final number",
        },
      ],
      actions: takeActions(
        [
          { type: "NAVIGATE", label: "Open materials view", to: "/finances/materials" },
          { type: "NAVIGATE", label: "See nearby activity", to: "/community" },
          askScout(
            "Check price factors",
            `Compare price factors, local signals, and what needs verification for: ${message}`
          ),
        ],
        actionBudget
      ),
    });
  }

  if (detail?.perspective === "client" && !existing.has("client job prep")) {
    clusters.push({
      id: `client-job-prep-${Date.now()}`,
      title: "Client job prep",
      kind: "projects",
      body: "Because this may be for a client or customer, Scout can keep scope, materials, quote prep, and approvals separated before anything is sent.",
      items: [
        {
          id: "scope",
          label: "Scope before sharing",
          description:
            "Measurements, assumptions, exclusions, and permit checks belong in the draft",
        },
        {
          id: "approval",
          label: "You approve sends",
          description: "Messages, quotes, invoices, and posts stay gated",
        },
      ],
      actions: takeActions(
        [
          askScout(
            "Build client scope",
            `Build a client-ready scope draft with materials, labor, assumptions, and next steps: ${message}`
          ),
          { type: "NAVIGATE", label: "Open project tools", to: "/project-tracker" },
          { type: "NAVIGATE", label: "Open invoices", to: "/finances" },
        ],
        actionBudget
      ),
    });
  }

  return clusters;
}
