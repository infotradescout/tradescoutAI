import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type AcceptanceStatus = "working" | "genuinely_empty" | "unavailable" | "blocked";

type AcceptanceLane = {
  id: string;
  label: string;
  status: AcceptanceStatus;
  workspacePath: string;
  summary: string;
  counts: Record<string, number | string | null>;
  findings: string[];
};

type AcceptanceReport = {
  generatedAt: string;
  revision: string | null;
  database: {
    reachable: boolean;
    checkedAt: string;
  };
  controlledWriteCanary: {
    status: "passed" | "failed";
    detail: string;
  };
  summary: Record<AcceptanceStatus, number>;
  lanes: AcceptanceLane[];
};

const STATUS_LABEL: Record<AcceptanceStatus, string> = {
  working: "Working",
  genuinely_empty: "Genuinely empty",
  unavailable: "Unavailable",
  blocked: "Blocked",
};

function statusBadge(status: AcceptanceStatus) {
  if (status === "working") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Working
      </Badge>
    );
  }
  if (status === "genuinely_empty") {
    return (
      <Badge className="border-sky-400/25 bg-sky-400/10 text-sky-100">
        Genuinely empty
      </Badge>
    );
  }
  if (status === "blocked") {
    return (
      <Badge className="border-red-400/25 bg-red-400/10 text-red-100">Blocked</Badge>
    );
  }
  return (
    <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
      Unavailable
    </Badge>
  );
}

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: number | string | null): string {
  if (value === null || value === "") return "Not recorded";
  if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp) && /\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(timestamp).toLocaleString();
  }
  return value;
}

export default function AdminProductionAcceptancePage() {
  const reportQuery = useQuery<AcceptanceReport>({
    queryKey: ["/api/admin/production-acceptance"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/production-acceptance") as Promise<AcceptanceReport>,
    staleTime: 0,
    retry: false,
  });

  const report = reportQuery.data;
  const allAccepted =
    report && report.summary.blocked === 0 && report.summary.unavailable === 0;

  return (
    <AdminWorkspace data-testid="admin-production-acceptance">
      <AdminSection
        title="Production acceptance"
        description="Current production truth across the operating lanes. The report separates working systems, genuinely empty systems, unavailable sources, and hard blockers."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => reportQuery.refetch()}
            disabled={reportQuery.isFetching}
            className="border-white/12 bg-transparent text-white/65"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`}
            />
            Run acceptance
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Working",
              value: reportQuery.isError ? "—" : report?.summary.working ?? 0,
              detail: "Sources and operating rules passed",
              tone: reportQuery.isError ? "warning" : "good",
            },
            {
              label: "Genuinely empty",
              value: reportQuery.isError ? "—" : report?.summary.genuinely_empty ?? 0,
              detail: "Source works; no real records exist",
              tone: reportQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Unavailable",
              value: reportQuery.isError ? "—" : report?.summary.unavailable ?? 0,
              detail: "Required source could not be read",
              tone:
                reportQuery.isError || Number(report?.summary.unavailable || 0) > 0
                  ? "warning"
                  : "good",
            },
            {
              label: "Blocked",
              value: reportQuery.isError ? "—" : report?.summary.blocked ?? 0,
              detail: "Hard data or operating failure",
              tone:
                reportQuery.isError || Number(report?.summary.blocked || 0) > 0
                  ? "danger"
                  : "good",
            },
          ]}
        />
      </AdminSection>

      {reportQuery.isLoading ? (
        <div className="flex min-h-56 items-center justify-center border-y border-white/10 text-sm text-white/45">
          <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
          Running production acceptance…
        </div>
      ) : reportQuery.isError || !report ? (
        <AdminEmptyState
          title="Production acceptance is unavailable"
          description="The authenticated report endpoint did not return a usable result. No production operating record was changed."
          action={
            <Button variant="outline" onClick={() => reportQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <div
            className={`flex items-start gap-3 border-y px-4 py-4 text-sm leading-6 ${
              allAccepted
                ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-100"
                : "border-amber-400/20 bg-amber-400/5 text-amber-100"
            }`}
          >
            {allAccepted ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {allAccepted
                  ? "No blocked or unavailable operating lane"
                  : "Production attention is required"}
              </p>
              <p className="mt-1 opacity-75">
                Generated {new Date(report.generatedAt).toLocaleString()}
                {report.revision ? ` · revision ${report.revision.slice(0, 12)}` : ""}
              </p>
            </div>
          </div>

          <AdminSection
            title="Controlled write canary"
            description="This proves database transaction write and rollback without retaining a customer, partner, request, finance, inventory, or profile record."
            className="pt-0"
          >
            <div
              className={`flex items-start gap-3 border-y px-4 py-4 text-sm leading-6 ${
                report.controlledWriteCanary.status === "passed"
                  ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-100"
                  : "border-red-400/20 bg-red-400/5 text-red-100"
              }`}
            >
              <Database className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {report.controlledWriteCanary.status === "passed" ? "Passed" : "Failed"}
                </p>
                <p className="mt-1 opacity-75">{report.controlledWriteCanary.detail}</p>
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Operating lanes"
            description="Open any lane directly from its acceptance record. Counts are current production evidence, not sample data."
            className="pt-0"
          >
            <AdminList>
              {report.lanes.map((lane) => (
                <details key={lane.id} className="group">
                  <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(14rem,0.7fr)_auto_minmax(0,1.3fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                    <div>
                      <p className="font-semibold text-white">{lane.label}</p>
                      <p className="mt-1 font-mono text-xs text-white/30">{lane.id}</p>
                    </div>
                    {statusBadge(lane.status)}
                    <p className="text-sm leading-6 text-white/52">{lane.summary}</p>
                    <a
                      href={lane.workspacePath}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex min-h-9 items-center justify-center border border-white/12 px-3 text-xs font-semibold text-white/62 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Open workspace
                    </a>
                  </summary>
                  <div className="space-y-5 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(lane.counts).map(([key, value]) => (
                        <div key={key} className="border-y border-white/10 px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            {readable(key)}
                          </p>
                          <p className="mt-2 break-words text-sm font-semibold text-white/68">
                            {formatValue(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                        Findings
                      </p>
                      <div className="mt-3 space-y-2">
                        {lane.findings.map((finding, index) => (
                          <p key={`${lane.id}-${index}`} className="text-sm leading-6 text-white/52">
                            {finding}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </AdminList>
          </AdminSection>

          <div className="border-y border-white/10 px-4 py-4 text-xs leading-5 text-white/38">
            Database checked {new Date(report.database.checkedAt).toLocaleString()}. Status labels: {" "}
            {Object.entries(STATUS_LABEL)
              .map(([key, label]) => `${label} (${key})`)
              .join(" · ")}.
          </div>
        </>
      )}
    </AdminWorkspace>
  );
}
