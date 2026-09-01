import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { apiRequest } from "@/lib/queryClient";
import { createClientOperationId } from "@/lib/clientOperationId";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { recordActivity } from "@/agent/activity";
import type { WorkRequest, TaskCategory } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { formatCountyLabel, getCountyStateCode } from "@/utils/countyFipsToName";
import { StateCountySelector } from "@/components/state-county-selector";
import { Page, Section } from "@/components/layout/PagePrimitives";
import { DirectConnectRequestCard } from "@/pages/direct-connect/DirectConnectRequestCard";
import { looksLikeHiddenOrTestRequest } from "@/pages/direct-connect/requestCardPresentation";

type TopContractor = {
  id: string;
  businessName: string | null;
  reviewCount: number | null;
  recommendationCount: number | null;
  connectionRecommendationCount?: number | null;
  county: string | null;
  state: string | null;
  presenceLabel: string;
  reachTier: "local" | "regional" | "wide";
  localCredibilityScore?: number | null;
};

type PostIntent = "work_request" | "job_listing";

function isCurrentLiveRequest(request: WorkRequest): boolean {
  const status = String((request as any)?.status || "").toLowerCase();
  if (!["open", "routed", "in_progress"].includes(status)) return false;
  const ts = (request as any)?.updatedAt || (request as any)?.createdAt;
  if (!ts) return false;
  const ageMs = Date.now() - new Date(ts).getTime();
  return Number.isFinite(ageMs) && ageMs <= 120 * 24 * 60 * 60 * 1000;
}

function mapTaskCategoryToTradeSlug(categoryId: string | null | undefined): string | null {
  if (!categoryId) return null;

  const mapping: Record<string, string> = {
    // Maintenance & home support
    "yard-work": "landscaper",
    "seasonal-tasks": "landscaper",
    cleaning: "cleaning_service",
    organization: "cleaning_service",
    "basic-repairs": "handyman",
    assembly: "handyman",
    // Light construction / prep
    demolition: "general_contractor",
    "painting-prep": "painter",
    // Misc personal help -> handyman-style
    "general-labor": "handyman",
    "moving-delivery": "handyman",
  };

  return mapping[categoryId] ?? null;
}

function inferPostIntent(title: string, description: string): PostIntent {
  const text = `${title} ${description}`.toLowerCase();
  if (!text.trim()) return "work_request";
  const workSignals = [
    "need help",
    "need someone",
    "looking for a contractor",
    "repair",
    "install",
    "fix",
    "replace",
    "estimate",
    "quote",
  ];
  if (workSignals.some((signal) => text.includes(signal))) return "work_request";
  return "work_request";
}

