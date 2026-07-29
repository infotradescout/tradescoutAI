export type ScoutBrainIntent = "code_query" | "provider_search" | "asset_action";

export type ScoutBenchmarkLocality = {
  city: string;
  county: string;
  state: string;
  countyFips: string;
};

export type ScoutBenchmarkHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ScoutBrainBenchmarkCase = {
  id: string;
  family: "provider" | "code" | "asset" | "memory";
  query: string;
  expectedIntent: ScoutBrainIntent;
  expectedRelevantIds: string[];
  expectedActionId?: string;
  locality?: ScoutBenchmarkLocality;
  history?: ScoutBenchmarkHistoryMessage[];
  requiresWorkingMemory?: boolean;
};

export type ScoutBenchmarkCorpusRecord = {
  id: string;
  kind: "provider" | "knowledge";
  title: string;
  body: string;
  locality: ScoutBenchmarkLocality;
  taxonomy: string[];
  sourceUrl: string;
  measured: {
    verification?: number | null;
    responseRate?: number | null;
    trust?: number | null;
  };
};

const LOCALITIES: ScoutBenchmarkLocality[] = [
  {
    city: "Pensacola",
    county: "Escambia",
    state: "FL",
    countyFips: "12033",
  },
  {
    city: "Dallas",
    county: "Dallas",
    state: "TX",
    countyFips: "48113",
  },
  {
    city: "Chicago",
    county: "Cook",
    state: "IL",
    countyFips: "17031",
  },
  {
    city: "Austin",
    county: "Travis",
    state: "TX",
    countyFips: "48453",
  },
  {
    city: "Raleigh",
    county: "Wake",
    state: "NC",
    countyFips: "37183",
  },
];

const PROVIDER_TOPICS = [
  {
    slug: "plumbing",
    label: "plumber",
    need: "a kitchen sink backup repaired",
  },
  {
    slug: "electrical",
    label: "licensed electrician",
    need: "a breaker panel inspected",
  },
  {
    slug: "hvac",
    label: "HVAC company",
    need: "an AC system that is not cooling repaired",
  },
  {
    slug: "roofing",
    label: "roofer",
    need: "a roof leak repaired",
  },
  {
    slug: "foundation",
    label: "foundation specialist",
    need: "a widening slab crack inspected",
  },
  {
    slug: "fencing",
    label: "fence contractor",
    need: "a damaged privacy fence replaced",
  },
  {
    slug: "decking",
    label: "deck builder",
    need: "an unsafe deck rebuilt",
  },
  {
    slug: "concrete",
    label: "concrete contractor",
    need: "a cracked driveway section replaced",
  },
  {
    slug: "framing",
    label: "framing contractor",
    need: "a load-bearing wall opening evaluated",
  },
  {
    slug: "landscaping",
    label: "landscaper",
    need: "drainage and grading work completed",
  },
  {
    slug: "auto-glass",
    label: "mobile auto glass installer",
    need: "a cracked windshield replaced",
  },
  {
    slug: "aerial-video",
    label: "drone videographer",
    need: "a commercial property filmed from the air",
  },
] as const;

