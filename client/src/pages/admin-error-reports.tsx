import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bug,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Monitor,
  RefreshCw,
  Smartphone,
  User,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import type { ErrorReport } from "@shared/schema";

type ErrorReportPatch = {
  status?: string;
  priority?: string;
};

type ScreenshotAttachment = {
  type?: string;
  data?: string;
};

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed", "duplicate"] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"] as const;
const TYPE_OPTIONS = [
  "bug",
  "ui_issue",
  "performance",
  "feature_request",
  "automatic_screenshot",
  "other",
] as const;

function safeStatus(value: unknown): string {
  return String(value || "open").trim() || "open";
}

function safePriority(value: unknown): string {
  return String(value || "medium").trim() || "medium";
}

function safeType(value: unknown): string {
  return String(value || "bug").trim() || "bug";
}

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportDate(value: unknown): string {
  if (!value) return "Unknown date";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown date";
}

function safePathname(rawUrl: unknown): string | null {
  const raw = String(rawUrl || "").trim();
  if (!raw) return null;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://thetradescout.com";
    const url = new URL(raw, base);
    return `${url.pathname}${url.search}`;
  } catch {
    return raw;
  }
}

function statusBadge(status: string) {
  const classes: Record<string, string> = {
    open: "border-red-400/30 bg-red-400/10 text-red-200",
    in_progress: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    resolved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    closed: "border-white/15 bg-white/5 text-white/55",
    duplicate: "border-sky-400/25 bg-sky-400/10 text-sky-100",
  };
  return <Badge className={classes[status] || classes.open}>{readable(status)}</Badge>;
}

function priorityBadge(priority: string) {
  const classes: Record<string, string> = {
    low: "border-white/15 bg-white/5 text-white/55",
    medium: "border-sky-400/20 bg-sky-400/8 text-sky-100",
    high: "border-orange-400/30 bg-orange-400/10 text-orange-100",
    critical: "border-red-400/35 bg-red-400/12 text-red-100",
  };
  return <Badge className={classes[priority] || classes.medium}>{readable(priority)}</Badge>;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "performance") return <Clock className="h-4 w-4" />;
  if (type === "ui_issue") return <Monitor className="h-4 w-4" />;
  if (type === "feature_request") return <AlertTriangle className="h-4 w-4" />;
  if (type === "automatic_screenshot") return <Smartphone className="h-4 w-4" />;
  return <Bug className="h-4 w-4" />;
}

function screenshotFrom(attachments: unknown): ScreenshotAttachment | null {
  if (!Array.isArray(attachments)) return null;
  const screenshot = attachments.find(
    (entry) => entry && typeof entry === "object" && (entry as ScreenshotAttachment).type === "screenshot"
  ) as ScreenshotAttachment | undefined;
  return screenshot?.data ? screenshot : null;
}

function priorityRank(priority: string): number {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  if (priority === "medium") return 2;
  return 3;
}

function statusRank(status: string): number {
  if (status === "open") return 0;
  if (status === "in_progress") return 1;
  if (status === "resolved") return 2;
  return 3;
}

