import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  CornerDownLeft,
  DollarSign,
  Inbox,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Timer,
  UserCheck,
  UserX,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  adaptConversationThread,
  type ApiConversationContext,
  type ConversationContext,
  type ConversationContextKind,
} from "./conversationContextAdapter";

type Thread = {
  id: string;
  subject: string | null;
  lastMessageSnippet: string | null;
  lastMessageAt: string;
  unreadCount: number;
  participantCount: number;
  kind?: ConversationContextKind | string | null;
  context: ConversationContext;
  participant?: { id: string; name: string; profileImageUrl?: string | null } | null;
  threadHref: string;
};

type ApiThread = {
  id: string;
  subject: string | null;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  participantCount: number;
  kind?: ConversationContextKind | string | null;
  context?: ApiConversationContext | null;
  participant?: { id: string; name: string; profileImageUrl?: string | null } | null;
};

type ApiMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: string;
  content: string;
  messageType: string;
  metadata?: any;
  readAt?: string | null;
  createdAt: string;
};

type Message = {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  isMine: boolean;
};

type IncomingRequest = {
  id: string;
  createdAt: string;
  fromUserId: string;
  fromName: string;
  fromRole?: string | null;
  fromVerified?: boolean;
  preview?: string;
  intent: "hire" | "advise" | "collaborate" | "reconnect";
  contactType?: "message" | "comment";
  postId?: string | null;
};

type InboxView = "threads" | "requests";

type UserHome = {
  id: string;
  nickname?: string | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  city?: string | null;
  stateCode?: string | null;
};

type SharedHomeReportPayload = {
  shares: Array<{
    share: {
      id: string;
      sharedByUserId: string;
      createdAt: string;
      includeAddress: boolean;
      includeDocuments: boolean;
    };
    report: {
      home: UserHome & {
        address1?: string | null;
        address2?: string | null;
        zipCode?: string | null;
        countyFips?: string | null;
      };
      records: any[];
      appliances: any[];
      schedules: any[];
      projects: any[];
      documents: any[];
      homefax: any | null;
    };
  }>;
};

