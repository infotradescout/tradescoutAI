type MarketplaceAction = {
  type: string;
  label: string;
  to?: string;
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
  description: string;
  price?: number;
  locationLabel?: string;
};

type ApplyMarketplaceListingNavigationInput = {
  userId?: string;
  wantsExchangeListingDraft: boolean;
  canPostMarketplaceItem: boolean;
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
    description: string;
    price?: number;
    locationLabel?: string;
  };
};

export function buildExchangeListingDraft(
  input: BuildExchangeListingDraftInput
): ExchangeListingDraft {
  const amount = input.extractDollarAmount(input.originalMessage) ?? undefined;

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

  return { title, description, price: amount, locationLabel };
}

export function applyMarketplaceListingNavigationOwnership(
  input: ApplyMarketplaceListingNavigationInput
): MarketplaceAction[] {
  const nextActions = Array.isArray(input.actions) ? input.actions.slice() : [];

  if (!input.userId || !input.wantsExchangeListingDraft || !input.canPostMarketplaceItem) {
    return nextActions;
  }

  const listingDraft = input.buildDraft(
    input.message,
    input.userRecord,
    input.countyCode,
    input.stateCode
  );

  const params: string[] = ["tab=sell"];
  if (listingDraft.title) {
    params.push(`title=${encodeURIComponent(listingDraft.title)}`);
  }
  if (listingDraft.description) {
    params.push(`description=${encodeURIComponent(listingDraft.description)}`);
  }
  if (listingDraft.price && listingDraft.price > 0) {
    params.push(`price=${encodeURIComponent(String(listingDraft.price))}`);
  }
  if (listingDraft.locationLabel) {
    params.push(`loc=${encodeURIComponent(listingDraft.locationLabel)}`);
  }

  const qs = params.length ? `?${params.join("&")}` : "";
  const to = `/exchange${qs}`;

  const alreadyHasExchangeNav = nextActions.some(
    (a) => a.type === "NAVIGATE" && typeof a.to === "string" && a.to.startsWith("/exchange")
  );

  if (!alreadyHasExchangeNav) {
    nextActions.push({
      type: "NAVIGATE",
      label: "Open this listing in Exchange",
      to,
    });
  }

  return nextActions;
}
