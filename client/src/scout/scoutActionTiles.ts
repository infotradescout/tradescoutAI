/**
 * Scout Action Tiles
 * 
 * Defines the 4 core action tiles that replace prompt-based entry.
 * Tiles may have contextual variants based on deterministic user state.
 */

import type { ScoutAction } from "./state";

export type ScoutTileContext = {
  /** Active jobs/projects from API or cache */
  activeJobs: Array<{ id: string; name: string; status: string; updatedAt?: string | Date | null }>;
  /** Active invoices from API or cache */
  activeInvoices: Array<{ id: string; jobName?: string; status: string; amount?: number; updatedAt?: string | Date | null }>;
  /** Saved contractors from localStorage or API */
  savedContractors: Array<{ id: string; name: string; trade?: string }>;
  /** User's location label (e.g., "Pensacola, FL") */
  location?: string;
  /** Recent activity for soft signals (future use) */
  recentActivity?: Array<{ type: string; path: string; label?: string }>;
};

export type TileVariant = {
  /** Condition that must be true for this variant to apply (deterministic only) */
  when: (ctx: ScoutTileContext) => boolean;
  /** Override label if condition matches */
  label?: string | ((ctx: ScoutTileContext) => string);
  /** Override description if condition matches */
  description?: string | ((ctx: ScoutTileContext) => string);
};

export type ScoutActionTile = {
  /** Stable intent ID (never changes) */
  id: string;
  /** Default label */
  label: string;
  /** Default description */
  description: string;
  /** Action to execute (navigation, tool call, etc.) */
  action: ScoutAction;
  /** Optional contextual variants (deterministic only) */
  variants?: TileVariant[];
};

/**
 * Core action tiles (4 capability-aligned entry points).
 * Variants adapt labels based on deterministic user state.
 * 
 * PROVENANCE RULE:
 * Every variant MUST document its data source with a comment.
 * No variant may trigger on heuristics, LLM output, or "probably."
 */
export const scoutActionTiles: ScoutActionTile[] = [
  {
    id: "start_project",
    label: "Start a local project",
    description: "Post a project and get quotes from verified contractors",
    action: { type: "NAVIGATE", to: "/request-quote" },
    variants: [
      {
        // Proven by: GET /api/dashboard → myProjects (when count === 1)
        // Freshness rule: only apply if last update within 14 days
        when: (ctx) => {
          if (ctx.activeJobs.length !== 1) return false;
          const job = ctx.activeJobs[0];
          const updated = job.updatedAt ? new Date(job.updatedAt).getTime() : null;
          if (!updated) return false;
          const days14 = 14 * 24 * 60 * 60 * 1000;
          return Date.now() - updated <= days14;
        },
        label: (ctx) => `Continue project: ${ctx.activeJobs[0].name}`,
        description: "Resume where you left off",
      },
      {
        // Proven by: GET /api/dashboard → myProjects (when count > 1)
        when: (ctx) => ctx.activeJobs.length > 1,
        label: (ctx) => `View ${ctx.activeJobs.length} active projects`,
        description: "Manage your ongoing work",
      },
    ],
  },
  {
    id: "find_pros",
    label: "Find local professionals",
    description: "Search contractors, vendors, and service providers",
    action: { type: "NAVIGATE", to: "/contractors" },
    variants: [
      {
        // Proven by: User's geo context (heroLocationLabel from session)
        when: (ctx) => !!ctx.location && ctx.location.length > 0,
        label: (ctx) => `Find professionals near ${ctx.location}`,
        description: "Search contractors and vendors in your area",
      },
      {
        // Proven by: GET /api/saved-contractors (when array.length > 0)
        when: (ctx) => ctx.savedContractors.length > 0,
        label: (ctx) => `View ${ctx.savedContractors.length} saved contractor${ctx.savedContractors.length > 1 ? 's' : ''}`,
        description: "Access your saved professionals",
      },
    ],
  },
  {
    id: "nearby",
    label: "See what's happening nearby",
    description: "Browse community posts, events, and marketplace listings",
    action: { type: "NAVIGATE", to: "/community" },
    variants: [
      {
        // Proven by: User's geo context (heroLocationLabel from session)
        when: (ctx) => !!ctx.location && ctx.location.length > 0,
        label: (ctx) => `See what's happening in ${ctx.location}`,
        description: "Community updates and local marketplace",
      },
    ],
  },
  {
    id: "manage",
    label: "Manage projects or invoices",
    description: "Track jobs, payments, and financial records",
    action: { type: "NAVIGATE", to: "/deal-room" },
    variants: [
      {
        // Proven by: GET /api/invoices → active invoices (when count === 1) AND fresh within 14 days
        when: (ctx) => {
          if (ctx.activeInvoices.length !== 1) return false;
          const inv = ctx.activeInvoices[0];
          const updated = inv.updatedAt ? new Date(inv.updatedAt).getTime() : null;
          if (!updated) return false;
          const days14 = 14 * 24 * 60 * 60 * 1000;
          return Date.now() - updated <= days14;
        },
        label: (ctx) => `Continue invoice for ${ctx.activeInvoices[0].jobName ?? "your project"}`,
        description: "Resume where you left off",
      },
      {
        // Proven by: GET /api/invoices → active invoices (when count > 1)
        when: (ctx) => ctx.activeInvoices.length > 1,
        label: (ctx) => `View ${ctx.activeInvoices.length} active invoices`,
        description: "Manage your pending payments",
      },
      {
        // Proven by: GET /api/dashboard → myProjects + no active invoices
        when: (ctx) => ctx.activeJobs.length > 0 && ctx.activeInvoices.length === 0,
        label: "View active projects",
        description: "Track your ongoing work",
      },
    ],
  },
];
