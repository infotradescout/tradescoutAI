import type { ScoutAction, ScoutCluster, ScoutClusterKind } from "./state";
import { optionBudgetForConfidence, type ScoutConfidenceBand } from "./scoutLearningOptions";
import {
  hasMaterialOrSupplierIntent,
  inferMaterialCategory,
  materialProductSummary,
} from "./scoutMaterialSignals";

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
type ScoutIntentItem = { id: string; label: string; description?: string };
type SituationProfile = {
  context: "home" | "vehicle" | "materials" | "project" | "marketplace" | "general";
  perspective: ProjectPerspective;
  urgency: DumpFacts["urgency"];
  hasMaterials: boolean;
  wantsPriceReview: boolean;
  wantsLocalHelp: boolean;
  wantsMarketplace: boolean;
  wantsRules: boolean;
};
type ExpectationReality = {
  expectation: ScoutIntentItem;
  required: ScoutIntentItem;
  feasible: ScoutIntentItem;
};

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

function hasNormalizedPhrase(normalized: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  return new RegExp(`(^|\\s)${normalizedPhrase.replace(/\s+/g, "\\s+")}(?=\\s|$)`).test(normalized);
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

  return tradeHints.find(([, hints]) =>
    hints.some((hint) => hasNormalizedPhrase(normalized, hint))
  )?.[0];
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

function buildSituationProfile(rawMessage: string, normalized: string): SituationProfile {
  const facts = buildFacts(rawMessage);
  const vehicle =
    /\b(car|truck|vehicle|van|motorcycle|trailer|tire|brake|engine|transmission|alternator|battery|vin)\b/.test(
      normalized
    );
  const hasMaterials = hasMaterialOrSupplierIntent(normalized);
  const wantsMarketplace =
    /\b(buy|sell|listing|marketplace|exchange|for sale|rent|rental|used|parts?)\b/.test(normalized);
  const wantsPriceReview =
    /\b(fair|quote|estimate|price|pricing|cost|bid|compare|overcharged|too high)\b/.test(
      normalized
    );
  const wantsRules = /\b(permit|inspection|code|rule|allowed|legal|ordinance)\b/.test(normalized);
  const wantsLocalHelp =
    /\b(contractor|pro|mechanic|repair|replace|install|help|near me|nearby|local|trusted|service)\b/.test(
      normalized
    );

  return {
    context: vehicle
      ? "vehicle"
      : hasMaterials
        ? "materials"
        : wantsMarketplace
          ? "marketplace"
          : isProjectActionIntent(normalized)
            ? "project"
            : facts.jobType
              ? "home"
              : "general",
    perspective: inferProjectPerspective(normalized),
    urgency: facts.urgency,
    hasMaterials,
    wantsPriceReview,
    wantsLocalHelp,
    wantsMarketplace,
    wantsRules,
  };
}

function isProjectActionIntent(normalized: string): boolean {
  const projectNoun =
    /\b(deck|decking|porch|patio|fence|roof|roofing|siding|concrete|driveway|kitchen|bathroom|addition|remodel|renovation|plumbing|electrical|hvac|landscaping|pool|garage|flooring|paint|painting)\b/.test(
      normalized
    );
  const actionVerb =
    /\b(build|building|built|install|replace|repair|scope|price|quote|bid|estimate|remodel|renovate|plan)\b/.test(
      normalized
    );
  return projectNoun && actionVerb;
}

function inferProjectPerspective(normalized: string): ProjectPerspective {
  return /\b(client|customer|homeowner|for someone|for somebody|for a customer|for my customer|my crew|my bid|bid this|price this|quote this|invoice|materials|supplier|subcontractor)\b/.test(
    normalized
  )
    ? "client"
    : "personal";
}

function isMaterialRelevantProject(jobType: string | undefined, normalized: string): boolean {
  if (hasMaterialOrSupplierIntent(normalized)) return true;
  return /^(deck|fencing|roofing|concrete|painting|landscaping)$/.test(jobType || "");
}

function shouldPrioritizeLocalHelp(facts: DumpFacts, normalized: string): boolean {
  if (facts.urgency !== "high") return false;
  if (
    /\b(sparking|flood|flooding|no heat|no ac|leak|broken|emergency|asap|today|now)\b/.test(
      normalized
    )
  ) {
    return true;
  }
  return /^(plumbing|electrical|hvac|roofing)$/.test(facts.jobType || "");
}

function buildExpectationRealityItems(rawMessage: string, normalized: string): ExpectationReality {
  const facts = buildFacts(rawMessage);
  const hasBudget = facts.budgetMin !== undefined || facts.budgetMax !== undefined;
  const hasLowBudgetLanguage =
    hasBudget ||
    /\b(cheap|cheapest|low budget|tight budget|budget is tight|affordable)\b/.test(normalized);
  const wantsPremiumOutcome =
    /\b(best|perfect|grade a|high end|premium|done right|turnkey|handle everything)\b/.test(
      normalized
    );
  const wantsMinimalInput =
    /\b(just handle|take care of it|minimum input|not sure|don t know|figure it out)\b/.test(
      normalized
    );

  return {
    expectation: {
      id: "reality-expectation",
      label: "What you want",
      description: wantsPremiumOutcome
        ? "The goal sounds like a high-quality result, so scope and standards matter"
        : wantsMinimalInput
          ? "You may want someone to take limited details and turn them into a finished result"
          : "Start by matching the result you want with the amount of detail you already have",
    },
    required: {
      id: "reality-required",
      label: "What has to be covered",
      description:
        "Materials, labor, measurements, access, timing, and any required permits or inspections can change the real path",
    },
    feasible: {
      id: "reality-feasible",
      label: "What is realistic",
      description: hasLowBudgetLanguage
        ? "Budget may limit finish level, timing, materials, or who can take the job"
        : "Scout should separate must-haves from nice-to-haves before contact opens",
    },
  };
}

function hasItemLike(items: ScoutIntentItem[], value: string): boolean {
  const target = normalize(value);
  return items.some((item) => {
    const label = normalize(item.label);
    const description = normalize(item.description || "");
    return label.includes(target) || description.includes(target);
  });
}

function buildAngleItems(rawMessage: string, currentIntentId: string): ScoutIntentItem[] {
  const normalized = normalize(rawMessage);
  const items: ScoutIntentItem[] = [];

  function add(id: string, label: string, description: string) {
    if (items.length >= 3) return;
    if (currentIntentId.includes(id)) return;
    if (hasItemLike(items, label)) return;
    items.push({ id: `angle-${id}`, label, description });
  }

  if (/\b(client|customer|bid|quote|invoice|my crew|for someone|for somebody)\b/.test(normalized)) {
    add(
      "approval",
      "Client-ready review",
      "Keep scope, price, messages, quotes, and invoices in review before anything is sent"
    );
  }

  if (
    hasMaterialOrSupplierIntent(normalized) ||
    /\b(build|install|replace|repair|project)\b/.test(normalized)
  ) {
    add(
      "materials",
      "Materials and products",
      "Check supplier options, product fit, Exchange listings, and Supply Run when materials matter"
    );
  }

  if (
    /\b(permit|inspection|code|deck|fence|roof|electrical|concrete|addition|remodel)\b/.test(
      normalized
    )
  ) {
    add(
      "rules",
      "Rules or permits",
      "Some jobs need local code, permit, or inspection checks before work starts"
    );
  }

  if (/\b(price|cost|budget|estimate|quote|fair|compare)\b/.test(normalized)) {
    add(
      "price",
      "Price factors",
      "Scope, timing, materials, access, and location can change the range"
    );
  }

  if (
    /\b(near me|nearby|local|recommend|trusted|contractor|pro|plumber|roofer|electrician)\b/.test(
      normalized
    )
  ) {
    add("trust", "Trust before contact", "Compare fit and local signals before opening contact");
  }

  if (
    /\b(today|urgent|asap|emergency|now|leak|broken|no heat|no ac|flood|sparking)\b/.test(
      normalized
    )
  ) {
    add(
      "timing",
      "Timing changes priority",
      "Urgent work should favor safety, availability, and clear contact steps"
    );
  }

  if (items.length === 0) {
    add(
      "owner-context",
      "Who this is for",
      "Home, vehicle, client, rental, or job-site context can change the best next step"
    );
  }

  return items;
}

function createSortedIntent(input: {
  id: string;
  label: string;
  kind: ScoutClusterKind;
  confidence: number;
  reason: string;
  body: string;
  items: ScoutIntentItem[];
  angleItems?: ScoutIntentItem[];
  actions: ScoutAction[];
}): SortedScoutIntent {
  const items = [...input.items];
  for (const item of input.angleItems || []) {
    if (!hasItemLike(items, item.label)) items.push(item);
  }

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
      items,
      actions: input.actions,
    },
  };
}

