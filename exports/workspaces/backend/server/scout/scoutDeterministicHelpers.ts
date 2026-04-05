export type ConfidenceLabel = "low" | "medium" | "high";
export type SourceConfidenceBand = ConfidenceLabel | "unknown";

export function buildCommunityPrefill(
  original: string,
  countyCode?: string,
  stateCode?: string
): string {
  const lower = original.toLowerCase().trim();

  const areaPhrase = countyCode || stateCode ? "in the county" : "around here";

  const tradeKeywords: Array<{ match: string; label: string }> = [
    { match: "electrician", label: "electrician" },
    { match: "plumber", label: "plumber" },
    { match: "plumbing", label: "plumber" },
    { match: "roofer", label: "roofer" },
    { match: "roofing", label: "roofer" },
    { match: "hvac", label: "HVAC pro" },
    { match: "painter", label: "painter" },
    { match: "landscap", label: "landscaper" },
    { match: "handyman", label: "handyman" },
    { match: "contractor", label: "contractor" },
  ];

  const trade = tradeKeywords.find((t) => lower.includes(t.match))?.label;

  if (trade) {
    return `Looking for a trustworthy ${trade} ${areaPhrase} — who have you had good experiences with?`;
  }

  if (
    lower.includes("hoa") ||
    lower.includes("association") ||
    lower.includes("board meeting") ||
    lower.includes("bylaws") ||
    lower.includes("dues")
  ) {
    return "Has anyone dealt with this in our neighborhood recently?";
  }

  if (
    lower.includes("buy") ||
    lower.includes("sell") ||
    lower.includes("selling") ||
    lower.includes("marketplace") ||
    lower.includes("listing")
  ) {
    return "Has anyone bought or sold something like this locally?";
  }

  if (
    lower.includes("vote") ||
    lower.includes("voting") ||
    lower.includes("policy") ||
    lower.includes("rules") ||
    lower.includes("governance") ||
    lower.includes("how does this work")
  ) {
    return "Can someone explain how this usually works around here?";
  }

  if (lower.startsWith("has anyone")) {
    const cleaned = original
      .replace(/^has anyone\s*/i, "")
      .replace(/\?+$/g, "")
      .trim();
    if (cleaned) {
      return `Has anyone dealt with ${cleaned} recently?`;
    }
  }

  if (lower.startsWith("what's going on with") || lower.startsWith("whats going on with")) {
    const cleaned = original
      .replace(/^(what's|whats)\s+going\s+on\s+with\s*/i, "")
      .replace(/\?+$/g, "")
      .trim();
    if (cleaned) {
      return `What's going on with ${cleaned} ${areaPhrase}?`;
    }
  }

  if (lower.includes("normal in my area") || lower.includes("normal around here")) {
    const cleaned = original
      .replace(/is\s+this\s+/i, "")
      .replace(/\?+$/g, "")
      .trim();
    if (cleaned) {
      return `${cleaned} — is this normal ${areaPhrase}?`;
    }
  }

  const stripped = original
    .replace(/^(can|could|would)\s+you\s+(please\s+)?/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^i\s*(am|'m)\s*(just\s*)?(looking|trying)\s*for\s+/i, "")
    .trim()
    .replace(/\s+/g, " ");

  const topic = stripped.replace(/\?+$/g, "").trim();

  if (topic && topic.length <= 140) {
    return `${topic} — any trusted local signals ${areaPhrase}?`;
  }

  return "Looking for trustworthy local help — who has strong local trust signals?";
}

export function normalizeConfidenceLabel(confidence: unknown): ConfidenceLabel {
  if (confidence === "low" || confidence === "medium" || confidence === "high") {
    return confidence;
  }
  return "medium";
}

export function inferSourceConfidenceBand(confidence: unknown): SourceConfidenceBand {
  if (confidence === "low" || confidence === "medium" || confidence === "high") {
    return confidence;
  }
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.5) return "medium";
    return "low";
  }
  if (typeof confidence === "string") {
    const numeric = Number(confidence);
    if (Number.isFinite(numeric)) {
      if (numeric >= 0.8) return "high";
      if (numeric >= 0.5) return "medium";
      return "low";
    }
  }
  return "unknown";
}

export function shapeDealsForScout({
  deals,
  confidence,
  localityPresent,
  taskSummary,
}: {
  deals: Array<any>;
  confidence: ConfidenceLabel;
  localityPresent: boolean;
  taskSummary?: string;
}): Array<any> {
  if (!deals || deals.length === 0) return [];

  if (confidence === "low" && !localityPresent) {
    return [];
  }

  const ranked = [...deals].sort((a, b) => {
    return (
      (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0) ||
      (b.taskRelevance ?? 0) - (a.taskRelevance ?? 0) ||
      (b.successRate ?? 0) - (a.successRate ?? 0)
    );
  });

  const top = ranked.slice(0, 3);
  const appliable = top.filter((d) => typeof d?.applyPath === "string" && d.applyPath.trim());

  return appliable.map((deal) => ({
    ...deal,
    _scoutWhy: `Shown because it directly supports ${taskSummary ?? "your current goal"}`,
  }));
}

export function shapeActionsByConfidence(
  actions: any[],
  ctx: { confidence: ConfidenceLabel; hasLocality: boolean; communityPrefill?: string }
): any[] {
  const primary: any[] = Array.isArray(actions) ? actions.filter(Boolean) : [];

  const hasCommunity = primary.some(
    (a) => typeof a?.to === "string" && a.to.startsWith("/community")
  );

  const shouldAttachCommunity = ctx.hasLocality || ctx.confidence === "low";
  const communityAction = shouldAttachCommunity
    ? {
        type: "NAVIGATE",
        label: "Ask neighbors (local experiences)",
        to:
          ctx.communityPrefill && ctx.communityPrefill.trim()
            ? `/community?compose=1&prefill=${encodeURIComponent(ctx.communityPrefill)}`
            : "/community?tab=for-you",
      }
    : null;

  if (primary.length === 0) {
    primary.push({
      type: "NAVIGATE",
      label: "Open Direct Connect (fastest match)",
      to: "/direct-connect",
    });
  }

  const maxPrimary = ctx.confidence === "low" ? 1 : ctx.confidence === "medium" ? 2 : 1;
  const trimmed = primary.slice(0, Math.max(1, maxPrimary));

  if (!hasCommunity && communityAction) {
    trimmed.push(communityAction);
  } else if (hasCommunity) {
    const existingCommunity = primary.find(
      (a) => typeof a?.to === "string" && a.to.startsWith("/community")
    );
    if (existingCommunity && !trimmed.includes(existingCommunity)) {
      trimmed.push(existingCommunity);
    }
  }

  return trimmed;
}

export function isWelcomeIntroRequest(message: string): boolean {
  const lower = message.toLowerCase();

  if (!lower) return false;

  if (/(welcome|intro|introduction)\s+(post|message)/.test(lower)) return true;
  if (/draft\s+(a\s+)?welcome/.test(lower)) return true;
  if (/help\s+me\s+write\s+(a\s+)?welcome/.test(lower)) return true;
  if (lower.includes("community welcome")) return true;

  return false;
}

export function buildWelcomeIntroDraft(
  originalMessage: string,
  userRecord?: any,
  countyCode?: string,
  stateCode?: string
): string {
  const lower = originalMessage.toLowerCase();

  const firstName =
    typeof userRecord?.firstName === "string" && userRecord.firstName.trim().length > 0
      ? userRecord.firstName.trim()
      : "";

  const city =
    typeof userRecord?.city === "string" && userRecord.city.trim().length > 0
      ? userRecord.city.trim()
      : undefined;
  const county =
    typeof userRecord?.county === "string" && userRecord.county.trim().length > 0
      ? userRecord.county.trim()
      : countyCode;
  const state =
    typeof userRecord?.state === "string" && userRecord.state.trim().length > 0
      ? userRecord.state.trim()
      : stateCode;

  const locationParts: string[] = [];
  if (city) locationParts.push(city);
  if (county && !locationParts.includes(county)) locationParts.push(county);
  if (state) locationParts.push(state);

  const locationLabel = locationParts.length > 0 ? ` here in ${locationParts.join(", ")}` : "";

  const rolesRaw =
    Array.isArray(userRecord?.roles) && userRecord.roles.length > 0
      ? userRecord.roles
      : userRecord?.role
        ? [userRecord.role]
        : [];

  const baseRole =
    rolesRaw.find((r: unknown) => typeof r === "string" && r.trim().length > 0) ?? "";

  let rolePhrase = "";
  if (typeof baseRole === "string" && baseRole) {
    const normalized = baseRole.replace(/_/g, " ");
    const pretty = normalized.replace(/\b\w/g, (c) => c.toUpperCase());
    const lowerRole = normalized.toLowerCase();

    if (lowerRole === "homeowner") {
      rolePhrase = "a local resident";
    } else if (lowerRole === "contractor") {
      rolePhrase = "a local contractor";
    } else if (lowerRole === "business owner") {
      rolePhrase = "a local business owner";
    } else {
      rolePhrase = pretty;
    }
  }

  const isHoa = /(hoa|homeowners' association|condo board|board meeting)/.test(lower);
  const isBusiness = /(business|company|customers|services|work|contractor|trade)/.test(lower);
  const isNewHere = /(new here|just moved|moved|new to|introduce myself)/.test(lower);
  const isShort = /(short|concise|quick|one[-\s]?liner)/.test(lower);

  const introBase =
    firstName && rolePhrase
      ? `Hi neighbors${locationLabel}, I'm ${firstName}, ${rolePhrase}.`
      : firstName
        ? `Hi neighbors${locationLabel}, I'm ${firstName}.`
        : `Hi neighbors${locationLabel}.`;

  const focusLine = isHoa
    ? "I’m here to stay on top of HOA updates, contribute where I can, and help keep communication clear and useful."
    : isBusiness
      ? "I’m active in the local trade ecosystem and want to build real working relationships with people who value solid work and clear communication."
      : isNewHere
        ? "I recently moved to the area and I’m looking forward to learning from longtime locals and getting involved in the community."
        : "I’m here to connect with neighbors, share useful local info, and support projects that make our area stronger.";

  const askLine = isBusiness
    ? "If you’ve worked with reliable local pros, seen good local groups, or know community projects worth supporting, I’d appreciate the direction."
    : "If you have favorite local groups, trusted pros, or community causes I should know about, I’d appreciate the pointers.";

  if (isShort) {
    return `${introBase} ${askLine}`;
  }

  return `${introBase} ${focusLine} ${askLine}`;
}

export function buildWelcomeIntroVariants(
  originalMessage: string,
  userRecord?: any,
  countyCode?: string,
  stateCode?: string
): { primary: string; concise: string; professional: string } {
  const primary = buildWelcomeIntroDraft(originalMessage, userRecord, countyCode, stateCode);
  const concise = buildWelcomeIntroDraft(
    `${originalMessage} short one-liner`,
    userRecord,
    countyCode,
    stateCode
  );

  const firstName =
    typeof userRecord?.firstName === "string" && userRecord.firstName.trim().length > 0
      ? userRecord.firstName.trim()
      : "I";
  const city =
    typeof userRecord?.city === "string" && userRecord.city.trim().length > 0
      ? userRecord.city.trim()
      : "";
  const state =
    typeof userRecord?.state === "string" && userRecord.state.trim().length > 0
      ? userRecord.state.trim()
      : stateCode || "";

  const locality = [city, state].filter(Boolean).join(", ");
  const localityPhrase = locality ? ` in ${locality}` : "";

  const professional = `Hello neighbors${localityPhrase}. ${firstName} here. I’m looking to connect with people focused on reliable local services, community improvements, and practical collaboration. If there are local groups, initiatives, or trusted service pros I should follow, I’d appreciate the guidance.`;

  return { primary, concise, professional };
}

export function isExchangeListingRequest(message: string): boolean {
  const lower = message.toLowerCase();
  if (!lower) return false;

  if (lower.includes("exchange listing")) return true;
  if (/draft\s+(an?\s+)?listing\b/.test(lower)) return true;
  if (/draft\s+(an?\s+)?exchange\s+listing\b/.test(lower)) return true;
  if (/turn\s+this\s+into\s+(an?\s+)?(exchange\s+)?listing/.test(lower)) return true;
  if (/create\s+(an?\s+)?(exchange\s+)?listing/.test(lower)) return true;
  if (/list\s+(this|it|my)\s+.*for\s+sale/.test(lower)) return true;
  if (/post\s+this\s+for\s+sale/.test(lower)) return true;
  if (lower.startsWith("write a listing") || lower.startsWith("write an exchange listing")) {
    return true;
  }

  return false;
}

export function isTradeDealIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("deal") ||
    lower.includes("deals") ||
    lower.includes("discount") ||
    lower.includes("promo") ||
    lower.includes("promotion") ||
    lower.includes("special offer") ||
    lower.includes("savings") ||
    lower.includes("materials pricing") ||
    lower.includes("material pricing")
  );
}