const CODE_TOPICS = [
  {
    slug: "kitchen-gfci",
    query: (locality: ScoutBenchmarkLocality) =>
      `Which GFCI rules apply to a kitchen remodel in ${locality.county} County, ${locality.state}?`,
    title: "Kitchen GFCI requirements",
    body: "Jurisdiction-specific electrical code guidance for kitchen GFCI protection.",
    taxonomy: ["electrical", "gfci", "kitchen"],
  },
  {
    slug: "panel-permit",
    query: (locality: ScoutBenchmarkLocality) =>
      `Do I need a permit to replace an electrical service panel in ${locality.city}, ${locality.state}?`,
    title: "Electrical service panel permits",
    body: "Jurisdiction-specific permit guidance for electrical service panel replacement.",
    taxonomy: ["electrical", "panel", "permit"],
  },
  {
    slug: "plumbing-cleanout",
    query: (locality: ScoutBenchmarkLocality) =>
      `What plumbing code applies to adding a sewer cleanout in ${locality.county} County, ${locality.state}?`,
    title: "Sewer cleanout code",
    body: "Jurisdiction-specific plumbing requirements for sewer cleanout access.",
    taxonomy: ["plumbing", "sewer", "cleanout"],
  },
  {
    slug: "roof-permit",
    query: (locality: ScoutBenchmarkLocality) =>
      `Is a permit required for a full roof replacement in ${locality.city}, ${locality.state}?`,
    title: "Roof replacement permits",
    body: "Jurisdiction-specific permit requirements for full roof replacement.",
    taxonomy: ["roofing", "replacement", "permit"],
  },
  {
    slug: "deck-guardrail",
    query: (locality: ScoutBenchmarkLocality) =>
      `What deck guardrail height is required in ${locality.county} County, ${locality.state}?`,
    title: "Deck guardrail height",
    body: "Jurisdiction-specific deck guardrail height and safety requirements.",
    taxonomy: ["deck", "guardrail", "height"],
  },
  {
    slug: "fence-setback",
    query: (locality: ScoutBenchmarkLocality) =>
      `What fence setback rules apply in ${locality.city}, ${locality.state}?`,
    title: "Fence setback rules",
    body: "Jurisdiction-specific zoning and setback guidance for residential fences.",
    taxonomy: ["fence", "setback", "zoning"],
  },
  {
    slug: "smoke-alarm",
    query: (locality: ScoutBenchmarkLocality) =>
      `Where are smoke alarms required during a remodel in ${locality.county} County, ${locality.state}?`,
    title: "Smoke alarm placement",
    body: "Jurisdiction-specific smoke alarm placement requirements during remodeling.",
    taxonomy: ["fire safety", "smoke alarm", "remodel"],
  },
  {
    slug: "water-heater",
    query: (locality: ScoutBenchmarkLocality) =>
      `What code rules apply to replacing a water heater in ${locality.city}, ${locality.state}?`,
    title: "Water heater replacement code",
    body: "Jurisdiction-specific plumbing and safety requirements for water heater replacement.",
    taxonomy: ["plumbing", "water heater", "replacement"],
  },
  {
    slug: "slab-inspection",
    query: (locality: ScoutBenchmarkLocality) =>
      `Which inspections are required before pouring a foundation slab in ${locality.county} County, ${locality.state}?`,
    title: "Foundation slab inspections",
    body: "Jurisdiction-specific inspection sequence before a foundation slab pour.",
    taxonomy: ["foundation", "slab", "inspection"],
  },
] as const;

const ASSET_ACTIONS = [
  {
    slug: "profile-hours",
    actionId: "profile.update_hours",
    queries: [
      "Update my public profile hours to Monday through Friday, 8 AM to 5 PM.",
      "Change the hours on my business profile so Saturday shows appointment only.",
    ],
  },
  {
    slug: "profile-services",
    actionId: "profile.update_services",
    queries: [
      "Add commercial drone video and construction progress footage to my services.",
      "Remove pressure washing and add roof inspection photography to my profile services.",
    ],
  },
  {
    slug: "profile-hero",
    actionId: "profile.update_hero",
    queries: [
      "Use the newest uploaded photo as my public profile hero.",
      "Replace my profile cover with the approved aerial sunset image.",
    ],
  },
  {
    slug: "verification-evidence",
    actionId: "profile.add_verification_evidence",
    queries: [
      "Attach this insurance certificate to my business verification record.",
      "Add the approved license document to my public business evidence.",
    ],
  },
  {
    slug: "promotion",
    actionId: "promotion.create_draft",
    queries: [
      "Draft a spring promotion for ten percent off first-time aerial inspections.",
      "Create a weekend promotion for free local delivery on qualifying orders.",
    ],
  },
  {
    slug: "exchange-listing",
    actionId: "exchange.create_listing",
    queries: [
      "Create an Exchange listing for my used pressure washer at $450.",
      "List my enclosed trailer for sale in the Exchange for $6,800.",
    ],
  },
  {
    slug: "direct-connect",
    actionId: "direct_connect.start_request",
    queries: [
      "Start a Direct Connect request from the roof repair details I already approved.",
      "Turn the plumbing scope above into a Direct Connect request for my review.",
    ],
  },
  {
    slug: "community-post",
    actionId: "community.create_draft",
    queries: [
      "Draft a community post about the road closure this Friday.",
      "Prepare a neighborhood update about tomorrow's water shutoff.",
    ],
  },
  {
    slug: "send-invoice",
    actionId: "invoice.send",
    queries: [
      "Send the approved invoice for this job.",
      "Send the invoice to the customer after I review the final amount.",
    ],
  },
  {
    slug: "mark-paid",
    actionId: "invoice.mark_paid",
    queries: [
      "Mark this invoice paid; the payment cleared today.",
      "Record payment received on the current invoice.",
    ],
  },
  {
    slug: "send-contract",
    actionId: "contract.send",
    queries: [
      "Send the approved contract for signature.",
      "Send this contract to the customer after my final review.",
    ],
  },
  {
    slug: "sign-contract",
    actionId: "contract.sign",
    queries: [
      "Open the contract so I can sign it.",
      "I need to e-sign the current project contract.",
    ],
  },
  {
    slug: "open-jobs",
    actionId: "jobs.open_workspace",
    queries: [
      "Open my jobs workspace.",
      "Take me to the project tracker for this job.",
    ],
  },
  {
    slug: "save-note",
    actionId: "notes.create",
    queries: [
      "Save a note that the customer prefers text updates after 4 PM.",
      "Create a project note with the approved material color and finish.",
    ],
  },
  {
    slug: "inventory-update",
    actionId: "profile.update_inventory",
    queries: [
      "Add the approved Blue Mare slab photos and quantity to inventory.",
      "Mark the sold inventory item unavailable without deleting its history.",
    ],
  },
] as const;

