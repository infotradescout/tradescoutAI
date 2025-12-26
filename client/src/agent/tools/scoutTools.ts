/**
 * Typed tool wrappers for Scout agent.
 * Each tool has retries, timeouts, and telemetry built in.
 */

import { runTool, ToolDefinition, ToolContext } from "./toolRunner";

/* ======================== Contractor Search Tool ======================== */

export interface ContractorSearchInput {
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

    if (input.trade) params.set("trade", input.trade);
    if (input.county) params.set("county", input.county);
    if (input.state) params.set("state", input.state);
    if (input.zip) params.set("zip", input.zip);
    if (input.sort) params.set("sort", input.sort);
    if (input.limit != null) params.set("limit", String(input.limit));
    if (input.offset != null) params.set("offset", String(input.offset));

    const url = `/api/contractors/search?${params.toString()}`;

    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Contractor search HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const data = await res.json();
    const results = Array.isArray(data) ? data : data.contractors || [];

    return results.map((c: any) => ({
      id: String(c.id || c.userId || ""),
      name: String(c.name || c.businessName || "Unknown"),
      trade: String(c.trade || c.primaryTrade || ""),
      rating: typeof c.rating === "number" ? c.rating : 0,
      reviewCount: typeof c.reviewCount === "number" ? c.reviewCount : 0,
      location: String(c.location || c.city || c.county || ""),
      distance: typeof c.distance === "number" ? c.distance : undefined,
      availability: c.availability ? String(c.availability) : undefined,
      profileUrl: `/contractors/${c.id || c.userId}`,
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
      throw new Error(`Marketplace search HTTP ${res.status}: ${await res.text().catch(() => "")}`);
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

/* ======================== Marketplace Post Tool ======================== */

export interface MarketplacePostInput {
  title: string;
  description?: string;
  price: number;
  category?: string;
}

export interface MarketplacePostResult {
  id?: string;
  title: string;
  price: number;
  category?: string;
  status: "created" | "drafted";
}

const marketplacePostTool: ToolDefinition<MarketplacePostInput, MarketplacePostResult> = {
  name: "marketplace_post",
  description: "Create a new marketplace listing via assistant action, with safe fallback",
  timeout: 12000,
  retries: 1,
  async execute(input, context) {
    // First attempt: call assistant guarded action endpoint if available
    try {
      const res = await fetch("/api/assistant/execute-action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: {
            type: "list_item",
            params: {
              title: input.title,
              description: input.description,
              price: input.price,
              category: input.category,
            },
          },
          guardContext: {
            intent: "marketplace_post",
            sessionId: context.sessionId,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({} as any));
        // Some servers return { success, data } others may proxy a generic message
        const data = json?.data || json;
        const listingId = String(data?.id || data?.listingId || "").trim();
        return {
          id: listingId || undefined,
          title: input.title,
          price: input.price,
          category: input.category,
          status: listingId ? "created" : "drafted",
        };
      }

      // Non-200: fall through to fallback logic
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      // Fallback: return a draft result; UI should navigate to Exchange to finish
      return {
        id: undefined,
        title: input.title,
        price: input.price,
        category: input.category,
        status: "drafted",
      };
    }
  },
};

export async function postMarketplaceListing(
  input: MarketplacePostInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<MarketplacePostInput, MarketplacePostResult>>> {
  return runTool(marketplacePostTool, input, context || {});
}

/* ======================== Notes Tool ======================== */

export interface CreateNoteInput {
  title?: string;
  content: string;
  type?: "quick" | "project" | "meeting" | "reminder";
  tags?: string[];
  relatedJobId?: string;
}

export interface NoteResult {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  noteUrl: string;
}

const createNoteTool: ToolDefinition<CreateNoteInput, NoteResult> = {
  name: "create_note",
  description: "Create a new note for the user",
  timeout: 8000,
  retries: 2,
  async execute(input, context) {
    const res = await fetch("/api/notes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title || "Scout Note",
        content: input.content,
        type: input.type || "quick",
        tags: input.tags || [],
        relatedJobId: input.relatedJobId,
        source: "scout",
      }),
    });

    if (!res.ok) {
      throw new Error(`Create note HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const note = await res.json();

    return {
      id: String(note.id || ""),
      title: String(note.title || ""),
      content: String(note.content || ""),
      type: String(note.type || "quick"),
      createdAt: String(note.createdAt || new Date().toISOString()),
      noteUrl: `/notes#${note.id}`,
    };
  },
};

export async function createNote(
  input: CreateNoteInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<CreateNoteInput, NoteResult>>> {
  return runTool(createNoteTool, input, context || {});
}

/* ======================== Projects Tool ======================== */

export interface CreateProjectInput {
  title: string;
  description: string;
  trade?: string;
  budget?: number;
  timeline?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

export interface ProjectResult {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  projectUrl: string;
}

const createProjectTool: ToolDefinition<CreateProjectInput, ProjectResult> = {
  name: "create_project",
  description: "Create a trackable project for the user",
  timeout: 10000,
  retries: 2,
  async execute(input, context) {
    const res = await fetch("/api/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        trade: input.trade,
        budget: input.budget,
        timeline: input.timeline,
        priority: input.priority || "medium",
        source: "scout",
      }),
    });

    if (!res.ok) {
      throw new Error(`Create project HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const project = await res.json();

    return {
      id: String(project.id || project.jobId || ""),
      title: String(project.title || ""),
      description: String(project.description || ""),
      status: String(project.status || "pending"),
      createdAt: String(project.createdAt || new Date().toISOString()),
      projectUrl: `/deal-room/${project.id || project.jobId}`,
    };
  },
};

export async function createProject(
  input: CreateProjectInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<CreateProjectInput, ProjectResult>>> {
  return runTool(createProjectTool, input, context || {});
}

/* ======================== Affiliate Tools (Phase 1) ======================== */

/**
 * AFFILIATE_ENROLL
 * Purpose: Make this user an affiliate (idempotent)
 * Proven by: POST /api/affiliate/enroll
 */
export interface AffiliateEnrollInput {
  userId?: string; // optional; server can infer from session
}

export interface AffiliateEnrollResult {
  affiliateId: string;
  status: "active" | "pending" | "disabled";
}

const affiliateEnrollTool: ToolDefinition<AffiliateEnrollInput, AffiliateEnrollResult> = {
  name: "affiliate_enroll",
  description: "Enroll the current user into the affiliate program (idempotent)",
  timeout: 8000,
  retries: 1,
  async execute(input, context) {
    const res = await fetch("/api/affiliate/enroll", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: input.userId }),
    });

    if (!res.ok) {
      throw new Error(`Affiliate enroll HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const data = await res.json().catch(() => ({} as any));
    return {
      affiliateId: String(data.affiliateId || data.id || ""),
      status: (data.status as any) || "active",
    };
  },
};

export async function enrollAffiliate(
  input: AffiliateEnrollInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<AffiliateEnrollInput, AffiliateEnrollResult>>> {
  return runTool(affiliateEnrollTool, input, context || {});
}

/**
 * AFFILIATE_LINK_GENERATE
 * Input: destination (profile, listing, deal)
 * Output: canonical referral URL
 * Proven by: POST /api/affiliate/link
 */
export interface AffiliateLinkInput {
  destination: string; // e.g. "/contractors/123" or "/exchange/abc"
  entityId?: string;
}

export interface AffiliateLinkResult {
  url: string;
}

const affiliateLinkTool: ToolDefinition<AffiliateLinkInput, AffiliateLinkResult> = {
  name: "affiliate_link_generate",
  description: "Generate a canonical referral URL for an affiliate",
  timeout: 6000,
  retries: 1,
  async execute(input, context) {
    const res = await fetch("/api/affiliate/link", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: input.destination, entityId: input.entityId }),
    });

    if (!res.ok) {
      throw new Error(`Affiliate link HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const data = await res.json().catch(() => ({} as any));
    const url: string = String(data.url || "");
    return { url };
  },
};

export async function generateAffiliateLink(
  input: AffiliateLinkInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<AffiliateLinkInput, AffiliateLinkResult>>> {
  return runTool(affiliateLinkTool, input, context || {});
}

/**
 * AFFILIATE_REFERRAL_LOG
 * Internal only; safe fallback on failure (does not throw)
 * Proven by: POST /api/affiliate/referral
 */
export interface AffiliateReferralLogInput {
  affiliateId: string;
  action: string; // e.g. "listing_view", "contractor_contact", "deal_redeem"
  entityId?: string;
  meta?: Record<string, unknown>;
}

export interface AffiliateReferralLogResult {
  success: boolean;
}

const affiliateReferralLogTool: ToolDefinition<AffiliateReferralLogInput, AffiliateReferralLogResult> = {
  name: "affiliate_referral_log",
  description: "Log an attributed action for affiliate tracking (non-throwing)",
  timeout: 4000,
  retries: 0,
  async execute(input, context) {
    try {
      const res = await fetch("/api/affiliate/referral", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateId: input.affiliateId,
          action: input.action,
          entityId: input.entityId,
          meta: input.meta || {},
        }),
      });
      if (!res.ok) return { success: false };
      return { success: true };
    } catch {
      return { success: false };
    }
  },
};

export async function logAffiliateReferral(
  input: AffiliateReferralLogInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<AffiliateReferralLogInput, AffiliateReferralLogResult>>> {
  return runTool(affiliateReferralLogTool, input, context || {});
}

/* ======================== Promotion Tools (Phase 2) ======================== */

/**
 * PROMOTION_CREATE
 * Scope-limited (county + category), requires capability
 * Proven by: POST /api/promotions
 */
export interface PromotionCreateInput {
  title: string;
  description: string;
  category: string;
  county: string;
  state: string;
  startsAt?: string;
  endsAt?: string;
}

export interface PromotionCreateResult {
  promotionId: string;
}

const promotionCreateTool: ToolDefinition<PromotionCreateInput, PromotionCreateResult> = {
  name: "promotion_create",
  description: "Create a scoped promotion for a verified business",
  timeout: 10000,
  retries: 1,
  async execute(input, context) {
    const res = await fetch("/api/promotions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(`Promotion create HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const data = await res.json().catch(() => ({} as any));
    return { promotionId: String(data.promotionId || data.id || "") };
  },
};

export async function createPromotion(
  input: PromotionCreateInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<PromotionCreateInput, PromotionCreateResult>>> {
  return runTool(promotionCreateTool, input, context || {});
}

/**
 * PROMOTION_TRACK
 * Read impressions/actions for Scout performance explanations
 * Proven by: GET /api/promotions/:id/metrics
 */
export interface PromotionTrackInput {
  promotionId: string;
}

export interface PromotionMetricsResult {
  impressions: number;
  actions: number;
}

const promotionTrackTool: ToolDefinition<PromotionTrackInput, PromotionMetricsResult> = {
  name: "promotion_track",
  description: "Track promotion performance (impressions/actions)",
  timeout: 6000,
  retries: 1,
  async execute(input, context) {
    const res = await fetch(`/api/promotions/${encodeURIComponent(input.promotionId)}/metrics`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Promotion metrics HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const data = await res.json().catch(() => ({} as any));
    return {
      impressions: typeof data.impressions === "number" ? data.impressions : 0,
      actions: typeof data.actions === "number" ? data.actions : 0,
    };
  },
};

export async function trackPromotion(
  input: PromotionTrackInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<PromotionTrackInput, PromotionMetricsResult>>> {
  return runTool(promotionTrackTool, input, context || {});
}