function buildProjectOptionIntents(rawMessage: string, normalized: string): SortedScoutIntent[] {
  if (!isProjectActionIntent(normalized)) return [];

  const facts = buildFacts(rawMessage);
  const need = facts.need;
  const reality = buildExpectationRealityItems(rawMessage, normalized);
  const jobType = facts.jobType || "project";
  const projectLabel = jobType === "project" ? "project" : `${jobType} project`;
  const helpLabel = jobType === "project" ? "local help" : `${jobType} help`;
  const helpTrade = facts.jobType ? `?trade=${encodeURIComponent(facts.jobType)}` : "";
  const perspective = inferProjectPerspective(normalized);
  const materialRelevant = isMaterialRelevantProject(facts.jobType, normalized);
  const prioritizeLocalHelp = shouldPrioritizeLocalHelp(facts, normalized);

  if (perspective === "client") {
    return [
      createSortedIntent({
        id: "client-project-scope",
        label: "Scope the client job",
        kind: "projects",
        confidence: 0.9,
        reason: "Use this when the work is for a client, customer, or job site.",
        body: "Keep the scope, measurements, materials, permit checks, and client-ready next steps together before anything is sent.",
        items: [
          reality.expectation,
          reality.required,
          reality.feasible,
          {
            id: "client-project-context",
            label: "This looks like client work",
            description: "Scout can help organize the job before you share anything",
          },
          {
            id: "client-project-approval",
            label: "You approve anything that gets sent",
            description: "Messages, quotes, invoices, and posts stay gated",
          },
        ],
        angleItems: buildAngleItems(rawMessage, "client-project-scope"),
        actions: [
          askScoutAction(
            "Build the scope",
            `Help me scope this client ${projectLabel} with dimensions, materials, labor, permit checks, and next steps: ${need}`
          ),
          { type: "NAVIGATE", label: "Open project tools", to: "/project-tracker" },
          { type: "NAVIGATE", label: "Open invoices", to: "/finances" },
        ],
      }),
      createSortedIntent({
        id: "material-quote-prep",
        label: "Start materials or quote prep",
        kind: "marketplace",
        confidence: 0.88,
        reason: "Use this when you need a material list, supplier link, bid, or invoice draft.",
        body: "Send a material list or supplier link and Scout can help turn it into a Supply Run. Quote and invoice drafts still need your approval.",
        items: [
          {
            id: "project-material-list",
            label: "Material list or supplier link",
            description: "Scout can help organize it into a Supply Run",
          },
          {
            id: "project-quote-approval",
            label: "Draft first, approve before sending",
            description: "Scout does not message, quote, invoice, order, or pay on its own",
          },
        ],
        angleItems: buildAngleItems(rawMessage, "material-quote-prep"),
        actions: [
          {
            type: "NAVIGATE",
            label: "Start a material run",
            to: "/utilities/supply-run",
            primary: true,
          },
          {
            type: "NAVIGATE",
            label: "Find local suppliers",
            to: "/direct-connect/pros?trade=supplier",
          },
          { type: "NAVIGATE", label: "Browse Exchange materials", to: "/exchange/construction" },
          askScoutAction(
            "Make a material checklist",
            `Make a material checklist I can review before using it for a client quote: ${need}`
          ),
          { type: "NAVIGATE", label: "Open invoices", to: "/finances" },
        ],
      }),
    ];
  }

  const planActions: ScoutAction[] = [
    askScoutAction(
      "Plan the project",
      `Help me plan this ${projectLabel} with scope, materials, permit checks, price factors, and next steps: ${need}`
    ),
    askScoutAction("Check prices", `Help me compare normal price factors for this work: ${need}`),
  ];

  if (materialRelevant) {
    planActions.splice(
      1,
      0,
      { type: "NAVIGATE", label: "Start a material run", to: "/utilities/supply-run" },
      { type: "NAVIGATE", label: "Browse Exchange materials", to: "/exchange/construction" }
    );
  }

  const planIntent = createSortedIntent({
    id: "project-plan",
    label: "Plan this project",
    kind: "projects",
    confidence: prioritizeLocalHelp ? 0.84 : 0.9,
    reason:
      "Use this to understand scope, materials, permit checks, and what to ask before hiring.",
    body: "Scout can help you organize the details first so you are not guessing before you talk to anyone.",
    items: [
      reality.expectation,
      reality.required,
      reality.feasible,
      {
        id: "project-plan-scope",
        label: "Scope, materials, and permit checks",
        description: "Start with the facts that change price and who can do the work",
      },
      {
        id: "project-plan-contact-gate",
        label: "No contact opens until you choose it",
        description: "You stay in review before anything is shared",
      },
    ],
    angleItems: buildAngleItems(rawMessage, "project-plan"),
    actions: planActions,
  });

  const helpItems: ScoutIntentItem[] = [
    {
      id: "project-help-request",
      label: `Draft a ${helpLabel} request`,
      description: "Review the details before sharing locally",
    },
    {
      id: "project-help-compare",
      label: "Compare who fits the job",
      description: "Look at local options without opening contact automatically",
    },
  ];

  if (prioritizeLocalHelp) {
    helpItems.unshift({
      id: "urgent-service-fit",
      label: "Safety and availability first",
      description: "Urgent service work should focus on who can respond and what to avoid touching",
    });
  }

  const helpIntent = createSortedIntent({
    id: "project-find-help",
    label: "Find local help",
    kind: "pros",
    confidence: prioritizeLocalHelp ? 0.92 : 0.88,
    reason: prioritizeLocalHelp
      ? "Use this when timing, safety, or availability matters more than planning."
      : "Use this if you want a pro to build, inspect, or price the work.",
    body: prioritizeLocalHelp
      ? "Scout can help draft an urgent local request and keep contact gated for your review."
      : "Scout can draft a local request and keep it gated for your review before contact opens.",
    items: helpItems,
    angleItems: buildAngleItems(rawMessage, "project-find-help"),
    actions: [
      requestAction(rawMessage),
      { type: "NAVIGATE", label: "Browse local help", to: `/direct-connect/pros${helpTrade}` },
      askScoutAction(
        "Ask before calling",
        `What should I check before contacting someone about: ${need}`
      ),
    ],
  });

  return prioritizeLocalHelp ? [helpIntent, planIntent] : [planIntent, helpIntent];
}

