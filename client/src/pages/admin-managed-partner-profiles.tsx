import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Globe2,
  Link2,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

type HealthStatus = "ready" | "attention" | "blocked";
type IssueSeverity = "blocker" | "attention" | "info";

type ManagedPartnerIssue = {
  severity: IssueSeverity;
  code: string;
  message: string;
};

type ManagedPartnerProfile = {
  slug: string;
  displayName: string;
  profileUrl: string;
  archetype: string;
  controlMode: string;
  contactMode: string;
  exposureMode: string;
  requestMode: string;
  requestRecipientSlug: string;
  sourceWebsite?: string;
  relationshipLabel?: string;
  notes: string;
  status: HealthStatus;
  issues: ManagedPartnerIssue[];
  current: {
    businessExists: boolean;
    profileExists: boolean;
    businessStatus: string | null;
    profileStatus: string | null;
    claimStatus: string | null;
    publicDiscoveryEnabled: boolean | null;
    ownershipConsistent: boolean;
    ownerRole: string | null;
    ownerVerified: boolean;
    profileControl: string | null;
    contactManagement: string | null;
    phone: string | null;
    email: string | null;
    notificationEmail: string | null;
    primaryCta: string | null;
    headline: string | null;
  };
  expected: {
    phone: string | null;
    email: string | null;
    notificationEmail: string | null;
    primaryCta: string | null;
  };
};

type ManagedPartnerHealthReport = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    attention: number;
    blocked: number;
  };
  items: ManagedPartnerProfile[];
};

