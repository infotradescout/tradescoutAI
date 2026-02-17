import { useMemo, useState, useEffect } from "react";
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
import { recordActivity } from "@/agent/activity";
import type { WorkRequest, TaskCategory } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";

type TopContractor = {
  id: string;
  businessName: string | null;
  reviewCount: number | null;
  recommendationCount: number | null;
  county: string | null;
  state: string | null;
  presenceLabel: string;
  reachTier: "local" | "regional" | "wide";
  localCredibilityScore?: number | null;
};

type PostIntent = "work_request" | "job_listing";

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

  const jobSignals = [
    "hiring",
    "job",
    "position",
    "role",
    "opening",
    "apply",
    "application",
    "resume",
    "salary",
    "hourly",
    "full-time",
    "full time",
    "part-time",
    "part time",
    "benefits",
    "join our team",
    "employment",
  ];

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

  if (jobSignals.some((signal) => text.includes(signal))) return "job_listing";
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
  const [location, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState<"browse" | "post">(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Phase 1: County selection (defaults to user.countyFips or URL param, with override affordance)
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | undefined>(
    defaultCountyFips || user?.countyFips || undefined
  );
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

  // Telemetry: Track when county defaults are applied from URL params (Phase 1)
  useEffect(() => {
    if (defaultCountyFips && selectedCountyFips === defaultCountyFips) {
      try {
        // Pilot flag enforcement: only fire for traderscornerllc@gmail.com
        if (user?.email === "traderscornerllc@gmail.com") {
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
        }
      } catch {
        // fire-and-forget: ignore telemetry failures
      }
    }
  }, [defaultCountyFips, user]);

  const { data: workRequests, isLoading: requestsLoading } = useQuery<WorkRequest[]>({
    queryKey: ["/api/direct-connect/requests", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);

      const response = await fetch(`/api/direct-connect/requests?${params.toString()}`);
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

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const nextErrors: typeof fieldErrors = {};
      if (!taskTitle.trim()) nextErrors.title = "Add a short title.";
      if (!taskDescription.trim()) nextErrors.description = "Add project details.";
      const hasPayAmount = taskPayAmount.trim().length > 0;
      const payAmount = hasPayAmount ? Number(taskPayAmount) : NaN;
      if (hasPayAmount && (!Number.isFinite(payAmount) || payAmount <= 0)) {
        nextErrors.pay = "Enter a valid pay amount.";
      }
      if (!selectedCountyFips) nextErrors.county = "Set a county before posting.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        throw new Error("Fix the highlighted fields.");
      }

      return apiRequest("POST", "/api/direct-connect/requests", {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        category: taskCategoryId || undefined,
        tradeId: resolvedTradeSlug || undefined,
        budgetMin: hasPayAmount ? payAmount : undefined,
        budgetMax: hasPayAmount ? payAmount : undefined,
        countyFips: selectedCountyFips,
        targetContractorIds:
          !isJobListing && selectedProviderIds.length ? selectedProviderIds : undefined,
      });
    },
    onSuccess: (data: any) => {
      if (data?.verificationRequired) {
        toast({
          title: "Address verification required",
          description:
            data?.message ||
            "Complete verification to send contractor requests through Direct Connect.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
    },
    onError: (err: any) => {
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
        description: message,
        variant: "destructive",
      });
    },
  });

  const filteredRequests = useMemo(() => {
    if (!workRequests) return [];

    return workRequests.filter((request) => {
      const matchesSearch =
        !searchQuery ||
        request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (selectedCategory && request.category !== selectedCategory) {
        return false;
      }

      return matchesSearch;
    });
  }, [workRequests, searchQuery, selectedCategory]);

  const shellClass = embedded
    ? "space-y-3"
    : "max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8 pb-20";
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
    <div className="">
      <div className={shellClass}>
        {!embedded && (
          <div className="mb-5">
            <h1 className="text-3xl font-bold text-white">Direct Connect</h1>
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "browse" | "post")}
          className={embedded ? "" : "mb-8"}
        >
          {!embedded && (
            <TabsList className="grid w-full grid-cols-2 bg-navy-700 border-navy-600">
              <TabsTrigger value="browse" className="data-[state=active]:bg-orange-500">
                <Briefcase className="h-4 w-4 mr-2" />
                Live requests
              </TabsTrigger>
              <TabsTrigger value="post" className="data-[state=active]:bg-orange-500">
                Post request
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="browse" className={contentSpacing}>
            <Card className={`bg-navy-800 border-navy-700 ${embedded ? "mb-3" : "mb-4"}`}>
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
                  {selectedCountyFips && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-500 text-orange-300 hover:bg-orange-500/10 md:w-auto"
                      onClick={() => setShowCountySelector(true)}
                    >
                      Change area
                    </Button>
                  )}
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder={embedded ? "Search requests..." : "Search active requests..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-navy-600 border-navy-500 text-white"
                    />
                  </div>

                  <Select
                    value={selectedCategory || "all"}
                    onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent className="bg-navy-600 border-navy-500 text-white">
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
                      className="border-orange-500 text-orange-300 hover:bg-orange-500/10"
                      onClick={() => navigate("/direct-connect/pros")}
                    >
                      Browse pros
                    </Button>
                    {isAuthenticated && (
                      <Button
                        className="bg-orange-500 hover:bg-orange-600"
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
              <Card className="bg-navy-700 border-navy-600">
                <CardContent className="p-8 text-center">
                  <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Sign in required</h3>
                  <p className="text-gray-300">Sign in to post and manage requests.</p>
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
                  <Card key={i} className="bg-navy-700 border-navy-600 animate-pulse">
                    <CardContent className={embedded ? "p-4" : "p-6"}>
                      <div className="h-4 bg-navy-600 rounded mb-4" />
                      <div className="h-20 bg-navy-600 rounded mb-4" />
                      <div className="h-4 bg-navy-600 rounded" />
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
                  <Card key={request.id} className="bg-navy-700 border-navy-600">
                    <CardContent className={embedded ? "p-3" : "p-4"}>
                      <div
                        className={
                          embedded
                            ? "mb-1.5 flex items-start justify-between"
                            : "flex items-start justify-between mb-2"
                        }
                      >
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-white mb-1">{request.title}</h3>
                          <p className="text-gray-300 text-xs line-clamp-1">
                            {request.description}
                          </p>
                        </div>
                        <span className="ml-3 text-xs px-2 py-1 rounded-full border border-orange-400 text-orange-300 bg-orange-500/10 capitalize">
                          {request.status?.replace("_", " ") || "open"}
                        </span>
                      </div>

                      <div
                        className={
                          embedded
                            ? "mt-2 flex items-center justify-between text-[10px] text-gray-400"
                            : "flex items-center justify-between mt-3 text-[11px] text-gray-400"
                        }
                      >
                        <span>
                          Budget:{" "}
                          {request.budgetMin || request.budgetMax
                            ? `$${request.budgetMin || request.budgetMax}`
                            : "Not specified"}
                        </span>
                        <span>
                          Created{" "}
                          {request.createdAt
                            ? new Date(request.createdAt as any).toLocaleDateString()
                            : "recently"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredRequests.length === 0 && (
                  <div className="col-span-full">
                    <Card className="bg-navy-700 border-navy-600">
                      <CardContent className={embedded ? "p-5 text-center" : "p-8 text-center"}>
                        <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">No requests yet</h3>
                        <p className="text-gray-300">Post your first request.</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="post" className={contentSpacing}>
            <Card className="bg-navy-800 border-navy-700">
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
                  <div className="text-xs text-gray-400">
                    Step {postStep + 1}/{postSteps.length} - {postSteps[postStep]}
                  </div>
                </div>
              </CardHeader>
              <CardContent className={embedded ? "pt-0 px-3 pb-3" : ""}>
                {!isAuthenticated ? (
                  <p className="text-sm text-gray-300">Sign in to post.</p>
                ) : (
                  <div className="grid gap-4">
                    {postStep === 0 && (
                      <div className="grid gap-3">
                        <div className="grid gap-2">
                          <Label>Title</Label>
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
                            className="bg-navy-700 border-navy-600 text-white"
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
                          <Label>Description</Label>
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
                            className="bg-navy-700 border-navy-600 text-white"
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

                        <div className="rounded-md border border-navy-600 bg-navy-800/60 p-3">
                          <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                            Posting type
                          </div>
                          <div className="flex flex-col md:flex-row gap-2">
                            <Button
                              type="button"
                              variant={postIntent === "work_request" ? "default" : "outline"}
                              className={
                                postIntent === "work_request"
                                  ? "bg-orange-500 hover:bg-orange-600"
                                  : "border-gray-500 text-gray-300 hover:bg-gray-300 hover:text-navy-800"
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
                                  ? "bg-orange-500 hover:bg-orange-600"
                                  : "border-gray-500 text-gray-300 hover:bg-gray-300 hover:text-navy-800"
                              }
                              onClick={() => {
                                setPostIntent("job_listing");
                                setPostIntentLocked(true);
                              }}
                            >
                              Hiring
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {postStep === 1 && (
                      <div className="grid gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label>Category</Label>
                            <Select
                              value={taskCategoryId || "none"}
                              onValueChange={(v) => setTaskCategoryId(v === "none" ? "" : v)}
                            >
                              <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                              <SelectContent className="bg-navy-700 border-navy-600 text-white">
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
                            <Label>{isJobListing ? "Role / Trade" : "Trade / Service"}</Label>
                            <Select
                              value={selectedTradeSlug || "none"}
                              onValueChange={(v) => setSelectedTradeSlug(v === "none" ? "" : v)}
                            >
                              <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                                <SelectValue placeholder="Select a trade" />
                              </SelectTrigger>
                              <SelectContent className="bg-navy-700 border-navy-600 text-white">
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
                            <Label>{isJobListing ? "Engagement type" : "Request type"}</Label>
                            <Select
                              value={taskTaskType}
                              onValueChange={(v) => setTaskTaskType(v as any)}
                            >
                              <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-navy-700 border-navy-600 text-white">
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
                            <Label>Pay type</Label>
                            <Select
                              value={taskPayType}
                              onValueChange={(v) => setTaskPayType(v as any)}
                            >
                              <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-navy-700 border-navy-600 text-white">
                                <SelectItem value="fixed">Fixed</SelectItem>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="per_task">Per job</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label>Pay amount</Label>
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
                              className="bg-navy-700 border-navy-600 text-white"
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
                            <Label>{isJobListing ? "Start timing" : "Scheduling"}</Label>
                            <Select
                              value={taskSchedulingType}
                              onValueChange={(v) => setTaskSchedulingType(v as any)}
                            >
                              <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-navy-700 border-navy-600 text-white">
                                <SelectItem value="asap">ASAP</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="flexible">Flexible</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label>County</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                readOnly
                                value={selectedCountyFips || ""}
                                placeholder="Set county"
                                className="bg-navy-700 border-navy-600 text-white"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="border-orange-500 text-orange-300 hover:bg-orange-500/10"
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
                              <Label>Invite providers</Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-gray-300"
                                onClick={() => setShowProviderInvites((open) => !open)}
                              >
                                {showProviderInvites ? "Hide" : "Show"}
                              </Button>
                            </div>
                            {showProviderInvites && (
                              <>
                                {prefillProviderId && contractorPrefill && (
                                  <div className="rounded-md border border-navy-600 bg-navy-800/60 px-3 py-2 text-sm text-gray-200">
                                    <div className="text-xs text-gray-400">Direct invite</div>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                      <span className="font-medium text-white">
                                        {contractorPrefill.companyName ||
                                          contractorPrefill.name ||
                                          "Selected provider"}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-gray-500 text-gray-300"
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
                                  <div className="rounded-md border border-navy-600 bg-navy-800/60 px-3 py-2 text-sm text-gray-200">
                                    <div className="text-xs text-gray-400">Direct invite</div>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                      <span className="font-medium text-white">
                                        Selected provider
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-gray-500 text-gray-300"
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
                                  <p className="text-sm text-gray-300">Set county on profile.</p>
                                ) : providersLoading ? (
                                  <p className="text-sm text-gray-300">Loading providers...</p>
                                ) : !tradeSlugForCategory ? (
                                  <p className="text-sm text-gray-300">Pick a trade for matches.</p>
                                ) : (recommendedProviders || []).length === 0 ? (
                                  <p className="text-sm text-gray-300">No provider matches yet.</p>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-xs text-gray-300">Suggested providers:</p>
                                    <div className="space-y-1.5">
                                      {recommendedProviders!.map((provider) => {
                                        const checked = selectedProviderIds.includes(provider.id);
                                        return (
                                          <label
                                            key={provider.id}
                                            className="flex items-start gap-3 rounded-md border border-navy-600 bg-navy-800/60 px-3 py-2 cursor-pointer"
                                          >
                                            <Checkbox
                                              checked={checked}
                                              onCheckedChange={(val) => {
                                                setSelectedProviderIds((prev) => {
                                                  if (val) {
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
                                              <div className="text-xs text-gray-300">
                                                {provider.presenceLabel}
                                                {provider.county && provider.state
                                                  ? ` - ${provider.county}, ${provider.state}`
                                                  : null}
                                              </div>
                                              {provider.recommendationCount &&
                                                provider.recommendationCount > 0 && (
                                                  <div className="text-[11px] text-gray-400 mt-0.5">
                                                    {provider.recommendationCount} neighbor
                                                    recommendations
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
                        className="border-gray-300 text-gray-300 hover:bg-gray-300 hover:text-navy-800"
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
                            className="border-gray-500 text-gray-300"
                            onClick={() => setPostStep((step) => Math.max(0, step - 1))}
                            disabled={createTaskMutation.isPending}
                          >
                            Back
                          </Button>
                        )}
                        {postStep < postSteps.length - 1 ? (
                          <Button
                            className="bg-orange-500 hover:bg-orange-600"
                            onClick={() =>
                              setPostStep((step) => Math.min(postSteps.length - 1, step + 1))
                            }
                            disabled={!canAdvanceBasics}
                          >
                            Next
                          </Button>
                        ) : (
                          <Button
                            className="bg-orange-500 hover:bg-orange-600"
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

        {/* County Selector Dialog - Phase 1 Telemetry Support */}
        <Dialog open={showCountySelector} onOpenChange={setShowCountySelector}>
          <DialogContent className="bg-navy-900 border-navy-700">
            <DialogHeader>
              <DialogTitle className="text-white">Change your area</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm text-gray-300">
              <p>
                Your current area:{" "}
                <span className="font-semibold text-orange-300">
                  {selectedCountyFips || "Not set"}
                </span>
              </p>
              <Input
                type="text"
                placeholder="Enter county FIPS code (e.g., 04013 for Maricopa, AZ)"
                defaultValue={selectedCountyFips || ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const newFips = (e.target as HTMLInputElement).value.trim();
                    if (newFips && newFips !== selectedCountyFips) {
                      // Telemetry: dc.county_override (Enter key)
                      try {
                        // Pilot flag enforcement: only fire for traderscornerllc@gmail.com
                        if (user?.email === "traderscornerllc@gmail.com") {
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
                        }
                      } catch {
                        // fire-and-forget: ignore telemetry failures
                      }
                      setSelectedCountyFips(newFips);
                      setShowCountySelector(false);
                    }
                  }
                }}
                className="bg-navy-600 border-navy-500 text-white"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="border-gray-500 text-gray-300"
                  onClick={() => setShowCountySelector(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={() => {
                    const input = document.querySelector(
                      'input[placeholder="Enter county FIPS code (e.g., 04013 for Maricopa, AZ)"]'
                    ) as HTMLInputElement | null;
                    if (input) {
                      const newFips = input.value.trim();
                      if (newFips && newFips !== selectedCountyFips) {
                        // Telemetry: dc.county_override (button click)
                        try {
                          // Pilot flag enforcement: only fire for traderscornerllc@gmail.com
                          if (user?.email === "traderscornerllc@gmail.com") {
                            recordActivity({
                              type: "dc.county_override",
                              ts: new Date().toISOString(),
                              path: typeof window !== "undefined" ? window.location.pathname : "",
                              meta: {
                                surface: "direct_connect",
                                scope: "county",
                                countyFips: newFips,
                                source: "manual_change",
                                sessionId:
                                  sessionStorage.getItem("sessionId") || crypto.randomUUID(),
                                asOf: new Date().toISOString(),
                                previousCounty: selectedCountyFips,
                              },
                            });
                          }
                        } catch {
                          // fire-and-forget: ignore telemetry failures
                        }
                        setSelectedCountyFips(newFips);
                        setShowCountySelector(false);
                      }
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
    </div>
  );
}
