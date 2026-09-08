import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    contactVisibility: "withheld";
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
    createdAt: string | null;
  }>;
  conversationId: string | null;
};

function formatTimestamp(value: string | null): string {
  if (!value) return "unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown time" : date.toLocaleString();
}

export function AdminDirectConnectRequestDetail({ requestId }: { requestId: string }) {
  const { data, isLoading, isError, error } = useQuery<AdminDirectConnectRequestDetailResponse>({
    queryKey: ["/api/admin/direct-connect/requests", requestId],
    queryFn: () => apiRequest("GET", `/api/admin/direct-connect/requests/${requestId}`),
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
                <div className="text-white/60">
                  Contact details stay governed by the assigned provider’s accepted request.
                </div>
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
