import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BriefcaseBusiness,
  ChevronRight,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { formatCountyLabel } from "@/utils/countyFipsToName";
import { StateCountySelector } from "@/components/state-county-selector";
import {
  JOBS_WORKSPACE_CANONICAL_PATH,
  buildCanonicalJobsWorkspaceHref,
  clearJobsWorkspaceState,
  createClearedJobsWorkspaceState,
  formatJobsPay,
  resolveJobsInspectorLifecycle,
  resolveJobsWorkspaceScopeHydration,
  resolveJobsWorkspaceState,
  resolveSelectedJobsWorkspacePost,
  updateJobsWorkspaceState,
  writeJobsWorkspaceState,
  type JobsWorkspaceMode,
  type JobsWorkspaceState,
} from "./jobsWorkspaceState";

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
  coverLetter?: string | null;
  createdAt?: string | null;
  // Owner-view extras
  applicantName?: string | null;
};

export function EmploymentBoard({
  defaultCountyFips,
  defaultStateCode,
}: {
  defaultCountyFips?: string;
  defaultStateCode?: string;
}) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: identityStatus } = useQuery<any>({
    queryKey: ["/api/identity-verification/status", user?.id],
    enabled: Boolean(isAuthenticated && user?.id),
    retry: false,
  });

  const viewerVerified =
    Boolean((user as any)?.addressVerified) && Boolean(identityStatus?.isVerified);
  const [workspaceState, setWorkspaceState] = useState<JobsWorkspaceState>(() =>
    createClearedJobsWorkspaceState("job")
  );
  const currentWorkspaceScope = `${user?.id || "guest"}:${JOBS_WORKSPACE_CANONICAL_PATH}`;
  const [hydratedWorkspaceScope, setHydratedWorkspaceScope] = useState("");
  const workspaceHydrated = hydratedWorkspaceScope === currentWorkspaceScope;
  const active = workspaceState.mode;
  const selectedCountyFips = workspaceState.countyFips || undefined;
  const selectedStateCode = workspaceState.stateCode;
  const selectedTrade = workspaceState.tradeSlug;
  const q = workspaceState.searchQuery;
  const selectedCountyLabel = selectedCountyFips
    ? formatCountyLabel(selectedCountyFips, selectedStateCode || user?.stateCode)
    : selectedStateCode
      ? "Select a county"
      : "All areas";
  const [showCountySelector, setShowCountySelector] = useState(false);
  const [areaDraftStateCode, setAreaDraftStateCode] = useState("");
  const [areaDraftCountyFips, setAreaDraftCountyFips] = useState("");

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

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      authLoading ||
      hydratedWorkspaceScope === currentWorkspaceScope
    ) {
      return;
    }

    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }

    const params = new URLSearchParams(window.location.search);
    const restored = resolveJobsWorkspaceState({
      search: window.location.search,
      storage,
      authenticatedUserId: user?.id,
      pathname: window.location.pathname,
      defaultStateCode: defaultStateCode || user?.stateCode,
      defaultCountyFips: defaultCountyFips || user?.countyFips,
    });
    setWorkspaceState(
      resolveJobsWorkspaceScopeHydration({
        restoredState: restored,
        previousScope: hydratedWorkspaceScope,
        currentScope: currentWorkspaceScope,
      })
    );
    setPostOpen(params.get("mode") === "post");
    setApplyPost(null);
    setViewApplicantsPost(null);
    setShowCountySelector(false);
    setHydratedWorkspaceScope(currentWorkspaceScope);
  }, [
    authLoading,
    currentWorkspaceScope,
    defaultCountyFips,
    defaultStateCode,
    hydratedWorkspaceScope,
    user?.countyFips,
    user?.id,
    user?.stateCode,
  ]);

  useEffect(() => {
    if (!workspaceHydrated || typeof window === "undefined") return;

    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    writeJobsWorkspaceState({
      storage,
      authenticatedUserId: user?.id,
      pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      state: workspaceState,
    });

    const href = buildCanonicalJobsWorkspaceHref({
      pathname: window.location.pathname,
      currentSearch: window.location.search,
      hash: window.location.hash,
      state: workspaceState,
    });
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href !== currentHref) window.history.replaceState(window.history.state, "", href);
  }, [user?.id, workspaceHydrated, workspaceState]);

  const { data: trades = [] } = useQuery({
    queryKey: ["/api/trades"],
    queryFn: async () => apiRequest("GET", "/api/trades"),
  });

  const postsQueryKey = useMemo(
    () => [
      "/api/employment/posts",
      user?.id || "guest",
      active,
      selectedCountyFips || null,
      selectedTrade || null,
      q,
    ],
    [active, q, selectedCountyFips, selectedTrade, user?.id]
  );

  const hasIncompleteArea = Boolean(selectedStateCode && !selectedCountyFips);
  const {
    data: posts = [],
    isLoading,
    isError: postsError,
    isSuccess: postsSuccess,
    refetch: refetchPosts,
  } = useQuery<EmploymentPost[]>({
    queryKey: postsQueryKey,
    enabled: workspaceHydrated && !hasIncompleteArea,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("type", active);
      if (selectedCountyFips) params.set("countyFips", selectedCountyFips);
      if (selectedTrade) params.set("tradeId", selectedTrade);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/employment/posts?${params.toString()}`);
      if (!res.ok || res.headers.get("X-Data-Disabled")) {
        throw new Error("Failed to fetch employment posts");
      }
      return res.json();
    },
  });

  // One viewer-scoped request supplies application status for every visible post.
  const {
    data: myApplications = [],
    isLoading: myApplicationsLoading,
    isError: myApplicationsError,
    refetch: refetchMyApplications,
  } = useQuery<Application[]>({
    queryKey: ["/api/employment/my-applications", user?.id],
    queryFn: () => apiRequest("GET", "/api/employment/my-applications"),
    enabled: Boolean(isAuthenticated && user?.id),
  });

  const myApplicationByPostId = useMemo(() => {
    const map = new Map<string, Application>();
    for (const app of myApplications) {
      map.set(app.postId, app);
    }
    return map;
  }, [myApplications]);

  const selectedPost = useMemo(
    () => resolveSelectedJobsWorkspacePost(posts, workspaceState.selectedPostId),
    [posts, workspaceState.selectedPostId]
  );

  useEffect(() => {
    if (!workspaceHydrated || !postsSuccess) return;
    if (workspaceState.selectedPostId && !selectedPost) {
      setWorkspaceState((current) => ({ ...current, selectedPostId: "" }));
    }
  }, [postsSuccess, selectedPost, workspaceHydrated, workspaceState.selectedPostId]);

  const visibleSelectedPost = workspaceHydrated ? selectedPost : null;

  // Fetch applicants for owner-viewed post
  const {
    data: applicants = [],
    isLoading: applicantsLoading,
    isError: applicantsError,
    refetch: refetchApplicants,
  } = useQuery<Application[]>({
    queryKey: ["/api/employment/posts", viewApplicantsPost?.id, "applications", user?.id],
    queryFn: async () => {
      if (!viewApplicantsPost) return [];
      const res = await fetch(`/api/employment/posts/${viewApplicantsPost.id}/applications`);
      if (!res.ok) throw new Error("Failed to fetch applicants");
      return res.json();
    },
    enabled: Boolean(
      workspaceHydrated && isAuthenticated && user?.id && viewApplicantsPost?.isOwner
    ),
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
      toast({ title: "Post closed", description: "The post is no longer accepting responses." });
      queryClient.invalidateQueries({ queryKey: ["/api/employment/posts"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't close post",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
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

  const openDirectConnect = (post: EmploymentPost) => {
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

    const params = new URLSearchParams();
    params.set("intent", "employment");
    params.set("source", "employment_post");
    params.set("employmentPostId", post.id);
    params.set("title", post.title);
    params.set("description", post.body);
    params.set("county", post.countyFips);
    if (post.tradeId) params.set("trade", post.tradeId);
    navigate(`/direct-connect?${params.toString()}`);
  };

  const handleWorkspaceChange = (patch: Partial<JobsWorkspaceState>) => {
    setWorkspaceState((current) => updateJobsWorkspaceState(current, patch));
  };

  const handleModeChange = (mode: JobsWorkspaceMode) => {
    handleWorkspaceChange({ mode });
  };

  const openAreaSelector = () => {
    setAreaDraftStateCode(selectedStateCode);
    setAreaDraftCountyFips(selectedCountyFips || "");
    setShowCountySelector(true);
  };

  const handleClearFilters = () => {
    if (typeof window !== "undefined") {
      let storage: Storage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }
      clearJobsWorkspaceState({
        storage,
        authenticatedUserId: user?.id,
        pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      });
    }
    setWorkspaceState(createClearedJobsWorkspaceState(active));
  };

  const handlePostSelect = (postId: string) => {
    setWorkspaceState((current) => ({ ...current, selectedPostId: postId }));
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 1023px)").matches) {
      return;
    }
    window.requestAnimationFrame(() => {
      const backButton = document.getElementById("jobs-inspector-back");
      backButton?.focus();
      document
        .getElementById("jobs-workspace-inspector")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleReturnToResults = () => {
    setWorkspaceState((current) => ({ ...current, selectedPostId: "" }));
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const resultsPanel = document.getElementById("jobs-results-panel");
      resultsPanel?.focus();
      resultsPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openCreateDialog = () => {
    if (!isAuthenticated) {
      navigate(
        `/pre-scout-setup?mode=signin&next=${encodeURIComponent(JOBS_WORKSPACE_CANONICAL_PATH)}`
      );
      return;
    }
    setPostOpen(true);
  };

  const handleApply = (post: EmploymentPost) => {
    if (!isAuthenticated) {
      navigate(
        `/pre-scout-setup?mode=signin&next=${encodeURIComponent(JOBS_WORKSPACE_CANONICAL_PATH)}`
      );
      return;
    }
    setApplyPost(post);
  };

  const hasWorkspaceFilters = Boolean(
    selectedStateCode || selectedCountyFips || selectedTrade || q.trim()
  );

  return (
    <div className="min-w-0 space-y-3" data-testid="jobs-workspace">
      <section
        className="min-w-0 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
        aria-labelledby="jobs-workspace-heading"
      >
        <div className="flex min-w-0 flex-col gap-3 border-b border-[color:var(--border-subtle)] px-3 py-3 sm:px-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--theme-accent-primary)]">
              Local employment desk
            </p>
            <h1
              id="jobs-workspace-heading"
              className="mt-1 text-xl font-bold text-[color:var(--text-primary)] md:text-2xl"
            >
              Jobs
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--text-secondary)]">
              Browse local work, inspect one post, and keep its available next step in view.
            </p>
          </div>

          <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] md:w-auto">
            <Tabs
              value={active}
              onValueChange={(value) => handleModeChange(value as JobsWorkspaceMode)}
            >
              <TabsList className="grid w-full grid-cols-2 sm:min-w-[240px]">
                <TabsTrigger value="job" className="gap-2" data-testid="jobs-mode-hiring">
                  <BriefcaseBusiness className="h-4 w-4" />
                  Hiring
                </TabsTrigger>
                <TabsTrigger value="resume" className="gap-2" data-testid="jobs-mode-resumes">
                  <UserRoundSearch className="h-4 w-4" />
                  Resumes
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button className="w-full gap-2 sm:w-auto" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Create {active === "job" ? "job" : "resume"}
            </Button>
          </div>
        </div>

        {!viewerVerified && (
          <div
            className="m-3 flex min-w-0 flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 sm:m-4 sm:flex-row sm:items-center sm:justify-between"
            data-testid="jobs-verification-notice"
          >
            <p className="min-w-0 leading-5">
              <ShieldCheck className="mr-1 inline h-4 w-4 align-text-bottom" />
              Browse and post now. Identity and address verification are required before starting a
              reply.
            </p>
            <Button
              size="sm"
              className="w-full shrink-0 bg-amber-400/90 text-[11px] font-semibold text-black hover:bg-amber-400 sm:w-auto"
              onClick={() => navigate("/verification")}
            >
              Verify now
            </Button>
          </div>
        )}

        <JobsWorkspaceFilters
          className="hidden border-t border-[color:var(--border-subtle)] px-4 py-3 lg:grid"
          areaLabel={selectedCountyLabel}
          selectedTrade={selectedTrade}
          searchQuery={q}
          trades={trades as any[]}
          hasWorkspaceFilters={hasWorkspaceFilters}
          onOpenArea={openAreaSelector}
          onTradeChange={(tradeSlug) => handleWorkspaceChange({ tradeSlug })}
          onSearchChange={(searchQuery) => handleWorkspaceChange({ searchQuery })}
          onClear={handleClearFilters}
        />

        <details className="group border-t border-[color:var(--border-subtle)] lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] sm:px-4">
            <span className="inline-flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[color:var(--theme-accent-primary)]" />
              Filters
              <span className="truncate text-xs font-normal text-[color:var(--text-secondary)]">
                {selectedCountyLabel}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
          </summary>
          <JobsWorkspaceFilters
            className="grid grid-cols-1 gap-3 border-t border-[color:var(--border-subtle)] px-3 py-3 sm:grid-cols-2 sm:px-4"
            areaLabel={selectedCountyLabel}
            selectedTrade={selectedTrade}
            searchQuery={q}
            trades={trades as any[]}
            hasWorkspaceFilters={hasWorkspaceFilters}
            onOpenArea={openAreaSelector}
            onTradeChange={(tradeSlug) => handleWorkspaceChange({ tradeSlug })}
            onSearchChange={(searchQuery) => handleWorkspaceChange({ searchQuery })}
            onClear={handleClearFilters}
          />
        </details>
      </section>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,1.1fr)] lg:items-start">
        <EmploymentResults
          className={visibleSelectedPost ? "hidden lg:block" : ""}
          posts={posts}
          active={active}
          selectedPostId={workspaceHydrated ? workspaceState.selectedPostId : ""}
          myApplicationByPostId={myApplicationByPostId}
          isLoading={!workspaceHydrated || isLoading}
          isError={postsError}
          hasIncompleteArea={hasIncompleteArea}
          onRetry={() => void refetchPosts()}
          onSelect={handlePostSelect}
          onOpenArea={openAreaSelector}
        />
        <EmploymentInspector
          post={visibleSelectedPost}
          application={
            visibleSelectedPost ? myApplicationByPostId.get(visibleSelectedPost.id) : undefined
          }
          viewerVerified={viewerVerified}
          isClosing={closeMutation.isPending && closeMutation.variables === visibleSelectedPost?.id}
          applicationLookupState={
            !isAuthenticated
              ? "ready"
              : myApplicationsLoading
                ? "loading"
                : myApplicationsError
                  ? "error"
                  : "ready"
          }
          onRetryApplicationState={() => void refetchMyApplications()}
          onApply={handleApply}
          onOpenDirectConnect={openDirectConnect}
          onViewApplicants={(post) => setViewApplicantsPost(post)}
          onClose={(post) => closeMutation.mutate(post.id)}
          onBack={handleReturnToResults}
        />
      </div>

      {/* Post creation dialog */}
      <Dialog open={workspaceHydrated && postOpen} onOpenChange={setPostOpen}>
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_120px]">
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
        open={workspaceHydrated && Boolean(applyPost)}
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
        open={workspaceHydrated && Boolean(viewApplicantsPost)}
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
          ) : applicantsError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-[color:var(--text-secondary)]">
              <p>Applicants could not load. No applicant state has been changed.</p>
              <Button size="sm" variant="outline" onClick={() => void refetchApplicants()}>
                Retry applicants
              </Button>
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
                        <div className="text-xs text-[color:var(--text-muted)]">
                          Contact stays inside TradeScout until the existing gate opens it.
                        </div>
                        {app.message && (
                          <p className="mt-1 text-xs text-[color:var(--text-secondary)] whitespace-pre-line">
                            {app.message}
                          </p>
                        )}
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0">
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

      <Dialog open={workspaceHydrated && showCountySelector} onOpenChange={setShowCountySelector}>
        <DialogContent className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <DialogHeader>
            <DialogTitle className="text-[color:var(--text-primary)]">Change location</DialogTitle>
            <DialogDescription className="sr-only">
              Choose a state and county for this Jobs workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-[color:var(--text-secondary)]">
            <p>
              Current area:{" "}
              <span className="font-semibold text-[color:var(--text-primary)]">
                {selectedCountyLabel}
              </span>
            </p>
            <StateCountySelector
              selectedState={areaDraftStateCode}
              selectedCounty={areaDraftCountyFips}
              onStateChange={(value) => {
                setAreaDraftStateCode(value);
                setAreaDraftCountyFips("");
              }}
              onCountyChange={setAreaDraftCountyFips}
              stateTestId="jobs-area-state"
              countyTestId="jobs-area-county"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCountySelector(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!areaDraftStateCode || !areaDraftCountyFips) return;
                  handleWorkspaceChange({
                    stateCode: areaDraftStateCode,
                    countyFips: areaDraftCountyFips,
                  });
                  setShowCountySelector(false);
                }}
                disabled={!areaDraftStateCode || !areaDraftCountyFips}
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

function JobsWorkspaceFilters({
  className,
  areaLabel,
  selectedTrade,
  searchQuery,
  trades,
  hasWorkspaceFilters,
  onOpenArea,
  onTradeChange,
  onSearchChange,
  onClear,
}: {
  className: string;
  areaLabel: string;
  selectedTrade: string;
  searchQuery: string;
  trades: any[];
  hasWorkspaceFilters: boolean;
  onOpenArea: () => void;
  onTradeChange: (tradeSlug: string) => void;
  onSearchChange: (searchQuery: string) => void;
  onClear: () => void;
}) {
  return (
    <div
      className={`${className} min-w-0 gap-3 lg:grid-cols-[minmax(170px,0.8fr)_minmax(190px,0.9fr)_minmax(220px,1.2fr)_auto] lg:items-end`}
    >
      <div className="min-w-0">
        <Label className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
          Local area
        </Label>
        <Button
          type="button"
          variant="outline"
          className="mt-1 w-full min-w-0 justify-start gap-2"
          onClick={onOpenArea}
          data-testid="jobs-area-control"
        >
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{areaLabel}</span>
        </Button>
      </div>

      <div className="min-w-0">
        <Label className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
          Trade
        </Label>
        <Select
          value={selectedTrade || "none"}
          onValueChange={(value) => onTradeChange(value === "none" ? "" : value)}
        >
          <SelectTrigger className="mt-1 w-full" data-testid="jobs-trade-control">
            <SelectValue placeholder="All trades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">All trades</SelectItem>
            {trades.map((trade) => (
              <SelectItem key={trade.slug} value={trade.slug}>
                {trade.name || trade.slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0">
        <Label className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
          Keyword
        </Label>
        <div className="relative mt-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Role, skill, or phrase"
            className="min-w-0 pl-9 pr-9"
            data-testid="jobs-search-control"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
              onClick={() => onSearchChange("")}
              aria-label="Clear keyword"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="w-full lg:w-auto"
        onClick={onClear}
        disabled={!hasWorkspaceFilters}
        data-testid="jobs-clear-filters"
      >
        Clear filters
      </Button>
    </div>
  );
}

function EmploymentResults({
  className = "",
  posts,
  active,
  selectedPostId,
  myApplicationByPostId,
  isLoading,
  isError,
  hasIncompleteArea,
  onRetry,
  onSelect,
  onOpenArea,
}: {
  className?: string;
  posts: EmploymentPost[];
  active: EmploymentPostType;
  selectedPostId: string;
  myApplicationByPostId: Map<string, Application>;
  isLoading: boolean;
  isError: boolean;
  hasIncompleteArea: boolean;
  onRetry: () => void;
  onSelect: (postId: string) => void;
  onOpenArea: () => void;
}) {
  return (
    <section
      id="jobs-results-panel"
      tabIndex={-1}
      className={`${className} min-w-0 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]`}
      aria-labelledby="jobs-results-heading"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <h2
            id="jobs-results-heading"
            className="text-sm font-semibold text-[color:var(--text-primary)]"
          >
            {active === "job" ? "Openings" : "Available resumes"}
          </h2>
          <p className="text-[11px] text-[color:var(--text-muted)]">
            {isLoading
              ? "Loading local results…"
              : `${posts.length} result${posts.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {active === "job" ? "Hiring" : "Resumes"}
        </Badge>
      </div>

      {hasIncompleteArea ? (
        <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
          <MapPin className="h-7 w-7 text-[color:var(--theme-accent-primary)]" />
          <p className="mt-3 text-sm font-semibold text-[color:var(--text-primary)]">
            Finish choosing a local area
          </p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-[color:var(--text-secondary)]">
            Choose a county to load the right local results.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onOpenArea}>
            Choose county
          </Button>
        </div>
      ) : isLoading ? (
        <div className="min-h-44 px-4 py-6 text-sm text-[color:var(--text-secondary)]">
          Loading employment posts…
        </div>
      ) : isError ? (
        <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
            Employment posts could not load
          </p>
          <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
            Your filters are still here. Retry when the connection is ready.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
            No matching {active === "job" ? "jobs" : "resumes"}
          </p>
          <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
            Change a filter or create the first post for this area.
          </p>
        </div>
      ) : (
        <div className="max-h-[58vh] min-w-0 overflow-y-auto lg:max-h-[calc(100vh-16rem)]">
          {posts.map((post) => {
            const selected = post.id === selectedPostId;
            const closed = String(post.status || "").toLowerCase() === "closed";
            const application = myApplicationByPostId.get(post.id);
            const pay = formatJobsPay(post);
            return (
              <button
                key={post.id}
                type="button"
                aria-pressed={selected}
                aria-controls="jobs-workspace-inspector"
                data-testid="jobs-result-row"
                onClick={() => onSelect(post.id)}
                className={`flex w-full min-w-0 items-start gap-3 border-b border-[color:var(--border-subtle)] px-3 py-3 text-left transition-colors last:border-b-0 sm:px-4 ${
                  selected
                    ? "bg-[color:var(--theme-accent-primary)]/10"
                    : "hover:bg-[color:var(--surface-intermediate)]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                      {post.title}
                    </span>
                    {post.isOwner && <Badge variant="outline">Your post</Badge>}
                    {closed && <Badge variant="secondary">Closed</Badge>}
                    {application && <ApplicationStatusBadge status={application.status} />}
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[color:var(--text-muted)]">
                    <span>{formatCountyLabel(post.countyFips, post.stateCode)}</span>
                    {post.city && <span>{post.city}</span>}
                    {post.tradeId && <span>{post.tradeId}</span>}
                    {pay && <span>{pay}</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--text-secondary)]">
                    {post.body}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EmploymentInspector({
  post,
  application,
  viewerVerified,
  isClosing,
  applicationLookupState,
  onRetryApplicationState,
  onApply,
  onOpenDirectConnect,
  onViewApplicants,
  onClose,
  onBack,
}: {
  post: EmploymentPost | null;
  application?: Application;
  viewerVerified: boolean;
  isClosing: boolean;
  applicationLookupState: "ready" | "loading" | "error";
  onRetryApplicationState: () => void;
  onApply: (post: EmploymentPost) => void;
  onOpenDirectConnect: (post: EmploymentPost) => void;
  onViewApplicants: (post: EmploymentPost) => void;
  onClose: (post: EmploymentPost) => void;
  onBack: () => void;
}) {
  if (!post) {
    return (
      <aside
        id="jobs-workspace-inspector"
        className="hidden min-h-56 min-w-0 flex-col items-center justify-center rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-5 text-center lg:sticky lg:top-24 lg:flex"
        data-testid="jobs-inspector-empty"
      >
        <BriefcaseBusiness className="h-8 w-8 text-[color:var(--theme-accent-primary)]" />
        <h2 className="mt-3 text-sm font-semibold text-[color:var(--text-primary)]">
          Choose one result to inspect
        </h2>
        <p className="mt-1 max-w-sm text-xs leading-5 text-[color:var(--text-secondary)]">
          The list stays in place while details, ownership, application state, and the allowed next
          action appear here.
        </p>
      </aside>
    );
  }

  const lifecycle = resolveJobsInspectorLifecycle({
    postType: post.postType,
    status: post.status,
    isOwner: post.isOwner,
    applicationStatus: application?.status,
    applicationLookupState,
  });
  const pay = formatJobsPay(post);

  return (
    <aside
      id="jobs-workspace-inspector"
      className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] lg:sticky lg:top-24"
      data-testid="jobs-inspector"
    >
      <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
        <Button
          id="jobs-inspector-back"
          type="button"
          variant="ghost"
          className="mb-2 min-h-11 w-full justify-start px-2 lg:hidden"
          onClick={onBack}
        >
          Back to results
        </Button>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--theme-accent-primary)]">
          Selected {post.postType === "job" ? "job" : "resume"}
        </p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 text-lg font-semibold text-[color:var(--text-primary)]">
            {post.title}
          </h2>
          {post.isOwner && <Badge variant="outline">Your post</Badge>}
          {lifecycle.isClosed && <Badge variant="secondary">Closed</Badge>}
          {!lifecycle.isOpen && !lifecycle.isClosed && (
            <Badge variant="secondary">Unavailable</Badge>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[color:var(--text-muted)]">
          <span>{formatCountyLabel(post.countyFips, post.stateCode)}</span>
          {post.city && <span>{post.city}</span>}
          {post.tradeId && <span>{post.tradeId}</span>}
          {pay && <span>{pay}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {post.posterVerified === true && <Badge variant="outline">Poster verified</Badge>}
          {post.posterVerified === false && <Badge variant="secondary">Poster not verified</Badge>}
        </div>
      </div>

      <div className="max-h-[42vh] overflow-y-auto px-4 py-4 lg:max-h-[calc(100vh-31rem)]">
        <p className="whitespace-pre-line text-sm leading-6 text-[color:var(--text-secondary)]">
          {post.body}
        </p>
      </div>

      <div className="border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
          Next action
        </p>

        {lifecycle.showApplicationStatus && application && (
          <div
            className="mt-2 flex flex-col items-start gap-2"
            data-testid="jobs-inspector-application-status"
          >
            <ApplicationStatusBadge status={application.status} />
            <p className="text-xs leading-5 text-[color:var(--text-secondary)]">
              Your application is already attached to this job. Its current status is shown above.
            </p>
          </div>
        )}

        {lifecycle.isApplicationStateLoading && post.postType === "job" && !post.isOwner && (
          <p className="mt-2 text-xs leading-5 text-[color:var(--text-secondary)]">
            Checking your application status…
          </p>
        )}

        {lifecycle.hasApplicationStateError && post.postType === "job" && !post.isOwner && (
          <div className="mt-2 flex flex-col items-start gap-2">
            <p className="text-xs leading-5 text-[color:var(--text-secondary)]">
              Your application status could not be confirmed, so applying is paused.
            </p>
            <Button size="sm" variant="outline" onClick={onRetryApplicationState}>
              Retry status
            </Button>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {lifecycle.showApplicants && (
            <Button
              variant="outline"
              className="w-full gap-2 sm:w-auto"
              onClick={() => onViewApplicants(post)}
              data-testid="jobs-inspector-applicants"
            >
              <Users className="h-4 w-4" />
              Applicants
            </Button>
          )}
          {lifecycle.showClose && (
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => onClose(post)}
              disabled={isClosing}
              data-testid="jobs-inspector-close"
            >
              {isClosing ? "Closing…" : "Close post"}
            </Button>
          )}
          {lifecycle.showApply && (
            <Button
              className="w-full sm:w-auto"
              onClick={() => onApply(post)}
              data-testid="jobs-inspector-apply"
            >
              Apply
            </Button>
          )}
          {lifecycle.showStartReply && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!viewerVerified}
              onClick={() => onOpenDirectConnect(post)}
              title={
                viewerVerified
                  ? "Start reply"
                  : "Verify your identity and address before you can start a reply."
              }
              data-testid="jobs-inspector-start-reply"
            >
              Start reply
            </Button>
          )}
        </div>

        {lifecycle.showStartReply && !viewerVerified && (
          <p className="mt-2 text-xs leading-5 text-amber-200">
            Verify your identity and address to enable the existing Direct Connect reply flow.
          </p>
        )}
        {lifecycle.isClosed && (
          <p className="mt-2 text-xs leading-5 text-[color:var(--text-secondary)]">
            This post is closed. No new application or reply can be started.
          </p>
        )}
        {!lifecycle.isOpen && !lifecycle.isClosed && (
          <p className="mt-2 text-xs leading-5 text-[color:var(--text-secondary)]">
            This post is not currently open for a new action.
          </p>
        )}
      </div>
    </aside>
  );
}
