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
import { Search, Inbox, MessageCircle, UserCheck, UserX, Send, CornerDownLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

export default function MessagesPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [requestPreview, setRequestPreview] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<InboxView>("threads");

  const searchParams = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    []
  );
  const requestedUserId = searchParams.get("user");
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

  const sendFirstContactRequestMutation = useMutation({
    mutationFn: (payload: { targetUserId: string; preview: string }) =>
      apiRequest("POST", "/api/social/conversations/start", {
        targetUserId: payload.targetUserId,
        intent: "collaborate",
        authorityGate: "scout_recommendation",
        initiatedFromScoutRecommendationId: "community-first-contact",
        decisionScope: "Community first-contact request",
        contactPreview: payload.preview,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/conversations/requests/incoming"] });
      if (data?.threadId) {
        setActiveThreadId(String(data.threadId));
        setActiveView("threads");
      }
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("user");
        window.history.replaceState({}, "", url.toString());
      }
      toast({
        title: data?.pending ? "Request sent" : "Conversation ready",
        description: data?.pending
          ? "They will review your preview before chat opens."
          : "You can now message.",
      });
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
          ? "Contact is open and ready."
          : "No further contact will be sent.",
      });
    },
  });

  const handleSend = () => {
    if (!activeThreadId || !newMessage.trim()) return;
    sendMutation.mutate({ threadId: activeThreadId, content: newMessage });
  };

  const handleSendFirstContactRequest = () => {
    if (!requestedUserId) return;
    const preview = requestPreview.trim();
    if (!preview) return;
    sendFirstContactRequestMutation.mutate({ targetUserId: requestedUserId, preview });
  };

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const activeRequest = incomingRequests.find((r) => r.id === activeRequestId) || null;

  return (
    <div className="flex h-full gap-4">
      <Card className="w-[320px] flex flex-col bg-slate-950/80 border border-slate-800 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
        <div className="p-5 border-b border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Direct Connect</p>
              <h2 className="text-lg font-semibold text-white">Message Manager</h2>
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
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "border-slate-700 text-slate-300"
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
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "border-slate-700 text-slate-300"
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeView === "requests" ? "Search requests" : "Search messages"}
              className="pl-9 bg-slate-900 border-slate-800 text-slate-200"
            />
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            First-contact previews are required for new connections. Approved requests unlock chat.
          </div>
        </div>

        <ScrollArea className="flex-1">
          {activeView === "requests" ? (
            <div className="p-3 space-y-2">
              {filteredRequests.length === 0 ? (
                <div className="text-center text-slate-400 py-10 space-y-2">
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
                        ? "bg-slate-900 border border-orange-500/60"
                        : "bg-slate-950 border border-slate-800 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white truncate">{request.fromName}</span>
                      <Badge
                        className={
                          request.fromVerified
                            ? "bg-green-500/20 text-green-300 text-[10px]"
                            : "bg-slate-700 text-slate-300 text-[10px]"
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
                    <div className="text-xs text-slate-400 mt-1">
                      {request.contactType === "comment" ? "Comment request" : "Message request"} -{" "}
                      {request.intent}
                    </div>
                    {request.preview && (
                      <div className="text-xs text-slate-500 mt-2 line-clamp-2">
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
                <div className="text-center text-slate-400 py-10 space-y-2">
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
                        ? "bg-slate-900 border border-orange-500/60"
                        : "bg-slate-950 border border-slate-800 hover:bg-slate-900"
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
                    <div className="text-xs text-slate-400 truncate">
                      {thread.lastMessageSnippet || "No messages yet"}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
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

      <Card className="flex-1 flex flex-col bg-slate-950/80 border border-slate-800 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {activeView === "requests" ? "Contact Review" : "Conversation"}
            </p>
            <h2 className="text-lg font-semibold text-white">
              {activeView === "requests"
                ? activeRequest?.fromName || "Select a request"
                : activeThread?.subject || "Select a thread"}
            </h2>
          </div>
          {activeView === "requests" && incomingRequests.length > 0 && (
            <Badge className="bg-orange-500/20 text-orange-200 text-xs">
              {incomingRequests.length} waiting
            </Badge>
          )}
        </div>

        {activeView === "requests" ? (
          <div className="flex-1 p-6">
            {!activeRequest ? (
              <div className="text-center text-slate-400 py-12">Select a request to review.</div>
            ) : (
              <div className="max-w-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{activeRequest.fromName}</h3>
                    <p className="text-xs text-slate-400">
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
                        : "bg-slate-700 text-slate-300 text-xs"
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

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200 whitespace-pre-wrap">
                  {activeRequest.preview || "No preview provided."}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
                  Accepting opens a new conversation. Declining blocks this first-contact attempt.
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    className="bg-orange-500 hover:bg-orange-600"
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
                    className="border-slate-700 text-slate-300"
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
            <ScrollArea className="flex-1 p-4">
              {requestedUserId && (
                <div className="mb-4 rounded-xl border border-blue-600/40 bg-blue-950/20 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                    First Contact Preview
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Your first message is sent as a request. The other person must accept before
                    chat opens.
                  </p>
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={requestPreview}
                      onChange={(e) => setRequestPreview(e.target.value)}
                      placeholder="Write a short intro and why you want to connect"
                      className="bg-slate-900 border-slate-800 text-slate-200"
                      rows={3}
                      disabled={sendFirstContactRequestMutation.isPending}
                    />
                    <Button
                      size="sm"
                      onClick={handleSendFirstContactRequest}
                      disabled={!requestPreview.trim() || sendFirstContactRequestMutation.isPending}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      Send Contact Request
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {mappedMessages.length === 0 ? (
                  <div className="text-center text-slate-400 py-12">No messages yet.</div>
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
                            ? "bg-orange-500 text-slate-950"
                            : "bg-slate-900 text-slate-100 border border-slate-800"
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

            <div className="p-4 border-t border-slate-800">
              <div className="flex items-end gap-3">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Write a message..."
                  className="bg-slate-900 border-slate-800 text-slate-200 min-h-[44px]"
                  rows={2}
                  disabled={!activeThreadId || sendMutation.isPending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!activeThreadId || !newMessage.trim() || sendMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
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
