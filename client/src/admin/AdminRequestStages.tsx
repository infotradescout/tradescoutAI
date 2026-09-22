import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminSection, AdminSummaryStrip, AdminWorkspace } from "@/admin/AdminWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { projectRequestStagesReport, type RequestStagesReport } from "@shared/discoveryRequestStages";

const DAY = 86400000;
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
export function initialRequestDates(now = new Date()) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { from: dateOnly(new Date(end - 28 * DAY)), through: dateOnly(new Date(end - DAY)) };
}
export function requestDateWindow(from: string, through: string, now = new Date()) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose both dates.");
    const result = new Date(value + "T00:00:00.000Z");
    if (!Number.isFinite(result.getTime()) || dateOnly(result) !== value) throw new Error("Choose valid calendar dates.");
    return result;
  };
  const first = parse(from), last = new Date(parse(through).getTime() + DAY);
  const duration = last.getTime() - first.getTime();
  if (duration <= 0 || duration > 90 * DAY || last.getTime() > now.getTime()) throw new Error("Choose 1–90 complete UTC days, ending before today.");
  return { from: first.toISOString(), to: last.toISOString() };
}
const labels = { search_labeled: "Search-labeled", ai_labeled: "AI-labeled", other_labeled: "Other labeled source", direct_or_unknown: "Direct or unknown" };

export function RequestStagesResults({ report, generatedAt }: { report: RequestStagesReport; generatedAt: string }) {
  return (
    <div data-testid="request-stages-results" className="space-y-5">
      <p className="break-words text-sm leading-6 text-white/60">
        {report.window.from} to {report.window.to} (end exclusive). Generated {generatedAt}.
        Requests are grouped by creation date; only activity recorded before the selected end is included.
      </p>
      <AdminSummaryStrip items={[
        { label: "Created requests", value: report.created_requests, detail: "All recorded request creations", tone: "neutral" },
        { label: "Linked creations", value: report.linked_created_requests, detail: "Matching earlier landing and business", tone: "neutral" },
        { label: "Linked submissions", value: report.linked_submitted_requests, detail: "Matching server-recorded submission", tone: "neutral" },
        { label: "Provider responded", value: report.requests_with_provider_response, detail: "Includes declines; not a hire", tone: "neutral" },
        { label: "Requester confirmed", value: report.requester_confirmed_completions, detail: "Recorded completion, not verified revenue", tone: "neutral" },
      ]} />
      <p className="text-sm text-white/60">Unlinked creations: {report.unlinked_created_requests}. Conflicting creation attribution: {report.requests_with_conflicting_creation_attribution}.</p>
      <div className="space-y-3" aria-label="Request stages by source">
        {report.source_groups.length ? report.source_groups.map((row) => (
          <section key={row.source_group} className="rounded-lg border border-white/10 p-4">
            <h3 className="mb-3 font-medium text-white">{labels[row.source_group]}</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {[["Linked creations", row.linked_created_requests], ["Linked submissions", row.linked_submitted_requests], ["Provider responded", row.requests_with_provider_response], ["Requester confirmed", row.requester_confirmed_completions]].map(([label, value]) => (
                <div key={String(label)}><dt className="text-white/55">{label}</dt><dd className="mt-1 text-lg font-semibold text-white">{value}</dd></div>
              ))}
            </dl>
          </section>
        )) : <p className="text-sm text-white/65">No linked source records in this window. This is not a measure of total visitors.</p>}
      </div>
      <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">
        <p>Qualified requests: unavailable. Verified unique people: unavailable. Google impressions and clicks: unavailable.</p>
        <p className="mt-2">Source labels do not prove organic causation. These request totals do not have verified human/bot filtering. Notification delivery and clicks are not provider responses or completed jobs.</p>
      </div>
    </div>
  );
}

export function AdminRequestStages() {
  const [draft, setDraft] = useState(() => initialRequestDates());
  const [applied, setApplied] = useState(() => requestDateWindow(draft.from, draft.through));
  const [formError, setFormError] = useState<string | null>(null);
  const query = useQuery<{ report: RequestStagesReport; generatedAt: string }>({
    queryKey: ["/api/admin/discovery-observatory/request-stages", applied.from, applied.to],
    queryFn: async () => {
      const payload = await apiRequest("GET", `/api/admin/discovery-observatory/request-stages?${new URLSearchParams(applied)}`) as { report?: unknown; generatedAt?: unknown };
      const report = projectRequestStagesReport(payload.report);
      if (report.window.from !== applied.from || report.window.to !== applied.to || typeof payload.generatedAt !== "string" || !Number.isFinite(Date.parse(payload.generatedAt))) throw new Error("Unexpected report window");
      return { report, generatedAt: payload.generatedAt };
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });
  function apply(event: FormEvent) {
    event.preventDefault();
    try { setApplied(requestDateWindow(draft.from, draft.through)); setFormError(null); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Choose a valid date range."); }
  }
  return (
    <AdminWorkspace data-testid="admin-request-stages">
      <AdminSection title="Request outcomes" description="Separate recorded demand from responses and requester-confirmed completion. Dates use complete UTC days; the default is the previous 28 days." className="pt-0">
        <form onSubmit={apply} className="mb-6 flex flex-wrap items-end gap-3">
          <label className="min-w-0 space-y-2 text-sm text-white/65">From (UTC)<Input aria-label="From (UTC)" type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} required /></label>
          <label className="min-w-0 space-y-2 text-sm text-white/65">Through (UTC, inclusive)<Input aria-label="Through (UTC, inclusive)" type="date" value={draft.through} onChange={(event) => setDraft({ ...draft, through: event.target.value })} required /></label>
          <Button type="submit" className="min-h-11">Apply dates</Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh outcomes</Button>
        </form>
        {formError && <p role="alert" className="mb-4 text-sm text-amber-100">{formError} The displayed report retains its applied date range.</p>}
        {query.isError ? (
          <div role="alert" className="rounded-lg border border-amber-300/20 p-4 text-sm text-amber-100">
            Request outcome evidence is unavailable. No missing counts were replaced with zero.
            <Button type="button" variant="outline" className="ml-3 mt-2 min-h-11" onClick={() => void query.refetch()} disabled={query.isFetching}>Retry outcomes</Button>
          </div>
        ) : query.isLoading || !query.data ? <p role="status" className="py-8 text-sm text-white/60">Loading request outcomes…</p> : (
          <>
            {query.isFetching && <p role="status" className="mb-3 text-sm text-white/55">Refreshing; previous successful counts remain visible until the refresh completes.</p>}
            <RequestStagesResults report={query.data.report} generatedAt={query.data.generatedAt} />
          </>
        )}
      </AdminSection>
    </AdminWorkspace>
  );
}
