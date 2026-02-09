import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

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

export default function MessagesPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const threadsQuery = useQuery<{ threads: ApiThread[] }>({
    queryKey: ["/api/messages/threads"],
    enabled: Boolean(user),
    queryFn: () => apiRequest("GET", "/api/messages/threads?limit=50&offset=0"),
  });

  const threads: Thread[] = (threadsQuery.data?.threads || []).map((t) => ({
    ...t,
    lastMessageAt: t.lastMessageAt || new Date().toISOString(),
  }));

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

  const handleSend = () => {
    if (!activeThreadId || !newMessage.trim()) return;
    sendMutation.mutate({ threadId: activeThreadId, content: newMessage });
  };

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;

  return (
    <div className="flex h-full gap-4">
      {/* Thread list */}
      <Card className="w-80 flex flex-col bg-slate-900 border-none shadow-none">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Messages</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {threads.length === 0 ? (
              <div className="text-center text-slate-400 py-8 space-y-3">
                <p>No conversations yet.</p>
                <p className="text-xs text-slate-500">
                  Start through Scout or Direct Connect to keep contact intent-gated.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/direct-connect">
                    <Button size="sm">Direct Connect</Button>
                  </Link>
                  <Link href="/scout">
                    <Button size="sm" variant="outline">
                      Ask Scout
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  data-testid="message-thread-card"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeThreadId === thread.id
                      ? "bg-slate-800 border border-blue-500"
                      : "bg-slate-900 border border-slate-800 hover:bg-slate-800"
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
        </ScrollArea>
      </Card>

      {/* Messages column */}
      <Card className="flex-1 flex flex-col bg-slate-900 border-none shadow-none">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">
            {activeThread ? activeThread.subject || "Conversation" : "Select a thread"}
          </h2>
        </div>
        <ScrollArea className="flex-1 p-4">
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
                    className={`max-w-xs md:max-w-md px-3 py-2 rounded-lg text-sm ${
                      m.isMine
                        ? "bg-blue-500 text-white"
                        : "bg-slate-800 text-slate-100 border border-slate-700"
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
        <div className="p-4 border-t border-slate-700 flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              activeThreadId ? "Type a message..." : "Select a thread to start messaging"
            }
            disabled={!activeThreadId || sendMutation.isPending}
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!activeThreadId || !newMessage.trim() || sendMutation.isPending}
          >
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