function readable(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (!text) return "Not set";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadge(status: HealthStatus) {
  if (status === "ready") {
    return (
      <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Ready</Badge>
    );
  }
  if (status === "blocked") {
    return <Badge className="border-red-400/30 bg-red-400/10 text-red-200">Blocked</Badge>;
  }
  return (
    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">
      Needs attention
    </Badge>
  );
}

function issueIcon(severity: IssueSeverity) {
  if (severity === "blocker") {
    return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />;
  }
  if (severity === "attention") {
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />;
  }
  return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />;
}

export default function AdminManagedPartnerProfilesPage() {
  const [statusFilter, setStatusFilter] = useState<"all" | HealthStatus>("all");
  const [search, setSearch] = useState("");
  const reportQuery = useQuery({
    queryKey: ["/api/admin/managed-partners"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/admin/managed-partners")) as ManagedPartnerHealthReport,
    refetchInterval: 60_000,
  });

  const report = reportQuery.data;
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (report?.items || []).filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!query) return true;
      return [
        item.displayName,
        item.slug,
        item.archetype,
        item.controlMode,
        item.contactMode,
        item.requestRecipientSlug,
        item.current.headline,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [report?.items, search, statusFilter]);

  if (reportQuery.isLoading) {
    return (
      <div className="flex min-h-56 items-center justify-center border-y border-white/10 text-sm text-white/55">
        <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
        Auditing managed partner profiles…
      </div>
    );
  }

  if (reportQuery.isError || !report) {
    return (
      <div className="border-y border-red-400/20 bg-red-950/15 px-4 py-8 text-red-100">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5" />
          Managed profile audit unavailable
        </div>
        <p className="mt-2 text-sm text-red-100/70">
          Existing profiles remain live. Retry the read-only audit without changing partner data.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => reportQuery.refetch()}
          className="mt-4 border-red-200/25 bg-transparent text-red-50 hover:bg-red-100/10"
        >
          Retry audit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="managed-partner-profile-ops">
      <AdminSection
        title="Live profile health"
        description="One operating view of publication, ownership, contact, discovery, and request routing. Expand a partner only when the summary shows something worth inspecting."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => reportQuery.refetch()}
            disabled={reportQuery.isFetching}
            className="border-white/12 bg-white/[0.025] text-white/70 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`}
            />
            Recheck
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Tracked",
              value: report.summary.total,
              detail: "Managed and temporarily stewarded profiles",
            },
            {
              label: "Ready",
              value: report.summary.ready,
              detail: "No operating gap found",
              tone: "good",
            },
            {
              label: "Needs attention",
              value: report.summary.attention,
              detail: "A named owner or admin decision remains",
              tone: "warning",
            },
            {
              label: "Blocked",
              value: report.summary.blocked,
              detail: "Contact, ownership, or publication failure",
              tone: report.summary.blocked > 0 ? "danger" : "neutral",
            },
          ]}
        />

        <AdminToolbar className="mt-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search partner, profile type, control, or request recipient"
            className="min-w-0 border-white/10 bg-black/20 text-white placeholder:text-white/30 md:max-w-2xl"
          />
          <div className="flex items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
            >
              <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="attention">Needs attention</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <span className="hidden text-xs text-white/35 xl:inline">
              Audited {new Date(report.generatedAt).toLocaleString()}
            </span>
          </div>
        </AdminToolbar>

        {filteredItems.length ? (
          <AdminList className="mt-4">
            {filteredItems.map((item) => (
              <details key={item.slug} className="group" data-status={item.status}>
                <summary className="grid cursor-pointer list-none gap-3 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1.4fr)_minmax(11rem,0.9fr)_minmax(11rem,0.9fr)_minmax(10rem,0.8fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-white">{item.displayName}</h3>
                      {statusBadge(item.status)}
                    </div>
                    <p className="mt-1 truncate text-xs text-white/38">/{item.slug}</p>
                    {item.current.headline ? (
                      <p className="mt-2 line-clamp-1 text-sm text-white/55">{item.current.headline}</p>
                    ) : null}
                  </div>

                  <div className="min-w-0 text-sm text-white/60">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                      Contact
                    </p>
                    <p className="mt-1 truncate">{item.current.phone || "Phone pending"}</p>
                    <p className="truncate text-xs text-white/38">
                      {item.current.email || "Email pending"}
                    </p>
                  </div>

                  <div className="min-w-0 text-sm text-white/60">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                      Control
                    </p>
                    <p className="mt-1 truncate">{readable(item.controlMode)}</p>
                    <p className="truncate text-xs text-white/38">{readable(item.exposureMode)}</p>
                  </div>

                  <div className="min-w-0 text-sm text-white/60">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                      Requests
                    </p>
                    <p className="mt-1 truncate">{item.requestRecipientSlug}</p>
                    <p className="truncate text-xs text-white/38">{readable(item.requestMode)}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <span className="text-xs text-white/38">
                      {item.issues.length} check{item.issues.length === 1 ? "" : "s"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white/35 transition-transform group-open:rotate-180" />
                  </div>
                </summary>

                <div className="border-t border-white/10 bg-white/[0.018] px-3 py-5 sm:px-4">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                    <div className="space-y-5">
                      <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                            Profile operation
                          </p>
                          <div className="mt-2 space-y-2 text-white/65">
                            <p className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-orange-300" />
                              {readable(item.controlMode)}
                            </p>
                            <p className="flex items-center gap-2">
                              <Globe2 className="h-4 w-4 text-orange-300" />
                              {readable(item.exposureMode)}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                            Contact and ownership
                          </p>
                          <div className="mt-2 space-y-2 text-white/65">
                            <p className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-orange-300" />
                              {item.current.phone || "Phone pending"}
                            </p>
                            <p className="flex items-center gap-2 break-all">
                              <Mail className="h-4 w-4 shrink-0 text-orange-300" />
                              {item.current.email || "Email pending"}
                            </p>
                            <p className="flex items-center gap-2">
                              <UserRoundCheck className="h-4 w-4 text-orange-300" />
                              {item.current.ownershipConsistent
                                ? "Ownership links agree"
                                : "Ownership mismatch"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                            Request path
                          </p>
                          <div className="mt-2 space-y-2 text-white/65">
                            <p className="flex items-center gap-2">
                              <Link2 className="h-4 w-4 text-orange-300" />
                              Requests → {item.requestRecipientSlug}
                            </p>
                            <p>{readable(item.requestMode)}</p>
                            <p className="text-white/40">
                              Primary action: {item.current.primaryCta || "Not set"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {item.relationshipLabel ? (
                        <div className="border-l-2 border-orange-400 bg-orange-400/5 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200">
                            Verified relationship
                          </p>
                          <p className="mt-2 text-sm leading-6 text-white/65">
                            {item.relationshipLabel}
                          </p>
                        </div>
                      ) : null}

                      <p className="text-sm leading-6 text-white/45">{item.notes}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                        Operating checks
                      </p>
                      <div className="mt-3 space-y-2">
                        {item.issues.length ? (
                          item.issues.map((issue) => (
                            <div
                              key={`${item.slug}-${issue.code}`}
                              className="flex items-start gap-2 border-l border-white/12 bg-black/15 px-3 py-2.5 text-sm leading-6 text-white/62"
                            >
                              {issueIcon(issue.severity)}
                              <span>{issue.message}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 border-l border-emerald-400/30 bg-emerald-400/5 px-3 py-3 text-sm text-emerald-100">
                            <CheckCircle2 className="h-4 w-4" />
                            No operating gaps found.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    <a
                      href={item.profileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                    >
                      Open live profile
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    {item.sourceWebsite ? (
                      <a
                        href={item.sourceWebsite}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.025] px-4 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        Open source presence
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </details>
            ))}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No managed profiles match this view"
            description="Change the search or status filter. Existing profiles remain live while the audit view is filtered."
          />
        )}
      </AdminSection>
    </div>
  );
}
