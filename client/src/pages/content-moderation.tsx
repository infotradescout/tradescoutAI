import { memo, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  EyeOff,
  Flag,
  RefreshCw,
  Shield,
  Trash2,
  UserX,
  XCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type FlaggedItem = {
  id: string;
  targetId: string;
  targetType: string;
  flagCount: number;
  [key: string]: unknown;
};

type ModerationStats = {
  flaggedContentCount?: number;
  hiddenContentCount?: number;
  totalFlags?: number;
};

type RecentAction = {
  id: string;
  targetType?: string;
  targetId?: string;
  flagCount?: number;
  isHidden?: boolean;
  updatedAt?: string;
};

type KickQueueReport = {
  id: string;
  contentId?: string;
  totalVotes?: number;
  status?: string;
  updatedAt?: string;
  additionalContext?: Record<string, unknown> | null;
};

type KickDecision = "dismiss" | "warning" | "suspend" | "recommend_ban";

function readable(value: unknown): string {
  const text = String(value || "").trim();
  return text ? text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
}

function formatDate(value: unknown): string {
  if (!value) return "Unknown time";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid time";
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function roleTokens(user: unknown): string[] {
  const source = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const tokens: string[] = [];
  const add = (value: unknown) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return;
    tokens.push(normalized === "owner" || normalized === "head_admin" ? "super_admin" : normalized);
  };
  add(source.role);
  add(source.activeRole);
  if (Array.isArray(source.roles)) source.roles.forEach(add);
  return Array.from(new Set(tokens));
}

const ContentModeration = memo(function ContentModeration() {
  const [activeTab, setActiveTab] = useState("flagged");
  const [moderationNotes, setModerationNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const roles = roleTokens(user);
  const isOpsOrAbove = roles.includes("ops_admin") || roles.includes("super_admin");

  const flaggedQuery = useQuery<FlaggedItem[]>({
    queryKey: ["/api/admin/moderation/flagged"],
    queryFn: async () => normalizeArray<FlaggedItem>(await apiRequest("GET", "/api/admin/moderation/flagged")),
  });
  const statsQuery = useQuery<ModerationStats>({
    queryKey: ["/api/admin/moderation/reports"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/moderation/reports");
      return response && typeof response === "object" ? (response as ModerationStats) : {};
    },
  });
  const actionsQuery = useQuery<RecentAction[]>({
    queryKey: ["/api/admin/moderation/recent-actions"],
    queryFn: async () => normalizeArray<RecentAction>(await apiRequest("GET", "/api/admin/moderation/recent-actions")),
  });
  const kickQueueQuery = useQuery<KickQueueReport[]>({
    queryKey: ["/api/admin/moderation/kick-queue"],
    queryFn: async () => normalizeArray<KickQueueReport>(await apiRequest("GET", "/api/admin/moderation/kick-queue")),
  });

  const invalidateModeration = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/flagged"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/reports"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/recent-actions"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/kick-queue"] }),
    ]);
  };

  const staffDecisionMutation = useMutation({
    mutationFn: async ({
      reportId,
      decision,
      notes,
    }: {
      reportId: string;
      decision: KickDecision;
      notes?: string;
    }) =>
      apiRequest("POST", `/api/admin/moderation/kick-queue/${reportId}/decision`, {
        decision,
        notes,
      }),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/kick-queue"] });
      toast({
        title: "Community escalation updated",
        description: `Decision saved as ${readable(variables.decision)}.`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Community escalation was not updated",
        description: formatUserFacingErrorMessage(error, "Failed to save the moderation decision."),
        variant: "destructive",
      });
    },
  });

  const opsBanMutation = useMutation({
    mutationFn: async ({ reportId, notes }: { reportId: string; notes?: string }) =>
      apiRequest("POST", `/api/admin/moderation/kick-queue/${reportId}/ops-ban`, {
        notes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/kick-queue"] });
      toast({ title: "Ops ban applied", description: "The durable ban and suspension action completed." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Ops ban was not applied",
        description: formatUserFacingErrorMessage(error, "Failed to apply the ops action."),
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (contentId: string) =>
      apiRequest("POST", `/api/admin/moderation/approve/${contentId}`, {
        targetType: "post",
      }),
    onSuccess: async () => {
      await invalidateModeration();
      toast({ title: "Content approved", description: "The flag was cleared without hiding the content." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Content was not approved",
        description: formatUserFacingErrorMessage(error, "Failed to approve the content."),
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({
      contentId,
      targetType,
      reason,
    }: {
      contentId: string;
      targetType: string;
      reason: string;
    }) =>
      apiRequest("POST", `/api/admin/moderation/remove/${contentId}`, {
        targetType,
        reason,
      }),
    onSuccess: async () => {
      await invalidateModeration();
      toast({
        title: "Content removed",
        description: "The destructive action was applied and remains available in recent actions.",
        variant: "destructive",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Content was not removed",
        description: formatUserFacingErrorMessage(error, "Failed to remove the content."),
        variant: "destructive",
      });
    },
  });

  const flaggedItems = flaggedQuery.data || [];
  const recentActions = actionsQuery.data || [];
  const kickQueue = kickQueueQuery.data || [];
  const stats = statsQuery.data || {};
  const totalKickVotes = useMemo(
    () =>
      kickQueue.reduce((sum, report) => {
        const context = report.additionalContext || {};
        const count = Number(context.kickVoteCount || report.totalVotes || 0);
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0),
    [kickQueue]
  );

  const removeContent = (item: FlaggedItem) => {
    const contentId = String(item.targetId || "").trim();
    const targetType = String(item.targetType || "post").trim() || "post";
    const reason = String(moderationNotes[item.id] || "").trim();
    if (reason.length < 5) {
      toast({
        title: "Removal reason required",
        description: "Record at least five characters explaining the destructive action.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm(`Remove ${targetType} ${contentId}? This action is destructive and logged.`)) {
      return;
    }
    removeMutation.mutate({ contentId, targetType, reason });
  };

  const refreshAll = () => {
    flaggedQuery.refetch();
    statsQuery.refetch();
    actionsQuery.refetch();
    kickQueueQuery.refetch();
  };
  const anyFetching =
    flaggedQuery.isFetching || statsQuery.isFetching || actionsQuery.isFetching || kickQueueQuery.isFetching;

  return (
    <AdminWorkspace data-testid="admin-moderation-v2">
      <AdminSection
        title="Moderation queues"
        description="Review reported content, prior destructive actions, and community kick-vote escalations. Missing feeds remain visible as unavailable instead of being shown as zero."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={refreshAll}
            disabled={anyFetching}
            className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${anyFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Flagged content",
              value: statsQuery.isError ? "—" : Number(stats.flaggedContentCount ?? flaggedItems.length),
              detail: statsQuery.isError ? "Moderation summary unavailable" : "Content awaiting review",
              tone: flaggedItems.length > 0 ? "warning" : "good",
            },
            {
              label: "Hidden content",
              value: statsQuery.isError ? "—" : Number(stats.hiddenContentCount ?? 0),
              detail: statsQuery.isError ? "Moderation summary unavailable" : "Currently hidden by moderation state",
            },
            {
              label: "Total flags",
              value: statsQuery.isError ? "—" : Number(stats.totalFlags ?? 0),
              detail: "Recorded flag events",
            },
            {
              label: "Kick escalations",
              value: kickQueueQuery.isError ? "—" : kickQueue.length,
              detail: kickQueueQuery.isError ? "Escalation queue unavailable" : `${totalKickVotes} recorded votes`,
              tone: kickQueue.length > 0 ? "warning" : "good",
            },
          ]}
        />
      </AdminSection>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            <TabsTrigger value="flagged" className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white">
              Flagged content {flaggedItems.length ? `(${flaggedItems.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="actions" className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white">
              Recent actions
            </TabsTrigger>
            <TabsTrigger value="kick" className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white">
              Kick escalations {kickQueue.length ? `(${kickQueue.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="flagged" className="mt-0">
          <AdminSection
            title="Flagged content"
            description="Approval clears the report. Removal requires a written reason and a second destructive confirmation."
            className="pt-0"
          >
            {flaggedQuery.isLoading ? (
              <QueueLoading label="Loading flagged content…" />
            ) : flaggedQuery.isError ? (
              <QueueUnavailable message="The flagged-content queue could not be loaded." />
            ) : flaggedItems.length ? (
              <AdminList>
                {flaggedItems.map((item) => (
                  <div key={item.id} className="grid gap-4 px-3 py-5 sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-red-400/30 bg-red-400/10 text-red-100">
                          <Flag className="mr-1 h-3 w-3" />
                          {Number(item.flagCount || 0)} flags
                        </Badge>
                        <Badge className="border-white/15 bg-white/5 text-white/55">{readable(item.targetType)}</Badge>
                        <span className="truncate font-mono text-xs text-white/30">{item.targetId}</span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-white/52">
                        The moderation source returned the target identity and flag count. Open the public content separately when the target type supports it.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Textarea
                        value={moderationNotes[item.id] || ""}
                        onChange={(event) =>
                          setModerationNotes((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder="Reason required only for removal"
                        className="min-h-24 border-white/10 bg-black/20 text-white"
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          onClick={() => approveMutation.mutate(String(item.targetId))}
                          disabled={approveMutation.isPending || removeMutation.isPending}
                          className="bg-emerald-400 text-black hover:bg-emerald-300"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeContent(item)}
                          disabled={approveMutation.isPending || removeMutation.isPending}
                          className="border-red-300/25 bg-transparent text-red-100 hover:bg-red-400/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState title="No flagged content" description="No content currently requires a moderation decision." />
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="actions" className="mt-0">
          <AdminSection
            title="Recent destructive actions"
            description="A read-only history of content that was hidden or removed through moderation."
            className="pt-0"
          >
            {actionsQuery.isLoading ? (
              <QueueLoading label="Loading moderation actions…" />
            ) : actionsQuery.isError ? (
              <QueueUnavailable message="The recent-actions history could not be loaded." />
            ) : recentActions.length ? (
              <AdminList>
                {recentActions.map((action) => (
                  <div key={action.id} className="grid gap-3 px-3 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-4">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${action.isHidden ? "bg-red-400/10 text-red-200" : "bg-white/[0.04] text-white/50"}`}>
                      {action.isHidden ? <EyeOff className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {readable(action.targetType)} · {action.targetId || "Unknown target"}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        {Number(action.flagCount || 0)} flags · Hidden: {action.isHidden ? "Yes" : "No"}
                      </p>
                    </div>
                    <span className="text-xs text-white/35">{formatDate(action.updatedAt)}</span>
                  </div>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState title="No recent destructive actions" description="No hidden or removed moderation actions were returned." />
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="kick" className="mt-0">
          <AdminSection
            title="Community kick-vote escalations"
            description="Staff decisions remain separate from the ops-only durable ban action."
            className="pt-0"
          >
            {kickQueueQuery.isLoading ? (
              <QueueLoading label="Loading kick escalations…" />
            ) : kickQueueQuery.isError ? (
              <QueueUnavailable message="The community escalation queue could not be loaded." />
            ) : kickQueue.length ? (
              <AdminList>
                {kickQueue.map((report) => {
                  const reportId = String(report.id || "");
                  const targetUserId = String(report.contentId || "");
                  const context = report.additionalContext || {};
                  const voteCount = Number(context.kickVoteCount || report.totalVotes || 0);
                  const notesKey = `kick:${reportId}`;
                  const note = moderationNotes[notesKey] || "";
                  return (
                    <div key={reportId} className="grid gap-4 px-3 py-5 sm:px-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(18rem,1.28fr)]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <UserX className="h-4 w-4 shrink-0 text-orange-200" />
                          <p className="truncate font-semibold text-white">User {targetUserId || "not recorded"}</p>
                        </div>
                        <p className="mt-2 text-sm text-white/48">
                          {Number.isFinite(voteCount) ? voteCount : 0} votes · {readable(report.status)}
                        </p>
                        <p className="mt-2 text-xs text-white/30">Updated {formatDate(report.updatedAt)}</p>
                      </div>
                      <div className="space-y-3">
                        <Textarea
                          value={note}
                          onChange={(event) =>
                            setModerationNotes((current) => ({
                              ...current,
                              [notesKey]: event.target.value,
                            }))
                          }
                          placeholder="Staff notes and decision rationale"
                          className="min-h-24 border-white/10 bg-black/20 text-white"
                        />
                        <div className="flex flex-wrap gap-2">
                          <DecisionButton label="Dismiss" onClick={() => staffDecisionMutation.mutate({ reportId, decision: "dismiss", notes: note })} disabled={staffDecisionMutation.isPending} />
                          <DecisionButton label="Warning" onClick={() => staffDecisionMutation.mutate({ reportId, decision: "warning", notes: note })} disabled={staffDecisionMutation.isPending} tone="warning" />
                          <DecisionButton label="Suspend" onClick={() => staffDecisionMutation.mutate({ reportId, decision: "suspend", notes: note })} disabled={staffDecisionMutation.isPending} tone="danger" />
                          <DecisionButton label="Recommend ban" onClick={() => staffDecisionMutation.mutate({ reportId, decision: "recommend_ban", notes: note })} disabled={staffDecisionMutation.isPending} tone="orange" />
                          {isOpsOrAbove ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                if (window.confirm(`Apply a durable ban and hard suspension to user ${targetUserId}?`)) {
                                  opsBanMutation.mutate({ reportId, notes: note });
                                }
                              }}
                              disabled={opsBanMutation.isPending}
                              className="bg-red-600 text-white hover:bg-red-500"
                            >
                              Ops ban
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </AdminList>
            ) : (
              <AdminEmptyState title="No kick-vote escalations" description="No community kick vote currently requires staff review." />
            )}
          </AdminSection>
        </TabsContent>
      </Tabs>
    </AdminWorkspace>
  );
});

function QueueLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
      <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function QueueUnavailable({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function DecisionButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone?: "neutral" | "warning" | "danger" | "orange";
}) {
  const className =
    tone === "warning"
      ? "border-amber-300/25 bg-transparent text-amber-100 hover:bg-amber-400/10"
      : tone === "danger"
        ? "border-red-300/25 bg-transparent text-red-100 hover:bg-red-400/10"
        : tone === "orange"
          ? "bg-orange-500 text-black hover:bg-orange-400"
          : "border-white/12 bg-transparent text-white/65 hover:bg-white/[0.05]";
  return (
    <Button type="button" size="sm" variant={tone === "orange" ? "default" : "outline"} onClick={onClick} disabled={disabled} className={className}>
      {tone === "danger" ? <XCircle className="mr-2 h-4 w-4" /> : tone === "orange" ? <Shield className="mr-2 h-4 w-4" /> : null}
      {label}
    </Button>
  );
}

export default ContentModeration;
