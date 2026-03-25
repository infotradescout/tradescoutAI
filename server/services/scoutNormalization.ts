import { US_STATES } from "../../shared/us-states-counties";

export type ScoutNormalizedInteractionType =
  | "service_request"
  | "recommendation_request"
  | "offer_of_service"
  | "information_request"
  | "issue_report"
  | "marketplace_listing"
  | "community_update"
  | "event_post"
  | "social_post"
  | "other";

export type ScoutNormalizedIntent =
  | "hire_provider"
  | "find_provider"
  | "offer_help"
  | "get_information"
  | "report_problem"
  | "buy_item"
  | "sell_item"
  | "share_update"
  | "promote_service"
  | "discuss_topic"
  | "other";

export type ScoutNormalizedDomain =
  | "home_services"
  | "local_business"
  | "community"
  | "events"
  | "marketplace"
  | "moderation"
  | "general";

export interface ScoutNormalizedLocation {
  city: string | null;
  state: string | null;
  neighborhood: string | null;
}

export interface ScoutNormalizedEntities {
  service_type: string | null;
  project_type: string | null;
  business_type: string | null;
  person_type: string | null;
  item_type: string | null;
  event_type: string | null;
}

export interface ScoutNormalizedDimensions {
  length: number | null;
  width: number | null;
  unit: string;
}

export interface ScoutNormalizedDetails {
  dimensions: ScoutNormalizedDimensions;
  budget: string | null;
  timeline: string | null;
  urgency: string | null;
  quantity: string | null;
  condition: string | null;
  notes: string[];
}

export interface ScoutNormalizedSentiment {
  tone: string | null;
  urgency_level: number;
}

export interface ScoutNormalizedCertainty {
  interaction_type: number;
  intent: number;
  domain: number;
  location: number;
  overall: number;
}

export interface ScoutNormalizedResult {
  interaction_type: ScoutNormalizedInteractionType;
  intent: ScoutNormalizedIntent;
  domain: ScoutNormalizedDomain;
  subcategory: string | null;
  location: ScoutNormalizedLocation;
  entities: ScoutNormalizedEntities;
  details: ScoutNormalizedDetails;
  sentiment: ScoutNormalizedSentiment;
  certainty: ScoutNormalizedCertainty;
  missing_fields: string[];
  routing_tags: string[];
}

const STATE_NAME_TO_CODE = new Map(
  US_STATES.flatMap((state) => [
    [state.name.toLowerCase(), state.code],
    [state.code.toLowerCase(), state.code],
  ])
);

const LAUNCH_CITY_STATE_MAP = new Map<string, string>([
  ["ponchatoula", "LA"],
  ["covington", "LA"],
  ["hammond", "LA"],
  ["amite", "LA"],
]);

const CITY_DISPLAY_MAP = new Map<string, string>(
  Array.from(LAUNCH_CITY_STATE_MAP.keys()).map((city) => [city, titleCase(city)])
);

const SERVICE_PATTERNS: Array<{
  match: RegExp;
  serviceType: string;
  projectType: string | null;
  subcategory: string;
}> = [
  {
    match: /\bwater heater\b/,
    serviceType: "plumbing",
    projectType: "water_heater_replacement",
    subcategory: "plumbing",
  },
  {
    match: /\bplumb(?:er|ing)?\b/,
    serviceType: "plumbing",
    projectType: null,
    subcategory: "plumbing",
  },
  {
    match: /\bhvac|air conditioner|ac repair|heat pump\b/,
    serviceType: "hvac",
    projectType: null,
    subcategory: "hvac",
  },
  {
    match: /\broof(?:er|ing)?\b/,
    serviceType: "roofing",
    projectType: null,
    subcategory: "roofing",
  },
];

const BUSINESS_PATTERNS: Array<{
  match: RegExp;
  businessType: string;
  personType: string | null;
  subcategory: string;
}> = [
  {
    match: /\brealtor|real estate agent|real estate\b/,
    businessType: "real_estate",
    personType: "realtor",
    subcategory: "real_estate",
  },
];

