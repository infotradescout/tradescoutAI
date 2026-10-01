import { adminSourceState } from "@/admin/adminQueueState";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const id = (value: unknown): value is string => text(value) && value.trim().length > 0;
const nullable = (value: unknown) => value === null || value === undefined || text(value);
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const optionalText = (value: unknown): string | null => (text(value) ? value : null);
const invalid = (): never => {
  throw new Error("The source returned invalid request evidence. Refresh to try again.");
};

export type QueueItem = {
  id: string;
  title: string;
  status: string | null;
  category: string | null;
  createdAt: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
  profileSlug: string | null;
  businessName: string | null;
  assignmentCount: number;
  responseCount: number;
};
export type QueueResponse = { requests: QueueItem[]; hasMore: boolean; nextOffset: number | null };
export function parseRequestQueue(value: unknown, offset: number): QueueResponse {
  if (!record(value) || !Array.isArray(value.requests) || typeof value.hasMore !== "boolean")
    return invalid();
  const requests = value.requests.map((row): QueueItem => {
    const fields = [
      "status",
      "category",
      "createdAt",
      "requesterEmail",
      "requesterName",
      "profileSlug",
      "businessName",
    ];
    if (
      !record(row) ||
      !id(row.id) ||
      !text(row.title) ||
      !fields.every((field) => nullable(row[field])) ||
      !count(row.assignmentCount) ||
      !count(row.responseCount)
    )
      return invalid();
    return {
      id: row.id,
      title: row.title,
      status: optionalText(row.status),
      category: optionalText(row.category),
      createdAt: optionalText(row.createdAt),
      requesterEmail: optionalText(row.requesterEmail),
      requesterName: optionalText(row.requesterName),
      profileSlug: optionalText(row.profileSlug),
      businessName: optionalText(row.businessName),
      assignmentCount: row.assignmentCount as number,
      responseCount: row.responseCount as number,
    };
  });
  if (
    new Set(requests.map((row) => row.id)).size !== requests.length ||
    (value.hasMore
      ? !count(value.nextOffset) ||
        value.nextOffset !== offset + requests.length ||
        requests.length === 0
      : value.nextOffset !== null)
  )
    return invalid();
  return { requests, hasMore: value.hasMore, nextOffset: value.nextOffset as number | null };
}

export type RequestDetail = {
  request: {
    id: string;
    title: string;
    description: string;
    category: string | null;
    countyFips: string | null;
    status: string | null;
    source: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  requester: { id: string; name: string | null; contactVisibility: "withheld" } | null;
  originatingProfile: {
    id: string;
    slug: string;
    businessName: string;
    ownerUserId: string;
  } | null;
  assignments: Array<{
    id: string;
    status: string | null;
    responderUserId: string | null;
    responderName: string | null;
    createdAt: string | null;
  }>;
  events: Array<{ id: string; type: string; createdAt: string | null }>;
  conversationId: string | null;
};
export function parseRequestDetail(value: unknown, requestId: string): RequestDetail {
  if (
    !record(value) ||
    !record(value.request) ||
    value.request.id !== requestId ||
    !id(requestId) ||
    !text(value.request.title) ||
    !text(value.request.description) ||
    !["category", "countyFips", "status", "source", "createdAt", "updatedAt"].every((field) =>
      nullable((value.request as RecordValue)[field])
    ) ||
    !Array.isArray(value.assignments) ||
    !Array.isArray(value.events) ||
    !nullable(value.conversationId)
  )
    return invalid();
  if (
    value.requester !== null &&
    (!record(value.requester) ||
      !id(value.requester.id) ||
      !nullable(value.requester.name) ||
      value.requester.contactVisibility !== "withheld")
  )
    return invalid();
  if (
    value.originatingProfile !== null &&
    (!record(value.originatingProfile) ||
      !["id", "slug", "businessName", "ownerUserId"].every((field) =>
        text((value.originatingProfile as RecordValue)[field])
      ))
  )
    return invalid();
  if (
    !value.assignments.every(
      (row) =>
        record(row) &&
        id(row.id) &&
        ["status", "responderUserId", "responderName", "createdAt"].every((field) =>
          nullable(row[field])
        )
    ) ||
    !value.events.every(
      (row) => record(row) && id(row.id) && text(row.type) && nullable(row.createdAt)
    )
  )
    return invalid();
  return value as unknown as RequestDetail;
}

export type Provider = { id: string; companyName?: string; name?: string; businessName?: string };
export function parseRequestProviders(value: unknown): Provider[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (row) =>
        record(row) &&
        id(row.id) &&
        ["companyName", "name", "businessName"].every((field) => nullable(row[field]))
    ) ||
    new Set(value.map((row) => row.id)).size !== value.length
  )
    return invalid();
  return value as Provider[];
}
export type RequestHistory = {
  page: number;
  hasMore: boolean;
  messages: Array<{
    id: string;
    content: string;
    senderType: string;
    senderId: string;
    createdAt: string;
  }>;
  replyAssignmentId: string | null;
  replyUnavailableReason: string | null;
};
export function parseRequestHistory(
  value: unknown,
  requestId: string,
  page: number
): RequestHistory {
  if (
    !record(value) ||
    value.page !== page ||
    (value.requestId !== undefined && value.requestId !== requestId) ||
    typeof value.hasMore !== "boolean" ||
    !Array.isArray(value.messages) ||
    !nullable(value.replyAssignmentId) ||
    !nullable(value.replyUnavailableReason) ||
    !value.messages.every(
      (row) =>
        record(row) &&
        id(row.id) &&
        ["content", "senderType", "senderId", "createdAt"].every((field) => text(row[field]))
    )
  )
    return invalid();
  return value as unknown as RequestHistory;
}