export default function TasksHub({
  defaultCountyFips,
  embedded = false,
  defaultTab = "browse",
}: {
  defaultCountyFips?: string;
  embedded?: boolean;
  defaultTab?: "browse" | "post";
}) {
  const { user, isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pendingCreateOperationRef = useRef<{
    fingerprint: string;
    operationId: string;
  } | null>(null);
  const [location, navigate] = useLocation();
  const MAX_DIRECT_PROS = 3;
  const normalizedRole = String((user as any)?.role || "").toLowerCase();
  const isMultiCountyProvider =
    normalizedRole.includes("contractor") ||
    normalizedRole.includes("helper") ||
    normalizedRole.includes("provider");

  const [activeTab, setActiveTab] = useState<"browse" | "post">(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Phase 1: County selection (defaults to user.countyFips or URL param, with override affordance)
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | undefined>(
    defaultCountyFips || (isMultiCountyProvider ? undefined : user?.countyFips) || undefined
  );
  const [countySelectorStateCode, setCountySelectorStateCode] = useState<string>(
    user?.stateCode || ""
  );
  const [countySelectorFips, setCountySelectorFips] = useState<string>(selectedCountyFips || "");
  const selectedCountyLabel = selectedCountyFips
    ? formatCountyLabel(selectedCountyFips, user?.stateCode)
    : "";
  const [showCountySelector, setShowCountySelector] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskCategoryId, setTaskCategoryId] = useState<string>("");
  const [selectedTradeSlug, setSelectedTradeSlug] = useState<string>("");
  const [taskPayType, setTaskPayType] = useState<"fixed" | "hourly" | "per_task">("fixed");
  const [taskPayAmount, setTaskPayAmount] = useState<string>("");
  const [taskTaskType, setTaskTaskType] = useState<"one_time" | "recurring" | "project_based">(
    "one_time"
  );
  const [taskSchedulingType, setTaskSchedulingType] = useState<"asap" | "scheduled" | "flexible">(
    "asap"
  );

  const [postIntent, setPostIntent] = useState<PostIntent>("work_request");
  const [postIntentLocked, setPostIntentLocked] = useState(false);
  const [postStep, setPostStep] = useState(0);
  const [showProviderInvites, setShowProviderInvites] = useState(false);

  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [prefillProviderId, setPrefillProviderId] = useState<string | null>(null);
  const [selectedBoardRequest, setSelectedBoardRequest] = useState<WorkRequest | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    pay?: string;
    county?: string;
    form?: string;
  }>({});

  useEffect(() => {
    if (embedded) {
      setActiveTab(defaultTab);
    }
  }, [embedded, defaultTab]);

  const searchParams = useMemo(() => {
    const parts = String(location || "").split("?");
    return new URLSearchParams(parts[1] || "");
  }, [location]);

  const intent = searchParams.get("intent");
  const contractorSlug = searchParams.get("contractor");
  const contractorId = searchParams.get("contractorId");

  const { data: contractorPrefill } = useQuery({
    queryKey: ["/api/contractors/prefill", contractorSlug],
    enabled: Boolean(contractorSlug),
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/contractors/${contractorSlug}`);
      return response?.contractor ?? null;
    },
  });

  useEffect(() => {
    if (intent === "hire" || contractorSlug || contractorId) {
      setActiveTab("post");
    }
  }, [intent, contractorSlug, contractorId]);

  const inferredIntent = useMemo(
    () => inferPostIntent(taskTitle, taskDescription),
    [taskTitle, taskDescription]
  );

  useEffect(() => {
    if (!postIntentLocked) {
      setPostIntent(inferredIntent);
    }
  }, [inferredIntent, postIntentLocked]);

  useEffect(() => {
    const idFromSlug = contractorPrefill?.id as string | undefined;
    const idFromQuery = contractorId || idFromSlug;
    if (!idFromQuery) return;
    setPrefillProviderId(idFromQuery);
    setSelectedProviderIds((prev) => {
      if (prev.includes(idFromQuery)) return prev;
      return [...prev, idFromQuery];
    });
  }, [contractorId, contractorPrefill]);

  useEffect(() => {
    if (prefillProviderId) {
      setShowProviderInvites(true);
    }
  }, [prefillProviderId]);

  useEffect(() => {
    if (!showCountySelector) return;
    setCountySelectorFips(selectedCountyFips || "");
    setCountySelectorStateCode(
      getCountyStateCode(selectedCountyFips) || user?.stateCode || countySelectorStateCode || ""
    );
  }, [showCountySelector, selectedCountyFips, user?.stateCode]);

  // Telemetry: Track when county defaults are applied from URL params (Phase 1)
  useEffect(() => {
    if (defaultCountyFips && selectedCountyFips === defaultCountyFips) {
      try {
        recordActivity({
          type: "dc.county_default_applied",
          ts: new Date().toISOString(),
          path: window.location.pathname,
          meta: {
            surface: "direct_connect",
            scope: "county",
            countyFips: defaultCountyFips,
            source: new URLSearchParams(window.location.search).has("county")
              ? "county_page"
              : "manual_change",
            sessionId: sessionStorage.getItem("sessionId") || crypto.randomUUID(),
            asOf: new Date().toISOString(),
          },
        });
      } catch {
        // fire-and-forget: ignore telemetry failures
      }
    }
  }, [defaultCountyFips, user]);

  const { data: workRequests, isLoading: requestsLoading } = useQuery<WorkRequest[]>({
    queryKey: ["/api/direct-connect/board", selectedCountyFips || null, selectedCategory || "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (selectedCountyFips) params.append("countyFips", selectedCountyFips);

      const response = await fetch(`/api/direct-connect/board?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch work requests");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: categories } = useQuery<TaskCategory[]>({
    queryKey: ["/api/task-categories"],
  });

  const { data: trades = [] } = useQuery({
    queryKey: ["/api/trades"],
    queryFn: async () => apiRequest("GET", "/api/trades"),
  });

  const tradeSlugForCategory = useMemo(
    () => mapTaskCategoryToTradeSlug(taskCategoryId || null),
    [taskCategoryId]
  );
  const resolvedTradeSlug = selectedTradeSlug || tradeSlugForCategory || "";

  useEffect(() => {
    // Reset provider picks when the shape of the request changes
    setSelectedProviderIds([]);
    setPrefillProviderId(null);
  }, [taskCategoryId, selectedTradeSlug]);

  useEffect(() => {
    if (postIntent === "job_listing") {
      setSelectedProviderIds([]);
      setPrefillProviderId(null);
      setShowProviderInvites(false);
    }
  }, [postIntent]);

  const { data: recommendedProviders, isLoading: providersLoading } = useQuery<TopContractor[]>({
    queryKey: ["/api/contractors/top", selectedCountyFips || null, resolvedTradeSlug || null],
    queryFn: async () => {
      const county = selectedCountyFips;
      const trade = resolvedTradeSlug;
      if (!county || !trade) return [];

      const params = new URLSearchParams({
        county,
        trade,
        limit: "5",
      });
      const response = await fetch(`/api/contractors/top?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch recommended providers");
      return response.json();
    },
    enabled: isAuthenticated && !!selectedCountyFips && !!resolvedTradeSlug,
  });

  // Provider self-select: express interest in an open board request
  const expressInterestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest(
        "POST",
        `/api/direct-connect/requests/${encodeURIComponent(requestId)}/express-interest`,
        {}
      );
    },
    onSuccess: (data: any, requestId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/inbox"] });
      toast({
        title: data?.alreadyAssigned ? "Already in your inbox" : "Interest sent!",
        description: data?.alreadyAssigned
          ? "You already expressed interest in this request. Check your inbox to respond."
          : "The requester has been notified. Check your inbox to accept or decline.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not express interest",
        description: formatUserFacingErrorMessage(error, "Could not express interest right now."),
        variant: "destructive",
      });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (postIntent === "job_listing") {
        throw new Error("Employment hiring posts live under Direct Connect → Employment.");
      }
      const nextErrors: typeof fieldErrors = {};
      if (!taskTitle.trim()) nextErrors.title = "Add a short title.";
      if (!taskDescription.trim()) nextErrors.description = "Add project details.";
      const hasPayAmount = taskPayAmount.trim().length > 0;
      const payAmount = hasPayAmount ? Number(taskPayAmount) : NaN;
      if (hasPayAmount && (!Number.isFinite(payAmount) || payAmount <= 0)) {
        nextErrors.pay = "Enter a valid pay amount.";
      }
      if (!selectedCountyFips) nextErrors.county = "Set a county before posting.";
      // If the user is not direct-requesting specific pros, require a trade so the board can filter correctly.
      if (!selectedProviderIds.length && !resolvedTradeSlug) {
        nextErrors.form = "Pick a trade so the right pros can see this.";
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        throw new Error("Fix the highlighted fields.");
      }

      const requestPayload = {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        category: taskCategoryId || undefined,
        tradeId: resolvedTradeSlug || undefined,
        budgetMin: hasPayAmount ? payAmount : undefined,
        budgetMax: hasPayAmount ? payAmount : undefined,
        countyFips: selectedCountyFips,
        targetContractorIds:
          !isJobListing && selectedProviderIds.length ? selectedProviderIds : undefined,
      };
      const fingerprint = JSON.stringify(requestPayload);
      const operationId =
        pendingCreateOperationRef.current?.fingerprint === fingerprint
          ? pendingCreateOperationRef.current.operationId
          : createClientOperationId("dc-task");
      pendingCreateOperationRef.current = { fingerprint, operationId };

      return apiRequest("POST", "/api/direct-connect/requests", {
        ...requestPayload,
        operationId,
      });
    },
    onSuccess: (data: any) => {
      pendingCreateOperationRef.current = null;
      if (data?.verificationRequired) {
        toast({
          title: "Address verification required",
          description:
            data?.message ||
            "Complete verification to send provider requests through Direct Connect.",
          variant: "destructive",
        });
        navigate("/verification");
        return;
      }

      setFieldErrors({});
      toast({
        title: "Direct Connect request posted",
        description: "This is now on your Direct Connect board.",
      });
      setTaskTitle("");
      setTaskDescription("");
      setTaskCategoryId("");
      setTaskPayAmount("");
      setSelectedProviderIds([]);
      setPostStep(0);
      setPostIntentLocked(false);
      setShowProviderInvites(false);
      setActiveTab("browse");
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests", "my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests", "count"] });
    },
    onError: (err: any) => {
      const isVerificationGate =
        err?.status === 428 || String(err?.code || "").toUpperCase() === "VERIFICATION_REQUIRED";
      if (isVerificationGate) {
        toast({
          title: "Address verification required",
          description: formatUserFacingErrorMessage(
            err,
            "Complete verification to send provider requests through Direct Connect."
          ),
          variant: "destructive",
        });
        navigate("/verification");
        return;
      }

      const message = String(err?.message || "Please try again.");
      if (/non-contact project details/i.test(message)) {
        setFieldErrors((prev) => ({
          ...prev,
          description: message,
          form: message,
        }));
      } else {
        setFieldErrors((prev) => ({ ...prev, form: message }));
      }
      toast({
        title: "Couldn't create Direct Connect request",
        description: formatUserFacingErrorMessage(err, message),
        variant: "destructive",
      });
    },
  });

  const filteredRequests = useMemo(() => {
    if (!workRequests) return [];

    return workRequests
      .filter((request) => !looksLikeHiddenOrTestRequest(request))
      .filter((request) => isCurrentLiveRequest(request))
      .filter((request) => {
        const matchesSearch =
          !searchQuery ||
          request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          request.description.toLowerCase().includes(searchQuery.toLowerCase());

        if (selectedCategory && request.category !== selectedCategory) {
          return false;
        }

        return matchesSearch;
      })
      .sort((a, b) => {
        const aTs = new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime();
        const bTs = new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime();
        return bTs - aTs;
      });
  }, [workRequests, searchQuery, selectedCategory]);

  const shellClass = embedded ? "space-y-3" : "";
  const contentSpacing = embedded ? "mt-0" : "mt-6";
  const postSteps = ["Basics", "Details", "Review"];
  const canAdvanceBasics = taskTitle.trim().length > 0 && taskDescription.trim().length > 0;
  const isJobListing = postIntent === "job_listing";
  const taskTypeOptions = isJobListing
    ? [
        { value: "one_time", label: "Contract" },
        { value: "recurring", label: "Ongoing / Part-time" },
        { value: "project_based", label: "Full-time / Project" },
      ]
    : [
        { value: "one_time", label: "One-time" },
        { value: "recurring", label: "Recurring" },
        { value: "project_based", label: "Project-based" },
      ];

  return (
    <Page className={embedded ? "" : "max-w-7xl pb-20"}>
      <Section>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "browse" | "post")}
          className={embedded ? "" : "mb-8"}
        >
          {!embedded && (
            <TabsList className="grid w-full grid-cols-2 border border-white/10 bg-black/35 p-1">
              <TabsTrigger
                value="browse"
                className="text-white/60 data-[state=active]:bg-ts-orange/20 data-[state=active]:text-white"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Live requests
              </TabsTrigger>
              <TabsTrigger
                value="post"
                className="text-white/60 data-[state=active]:bg-ts-orange/20 data-[state=active]:text-white"
              >
                Post request
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="browse" className={contentSpacing}>
            <Card
              className={`border-white/10 bg-tsCard/95 shadow-[0_12px_34px_rgba(0,0,0,0.35)] ${embedded ? "mb-3" : "mb-4"}`}
            >
              <CardHeader className={embedded ? "pb-1 pt-3 px-3" : "pb-2"}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h2
                      className={
                        embedded
                          ? "text-sm font-semibold text-white"
                          : "text-lg font-semibold text-white"
                      }
                    >
                      {embedded ? "Requests" : "Live requests"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMultiCountyProvider && (
                      <Button
                        size="sm"
                        variant={selectedCountyFips ? "outline" : "default"}
                        className={
                          selectedCountyFips
                            ? "border-white/10 text-white hover:bg-black/30"
                            : "bg-ts-orange text-text-black hover:bg-ts-orange/90"
                        }
                        onClick={() => setSelectedCountyFips(undefined)}
                      >
                        All allowed counties
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-white hover:bg-black/30 md:w-auto"
                      onClick={() => setShowCountySelector(true)}
                    >
                      Change area
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={embedded ? "pt-1 px-3 pb-3" : ""}>
                <div
                  className={
                    embedded
                      ? "grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3"
                      : "grid grid-cols-1 gap-4 md:grid-cols-3"
                  }
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
                    <Input
                      placeholder={embedded ? "Search requests..." : "Search active requests..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select
                    value={selectedCategory || "all"}
                    onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="hidden md:flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-white/10 text-white hover:bg-black/30"
                      onClick={() => navigate("/direct-connect/pros")}
                    >
                      Browse pros
                    </Button>
                    {isAuthenticated && (
                      <Button
                        className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                        onClick={() => setActiveTab("post")}
                      >
                        Post request
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {!isAuthenticated ? (
              <Card className="border-white/10 bg-tsCard/90">
                <CardContent className="p-8 text-center">
                  <Briefcase className="h-12 w-12 text-white/60 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Sign in required</h3>
                  <p className="text-white/60">Sign in to post and manage requests.</p>
                </CardContent>
              </Card>
            ) : requestsLoading ? (
              <div
                className={
                  embedded
                    ? "grid grid-cols-1 gap-3 lg:grid-cols-2"
                    : "grid grid-cols-1 gap-6 lg:grid-cols-2"
                }
              >
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="border-white/10 bg-tsCard/90 animate-pulse">
                    <CardContent className={embedded ? "p-4" : "p-6"}>
                      <div className="h-4 rounded bg-black/30 mb-4" />
                      <div className="h-20 rounded bg-black/30 mb-4" />
                      <div className="h-4 rounded bg-black/30" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div
                className={
                  embedded
                    ? "grid grid-cols-1 gap-3 lg:grid-cols-2"
                    : "grid grid-cols-1 gap-6 lg:grid-cols-2"
                }
              >
                {filteredRequests.map((request) => (
                  <DirectConnectRequestCard
                    key={request.id}
                    request={{
                      ...request,
                      countyLabel: request.countyFips
                        ? formatCountyLabel(request.countyFips, (request as any).stateCode)
                        : null,
                    }}
                    variant={embedded ? "compact" : "default"}
                    openLabel="Open request"
                    onOpen={() => {
                      const landingUrl = String(
                        (request as any)?.dcMiniLandingUrl ||
                          ((request as any)?.shareToken
                            ? `/r/${encodeURIComponent(String((request as any).shareToken))}`
                            : "")
                      ).trim();
                      if (landingUrl) {
                        navigate(landingUrl);
                        return;
                      }
                      setSelectedBoardRequest(request);
                    }}
                    footer={
                      <>
                        {(request as any)?.viewerEligibility?.hasExplicitRequirements && (
                          <div className="mb-2 text-[10px] text-[color:var(--text-secondary)]">
                            {(request as any)?.canSelectForResponse
                              ? "Eligible to respond"
                              : `Verification needed: ${String(
                                  (
                                    (request as any)?.viewerEligibility?.missingRequirements || []
                                  ).join(", ")
                                )}`}
                          </div>
                        )}
                        {isAuthenticated && isMultiCountyProvider && (
                          <Button
                            size="sm"
                            className="h-8 w-full bg-ts-orange text-xs text-text-black hover:bg-ts-orange/90"
                            disabled={expressInterestMutation.isPending}
                            onClick={() =>
                              expressInterestMutation.mutate(String((request as any).id))
                            }
                          >
                            {expressInterestMutation.isPending ? "Sending..." : "Express interest"}
                          </Button>
                        )}
                      </>
                    }
                  />
                ))}
                {filteredRequests.length === 0 && (
                  <div className="col-span-full">
                    <Card className="border-white/10 bg-tsCard/90">
                      <CardContent className={embedded ? "p-5 text-center" : "p-8 text-center"}>
                        <Briefcase className="h-12 w-12 text-white/60 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">
                          No local requests yet
                        </h3>
                        <p className="text-white/60">
                          Try changing your area or post a new request.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="post" className={contentSpacing}>
            <Card className="border-white/10 bg-tsCard/95 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
              <CardHeader className={embedded ? "pb-2 pt-3 px-3" : "pb-4"}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2
                      className={
                        embedded
                          ? "text-base font-semibold text-white"
                          : "text-lg font-semibold text-white mb-1"
                      }
                    >
                      {isJobListing ? "Post a job listing" : "Post request"}
                    </h2>
                  </div>
                  <div className="text-xs text-white/60">
                    Step {postStep + 1}/{postSteps.length} · {postSteps[postStep]}
                  </div>
                </div>
              </CardHeader>
              <CardContent className={embedded ? "pt-0 px-3 pb-3" : ""}>
                {!isAuthenticated ? (
                  <p className="text-sm text-white/60">Sign in to post.</p>
                ) : (
                  <div className="grid gap-4">
                    {postStep === 0 && (
                      <div className="grid gap-3">
                        <div className="grid gap-2">
                          <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                            Title
                          </Label>
                          <Input
                            value={taskTitle}
                            onChange={(e) => {
                              setTaskTitle(e.target.value);
                              if (fieldErrors.title || fieldErrors.form) {
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  title: undefined,
                                  form: undefined,
                                }));
                              }
                            }}
                            className=""
                            placeholder={
                              isJobListing
                                ? "e.g., Lead Carpenter needed"
                                : "e.g., Help moving a couch"
                            }
                          />
                          {fieldErrors.title && (
                            <p role="alert" className="text-xs text-destructive">
                              {fieldErrors.title}
                            </p>
                          )}
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                            Description
                          </Label>
                          <Textarea
                            value={taskDescription}
                            onChange={(e) => {
                              setTaskDescription(e.target.value);
                              if (fieldErrors.description || fieldErrors.form) {
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  description: undefined,
                                  form: undefined,
                                }));
                              }
                            }}
                            className="min-h-[96px]"
                            placeholder={
                              isJobListing
                                ? "Describe the role, experience, and how to apply"
                                : "What needs to be done, when, and any requirements"
                            }
                          />
                          {fieldErrors.description && (
                            <p role="alert" className="text-xs text-destructive">
                              {fieldErrors.description}
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs uppercase tracking-wide text-white/60 mb-2">
                            Posting type
                          </div>
                          <div className="flex flex-col md:flex-row gap-2">
                            <Button
                              type="button"
                              variant={postIntent === "work_request" ? "default" : "outline"}
                              className={
                                postIntent === "work_request"
                                  ? "bg-ts-orange text-text-black hover:bg-ts-orange/90"
                                  : "border-white/10 text-white hover:bg-black/30"
                              }
                              onClick={() => {
                                setPostIntent("work_request");
                                setPostIntentLocked(true);
                              }}
                            >
                              Need work done
                            </Button>
                            <Button
                              type="button"
                              variant={postIntent === "job_listing" ? "default" : "outline"}
                              className={
                                postIntent === "job_listing"
                                  ? "bg-ts-orange text-text-black hover:bg-ts-orange/90"
                                  : "border-white/10 text-white hover:bg-black/30"
                              }
                              onClick={() => {
                                navigate("/direct-connect/employment?tab=jobs&mode=post");
                              }}
                            >
                              Employment hiring
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {postStep === 1 && (
                      <div className="grid gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                              Category
                            </Label>
                            <Select
                              value={taskCategoryId || "none"}
                              onValueChange={(v) => setTaskCategoryId(v === "none" ? "" : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No category</SelectItem>
                                {categories?.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                              {isJobListing ? "Role / Trade" : "Trade / Service"}
                            </Label>
                            <Select
                              value={selectedTradeSlug || "none"}
                              onValueChange={(v) => setSelectedTradeSlug(v === "none" ? "" : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a trade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No trade</SelectItem>
                                {(trades as any[]).map((trade) => (
                                  <SelectItem key={trade.slug} value={trade.slug}>
                                    {trade.name || trade.slug}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                              {isJobListing ? "Engagement type" : "Request type"}
                            </Label>
                            <Select
                              value={taskTaskType}
                              onValueChange={(v) => setTaskTaskType(v as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {taskTypeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    {postStep === 2 && (
                      <div className="grid gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                              Pay type
                            </Label>
                            <Select
                              value={taskPayType}
                              onValueChange={(v) => setTaskPayType(v as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">Fixed</SelectItem>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="per_task">Per job</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                              Pay amount
                            </Label>
                            <Input
                              value={taskPayAmount}
                              onChange={(e) => {
                                setTaskPayAmount(e.target.value);
                                if (fieldErrors.pay || fieldErrors.form) {
                                  setFieldErrors((prev) => ({
                                    ...prev,
                                    pay: undefined,
                                    form: undefined,
                                  }));
                                }
                              }}
                              className=""
                              placeholder="e.g., 150"
                              inputMode="decimal"
                            />
                            {fieldErrors.pay && (
                              <p role="alert" className="text-xs text-destructive">
                                {fieldErrors.pay}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                              {isJobListing ? "Start timing" : "Scheduling"}
                            </Label>
                            <Select
                              value={taskSchedulingType}
                              onValueChange={(v) => setTaskSchedulingType(v as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="asap">ASAP</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="flexible">Flexible</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                              County
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                readOnly
                                value={selectedCountyLabel}
                                placeholder="Set county"
                                className=""
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="border-white/10 text-white hover:bg-black/30"
                                onClick={() => {
                                  if (fieldErrors.county || fieldErrors.form) {
                                    setFieldErrors((prev) => ({
                                      ...prev,
                                      county: undefined,
                                      form: undefined,
                                    }));
                                  }
                                  setShowCountySelector(true);
                                }}
                              >
                                {selectedCountyFips ? "Change" : "Set"}
                              </Button>
                            </div>
                            {fieldErrors.county && (
                              <p role="alert" className="text-xs text-destructive">
                                {fieldErrors.county}
                              </p>
                            )}
                          </div>
                        </div>

                        {!isJobListing && (
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                                Choose your pros (optional)
                              </Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-white/60 hover:text-white"
                                onClick={() => setShowProviderInvites((open) => !open)}
                              >
                                {showProviderInvites ? "Hide" : "Show"}
                              </Button>
                            </div>
                            <div className="text-xs text-white/60">
                              Pick up to {MAX_DIRECT_PROS}. If you pick 1-{MAX_DIRECT_PROS}, this is
                              a private direct request to those pros. If you pick none, it posts to
                              the board for relevant pros.
                            </div>
                            {showProviderInvites && (
                              <>
                                {prefillProviderId && contractorPrefill && (
                                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
                                    <div className="text-xs text-white/60">Direct invite</div>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                      <span className="font-medium text-white">
                                        {contractorPrefill.companyName ||
                                          contractorPrefill.name ||
                                          "Selected provider"}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-white/10 text-white hover:bg-black/30"
                                        onClick={() => {
                                          setSelectedProviderIds((prev) =>
                                            prev.filter((id) => id !== prefillProviderId)
                                          );
                                          setPrefillProviderId(null);
                                        }}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {prefillProviderId && !contractorPrefill && (
                                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
                                    <div className="text-xs text-white/60">Direct invite</div>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                      <span className="font-medium text-white">
                                        Selected provider
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-white/10 text-white hover:bg-black/30"
                                        onClick={() => {
                                          setSelectedProviderIds((prev) =>
                                            prev.filter((id) => id !== prefillProviderId)
                                          );
                                          setPrefillProviderId(null);
                                        }}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {!isAuthenticated || !user?.countyFips ? (
                                  <p className="text-sm text-white/60">Set county on profile.</p>
                                ) : providersLoading ? (
                                  <p className="text-sm text-white/60">Loading providers...</p>
                                ) : !tradeSlugForCategory ? (
                                  <p className="text-sm text-white/60">Pick a trade for matches.</p>
                                ) : (recommendedProviders || []).length === 0 ? (
                                  <p className="text-sm text-white/60">No provider matches yet.</p>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs text-white/60">
                                        Suggested providers (selected {selectedProviderIds.length}/
                                        {MAX_DIRECT_PROS})
                                      </p>
                                      {selectedProviderIds.length > 0 && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs text-white/60 hover:text-white"
                                          onClick={() => setSelectedProviderIds([])}
                                        >
                                          Clear
                                        </Button>
                                      )}
                                    </div>
                                    <div className="space-y-1.5">
                                      {recommendedProviders!.map((provider) => {
                                        const checked = selectedProviderIds.includes(provider.id);
                                        return (
                                          <label
                                            key={provider.id}
                                            className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 cursor-pointer"
                                          >
                                            <Checkbox
                                              checked={checked}
                                              onCheckedChange={(val) => {
                                                setSelectedProviderIds((prev) => {
                                                  const wantsOn = Boolean(val);
                                                  if (
                                                    wantsOn &&
                                                    !prev.includes(provider.id) &&
                                                    prev.length >= MAX_DIRECT_PROS
                                                  ) {
                                                    toast({
                                                      title: `Limit ${MAX_DIRECT_PROS} pros`,
                                                      description: `You can direct-request up to ${MAX_DIRECT_PROS} pros. Remove one to add another.`,
                                                      variant: "destructive",
                                                    });
                                                    return prev;
                                                  }

                                                  if (wantsOn) {
                                                    const next = [...prev, provider.id];
                                                    return Array.from(new Set(next));
                                                  }
                                                  return prev.filter((id) => id !== provider.id);
                                                });
                                              }}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm text-white font-medium truncate">
                                                {provider.businessName || "Local provider"}
                                              </div>
                                              <div className="text-xs text-white/60">
                                                {provider.presenceLabel}
                                                {provider.county && provider.state
                                                  ? ` - ${provider.county}, ${provider.state}`
                                                  : null}
                                              </div>
                                              {provider.recommendationCount &&
                                                provider.recommendationCount > 0 && (
                                                  <div className="text-[11px] text-white/60 mt-0.5">
                                                    {provider.recommendationCount} neighbor
                                                    recommendations
                                                  </div>
                                                )}
                                              {typeof provider.connectionRecommendationCount ===
                                                "number" && (
                                                <div className="text-[11px] text-blue-200 mt-0.5">
                                                  {provider.connectionRecommendationCount} from your
                                                  connections
                                                </div>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        className="border-white/10 text-white hover:bg-black/30"
                        onClick={() => {
                          setTaskTitle("");
                          setTaskDescription("");
                          setTaskCategoryId("");
                          setTaskPayAmount("");
                          setSelectedProviderIds([]);
                          setPostStep(0);
                          setPostIntentLocked(false);
                          setShowProviderInvites(false);
                        }}
                        disabled={createTaskMutation.isPending}
                      >
                        Clear
                      </Button>

                      <div className="flex items-center gap-2">
                        {fieldErrors.form && (
                          <p role="alert" className="mr-2 text-xs text-destructive">
                            {fieldErrors.form}
                          </p>
                        )}
                        {postStep > 0 && (
                          <Button
                            variant="outline"
                            className="border-white/10 text-white hover:bg-black/30"
                            onClick={() => setPostStep((step) => Math.max(0, step - 1))}
                            disabled={createTaskMutation.isPending}
                          >
                            Back
                          </Button>
                        )}
                        {postStep < postSteps.length - 1 ? (
                          <Button
                            className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                            onClick={() =>
                              setPostStep((step) => Math.min(postSteps.length - 1, step + 1))
                            }
                            disabled={!canAdvanceBasics}
                          >
                            Next
                          </Button>
                        ) : (
                          <Button
                            className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                            onClick={() => createTaskMutation.mutate()}
                            disabled={createTaskMutation.isPending}
                          >
                            {createTaskMutation.isPending
                              ? "Posting..."
                              : isJobListing
                                ? "Post job listing"
                                : "Post request"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={Boolean(selectedBoardRequest)}
          onOpenChange={(open) => {
            if (!open) setSelectedBoardRequest(null);
          }}
        >
          <DialogContent className="border-white/10 bg-tsCard/95">
            <DialogHeader>
              <DialogTitle className="text-white">
                {selectedBoardRequest?.title || "Request details"}
              </DialogTitle>
            </DialogHeader>
            {selectedBoardRequest && (
              <div className="space-y-3 text-sm text-white/80">
                <p className="text-white/70">{selectedBoardRequest.description}</p>
                {(selectedBoardRequest as any)?.viewerEligibility?.hasExplicitRequirements &&
                  !(selectedBoardRequest as any)?.canSelectForResponse && (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
                      This request is visible, but your account is not currently verified for it.
                      Missing:
                      {String(
                        (
                          ((selectedBoardRequest as any)?.viewerEligibility?.missingRequirements ||
                            []) as string[]
                        ).join(", ") || "requirements"
                      )}
                    </div>
                  )}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 capitalize">
                    {String(selectedBoardRequest.status || "open").replace("_", " ")}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1">
                    {selectedBoardRequest.budgetMin || selectedBoardRequest.budgetMax
                      ? `Budget $${selectedBoardRequest.budgetMin || selectedBoardRequest.budgetMax}`
                      : "Budget not specified"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1">
                    {selectedBoardRequest.countyFips
                      ? formatCountyLabel(
                          String(selectedBoardRequest.countyFips),
                          selectedBoardRequest.stateCode || user?.stateCode
                        )
                      : "Local area"}
                  </span>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="border-white/10 text-white hover:bg-black/30"
                    onClick={() => setSelectedBoardRequest(null)}
                  >
                    Close
                  </Button>
                  {(selectedBoardRequest as any)?.isMine === true && (
                    <Button
                      variant="outline"
                      className="border-white/10 text-white hover:bg-black/30"
                      onClick={() => {
                        setSelectedBoardRequest(null);
                        navigate("/direct-connect/engagements");
                      }}
                    >
                      Open my requests
                    </Button>
                  )}
                  <Button
                    className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                    onClick={() => {
                      setTaskTitle(String(selectedBoardRequest.title || ""));
                      setTaskDescription(String(selectedBoardRequest.description || ""));
                      setTaskCategoryId(String(selectedBoardRequest.category || ""));
                      setSelectedTradeSlug(String(selectedBoardRequest.tradeId || ""));
                      setPostStep(0);
                      setPostIntentLocked(false);
                      setFieldErrors({});
                      if (selectedBoardRequest.countyFips) {
                        setSelectedCountyFips(String(selectedBoardRequest.countyFips));
                      }
                      setSelectedBoardRequest(null);
                      setActiveTab("post");
                    }}
                  >
                    Start a request like this
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* County Selector Dialog - Phase 1 Telemetry Support */}
        <Dialog open={showCountySelector} onOpenChange={setShowCountySelector}>
          <DialogContent className="border-white/10 bg-tsCard/95">
            <DialogHeader>
              <DialogTitle className="text-white">Change your area</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm text-white/60">
              <p>
                Your current area:{" "}
                <span className="font-semibold text-white">{selectedCountyLabel || "Not set"}</span>
              </p>
              <StateCountySelector
                selectedState={countySelectorStateCode}
                selectedCounty={countySelectorFips}
                onStateChange={(stateCode) => setCountySelectorStateCode(stateCode)}
                onCountyChange={(countyFips) => setCountySelectorFips(countyFips)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="border-white/10 text-white hover:bg-black/30"
                  onClick={() => setShowCountySelector(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                  onClick={() => {
                    const newFips = countySelectorFips.trim();
                    if (newFips && newFips !== selectedCountyFips) {
                      try {
                        recordActivity({
                          type: "dc.county_override",
                          ts: new Date().toISOString(),
                          path: typeof window !== "undefined" ? window.location.pathname : "",
                          meta: {
                            surface: "direct_connect",
                            scope: "county",
                            countyFips: newFips,
                            source: "manual_change",
                            sessionId: sessionStorage.getItem("sessionId") || crypto.randomUUID(),
                            asOf: new Date().toISOString(),
                            previousCounty: selectedCountyFips,
                          },
                        });
                      } catch {
                        // fire-and-forget: ignore telemetry failures
                      }
                      setSelectedCountyFips(newFips);
                    }
                    if (newFips) {
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
      </Section>
    </Page>
  );
}
