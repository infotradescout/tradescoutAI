import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useAdminObservationClock } from "@/admin/adminQueueState";
import {
  parseRequestDetail,
  readParsed,
  requestEvidenceState,
  evidenceTimestamp,
  requestDetailKey,
  type RequestDetail,
} from "./adminDirectConnectEvidence";
import { AdminDirectConnectOperations } from "./AdminDirectConnectOperations";

function formatTimestamp(value: string | null): string {
  if (!value) return "unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown time" : date.toLocaleString();
}

export function AdminDirectConnectRequestDetail({ requestId }: { requestId: string }) {
  const now = useAdminObservationClock();
  const source = useQuery<RequestDetail>({
    queryKey: requestDetailKey(requestId),
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
  const data = readParsed(source.data, (value) => parseRequestDetail(value, requestId));
  const sourceState = requestEvidenceState(source, data !== null, now);
  const current = sourceState === "Current" && !source.isFetching;
  return (
    <div className="space-y-4" data-testid="admin-request-detail-evidence">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-white/60">
          Request source: {sourceState.toLowerCase()}. Last successful read{" "}
          {evidenceTimestamp(source.dataUpdatedAt)}.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => source.refetch()}
          disabled={source.isFetching}
        >
          Refresh request detail
        </Button>
      </div>
      {!current ? (
        <p
          role="status"
          className="border-y border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100"
        >
          Current request context unavailable. Refresh before inviting a provider or sending a staff
          reply.{" "}
          {data
            ? "The saved request below is historical evidence."
            : "No valid request detail is available."}
        </p>
      ) : null}
      {data ? <RequestRecord data={data} historical={!current} /> : null}
      <AdminDirectConnectOperations key={requestId} requestId={requestId} />
    </div>
  );
}

function RequestRecord({ data, historical }: { data: RequestDetail; historical: boolean }) {
  const { request, requester, originatingProfile, assignments, events } = data;

  return (
    <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-white">{request.title}</CardTitle>
          <Badge variant="outline">
            {historical ? `Previously ${request.status || "unknown"}` : request.status || "unknown"}
          </Badge>
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
      </CardContent>
    </Card>
  );
}
