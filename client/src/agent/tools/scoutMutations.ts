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

/* ======================== Notes (Mutating) ======================== */

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
      const detail = await safeErrorText(res);
      throw new Error(`Create note HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
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

/* ======================== Projects (Mutating) ======================== */

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
  description: "Create a project record for the user (contractor-only context)",
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
      const detail = await safeErrorText(res);
      throw new Error(`Create project HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
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

/* ======================== Affiliate & Promotion (Mutating) ======================== */

export interface AffiliateEnrollInput {
  userId?: string;
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
      const detail = await safeErrorText(res);
      throw new Error(`Affiliate enroll HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
    }

    const data = await res.json().catch(() => ({}) as any);
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

export interface AffiliateLinkInput {
  destination: string;
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
      const detail = await safeErrorText(res);
      throw new Error(`Affiliate link HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
    }

    const data = await res.json().catch(() => ({}) as any);
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

export interface AffiliateReferralLogInput {
  affiliateId: string;
  action: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export interface AffiliateReferralLogResult {
  success: boolean;
}

const affiliateReferralLogTool: ToolDefinition<
  AffiliateReferralLogInput,
  AffiliateReferralLogResult
> = {
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
    const data = await res.json().catch(() => ({}) as any);
    return { promotionId: String(data.promotionId || data.id || "") };
  },
};

export async function createPromotion(
  input: PromotionCreateInput,
  context?: ToolContext
): Promise<ReturnType<typeof runTool<PromotionCreateInput, PromotionCreateResult>>> {
  return runTool(promotionCreateTool, input, context || {});
}

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
    const data = await res.json().catch(() => ({}) as any);
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
