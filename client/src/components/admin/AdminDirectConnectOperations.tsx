import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { createClientOperationId } from "@/lib/clientOperationId";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useAdminObservationClock } from "@/admin/adminQueueState";
import {
  currentRequestEvidence,
  evidenceTimestamp,
  parseRequestDetail,
  parseRequestHistory,
  parseRequestProviders,
  parseInvitationReceipt,
  parseReplyReceipt,
  readParsed,
  requestDetailKey,
  requestEvidenceState,
  requestHistoryKey,
  requestProviderKey,
  type RequestDetail,
  type RequestHistory,
  type Provider,
} from "./adminDirectConnectEvidence";

export function AdminDirectConnectOperations({
  requestId,
}: {
  requestId: string;
  countyFips?: string | null;
  status?: string | null;
}) {
  const queryClient = useQueryClient();
  const now = useAdminObservationClock();
  const [search, setSearch] = useState("");
  const [providerId, setProviderId] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [reply, setReply] = useState("");
  const [replyReason, setReplyReason] = useState("");
  const [notice, setNotice] = useState("");
  const [messagePage, setMessagePage] = useState(0);
  const pendingOperations = useRef<Record<string, { fingerprint: string; id: string }>>({});
  const operationId = (kind: string, payload: unknown) => {
    const fingerprint = JSON.stringify(payload);
    if (pendingOperations.current[kind]?.fingerprint !== fingerprint) {
      pendingOperations.current[kind] = {
        fingerprint,
        id: createClientOperationId(`dc-admin-${kind}`),
      };
    }
    return pendingOperations.current[kind].id;
  };

  const contextKey = requestDetailKey(requestId);
  const context = useQuery<RequestDetail>({
    queryKey: contextKey,
    queryFn: async () =>
      parseRequestDetail(
        await apiRequest(
          "GET",
          `/api/admin/direct-connect/requests/${encodeURIComponent(requestId)}`
        ),
        requestId
      ),
    retry: false,
  });
  const contextData = readParsed(context.data, (value) => parseRequestDetail(value, requestId));
  const contextState = requestEvidenceState(context, contextData !== null, now);
  const contextCurrent = contextState === "Current" && !context.isFetching;
  const countyFips = contextData?.request.countyFips || null;
  const canAssign =
    contextData?.request.source === "direct_connect" &&
    ["open", "routed"].includes(contextData.request.status || "") &&
    !contextData.assignments.some((assignment) => assignment.status === "accepted");
  const historyKey = requestHistoryKey(requestId, messagePage);
  const history = useQuery<RequestHistory>({
    queryKey: historyKey,
    queryFn: async () =>
      parseRequestHistory(
        await apiRequest(
          "GET",
          `/api/admin/direct-connect/requests/${encodeURIComponent(requestId)}/messages?page=${messagePage}`
        ),
        requestId,
        messagePage
      ),
    retry: false,
  });
  const historyData = readParsed(history.data, (value) =>
    parseRequestHistory(value, requestId, messagePage)
  );
  const historyState = requestEvidenceState(history, historyData !== null, now);
  const historyCurrent = contextCurrent && historyState === "Current" && !history.isFetching;
  const providerSearchEnabled =
    contextCurrent && canAssign && Boolean(countyFips) && search.trim().length >= 2;
  const providers = useQuery<Provider[]>({
    queryKey: requestProviderKey(requestId, countyFips, search),
    enabled: providerSearchEnabled,
    queryFn: async () =>
      parseRequestProviders(
        await apiRequest(
          "GET",
          `/api/business-providers/search?${new URLSearchParams({ county: countyFips || "", query: search.trim(), limit: "10" })}`
        )
      ),
    retry: false,
  });
  const providerData = readParsed(providers.data, parseRequestProviders);
  const providerState =
    search.trim().length < 2
      ? "Search required"
      : requestEvidenceState(providers, providerData !== null, now);
  const providersCurrent =
    providerSearchEnabled && providerState === "Current" && !providers.isFetching;
  const selectedProviderCurrent =
    providersCurrent && Boolean(providerData?.some((provider) => provider.id === providerId));
  const accepted =
    contextData?.assignments.filter((assignment) => assignment.status === "accepted") || [];
  const replyBindingCurrent =
    historyCurrent &&
    contextData?.request.source === "direct_connect" &&
    contextData.request.status === "in_progress" &&
    accepted.length === 1 &&
    Boolean(historyData?.replyAssignmentId) &&
    accepted[0].id === historyData?.replyAssignmentId;
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/direct-connect/requests"] });
  };
  const assign = useMutation({
    mutationFn: async () => {
      const freshContext = currentRequestEvidence(queryClient.getQueryState(contextKey), (value) =>
        parseRequestDetail(value, requestId)
      );
      const freshProviders = freshContext
        ? currentRequestEvidence(
            queryClient.getQueryState(
              requestProviderKey(requestId, freshContext.request.countyFips || null, search)
            ),
            parseRequestProviders
          )
        : null;
      if (
        !freshContext ||
        freshContext.request.source !== "direct_connect" ||
        !["open", "routed"].includes(freshContext.request.status || "") ||
        freshContext.assignments.some((assignment) => assignment.status === "accepted") ||
        !freshContext.request.countyFips ||
        search.trim().length < 2 ||
        !freshProviders?.some((provider) => provider.id === providerId) ||
        assignmentReason.trim().length < 10
      )
        throw new Error("Refresh the request and provider results before inviting a provider.");
      const payload = { providerId, reason: assignmentReason.trim() };
      return parseInvitationReceipt(
        await apiRequest(
          "POST",
          `/api/admin/direct-connect/requests/${encodeURIComponent(requestId)}/assignments`,
          {
            ...payload,
            operationId: operationId("assign", payload),
          }
        )
      );
    },
    onSuccess: async (result) => {
      delete pendingOperations.current.assign;
      setProviderId("");
      setAssignmentReason("");
      setNotice(
        result.idempotentReplay
          ? "The provider invitation was already recorded."
          : result.notificationQueued
            ? "Provider invited. The invitation is available in their Direct Connect inbox."
            : "Provider invited. The assignment is in their inbox, but the notification could not be confirmed."
      );
      await refresh();
    },
  });
  const sendReply = useMutation({
    mutationFn: async () => {
      const freshContext = currentRequestEvidence(queryClient.getQueryState(contextKey), (value) =>
        parseRequestDetail(value, requestId)
      );
      const freshHistory = currentRequestEvidence(queryClient.getQueryState(historyKey), (value) =>
        parseRequestHistory(value, requestId, messagePage)
      );
      const accepted =
        freshContext?.assignments.filter((assignment) => assignment.status === "accepted") || [];
      if (
        !freshContext ||
        freshContext.request.source !== "direct_connect" ||
        freshContext.request.status !== "in_progress" ||
        !freshHistory?.replyAssignmentId ||
        accepted.length !== 1 ||
        accepted[0].id !== freshHistory.replyAssignmentId ||
        !reply.trim() ||
        replyReason.trim().length < 10
      )
        throw new Error("Refresh the request and its messages before sending a staff reply.");
      const payload = {
        assignmentId: freshHistory.replyAssignmentId,
        content: reply.trim(),
        reason: replyReason.trim(),
      };
      return parseReplyReceipt(
        await apiRequest(
          "POST",
          `/api/admin/direct-connect/requests/${encodeURIComponent(requestId)}/replies`,
          {
            ...payload,
            operationId: operationId("reply", payload),
          }
        ),
        payload.assignmentId
      );
    },
    onSuccess: async () => {
      delete pendingOperations.current.reply;
      setMessagePage(0);
      setReply("");
      setReplyReason("");
      setNotice("Reply saved as TradeScout staff in the request conversation.");
      await refresh();
    },
  });

  return (
    <div
      className="space-y-5 border-t border-[color:var(--border-subtle)] pt-4"
      data-testid="admin-request-staff-operations"
    >
      {notice ? (
        <p role="status" className="text-sm text-white/80">
          {notice}
        </p>
      ) : null}
      {!contextCurrent ? (
        <p role="status" className="text-sm text-amber-100">
          Request context is {contextState.toLowerCase()}. Staff drafts are saved here; refresh the
          request before acting.
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={() => context.refetch()}
        disabled={context.isFetching}
      >
        Refresh request context
      </Button>
      {canAssign || search || assignmentReason ? (
        <section aria-label="Invite a specific provider" className="space-y-2">
          <h3 className="font-medium">Invite a specific provider</h3>
          <p className="text-xs text-white/60">
            The provider must meet this request's county, trade, verification, and trust
            requirements. They decide whether to accept.
          </p>
          {!countyFips ? (
            <p className="text-xs text-white/60">
              This request needs a current county before a provider can be invited.
            </p>
          ) : null}
          <Input
            aria-label="Search providers in request county"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setProviderId("");
            }}
            placeholder="Search providers in the request county"
          />
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="text-xs text-white/60">
              Provider source: {providerState.toLowerCase()}. Last successful read{" "}
              {evidenceTimestamp(providers.dataUpdatedAt)}.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => providers.refetch()}
              disabled={!providerSearchEnabled || providers.isFetching}
            >
              Refresh provider results
            </Button>
          </div>
          {!providersCurrent && search.trim().length >= 2 ? (
            <p role="status" className="text-sm text-amber-100">
              Current provider results unavailable. Refresh the request and provider results before
              selecting or inviting.
            </p>
          ) : null}
          {providersCurrent && providerData ? (
            <div className="space-y-1">
              {providerData.length === 0 ? (
                <p className="text-xs text-white/60">No providers found in this county.</p>
              ) : null}
              {providerData.map((provider) => (
                <label
                  key={provider.id}
                  className="flex gap-2 rounded border border-[color:var(--border-subtle)] p-2"
                >
                  <input
                    type="radio"
                    name={`provider-${requestId}`}
                    aria-label={
                      provider.companyName || provider.businessName || provider.name || "Provider"
                    }
                    checked={providerId === provider.id}
                    onChange={() => setProviderId(provider.id)}
                  />
                  <span>
                    {provider.companyName || provider.businessName || provider.name || "Provider"}
                  </span>
                </label>
              ))}
            </div>
          ) : providerData?.length ? (
            <details className="border border-white/10 p-2">
              <summary>Previously loaded providers · historical results</summary>
              {providerData.map((provider) => (
                <p key={provider.id} className="mt-2 text-sm text-white/60">
                  {provider.companyName || provider.businessName || provider.name || "Provider"}
                </p>
              ))}
            </details>
          ) : null}
          {providerId && providersCurrent && !selectedProviderCurrent ? (
            <p role="status">
              The selected provider is no longer in these results. Select a provider again.
            </p>
          ) : null}
          <Textarea
            aria-label="Provider invitation audit reason"
            placeholder="Why are you inviting this provider? (internal audit)"
            value={assignmentReason}
            onChange={(event) => setAssignmentReason(event.target.value)}
            maxLength={1000}
          />
          <Button
            disabled={
              !selectedProviderCurrent || assignmentReason.trim().length < 10 || assign.isPending
            }
            onClick={() => {
              setNotice("");
              assign.mutate();
            }}
          >
            {assign.isPending ? "Inviting..." : "Invite selected provider"}
          </Button>
          {assign.isError ? (
            <p role="alert" className="text-red-300">
              {formatUserFacingErrorMessage(
                assign.error,
                "Unable to invite this provider. Please try again."
              )}
            </p>
          ) : null}
        </section>
      ) : null}
      <section aria-label="Request conversation" className="space-y-2">
        <h3 className="font-medium">Request conversation</h3>
        <p className="text-xs text-white/60">
          Only messages explicitly linked to this request appear here. Earlier unlinked
          conversations are excluded.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-xs text-white/60">
            Messages source: {historyState.toLowerCase()}. Last successful read{" "}
            {evidenceTimestamp(history.dataUpdatedAt)}.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => history.refetch()}
            disabled={history.isFetching}
          >
            Refresh request messages
          </Button>
        </div>
        {!historyCurrent ? (
          <p role="status" className="text-sm text-amber-100">
            Current request messages unavailable. Refresh the request and messages before replying.
            Saved messages, when shown, are historical evidence.
          </p>
        ) : null}
        {historyCurrent && historyData?.messages.length === 0 ? (
          <p className="text-white/60">No linked messages yet.</p>
        ) : null}
        {historyData?.messages.map((message) => (
          <div key={message.id} className="rounded border border-[color:var(--border-subtle)] p-3">
            <div className="text-xs text-white/60">
              {!historyCurrent ? "Previously loaded · " : ""}
              {message.senderType === "staff"
                ? "TradeScout staff"
                : message.senderType === "homeowner"
                  ? "Requester"
                  : "Provider"}{" "}
              · {new Date(message.createdAt).toLocaleString()}
            </div>
            <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
        {historyData && (messagePage > 0 || historyData.hasMore) ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={messagePage === 0 || !historyCurrent}
              onClick={() => setMessagePage((page) => page - 1)}
            >
              Newer messages
            </Button>
            <Button
              variant="outline"
              disabled={!historyData.hasMore || !historyCurrent}
              onClick={() => setMessagePage((page) => page + 1)}
            >
              Older messages
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-white/60">
          Replies are attributed to TradeScout staff and visible to the requester and accepted
          provider. Keep contact details in the customer-controlled contact release.
        </p>
        {!replyBindingCurrent ? (
          <p role="status" className="text-xs text-amber-100">
            {historyCurrent && historyData?.replyUnavailableReason
              ? historyData.replyUnavailableReason
              : "A current request and one matching accepted provider conversation are required to send a staff reply."}
          </p>
        ) : null}
        <Textarea
          aria-label="Staff reply"
          placeholder="Reply as TradeScout staff"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          maxLength={5000}
        />
        <Textarea
          aria-label="Staff reply audit reason"
          placeholder="Why is staff assisting? (internal audit)"
          value={replyReason}
          onChange={(event) => setReplyReason(event.target.value)}
          maxLength={1000}
        />
        <Button
          disabled={
            !replyBindingCurrent ||
            !reply.trim() ||
            replyReason.trim().length < 10 ||
            sendReply.isPending
          }
          onClick={() => {
            setNotice("");
            sendReply.mutate();
          }}
        >
          {sendReply.isPending ? "Saving reply..." : "Send as TradeScout staff"}
        </Button>
        {sendReply.isError ? (
          <p role="alert" className="text-red-300">
            {formatUserFacingErrorMessage(
              sendReply.error,
              "Unable to save the staff reply. Please try again."
            )}
          </p>
        ) : null}
      </section>
    </div>
  );
}
