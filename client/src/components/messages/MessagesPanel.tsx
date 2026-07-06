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
  BriefcaseBusiness,
  CornerDownLeft,
  Inbox,
  MessageCircle,
  Search,
  Send,
  UserCheck,
  UserX,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type Thread = {
  id: string;
  subject: string | null;
  lastMessageSnippet: string | null;
  lastMessageAt: string;
  unreadCount: number;
  participantCount: number;
};

type ApiThread = {
  id: string;
  subject: string | null;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  participantCount: number;
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
  request: {
    title: string;
    description: string;
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
    estimates: { count: number; latestStatus: string | null };
    invoices: { count: number; latestStatus: string | null };
    schedules: { count: number; latestStatus: string | null };
    payments: { count: number; latestStatus: string | null };
    punch: { count: number; openCount: number; latestStatus: string | null };
    completion: { latestStatus: string | null };
  };
};

function formatJobStatus(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "Not started";
  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

  const threads: Thread[] = (threadsQuery.data?.threads || []).map((t) => ({
    ...t,
    lastMessageAt: t.lastMessageAt || new Date().toISOString(),
  }));

  const incomingRequestsQuery = useQuery<{ requests: IncomingRequest[] }>({
    queryKey: ["/api/social/conversations/requests/incoming"],
    enabled: Boolean(user),
    queryFn: () => apiRequest("GET", "/api/social/conversations/requests/incoming"),
  });
  const incomingRequests = incomingRequestsQuery.data?.requests || [];

  useEffect(() => {
    if (activeView === "requests" && incomingRequests.length > 0 && !activeRequestId) {
      setActiveRequestId(incomingRequests[0].id);
    }
  }, [activeView, incomingRequests, activeRequestId]);

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
      return subject.includes(query) || snippet.includes(query);
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
  const directConnectThreadJob = directConnectThreadJobQuery.data || null;

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

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const activeRequest = incomingRequests.find((r) => r.id === activeRequestId) || null;

  return (
    <div className="flex h-full gap-4">
      <Card className="w-[320px] flex flex-col bg-black/30 border border-white/10 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
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
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`w-full text-left rounded-xl px-3 py-3 text-sm transition-colors ${
                      activeThreadId === thread.id
                        ? "bg-tsCard border border-ts-orange/30"
                        : "bg-tsBg border border-white/10 hover:bg-tsCard"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-white truncate">
                        {thread.subject || "Conversation"}
                      </span>
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

      <Card className="flex-1 flex flex-col bg-black/30 border border-white/10 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">
              {activeView === "requests" ? "Review request" : "Conversation"}
            </p>
            <h2 className="text-lg font-semibold text-white">
              {activeView === "requests"
                ? activeRequest?.fromName || "Select a request"
                : activeThread?.subject || "Select a thread"}
            </h2>
          </div>
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
                            directConnectThreadJob.viewerRole === "requester"
                              ? "/direct-connect/engagements"
                              : "/direct-connect/inbox";
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
