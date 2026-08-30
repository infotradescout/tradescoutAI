import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type AdminDirectConnectRequestDetailResponse = {
  request: {
    id: string;
    title: string;
    description: string;
    category: string | null;
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
    responderUserId: string | null;
    responderName: string | null;
    createdAt: string | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    metadata: Record<string, any> | null;
    createdAt: string | null;
  }>;
  conversationId: string | null;
};

type AdminDirectConnectRescueResponse = {
  routed: boolean;
  assignmentsAdded: number;
  contactGateUnchanged: true;
  verificationBypass: false;
};

function formatTimestamp(value: string | null): string {
  if (!value) return "unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown time" : date.toLocaleString();
}

export function AdminDirectConnectRequestDetail({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const [rescueReason, setRescueReason] = useState("");
  const { data, isLoading, isError, error } = useQuery<AdminDirectConnectRequestDetailResponse>({
    queryKey: ["/api/admin/direct-connect/requests", requestId],
    queryFn: () => apiRequest("GET", `/api/admin/direct-connect/requests/${requestId}`),
  });
  const rescueMutation = useMutation<AdminDirectConnectRescueResponse, Error>({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/direct-connect/requests/${requestId}/rescue`, {
        reason: rescueReason.trim(),
      }),
    onSuccess: async () => {
      setRescueReason("");
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/direct-connect/requests", requestId],
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-4 text-sm text-white/60">Loading request...</CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-4 text-sm text-red-300">
          Could not load this request{(error as any)?.message ? `: ${(error as any).message}` : "."}
        </CardContent>
      </Card>
    );
  }

  const { request, requester, originatingProfile, assignments, events, conversationId } = data;
  const canRescueRouting =
    ["open", "routed"].includes(String(request.status || "")) &&
    !assignments.some((assignment) =>
      ["accepted", "completed"].includes(String(assignment.status || ""))
    );

  return (
    <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <CardHeader>
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
                <div>{requester.name || "Unnamed"}</div>
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
                <div>{originatingProfile.businessName}</div>
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
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--border-subtle)] px-3 py-2"
                >
                  <span>
                    {assignment.responderName || assignment.responderUserId || "Unknown responder"}
                  </span>
                  <Badge variant="outline">{assignment.status || "unknown"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {canRescueRouting ? (
          <div
            className="rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-3"
            data-testid="admin-direct-connect-routing-rescue"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-100">
              Routing rescue
            </div>
            <p className="mt-1 text-xs leading-5 text-white/60">
              Add only currently eligible providers. Verification, requester ownership, and the
              contact gate remain unchanged.
            </p>
            <textarea
              aria-label="Staff rescue reason"
              value={rescueReason}
              onChange={(event) => setRescueReason(event.target.value)}
              maxLength={500}
              rows={2}
              className="mt-3 w-full resize-y rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/40"
              placeholder="Why does this request need expanded routing?"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                disabled={rescueReason.trim().length < 10 || rescueMutation.isPending}
                onClick={() => rescueMutation.mutate()}
              >
                {rescueMutation.isPending ? "Expanding routing..." : "Expand eligible routing"}
              </Button>
              <span className="text-xs text-white/45">A reason of at least 10 characters is required.</span>
            </div>
            {rescueMutation.data ? (
              <p className="mt-2 text-xs text-emerald-300">
                Rescue recorded. {rescueMutation.data.assignmentsAdded} eligible assignment
                {rescueMutation.data.assignmentsAdded === 1 ? "" : "s"} added.
              </p>
            ) : null}
            {rescueMutation.isError ? (
              <p className="mt-2 text-xs text-red-300">{rescueMutation.error.message}</p>
            ) : null}
          </div>
        ) : null}

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

        {conversationId ? (
          <a
            href={`/messages?thread=${encodeURIComponent(conversationId)}`}
            className="inline-block text-ts-orange hover:underline text-xs"
          >
            Open conversation thread
          </a>
        ) : (
          <div className="text-xs text-white/50">No conversation thread yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