function buildVehicleOptionIntents(rawMessage: string, normalized: string): SortedScoutIntent[] {
  const profile = buildSituationProfile(rawMessage, normalized);
  if (profile.context !== "vehicle") return [];

  const facts = buildFacts(rawMessage);
  const need = facts.need;
  const partsRelevant =
    profile.wantsMarketplace ||
    /\b(part|parts|tire|battery|alternator|brake pad|rotor|wheel|tool|tow|trailer)\b/.test(
      normalized
    );

  const vehicleHelp = createSortedIntent({
    id: "vehicle-help",
    label: profile.urgency === "high" ? "Handle the vehicle issue" : "Vehicle help",
    kind: "site",
    confidence: profile.urgency === "high" ? 0.9 : 0.86,
    reason:
      profile.urgency === "high"
        ? "Use this when the vehicle issue sounds time-sensitive."
        : "Use this when the need is tied to a car, truck, trailer, or vehicle record.",
    body:
      profile.urgency === "high"
        ? "Start with safety, symptoms, and what not to drive or touch. Then keep vehicle details ready."
        : "Scout can organize the vehicle details, symptoms, and next checks before you contact anyone.",
    items: [
      {
        id: "vehicle-context",
        label: "Vehicle context",
        description: "Year, make, model, symptoms, and timing change the next step",
      },
      {
        id: "vehicle-review",
        label: "Review before contact",
        description: "Scout can help prepare details, but you choose before anything is shared",
      },
    ],
    angleItems: buildAngleItems(rawMessage, "vehicle-help"),
    actions: [
      askScoutAction(
        "Narrow the issue",
        `Help me narrow this vehicle issue, what to check, and what details to save: ${need}`
      ),
      { type: "NAVIGATE", label: "Open vehicles", to: "/vehicles" },
    ],
  });

  if (!partsRelevant) return [vehicleHelp];

  return [
    vehicleHelp,
    createSortedIntent({
      id: "vehicle-parts-market",
      label: "Vehicle parts or listings",
      kind: "marketplace",
      confidence: 0.82,
      reason: "Use this when parts, tools, vehicles, or related listings may matter.",
      body: "Scout can point you toward vehicle listings or parts research without contacting anyone automatically.",
      items: [
        {
          id: "vehicle-market-fit",
          label: "Parts and vehicle listings",
          description: "Compare fit, condition, price, pickup, and compatibility before buying",
        },
      ],
      angleItems: buildAngleItems(rawMessage, "vehicle-parts-market"),
      actions: [
        { type: "NAVIGATE", label: "Open vehicle marketplace", to: "/vehicle-marketplace" },
        askScoutAction("Compare fit", `Help me compare vehicle parts or listings for: ${need}`),
      ],
    }),
  ];
}

