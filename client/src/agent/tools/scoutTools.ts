/**
 * Typed tool wrappers for Scout agent.
 * Each tool has retries, timeouts, and telemetry built in.
 */

import { runTool, ToolDefinition, ToolContext } from "./toolRunner";

async function safeErrorText(res: Response): Promise<string> {
  try {
    if (typeof (res as any).text === "function") {
      return await res.text();
    }
  } catch {
    // best effort only
  }
  return "";
}

/* ======================== Contractor Search Tool ======================== */

export interface ContractorSearchInput {
  query?: string;
  trade?: string;
  tradeTags?: string[];
  county?: string;
  state?: string;
  zip?: string;
  availability?: "available" | "busy" | "any";
  sort?: "rating" | "distance" | "recent";
  limit?: number;
  offset?: number;
}

export interface ContractorResult {
  id: string;
  name: string;
  trade: string;
  rating: number;
  reviewCount: number;
  location: string;
  distance?: number;
  availability?: string;
  profileUrl: string;
}

const contractorSearchTool: ToolDefinition<ContractorSearchInput, ContractorResult[]> = {
  name: "contractor_search",
  description: "Search for local contractors by trade, location, and availability",
  timeout: 12000,
  retries: 2,
  async execute(input, context) {
    const params = new URLSearchParams();

    if (input.query) params.set("query", input.query);
    if (input.trade) params.set("trade", input.trade);
    if (input.county) params.set("county", input.county);
    if (input.state) params.set("state", input.state);
    if (input.zip) params.set("zip", input.zip);
    if (input.sort) params.set("sort", input.sort);
    if (input.limit != null) params.set("limit", String(input.limit));
    if (input.offset != null) params.set("offset", String(input.offset));

    const url = `/api/business-providers/search?${params.toString()}`;

    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const detail = await safeErrorText(res);
      throw new Error(`Business provider search HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
    }

    const data = await res.json();
    const results = Array.isArray(data) ? data : data.contractors || [];

    return results.map((c: any) => ({
      id: String(c.id || c.userId || ""),
      name: String(c.companyName || c.name || c.businessName || "Unknown"),
      trade: String(c.trade || c.primaryTrade || ""),
      rating: typeof c.rating === "number" ? c.rating : 0,
      reviewCount: typeof c.reviewCount === "number" ? c.reviewCount : 0,
      location: String(c.location || c.city || c.county || ""),
      distance: typeof c.distance === "number" ? c.distance : undefined,
      availability: c.availability ? String(c.availability) : undefined,
      profileUrl:
        typeof c.canonicalBusinessProfileUrl === "string" && c.canonicalBusinessProfileUrl.trim()
          ? c.canonicalBusinessProfileUrl.trim()
          : typeof c.canonicalProfileUrl === "string" && c.canonicalProfileUrl.trim()
            ? c.canonicalProfileUrl.trim()
            : c.providerType === "business" && c.slug
              ? `/business/${encodeURIComponent(String(c.slug))}`
              : `/contractors/${c.id || c.userId}`,
    }));
  },
};

export async function searchContractors(
  input: ContractorSearchInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<ContractorSearchInput, ContractorResult[]>>> {
  return runTool(contractorSearchTool, input, context || {});
}

/* ======================== Marketplace Search Tool ======================== */

export interface MarketplaceSearchInput {
  query?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  location?: string;
  condition?: "new" | "used" | "any";
  verifiedOnly?: boolean;
  sortBy?: "price_asc" | "price_desc" | "recent" | "popular";
  limit?: number;
  offset?: number;
}

export interface MarketplaceResult {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  sellerName: string;
  imageUrl?: string;
  verified: boolean;
  listingUrl: string;
}

const marketplaceSearchTool: ToolDefinition<MarketplaceSearchInput, MarketplaceResult[]> = {
  name: "marketplace_search",
  description: "Search marketplace listings by query, category, price, and location",
  timeout: 12000,
  retries: 2,
  async execute(input, context) {
    const params = new URLSearchParams();

    if (input.query) params.set("query", input.query);
    if (input.category) params.set("category", input.category);
    if (input.priceMin != null) params.set("minPrice", String(input.priceMin));
    if (input.priceMax != null) params.set("maxPrice", String(input.priceMax));
    if (input.location) params.set("location", input.location);
    if (input.condition) params.set("condition", input.condition);
    if (input.verifiedOnly != null) params.set("verifiedOnly", String(input.verifiedOnly));
    if (input.sortBy) params.set("sortBy", input.sortBy);
    if (input.limit != null) params.set("limit", String(input.limit));
    if (input.offset != null) params.set("offset", String(input.offset));

    const url = `/api/marketplace/search?${params.toString()}`;

    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const detail = await safeErrorText(res);
      throw new Error(`Marketplace search HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
    }

    const data = await res.json();
    const results = Array.isArray(data) ? data : data.listings || [];

    return results.map((item: any) => ({
      id: String(item.id || ""),
      title: String(item.title || "Listing"),
      description: String(item.description || ""),
      price: typeof item.price === "number" ? item.price : 0,
      category: String(item.category || ""),
      condition: String(item.condition || "used"),
      location: String(item.location || ""),
      sellerName: String(item.sellerName || item.seller || ""),
      imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
      verified: Boolean(item.verified || item.isVerified),
      listingUrl: `/exchange/${item.id}`,
    }));
  },
};

