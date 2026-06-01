type DirectConnectRequestCardLike = {
  title?: string | null;
  description?: string | null;
  latestStatus?: string | null;
  status?: string | null;
  contactGateState?: string | null;
  dcConversationThreadId?: string | null;
  isHomeIdPreviewDraft?: boolean | null;
};

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
