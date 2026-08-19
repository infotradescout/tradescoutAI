import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadge(status: HealthStatus) {
  if (status === "ready") {
    return (
      <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
        Ready
      </Badge>
    );
  }
  if (status === "blocked") {
    return (
      <Badge className="border-red-400/30 bg-red-400/10 text-red-200">
        Blocked
      </Badge>
    );
  }
  return (
    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">
      Needs attention
    </Badge>
  );
}

function issueIcon(severity: IssueSeverity) {
  if (severity === "blocker") return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />;
  if (severity === "attention") {
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />;
  }
  return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />;
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card className="border-white/10 bg-black/20">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        <p className="mt-1 text-xs leading-5 text-white/55">{detail}</p>
      </CardContent>
    </Card>
  );
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
      <Card className="border-white/10 bg-tsCard/95">
        <CardContent className="flex min-h-52 items-center justify-center p-8 text-white/70">
          <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
          Auditing managed partner profiles…
        </CardContent>
      </Card>
    );
  }

  if (reportQuery.isError || !report) {
    return (
      <Card className="border-red-400/20 bg-red-950/20">
        <CardContent className="p-6 text-red-100">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5" />
            Managed profile audit unavailable
          </div>
          <p className="mt-2 text-sm text-red-100/75">
            The partner queue could not be loaded. Existing profiles remain live.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => reportQuery.refetch()}
            className="mt-4 border-red-200/30 bg-transparent text-red-50 hover:bg-red-100/10"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="managed-partner-profile-ops">
      <Card className="border-white/10 bg-tsCard/95">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-ts-orange" />
              Managed Partner Profiles
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-white/65">
              Live control, contact, routing, discovery, and ownership checks for every active
              TradeScout-managed or temporarily stewarded partner profile. New partners can enter
              while existing profiles and shared tools continue moving.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => reportQuery.refetch()}
            disabled={reportQuery.isFetching}
            className="border-white/15 bg-black/20 text-white hover:bg-white/10"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh audit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Tracked" value={report.summary.total} detail="Current managed and stewarded profiles" />
            <SummaryCard label="Ready" value={report.summary.ready} detail="No operating gaps found" />
            <SummaryCard label="Attention" value={report.summary.attention} detail="Live, but an owner or admin decision remains" />
            <SummaryCard label="Blocked" value={report.summary.blocked} detail="A contact, ownership, or publication failure exists" />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search partner, profile type, control, or recipient"
              className="border-white/10 bg-black/25 text-white placeholder:text-white/35"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="border-white/10 bg-black/25 text-white">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="attention">Needs attention</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-white/45">
            Last audited {new Date(report.generatedAt).toLocaleString()} · refreshes every minute
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredItems.map((item) => (
          <Card key={item.slug} className="overflow-hidden border-white/10 bg-tsCard/95">
            <CardHeader className="border-b border-white/8 bg-black/15">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl text-white">{item.displayName}</CardTitle>
                  <CardDescription className="mt-1 text-white/50">/{item.slug}</CardDescription>
                </div>
                {statusBadge(item.status)}
              </div>
              {item.current.headline ? (
                <p className="pt-2 text-sm leading-6 text-white/70">{item.current.headline}</p>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-5 p-5">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded border border-white/8 bg-black/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Profile operation
                  </p>
                  <div className="mt-3 space-y-2 text-white/75">
                    <p className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-ts-orange" />
                      {readable(item.controlMode)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-ts-orange" />
                      {readable(item.exposureMode)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-ts-orange" />
                      Requests → {item.requestRecipientSlug}
                    </p>
                  </div>
                </div>

                <div className="rounded border border-white/8 bg-black/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Contact and ownership
                  </p>
                  <div className="mt-3 space-y-2 text-white/75">
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-ts-orange" />
                      {item.current.phone || "Phone pending"}
                    </p>
                    <p className="flex items-center gap-2 break-all">
                      <Mail className="h-4 w-4 shrink-0 text-ts-orange" />
                      {item.current.email || "Email pending"}
                    </p>
                    <p className="flex items-center gap-2">
                      <UserRoundCheck className="h-4 w-4 text-ts-orange" />
                      {item.current.ownershipConsistent ? "Ownership links agree" : "Ownership mismatch"}
                    </p>
                  </div>
                </div>
              </div>

              {item.relationshipLabel ? (
                <div className="rounded border border-ts-orange/25 bg-ts-orange/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ts-orange">
                    Verified relationship
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/75">{item.relationshipLabel}</p>
                </div>
              ) : null}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  Operating checks
                </p>
                {item.issues.length ? (
                  <div className="mt-3 space-y-2">
                    {item.issues.map((issue) => (
                      <div
                        key={`${item.slug}-${issue.code}`}
                        className="flex items-start gap-2 rounded border border-white/8 bg-black/15 p-3 text-sm leading-6 text-white/72"
                      >
                        {issueIcon(issue.severity)}
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 rounded border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    No operating gaps found.
                  </div>
                )}
              </div>

              <p className="text-xs leading-5 text-white/45">{item.notes}</p>

              <div className="flex flex-wrap gap-2">
                <a
                  href={item.profileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-ts-orange px-4 text-sm font-semibold text-black transition hover:bg-ts-orange/90"
                >
                  Open live profile
                  <ExternalLink className="h-4 w-4" />
                </a>
                {item.sourceWebsite ? (
                  <a
                    href={item.sourceWebsite}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 bg-black/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Open source presence
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <Card className="border-white/10 bg-black/20">
          <CardContent className="p-8 text-center text-white/60">
            No managed profiles match this filter.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
