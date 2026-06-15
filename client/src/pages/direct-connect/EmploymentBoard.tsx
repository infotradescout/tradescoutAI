import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, UserRoundSearch, Sparkles, X, Users } from "lucide-react";
import { formatCountyLabel } from "@/utils/countyFipsToName";
import { StateCountySelector } from "@/components/state-county-selector";

type EmploymentPostType = "job" | "resume";
type EmploymentPostStatus = "open" | "closed";

type EmploymentPost = {
  id: string;
  postType: EmploymentPostType;
  status: EmploymentPostStatus | string | null;
  title: string;
  body: string;
  countyFips: string;
  stateCode?: string | null;
  city?: string | null;
  tradeId?: string | null;
  payMin?: string | number | null;
  payMax?: string | number | null;
  payUnit?: string | null;
  isOwner?: boolean;
  posterVerified?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type Application = {
  id: string;
  postId: string;
  applicantUserId?: string;
  message?: string | null;
  status: "pending" | "shortlisted" | "rejected" | "withdrawn";
  createdAt?: string | null;
  // Owner-view extras
  applicantName?: string | null;
  applicantEmail?: string | null;
};

function formatPay(post: EmploymentPost): string | null {
  const unit = String(post.payUnit || "").trim();
  const minRaw = post.payMin;
  const maxRaw = post.payMax;
  const min = minRaw == null ? null : Number(minRaw);
  const max = maxRaw == null ? null : Number(maxRaw);
  if (!Number.isFinite(min as number) && !Number.isFinite(max as number)) return null;

  const fmt = (v: number) =>
    v >= 1000 && unit === "year" ? `$${Math.round(v).toLocaleString()}/yr` : `$${v}`;

  const suffix = unit === "hour" ? "/hr" : unit === "month" ? "/mo" : unit === "year" ? "/yr" : "";

  if (Number.isFinite(min as number) && Number.isFinite(max as number)) {
    if (min === max) return `${fmt(min as number)}${suffix}`;
    return `${fmt(min as number)} – ${fmt(max as number)}${suffix}`;
  }
  if (Number.isFinite(min as number)) return `${fmt(min as number)}${suffix}`;
  if (Number.isFinite(max as number)) return `${fmt(max as number)}${suffix}`;
  return null;
}

export function EmploymentBoard({ defaultCountyFips }: { defaultCountyFips?: string }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: identityStatus } = useQuery<any>({
    queryKey: ["/api/identity-verification/status"],
    enabled: isAuthenticated,
    retry: false,
  });

  const viewerVerified =
    Boolean((user as any)?.addressVerified) && Boolean(identityStatus?.isVerified);
  const [active, setActive] = useState<EmploymentPostType>("job");
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | undefined>(
    defaultCountyFips || user?.countyFips || undefined
  );
  const [selectedStateCode, setSelectedStateCode] = useState<string>(user?.stateCode || "");
  const selectedCountyLabel = selectedCountyFips
    ? formatCountyLabel(selectedCountyFips, selectedStateCode || user?.stateCode)
    : "County not set";
  const [showCountySelector, setShowCountySelector] = useState(false);

  const [q, setQ] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("");

  const [postOpen, setPostOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [city, setCity] = useState("");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [payUnit, setPayUnit] = useState<"hour" | "year" | "month" | "project">("hour");

  // Apply dialog state
  const [applyPost, setApplyPost] = useState<EmploymentPost | null>(null);
  const [applyMessage, setApplyMessage] = useState("");

  // Applicants dialog state
  const [viewApplicantsPost, setViewApplicantsPost] = useState<EmploymentPost | null>(null);

  const searchParams = useMemo(() => {
    const parts = String(typeof window !== "undefined" ? window.location.search : "").replace(
      /^\?/,
      ""
    );
    return new URLSearchParams(parts);
  }, []);

  useEffect(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    if (tab === "resumes") setActive("resume");
    if (tab === "jobs") setActive("job");
    if (searchParams.get("mode") === "post") setPostOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!defaultCountyFips) return;
    setSelectedCountyFips((prev) => prev || defaultCountyFips);
  }, [defaultCountyFips]);

  const { data: trades = [] } = useQuery({
    queryKey: ["/api/trades"],
    queryFn: async () => apiRequest("GET", "/api/trades"),
  });

  const postsQueryKey = useMemo(
    () => ["/api/employment/posts", active, selectedCountyFips || null, selectedTrade || null, q],
    [active, selectedCountyFips, selectedTrade, q]
  );

  const { data: posts = [], isLoading } = useQuery<EmploymentPost[]>({
    queryKey: postsQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("type", active);
      if (selectedCountyFips) params.set("countyFips", selectedCountyFips);
      if (selectedTrade) params.set("tradeId", selectedTrade);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/employment/posts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch employment posts");
      return res.json();
    },
  });

  // Fetch own application status for all visible posts
  const { data: myApplications = [] } = useQuery<Application[]>({
    queryKey: ["/api/employment/my-applications", posts.map((p) => p.id).join(",")],
    queryFn: async () => {
      if (!isAuthenticated || !posts.length) return [];
      const results = await Promise.all(
        posts
          .filter((p) => !p.isOwner)
          .map(async (p) => {
            try {
              const res = await fetch(`/api/employment/posts/${p.id}/applications`);
              if (!res.ok) return [];
              return res.json();
            } catch {
              return [];
            }
          })
      );
      return results.flat();
    },
    enabled: isAuthenticated && posts.length > 0,
  });

  const myApplicationByPostId = useMemo(() => {
    const map = new Map<string, Application>();
    for (const app of myApplications) {
      map.set(app.postId, app);
    }
    return map;
  }, [myApplications]);

  // Fetch applicants for owner-viewed post
  const { data: applicants = [], isLoading: applicantsLoading } = useQuery<Application[]>({
    queryKey: ["/api/employment/posts", viewApplicantsPost?.id, "applications"],
    queryFn: async () => {
      if (!viewApplicantsPost) return [];
      const res = await fetch(`/api/employment/posts/${viewApplicantsPost.id}/applications`);
      if (!res.ok) throw new Error("Failed to fetch applicants");
      return res.json();
    },
    enabled: Boolean(viewApplicantsPost),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Sign in to post.");
      if (!selectedCountyFips) throw new Error("Set your location first.");
      const nextPayMin = payMin.trim().length ? Number(payMin) : undefined;
      const nextPayMax = payMax.trim().length ? Number(payMax) : undefined;
      if (nextPayMin != null && !Number.isFinite(nextPayMin))
        throw new Error("Pay min is invalid.");
      if (nextPayMax != null && !Number.isFinite(nextPayMax))
        throw new Error("Pay max is invalid.");
      return apiRequest("POST", "/api/employment/posts", {
        postType: active,
        title: title.trim(),
        body: body.trim(),
        countyFips: selectedCountyFips,
        city: city.trim() || undefined,
        tradeId: selectedTrade || undefined,
        payMin: nextPayMin,
        payMax: nextPayMax,
        payUnit: payUnit,
      });
    },
    onSuccess: () => {
      toast({
        title: active === "job" ? "Job posted" : "Resume posted",
        description: "Your post is now visible on the board.",
      });
      setPostOpen(false);
      setTitle("");
      setBody("");
      setCity("");
      setPayMin("");
      setPayMax("");
      queryClient.invalidateQueries({ queryKey: ["/api/employment/posts"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't post",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/employment/posts/${id}/close`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employment/posts"] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async ({ postId, message }: { postId: string; message: string }) =>
      apiRequest("POST", `/api/employment/posts/${postId}/apply`, {
        message: message || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Application sent", description: "The poster will be notified." });
      setApplyPost(null);
      setApplyMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/employment/my-applications"] });
    },
    onError: (err: any) => {
      const msg = String((err as any)?.message || "");
      if (msg.toLowerCase().includes("already applied")) {
        toast({ title: "Already applied", description: "You have already applied to this post." });
        setApplyPost(null);
        return;
      }
      toast({
        title: "Couldn't apply",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: string }) =>
      apiRequest("PATCH", `/api/employment/applications/${appId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/employment/posts", viewApplicantsPost?.id, "applications"],
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't update",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const openScout = (post: EmploymentPost) => {
    if (!viewerVerified) {
      toast({
        title: "Verification required",
        description:
          "Verify your identity + address before you can initiate contact. You can still browse and post.",
        variant: "destructive",
      });
      navigate("/verification");
      return;
    }

    const prompt =
      post.postType === "job"
        ? `I want to apply to this job. Help me confirm intent and take the next step.\n\nJob: ${post.title}\n\nDetails: ${post.body}`
        : `I want to reach out about this resume. Help me confirm intent and take the next step.\n\nResume headline: ${post.title}\n\nSummary: ${post.body}`;

    const params = new URLSearchParams();
    params.set("intent", "employment");
    params.set("source", "employment_post");
    params.set("postId", post.id);
    params.set("prompt", prompt);
    navigate(`/scout?${params.toString()}`);
  };

  const headerCopy =
    active === "job"
      ? "Post jobs, browse openings, and apply directly."
      : "Post resumes, browse candidates, and start a reply when you're ready.";

  return (
    <div className="space-y-4">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
                <Sparkles className="h-4 w-4" />
                Local board{" "}
                <span className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)]">
                  {selectedCountyLabel}
                </span>
              </div>
              <div className="text-sm text-[color:var(--text-secondary)]">{headerCopy}</div>
              {!viewerVerified && (
                <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  You can browse and post now, but you need to verify your identity and address
                  before you can start a conversation.
                  <Button
                    size="sm"
                    className="ml-2 h-7 bg-amber-400/90 px-2 text-[11px] font-semibold text-black hover:bg-amber-400"
                    onClick={() => navigate("/verification")}
                  >
                    Verify now
                  </Button>
                </div>
              )}
            </div>

            <div className="grid w-full gap-2 md:w-auto md:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <Button
                variant="outline"
                onClick={() => setShowCountySelector(true)}
                className="h-10 w-full md:w-auto"
              >
                {selectedCountyFips ? "Change location" : "Set location"}
              </Button>

              <div className="w-full min-w-0 md:min-w-[220px]">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                  Trade
                </Label>
                <Select
                  value={selectedTrade || "none"}
                  onValueChange={(v) => setSelectedTrade(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by trade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All trades</SelectItem>
                    {(trades as any[]).map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {t.name || t.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full min-w-0 md:min-w-[220px]">
                <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                  Search
                </Label>
                <div className="flex items-center gap-2">
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keywords…" />
                  {q.trim().length > 0 && (
                    <Button size="icon" variant="ghost" onClick={() => setQ("")} aria-label="Clear">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <Button
                className="h-10 w-full md:w-auto"
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate(
                      `/pre-scout-setup?mode=signin&next=${encodeURIComponent(
                        "/direct-connect/employment"
                      )}`
                    );
                    return;
                  }
                  setPostOpen(true);
                }}
              >
                {active === "job" ? "Post a job" : "Post a resume"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={active}
        onValueChange={(v) => setActive(v as EmploymentPostType)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="job" className="gap-2">
            <BriefcaseBusiness className="h-4 w-4" />
            Hiring
          </TabsTrigger>
          <TabsTrigger value="resume" className="gap-2">
            <UserRoundSearch className="h-4 w-4" />
            Resumes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="job" className="space-y-3">
          {isLoading ? (
            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardContent className="p-4 text-sm text-[color:var(--text-secondary)]">
                Loading…
              </CardContent>
            </Card>
          ) : (
            <PostList
              posts={posts}
              onAskScout={openScout}
              onClose={(id) => closeMutation.mutate(id)}
              onApply={(post) => {
                if (!isAuthenticated) {
                  navigate(
                    `/pre-scout-setup?mode=signin&next=${encodeURIComponent("/direct-connect/employment")}`
                  );
                  return;
                }
                setApplyPost(post);
              }}
              onViewApplicants={(post) => setViewApplicantsPost(post)}
              canClose={Boolean(isAuthenticated)}
              viewerVerified={viewerVerified}
              isAuthenticated={Boolean(isAuthenticated)}
              myApplicationByPostId={myApplicationByPostId}
            />
          )}
        </TabsContent>

        <TabsContent value="resume" className="space-y-3">
          {isLoading ? (
            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardContent className="p-4 text-sm text-[color:var(--text-secondary)]">
                Loading…
              </CardContent>
            </Card>
          ) : (
            <PostList
              posts={posts}
              onAskScout={openScout}
              onClose={(id) => closeMutation.mutate(id)}
              onApply={(post) => {
                if (!isAuthenticated) {
                  navigate(
                    `/pre-scout-setup?mode=signin&next=${encodeURIComponent("/direct-connect/employment")}`
                  );
                  return;
                }
                setApplyPost(post);
              }}
              onViewApplicants={(post) => setViewApplicantsPost(post)}
              canClose={Boolean(isAuthenticated)}
              viewerVerified={viewerVerified}
              isAuthenticated={Boolean(isAuthenticated)}
              myApplicationByPostId={myApplicationByPostId}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Post creation dialog */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{active === "job" ? "Post a job" : "Post a resume"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            {!viewerVerified && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                This post will be marked <span className="font-semibold">Not verified</span> until
                you verify your address.
              </div>
            )}
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={active === "job" ? "Role title" : "Headline (role + experience)"}
              />
            </div>

            <div className="grid gap-2">
              <Label>Details</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[140px]"
                placeholder={
                  active === "job"
                    ? "Describe responsibilities, requirements, schedule, and what good looks like."
                    : "Describe what you do, what you're looking for, and availability."
                }
              />
              <div className="text-xs text-[color:var(--text-muted)]">
                Leave out phone numbers and email. Replies stay in TradeScout until contact opens.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>City (optional)</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>

              <div className="grid gap-2">
                <Label>Pay (optional)</Label>
                <div className="grid grid-cols-[1fr_1fr_120px] gap-2">
                  <Input
                    value={payMin}
                    onChange={(e) => setPayMin(e.target.value)}
                    placeholder="Min"
                  />
                  <Input
                    value={payMax}
                    onChange={(e) => setPayMax(e.target.value)}
                    placeholder="Max"
                  />
                  <Select value={payUnit} onValueChange={(v) => setPayUnit(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">/hr</SelectItem>
                      <SelectItem value="month">/mo</SelectItem>
                      <SelectItem value="year">/yr</SelectItem>
                      <SelectItem value="project">project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPostOpen(false)}>
                Cancel
              </Button>
              <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply dialog */}
      <Dialog
        open={Boolean(applyPost)}
        onOpenChange={(open) => {
          if (!open) setApplyPost(null);
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {applyPost?.postType === "job" ? "Apply for this job" : "Express interest"}
            </DialogTitle>
          </DialogHeader>
          {applyPost && (
            <div className="grid gap-3">
              <div className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] p-3">
                <div className="font-semibold text-[color:var(--text-primary)]">
                  {applyPost.title}
                </div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {formatCountyLabel(applyPost.countyFips, applyPost.stateCode)}
                  {applyPost.city ? ` • ${applyPost.city}` : ""}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Message (optional)</Label>
                <Textarea
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  className="min-h-[100px]"
                  placeholder="Briefly introduce yourself and why you're a good fit…"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setApplyPost(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={applyMutation.isPending}
                  onClick={() =>
                    applyMutation.mutate({ postId: applyPost.id, message: applyMessage })
                  }
                >
                  {applyMutation.isPending ? "Sending…" : "Send application"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Applicants management dialog (owner only) */}
      <Dialog
        open={Boolean(viewApplicantsPost)}
        onOpenChange={(open) => {
          if (!open) setViewApplicantsPost(null);
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Applicants — {viewApplicantsPost?.title}</DialogTitle>
          </DialogHeader>
          {applicantsLoading ? (
            <div className="py-6 text-center text-sm text-[color:var(--text-secondary)]">
              Loading applicants…
            </div>
          ) : applicants.length === 0 ? (
            <div className="py-6 text-center text-sm text-[color:var(--text-secondary)]">
              No applications yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {applicants.map((app) => (
                <Card
                  key={app.id}
                  className="border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
                >
                  <CardContent className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[color:var(--text-primary)]">
                          {app.applicantName || "Applicant"}
                        </div>
                        {app.applicantEmail && (
                          <div className="text-xs text-[color:var(--text-muted)]">
                            {app.applicantEmail}
                          </div>
                        )}
                        {app.message && (
                          <p className="mt-1 text-xs text-[color:var(--text-secondary)] whitespace-pre-line">
                            {app.message}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ApplicationStatusBadge status={app.status} />
                        {app.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                updateApplicationMutation.mutate({
                                  appId: app.id,
                                  status: "shortlisted",
                                })
                              }
                            >
                              Shortlist
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-400 hover:text-red-300"
                              onClick={() =>
                                updateApplicationMutation.mutate({
                                  appId: app.id,
                                  status: "rejected",
                                })
                              }
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {app.status === "shortlisted" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-400 hover:text-red-300"
                            onClick={() =>
                              updateApplicationMutation.mutate({
                                appId: app.id,
                                status: "rejected",
                              })
                            }
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCountySelector} onOpenChange={setShowCountySelector}>
        <DialogContent className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <DialogHeader>
            <DialogTitle className="text-[color:var(--text-primary)]">Change location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-[color:var(--text-secondary)]">
            <p>
              Current county:{" "}
              <span className="font-semibold text-[color:var(--text-primary)]">
                {selectedCountyLabel}
              </span>
            </p>
            <StateCountySelector
              selectedState={selectedStateCode}
              selectedCounty={selectedCountyFips || ""}
              onStateChange={(value) => setSelectedStateCode(value)}
              onCountyChange={(value) => setSelectedCountyFips(value || undefined)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCountySelector(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedCountyFips) {
                    setShowCountySelector(false);
                  }
                }}
              >
                Change area
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationStatusBadge({ status }: { status: string }) {
  if (status === "shortlisted")
    return (
      <Badge className="bg-green-600/20 text-green-300 border-green-600/30">Shortlisted</Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive" className="opacity-70">
        Rejected
      </Badge>
    );
  if (status === "withdrawn") return <Badge variant="secondary">Withdrawn</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function PostList({
  posts,
  onAskScout,
  onClose,
  onApply,
  onViewApplicants,
  canClose,
  viewerVerified,
  isAuthenticated,
  myApplicationByPostId,
}: {
  posts: EmploymentPost[];
  onAskScout: (post: EmploymentPost) => void;
  onClose: (id: string) => void;
  onApply: (post: EmploymentPost) => void;
  onViewApplicants: (post: EmploymentPost) => void;
  canClose: boolean;
  viewerVerified: boolean;
  isAuthenticated: boolean;
  myApplicationByPostId: Map<string, Application>;
}) {
  if (!posts.length) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-4 text-sm text-[color:var(--text-secondary)]">
          No posts yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const pay = formatPay(post);
        const closed = String(post.status || "").toLowerCase() === "closed";
        const myApp = myApplicationByPostId.get(post.id);

        return (
          <Card
            key={post.id}
            className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-[color:var(--text-primary)]">
                      {post.title}
                    </div>
                    {closed && <Badge variant="secondary">Closed</Badge>}
                    {post.posterVerified === false && (
                      <Badge variant="secondary">Not verified</Badge>
                    )}
                    {post.posterVerified === true && <Badge variant="outline">Verified</Badge>}
                    {post.tradeId && <Badge variant="outline">{post.tradeId}</Badge>}
                    {pay && <Badge variant="outline">{pay}</Badge>}
                    {myApp && <ApplicationStatusBadge status={myApp.status} />}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    County: {formatCountyLabel(post.countyFips, post.stateCode)}
                    {post.city ? ` • ${post.city}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Owner: view applicants button */}
                  {post.isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => onViewApplicants(post)}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Applicants
                    </Button>
                  )}
                  {/* Non-owner job post: Apply button */}
                  {!post.isOwner && post.postType === "job" && !closed && !myApp && (
                    <Button
                      size="sm"
                      onClick={() => onApply(post)}
                      data-testid="employment-apply-btn"
                    >
                      Apply
                    </Button>
                  )}
                  {/* Non-owner resume post: Start reply */}
                  {!post.isOwner && post.postType === "resume" && !closed && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!viewerVerified}
                      onClick={() => onAskScout(post)}
                      title={
                        viewerVerified
                          ? "Start reply"
                          : "Verify your address before you can start a reply."
                      }
                    >
                      Start reply
                    </Button>
                  )}
                  {canClose && post.isOwner && !closed && (
                    <Button size="sm" variant="ghost" onClick={() => onClose(post.id)}>
                      Close
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="whitespace-pre-line text-sm text-[color:var(--text-secondary)]">
                {post.body}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
