import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Mail,
  MessageSquareText,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const createAdminOperationId = (operation: string) =>
  `${operation}:${globalThis.crypto.randomUUID()}`;

type AdminConversationMessage = {
  id: string;
  senderId?: string | null;
  senderName?: string | null;
  senderType?: string | null;
  content: string;
  createdAt: string | null;
};

type AdminConversation = {
  id: string;
  providerName: string | null;
  messages: AdminConversationMessage[];
};

type AdminDelivery = {
  id?: string | null;
  notificationId?: string | null;
  recipientUserId?: string | null;
  title?: string | null;
  emailPurpose?: string | null;
  deliveryMethod?: string | null;
  channel?: string | null;
  status: string | null;
  contactInfo?: string | null;
  recipient?: string | null;
  externalId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryCount?: number | null;
  nextRetryAt?: string | null;
  terminal?: boolean | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AdminDirectConnectRequestDetailResponse = {
  request: {
    id: string;
    title: string;
    description: string;
    category: string | null;
    tradeId: string | null;
    countyFips: string | null;
    stateCode: string | null;
    status: string | null;
    source: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  requester: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  originatingProfile: {
    id: string;
    slug: string;
    businessName: string;
    ownerUserId: string;
  } | null;
  assignments: Array<{
    id: string;
    status: string | null;
    contractorId?: string | null;
    contractorSlug?: string | null;
    contractorName?: string | null;
    responderUserId: string | null;
    responderName: string | null;
    workerId?: string | null;
    workerName?: string | null;
    providerName?: string | null;
    providerType?: string | null;
    providerUserId?: string | null;
    profileUrl?: string | null;
    providerProfileUrl?: string | null;
    provider?: {
      id: string;
      name: string | null;
      type: string | null;
      profileUrl?: string | null;
    } | null;
    createdAt: string | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
  }>;
  conversation?: AdminConversation | null;
  deliveries?: AdminDelivery[];
  deliveryEvidenceIssue?: string | null;
};

type ManualAssignmentCandidate = {
  id: string;
  providerType?: "contractor" | "business" | string | null;
  companyName?: string | null;
  name?: string | null;
  slug?: string | null;
  userId?: string | null;
  ownerUserId?: string | null;
};

function formatTimestamp(value: string | null): string {
  if (!value) return "unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown time" : date.toLocaleString();
}

function formatToken(value: string | null | undefined): string {
  return String(value || "unknown").replaceAll("_", " ");
}

function resolveProviderPresentation(
  assignment: AdminDirectConnectRequestDetailResponse["assignments"][number]
) {
  const name =
    assignment.provider?.name ||
    assignment.providerName ||
    assignment.contractorName ||
    assignment.workerName ||
    assignment.responderName ||
    assignment.providerUserId ||
    assignment.responderUserId ||
    assignment.contractorId ||
    assignment.workerId ||
    "Unknown provider";
  const type =
    assignment.provider?.type ||
    assignment.providerType ||
    (assignment.contractorId ? "contractor" : assignment.workerId ? "worker" : "business");
  const profileUrl =
    assignment.provider?.profileUrl ||
    assignment.profileUrl ||
    assignment.providerProfileUrl ||
    (assignment.contractorSlug
      ? `/contractors/${encodeURIComponent(assignment.contractorSlug)}`
      : assignment.workerId
        ? `/helpers/${encodeURIComponent(assignment.workerId)}`
        : assignment.providerUserId
          ? `/profile/${encodeURIComponent(assignment.providerUserId)}`
          : assignment.responderUserId
            ? `/profile/${encodeURIComponent(assignment.responderUserId)}`
            : null);

  return { name, type, profileUrl };
}

function deliveryStatusIcon(status: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "sent" || normalized === "delivered") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }
  if (
    normalized === "failed" ||
    normalized === "bounced" ||
    normalized === "exhausted" ||
    normalized === "delivery_unknown"
  ) {
    return <CircleAlert className="h-4 w-4 text-red-300" />;
  }
  return <Clock3 className="h-4 w-4 text-amber-300" />;
}