export function readParsed<T>(value: unknown, parser: (value: unknown) => T): T | null {
  try {
    return parser(value);
  } catch {
    return null;
  }
}
export type ReadState = {
  data?: unknown;
  status?: string;
  fetchStatus?: string;
  dataUpdatedAt?: number;
};
export function requestEvidenceState(
  state: ReadState | undefined,
  valid: boolean,
  now: number
): string {
  const source = adminSourceState({
    loading: state?.status === "pending",
    error: state?.status === "error",
    observedAt: state?.dataUpdatedAt,
    now,
  });
  if (state?.fetchStatus === "fetching" && state.dataUpdatedAt) return "Refreshing";
  return source === "Current" && !valid ? "Unavailable" : source;
}
export function currentRequestEvidence<T>(
  state: ReadState | undefined,
  parser: (value: unknown) => T,
  now = Date.now()
): T | null {
  const parsed = readParsed(state?.data, parser);
  return requestEvidenceState(state, parsed !== null, now) === "Current" &&
    state?.fetchStatus === "idle"
    ? parsed
    : null;
}
export function evidenceTimestamp(value?: number): string {
  return value && Number.isFinite(value) ? new Date(value).toLocaleString() : "not recorded";
}
export const requestDetailKey = (requestId: string) =>
  ["/api/admin/direct-connect/requests", requestId] as const;
export const requestHistoryKey = (requestId: string, page: number) =>
  [...requestDetailKey(requestId), "messages", page] as const;
export const requestProviderKey = (requestId: string, county: string | null, search: string) =>
  ["/api/business-providers/search", "operator", requestId, county, search] as const;

const unconfirmed = (): never => {
  throw new Error(
    "The operation receipt could not be confirmed. Refresh this request before retrying; your draft and operation ID are retained."
  );
};
export function parseInvitationReceipt(value: unknown) {
  if (
    !record(value) ||
    !id(value.assignmentId) ||
    !id(value.providerUserId) ||
    typeof value.idempotentReplay !== "boolean" ||
    typeof value.notificationQueued !== "boolean"
  )
    return unconfirmed();
  return value as {
    assignmentId: string;
    providerUserId: string;
    idempotentReplay: boolean;
    notificationQueued: boolean;
  };
}
export function parseReplyReceipt(value: unknown, assignmentId: string) {
  if (
    !record(value) ||
    !id(value.messageId) ||
    value.assignmentId !== assignmentId ||
    typeof value.idempotentReplay !== "boolean"
  )
    return unconfirmed();
  return value as { messageId: string; assignmentId: string; idempotentReplay: boolean };
}