export default function AdminErrorReports() {
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reportsQuery = useQuery<ErrorReport[]>({
    queryKey: ["/api/admin/error-reports"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/error-reports");
      return Array.isArray(response) ? (response as ErrorReport[]) : [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ErrorReportPatch }) =>
      apiRequest("PATCH", `/api/admin/error-reports/${id}`, data),
    onSuccess: async (_response, variables) => {
      setSelectedReport((current) =>
        current && String(current.id) === variables.id
          ? ({ ...current, ...variables.data } as ErrorReport)
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/error-reports"] });
      toast({
        title: "Error report updated",
        description: "The operating status was saved.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error report was not updated",
        description: formatUserFacingErrorMessage(error, "Review the change and try again."),
        variant: "destructive",
      });
    },
  });

  const reports = reportsQuery.data || [];
  const filteredReports = useMemo(
    () =>
      reports
        .filter((report) => {
          if (filterStatus !== "all" && safeStatus(report.status) !== filterStatus) return false;
          if (filterType !== "all" && safeType(report.errorType) !== filterType) return false;
          return true;
        })
        .sort((a, b) => {
          const statusDifference = statusRank(safeStatus(a.status)) - statusRank(safeStatus(b.status));
          if (statusDifference !== 0) return statusDifference;
          const priorityDifference =
            priorityRank(safePriority(a.priority)) - priorityRank(safePriority(b.priority));
          if (priorityDifference !== 0) return priorityDifference;
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }),
    [filterStatus, filterType, reports]
  );

  const counts = useMemo(
    () => ({
      open: reports.filter((report) => safeStatus(report.status) === "open").length,
      inProgress: reports.filter((report) => safeStatus(report.status) === "in_progress").length,
      unresolved: reports.filter((report) =>
        ["open", "in_progress"].includes(safeStatus(report.status))
      ).length,
      critical: reports.filter(
        (report) =>
          safePriority(report.priority) === "critical" &&
          !["resolved", "closed", "duplicate"].includes(safeStatus(report.status))
      ).length,
    }),
    [reports]
  );

  const updateReport = (report: ErrorReport, patch: ErrorReportPatch) => {
    updateMutation.mutate({ id: String(report.id), data: patch });
  };

  if (reportsQuery.isLoading) {
    return (
      <AdminWorkspace>
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/50">
          <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
          Loading error reports…
        </div>
      </AdminWorkspace>
    );
  }

  if (reportsQuery.isError) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Error reports are unavailable"
          description="The queue could not be read. No report state was changed."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => reportsQuery.refetch()}
              className="border-white/15 bg-transparent text-white"
            >
              Retry
            </Button>
          }
        />
      </AdminWorkspace>
    );
  }

  return (
    <AdminWorkspace data-testid="admin-error-reports-v2">
      <AdminSection
        title="Error queue"
        description="Work unresolved reports first. Status and priority changes remain audited through the existing error-report endpoint."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => reportsQuery.refetch()}
            disabled={reportsQuery.isFetching}
            className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${reportsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Unresolved",
              value: counts.unresolved,
              detail: "Open and in progress",
              tone: counts.unresolved > 0 ? "warning" : "good",
            },
            {
              label: "Open",
              value: counts.open,
              detail: "Not yet being worked",
              tone: counts.open > 0 ? "warning" : "good",
            },
            {
              label: "In progress",
              value: counts.inProgress,
              detail: "Currently assigned or under review",
            },
            {
              label: "Critical",
              value: counts.critical,
              detail: "Unresolved critical reports",
              tone: counts.critical > 0 ? "danger" : "good",
            },
          ]}
        />

        <AdminToolbar className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {readable(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[13rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Report type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All report types</SelectItem>
                {TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {readable(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-white/35">
            {filteredReports.length} of {reports.length} reports
          </p>
        </AdminToolbar>

        {filteredReports.length ? (
          <AdminList className="mt-4">
            {filteredReports.map((report) => {
              const status = safeStatus(report.status);
              const priority = safePriority(report.priority);
              const type = safeType(report.errorType);
              const pathname = safePathname(report.currentUrl);
              return (
                <div
                  key={String(report.id)}
                  className="grid gap-4 px-3 py-4 sm:px-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(10rem,0.65fr)_minmax(10rem,0.65fr)_auto] xl:items-center"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedReport(report)}
                    className="min-w-0 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/55">
                        <TypeIcon type={type} />
                      </span>
                      <h3 className="min-w-0 flex-1 truncate font-semibold text-white">
                        {report.title || "Untitled report"}
                      </h3>
                      {statusBadge(status)}
                      {priorityBadge(priority)}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/48">
                      {report.description || "No description was provided."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/35">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {reportDate(report.createdAt)}
                      </span>
                      {report.userEmail ? (
                        <span className="inline-flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          {report.userEmail}
                        </span>
                      ) : null}
                      {pathname ? (
                        <span className="inline-flex max-w-full items-center gap-1.5 truncate">
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{pathname}</span>
                        </span>
                      ) : null}
                      {report.browserInfo?.mobile ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5" />
                          Mobile
                        </span>
                      ) : null}
                    </div>
                  </button>

                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Status
                    </p>
                    <Select
                      value={status}
                      onValueChange={(value) => updateReport(report, { status: value })}
                      disabled={updateMutation.isPending}
                    >
                      <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {readable(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Priority
                    </p>
                    <Select
                      value={priority}
                      onValueChange={(value) => updateReport(report, { priority: value })}
                      disabled={updateMutation.isPending}
                    >
                      <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {readable(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedReport(report)}
                    className="border-white/12 bg-transparent text-white/65 hover:bg-white/[0.05] hover:text-white"
                  >
                    Review
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No reports match these filters"
            description="Change the status or report-type filter to inspect a different part of the queue."
          />
        )}
      </AdminSection>

      {selectedReport ? (
        <ReportDetailDialog
          report={selectedReport}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedReport(null);
          }}
          onStatusChange={(status) => updateReport(selectedReport, { status })}
          onPriorityChange={(priority) => updateReport(selectedReport, { priority })}
          saving={updateMutation.isPending}
        />
      ) : null}
    </AdminWorkspace>
  );
}

function ReportDetailDialog({
  report,
  open,
  onOpenChange,
  onStatusChange,
  onPriorityChange,
  saving,
}: {
  report: ErrorReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
  saving: boolean;
}) {
  const status = safeStatus(report.status);
  const priority = safePriority(report.priority);
  const type = safeType(report.errorType);
  const screenshot = screenshotFrom(report.attachments);

  const downloadScreenshot = () => {
    if (!screenshot?.data) return;
    const link = document.createElement("a");
    link.href = screenshot.data;
    link.download = `error-report-${String(report.id)}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-white/12 bg-tsBg text-white sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.045] text-white/60">
              <TypeIcon type={type} />
            </span>
            <span className="min-w-0 truncate">{report.title || "Untitled report"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(status)}
            {priorityBadge(priority)}
            <Badge className="border-white/15 bg-white/5 text-white/60">{readable(type)}</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Status
              </p>
              <Select value={status} onValueChange={onStatusChange} disabled={saving}>
                <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {readable(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Priority
              </p>
              <Select value={priority} onValueChange={onPriorityChange} disabled={saving}>
                <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {readable(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Description
            </p>
            <p className="mt-2 whitespace-pre-wrap border-y border-white/10 py-4 text-sm leading-7 text-white/70">
              {report.description || "No description was provided."}
            </p>
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Reporter
              </p>
              <div className="mt-2 space-y-1 text-sm leading-6 text-white/58">
                <p>{report.userEmail || "Anonymous"}</p>
                <p>{report.userId || "No user ID"}</p>
                <p>{reportDate(report.createdAt)}</p>
              </div>
            </section>
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Environment
              </p>
              <div className="mt-2 space-y-1 text-sm leading-6 text-white/58">
                <p>
                  {report.browserInfo?.name || "Unknown browser"}{" "}
                  {report.browserInfo?.version || ""}
                </p>
                <p>{report.browserInfo?.platform || "Unknown platform"}</p>
                <p>{report.browserInfo?.mobile ? "Mobile" : "Desktop or unknown"}</p>
              </div>
            </section>
          </div>

          {report.currentUrl ? (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Page
              </p>
              <p className="mt-2 break-all border-y border-white/10 py-3 font-mono text-xs leading-6 text-cyan-100/70">
                {report.currentUrl}
              </p>
            </section>
          ) : null}

          {screenshot?.data ? (
            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Screenshot
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={downloadScreenshot}
                  className="border-white/12 bg-transparent text-white/60"
                >
                  Download
                </Button>
              </div>
              <div className="mt-3 overflow-hidden border border-white/10 bg-black/30">
                <img
                  src={screenshot.data}
                  alt="Error report screenshot"
                  className="max-h-[32rem] w-full object-contain"
                />
              </div>
            </section>
          ) : null}

          {report.adminNotes ? (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Admin notes
              </p>
              <p className="mt-2 whitespace-pre-wrap border-y border-white/10 py-3 text-sm leading-6 text-white/60">
                {report.adminNotes}
              </p>
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