export async function searchMarketplace(
  input: MarketplaceSearchInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<MarketplaceSearchInput, MarketplaceResult[]>>> {
  return runTool(marketplaceSearchTool, input, context || {});
}

/* ======================== Marketplace Listing Proposal (Pure) ======================== */

export interface MarketplaceListingProposalPayload {
  title: string;
  description?: string;
  price?: number;
  category?: string;
  images?: string[];
}

export interface MarketplaceListingProposal {
  type: "MARKETPLACE_LISTING_PROPOSAL";
  payload: MarketplaceListingProposalPayload & { proposedAt: number };
}

// Pure helper: Scout may propose a listing draft, but must not
// perform any writes. Actual persistence is owned by UI surfaces
// (e.g., Exchange sell tab) after explicit user confirmation.
export function proposeMarketplaceListing(
  input: MarketplaceListingProposalPayload
): MarketplaceListingProposal {
  return {
    type: "MARKETPLACE_LISTING_PROPOSAL",
    payload: {
      ...input,
      proposedAt: Date.now(),
    },
  };
}

/* ======================== Notes Proposal (Pure) ======================== */

export type NoteProposalPayload = {
  title?: string;
  body: string;
  relatedTo?: { type: "project" | "contact" | "listing"; id?: string };
};

export type NoteProposal = {
  type: "NOTE_PROPOSAL";
  payload: NoteProposalPayload & { proposedAt: number };
};

export function proposeNote(input: NoteProposalPayload): NoteProposal {
  return {
    type: "NOTE_PROPOSAL",
    payload: {
      ...input,
      proposedAt: Date.now(),
    },
  };
}

/* ======================== Projects Proposal (Pure) ======================== */

export type ProjectProposalPayload = {
  name: string;
  description?: string;
  budget?: number;
  timeline?: string;
};

export type ProjectProposal = {
  type: "PROJECT_PROPOSAL";
  payload: ProjectProposalPayload & { proposedAt: number };
};

export function proposeProject(input: ProjectProposalPayload): ProjectProposal {
  return {
    type: "PROJECT_PROPOSAL",
    payload: {
      ...input,
      proposedAt: Date.now(),
    },
  };
}

/* ======================== Affiliate & Promotion Proposals (Pure) ======================== */

export type AffiliateApplicationProposalPayload = {
  reason?: string;
  targetUrl?: string;
};

export type AffiliateApplicationProposal = {
  type: "AFFILIATE_APPLICATION_PROPOSAL";
  payload: AffiliateApplicationProposalPayload & { proposedAt: number };
};

export function proposeAffiliateApplication(
  input: AffiliateApplicationProposalPayload
): AffiliateApplicationProposal {
  return {
    type: "AFFILIATE_APPLICATION_PROPOSAL",
    payload: {
      ...input,
      proposedAt: Date.now(),
    },
  };
}

export type PromotionProposalPayload = {
  title: string;
  description?: string;
  category?: string;
  county?: string;
  state?: string;
  startsAt?: string;
  endsAt?: string;
};

export type PromotionProposal = {
  type: "PROMOTION_PROPOSAL";
  payload: PromotionProposalPayload & { proposedAt: number };
};

export function proposePromotion(input: PromotionProposalPayload): PromotionProposal {
  return {
    type: "PROMOTION_PROPOSAL",
    payload: {
      ...input,
      proposedAt: Date.now(),
    },
  };
}

/* ======================== Community Post Proposal (Pure) ======================== */

export type CommunityPostProposalPayload = {
  body: string;
  title?: string;
  category?: string;
  scope?: "county" | "hoa" | "neighborhood";
  county?: string;
  state?: string;
};

export type CommunityPostProposal = {
  type: "COMMUNITY_POST_PROPOSAL";
  payload: CommunityPostProposalPayload & { proposedAt: number };
};

export function proposeCommunityPost(input: CommunityPostProposalPayload): CommunityPostProposal {
  return {
    type: "COMMUNITY_POST_PROPOSAL",
    payload: {
      ...input,
      proposedAt: Date.now(),
    },
  };
}
