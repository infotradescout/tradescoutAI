export type DirectConnectIntent =
  | "fix_improve"
  | "vehicle_service"
  | "find_person_business"
  | "sell_list"
  | "property_real_estate"
  | "offer_services"
  | "browse_activity"
  | "browse_only"
  | "support"
  | "coordinate"
  | "employment";

export type DirectConnectEntryContextType =
  | "provider"
  | "business"
  | "profile"
  | "community_post"
  | "trade_deal"
  | "client"
  | "shared_request"
  | "employment_post";

export type DirectConnectEntryContext = {
  countyFips?: string;
  stateCode?: string;
  targetProviderId?: string;
  targetUserId?: string;
  targetName?: string;
  targetSelector?: string;
  source?: string;
  title?: string;
  description?: string;
  budgetMin?: string;
  budgetMax?: string;
  location?: string;
  timing?: string;
  tradeId?: string;
  contextType?: DirectConnectEntryContextType;
  contextId?: string;
  subjectType?: "business" | "product" | "service" | "evidence";
};

export type DirectConnectHomeIdHandoffContext = {
  homeId?: string;
  homePacketId?: string;
  homeContextIntent?:
    | "link_existing"
    | "create_from_request"
    | "update_from_request"
    | "skip_for_now";
};

function readFirst(params: URLSearchParams, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
}

function getQuery(path: string): URLSearchParams {
  const query = path.includes("?") ? path.split("?", 2)[1].split("#", 1)[0] : "";
  return new URLSearchParams(query);
}

function readSafeHomeIdIdentity(
  params: URLSearchParams,
  key: "homeId" | "homePacketId"
): string | undefined {
  const value = params.get(key)?.trim() || "";
  return /^[A-Za-z0-9_-]{1,120}$/.test(value) ? value : undefined;
}

export function parseDirectConnectHomeIdHandoffContext(
  path: string
): DirectConnectHomeIdHandoffContext {
  const params = getQuery(path);
  const rawIntent = params.get("homeContextIntent")?.trim() || "";
  const homeContextIntent = [
    "link_existing",
    "create_from_request",
    "update_from_request",
    "skip_for_now",
  ].includes(rawIntent)
    ? (rawIntent as DirectConnectHomeIdHandoffContext["homeContextIntent"])
    : undefined;

  return {
    homeId: readSafeHomeIdIdentity(params, "homeId"),
    homePacketId: readSafeHomeIdIdentity(params, "homePacketId"),
    homeContextIntent,
  };
}

export function getDirectConnectIntent(path: string): DirectConnectIntent | null {
  const raw = getQuery(path).get("intent")?.trim().toLowerCase();
  if (!raw) return null;

  const map: Record<string, DirectConnectIntent> = {
    fix_improve: "fix_improve",
    manage_projects: "fix_improve",
    hire: "fix_improve",
    vehicle_service: "vehicle_service",
    find_help: "find_person_business",
    find_person_business: "find_person_business",
    sell_list: "sell_list",
    sell_items: "sell_list",
    property_real_estate: "property_real_estate",
    real_estate: "property_real_estate",
    offer_services: "offer_services",
    provider_demand: "offer_services",
    browse_activity: "browse_activity",
    community: "browse_activity",
    browse_only: "browse_only",
    local_search: "find_person_business",
    directory: "find_person_business",
    business: "find_person_business",
    support: "support",
    follow_up: "coordinate",
    introduction: "coordinate",
    collaborate: "coordinate",
    employment: "employment",
  };
  return map[raw] || null;
}

export function parseDirectConnectEntryContext(path: string): DirectConnectEntryContext {
  const params = getQuery(path);
  const providerId = readFirst(params, "targetProviderId", "contractorId");
  const businessSlug = readFirst(params, "prefill_businessSlug");
  const contractorSlug = readFirst(params, "contractor");
  const profileSlug = readFirst(params, "profile");
  const profileName = readFirst(params, "profileName");
  const itemName = readFirst(params, "item");
  const rawSubject = readFirst(params, "subject");
  const subjectType =
    rawSubject === "business" ||
    rawSubject === "product" ||
    rawSubject === "service" ||
    rawSubject === "evidence"
      ? rawSubject
      : itemName
        ? "product"
        : undefined;
  const postId = readFirst(params, "postId");
  const dealId = readFirst(params, "dealId");
  const clientId = readFirst(params, "clientId");
  const sharedRequest = readFirst(params, "shared");
  const employmentPostId = readFirst(params, "employmentPostId");

  let contextType: DirectConnectEntryContextType | undefined;
  let contextId: string | undefined;
  if (employmentPostId) {
    contextType = "employment_post";
    contextId = employmentPostId;
  } else if (postId) {
    contextType = "community_post";
    contextId = postId;
  } else if (dealId) {
    contextType = "trade_deal";
    contextId = dealId;
  } else if (businessSlug) {
    contextType = "business";
    contextId = businessSlug;
  } else if (providerId || contractorSlug) {
    contextType = "provider";
    contextId = providerId || contractorSlug;
  } else if (profileSlug) {
    contextType = "profile";
    contextId = profileSlug;
  } else if (clientId) {
    contextType = "client";
    contextId = clientId;
  } else if (sharedRequest) {
    contextType = "shared_request";
    contextId = sharedRequest;
  }

  const source =
    readFirst(params, "source", "from") ||
    (contextType === "business"
      ? "business_profile"
      : contextType === "provider"
        ? "provider_profile"
        : contextType === "profile"
          ? "profile_site"
          : contextType === "community_post"
            ? "community_post"
            : contextType === "trade_deal"
              ? "trade_deal"
              : contextType === "employment_post"
                ? "employment_post"
                : undefined);

  return {
    countyFips: readFirst(params, "county", "prefill_countyFips"),
    stateCode: readFirst(params, "state", "stateCode", "prefill_stateCode")?.toUpperCase(),
    targetProviderId: providerId,
    targetUserId: readFirst(params, "target"),
    targetName: readFirst(params, "targetName", "prefill_businessName") || itemName || profileName,
    targetSelector: businessSlug || contractorSlug || profileSlug,
    source,
    title: readFirst(params, "title"),
    description: readFirst(params, "description"),
    budgetMin: readFirst(params, "budgetMin"),
    budgetMax: readFirst(params, "budgetMax"),
    location: readFirst(params, "location", "where"),
    timing: readFirst(params, "when", "timing"),
    tradeId: readFirst(params, "trade", "tradeId", "category"),
    contextType,
    contextId,
    subjectType,
  };
}

export function getDirectConnectContextLabel(context: DirectConnectEntryContext): string | null {
  if (context.targetName) return context.targetName;
  if (context.contextType === "community_post") return "Community post";
  if (context.contextType === "trade_deal") return "TradeDeal";
  if (context.contextType === "client") return "Selected client";
  if (context.contextType === "shared_request") return "Shared request";
  if (context.contextType === "employment_post") return "Work opportunity";
  if (context.targetSelector) return context.targetSelector.replace(/[-_]+/g, " ");
  return null;
}
