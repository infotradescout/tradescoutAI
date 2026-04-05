type MarketplaceAction = {
  type: string;
  label: string;
  to?: string;
  path?: string;
  prompt?: string;
  subtitle?: string;
  why?: string;
  primary?: boolean;
  payload?: Record<string, unknown>;
};

type BuildExchangeListingDraftInput = {
  originalMessage: string;
  userRecord?: any;
  countyCode?: string;
  stateCode?: string;
  extractDollarAmount: (text: string) => number | null;
  formatUsd: (amount: number) => string;
};

export type ExchangeListingDraft = {
  title: string;
  category: string;
  description: string;
  price: number | null;
  locationLabel?: string;
};

type ApplyMarketplaceListingNavigationInput = {
  userId?: string;
  wantsExchangeListingDraft: boolean;
  canPostMarketplaceItem: boolean;
  confidenceBand: "high" | "medium" | "low";
  message: string;
  userRecord?: any;
  countyCode?: string;
  stateCode?: string;
  actions: MarketplaceAction[];
  buildDraft: (
    message: string,
    userRecord?: any,
    countyCode?: string,
    stateCode?: string
  ) => {
    title: string;
    category: string;
    description: string;
    price: number | null;
    locationLabel?: string;
  };
};

function detectListingCategory(message: string): string {
  const lower = message.toLowerCase();
  if (/(truck|car|van|motorcycle|vehicle|trailer)/.test(lower)) return "vehicles";
  if (/(tool|drill|saw|generator|compressor|equipment)/.test(lower)) return "tools_equipment";
  if (/(sofa|table|chair|dresser|bed|furniture)/.test(lower)) return "furniture";
  if (/(phone|laptop|tablet|tv|camera|console|electronics)/.test(lower)) return "electronics";
  if (/(paint|lumber|tile|drywall|shingle|pipe|wire|material)/.test(lower)) {
    return "building_materials";
  }
  return "general";
}

export function buildExchangeListingDraft(
  input: BuildExchangeListingDraftInput
): ExchangeListingDraft {
  const amount = input.extractDollarAmount(input.originalMessage);

  let itemPhrase = "item";
  const myMatch = input.originalMessage.match(/my\s+([^.,\n]{3,60})/i);
  if (myMatch?.[1]) {
    itemPhrase = myMatch[1].trim();
  } else {
    const forSaleMatch = input.originalMessage.match(/for\s+sale[:\-]?\s*([^.,\n]{3,60})/i);
    if (forSaleMatch?.[1]) {
      itemPhrase = forSaleMatch[1].trim();
    }
  }

  itemPhrase = itemPhrase.replace(/\s+/g, " ");
  if (!itemPhrase || itemPhrase.length < 3) {
    itemPhrase = "equipment";
  }

  const city =
    typeof input.userRecord?.city === "string" && input.userRecord.city.trim().length > 0
      ? input.userRecord.city.trim()
      : undefined;
  const county =
    typeof input.userRecord?.county === "string" && input.userRecord.county.trim().length > 0
      ? input.userRecord.county.trim()
      : input.countyCode;
  const state =
    typeof input.userRecord?.state === "string" && input.userRecord.state.trim().length > 0
      ? input.userRecord.state.trim()
      : input.stateCode;

  const locParts: string[] = [];
  if (city) locParts.push(city);
  if (county && !locParts.includes(county)) locParts.push(county);
  if (state) locParts.push(state);

  const locationLabel = locParts.length > 0 ? locParts.join(", ") : undefined;

  const baseTitle = itemPhrase.replace(/^[a-z]/, (c) => c.toUpperCase());
  const titlePieces: string[] = [baseTitle];
  if (amount && amount > 0) {
    titlePieces.push(`- ${input.formatUsd(amount)}`);
  }
  if (locationLabel) {
    titlePieces.push(`(${locationLabel})`);
  }

  const title = titlePieces.join(" ");
  const category = detectListingCategory(input.originalMessage);

  const priceLine =
    amount && amount > 0
      ? `Asking around ${input.formatUsd(amount)} (open to reasonable offers).`
      : "Set a fair asking price here (you can adjust based on interest).";

  const locationLine = locationLabel
    ? `Located in ${locationLabel}.`
    : "Include your city or county so buyers know where they'll be meeting you.";

  const description = [
    `Selling my ${itemPhrase}.`,
    locationLine,
    "Add clear details about age, brand, size/specs, and exactly what’s included so serious buyers know what they’re getting.",
    "Be upfront about wear, issues, or repairs - honest listings attract better buyers.",
    priceLine,
  ].join(" ");

  return { title, category, description, price: amount ?? null, locationLabel };
}

export function applyMarketplaceListingNavigationOwnership(
  input: ApplyMarketplaceListingNavigationInput
): MarketplaceAction[] {
  const nextActions = Array.isArray(input.actions) ? input.actions.slice() : [];

  if (!input.userId || !input.wantsExchangeListingDraft || !input.canPostMarketplaceItem) {
    return nextActions;
  }

  if (input.confidenceBand === "low") {
    const listingDraft = input.buildDraft(
      input.message,
      input.userRecord,
      input.countyCode,
      input.stateCode
    );
    return [
      {
        type: "ASK_SCOUT",
        label: "Clarify item details first",
        prompt:
          "Tell me the exact item, condition, and target price, and I will prefill your Exchange listing in one step.",
        subtitle: "Need one quick clarification before creating the draft",
        why: "Low confidence listing intent",
        primary: true,
        payload: {
          target: "exchange_listing",
          route: "/exchange?tab=sell",
          prefill: {
            title: listingDraft.title,
            category: listingDraft.category,
            location: listingDraft.locationLabel ?? null,
            price: listingDraft.price,
            description: listingDraft.description,
          },
          source: "marketplace_outcome_engine",
          confidenceBand: "low",
          confirmRequiredFields: ["title", "category", "location", "price", "description"],
        },
      },
      ...nextActions,
    ];
  }

  const listingDraft = input.buildDraft(
    input.message,
    input.userRecord,
    input.countyCode,
    input.stateCode
  );

  const reviewFields = input.confidenceBand === "medium" ? ["category", "price", "location"] : [];

  const primaryAction: MarketplaceAction = {
    type: "PREFILL_INPUT",
    label: "Start Exchange listing draft",
    to: "/exchange?tab=sell",
    path: "/exchange?tab=sell",
    subtitle:
      input.confidenceBand === "medium"
        ? "Partially prefilled; review highlighted fields"
        : "Prefilled title, category, location, price, and description",
    why: "One tap to open a ready listing draft",
    primary: true,
    payload: {
      target: "exchange_listing",
      route: "/exchange?tab=sell",
      prefill: {
        title: listingDraft.title,
        category: listingDraft.category,
        location: listingDraft.locationLabel ?? null,
        price: listingDraft.price,
        description: listingDraft.description,
      },
      source: "marketplace_outcome_engine",
      confidenceBand: input.confidenceBand,
      ...(reviewFields.length > 0 ? { confirmRequiredFields: reviewFields } : {}),
    },
  };

  const secondaryAction: MarketplaceAction = {
    type: "NAVIGATE",
    label: "Review Exchange listings",
    to: "/exchange",
    path: "/exchange",
    subtitle: "Compare nearby listings before publishing",
    why: "Optional quality check",
    primary: false,
  };

  return [primaryAction, secondaryAction, ...nextActions];
}