export function AdminDirectConnectRequestDetail({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pendingAssistedReplyOperationId = useRef<string | null>(null);
  const pendingManualAssignmentOperationId = useRef<string | null>(null);
  const [assistedReplyContent, setAssistedReplyContent] = useState("");
  const [assistedReplyReason, setAssistedReplyReason] = useState("");
  const [providerSearch, setProviderSearch] = useState("");
  const [manualAssignmentReason, setManualAssignmentReason] = useState("");
  const { data, isLoading, isError, error } = useQuery<AdminDirectConnectRequestDetailResponse>({
    queryKey: ["/api/admin/direct-connect/requests", requestId],
    queryFn: () => apiRequest("GET", `/api/admin/direct-connect/requests/${requestId}`),
  });
  const providerSearchTerm = providerSearch.trim();
  const canSearchProviders =
    Boolean(data) &&
    ["open", "routed"].includes(String(data?.request.status || "")) &&
    providerSearchTerm.length >= 2;
  const { data: providerCandidates = [], isFetching: providerSearchPending } = useQuery<
    ManualAssignmentCandidate[]
  >({
    queryKey: [
      "/api/business-providers/search",
      "direct-connect-admin-manual-assignment",
      requestId,
      data?.request.countyFips,
      providerSearchTerm,
    ],
    enabled: canSearchProviders,
    queryFn: () => {
      const params = new URLSearchParams({
        query: providerSearchTerm,
        limit: "12",
        sort: "recommended",
      });
      if (data?.request.countyFips) {
        params.set("county", data.request.countyFips);
      }
      return apiRequest("GET", `/api/business-providers/search?${params.toString()}`);
    },
  });

  const refreshRequestData = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/direct-connect/requests"] });

  const actionError = (title: string, actionErrorValue: unknown) => {
    toast({
      title,
      description:
        actionErrorValue instanceof Error
          ? actionErrorValue.message
          : "The request could not be updated.",
      variant: "destructive",
    });
  };

  const routeRequest = useMutation({
    mutationFn: (expandReach: boolean) =>
      apiRequest(
        "POST",
        `/api/admin/direct-connect/requests/${requestId}/route`,
        expandReach ? { expandReach: true } : {}
      ),
    onSuccess: async (_result, expandReach) => {
      await refreshRequestData();
      toast({
        title: expandReach ? "Provider reach expanded" : "Routing started",
        description: expandReach
          ? "The request was offered to additional eligible providers."
          : "The request entered the normal provider-routing flow.",
      });
    },
    onError: (mutationError) => actionError("Could not route request", mutationError),
  });

  const resendNotifications = useMutation({
    mutationFn: () =>
      apiRequest(
        "POST",
        `/api/admin/direct-connect/requests/${requestId}/resend-notifications`,
        {}
      ),
    onSuccess: async () => {
      await refreshRequestData();
      toast({
        title: "Assignment notices retried",
        description: "A new notice was sent to each provider currently assigned to this request.",
      });
    },
    onError: (mutationError) => actionError("Could not resend assignment notices", mutationError),
  });

  const assignProvider = useMutation({
    mutationFn: (candidate: ManualAssignmentCandidate) => {
      const operationId =
        pendingManualAssignmentOperationId.current ||
        createAdminOperationId("direct-connect-manual-assignment");
      pendingManualAssignmentOperationId.current = operationId;
      return apiRequest(
        "POST",
        `/api/admin/direct-connect/requests/${requestId}/manual-assignment`,
        {
          providerId: candidate.id,
          providerType: candidate.providerType === "business" ? "business" : "contractor",
          reason: manualAssignmentReason.trim(),
          operationId,
        }
      );
    },
    onSuccess: async (result: { alreadyAssigned?: boolean; notificationQueued?: boolean }) => {
      pendingManualAssignmentOperationId.current = null;
      setProviderSearch("");
      setManualAssignmentReason("");
      await refreshRequestData();
      toast({
        title: result.alreadyAssigned ? "Provider already assigned" : "Provider assigned",
        description: result.alreadyAssigned
          ? "The existing assignment was preserved without creating a duplicate."
          : result.notificationQueued
            ? "The provider was assigned and its Direct Connect notice was queued."
            : "The provider was assigned, but the notification needs operator follow-up.",
      });
    },
    onError: (mutationError) => {
      pendingManualAssignmentOperationId.current = null;
      actionError("Could not assign provider", mutationError);
    },
  });

  const sendAssistedReply = useMutation({
    mutationFn: () => {
      const operationId =
        pendingAssistedReplyOperationId.current ||
        createAdminOperationId("direct-connect-assisted-reply");
      pendingAssistedReplyOperationId.current = operationId;
      return apiRequest("POST", `/api/admin/direct-connect/requests/${requestId}/assisted-reply`, {
        content: assistedReplyContent.trim(),
        reason: assistedReplyReason.trim(),
        operationId,
      });
    },
    onSuccess: async () => {
      pendingAssistedReplyOperationId.current = null;
      setAssistedReplyContent("");
      setAssistedReplyReason("");
      await refreshRequestData();
      toast({
        title: "Staff-assisted reply sent",
        description: "The reply was added to this conversation with TradeScout staff context.",
      });
    },
    onError: (mutationError) => actionError("Could not send staff-assisted reply", mutationError),
  });

  if (isLoading) {
    return (
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-4 text-sm text-white/60">Loading request...</CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    const errorMessage = error instanceof Error ? error.message : null;
    return (
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-4 text-sm text-red-300">
          Could not load this request{errorMessage ? `: ${errorMessage}` : "."}
        </CardContent>
      </Card>
    );
  }

  const {
    request,
    requester,
    originatingProfile,
    assignments,
    events,
    conversation,
    deliveries = [],
    deliveryEvidenceIssue,
  } = data;
  const canResendAssignmentNotices = assignments.some((assignment) =>
    ["suggested", "invited"].includes(String(assignment.status || ""))
  );
  const canManageAssignments = ["open", "routed"].includes(String(request.status || ""));
  const canSendAssistedReply =
    Boolean(conversation) &&
    ["in_progress", "pending_outcome"].includes(String(request.status || ""));

  return (
    <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <CardHeader className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/60">
          <Link href="/admin/direct-connect-requests">
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-white">{request.title}</CardTitle>
          <Badge variant="outline">{request.status || "unknown"}</Badge>
        </div>
        <CardDescription className="text-[color:var(--text-secondary)]">
          Submitted {formatTimestamp(request.createdAt)} via {request.source || "unknown source"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-white/80">
        <div className="rounded-md border border-[color:var(--border-subtle)] bg-black/20 p-3 whitespace-pre-wrap">
          {request.description}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-md border border-[color:var(--border-subtle)] p-3">
            <div className="text-xs uppercase tracking-wide text-white/50">Requester</div>
            {requester ? (
              <div className="mt-1 space-y-0.5">
                <Link
                  href={`/profile/${encodeURIComponent(requester.id)}`}
                  className="inline-flex items-center gap-1.5 text-ts-orange hover:underline"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  {requester.name || "Unnamed requester"}
                </Link>
                <div className="text-white/60">{requester.email || "no email on file"}</div>
                <div className="text-white/60">{requester.phone || "no phone on file"}</div>
              </div>
            ) : (
              <div className="mt-1 text-white/50">Requester account not found</div>
            )}
          </div>
          <div className="rounded-md border border-[color:var(--border-subtle)] p-3">
            <div className="text-xs uppercase tracking-wide text-white/50">
              Originating business/profile
            </div>
            {originatingProfile ? (
              <div className="mt-1 space-y-0.5">
                <Link
                  href={`/u/${encodeURIComponent(originatingProfile.slug)}`}
                  className="inline-flex items-center gap-1.5 text-ts-orange hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {originatingProfile.businessName}
                </Link>
                <div className="text-white/60">/u/{originatingProfile.slug}</div>
              </div>
            ) : (
              <div className="mt-1 text-white/50">No profile linkage recorded for this request</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-white/50 mb-1">Assignments</div>
          {assignments.length === 0 ? (
            <div className="text-white/50">No provider assignments recorded.</div>
          ) : (
            <div className="space-y-1">
              {assignments.map((assignment) => {
                const provider = resolveProviderPresentation(assignment);
                return (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--border-subtle)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      {provider.profileUrl ? (
                        <Link
                          href={provider.profileUrl}
                          className="block truncate text-ts-orange hover:underline"
                        >
                          {provider.name}
                        </Link>
                      ) : (
                        <div className="truncate">{provider.name}</div>
                      )}
                      <div className="text-xs capitalize text-white/45">
                        {formatToken(provider.type)}
                      </div>
                    </div>
                    <Badge variant="outline">{formatToken(assignment.status)}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-white/50">Operator actions</div>
          <div className="space-y-3 rounded-md border border-[color:var(--border-subtle)] p-3">
            <div className="flex flex-wrap gap-2">
              {request.status === "open" || request.status === "routed" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => routeRequest.mutate(request.status === "routed")}
                  disabled={routeRequest.isPending}
                  className="bg-ts-orange hover:bg-ts-orange-dark"
                >
                  {routeRequest.isPending
                    ? "Routing…"
                    : request.status === "routed"
                      ? "Expand provider reach"
                      : "Route to eligible providers"}
                </Button>
              ) : null}
              {canResendAssignmentNotices ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => resendNotifications.mutate()}
                  disabled={resendNotifications.isPending}
                >
                  {resendNotifications.isPending ? "Sending…" : "Resend assignment notices"}
                </Button>
              ) : null}
            </div>

            {request.status === "routed" ? (
              <p className="text-xs text-white/45">
                Expanding reach offers this request to additional eligible providers; it does not
                replace current assignments.
              </p>
            ) : null}
            {canResendAssignmentNotices ? (
              <p className="text-xs text-white/45">
                Resending creates another notice for each provider with a pending assignment.
              </p>
            ) : null}

            {canManageAssignments ? (
              <div className="space-y-2 border-t border-white/10 pt-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-white">
                    <UserPlus className="h-4 w-4 text-ts-orange" />
                    Assign a specific provider
                  </div>
                  <p className="text-xs text-white/50">
                    Search the provider directory, then assign one eligible provider at a time.
                    County, trade, and verification gates remain enforced.
                  </p>
                </div>
                <Input
                  value={providerSearch}
                  onChange={(event) => setProviderSearch(event.target.value)}
                  placeholder="Search provider or business name"
                  aria-label="Search provider for manual assignment"
                />
                <Input
                  value={manualAssignmentReason}
                  onChange={(event) => setManualAssignmentReason(event.target.value)}
                  placeholder="Required reason for manual assignment"
                  aria-label="Reason for manual provider assignment"
                />
                {providerSearchPending ? (
                  <div className="text-xs text-white/45">Searching eligible providers…</div>
                ) : null}
                {canSearchProviders && !providerSearchPending && providerCandidates.length === 0 ? (
                  <div className="rounded-md border border-dashed border-white/10 p-2 text-xs text-white/45">
                    No matching providers were found for this search.
                  </div>
                ) : null}
                {providerCandidates.length > 0 ? (
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {providerCandidates.map((candidate) => {
                      const providerType =
                        candidate.providerType === "business" ? "business" : "contractor";
                      const name =
                        candidate.companyName || candidate.name || candidate.slug || candidate.id;
                      return (
                        <div
                          key={`${providerType}:${candidate.id}`}
                          className="flex flex-col gap-2 rounded-md border border-white/10 p-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm text-white/85">{name}</div>
                            <div className="text-xs capitalize text-white/45">
                              {formatToken(providerType)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => assignProvider.mutate(candidate)}
                            disabled={
                              assignProvider.isPending || manualAssignmentReason.trim().length < 3
                            }
                          >
                            {assignProvider.isPending ? "Assigning…" : "Assign provider"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {canSendAssistedReply ? (
              <form
                className="space-y-2 border-t border-white/10 pt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (assistedReplyContent.trim() && assistedReplyReason.trim()) {
                    sendAssistedReply.mutate();
                  }
                }}
              >
                <div>
                  <div className="text-sm font-medium text-white">TradeScout staff assistance</div>
                  <p className="text-xs text-white/50">
                    This reply is recorded as staff assistance. It does not impersonate the
                    requester or provider.
                  </p>
                </div>
                <Textarea
                  value={assistedReplyContent}
                  onChange={(event) => setAssistedReplyContent(event.target.value)}
                  placeholder="Write a concise operational reply"
                  aria-label="Staff-assisted reply"
                  className="min-h-24"
                />
                <Input
                  value={assistedReplyReason}
                  onChange={(event) => setAssistedReplyReason(event.target.value)}
                  placeholder="Required reason for staff assistance"
                  aria-label="Reason for staff assistance"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={
                    sendAssistedReply.isPending ||
                    !assistedReplyContent.trim() ||
                    !assistedReplyReason.trim()
                  }
                >
                  {sendAssistedReply.isPending ? "Sending…" : "Send staff-assisted reply"}
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/50">
            <MessageSquareText className="h-3.5 w-3.5" />
            Conversation
          </div>
          {conversation ? (
            <div className="rounded-md border border-[color:var(--border-subtle)] bg-black/15">
              <div className="border-b border-white/10 px-3 py-2">
                <div className="font-medium text-white">
                  {conversation.providerName || "Direct Connect provider"}
                </div>
                <div className="text-xs text-white/45">Conversation {conversation.id}</div>
              </div>
              {conversation.messages.length > 0 ? (
                <div className="max-h-80 space-y-2 overflow-y-auto p-3">
                  {conversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-lg border border-white/10 bg-black/20 p-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-white/80">
                          {message.senderName || formatToken(message.senderType)}
                        </span>
                        <span className="text-white/40">{formatTimestamp(message.createdAt)}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-white/75">
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-sm text-white/50">
                  This conversation does not have any messages yet.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-white/10 p-3 text-sm text-white/50">
              No request-linked conversation is available yet.
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/50">
            <Mail className="h-3.5 w-3.5" />
            Delivery activity
          </div>
          <p className="mb-2 text-xs text-white/45">
            Sent means the email provider accepted the message; it is not proof of inbox delivery.
            Only Delivered confirms delivery.
          </p>
          {deliveries.length > 0 ? (
            <div className="space-y-1">
              {deliveries.map((delivery, index) => {
                const channel = delivery.deliveryMethod || delivery.channel || "notification";
                const timestamp =
                  delivery.deliveredAt ||
                  delivery.sentAt ||
                  delivery.failedAt ||
                  delivery.updatedAt ||
                  delivery.createdAt ||
                  null;
                const retryCount = Number(delivery.retryCount || 0);
                const normalizedStatus = String(delivery.status || "").toLowerCase();
                const retryScheduled =
                  normalizedStatus === "retry_scheduled" &&
                  Boolean(delivery.nextRetryAt) &&
                  !delivery.terminal;
                const terminalFailure =
                  delivery.terminal &&
                  ["failed", "bounced", "suppressed", "exhausted"].includes(normalizedStatus);
                const acceptanceEvidenceUnreconciled = normalizedStatus === "accepted_unreconciled";
                const deliveryOutcomeUnknown = normalizedStatus === "delivery_unknown";
                return (
                  <div
                    key={delivery.id || delivery.notificationId || index}
                    className="rounded-md border border-[color:var(--border-subtle)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {deliveryStatusIcon(delivery.status)}
                        <span className="capitalize text-white/80">{formatToken(channel)}</span>
                        <Badge variant="outline">{formatToken(delivery.status)}</Badge>
                      </div>
                      <span className="text-xs text-white/40">{formatTimestamp(timestamp)}</span>
                    </div>
                    <div className="mt-1 break-all text-xs text-white/50">
                      {delivery.recipientUserId ? (
                        <Link
                          href={`/profile/${encodeURIComponent(delivery.recipientUserId)}`}
                          className="text-ts-orange hover:underline"
                        >
                          Recipient profile
                        </Link>
                      ) : (
                        delivery.recipient ||
                        delivery.contactInfo ||
                        "Recipient identity not recorded"
                      )}
                    </div>
                    {delivery.title ? (
                      <div className="mt-1 text-xs text-white/45">{delivery.title}</div>
                    ) : null}
                    {delivery.externalId ? (
                      <div className="mt-1 break-all font-mono text-[11px] text-white/35">
                        Provider ID: {delivery.externalId}
                      </div>
                    ) : null}
                    {delivery.errorCode || delivery.errorMessage ? (
                      <div className="mt-1 text-xs text-red-300">
                        {[delivery.errorCode, delivery.errorMessage].filter(Boolean).join(": ")}
                      </div>
                    ) : null}
                    {retryScheduled ? (
                      <div className="mt-1 text-xs text-amber-200">
                        Attempt {Math.max(1, retryCount)} failed. Automatic retry scheduled for{" "}
                        {formatTimestamp(delivery.nextRetryAt || null)}.
                      </div>
                    ) : null}
                    {acceptanceEvidenceUnreconciled ? (
                      <div className="mt-1 text-xs text-amber-200">
                        The provider accepted this email, but its normal acceptance evidence could
                        not be fully reconciled. Automatic retry is stopped to avoid a duplicate.
                      </div>
                    ) : null}
                    {deliveryOutcomeUnknown ? (
                      <div className="mt-1 text-xs text-amber-200">
                        The processing lease expired without a durable provider outcome. Automatic
                        retry is stopped because the email may already have been accepted.
                      </div>
                    ) : null}
                    {normalizedStatus === "pending" && delivery.nextRetryAt ? (
                      <div className="mt-1 text-xs text-amber-200">
                        Queued for delivery at {formatTimestamp(delivery.nextRetryAt)}.
                      </div>
                    ) : null}
                    {terminalFailure && retryCount > 0 ? (
                      <div className="mt-1 text-xs text-white/45">
                        Terminal after {retryCount} delivery{" "}
                        {retryCount === 1 ? "attempt" : "attempts"}; automatic retries have stopped.
                      </div>
                    ) : null}
                    {normalizedStatus === "processing" ? (
                      <div className="mt-1 text-xs text-amber-200">
                        Delivery attempt {Math.max(1, retryCount)} is in progress. If its lease
                        expires without durable evidence, automatic retry stops for reconciliation.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-white/10 p-3 text-sm text-white/50">
              No delivery attempts are recorded for this request.
            </div>
          )}
          {deliveryEvidenceIssue ? (
            <div className="mt-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-2 text-xs text-amber-200">
              {deliveryEvidenceIssue}
            </div>
          ) : null}
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-white/50 mb-1">Timeline</div>
          {events.length === 0 ? (
            <div className="text-white/50">No events recorded.</div>
          ) : (
            <div className="space-y-1">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-md border border-[color:var(--border-subtle)] px-3 py-2 text-xs text-white/70"
                >
                  <span className="text-white/90">{event.type.replaceAll("_", " ")}</span> --{" "}
                  {formatTimestamp(event.createdAt)}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