function providerRecordId(topicSlug: string, countyFips: string): string {
  return `provider:${topicSlug}:${countyFips}`;
}

function codeRecordId(topicSlug: string, countyFips: string): string {
  return `source:${topicSlug}:${countyFips}`;
}

function buildProviderCases(): ScoutBrainBenchmarkCase[] {
  const cases: ScoutBrainBenchmarkCase[] = [];
  for (const [topicIndex, topic] of PROVIDER_TOPICS.entries()) {
    for (const [localityIndex, locality] of LOCALITIES.entries()) {
      const ordinal = topicIndex * LOCALITIES.length + localityIndex + 1;
      cases.push({
        id: `provider-${String(ordinal).padStart(3, "0")}`,
        family: "provider",
        query: `I need ${topic.need}. Find a ${topic.label} serving ${locality.city}, ${locality.state}.`,
        expectedIntent: "provider_search",
        expectedRelevantIds: [providerRecordId(topic.slug, locality.countyFips)],
        locality,
      });
    }
  }
  return cases;
}

function buildCodeCases(): ScoutBrainBenchmarkCase[] {
  const cases: ScoutBrainBenchmarkCase[] = [];
  for (const [topicIndex, topic] of CODE_TOPICS.entries()) {
    for (const [localityIndex, locality] of LOCALITIES.entries()) {
      const ordinal = topicIndex * LOCALITIES.length + localityIndex + 1;
      cases.push({
        id: `code-${String(ordinal).padStart(3, "0")}`,
        family: "code",
        query: topic.query(locality),
        expectedIntent: "code_query",
        expectedRelevantIds: [codeRecordId(topic.slug, locality.countyFips)],
        locality,
      });
    }
  }
  return cases;
}

function buildAssetCases(): ScoutBrainBenchmarkCase[] {
  const cases: ScoutBrainBenchmarkCase[] = [];
  for (const [actionIndex, action] of ASSET_ACTIONS.entries()) {
    for (const [variantIndex, query] of action.queries.entries()) {
      const ordinal = actionIndex * 2 + variantIndex + 1;
      cases.push({
        id: `asset-${String(ordinal).padStart(3, "0")}`,
        family: "asset",
        query,
        expectedIntent: "asset_action",
        expectedRelevantIds: [],
        expectedActionId: action.actionId,
      });
    }
  }
  return cases;
}

