export type ContextRole =
  | "homeowner"
  | "contractor"
  | "project_manager"
  | "hoa_board"
  | "vendor"
  | "marketplace_vendor"
  | "admin"
  | "default";

export interface ContextSignals {
  message?: string;
  pagePath?: string | null;
  recentActions?: string[]; // simple string keys like "view_contractors", "post_listing"
  inferredCapabilities?: string[]; // e.g., ["can_send_invoice", "can_post_listing"]
}

export function inferContextRoles(signals: ContextSignals): ContextRole[] {
  const roles = new Set<ContextRole>();
  const msg = (signals.message || "").toLowerCase();
  const page = (signals.pagePath || "").toLowerCase();
  const actions = Array.isArray(signals.recentActions) ? signals.recentActions : [];
  const caps = Array.isArray(signals.inferredCapabilities) ? signals.inferredCapabilities : [];

  // Message heuristics
  if (/\b(invoice|estimate|bid|job|client|work order)\b/.test(msg)) {
    roles.add("contractor");
    roles.add("project_manager");
  }
  if (/\b(hoa|board|notice|bylaws|meeting|dues)\b/.test(msg)) {
    roles.add("hoa_board");
  }
  if (/\b(find|hire|quote|repair|plumber|electrician|roofer|hvac|landscaper|painter)\b/.test(msg)) {
    roles.add("homeowner");
  }
  if (/\b(post|list|deal|promo|discount|for sale|selling)\b/.test(msg)) {
    roles.add("vendor");
    roles.add("marketplace_vendor");
  }

  // Page heuristics
  if (page.startsWith("/contractors") || page.includes("contractor")) {
    roles.add("homeowner");
  }
  if (page.startsWith("/exchange") || page.includes("marketplace")) {
    roles.add("marketplace_vendor");
  }
  if (page.startsWith("/admin")) {
    roles.add("admin");
  }

  // Recent action signals
  if (actions.includes("send_invoice") || caps.includes("can_send_invoice")) {
    roles.add("contractor");
    roles.add("project_manager");
  }
  if (actions.includes("post_hoa_notice") || caps.includes("can_post_hoa_notice")) {
    roles.add("hoa_board");
  }
  if (actions.includes("post_listing") || caps.includes("can_post_listing")) {
    roles.add("marketplace_vendor");
    roles.add("vendor");
  }

  if (roles.size === 0) roles.add("default");
  return Array.from(roles);
}

export function deriveModeFromContextRoles(
  contextRoles: ContextRole[]
): "admin" | "marketplace" | "contractors" | "default" {
  const set = new Set(contextRoles);
  if (set.has("admin")) return "admin";
  if (set.has("marketplace_vendor") || set.has("vendor")) return "marketplace";
  if (set.has("contractor") || set.has("project_manager")) return "contractors";
  if (set.has("homeowner")) return "default";
  if (set.has("hoa_board")) return "default";
  return "default";
}
