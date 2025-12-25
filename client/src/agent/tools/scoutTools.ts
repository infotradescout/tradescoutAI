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
