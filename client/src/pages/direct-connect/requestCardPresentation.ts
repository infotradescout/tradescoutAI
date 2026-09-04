import type {
  DecisionContactGateNextActor,
  DecisionContactGateState,
  ReleasedContactPayload,
} from "@/components/ui/DecisionContactGatePanel";

export type DirectConnectRequestCardLike = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  latestStatus?: string | null;
  status?: string | null;
  contactGateState?: string | null;
  releasedContact?: ReleasedContactPayload | null;
  dcConversationThreadId?: string | null;
  isHomeIdPreviewDraft?: boolean | null;
  countyLabel?: string | null;
  budgetMin?: string | number | null;
  budgetMax?: string | number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export type DirectConnectRequestCardView = {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
  countyLabel?: string;
  budgetLabel?: string;
  updatedLabel: string;
};

export type DirectConnectContactPanelState = DecisionContactGateState | (string & {});

type RequestWorkflowStage =
  | "draft_ready"
  | "submitted"
  | "ready_to_send"
  | "waiting_on_pros"
  | "active_conversation"
  | "pending_outcome"
  | "completed"
  | "cancelled";

function getRequestWorkflowStage(request: DirectConnectRequestCardLike): RequestWorkflowStage {
  const status = String(request.status || "open").toLowerCase();
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "pending_outcome") return "pending_outcome";
  if (status === "draft") return "draft_ready";
  if (status === "in_progress" || Boolean(request.dcConversationThreadId))
    return "active_conversation";
  if (status === "routed") return "waiting_on_pros";
  if (status === "open") return "submitted";
  return "ready_to_send";
}

