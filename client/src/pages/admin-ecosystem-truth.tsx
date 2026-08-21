import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Link2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminWorkspace,
  AdminWorkspaceSubnav,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type {
  AdminEcosystemTruthReport,
  CommercialTermEvidenceState,
  EcosystemTruthState,
} from "@shared/adminEcosystemTruth";

type TruthView = "owners" | "decisions" | "terms" | "outcomes";

const VIEWS: Array<{ id: TruthView; label: string }> = [
  { id: "owners", label: "Current owners" },
  { id: "decisions", label: "Decision history" },
  { id: "terms", label: "Commercial terms" },
  { id: "outcomes", label: "Outcome links" },
];

function stateBadge(state: EcosystemTruthState) {
  if (state === "confirmed") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Confirmed
      </Badge>
    );
  }
  if (state === "attention") {
    return (
      <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
        Needs attention
      </Badge>
    );
  }
  if (state === "unknown") {
    return (
      <Badge className="border-sky-400/25 bg-sky-400/10 text-sky-100">Unknown</Badge>
    );
  }
  return (
    <Badge className="border-red-400/25 bg-red-400/10 text-red-100">Unavailable</Badge>
  );
}

function evidenceBadge(state: CommercialTermEvidenceState) {
  if (state === "source_linked") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Source linked
      </Badge>
    );
  }
  if (state === "partial") {
    return (
      <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
        Partial evidence
      </Badge>
    );
  }
  return <Badge className="border-red-400/25 bg-red-400/10 text-red-100">Missing evidence</Badge>;
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

