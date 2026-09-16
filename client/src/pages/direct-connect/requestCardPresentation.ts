import type {
  DecisionContactGateNextActor,
  DecisionContactGateState,
  ReleasedContactPayload,
} from "@/components/ui/DecisionContactGatePanel";
import {
  DIRECT_CONNECT_REQUESTER_SUBMISSION_STATE,
  projectDirectConnectRequesterContactState,
} from "@shared/directConnectRequesterContact";

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
  // Old dispatch contact-approval states do not supersede the actual job stage.
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
  const normalized = projectDirectConnectRequesterContactState(contactGateState);
  if (normalized === "released") return "contact_released";
  return normalized as DirectConnectContactPanelState;
}

export function getDirectConnectContactGateSummary(request: DirectConnectRequestCardLike): string {
  const status = String(request.status || "").trim().toLowerCase();
  if (status === "draft") {
    return "Sending this request includes permission for its receiving providers to contact you about the work. This draft has not been sent.";
  }
  if (status === "cancelled") {
    return "This request is paused. Reopen it before sending it to more providers. Contact details already sent cannot be recalled.";
  }
  if (status === "completed") {
    return "This request is complete. Contact shared for it is for coordination about this work, not public disclosure.";
  }
  if (["denied", "closed"].includes(String(request.contactGateState || "").trim().toLowerCase())) {
    return "A contact restriction is recorded for this request. This status view does not remove restrictions or send new contact details.";
  }
  return "Submitting this request gives its assigned providers permission to contact you about this work. No additional contact approval is needed.";
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
  const state = normalizeDirectConnectContactState(contactState);
  if (state === DIRECT_CONNECT_REQUESTER_SUBMISSION_STATE) {
    return "Review provider replies or manage this request. There is no second contact-approval step.";
  }
  if (state === "contact_released") {
    return "Use the shared contact details to coordinate this request.";
  }
  if (state === "denied") {
    return "Contact was declined. Existing contact restrictions remain in place.";
  }
  if (state === "closed") {
    return "This contact workflow is closed.";
  }
  return "Review the request status before taking the next step.";
}

export function getDirectConnectContactGateNextActor(
  _contactState: DirectConnectContactPanelState
): DecisionContactGateNextActor {
  // Job responses still have their own next actor. This panel must not queue a
  // second requester or platform approval for submission-authorized contact.
  return "none";
}