function buildMemoryCases(): ScoutBrainBenchmarkCase[] {
  const cases: ScoutBrainBenchmarkCase[] = [];

  for (const [index, locality] of LOCALITIES.entries()) {
    cases.push({
      id: `memory-provider-${String(index + 1).padStart(2, "0")}`,
      family: "memory",
      query: "Only show the one that actually serves my county.",
      history: [
        {
          role: "user",
          content: `Find a roofer for a roof leak in ${locality.city}, ${locality.state}.`,
        },
        {
          role: "assistant",
          content: "I will keep the provider search scoped to your requested location.",
        },
      ],
      expectedIntent: "provider_search",
      expectedRelevantIds: [providerRecordId("roofing", locality.countyFips)],
      locality,
      requiresWorkingMemory: true,
    });
  }

  for (const [index, locality] of LOCALITIES.entries()) {
    const topic = CODE_TOPICS[index];
    cases.push({
      id: `memory-code-${String(index + 1).padStart(2, "0")}`,
      family: "memory",
      query: "Does that rule change for a bathroom?",
      history: [
        {
          role: "user",
          content: topic.query(locality),
        },
        {
          role: "assistant",
          content: "I will keep the answer tied to the requested jurisdiction and cited source.",
        },
      ],
      expectedIntent: "code_query",
      expectedRelevantIds: [codeRecordId(topic.slug, locality.countyFips)],
      locality,
      requiresWorkingMemory: true,
    });
  }

  const assetMemorySeeds = [
    {
      history:
        "Draft a spring promotion for ten percent off first-time aerial inspections using the approved photos.",
      query: "Use the same photos and keep the dates we already approved.",
      actionId: "promotion.create_draft",
    },
    {
      history: "Prepare the current invoice for review before it is sent.",
      query: "The amount is approved. Send that one.",
      actionId: "invoice.send",
    },
    {
      history: "Add commercial drone video and construction progress footage to my services.",
      query: "Keep those two and remove the older service we discussed.",
      actionId: "profile.update_services",
    },
    {
      history: "Draft a community update about Friday's road closure.",
      query: "Use the same location and publish only after I approve it.",
      actionId: "community.create_draft",
    },
    {
      history: "Add the approved Blue Mare slab photos and quantity to inventory.",
      query: "Use the second photo as the card image for that item.",
      actionId: "profile.update_inventory",
    },
  ];

  for (const [index, seed] of assetMemorySeeds.entries()) {
    cases.push({
      id: `memory-asset-${String(index + 1).padStart(2, "0")}`,
      family: "memory",
      query: seed.query,
      history: [
        { role: "user", content: seed.history },
        {
          role: "assistant",
          content: "I have retained the approved draft details for the next step.",
        },
      ],
      expectedIntent: "asset_action",
      expectedRelevantIds: [],
      expectedActionId: seed.actionId,
      requiresWorkingMemory: true,
    });
  }

  return cases;
}

export function buildScoutBrainBenchmarkCases(): ScoutBrainBenchmarkCase[] {
  const cases = [
    ...buildProviderCases(),
    ...buildCodeCases(),
    ...buildAssetCases(),
    ...buildMemoryCases(),
  ];

  if (cases.length !== 150) {
    throw new Error(`Scout Brain benchmark must contain exactly 150 cases; found ${cases.length}`);
  }

  return cases;
}

export function buildScoutBrainBenchmarkCorpus(): ScoutBenchmarkCorpusRecord[] {
  const records: ScoutBenchmarkCorpusRecord[] = [];

  for (const topic of PROVIDER_TOPICS) {
    for (const locality of LOCALITIES) {
      records.push({
        id: providerRecordId(topic.slug, locality.countyFips),
        kind: "provider",
        title: `${topic.label} serving ${locality.county} County`,
        body: `${topic.label} with published service coverage for ${locality.city}, ${locality.county} County, ${locality.state}.`,
        locality,
        taxonomy: [topic.slug, topic.label],
        sourceUrl: `https://www.thetradescout.com/benchmark/providers/${topic.slug}-${locality.countyFips}`,
        measured: {
          verification: null,
          responseRate: null,
          trust: null,
        },
      });
    }
  }

  for (const topic of CODE_TOPICS) {
    for (const locality of LOCALITIES) {
      records.push({
        id: codeRecordId(topic.slug, locality.countyFips),
        kind: "knowledge",
        title: `${topic.title} — ${locality.county} County, ${locality.state}`,
        body: `${topic.body} This benchmark record is scoped to ${locality.county} County, ${locality.state}.`,
        locality,
        taxonomy: [...topic.taxonomy],
        sourceUrl: `https://www.thetradescout.com/benchmark/knowledge/${topic.slug}-${locality.countyFips}`,
        measured: {
          verification: null,
          responseRate: null,
          trust: null,
        },
      });
    }
  }

  return records;
}