const ITEM_PATTERNS: Array<{ match: RegExp; itemType: string; subcategory: string }> = [
  {
    match: /\butility trailer\b/,
    itemType: "utility_trailer",
    subcategory: "utility_trailer",
  },
  {
    match: /\btrailer\b/,
    itemType: "trailer",
    subcategory: "trailer",
  },
];

const EVENT_PATTERNS: Array<{ match: RegExp; eventType: string; subcategory: string }> = [
  {
    match: /\bfair\b/,
    eventType: "fair",
    subcategory: "fair",
  },
];

const HIRE_CUES = /\bneed|looking for|replace|repair|fix|install|hire|someone to\b/;
const RECOMMENDATION_CUES = /\bbest|recommend|recommendation|who(?:['’]s| is)\b/;
const OFFER_CUES = /\bi can|i do|offering|available for|my services\b/;
const BUY_CUES = /\bbuying|want to buy|looking to buy|need to buy\b/;
const SELL_CUES = /\bselling|for sale|sell\b/;
const INFO_CUES = /\bwho|what|when|where|why|how|anybody know|does anyone know\b/;
const ISSUE_CUES = /\breport|problem|issue|broken|down|outage|pothole\b/;
const URGENT_CUES = /\basap|urgent|immediately|right away|today\b/;
const SOON_CUES = /\bsoon|this week|quickly\b/;
const FRIENDLY_CUES = /\bbest|anybody know|who(?:['’]s)\b/;

function titleCase(input: string): string {
  return input.replace(/\b\w/g, (match) => match.toUpperCase());
}

function clampCertainty(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function uniqueLowercase(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function extractLocation(text: string): ScoutNormalizedLocation {
  const lower = text.toLowerCase();
  let city: string | null = null;

  for (const [cityKey, display] of CITY_DISPLAY_MAP.entries()) {
    const escaped = cityKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) {
      city = display;
      break;
    }
  }

  let state: string | null = null;
  const stateMatch = text.match(
    /\b([A-Z]{2}|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i
  );
  if (stateMatch?.[1]) {
    state = STATE_NAME_TO_CODE.get(stateMatch[1].toLowerCase()) ?? null;
  }

  if (!state && city) {
    state = LAUNCH_CITY_STATE_MAP.get(city.toLowerCase()) ?? null;
  }

  return {
    city,
    state,
    neighborhood: null,
  };
}

function extractEntities(text: string): {
  entities: ScoutNormalizedEntities;
  subcategory: string | null;
  dominantEntity: string | null;
} {
  const lower = text.toLowerCase();
  const entities: ScoutNormalizedEntities = {
    service_type: null,
    project_type: null,
    business_type: null,
    person_type: null,
    item_type: null,
    event_type: null,
  };

  let subcategory: string | null = null;
  let dominantEntity: string | null = null;

  for (const pattern of SERVICE_PATTERNS) {
    if (pattern.match.test(lower)) {
      entities.service_type = pattern.serviceType;
      entities.project_type = pattern.projectType;
      subcategory = pattern.subcategory;
      dominantEntity = pattern.projectType ?? pattern.serviceType;
      break;
    }
  }

  for (const pattern of BUSINESS_PATTERNS) {
    if (pattern.match.test(lower)) {
      entities.business_type = pattern.businessType;
      entities.person_type = pattern.personType;
      subcategory = subcategory ?? pattern.subcategory;
      dominantEntity = dominantEntity ?? pattern.personType ?? pattern.businessType;
      break;
    }
  }

  for (const pattern of ITEM_PATTERNS) {
    if (pattern.match.test(lower)) {
      entities.item_type = pattern.itemType;
      subcategory = subcategory ?? pattern.subcategory;
      dominantEntity = dominantEntity ?? pattern.itemType;
      break;
    }
  }

  for (const pattern of EVENT_PATTERNS) {
    if (pattern.match.test(lower)) {
      entities.event_type = pattern.eventType;
      subcategory = subcategory ?? pattern.subcategory;
      dominantEntity = dominantEntity ?? pattern.eventType;
      break;
    }
  }

  return { entities, subcategory, dominantEntity };
}

function extractDimensions(text: string): ScoutNormalizedDimensions {
  const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot|in|inch|inches|m|meter|meters)?/i);
  if (!sizeMatch) {
    return { length: null, width: null, unit: "" };
  }

  const rawUnit = (sizeMatch[3] || "").toLowerCase();
  const unit =
    rawUnit === "feet" || rawUnit === "foot"
      ? "ft"
      : rawUnit === "inch" || rawUnit === "inches"
        ? "in"
        : rawUnit;

  return {
    length: Number(sizeMatch[1]),
    width: Number(sizeMatch[2]),
    unit,
  };
}

function extractBudget(text: string): string | null {
  const match = text.match(/\$\s?\d[\d,]*(?:\s?-\s?\$?\d[\d,]*)?/);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

function extractTimeline(text: string): string | null {
  const match = text.match(
    /\b(today|tomorrow|this week|next week|this month|next month|weekend|asap)\b/i
  );
  return match ? match[1].toLowerCase() : null;
}

function extractQuantity(text: string): string | null {
  const match = text.match(/\b(\d+)\s+(items?|trailers?|tickets?|units?)\b/i);
  return match ? `${match[1]} ${match[2].toLowerCase()}` : null;
}

function extractCondition(text: string): string | null {
  const match = text.match(/\b(new|used|like new|good condition|fair condition|poor condition)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function inferUrgency(text: string): { urgency: string | null; urgencyLevel: number } {
  const lower = text.toLowerCase();
  if (URGENT_CUES.test(lower)) {
    return { urgency: "high", urgencyLevel: 5 };
  }
  if (SOON_CUES.test(lower)) {
    return { urgency: "medium", urgencyLevel: 3 };
  }
  return { urgency: null, urgencyLevel: 1 };
}

function inferTone(text: string): string | null {
  const lower = text.toLowerCase();
  if (URGENT_CUES.test(lower)) return "urgent";
  if (FRIENDLY_CUES.test(lower)) return "conversational";
  if (INFO_CUES.test(lower)) return "curious";
  return null;
}

function inferClassification(args: {
  text: string;
  entities: ScoutNormalizedEntities;
}): {
  interactionType: ScoutNormalizedInteractionType;
  intent: ScoutNormalizedIntent;
  domain: ScoutNormalizedDomain;
} {
  const lower = args.text.toLowerCase();
  const { entities } = args;

  if (entities.item_type && SELL_CUES.test(lower)) {
    return {
      interactionType: "marketplace_listing",
      intent: "sell_item",
      domain: "marketplace",
    };
  }

  if (entities.item_type && BUY_CUES.test(lower)) {
    return {
      interactionType: "marketplace_listing",
      intent: "buy_item",
      domain: "marketplace",
    };
  }

  if ((entities.business_type || entities.person_type) && RECOMMENDATION_CUES.test(lower)) {
    return {
      interactionType: "recommendation_request",
      intent: "find_provider",
      domain: "local_business",
    };
  }

  if ((entities.service_type || entities.project_type) && (HIRE_CUES.test(lower) || /need/.test(lower))) {
    return {
      interactionType: "service_request",
      intent: "hire_provider",
      domain: "home_services",
    };
  }

  if ((entities.service_type || entities.business_type) && OFFER_CUES.test(lower)) {
    return {
      interactionType: "offer_of_service",
      intent: entities.business_type ? "promote_service" : "offer_help",
      domain: entities.business_type === "real_estate" ? "local_business" : "home_services",
    };
  }

  if (entities.event_type && INFO_CUES.test(lower)) {
    return {
      interactionType: "information_request",
      intent: "get_information",
      domain: "events",
    };
  }

  if (ISSUE_CUES.test(lower)) {
    return {
      interactionType: "issue_report",
      intent: "report_problem",
      domain: "community",
    };
  }

  if (INFO_CUES.test(lower)) {
    return {
      interactionType: "information_request",
      intent: "get_information",
      domain: "general",
    };
  }

  return {
    interactionType: "other",
    intent: "other",
    domain: "general",
  };
}

function buildMissingFields(args: {
  interactionType: ScoutNormalizedInteractionType;
  intent: ScoutNormalizedIntent;
  domain: ScoutNormalizedDomain;
  location: ScoutNormalizedLocation;
  entities: ScoutNormalizedEntities;
}): string[] {
  const missing = new Set<string>();

  if (
    (args.interactionType === "service_request" ||
      args.interactionType === "recommendation_request" ||
      args.interactionType === "marketplace_listing" ||
      args.domain === "events") &&
    !args.location.city
  ) {
    missing.add("location.city");
  }

  if (
    args.interactionType === "service_request" &&
    !args.entities.service_type &&
    !args.entities.project_type
  ) {
    missing.add("entities.service_type");
  }

  if (
    args.interactionType === "recommendation_request" &&
    !args.entities.person_type &&
    !args.entities.business_type
  ) {
    missing.add("entities.person_type");
  }

  if (args.interactionType === "marketplace_listing" && !args.entities.item_type) {
    missing.add("entities.item_type");
  }

  if (args.domain === "events" && !args.entities.event_type) {
    missing.add("entities.event_type");
  }

  return Array.from(missing);
}

function buildRoutingTags(args: {
  interactionType: ScoutNormalizedInteractionType;
  domain: ScoutNormalizedDomain;
  dominantEntity: string | null;
  location: ScoutNormalizedLocation;
}): string[] {
  return uniqueLowercase([
    args.interactionType,
    args.domain,
    args.dominantEntity,
    args.location.city,
  ]);
}

export function normalizeScoutInteraction(text: string): ScoutNormalizedResult {
  const normalizedText = text.trim();
  const location = extractLocation(normalizedText);
  const { entities, subcategory, dominantEntity } = extractEntities(normalizedText);
  const classification = inferClassification({ text: normalizedText, entities });
  const { urgency, urgencyLevel } = inferUrgency(normalizedText);
  const tone = inferTone(normalizedText);

  const details: ScoutNormalizedDetails = {
    dimensions: extractDimensions(normalizedText),
    budget: extractBudget(normalizedText),
    timeline: extractTimeline(normalizedText),
    urgency,
    quantity: extractQuantity(normalizedText),
    condition: extractCondition(normalizedText),
    notes: [],
  };

  const missingFields = buildMissingFields({
    interactionType: classification.interactionType,
    intent: classification.intent,
    domain: classification.domain,
    location,
    entities,
  });

  const certainty = {
    interaction_type: clampCertainty(classification.interactionType === "other" ? 0.45 : 0.93),
    intent: clampCertainty(classification.intent === "other" ? 0.45 : 0.92),
    domain: clampCertainty(classification.domain === "general" ? 0.6 : 0.94),
    location: clampCertainty(location.city ? (location.state ? 0.98 : 0.85) : 0.2),
    overall: 0,
  };
  certainty.overall = clampCertainty(
    (certainty.interaction_type + certainty.intent + certainty.domain + certainty.location) / 4
  );

  return {
    interaction_type: classification.interactionType,
    intent: classification.intent,
    domain: classification.domain,
    subcategory,
    location,
    entities,
    details,
    sentiment: {
      tone,
      urgency_level: urgencyLevel,
    },
    certainty,
    missing_fields: missingFields,
    routing_tags: buildRoutingTags({
      interactionType: classification.interactionType,
      domain: classification.domain,
      dominantEntity,
      location,
    }),
  };
}
