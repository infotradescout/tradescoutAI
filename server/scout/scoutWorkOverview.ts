import type { ScoutWorkItem, ScoutWorkKind, ScoutWorkOverview, ScoutWorkSection, ScoutWorkState } from "../../shared/scoutWork";

export interface ScoutWorkDatabase {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const PAGE_SIZE = 8;
const SOURCES: Array<{ kind: ScoutWorkKind; label: string; workspace: string; sql: string }> = [
  {
    kind: "requests", label: "Your local requests", workspace: "/direct-connect/active",
    sql: `SELECT id, title, status, county_fips, updated_at FROM work_requests
      WHERE created_by_user_id = $1 ORDER BY updated_at DESC NULLS LAST, id ASC LIMIT $2`,
  },
  {
    kind: "supply_runs", label: "Your supply runs", workspace: "/utilities/supply-run",
    sql: `SELECT id, order_number, status, updated_at FROM procurement_orders
      WHERE user_id = $1 ORDER BY updated_at DESC NULLS LAST, id ASC LIMIT $2`,
  },
  {
    kind: "home_projects", label: "Your home projects", workspace: "/homes",
    sql: `SELECT p.id, p.title, p.status, p.user_home_id, p.updated_at FROM home_projects p
      JOIN user_homes h ON h.id = p.user_home_id AND h.owner_user_id = $1
      WHERE p.owner_user_id = $1 ORDER BY p.updated_at DESC NULLS LAST, p.id ASC LIMIT $2`,
  },
  {
    kind: "scout_actions", label: "Scout action results", workspace: "/profile-settings",
    sql: `SELECT execution_id AS id, status, COALESCE(completed_at, created_at) AS updated_at,
      (result->>'executed' = 'true' AND result->>'action' = 'SAVE_PROFILE'
        AND result->>'userId' = $1) AS execution_confirmed
      FROM scout_execution_receipts WHERE owner_user_id = $1 AND action_type = 'SAVE_PROFILE'
      ORDER BY COALESCE(completed_at, created_at) DESC NULLS LAST, execution_id ASC LIMIT $2`,
  },
];

function cleanText(value: unknown, fallback: string, limit = 160): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ").trim().slice(0, limit) || fallback;
}
function timestamp(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function statusCopy(kind: ScoutWorkKind, status: string, confirmed: boolean): {
  state: ScoutWorkState; statusLabel: string; detail: string;
} {
  if (kind === "scout_actions") {
    return status === "completed" && confirmed
      ? { state: "complete", statusLabel: "Saved", detail: "Your approved profile update was saved. Review your current profile." }
      : { state: "attention", statusLabel: "Check result", detail: "Completion is not confirmed. Check your profile before making another change. Scout will not repeat this action automatically." };
  }
  if (["cancelled", "canceled", "archived", "closed"].includes(status)) {
    return { state: "closed", statusLabel: "Closed", detail: "This item is marked closed. Open its workspace to review the record." };
  }
  if (status === "completed" || status === "complete") {
    return { state: "complete", statusLabel: "Marked completed", detail: "The owning workspace marks this item completed. Open it to review the result." };
  }
  if (status === "draft" || status === "planning") {
    return { state: "attention", statusLabel: status === "draft" ? "Draft saved" : "Planning",
      detail: kind === "requests" ? "Review your saved request before sharing or choosing a provider." : "Continue the saved plan in its workspace." };
  }
  if (status === "pending_outcome") {
    return { state: "attention", statusLabel: "Outcome needs review", detail: "Review the reported outcome before marking the work complete." };
  }
  if (["awaiting_approval", "pending_approval", "quoted", "quote_ready"].includes(status)) {
    return { state: "attention", statusLabel: "Review needed", detail: "Open the current details and decide whether to approve the next step." };
  }
  if (status === "paused" || status === "saving") {
    return { state: "attention", statusLabel: status === "paused" ? "Paused" : "Saving toward project", detail: "Review your plan and choose the next step when ready." };
  }
  const activeLabels: Record<string, string> = {
    open: "Open", submitted: "Submitted", routed: "Shared for responses", accepted: "Accepted",
    assigned: "Assigned", scheduled: "Scheduled", in_progress: "In progress", ready: "Ready for next step",
    approved: "Approved", sourcing: "Finding materials", purchasing: "Purchasing", dispatched: "Dispatched",
    picked_up: "Picked up", out_for_delivery: "Out for delivery", delivered: "Marked delivered",
  };
  if (activeLabels[status]) return { state: "active", statusLabel: activeLabels[status], detail: "Open this item to review its latest details and available next steps." };
  return { state: "unknown", statusLabel: "Review status", detail: "Open the owning workspace to check the current status. Scout has not marked this completed." };
}

export function projectScoutWorkItem(kind: ScoutWorkKind, row: Record<string, unknown>): ScoutWorkItem | null {
  if (typeof row.id !== "string" || !row.id.trim() || row.id.length > 160) return null;
  const id = row.id;
  const status = typeof row.status === "string" ? row.status.toLowerCase() : "";
  let title = cleanText(row.title, kind === "home_projects" ? "Home project" : "Local request");
  let to: string;
  let label: string;
  if (kind === "requests") {
    const params = new URLSearchParams({ selected: id, filter: "all" });
    if (typeof row.county_fips === "string" && /^\d{5}$/.test(row.county_fips)) params.set("county", row.county_fips);
    to = `/direct-connect/active?${params}`; label = "Open request";
  } else if (kind === "supply_runs") {
    title = `Supply run ${cleanText(row.order_number, "", 50)}`.trim();
    to = `/utilities/supply-run/${encodeURIComponent(id)}`; label = "Open supply run";
  } else if (kind === "home_projects") {
    if (typeof row.user_home_id !== "string" || !row.user_home_id.trim()) return null;
    to = `/homes?${new URLSearchParams({ homeId: row.user_home_id, projectId: id })}`; label = "Continue project";
  } else {
    title = "Profile update"; to = "/profile-settings"; label = "Check profile";
  }
  return { id, kind, title, ...statusCopy(kind, status, row.execution_confirmed === true),
    updatedAt: timestamp(row.updated_at), nextAction: { label, to } };
}

/** Each source is bounded and owner-filtered. One failed source is not an empty workspace. */
export async function loadScoutWorkOverview(ownerId: string, database: ScoutWorkDatabase): Promise<ScoutWorkOverview> {
  if (!ownerId.trim() || ownerId.length > 200) throw new Error("Authenticated owner required");
  const sections: ScoutWorkSection[] = await Promise.all(SOURCES.map(async (source) => {
    const section = { kind: source.kind, label: source.label, workspace: source.workspace };
    try {
      const { rows } = await database.query(source.sql, [ownerId, PAGE_SIZE + 1]);
      const items = rows.slice(0, PAGE_SIZE).flatMap((row) => {
        const item = projectScoutWorkItem(source.kind, row);
        return item ? [item] : [];
      });
      return { ...section, availability: "ready" as const, items, hasMore: rows.length > PAGE_SIZE };
    } catch {
      // Do not expose SQL errors, private fields or provider diagnostics.
      return { ...section, availability: "unavailable" as const, items: [], hasMore: false };
    }
  }));
  return { contractVersion: "scout_work.v1", ownerId, checkedAt: new Date().toISOString(),
    partial: sections.some((section) => section.availability === "unavailable"), sections };
}