function buildPriceReviewOptionIntents(
  rawMessage: string,
  normalized: string
): SortedScoutIntent[] {
  const profile = buildSituationProfile(rawMessage, normalized);
  const explicitReview = /\b(fair|quote|estimate|bid|overcharged|too high)\b/.test(normalized);
  const priceOnly =
    /\b(price|pricing|cost)\b/.test(normalized) && !isProjectActionIntent(normalized);
  if (
    !profile.wantsPriceReview ||
    (!explicitReview && !priceOnly) ||
    profile.context === "materials" ||
    profile.context === "vehicle"
  ) {
    return [];
  }

  const facts = buildFacts(rawMessage);
  const need = facts.need;
  const reality = buildExpectationRealityItems(rawMessage, normalized);
  const localHelpPath = facts.jobType
    ? `/direct-connect/pros?trade=${encodeURIComponent(facts.jobType)}`
    : "/direct-connect/pros";

  return [
    createSortedIntent({
      id: "price-review",
      label: "Check prices",
      kind: "projects",
      confidence: 0.89,
      reason: "Use this when the user is comparing cost, a quote, estimate, or bid.",
      body: "Scout can help compare the scope, materials, timing, and red flags before you contact anyone.",
      items: [
        reality.expectation,
        reality.required,
        reality.feasible,
        {
          id: "price-scope",
          label: "Scope before price",
          description:
            "A quote is only useful when the work, materials, exclusions, and timing are clear",
        },
        {
          id: "price-contact-gate",
          label: "No contact opens automatically",
          description: "Use this to review before asking anyone for more detail",
        },
      ],
      angleItems: buildAngleItems(rawMessage, "price-review"),
      actions: [
        askScoutAction(
          "Review this price",
          `Help me review this price, quote, estimate, or bid and what to check next: ${need}`
        ),
        { type: "NAVIGATE", label: "Compare local help", to: localHelpPath },
      ],
    }),
  ];
}