function humanizeEnumLikeText(value: string): string {
  const cleaned = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  if (!cleaned) return "";
  if (cleaned === "single family") return "single-family home";
  return cleaned;
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function looksLikeHiddenOrTestRequest(request: DirectConnectRequestCardLike): boolean {
  const title = String(request.title || "").toLowerCase();
  const description = String(request.description || "").toLowerCase();
  const body = `${title} ${description}`;
  if (request.isHomeIdPreviewDraft) return true;
  if (body.includes("[hidden]")) return true;
  const markers = [
    "playwright",
    "smoke test",
    "e2e test",
    "qa test",
    "test request",
    "integration test",
    "prepared from homeid request preview",
    "prepared from homeid handoff preview",
  ];
  return markers.some((marker) => body.includes(marker));
}

export function getDisplayRequestTitle(request: DirectConnectRequestCardLike): string {
  const raw = String(request.title || "").trim();
  if (!raw) return "Service request";
  if (/inspection request for single[_\s-]?family/i.test(raw)) return "Home inspection request";
  return raw.replace(/\bsingle[_\s-]?family\b/gi, "single-family home");
}

export function getDisplayRequestDescription(request: DirectConnectRequestCardLike): string {
  const raw = String(request.description || "").trim();
  if (!raw) return "";
  if (/prepared from homeid (request|handoff) preview\.?/i.test(raw)) {
    return "Direct Connect is preparing this request for local providers.";
  }
  const withoutInternal = raw
    .replace(/prepared from homeid (request|handoff) preview\.?/gi, "")
    .trim();
  return withoutInternal;
}

export function getDisplayLatestStatus(request: DirectConnectRequestCardLike): string | null {
  if (String(request.contactGateState || "").toLowerCase() === "contractor_requested") {
    return "Review contact request";
  }
  const stage = getRequestWorkflowStage(request);
  if (stage === "draft_ready") return "Draft ready";
  if (stage === "submitted") return "Submitted";
  if (stage === "ready_to_send") return "Ready to send";
  if (stage === "waiting_on_pros") return "Waiting on pros";
  if (stage === "active_conversation") return "Provider responded";
  if (stage === "pending_outcome") return "Choose next step";
  if (stage === "completed") return "Completed";
  if (stage === "cancelled") return "Cancelled";
  const raw = String(request.latestStatus || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/local businesses/gi, "pros");
  return toTitleCase(humanizeEnumLikeText(cleaned));
}

function formatBudgetValue(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatUpdatedLabel(value: string | Date | null | undefined): string {
  if (!value) return "Recently";
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Recently";
  return parsed.toLocaleDateString();
}

export function buildDirectConnectRequestCardView(
  request: DirectConnectRequestCardLike,
  statusLabelOverride?: string | null
): DirectConnectRequestCardView {
  const min = formatBudgetValue(request.budgetMin);
  const max = formatBudgetValue(request.budgetMax);
  const budgetLabel = min && max ? `${min}–${max}` : min || max || undefined;
  return {
    id: String(request.id || "request"),
    title: getDisplayRequestTitle(request),
    description: getDisplayRequestDescription(request),
    statusLabel: statusLabelOverride || getDisplayLatestStatus(request) || "Submitted",
    countyLabel: String(request.countyLabel || "").trim() || undefined,
    budgetLabel,
    updatedLabel: formatUpdatedLabel(request.updatedAt || request.createdAt),
  };
}

export function normalizeDirectConnectContactState(
  contactGateState?: string | null
): DirectConnectContactPanelState {
  const normalized = String(contactGateState || "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "locked" || normalized === "review_required") {
    return "contact_hidden";
  }
  if (normalized === "request_shared") return "contact_hidden";
  if (normalized === "contractor_requested") return "provider_requested_contact";
  if (normalized === "provider_requested_contact") return "provider_requested_contact";
  if (normalized === "user_approved") return "requester_approved";
  if (normalized === "requester_approved") return "requester_approved";
  if (normalized === "released") return "contact_released";
  if (normalized === "contact_released") return "contact_released";
  if (normalized === "denied") return "denied";
  if (normalized === "closed") return "closed";
  return normalized as string & {};
}

export function getDirectConnectContactGateSummary(_request: DirectConnectRequestCardLike): string {
  return "Your name and phone are shared with the exact assigned recipients when you send the request. Email and address stay private.";
}

export function getDirectConnectReleasedContactForPanel(
  request: DirectConnectRequestCardLike,
  contactState: DirectConnectContactPanelState
): ReleasedContactPayload | undefined {
  if (contactState !== "contact_released") return undefined;
  const releasedContact = request.releasedContact;
  if (!releasedContact || typeof releasedContact !== "object") return undefined;
  const sanitized = {
    name: String(releasedContact.name || "").trim() || undefined,
    phone: String(releasedContact.phone || "").trim() || undefined,
    email: String(releasedContact.email || "").trim() || undefined,
    address: String(releasedContact.address || "").trim() || undefined,
    notes: String(releasedContact.notes || "").trim() || undefined,
  };
  return Object.values(sanitized).some(Boolean) ? sanitized : undefined;
}

export function getDirectConnectContactGateNextAction(
  contactState: DirectConnectContactPanelState
): string {
  if (contactState === "provider_requested_contact") {
    return "Review the provider contact request and approve or decline.";
  }
  if (contactState === "requester_approved") {
    return "Release contact only through the approved TradeScout path.";
  }
  if (contactState === "contact_released") {
    return "Use the released contact path for coordination.";
  }
  if (contactState === "denied") {
    return "Contact was declined. Private contact remains hidden.";
  }
  if (contactState === "closed") {
    return "This contact workflow is closed.";
  }
  if (contactState === "contact_hidden") {
    return "Wait for a valid provider contact request or continue review.";
  }
  return "Review the request status before taking the next step.";
}

export function getDirectConnectContactGateNextActor(
  contactState: DirectConnectContactPanelState
): DecisionContactGateNextActor {
  if (contactState === "provider_requested_contact") return "requester";
  if (contactState === "requester_approved") return "platform";
  if (contactState === "contact_hidden") return "provider";
  return "none";
}
