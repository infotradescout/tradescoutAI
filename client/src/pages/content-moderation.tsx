import { memo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield,
  Flag,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Users2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const ContentModeration = memo(function ContentModeration() {
  const [activeTab, setActiveTab] = useState("flagged");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [moderationNotes, setModerationNotes] = useState<{ [key: string]: string }>({});

  const roleTokens = (() => {
    const tokens: string[] = [];
    const push = (v: any) => {
      const r = String(v || "")
        .trim()
        .toLowerCase();
      if (!r) return;
      tokens.push(r === "owner" || r === "head_admin" ? "super_admin" : r);
    };
    push((user as any)?.role);
    push((user as any)?.activeRole);
    const roles = Array.isArray((user as any)?.roles) ? (user as any).roles : [];
    for (const r of roles) push(r);
    return Array.from(new Set(tokens));
  })();
  const isOpsOrAbove = roleTokens.includes("ops_admin") || roleTokens.includes("super_admin");

  // Fetch flagged content
  const { data: flaggedItems = [], isLoading: flaggedLoading } = useQuery({
    queryKey: ["/api/admin/moderation/flagged"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/admin/moderation/flagged");
      } catch {
        return [];
      }
    },
  });

  // Fetch moderation stats
  const { data: stats = {} } = useQuery({
    queryKey: ["/api/admin/moderation/reports"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/admin/moderation/reports");
      } catch {
        return {};
      }
    },
  });

  // Fetch recent moderation actions (removed/hidden)
  const { data: recentActions = [] } = useQuery({
    queryKey: ["/api/admin/moderation/recent-actions"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/admin/moderation/recent-actions");
      } catch {
        return [];
      }
    },
  });

  // Fetch community kick-vote queue (staff review)
  const { data: kickQueue = [], isLoading: kickQueueLoading } = useQuery({
    queryKey: ["/api/admin/moderation/kick-queue"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/admin/moderation/kick-queue");
      } catch {
        return [];
      }
    },
  });

  const staffDecisionMutation = useMutation({
    mutationFn: async ({
      reportId,
      decision,
      notes,
    }: {
      reportId: string;
      decision: string;
      notes?: string;
    }) => {
      return await apiRequest("POST", `/api/admin/moderation/kick-queue/${reportId}/decision`, {
        decision,
        notes,
      });
    },
    onSuccess: () => {
      toast({ title: "Decision saved", description: "Updated staff review decision." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/kick-queue"] });
    },
    onError: (error: any) => {
      toast({
        title: "Decision failed",
        description: error?.message || "Failed to save decision",
        variant: "destructive",
      });
    },
  });

  const opsBanMutation = useMutation({
    mutationFn: async ({ reportId, notes }: { reportId: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/moderation/kick-queue/${reportId}/ops-ban`, {
        notes,
      });
    },
    onSuccess: () => {
      toast({ title: "Ops action complete", description: "User action applied." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/kick-queue"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ops action failed",
        description: error?.message || "Failed to apply ops action",
        variant: "destructive",
      });
    },
  });

  // Approve content mutation
  const approveMutation = useMutation({
    mutationFn: async (contentId: string) => {
      return await apiRequest("POST", `/api/admin/moderation/approve/${contentId}`, {
        targetType: "post",
      });
    },
    onSuccess: () => {
      toast({
        title: "Content Approved",
        description: "The flagged content has been approved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/flagged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/recent-actions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve content",
        variant: "destructive",
      });
    },
  });

  // Remove content mutation
  const removeMutation = useMutation({
    mutationFn: async ({
      contentId,
      targetType,
      reason,
    }: {
      contentId: string;
      targetType: string;
      reason?: string;
    }) => {
      return await apiRequest("POST", `/api/admin/moderation/remove/${contentId}`, {
        targetType,
        reason,
      });
    },
    onSuccess: () => {
      toast({
        title: "Content Removed",
        description: "The flagged content has been removed.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/flagged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/recent-actions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove content",
        variant: "destructive",
      });
    },
  });

  const handleApproveContent = (contentId: string) => {
    approveMutation.mutate(contentId);
  };

  const handleRemoveContent = (item: any) => {
    const contentId = String(item?.targetId || "");
    const targetType = String(item?.targetType || "post");
    const reason = (moderationNotes[item.id] || "").trim();

    if (reason.length < 5) {
      toast({
        title: "Reason required",
        description: "Add a short moderation reason (at least 5 characters) before removal.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `Remove ${targetType} ${contentId}? This action is destructive and will be logged.`
    );
    if (!confirmed) return;

    removeMutation.mutate({ contentId, targetType, reason });
  };

  return (
    <div className="text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Content Moderation</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Monitor and moderate platform content to maintain community standards
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Flagged Content</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(stats as any).flaggedContentCount || 0}
                  </p>
                </div>
                <Flag className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Hidden Content</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(stats as any).hiddenContentCount || 0}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Flags</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(stats as any).totalFlags || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Status</p>
                  <p className="text-2xl font-bold text-green-500">Active</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Moderation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="flagged">Flagged Content ({flaggedItems.length})</TabsTrigger>
            <TabsTrigger value="queue">Moderation Queue</TabsTrigger>
            <TabsTrigger value="kick">
              Kick Queue ({Array.isArray(kickQueue) ? kickQueue.length : 0})
            </TabsTrigger>
          </TabsList>

          {/* Flagged Content Tab */}
          <TabsContent value="flagged" className="space-y-6">
            {flaggedLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground mt-2">Loading flagged content...</p>
              </div>
            ) : flaggedItems.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8">
                  <div className="text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-foreground font-semibold">No Flagged Content</p>
                    <p className="text-muted-foreground">
                      All content has been reviewed and approved.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              flaggedItems.map((item: any) => (
                <Card key={item.id} className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="error">{item.flagCount} flags</Badge>
                        <Badge variant="outline">{item.targetType}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">ID: {item.targetId}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">Content:</p>
                      <p className="text-sm text-muted-foreground p-3 bg-muted rounded">
                        Content ID: {item.targetId} · Type: {item.targetType} · Flags:{" "}
                        {item.flagCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">
                        Moderation Notes:
                      </p>
                      <Textarea
                        placeholder="Add notes about this content..."
                        value={moderationNotes[item.id] || ""}
                        onChange={(e) =>
                          setModerationNotes((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApproveContent(item.targetId)}
                        disabled={approveMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve Content
                      </Button>
                      <Button
                        onClick={() => handleRemoveContent(item)}
                        disabled={removeMutation.isPending}
                        variant="destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove / Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Queue Tab */}
          <TabsContent value="queue">
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Recent Destructive Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  {Array.isArray(recentActions) && recentActions.length > 0 ? (
                    <div className="space-y-3">
                      {recentActions.map((action: any) => (
                        <div
                          key={action.id}
                          className="p-3 rounded border border-border bg-muted/40 flex items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <p className="text-sm text-foreground font-medium">
                              {action.targetType} · {action.targetId}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Flags: {action.flagCount || 0} · Hidden:{" "}
                              {action.isHidden ? "Yes" : "No"}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {action.updatedAt
                              ? new Date(action.updatedAt).toLocaleString()
                              : "Unknown time"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No recent destructive moderation actions.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-8">
                  <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-foreground font-semibold">Moderation Queue</p>
                    <p className="text-muted-foreground">
                      System is monitoring platform activity in real-time.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Kick Queue Tab */}
          <TabsContent value="kick" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Community Kick-Vote Escalations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {kickQueueLoading ? (
                  <div className="text-sm text-muted-foreground">Loading kick queue...</div>
                ) : !Array.isArray(kickQueue) || kickQueue.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No escalated kick votes.</div>
                ) : (
                  kickQueue.map((report: any) => {
                    const reportId = String(report?.id || "");
                    const targetUserId = String(report?.contentId || "");
                    const ctx =
                      report?.additionalContext && typeof report.additionalContext === "object"
                        ? report.additionalContext
                        : {};
                    const voteCount = Number(ctx?.kickVoteCount || report?.totalVotes || 0);
                    const notesKey = `kick:${reportId}`;
                    return (
                      <div
                        key={reportId}
                        className="rounded border border-border bg-muted/30 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">
                              User: <span className="font-mono">{targetUserId}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Votes: {voteCount} · Status: {String(report?.status || "")}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {report?.updatedAt ? new Date(report.updatedAt).toLocaleString() : "—"}
                          </Badge>
                        </div>

                        <Textarea
                          placeholder="Staff notes / decision rationale..."
                          value={moderationNotes[notesKey] || ""}
                          onChange={(e) =>
                            setModerationNotes((prev) => ({ ...prev, [notesKey]: e.target.value }))
                          }
                          className="min-h-[90px]"
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            disabled={staffDecisionMutation.isPending}
                            onClick={() =>
                              staffDecisionMutation.mutate({
                                reportId,
                                decision: "dismiss",
                                notes: moderationNotes[notesKey] || "",
                              })
                            }
                          >
                            Dismiss
                          </Button>
                          <Button
                            className="bg-yellow-600 hover:bg-yellow-700"
                            disabled={staffDecisionMutation.isPending}
                            onClick={() =>
                              staffDecisionMutation.mutate({
                                reportId,
                                decision: "warning",
                                notes: moderationNotes[notesKey] || "",
                              })
                            }
                          >
                            Warning
                          </Button>
                          <Button
                            variant="destructive"
                            disabled={staffDecisionMutation.isPending}
                            onClick={() =>
                              staffDecisionMutation.mutate({
                                reportId,
                                decision: "suspend",
                                notes: moderationNotes[notesKey] || "",
                              })
                            }
                          >
                            Suspend
                          </Button>
                          <Button
                            className="bg-ts-orange text-black hover:bg-ts-orange-dark"
                            disabled={staffDecisionMutation.isPending}
                            onClick={() =>
                              staffDecisionMutation.mutate({
                                reportId,
                                decision: "recommend_ban",
                                notes: moderationNotes[notesKey] || "",
                              })
                            }
                            title="Escalates to ops for final action"
                          >
                            Recommend Ban → Ops
                          </Button>
                          {isOpsOrAbove ? (
                            <Button
                              className="bg-red-700 hover:bg-red-800 text-white"
                              disabled={opsBanMutation.isPending}
                              onClick={() =>
                                opsBanMutation.mutate({
                                  reportId,
                                  notes: moderationNotes[notesKey] || "",
                                })
                              }
                              title="Ops-only: applies a durable ban marker + hard suspension"
                            >
                              Ops Ban
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default ContentModeration;
