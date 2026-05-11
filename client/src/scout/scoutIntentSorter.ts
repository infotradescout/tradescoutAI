import type { ScoutAction, ScoutCluster, ScoutClusterKind } from "./state";

export type SortedScoutIntent = {
  id: string;
  label: string;
  kind: ScoutClusterKind;
  confidence: number;
  reason: string;
  cluster: ScoutCluster;
  actions: ScoutAction[];
};

type MatcherConfig = {
  id: string;
  label: string;
  kind: ScoutClusterKind;
  reason: string;
  keywords: string[];
  body: string;
  actions: ScoutAction[];
  minScore?: number;
};

type DumpFacts = {
  need: string;
  urgency: "high" | "normal";
  urgencyLabel: string;
  jobType?: string;
  budgetMin?: number;
  budgetMax?: number;
  factItems: Array<{ id: string; label: string; description?: string }>;
};

type ProjectPerspective = "personal" | "client";

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordScore(normalized: string, keywords: string[]): number {
  if (!normalized) return 0;
  let score = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) continue;
    if (normalized.includes(normalizedKeyword)) {
      score += normalizedKeyword.includes(" ") ? 2 : 1;
    }
  }

  return score;
}

function quotedNeed(rawMessage: string): string {
  const trimmed = rawMessage.replace(/\s+/g, " ").trim();
  if (!trimmed) return "what you need";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117).trim()}...` : trimmed;
}

function inferJobType(rawMessage: string): string | undefined {
  const normalized = normalize(rawMessage);
  const tradeHints: Array<[string, string[]]> = [
    ["roofing", ["roof", "roofer", "roofing", "shingle", "gutter"]],
    [
      "plumbing",
      ["plumber", "plumbing", "pipe", "toilet", "sink", "water heater", "drain", "water leak"],
    ],
    ["electrical", ["electrician", "electrical", "outlet", "breaker", "panel", "wire", "wiring"]],
    ["hvac", ["hvac", "ac", "a c", "air conditioner", "heat pump", "furnace", "no heat", "no ac"]],
    ["fencing", ["fence", "gate"]],
    ["deck", ["deck", "decking", "porch", "patio"]],
    ["painting", ["paint", "painter", "painting"]],
    ["landscaping", ["lawn", "landscape", "landscaping", "tree", "yard"]],
    ["concrete", ["concrete", "driveway", "slab", "sidewalk"]],
    ["cleaning", ["cleaner", "cleaning", "deep clean"]],
  ];

  return tradeHints.find(([, hints]) => hints.some((hint) => normalized.includes(hint)))?.[0];
}

function inferBudget(rawMessage: string): { min?: number; max?: number } {
  const compact = rawMessage.replace(/,/g, "");
  const range = compact.match(/\$?\s*(\d{2,7})\s*(?:-|to|through|and)\s*\$?\s*(\d{2,7})/i);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return { min: Math.min(first, second), max: Math.max(first, second) };
    }
  }

  const under = compact.match(/\b(?:under|below|max|maximum|up to)\s*\$?\s*(\d{2,7})\b/i);
  if (under) {
    const max = Number(under[1]);
    if (Number.isFinite(max)) return { max };
  }

  const over = compact.match(/\b(?:over|above|min|minimum|at least)\s*\$?\s*(\d{2,7})\b/i);
  if (over) {
    const min = Number(over[1]);
    if (Number.isFinite(min)) return { min };
  }

  const dollars = compact.match(/\$\s*(\d{2,7})\b/);
  if (dollars) {
    const max = Number(dollars[1]);
    if (Number.isFinite(max)) return { max };
  }

  return {};
}

function inferUrgency(rawMessage: string): DumpFacts["urgency"] {
  return /\b(today|urgent|asap|emergency|now|leak|broken|no heat|no ac|flood|sparking)\b/i.test(
    rawMessage
  )
    ? "high"
    : "normal";
}

function buildFacts(rawMessage: string): DumpFacts {
  const need = quotedNeed(rawMessage);
  const jobType = inferJobType(rawMessage);
  const budget = inferBudget(rawMessage);
  const urgency = inferUrgency(rawMessage);
  const factItems: DumpFacts["factItems"] = [];

  if (jobType) {
    factItems.push({
      id: "fact-job-type",
      label: `Looks like ${jobType} help`,
      description: "You can correct this before anything is shared",
    });
  }

  if (budget.min || budget.max) {
    const budgetLabel =
      budget.min && budget.max
        ? `$${budget.min}-$${budget.max}`
        : budget.max
          ? `up to $${budget.max}`
          : `at least $${budget.min}`;
    factItems.push({
      id: "fact-budget",
      label: `Budget: ${budgetLabel}`,
      description: "You can change this before sharing",
    });
  }

  factItems.push({
    id: "fact-urgency",
    label: urgency === "high" ? "Soon" : "Flexible timing",
    description:
      urgency === "high" ? "This sounds time-sensitive" : "Tell Scout if you need it sooner",
  });

  return {
    need,
    urgency,
    urgencyLabel: urgency === "high" ? "urgent" : "normal",
    jobType,
    budgetMin: budget.min,
    budgetMax: budget.max,
    factItems,
  };
}

function requestAction(rawMessage: string): ScoutAction {
  const facts = buildFacts(rawMessage);
  return {
    type: "PREFILL_INPUT",
    label: facts.jobType ? `Create ${facts.jobType} request` : "Create request",
    subtitle:
      facts.urgency === "high" ? "Urgent draft, review before sharing" : "Review before sharing",
    payload: {
      target: "direct_connect_request",
      route: "/direct-connect",
      prefill: {
        scope: facts.need,
        jobType: facts.jobType,
        tradeId: facts.jobType,
        urgency: facts.urgency,
        budgetMin: facts.budgetMin,
        budgetMax: facts.budgetMax,
      },
    },
    primary: true,
  };
}

function askScoutAction(label: string, prompt: string): ScoutAction {
  return {
    type: "ASK_SCOUT",
    label,
    prompt,
  };
}

function isDeckBuildIntent(normalized: string): boolean {
  const deck = /\b(deck|decking|porch|patio)\b/.test(normalized);
  const build = /\b(build|building|built|install|replace|repair|scope|price|quote|bid)\b/.test(
    normalized
  );
  return deck && build;
}

function inferProjectPerspective(normalized: string): ProjectPerspective {
  return /\b(client|customer|homeowner|for someone|for somebody|for a customer|for my customer|my crew|my bid|bid this|price this|quote this|invoice|materials|supplier|subcontractor)\b/.test(
    normalized
  )
    ? "client"
    : "personal";
}

function createSortedIntent(input: {
  id: string;
  label: string;
  kind: ScoutClusterKind;
  confidence: number;
  reason: string;
  body: string;
  items: Array<{ id: string; label: string; description?: string }>;
  actions: ScoutAction[];
}): SortedScoutIntent {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    confidence: input.confidence,
    reason: input.reason,
    actions: input.actions,
    cluster: {
      id: `sorted-${input.id}`,
      title: input.label,
      kind: input.kind,
      body: input.body,
      items: input.items,
      actions: input.actions,
    },
  };
}

function buildDeckOptionIntents(rawMessage: string, normalized: string): SortedScoutIntent[] {
  if (!isDeckBuildIntent(normalized)) return [];

  const facts = buildFacts(rawMessage);
  const need = facts.need;
  const perspective = inferProjectPerspective(normalized);

  if (perspective === "client") {
    return [
      createSortedIntent({
        id: "deck-client-scope",
        label: "Scope the client deck job",
        kind: "projects",
        confidence: 0.9,
        reason: "Use this when you are building the deck for someone else.",
        body: "Keep the scope, measurements, materials, permit checks, and client-ready next steps together before anything is sent.",
        items: [
          {
            id: "deck-client-context",
            label: "This looks like client work",
            description: "Scout can help organize the job before you share anything",
          },
          {
            id: "deck-client-approval",
            label: "You approve anything that gets sent",
            description: "Messages, quotes, invoices, and posts stay gated",
          },
        ],
        actions: [
          askScoutAction(
            "Build the scope",
            `Help me scope this client deck job with dimensions, materials, labor, permit checks, and next steps: ${need}`
          ),
          { type: "NAVIGATE", label: "Open project tools", to: "/project-tracker" },
          { type: "NAVIGATE", label: "Open invoices", to: "/finances" },
        ],
      }),
      createSortedIntent({
        id: "deck-material-quote-prep",
        label: "Start materials or quote prep",
        kind: "marketplace",
        confidence: 0.88,
        reason: "Use this when you need a material list, supplier link, bid, or invoice draft.",
        body: "Send a material list or supplier link and Scout can help turn it into a Supply Run. Quote and invoice drafts still need your approval.",
        items: [
          {
            id: "deck-material-list",
            label: "Material list or supplier link",
            description: "Scout can help organize it into a Supply Run",
          },
          {
            id: "deck-quote-approval",
            label: "Draft first, approve before sending",
            description: "Scout does not message, quote, invoice, order, or pay on its own",
          },
        ],
        actions: [
          {
            type: "NAVIGATE",
            label: "Start a material run",
            to: "/utilities/supply-run",
            primary: true,
          },
          askScoutAction(
            "Make a material checklist",
            `Make a deck material checklist I can review before using it for a client quote: ${need}`
          ),
          { type: "NAVIGATE", label: "Open invoices", to: "/finances" },
        ],
      }),
    ];
  }

  return [
    createSortedIntent({
      id: "deck-project-plan",
      label: "Plan the deck project",
      kind: "projects",
      confidence: 0.9,
      reason:
        "Use this to understand scope, materials, permit checks, and what to ask before hiring.",
      body: "Scout can help you organize the deck details first so you are not guessing before you talk to anyone.",
      items: [
        {
          id: "deck-plan-scope",
          label: "Scope, materials, and permit checks",
          description: "Start with the facts that change price and who can do the work",
        },
        {
          id: "deck-plan-contact-gate",
          label: "No contact opens until you choose it",
          description: "You stay in review before anything is shared",
        },
      ],
      actions: [
        askScoutAction(
          "Plan the project",
          `Help me plan this deck project with scope, materials, permit checks, price factors, and next steps: ${need}`
        ),
        { type: "NAVIGATE", label: "Start a material run", to: "/utilities/supply-run" },
        askScoutAction(
          "Check prices",
          `Help me compare normal price factors for this deck work: ${need}`
        ),
      ],
    }),
    createSortedIntent({
      id: "deck-find-help",
      label: "Find deck help",
      kind: "pros",
      confidence: 0.88,
      reason: "Use this if you want a pro to build, inspect, or price the deck.",
      body: "Scout can draft a local request and keep it gated for your review before contact opens.",
      items: [
        {
          id: "deck-help-request",
          label: "Draft a deck request",
          description: "Review the details before sharing locally",
        },
        {
          id: "deck-help-compare",
          label: "Compare who fits the job",
          description: "Look at local options without opening contact automatically",
        },
      ],
      actions: [
        requestAction(rawMessage),
        { type: "NAVIGATE", label: "Browse deck help", to: "/direct-connect/pros?trade=deck" },
        askScoutAction(
          "Ask before calling",
          `What should I check before contacting someone about: ${need}`
        ),
      ],
    }),
  ];
}

function matcherConfigs(rawMessage: string): MatcherConfig[] {
  const facts = buildFacts(rawMessage);
  const need = facts.need;

  return [
    {
      id: "local-help",
      label: "Local help",
      kind: "pros",
      reason: "Looks like you need a person, service, contractor, or local recommendation.",
      keywords: [
        "need help",
        "find help",
        "contractor",
        "contractors",
        "roofer",
        "roof",
        "leak",
        "plumber",
        "electrician",
        "hvac",
        "repair",
        "replace",
        "install",
        "quote",
        "estimate",
        "service",
        "handyman",
        "cleaner",
        "lawn",
        "landscape",
        "paint",
        "fence",
        "deck",
      ],
      body: "Scout can help you narrow the job, compare options, and decide what to check before contacting anyone.",
      actions: [
        requestAction(rawMessage),
        { type: "NAVIGATE", label: "Browse local help", to: "/direct-connect/pros" },
        askScoutAction(
          "Ask before calling",
          `Help me figure out the safest next step before I contact anyone about: ${need}`
        ),
      ],
    },
    {
      id: "saved-request",
      label: "Save this search",
      kind: "projects",
      reason: "Looks like something worth saving as a request before sharing locally.",
      keywords: [
        "request",
        "post a request",
        "job",
        "project",
        "scope",
        "budget",
        "timeline",
        "hire",
        "someone to",
        "looking for",
        "need someone",
        "can anyone",
      ],
      body: "Save the basics first. You can review everything before it becomes visible to local help.",
      actions: [
        requestAction(rawMessage),
        { type: "NAVIGATE", label: "Save this search", to: "/direct-connect" },
        askScoutAction(
          "Make this clearer",
          `Rewrite this as a clear local request I can review before sharing: ${need}`
        ),
      ],
    },
    {
      id: "site-search",
      label: "Ask Scout",
      kind: "site",
      reason:
        "Looks like you may be trying to find a page, tool, setting, or saved area in TradeScout.",
      keywords: [
        "where is",
        "find page",
        "tool",
        "search",
        "invoice",
        "invoices",
        "payment",
        "payments",
        "bill",
        "messages",
        "inbox",
        "settings",
        "profile",
        "help center",
        "support",
        "notes",
      ],
      body: "Scout can help you find the right place to go next.",
      actions: [
        { type: "NAVIGATE", label: "Review invoices", to: "/finances" },
        { type: "NAVIGATE", label: "Open messages", to: "/messages" },
        askScoutAction("Ask Scout", `Help me find the right next step for: ${need}`),
      ],
    },
    {
      id: "nearby-activity",
      label: "See nearby activity",
      kind: "community",
      reason: "Looks like a local feed, post, group, event, or neighbor/community question.",
      keywords: [
        "nearby",
        "around me",
        "community",
        "neighbors",
        "neighbours",
        "posts",
        "post",
        "feed",
        "group",
        "hoa",
        "event",
        "events",
        "recommendation",
        "recommendations",
        "what is happening",
        "what's happening",
      ],
      body: "Scout can check local activity, community posts, groups, and nearby updates.",
      actions: [
        { type: "NAVIGATE", label: "See local posts", to: "/community", primary: true },
        askScoutAction("Search nearby activity", `Search nearby activity related to: ${need}`),
      ],
    },
    {
      id: "exchange",
      label: "Exchange",
      kind: "marketplace",
      reason: "Looks like buying, selling, renting, equipment, materials, or listings.",
      keywords: [
        "buy",
        "sell",
        "for sale",
        "listing",
        "listings",
        "market",
        "marketplace",
        "exchange",
        "equipment",
        "materials",
        "tools",
        "rental",
        "rent",
        "truck",
        "trailer",
        "appliance",
      ],
      body: "Scout can search local listings or help you create one.",
      actions: [
        { type: "NAVIGATE", label: "Open Exchange", to: "/exchange", primary: true },
        { type: "NAVIGATE", label: "Post a listing", to: "/exchange?tab=sell" },
        askScoutAction("Search listings", `Search Exchange and local listings for: ${need}`),
      ],
    },
    {
      id: "rules-permits",
      label: "Rules and permits",
      kind: "rules",
      reason: "Looks like a permit, inspection, code, rule, or local requirement question.",
      keywords: [
        "permit",
        "permits",
        "inspection",
        "inspector",
        "code",
        "codes",
        "rule",
        "rules",
        "allowed",
        "legal",
        "ordinance",
        "county requirement",
        "city requirement",
        "license",
      ],
      body: "Scout can explain what to check and keep local requirements separate from general advice.",
      actions: [
        askScoutAction(
          "Ask before calling",
          `Check what I should know before calling about: ${need}`
        ),
        { type: "NAVIGATE", label: "Find someone", to: "/direct-connect/pros" },
      ],
    },
  ];
}

export function sortScoutInfoDump(rawMessage: string): SortedScoutIntent[] {
  const normalized = normalize(rawMessage);
  if (!normalized || normalized.length < 2) return [];

  const deckOptions = buildDeckOptionIntents(rawMessage, normalized);
  if (deckOptions.length > 0) return deckOptions;

  const facts = buildFacts(rawMessage);
  const configs = matcherConfigs(rawMessage);
  const scored = configs
    .map((config) => {
      const score = keywordScore(normalized, config.keywords);
      const confidence = Math.min(0.95, 0.48 + score * 0.12);
      return { config, score, confidence };
    })
    .filter(({ config, score }) => score >= (config.minScore ?? 1))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, 3);

  return scored.map(({ config, confidence }) => ({
    id: config.id,
    label: config.label,
    kind: config.kind,
    confidence,
    reason: config.reason,
    actions: config.actions,
    cluster: {
      id: `sorted-${config.id}`,
      title: config.label,
      kind: config.kind,
      body: config.body,
      items: [
        ...facts.factItems,
        {
          id: `${config.id}-reason`,
          label: config.reason,
          description: confidence >= 0.8 ? "This is a good place to start" : "This may help",
        },
      ],
      actions: config.actions,
    },
  }));
}