function buildMaterialOptionIntents(
  rawMessage: string,
  normalized: string,
  confidenceBand?: ScoutConfidenceBand | string | null
): SortedScoutIntent[] {
  if (!hasMaterialOrSupplierIntent(normalized)) return [];

  const facts = buildFacts(rawMessage);
  const need = facts.need;
  const materialCategory = inferMaterialCategory(normalized);
  const products = materialProductSummary(normalized);
  const options = [
    createSortedIntent({
      id: "local-suppliers",
      label: "Local suppliers",
      kind: "marketplace",
      confidence: 0.86,
      reason: "Use this to find supplier options before anything is contacted or ordered.",
      body: "Scout can help identify local supplier options and what to verify. Supplier stock and prices need confirmation from the supplier.",
      items: [
        {
          id: "supplier-options",
          label: "Supplier options",
          description: "Nearby stores, yards, or suppliers to compare before contact",
        },
        {
          id: "supplier-guardrail",
          label: "You approve the next step",
          description: "Scout does not contact, order, invoice, or pay on its own",
        },
      ],
      angleItems: buildAngleItems(rawMessage, "local-suppliers"),
      actions: [
        {
          type: "NAVIGATE",
          label: "Find local suppliers",
          to: "/direct-connect/pros?trade=supplier",
          primary: true,
        },
        {
          type: "NAVIGATE",
          label: "Start a material run",
          to: "/utilities/supply-run",
        },
        askScoutAction(
          "Ask what to verify",
          `Help me check supplier options, availability questions, pickup or delivery details, and red flags for: ${need}`
        ),
      ],
    }),
    createSortedIntent({
      id: "products-to-compare",
      label: "Products to compare",
      kind: "marketplace",
      confidence: 0.84,
      reason: "Use this to compare product types, specs, and quantities before buying.",
      body: `Scout can help compare ${products}. Prices and availability should be verified with the supplier before you commit.`,
      items: [
        {
          id: "product-categories",
          label: materialCategory.label,
          description: products,
        },
        {
          id: "product-fit",
          label: "Fit before price",
          description: "Match sizes, grade, quantity, delivery, and return constraints first",
        },
      ],
      angleItems: buildAngleItems(rawMessage, "products-to-compare"),
      actions: [
        askScoutAction(
          "Compare products",
          `Compare product choices, quantities, specs, and gotchas for: ${need}`
        ),
        {
          type: "NAVIGATE",
          label: "Browse related listings",
          to: materialCategory.exchangePath,
        },
      ],
    }),
    createSortedIntent({
      id: "exchange-materials",
      label: "Exchange materials",
      kind: "marketplace",
      confidence: 0.82,
      reason: "Use this to check nearby material, tool, and equipment listings.",
      body: "Scout can point you to appropriate Exchange categories for nearby materials, tools, or equipment without opening contact automatically.",
      items: [
        {
          id: "exchange-fit",
          label: "Appropriate local listings",
          description: "Materials, tools, equipment, and job-adjacent items",
        },
      ],
      angleItems: buildAngleItems(rawMessage, "exchange-materials"),
      actions: [
        {
          type: "NAVIGATE",
          label: "Browse Exchange materials",
          to: materialCategory.exchangePath,
          primary: true,
        },
        askScoutAction("Search listings", `Help me search Exchange for items related to: ${need}`),
      ],
    }),
    createSortedIntent({
      id: "material-run",
      label: "Material list or supplier link",
      kind: "projects",
      confidence: 0.8,
      reason: "Use this when you have a list, link, cart, or rough materials to organize.",
      body: "Send a material list or supplier link and Scout can help turn it into a Supply Run.",
      items: [
        {
          id: "supply-run-input",
          label: "Material list or supplier link",
          description: "Scout organizes the request for review before any order step",
        },
      ],
      angleItems: buildAngleItems(rawMessage, "material-run"),
      actions: [
        {
          type: "NAVIGATE",
          label: "Start a material run",
          to: "/utilities/supply-run",
          primary: true,
        },
        askScoutAction(
          "Make a material checklist",
          `Make a clean material checklist from this: ${need}`
        ),
      ],
    }),
  ];

  return options.slice(0, optionBudgetForConfidence(confidenceBand ?? "medium"));
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

export function sortScoutInfoDump(
  rawMessage: string,
  options: { confidenceBand?: ScoutConfidenceBand | string | null } = {}
): SortedScoutIntent[] {
  const normalized = normalize(rawMessage);
  if (!normalized || normalized.length < 2) return [];

  const vehicleOptions = buildVehicleOptionIntents(rawMessage, normalized);
  if (vehicleOptions.length > 0) return vehicleOptions;

  const priceOptions = buildPriceReviewOptionIntents(rawMessage, normalized);
  if (priceOptions.length > 0) return priceOptions;

  const projectOptions = buildProjectOptionIntents(rawMessage, normalized);
  if (projectOptions.length > 0) return projectOptions;

  const materialOptions = buildMaterialOptionIntents(
    rawMessage,
    normalized,
    options.confidenceBand
  );
  if (materialOptions.length > 0) return materialOptions;

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
    .slice(0, optionBudgetForConfidence(options.confidenceBand ?? "medium"));

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
        ...buildAngleItems(rawMessage, config.id),
      ],
      actions: config.actions,
    },
  }));
}