type DirectConnectThreadJob = {
  threadId: string;
  requestId: string;
  jobWorkspaceId: string | null;
  viewerRole: "requester" | "provider";
  contactGateState: string;
  releasedContact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  request: {
    title: string;
    description: string;
    category?: string | null;
    county?: string | null;
    cityArea?: string | null;
    status: string;
    createdAt: string | null;
  };
  assignment: {
    id: string;
    status: string;
    responseSummary?: {
      availabilityWindow?: string;
      priceBand?: string;
      scopeNote?: string;
    } | null;
  };
  job: {
    status: string | null;
    activeStage: string | null;
    allowedLifecycleActions: string[];
  };
  summaries: {
    estimates: {
      count: number;
      latestId?: string | null;
      latestStatus: string | null;
      latestTotal?: number | null;
    };
    invoices: {
      count: number;
      latestId?: string | null;
      latestStatus: string | null;
      latestTotal?: number | null;
    };
    schedules: { count: number; latestId?: string | null; latestStatus: string | null };
    payments: {
      count: number;
      latestId?: string | null;
      latestStatus: string | null;
      latestAmount?: number | null;
    };
    punch: { count: number; openCount: number; latestStatus: string | null };
    completion: { latestId?: string | null; latestStatus: string | null };
    receipts?: { count: number; latestStatus: string | null };
  };
  assist?: {
    primaryAction: {
      key: string;
      label: string;
      href: string;
      oneClick?: {
        key: string;
        label: string;
        method: "POST";
        endpoint: string;
      } | null;
    };
    detailHref: string;
    prefill: {
      title: string;
      scope: string;
      category: string | null;
      county: string | null;
      cityArea: string | null;
      availabilityWindow: string | null;
      estimatedTiming: string | null;
      priceBand: string | null;
      scopeNote: string | null;
    };
    learningSignals: {
      cost: { label: string; value: number | null; source: string | null };
      timeline: { label: string; value: string | null };
      satisfaction: { label: string; value: string | null };
      trust: { label: string; value: string | null };
    };
  };
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function hasRenderableDirectConnectThreadJob(
  value: unknown
): value is DirectConnectThreadJob {
  if (!isRecord(value) || !isRecord(value.request) || !isRecord(value.job)) return false;
  if (
    (value.viewerRole !== "requester" && value.viewerRole !== "provider") ||
    typeof value.request.title !== "string" ||
    typeof value.request.description !== "string" ||
    typeof value.request.status !== "string" ||
    !Array.isArray(value.job.allowedLifecycleActions)
  ) {
    return false;
  }
  if (value.releasedContact != null && !isRecord(value.releasedContact)) return false;

  const summaries = value.summaries;
  if (
    !isRecord(summaries) ||
    !isRecord(summaries.estimates) ||
    !isRecord(summaries.schedules) ||
    !isRecord(summaries.invoices) ||
    !isRecord(summaries.punch) ||
    !isRecord(summaries.completion) ||
    typeof summaries.estimates.count !== "number" ||
    typeof summaries.schedules.count !== "number" ||
    typeof summaries.invoices.count !== "number" ||
    typeof summaries.punch.openCount !== "number"
  ) {
    return false;
  }

  if (value.assist != null) {
    const assist = value.assist;
    if (
      !isRecord(assist) ||
      !isRecord(assist.primaryAction) ||
      typeof assist.primaryAction.label !== "string" ||
      !isRecord(assist.prefill) ||
      !isRecord(assist.learningSignals) ||
      !isRecord(assist.learningSignals.cost) ||
      !isRecord(assist.learningSignals.timeline) ||
      !isRecord(assist.learningSignals.satisfaction) ||
      !isRecord(assist.learningSignals.trust) ||
      (assist.primaryAction.oneClick != null &&
        (!isRecord(assist.primaryAction.oneClick) ||
          typeof assist.primaryAction.oneClick.label !== "string" ||
          typeof assist.primaryAction.oneClick.endpoint !== "string"))
    ) {
      return false;
    }
  }

  return true;
}

function formatJobStatus(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "Not started";
  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Pending";
  return Number(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function MessagesPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<InboxView>("threads");
  const [selectedHomeId, setSelectedHomeId] = useState<string>("");
  const [shareIncludeAddress, setShareIncludeAddress] = useState(false);
  const [shareIncludeDocuments, setShareIncludeDocuments] = useState(false);

  const searchParams = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    []
  );
  const preselectedThreadId = searchParams.get("thread");
  const requestedTab = (searchParams.get("tab") || "").toLowerCase();
  const preselectedRequestId = searchParams.get("requestId");

  useEffect(() => {
    if (requestedTab === "requests") {
      setActiveView("requests");
    }
  }, [requestedTab]);

  const threadsQuery = useQuery<{ threads: ApiThread[] }>({
    queryKey: ["/api/messages/threads"],
    enabled: Boolean(user),
    queryFn: () => apiRequest("GET", "/api/messages/threads?limit=50&offset=0"),
  });

  const threads: Thread[] = (threadsQuery.data?.threads || []).map((thread) => ({
    ...adaptConversationThread(thread),
    lastMessageAt: thread.lastMessageAt || new Date().toISOString(),
  }));

  const incomingRequestsQuery = useQuery<{ requests: IncomingRequest[] }>({
    queryKey: ["/api/social/conversations/requests/incoming"],
    enabled: Boolean(user),
    queryFn: () => apiRequest("GET", "/api/social/conversations/requests/incoming"),
  });
  const incomingRequests = incomingRequestsQuery.data?.requests || [];

  useEffect(() => {
    if (activeView === "requests" && incomingRequests.length > 0 && !activeRequestId) {
      const requested = preselectedRequestId
        ? incomingRequests.find((request) => request.id === preselectedRequestId)
        : null;
      setActiveRequestId(requested?.id || incomingRequests[0].id);
    }
  }, [activeView, incomingRequests, activeRequestId, preselectedRequestId]);

  useEffect(() => {
    if (!activeThreadId && preselectedThreadId) {
      setActiveThreadId(preselectedThreadId);
    }
  }, [activeThreadId, preselectedThreadId]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter((t) => {
      const subject = (t.subject || "").toLowerCase();
      const snippet = (t.lastMessageSnippet || "").toLowerCase();
      const label = t.context.label.toLowerCase();
      const participant = (t.participant?.name || "").toLowerCase();
      return (
        subject.includes(query) ||
        snippet.includes(query) ||
        label.includes(query) ||
        participant.includes(query)
      );
    });
  }, [threads, searchQuery]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return incomingRequests;
    const query = searchQuery.toLowerCase();
    return incomingRequests.filter((request) => {
      const name = (request.fromName || "").toLowerCase();
      const preview = (request.preview || "").toLowerCase();
      return name.includes(query) || preview.includes(query);
    });
  }, [incomingRequests, searchQuery]);

  const messagesQuery = useQuery<{ thread: ApiThread; messages: ApiMessage[] } | null>({
    queryKey: ["/api/messages/threads", activeThreadId],
    enabled: Boolean(activeThreadId && user),
    queryFn: () => apiRequest("GET", `/api/messages/threads/${activeThreadId}`),
  });

  const markThreadReadMutation = useMutation({
    mutationFn: (threadId: string) => apiRequest("PUT", `/api/messages/threads/${threadId}/read`),
    onSuccess: async (_data, threadId) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", threadId] });
    },
  });

  useEffect(() => {
    if (activeThreadId && user) markThreadReadMutation.mutate(activeThreadId);
    // A thread is marked once when selection changes; query invalidation must not retrigger it.
  }, [activeThreadId, user?.id]);

  const homesQuery = useQuery<{ homes: UserHome[] }>({
    queryKey: ["/api/homes"],
    enabled: Boolean(user && activeView === "threads"),
    queryFn: () => apiRequest("GET", "/api/homes"),
  });
  const homes = homesQuery.data?.homes || [];

  useEffect(() => {
    if (!selectedHomeId && homes.length > 0) setSelectedHomeId(homes[0].id);
  }, [selectedHomeId, homes]);

  const homeReportQuery = useQuery<SharedHomeReportPayload>({
    queryKey: ["/api/messages/threads", activeThreadId, "home-report"],
    enabled: Boolean(activeThreadId && user && activeView === "threads"),
    queryFn: () => apiRequest("GET", `/api/messages/threads/${activeThreadId}/home-report`),
  });

  const directConnectThreadJobQuery = useQuery<DirectConnectThreadJob | null>({
    queryKey: ["/api/direct-connect/messages/threads", activeThreadId, "job"],
    enabled: Boolean(activeThreadId && user && activeView === "threads"),
    retry: false,
    queryFn: async () => {
      try {
        return await apiRequest(
          "GET",
          `/api/direct-connect/messages/threads/${activeThreadId}/job`
        );
      } catch (error: any) {
        if (Number(error?.status) === 404) return null;
        throw error;
      }
    },
  });
  const directConnectThreadJobPayload = directConnectThreadJobQuery.data || null;
  const directConnectThreadJob = hasRenderableDirectConnectThreadJob(directConnectThreadJobPayload)
    ? directConnectThreadJobPayload
    : null;
  const directConnectThreadJobUnavailable = Boolean(
    directConnectThreadJobPayload && !directConnectThreadJob
  );

  const directConnectJobActionMutation = useMutation({
    mutationFn: (payload: { endpoint: string }) => apiRequest("POST", payload.endpoint, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/direct-connect/messages/threads", activeThreadId, "job"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/messages/threads", activeThreadId],
      });
      toast({
        title: "Job updated",
        description: "The thread now reflects the latest Direct Connect job status.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not update job",
        description: formatUserFacingErrorMessage(err, "This job step could not be completed."),
        variant: "destructive",
      });
    },
  });

  const shareHomeReportMutation = useMutation({
    mutationFn: (payload: {
      threadId: string;
      homeId: string;
      includeAddress: boolean;
      includeDocuments: boolean;
    }) =>
      apiRequest("POST", `/api/messages/threads/${payload.threadId}/home-report/share`, {
        homeId: payload.homeId,
        includeAddress: payload.includeAddress,
        includeDocuments: payload.includeDocuments,
      }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/messages/threads", variables.threadId, "home-report"],
      });
      toast({
        title: "Home context shared",
        description:
          "This thread can now see the home details you chose to share. Address stays private unless you include it.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Share failed",
        description: formatUserFacingErrorMessage(err, "Could not share your home report."),
        variant: "destructive",
      });
    },
  });

  const mappedMessages: Message[] =
    messagesQuery.data?.messages.map((m) => ({
      id: m.id,
      threadId: m.conversationId,
      authorId: m.senderId,
      authorName: m.senderId === user?.id ? "You" : "Them",
      content: m.content,
      createdAt: m.createdAt,
      isMine: m.senderId === user?.id,
    })) || [];

  const sendMutation = useMutation({
    mutationFn: (payload: { threadId: string; content: string }) =>
      apiRequest("POST", `/api/messages/threads/${payload.threadId}/messages`, {
        content: payload.content,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/messages/threads", variables.threadId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/messages/threads"],
      });
      setNewMessage("");
    },
  });

  const respondToRequestMutation = useMutation({
    mutationFn: (payload: { requestId: string; action: "accept" | "decline" }) =>
      apiRequest("POST", `/api/social/conversations/requests/${payload.requestId}/respond`, {
        action: payload.action,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/conversations/requests/incoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      if (data?.threadId) {
        setActiveThreadId(String(data.threadId));
        setActiveView("threads");
      }
      toast({
        title: data?.accepted ? "Request accepted" : "Request declined",
        description: data?.accepted
          ? "Conversation opens after acceptance."
          : "This request will not open a conversation.",
      });
    },
  });

  const handleSend = () => {
    if (!activeThreadId || !newMessage.trim()) return;
    sendMutation.mutate({ threadId: activeThreadId, content: newMessage });
  };

  const handleShareHomeReport = () => {
    if (!activeThreadId) return;
    if (!selectedHomeId) {
      toast({
        title: "No home selected",
        description: "Add a home in HomeScout first, then share it here.",
        variant: "destructive",
      });
      return;
    }
    shareHomeReportMutation.mutate({
      threadId: activeThreadId,
      homeId: selectedHomeId,
      includeAddress: shareIncludeAddress,
      includeDocuments: shareIncludeDocuments,
    });
  };

  const detailThread = messagesQuery.data?.thread
    ? ({
        ...adaptConversationThread(messagesQuery.data.thread),
        lastMessageAt: messagesQuery.data.thread.lastMessageAt || new Date().toISOString(),
      } as Thread)
    : null;
  const activeThread = threads.find((t) => t.id === activeThreadId) || detailThread;
  const activeRequest = incomingRequests.find((r) => r.id === activeRequestId) || null;
  const activeContextLabel = directConnectThreadJob
    ? "Direct Connect"
    : activeThread?.context.label || "Conversation";
  const activeTitle = directConnectThreadJob?.request?.title || activeThread?.subject;

  const selectThread = (thread: Thread) => {
    setActiveThreadId(thread.id);
    if (typeof window !== "undefined") window.history.replaceState(null, "", thread.threadHref);
  };

  const hasSelection =
    activeView === "requests" ? Boolean(activeRequestId) : Boolean(activeThreadId);
  const clearSelection = () => {
    if (activeView === "requests") setActiveRequestId(null);
    else setActiveThreadId(null);
  };

  return (
    <div className="flex h-full flex-col gap-4 md:flex-row">
      <Card
        className={`w-full flex-col bg-black/30 border border-white/10 shadow-[0_20px_60px_rgba(15,23,42,0.35)] md:flex md:w-[320px] ${hasSelection ? "hidden md:flex" : "flex"}`}
      >
        <div className="p-5 border-b border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Direct Connect</p>
              <h2 className="text-lg font-semibold text-white">Messages</h2>
            </div>
            <Badge variant="secondary" className="text-xs">
              {threads.length} threads
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeView === "threads" ? "default" : "outline"}
              className={
                activeView === "threads"
                  ? "bg-ts-orange hover:bg-ts-orange-dark"
                  : "border-white/10 text-white/70"
              }
              onClick={() => setActiveView("threads")}
            >
              Messages
            </Button>
            <Button
              size="sm"
              variant={activeView === "requests" ? "default" : "outline"}
              className={
                activeView === "requests"
                  ? "bg-ts-orange hover:bg-ts-orange-dark"
                  : "border-white/10 text-white/70"
              }
              onClick={() => setActiveView("requests")}
            >
              Requests
              {incomingRequests.length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5">
                  {incomingRequests.length > 9 ? "9+" : incomingRequests.length}
                </Badge>
              )}
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeView === "requests" ? "Search requests" : "Search messages"}
              className="pl-9 bg-tsCard border-white/10 text-white/70"
            />
          </div>
          <div className="rounded-lg border border-white/10 bg-tsCard/95 px-3 py-2 text-xs text-white/60">
            Review requests before contact opens. Conversation opens after acceptance.
          </div>
        </div>

        <ScrollArea className="flex-1">
          {activeView === "requests" ? (
            <div className="p-3 space-y-2">
              {filteredRequests.length === 0 ? (
                <div className="text-center text-white/60 py-10 space-y-2">
                  <Inbox className="h-8 w-8 mx-auto opacity-60" />
                  <p className="text-sm">
                    {incomingRequests.length === 0
                      ? "No contact requests yet."
                      : "No requests match your search."}
                  </p>
                </div>
              ) : (
                filteredRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setActiveRequestId(request.id)}
                    className={`w-full text-left rounded-xl px-3 py-3 text-sm transition-colors ${
                      activeRequestId === request.id
                        ? "bg-tsCard border border-ts-orange/30"
                        : "bg-tsBg border border-white/10 hover:bg-tsCard"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white truncate">{request.fromName}</span>
                      <Badge
                        className={
                          request.fromVerified
                            ? "bg-green-500/20 text-green-300 text-[10px]"
                            : "bg-white/10 text-white/70 text-[10px]"
                        }
                        title={
                          request.fromVerified
                            ? "Verified profile"
                            : "Unverified profile. Verified members are more likely to be accepted."
                        }
                      >
                        {request.fromVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {request.contactType === "comment" ? "Comment request" : "Message request"} -{" "}
                      {request.intent}
                    </div>
                    {request.preview && (
                      <div className="text-xs text-white/60 mt-2 line-clamp-2">
                        {request.preview}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filteredThreads.length === 0 ? (
                <div className="text-center text-white/60 py-10 space-y-2">
                  <MessageCircle className="h-8 w-8 mx-auto opacity-60" />
                  <p className="text-sm">No conversations yet.</p>
                </div>
              ) : (
                filteredThreads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    data-testid="message-thread-card"
                    onClick={() => selectThread(thread)}
                    className={`w-full text-left rounded-xl px-3 py-3 text-sm transition-colors ${
                      activeThreadId === thread.id
                        ? "bg-tsCard border border-ts-orange/30"
                        : "bg-tsBg border border-white/10 hover:bg-tsCard"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-ts-orange">
                          {thread.context.label}
                        </div>
                        <span className="block font-medium text-white truncate">
                          {thread.subject || "Conversation"}
                        </span>
                      </div>
                      {thread.unreadCount > 0 && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-500 text-white">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/60 truncate">
                      {thread.lastMessageSnippet || "No messages yet"}
                    </div>
                    <div className="mt-1 text-[10px] text-white/60">
                      {thread.lastMessageAt
                        ? formatDistanceToNow(new Date(thread.lastMessageAt), {
                            addSuffix: true,
                          })
                        : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </Card>

      <Card
        className={`flex-1 flex-col bg-black/30 border border-white/10 shadow-[0_20px_60px_rgba(15,23,42,0.35)] md:flex ${hasSelection ? "flex" : "hidden md:flex"}`}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="flex-none border-white/10 text-white/70 md:hidden"
              onClick={clearSelection}
              aria-label="Back to list"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                {activeView === "requests" ? "Review request" : activeContextLabel}
              </p>
              <h2 className="text-lg font-semibold text-white truncate">
                {activeView === "requests"
                  ? activeRequest?.fromName || "Select a request"
                  : activeTitle || "Select a thread"}
              </h2>
            </div>
          </div>
          {activeView === "threads" && activeThread?.context.href && (
            <Button variant="outline" size="sm" className="border-white/10 text-white/70" asChild>
              <a href={activeThread.context.href}>View {activeThread.context.label}</a>
            </Button>
          )}
          {activeView === "requests" && incomingRequests.length > 0 && (
            <Badge className="bg-ts-orange/20 text-ts-orange text-xs">
              {incomingRequests.length} waiting
            </Badge>
          )}
        </div>

        {activeView === "requests" ? (
          <div className="flex-1 p-6">
            {!activeRequest ? (
              <div className="text-center text-white/60 py-12">Select a request to review.</div>
            ) : (
              <div className="max-w-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{activeRequest.fromName}</h3>
                    <p className="text-xs text-white/60">
                      {activeRequest.contactType === "comment"
                        ? "Comment request"
                        : "Message request"}{" "}
                      - intent: {activeRequest.intent}
                    </p>
                  </div>
                  <Badge
                    className={
                      activeRequest.fromVerified
                        ? "bg-green-500/20 text-green-300 text-xs"
                        : "bg-white/10 text-white/70 text-xs"
                    }
                    title={
                      activeRequest.fromVerified
                        ? "Verified profile"
                        : "Unverified profile. Verified members are more likely to be accepted."
                    }
                  >
                    {activeRequest.fromVerified ? "Verified" : "Unverified"}
                  </Badge>
                </div>

                <div className="rounded-xl border border-white/10 bg-tsCard/95 p-4 text-sm text-white/70 whitespace-pre-wrap">
                  {activeRequest.preview || "No preview provided."}
                </div>

                <div className="rounded-xl border border-white/10 bg-tsCard/95 px-4 py-3 text-xs text-white/60">
                  Conversation opens after acceptance. Declining keeps contact closed.
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    className="bg-ts-orange hover:bg-ts-orange-dark"
                    onClick={() =>
                      respondToRequestMutation.mutate({
                        requestId: activeRequest.id,
                        action: "accept",
                      })
                    }
                    disabled={respondToRequestMutation.isPending}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 text-white/70"
                    onClick={() =>
                      respondToRequestMutation.mutate({
                        requestId: activeRequest.id,
                        action: "decline",
                      })
                    }
                    disabled={respondToRequestMutation.isPending}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {activeThreadId && (
              <div className="px-5 py-4 border-b border-white/10 space-y-3">
                {directConnectThreadJobQuery.isLoading ? (
                  <div className="rounded-xl border border-white/10 bg-tsCard/95 p-4">
                    <div className="h-4 w-44 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-64 rounded bg-white/10" />
                  </div>
                ) : directConnectThreadJob ? (
                  <div
                    className="rounded-xl border border-ts-orange/30 bg-tsCard/95 p-4"
                    data-testid="direct-connect-thread-job-panel"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <BriefcaseBusiness className="h-4 w-4 text-ts-orange" />
                          <div className="text-sm font-semibold text-white">Accepted job</div>
                        </div>
                        <div className="mt-1 truncate text-sm text-white">
                          {directConnectThreadJob.request.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-white/60">
                          {directConnectThreadJob.request.description ||
                            "This Messages thread is tied to an accepted Direct Connect request."}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 md:justify-end">
                        <Badge className="bg-ts-orange/15 text-ts-orange text-[10px]">
                          {formatJobStatus(
                            directConnectThreadJob.job.activeStage ||
                              directConnectThreadJob.request.status
                          )}
                        </Badge>
                        <Badge className="bg-white/5 text-white/70 text-[10px]">
                          {directConnectThreadJob.viewerRole === "requester"
                            ? "Requester view"
                            : "Provider view"}
                        </Badge>
                      </div>
                    </div>

                    {directConnectThreadJob.viewerRole === "provider" && (
                      <div
                        className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3 text-xs"
                        data-testid="direct-connect-released-contact"
                      >
                        {directConnectThreadJob.releasedContact ? (
                          <div className="space-y-1 text-white/75">
                            <div className="font-semibold text-white">
                              Contact released by homeowner
                            </div>
                            {directConnectThreadJob.releasedContact.name && (
                              <div>{directConnectThreadJob.releasedContact.name}</div>
                            )}
                            {directConnectThreadJob.releasedContact.email && (
                              <a
                                className="block text-ts-orange hover:underline"
                                href={`mailto:${directConnectThreadJob.releasedContact.email}`}
                              >
                                {directConnectThreadJob.releasedContact.email}
                              </a>
                            )}
                            {directConnectThreadJob.releasedContact.phone && (
                              <a
                                className="block text-ts-orange hover:underline"
                                href={`tel:${directConnectThreadJob.releasedContact.phone}`}
                              >
                                {directConnectThreadJob.releasedContact.phone}
                              </a>
                            )}
                            {directConnectThreadJob.releasedContact.address && (
                              <div>{directConnectThreadJob.releasedContact.address}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-white/60">
                            Contact stays private until the homeowner explicitly approves and
                            releases it.
                          </div>
                        )}
                      </div>
                    )}

                    {directConnectThreadJob.viewerRole === "requester" &&
                      directConnectThreadJob.contactGateState === "contractor_requested" && (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-ts-orange/20 bg-black/25 p-3 text-xs text-white/65">
                          <span>The accepted provider requested contact access.</span>
                          <Button
                            size="sm"
                            className="h-8 bg-ts-orange text-xs text-black hover:bg-ts-orange/90"
                            onClick={() => {
                              window.location.href = "/direct-connect";
                            }}
                          >
                            Review contact request
                          </Button>
                        </div>
                      )}

                    {directConnectThreadJob.assist && (
                      <div className="mt-3 rounded-lg border border-ts-orange/20 bg-black/25 p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ts-orange">
                              <Sparkles className="h-3.5 w-3.5" />
                              Next step
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {directConnectThreadJob.assist.primaryAction.label}
                            </div>
                            <div className="mt-1 text-xs text-white/60">
                              Site context is attached so the job form can prefill scope, location,
                              timing, price band, and cycle history.
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {directConnectThreadJob.assist.primaryAction.oneClick ? (
                              <Button
                                size="sm"
                                className="h-8 bg-ts-orange text-xs text-black hover:bg-ts-orange/90"
                                disabled={directConnectJobActionMutation.isPending}
                                onClick={() =>
                                  directConnectJobActionMutation.mutate({
                                    endpoint:
                                      directConnectThreadJob.assist?.primaryAction.oneClick
                                        ?.endpoint || "",
                                  })
                                }
                              >
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                {directConnectThreadJob.assist.primaryAction.oneClick.label}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-8 bg-ts-orange text-xs text-black hover:bg-ts-orange/90"
                                onClick={() => {
                                  window.location.href =
                                    directConnectThreadJob.assist?.primaryAction.href ||
                                    directConnectThreadJob.assist?.detailHref ||
                                    "/direct-connect";
                                }}
                              >
                                {directConnectThreadJob.assist.primaryAction.label}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/70 md:grid-cols-4">
                      {[
                        {
                          label: "Estimate",
                          value:
                            directConnectThreadJob.summaries.estimates.count > 0
                              ? formatJobStatus(
                                  directConnectThreadJob.summaries.estimates.latestStatus
                                )
                              : "None",
                        },
                        {
                          label: "Schedule",
                          value:
                            directConnectThreadJob.summaries.schedules.count > 0
                              ? formatJobStatus(
                                  directConnectThreadJob.summaries.schedules.latestStatus
                                )
                              : "None",
                        },
                        {
                          label: "Invoice",
                          value:
                            directConnectThreadJob.summaries.invoices.count > 0
                              ? formatJobStatus(
                                  directConnectThreadJob.summaries.invoices.latestStatus
                                )
                              : "None",
                        },
                        {
                          label: "Punch",
                          value:
                            directConnectThreadJob.summaries.punch.openCount > 0
                              ? `${directConnectThreadJob.summaries.punch.openCount} open`
                              : formatJobStatus(
                                  directConnectThreadJob.summaries.completion.latestStatus
                                ),
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border border-white/10 bg-black/25 px-3 py-2"
                        >
                          <div className="text-white/50">{item.label}</div>
                          <div className="mt-0.5 font-medium text-white">{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {directConnectThreadJob.assist && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/70 md:grid-cols-4">
                        {[
                          {
                            icon: DollarSign,
                            label: directConnectThreadJob.assist.learningSignals.cost.label,
                            value: formatMoney(
                              directConnectThreadJob.assist.learningSignals.cost.value
                            ),
                          },
                          {
                            icon: Timer,
                            label: directConnectThreadJob.assist.learningSignals.timeline.label,
                            value:
                              directConnectThreadJob.assist.learningSignals.timeline.value ||
                              "Pending",
                          },
                          {
                            icon: Activity,
                            label: directConnectThreadJob.assist.learningSignals.satisfaction.label,
                            value:
                              directConnectThreadJob.assist.learningSignals.satisfaction.value ||
                              "Collecting",
                          },
                          {
                            icon: CheckCircle2,
                            label: directConnectThreadJob.assist.learningSignals.trust.label,
                            value: formatJobStatus(
                              directConnectThreadJob.assist.learningSignals.trust.value
                            ),
                          },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.label}
                              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2"
                            >
                              <div className="flex items-center gap-1.5 text-white/50">
                                <Icon className="h-3.5 w-3.5 text-ts-orange" />
                                <span>{item.label}</span>
                              </div>
                              <div className="mt-0.5 font-medium text-white line-clamp-1">
                                {item.value}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {directConnectThreadJob.assist?.prefill && (
                      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                        <div className="font-semibold text-white">Autofill context</div>
                        <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                          {[
                            ["Scope", directConnectThreadJob.assist.prefill.scope],
                            ["Category", directConnectThreadJob.assist.prefill.category],
                            ["Area", directConnectThreadJob.assist.prefill.cityArea],
                            ["County", directConnectThreadJob.assist.prefill.county],
                            ["Timing", directConnectThreadJob.assist.prefill.estimatedTiming],
                            ["Price band", directConnectThreadJob.assist.prefill.priceBand],
                          ]
                            .filter(([, value]) => Boolean(value))
                            .slice(0, 6)
                            .map(([label, value]) => (
                              <div key={label} className="min-w-0">
                                <span className="text-white/45">{label}: </span>
                                <span className="text-white/75 line-clamp-1">{value}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {directConnectThreadJob.job.allowedLifecycleActions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {directConnectThreadJob.job.allowedLifecycleActions
                          .slice(0, 5)
                          .map((action) => (
                            <span
                              key={action}
                              className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] text-white/60"
                            >
                              {formatJobStatus(action)}
                            </span>
                          ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/10 text-xs text-white/70"
                        onClick={() => {
                          window.location.href =
                            directConnectThreadJob.assist?.detailHref ||
                            (directConnectThreadJob.viewerRole === "requester"
                              ? "/direct-connect/engagements"
                              : "/direct-connect/inbox");
                        }}
                      >
                        Open Direct Connect job
                      </Button>
                      {directConnectThreadJob.jobWorkspaceId && (
                        <Badge className="bg-white/5 text-white/60 text-[10px]">
                          Job lane active
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : directConnectThreadJobUnavailable ? (
                  <div className="rounded-xl border border-white/10 bg-tsCard/95 p-4" role="status">
                    <div className="text-sm font-semibold text-white">
                      Accepted job details are temporarily unavailable
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      This conversation is still open. Retry the page before using job actions.
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Shared home context</div>
                    <div className="text-xs text-white/60">
                      Keep request context attached with the home details you choose to share.
                    </div>
                  </div>
                  <Badge className="bg-tsCard border border-white/10 text-white/70 text-[10px]">
                    Private
                  </Badge>
                </div>

                {homeReportQuery.data?.shares?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {homeReportQuery.data.shares.map((s) => {
                      const home = s.report?.home;
                      const title =
                        home?.nickname ||
                        [home?.city, home?.stateCode].filter(Boolean).join(", ") ||
                        "Shared home";
                      const counts = [
                        { label: "records", value: s.report?.records?.length ?? 0 },
                        { label: "schedules", value: s.report?.schedules?.length ?? 0 },
                        { label: "projects", value: s.report?.projects?.length ?? 0 },
                        { label: "docs", value: s.report?.documents?.length ?? 0 },
                      ];
                      return (
                        <div
                          key={s.share.id}
                          className="rounded-xl border border-white/10 bg-tsCard/95 p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-white">{title}</div>
                              <div className="mt-1 text-[11px] text-white/60">
                                Shared{" "}
                                {formatDistanceToNow(new Date(s.share.createdAt), {
                                  addSuffix: true,
                                })}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className="bg-ts-orange/15 text-ts-orange text-[10px]">
                                {s.share.includeAddress ? "Address shared" : "Address hidden"}
                              </Badge>
                              {s.share.includeDocuments && (
                                <Badge className="bg-white/5 text-white/70 text-[10px]">
                                  Docs listed
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {counts.map((c) => (
                              <span
                                key={c.label}
                                className="text-[11px] text-white/70 rounded-full border border-white/10 bg-black/30 px-2 py-0.5"
                              >
                                {c.value} {c.label}
                              </span>
                            ))}
                            {s.report?.homefax?.computedAt && (
                              <span className="text-[11px] text-white/70 rounded-full border border-white/10 bg-black/30 px-2 py-0.5">
                                Homefax updated{" "}
                                {formatDistanceToNow(new Date(s.report.homefax.computedAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-white/60">
                    Nothing shared yet. Share a home report below when you want the other party to
                    see context.
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-tsCard/95 p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <select
                      value={selectedHomeId}
                      onChange={(e) => setSelectedHomeId(e.target.value)}
                      className="w-full md:w-[360px] h-9 rounded-md bg-tsCard border border-white/10 text-white/70 px-3 text-sm"
                      disabled={homes.length === 0}
                    >
                      {homes.length === 0 ? (
                        <option value="">No homes found</option>
                      ) : (
                        homes.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nickname ||
                              [h.city, h.stateCode].filter(Boolean).join(", ") ||
                              "Home"}
                          </option>
                        ))
                      )}
                    </select>
                    <Button
                      className="bg-ts-orange hover:bg-ts-orange-dark"
                      onClick={handleShareHomeReport}
                      disabled={
                        !activeThreadId ||
                        !selectedHomeId ||
                        homes.length === 0 ||
                        shareHomeReportMutation.isPending
                      }
                    >
                      Share home report
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={shareIncludeAddress}
                        onChange={(e) => setShareIncludeAddress(e.target.checked)}
                      />
                      Include address (optional)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={shareIncludeDocuments}
                        onChange={(e) => setShareIncludeDocuments(e.target.checked)}
                      />
                      Include document list (no files)
                    </label>
                  </div>

                  <div className="text-[11px] text-white/60">
                    Address is hidden by default. Documents shared here are names/types only, not
                    downloads.
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {mappedMessages.length === 0 ? (
                  <div className="text-center text-white/60 py-12">No messages yet.</div>
                ) : (
                  mappedMessages.map((m) => (
                    <div
                      key={m.id}
                      data-testid="message-row"
                      className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs md:max-w-md px-3 py-2 rounded-xl text-sm ${
                          m.isMine
                            ? "bg-ts-orange text-black"
                            : "bg-tsCard text-white border border-white/10"
                        }`}
                      >
                        <div className="text-[11px] opacity-70 mb-0.5">{m.authorName}</div>
                        <div>{m.content}</div>
                        <div className="mt-1 text-[10px] opacity-60">
                          {formatDistanceToNow(new Date(m.createdAt), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-white/10">
              <div className="flex items-end gap-3">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Write a message..."
                  className="bg-tsCard border-white/10 text-white/70 min-h-[44px]"
                  rows={2}
                  disabled={!activeThreadId || sendMutation.isPending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!activeThreadId || !newMessage.trim() || sendMutation.isPending}
                  className="bg-ts-orange hover:bg-ts-orange-dark"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
              <div className="mt-2 text-[11px] text-white/60 flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                Press Enter to send once approved contact exists.
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
