import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { createClientOperationId } from "@/lib/clientOperationId";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type History = {
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

export function AdminDirectConnectOperations({
  requestId,
  countyFips,
  status,
}: {
  requestId: string;
  countyFips: string | null;
  status: string | null;
}) {
  const queryClient = useQueryClient();
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
  const history = useQuery<History>({
    queryKey: ["/api/admin/direct-connect/requests", requestId, "messages", messagePage],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/admin/direct-connect/requests/${requestId}/messages?page=${messagePage}`
      ),
  });
  const canAssign = status === "open" || status === "routed";
  const providers = useQuery<
    Array<{ id: string; companyName?: string; name?: string; businessName?: string }>
  >({
    queryKey: ["/api/business-providers/search", "operator", countyFips, search],
    enabled: canAssign && Boolean(countyFips) && search.trim().length >= 2,
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/business-providers/search?${new URLSearchParams({
          county: countyFips || "",
          query: search.trim(),
          limit: "10",
        })}`
      ),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/direct-connect/requests"] });
  };
  const assign = useMutation({
    mutationFn: () => {
      const payload = { providerId, reason: assignmentReason.trim() };
      return apiRequest("POST", `/api/admin/direct-connect/requests/${requestId}/assignments`, {
        ...payload,
        operationId: operationId("assign", payload),
      });
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
    mutationFn: () => {
      const payload = {
        assignmentId: history.data?.replyAssignmentId,
        content: reply.trim(),
        reason: replyReason.trim(),
      };
      return apiRequest("POST", `/api/admin/direct-connect/requests/${requestId}/replies`, {
        ...payload,
        operationId: operationId("reply", payload),
      });
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
    <div className="space-y-5 border-t border-[color:var(--border-subtle)] pt-4">
      {notice && (
        <p role="status" className="text-sm text-white/80">
          {notice}
        </p>
      )}
      {canAssign && (
        <section aria-label="Invite a specific provider" className="space-y-2">
          <h3 className="font-medium">Invite a specific provider</h3>
          <p className="text-xs text-white/60">
            The provider must meet this request's county, trade, verification, and trust
            requirements. They decide whether to accept.
          </p>
          {countyFips ? (
            <>
              <Input
                aria-label="Search providers in request county"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setProviderId("");
                }}
                placeholder="Search providers in the request county"
              />
              {providers.isError && (
                <p role="alert">Could not load providers. Try the search again.</p>
              )}
              {providers.isFetching && (
                <p className="text-xs text-white/60">Searching providers...</p>
              )}
              {providers.data && (
                <div className="space-y-1">
                  {providers.data.length === 0 && (
                    <p className="text-xs text-white/60">No providers found in this county.</p>
                  )}
                  {providers.data.map((provider) => (
                    <label
                      key={provider.id}
                      className="flex gap-2 rounded border border-[color:var(--border-subtle)] p-2"
                    >
                      <input
                        type="radio"
                        name={`provider-${requestId}`}
                        checked={providerId === provider.id}
                        onChange={() => setProviderId(provider.id)}
                      />
                      <span>
                        {provider.companyName ||
                          provider.businessName ||
                          provider.name ||
                          "Provider"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <Textarea
                aria-label="Provider invitation audit reason"
                placeholder="Why are you inviting this provider? (internal audit)"
                value={assignmentReason}
                onChange={(event) => setAssignmentReason(event.target.value)}
                maxLength={1000}
              />
              <Button
                disabled={!providerId || assignmentReason.trim().length < 10 || assign.isPending}
                onClick={() => {
                  setNotice("");
                  assign.mutate();
                }}
              >
                {assign.isPending ? "Inviting..." : "Invite selected provider"}
              </Button>
              {assign.isError && (
                <p role="alert" className="text-red-300">
                  {formatUserFacingErrorMessage(
                    assign.error,
                    "Unable to invite this provider. Please try again."
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-white/60">
              This request needs a county before a provider can be invited.
            </p>
          )}
        </section>
      )}

      <section aria-label="Request conversation" className="space-y-2">
        <h3 className="font-medium">Request conversation</h3>
        <p className="text-xs text-white/60">
          Only messages explicitly linked to this request appear here. Earlier unlinked
          conversations are excluded.
        </p>
        {history.isLoading && <p>Loading request messages...</p>}
        {history.isError && <p role="alert">Could not load request messages.</p>}
        {history.data?.messages.length === 0 && (
          <p className="text-white/60">No linked messages yet.</p>
        )}
        {history.data?.messages.map((message) => (
          <div key={message.id} className="rounded border border-[color:var(--border-subtle)] p-3">
            <div className="text-xs text-white/60">
              {message.senderType === "staff"
                ? "TradeScout staff"
                : message.senderType === "homeowner"
                  ? "Requester"
                  : "Provider"}{" "}
              · {new Date(message.createdAt).toLocaleString()}
            </div>
            <p className="whitespace-pre-wrap mt-1">{message.content}</p>
          </div>
        ))}
        {history.data && (messagePage > 0 || history.data.hasMore) && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={messagePage === 0 || history.isFetching}
              onClick={() => setMessagePage((page) => page - 1)}
            >
              Newer messages
            </Button>
            <Button
              variant="outline"
              disabled={!history.data.hasMore || history.isFetching}
              onClick={() => setMessagePage((page) => page + 1)}
            >
              Older messages
            </Button>
          </div>
        )}
        {history.data?.replyAssignmentId ? (
          <>
            <p className="text-xs text-white/60">
              Replies are attributed to TradeScout staff and visible to the requester and accepted
              provider. Keep contact details in the customer-controlled contact release.
            </p>
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
              disabled={!reply.trim() || replyReason.trim().length < 10 || sendReply.isPending}
              onClick={() => {
                setNotice("");
                sendReply.mutate();
              }}
            >
              {sendReply.isPending ? "Saving reply..." : "Send as TradeScout staff"}
            </Button>
            {sendReply.isError && (
              <p role="alert" className="text-red-300">
                {formatUserFacingErrorMessage(
                  sendReply.error,
                  "Unable to save the staff reply. Please try again."
                )}
              </p>
            )}
          </>
        ) : (
          history.data?.replyUnavailableReason && (
            <p className="text-xs text-white/60">{history.data.replyUnavailableReason}</p>
          )
        )}
      </section>
    </div>
  );
}