function shortReference(value: string | null): string {
  if (!value) return "No cross-domain reference";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function SourceLink({ href, label = "Open owner" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-9 items-center justify-center border border-white/12 px-3 text-xs font-semibold text-white/62 transition hover:bg-white/[0.05] hover:text-white"
    >
      {label}
      <ExternalLink className="ml-2 h-3.5 w-3.5" />
    </a>
  );
}

export default function AdminEcosystemTruthPage() {
  const [view, setView] = useState<TruthView>("owners");
  const reportQuery = useQuery<AdminEcosystemTruthReport>({
    queryKey: ["/api/admin/ecosystem-truth"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/ecosystem-truth") as Promise<AdminEcosystemTruthReport>,
    staleTime: 0,
    retry: false,
  });
  const report = reportQuery.data;
  const reportReady = Boolean(report) && !reportQuery.isError;

  return (
    <AdminWorkspace data-testid="admin-ecosystem-truth">
      <AdminSection
        title="Ecosystem Truth"
        description="One read-only view of who owns each fact, which decisions and terms need evidence, and where requests stop connecting to outcomes. Existing systems remain authoritative."
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
            Refresh current truth
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Confirmed owners",
              value: reportReady ? report?.summary.confirmedOwners ?? 0 : "—",
              detail: reportReady ? "Current sources answered" : "Checking current sources",
              tone: reportReady ? "good" : "warning",
            },
            {
              label: "Owners needing attention",
              value: reportReady ? report?.summary.ownersNeedingAttention ?? 0 : "—",
              detail: reportReady ? "Unknown, conflicted, or unavailable" : "Checking ownership",
              tone:
                reportReady && Number(report?.summary.ownersNeedingAttention || 0) === 0
                  ? "good"
                  : "warning",
            },
            {
              label: "Terms needing evidence",
              value: reportReady ? report?.summary.commercialRecordsNeedingEvidence ?? 0 : "—",
              detail: reportReady ? "Not proven as signed terms" : "Checking commercial records",
              tone:
                reportReady && Number(report?.summary.commercialRecordsNeedingEvidence || 0) === 0
                  ? "good"
                  : "warning",
            },
            {
              label: "Unlinked outcomes",
              value: reportReady ? report?.summary.unlinkedOutcomeEvents ?? 0 : "—",
              detail: reportReady ? "Missing parent or cross-system reference" : "Checking evidence links",
              tone:
                reportReady && Number(report?.summary.unlinkedOutcomeEvents || 0) === 0
                  ? "good"
                  : "danger",
            },
          ]}
        />
      </AdminSection>

      <div className="flex items-start gap-3 border-y border-sky-400/20 bg-sky-400/5 px-4 py-4 text-sm leading-6 text-sky-100">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Read-only operating view</p>
          <p className="mt-1 opacity-75">
            This workspace does not change identity, requests, inventory, agreements, payments,
            rankings, or public pages. Unknown information stays unknown.
          </p>
        </div>
      </div>

      <AdminWorkspaceSubnav aria-label="Ecosystem Truth views">
        <div className="flex gap-2 overflow-x-auto">
          {VIEWS.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="outline"
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "min-h-9 shrink-0 border px-3 text-xs font-semibold transition",
                view === item.id
                  ? "border-white/24 bg-white/[0.08] text-white"
                  : "border-white/10 text-white/48 hover:bg-white/[0.04] hover:text-white/75"
              )}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </AdminWorkspaceSubnav>

      {reportQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/45">
          <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
          Reading current source owners…
        </div>
      ) : reportQuery.isError || !report ? (
        <AdminEmptyState
          title="Ecosystem Truth is unavailable"
          description="The source-backed report could not be read. No empty or guessed values were shown, and no operating record was changed."
          action={
            <Button variant="outline" onClick={() => reportQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : view === "owners" ? (
        <AdminSection
          title="Current source owners"
          description="Each area stays with the system that already owns its operating truth. Attention means a source is missing, conflicted, or contains broken links—not that a new database should replace it."
          className="pt-0"
        >
          <AdminList>
            {report.owners.map((owner) => (
              <details key={owner.id} className="group">
                <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(14rem,0.75fr)_auto_minmax(0,1.35fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                  <div>
                    <p className="font-semibold text-white">{owner.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/35">{owner.authority}</p>
                  </div>
                  {stateBadge(owner.state)}
                  <p className="text-sm leading-6 text-white/52">{owner.summary}</p>
                  <SourceLink href={owner.workspacePath} />
                </summary>
                <div className="space-y-5 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Owns
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/58">{owner.owns}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(owner.counts).map(([key, value]) => (
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
                  <div className="space-y-2">
                    {owner.findings.map((finding, index) => (
                      <p key={`${owner.id}-${index}`} className="text-sm leading-6 text-white/52">
                        {finding}
                      </p>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </AdminList>
        </AdminSection>
      ) : view === "decisions" ? (
        <>
          <AdminSection
            title="Decision sources"
            description="The current system has governing documents, audit evidence, and narrower operating decisions. It does not yet have one durable decision authority with effective and superseded history."
            className="pt-0"
          >
            <AdminList>
              {report.decisionProvenance.sources.map((source) => (
                <div
                  key={source.id}
                  className="grid gap-3 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(14rem,0.8fr)_auto_minmax(0,1.2fr)_auto] lg:items-center"
                >
                  <p className="font-semibold text-white">{source.label}</p>
                  <Badge className="border-white/12 bg-white/[0.04] text-white/58">
                    {readable(source.authority)}
                  </Badge>
                  <p className="text-sm leading-6 text-white/52">{source.scope}</p>
                  {source.workspacePath ? <SourceLink href={source.workspacePath} /> : <span />}
                </div>
              ))}
            </AdminList>
          </AdminSection>

          <AdminSection
            title="Missing durable-decision fields"
            description="These fields must exist before a decision can safely become a shared authority."
            className="pt-0"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {report.decisionProvenance.missingGovernanceFields.map((field) => (
                <div key={field} className="border-y border-amber-400/15 bg-amber-400/[0.025] px-3 py-3">
                  <p className="text-sm font-semibold text-amber-100">{field}</p>
                  <p className="mt-1 text-xs leading-5 text-white/38">Not currently proven</p>
                </div>
              ))}
            </div>
          </AdminSection>

          <AdminSection
            title="Recent operating decisions"
            description="These records remain operational evidence. They are not promoted into permanent business truth by this view."
            className="pt-0"
          >
            {report.decisionProvenance.items.length === 0 ? (
              <AdminEmptyState
                title="No readable operating decisions"
                description="The current decision sources are empty or unavailable. No decision was invented."
              />
            ) : (
              <AdminList>
                {report.decisionProvenance.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(14rem,1fr)_auto_minmax(10rem,0.6fr)_auto] lg:items-center"
                  >
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-white/35">{item.source}</p>
                    </div>
                    <Badge className="border-white/12 bg-white/[0.04] text-white/58">
                      {item.decision}
                    </Badge>
                    <p className="text-sm text-white/52">{item.domain}</p>
                    <p className="text-xs text-white/35">
                      {item.decidedAt ? new Date(item.decidedAt).toLocaleString() : "Date unknown"}
                    </p>
                  </div>
                ))}
              </AdminList>
            )}
          </AdminSection>
        </>
      ) : view === "terms" ? (
        <>
          <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-4 text-sm leading-6 text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Evidence index only</p>
              <p className="mt-1 opacity-75">
                A saved rate, payout, order total, or conversation is not shown as a signed agreement.
                Current domain records keep their authority.
              </p>
            </div>
          </div>

          <AdminSection
            title="Commercial terms requiring proof"
            description={`${report.commercialTerms.recordsReviewed} record(s) reviewed · ${report.commercialTerms.needsEvidence} need more evidence · ${report.commercialTerms.conflicts} active conflict group(s).`}
            className="pt-0"
          >
            {report.commercialTerms.items.length === 0 ? (
              <AdminEmptyState
                title="No readable commercial records"
                description="The current sources are empty or unavailable. No agreement term was invented."
              />
            ) : (
              <AdminList>
                {report.commercialTerms.items.map((item) => (
                  <details key={item.id} className="group">
                    <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(14rem,1fr)_auto_minmax(12rem,0.75fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-white/35">{item.source}</p>
                      </div>
                      {evidenceBadge(item.evidenceState)}
                      <p className="text-sm leading-6 text-white/52">{item.recordedTerm}</p>
                      <Badge className="border-white/12 bg-white/[0.04] text-white/58">
                        {item.lifecycleStatus}
                      </Badge>
                    </summary>
                    <div className="space-y-4 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="border-y border-white/10 px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            Domain
                          </p>
                          <p className="mt-2 text-sm text-white/62">{item.domain}</p>
                        </div>
                        <div className="border-y border-white/10 px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            Effective
                          </p>
                          <p className="mt-2 text-sm text-white/62">{formatValue(item.effectiveAt)}</p>
                        </div>
                        <div className="border-y border-white/10 px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            Expires
                          </p>
                          <p className="mt-2 text-sm text-white/62">{formatValue(item.expiresAt)}</p>
                        </div>
                      </div>
                      {item.findings.map((finding, index) => (
                        <p key={`${item.id}-${index}`} className="text-sm leading-6 text-white/52">
                          {finding}
                        </p>
                      ))}
                    </div>
                  </details>
                ))}
              </AdminList>
            )}
          </AdminSection>
        </>
      ) : (
        <>
          <AdminSection
            title="Outcome source coverage"
            description="Each source keeps its own truth. This view only checks whether its records still connect to their expected parent or cross-system reference."
            className="pt-0"
          >
            <AdminList>
              {report.outcomeCoverage.sources.map((source) => (
                <div
                  key={source.id}
                  className="grid gap-3 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(14rem,0.9fr)_auto_minmax(12rem,0.75fr)_minmax(13rem,1fr)_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-white">{source.label}</p>
                    <p className="mt-1 text-xs text-white/35">{source.authority}</p>
                  </div>
                  {stateBadge(source.state)}
                  <p className="text-sm text-white/52">
                    {source.linkedCount} linked · {source.unlinkedCount} unlinked · {source.recordCount} total
                  </p>
                  <p className="text-sm leading-6 text-white/45">{source.finding}</p>
                  <SourceLink href={source.workspacePath} />
                </div>
              ))}
            </AdminList>
          </AdminSection>

          <AdminSection
            title="Latest cross-domain evidence"
            description="A combined timeline of existing events. It does not create, copy, or backfill an event."
            className="pt-0"
          >
            {report.outcomeCoverage.timeline.length === 0 ? (
              <AdminEmptyState
                title="No readable outcome evidence"
                description="The current event sources are empty or unavailable. No historical event was manufactured."
              />
            ) : (
              <AdminList>
                {report.outcomeCoverage.timeline.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(13rem,0.85fr)_minmax(12rem,0.8fr)_auto_minmax(12rem,0.8fr)_auto] lg:items-center"
                  >
                    <div>
                      <p className="font-semibold text-white">{item.eventType}</p>
                      <p className="mt-1 text-xs text-white/35">{item.source}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/52">
                      <Link2 className="h-3.5 w-3.5" />
                      <span>{item.linkType ? readable(item.linkType) : "No link type"}</span>
                    </div>
                    {item.state === "linked" ? (
                      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
                        Linked
                      </Badge>
                    ) : (
                      <Badge className="border-red-400/25 bg-red-400/10 text-red-100">
                        Unlinked
                      </Badge>
                    )}
                    <p className="font-mono text-xs text-white/38">{shortReference(item.linkId)}</p>
                    <p className="text-xs text-white/35">
                      {item.occurredAt ? new Date(item.occurredAt).toLocaleString() : "Date unknown"}
                    </p>
                  </div>
                ))}
              </AdminList>
            )}
          </AdminSection>
        </>
      )}

      {report ? (
        <AdminSection
          title="Protected boundaries"
          description="These rules apply to every view in this workspace."
          className="pt-0"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {report.protections.map((protection) => (
              <div
                key={protection}
                className="flex items-start gap-3 border-y border-white/10 px-3 py-3 text-sm leading-6 text-white/52"
              >
                {protection.includes("No historical") ? (
                  <CircleHelp className="mt-1 h-3.5 w-3.5 shrink-0 text-sky-200" />
                ) : (
                  <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                )}
                <span>{protection}</span>
              </div>
            ))}
          </div>
        </AdminSection>
      ) : null}
    </AdminWorkspace>
  );
}
