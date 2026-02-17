import { ReactNode, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import TasksHub from "../tasks";
import DirectConnectPros from "./DirectConnectPros";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WhyThisJobModal } from "./WhyThisJobModal";
import { WhyLink } from "@/components/WhyLink";
import { getHelpLink } from "@/scout/helpSources";
import { useToast } from "@/hooks/use-toast";
import { share, shareToPlatform } from "@/utils/share";
import {
  ClipboardPlus,
  LayoutList,
  Inbox,
  Users,
  BriefcaseBusiness,
  Share2,
  MessageCircle,
  Smartphone,
} from "lucide-react";

const SECTIONS = ["post", "board", "inbox", "pros", "engagements"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABELS: Record<Section, string> = {
  post: "Post Request",
  board: "Job Board",
  inbox: "Inbox",
  pros: "Pros",
  engagements: "My Requests",
};

const SECTION_META: Record<
  Section,
  {
    title: string;
    description: string;
    actionLabel: string;
    actionTarget: Section;
  }
> = {
  post: {
    title: "Post a request",
    description: "Post once. Track status in one place.",
    actionLabel: "Go to My Requests",
    actionTarget: "engagements",
  },
  board: {
    title: "Job board",
    description: "Browse open local requests.",
    actionLabel: "Open Inbox",
    actionTarget: "inbox",
  },
  inbox: {
    title: "Provider inbox",
    description: "Review opportunities and respond.",
    actionLabel: "View My Requests",
    actionTarget: "engagements",
  },
  pros: {
    title: "Pro directory",
    description: "Browse local pros and start a request.",
    actionLabel: "Post Request",
    actionTarget: "post",
  },
  engagements: {
    title: "My requests",
    description: "Track status and next steps.",
    actionLabel: "Open Inbox",
    actionTarget: "inbox",
  },
};

const SECTION_ICONS: Record<Section, ReactNode> = {
  post: <ClipboardPlus className="h-4 w-4" />,
  board: <LayoutList className="h-4 w-4" />,
  inbox: <Inbox className="h-4 w-4" />,
  pros: <Users className="h-4 w-4" />,
  engagements: <BriefcaseBusiness className="h-4 w-4" />,
};

function getSectionFromPath(path: string): Section {
  const match = path.match(/^\/direct-connect(?:\/(.+))?/);
  const raw = match?.[1]?.split("/")[0] ?? "";
  if (!raw) return "post";
  if (SECTIONS.includes(raw as Section)) return raw as Section;
  return "post";
}

function buildHref(section: Section): string {
  if (section === "post") return "/direct-connect";
  return `/direct-connect/${section}`;
}

function statusTone(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "accepted" || value === "in_progress") {
    return "bg-emerald-500/15 text-emerald-200 border-emerald-400/40";
  }
  if (value === "declined" || value === "cancelled") {
    return "bg-rose-500/15 text-rose-200 border-rose-400/40";
  }
  if (value === "routed" || value === "suggested" || value === "invited") {
    return "bg-orange-500/15 text-orange-200 border-orange-400/40";
  }
  return "bg-slate-500/15 text-slate-200 border-slate-400/40";
}

type DirectConnectInboxItem = {
  assignment: {
    id: string;
    workRequestId: string;
    status: string;
    scoreSnapshot?: {
      score?: number;
      reasons?: string[];
      distanceMiles?: number;
      tradeMatch?: boolean;
      recommendationCount?: number;
      responseRate?: number;
    } | null;
    createdAt: string;
    updatedAt: string;
  };
  request: {
    id: string;
    title: string;
    description: string;
    status: string;
    tradeId?: string | null;
    countyFips?: string | null;
    createdAt?: string | null;
  } | null;
  conversationThreadId?: string | null;
};

type DirectConnectRequest = {
  id: string;
  title: string;
  description: string;
  status: string;
  tradeId?: string | null;
  countyFips?: string | null;
  budgetMin?: string | null;
  budgetMax?: string | null;
  createdAt?: string | null;
  dcSuggestedCount?: number | null;
  dcAcceptedAssignmentId?: string | null;
  dcConversationThreadId?: string | null;
  dcLastEventAt?: string | null;
};

function SectionNav({
  activeSection,
  onSelect,
  counts,
  mobile = false,
}: {
  activeSection: Section;
  onSelect: (section: Section) => void;
  counts?: Partial<Record<Section, number>>;
  mobile?: boolean;
}) {
  const wrapperClass = mobile
    ? "flex gap-1.5 overflow-x-auto pb-1.5 -mx-0.5 px-0.5"
    : "space-y-1.5";

  return (
    <div className={wrapperClass}>
      {SECTIONS.map((section) => {
        const active = section === activeSection;
        const count = counts?.[section] ?? 0;

        return (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            className={cn(
              "group text-left transition-all",
              mobile
                ? "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] whitespace-nowrap"
                : "w-full rounded-xl border px-3 py-2"
            )}
            style={{
              borderColor: active ? "var(--theme-accent-primary)" : "var(--border-subtle)",
              backgroundColor: active
                ? "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)"
                : "var(--surface-card)",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[color:var(--border-subtle)]">
              {SECTION_ICONS[section]}
            </span>
            <span className="flex-1">
              <span className={cn("font-medium", mobile ? "text-xs" : "text-sm")}>
                {SECTION_LABELS[section]}
              </span>
            </span>
            {count > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DirectConnectInbox() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [whyJobAssignmentId, setWhyJobAssignmentId] = useState<string | null>(null);
  const [declineAssignmentId, setDeclineAssignmentId] = useState<string | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);
  const [inboxFilter, setInboxFilter] = useState<"all" | "suggested" | "accepted" | "declined">(
    "all"
  );

  const { data, isLoading } = useQuery<DirectConnectInboxItem[]>({
    queryKey: ["/api/direct-connect/inbox"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/inbox");
      if (!res.ok) throw new Error("Failed to load Direct Connect inbox");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const respondMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      decision: "accept" | "decline";
      reason?: string;
    }) => {
      return apiRequest("POST", `/api/direct-connect/assignments/${payload.id}/respond`, {
        decision: payload.decision,
        reason: payload.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/inbox"] });
    },
  });

  const handleRespond = async (
    assignmentId: string,
    decision: "accept" | "decline",
    reason?: string
  ) => {
    await respondMutation.mutateAsync({ id: assignmentId, decision, reason });
  };

  if (!isAuthenticated || !user) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-6 md:p-8 text-center text-sm text-[color:var(--text-secondary)]">
          Sign in as a provider to view Direct Connect opportunities.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="h-4 w-52 rounded bg-[color:var(--surface-intermediate)]" />
          <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
          <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
        </CardContent>
      </Card>
    );
  }

  const items = data || [];
  const normalizeInboxStatus = (status: string | null | undefined) => {
    const value = String(status || "suggested").toLowerCase();
    return value === "invited" ? "suggested" : value;
  };
  const filteredItems = items.filter((i) =>
    inboxFilter === "all" ? true : normalizeInboxStatus(i.assignment.status) === inboxFilter
  );

  if (!items.length) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-6 md:p-8 text-center text-sm text-[color:var(--text-secondary)]">
          No opportunities yet.
        </CardContent>
      </Card>
    );
  }

  const currentWhyJobSnapshot = items.find((i) => i.assignment.id === whyJobAssignmentId)
    ?.assignment.scoreSnapshot;
  const currentAcceptedForInvoice = items.find((i) => i.assignment.id === creatingInvoice);

  const getSlaCopy = (snapshot?: DirectConnectInboxItem["assignment"]["scoreSnapshot"] | null) => {
    if (!snapshot) return "Reply fast to stay prioritized.";
    if (typeof snapshot.responseRate === "number") {
      if (snapshot.responseRate >= 0.8) return "Most providers respond within about 30 minutes.";
      if (snapshot.responseRate >= 0.5) return "Most providers respond within a few hours.";
      return "Response windows are longer right now; fast replies still help.";
    }
    return "Reply fast to stay prioritized.";
  };

  return (
    <div className="space-y-3">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          {(["all", "suggested", "accepted", "declined"] as const).map((f) => {
            const count =
              f === "all"
                ? items.length
                : items.filter((i) => normalizeInboxStatus(i.assignment.status) === f).length;
            const active = inboxFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setInboxFilter(f)}
                className="rounded-full border px-3 py-1 text-xs"
                style={{
                  borderColor: active ? "var(--theme-accent-primary)" : "var(--border-subtle)",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  backgroundColor: active
                    ? "color-mix(in oklab, var(--theme-accent-primary) 10%, transparent)"
                    : "var(--surface-intermediate)",
                }}
              >
                {f[0].toUpperCase() + f.slice(1)} ({count})
              </button>
            );
          })}
        </CardContent>
      </Card>

      {filteredItems.map((item) => {
        const { assignment, request } = item;
        const assignmentStatusRaw = String(assignment.status || "suggested").toLowerCase();
        const canRespond = assignmentStatusRaw === "suggested" || assignmentStatusRaw === "invited";
        const status = assignmentStatusRaw;
        const snapshot = assignment.scoreSnapshot || undefined;
        const createdAt = assignment.createdAt || request?.createdAt;
        const reasons = snapshot?.reasons || [];
        const primaryReasons = reasons.slice(0, 2);

        return (
          <Card
            key={assignment.id}
            className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
          >
            <CardContent className="space-y-3 p-3 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                    {request?.title || "Direct Connect opportunity"}
                  </h3>
                  <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)] md:line-clamp-2">
                    {request?.description ||
                      "A homeowner sent this opportunity through Direct Connect."}
                  </p>
                  <p className="hidden text-[11px] text-[color:var(--text-secondary)] md:block">
                    {getSlaCopy(snapshot)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("uppercase text-[10px]", statusTone(status))}
                >
                  {status.replace("_", " ")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
                {request?.tradeId && <Badge variant="outline">Trade: {request.tradeId}</Badge>}
                {request?.countyFips && (
                  <Badge variant="outline">County: {request.countyFips}</Badge>
                )}
                <Badge variant="outline" className="hidden md:inline-flex">
                  Protected contact flow
                </Badge>
                {typeof snapshot?.score === "number" && (
                  <Badge variant="outline">Score: {Math.round(snapshot.score)}</Badge>
                )}
                {typeof snapshot?.distanceMiles === "number" && (
                  <Badge variant="outline">{snapshot.distanceMiles.toFixed(1)} mi away</Badge>
                )}
                {createdAt && (
                  <span>
                    Routed {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                  </span>
                )}
              </div>

              {reasons.length > 0 && (
                <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] p-3 text-xs text-[color:var(--text-secondary)]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium text-[color:var(--text-primary)]">
                      Why this came to you
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => setWhyJobAssignmentId(assignment.id)}
                    >
                      Full details
                    </Button>
                  </div>
                  <p>{primaryReasons.join(" • ")}</p>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={status !== "accepted"}
                  onClick={() => {
                    const threadId = item.conversationThreadId;
                    window.location.href = threadId
                      ? `/messages?thread=${encodeURIComponent(String(threadId))}`
                      : "/messages";
                  }}
                >
                  Open thread
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={status !== "accepted" || !!creatingInvoice}
                  onClick={() => status === "accepted" && setCreatingInvoice(assignment.id)}
                >
                  Create invoice
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={!canRespond || respondMutation.isPending}
                  onClick={() => handleRespond(assignment.id, "accept")}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                  disabled={!canRespond || respondMutation.isPending}
                  onClick={() => setDeclineAssignmentId(assignment.id)}
                >
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!filteredItems.length && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="p-4 md:p-6 text-center text-sm text-[color:var(--text-secondary)]">
            No items in this filter.
          </CardContent>
        </Card>
      )}

      <WhyThisJobModal
        open={!!whyJobAssignmentId}
        onOpenChange={(open) => !open && setWhyJobAssignmentId(null)}
        snapshot={currentWhyJobSnapshot}
      />

      <Sheet
        open={!!creatingInvoice && !!currentAcceptedForInvoice}
        onOpenChange={(open) => !open && setCreatingInvoice(null)}
      >
        <SheetContent
          side="bottom"
          className="w-full max-w-full border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
        >
          <SheetHeader className="mb-2 text-left">
            <SheetTitle className="text-sm">Create invoice for this Direct Connect job</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 text-xs text-[color:var(--text-secondary)]">
            <p>
              This opens Finances so you can create an invoice for this engagement and record
              payment if needed.
            </p>
            {currentAcceptedForInvoice?.request?.title && (
              <p>
                <span className="font-semibold text-[color:var(--text-primary)]">
                  Suggested title:
                </span>{" "}
                {currentAcceptedForInvoice.request.title}
              </p>
            )}
            <div className="flex items-center justify-between pt-2">
              <Button size="sm" variant="ghost" onClick={() => setCreatingInvoice(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-orange-500 text-white hover:bg-orange-600"
                onClick={() => {
                  const title = currentAcceptedForInvoice?.request?.title || "Direct Connect job";
                  const clientName =
                    (currentAcceptedForInvoice?.request as any)?.homeownerName || "";
                  const params = new URLSearchParams();
                  if (title) params.set("project", title);
                  if (clientName) params.set("client", clientName);
                  window.location.href =
                    "/finances/invoices" + (params.toString() ? `?${params.toString()}` : "");
                }}
              >
                Open Finances
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!declineAssignmentId}
        onOpenChange={(open) => !open && setDeclineAssignmentId(null)}
      >
        <SheetContent
          side="bottom"
          className="w-full max-w-full border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
        >
          <SheetHeader className="mb-2 text-left">
            <SheetTitle className="text-sm">Why are you declining this opportunity?</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 text-sm text-[color:var(--text-secondary)]">
            <p className="text-xs">
              Your answer is private and used only to improve future matching. Homeowners will not
              see this.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["Too far", "Not my specialty", "Unavailable", "Budget mismatch"].map((label) => (
                <Button
                  key={label}
                  size="sm"
                  variant="outline"
                  disabled={!declineAssignmentId || respondMutation.isPending}
                  onClick={async () => {
                    if (!declineAssignmentId) return;
                    await handleRespond(declineAssignmentId, "decline", label);
                    setDeclineAssignmentId(null);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3">
              <Button size="sm" variant="ghost" onClick={() => setDeclineAssignmentId(null)}>
                Keep for now
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                disabled={!declineAssignmentId || respondMutation.isPending}
                onClick={async () => {
                  if (!declineAssignmentId) return;
                  await handleRespond(declineAssignmentId, "decline", "Unavailable");
                  setDeclineAssignmentId(null);
                }}
              >
                Decline without reason
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MyDirectConnectRequests() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [requestFilter, setRequestFilter] = useState<"all" | "active" | "cancelled" | "accepted">(
    "all"
  );

  const { data, isLoading } = useQuery<DirectConnectRequest[]>({
    queryKey: ["/api/direct-connect/requests", "my"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/requests");
      if (!res.ok) throw new Error("Failed to load Direct Connect requests");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const expandMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/route?expand=true`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests", "my"] });
      const assignments = Array.isArray(data?.assignments) ? data.assignments : [];
      if (assignments.length > 0) {
        toast({
          title: "Reach expanded",
          description: `Sent to ${assignments.length} additional provider${assignments.length === 1 ? "" : "s"}.`,
        });
      } else {
        toast({
          title: "No additional providers found",
          description: "Try adjusting your request details and expanding again.",
        });
      }
    },
  });

  const routeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/route`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests", "my"] });
      const assignments = Array.isArray(data?.assignments) ? data.assignments : [];
      const routed = data?.routed === true;

      if (routed && assignments.length > 0) {
        toast({
          title: "Request sent",
          description: `Sent to ${assignments.length} local provider${assignments.length === 1 ? "" : "s"}.`,
        });
        return;
      }

      if (!routed && assignments.length > 0) {
        toast({
          title: "Already sent",
          description: "This request was already sent to providers.",
        });
        return;
      }

      toast({
        title: "No local provider match yet",
        description: "Try adding clearer trade/category details, then send again.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't send request",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests", "my"] });
      toast({
        title: "Request cancelled",
        description: "This request is now closed and no longer active.",
      });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/reopen`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests", "my"] });
      toast({
        title: "Request reopened",
        description: "You can now send this request to providers again.",
      });
    },
  });

  const fetchShareUrl = async (requestId: string): Promise<string> => {
    const response = await fetch(
      `/api/direct-connect/requests/${encodeURIComponent(requestId)}/share`,
      {
        credentials: "include",
      }
    );
    if (!response.ok) {
      let message = "Unable to create share link";
      try {
        const body = await response.json();
        if (body?.message) message = body.message;
      } catch {
        // no-op
      }
      throw new Error(message);
    }
    const payload = await response.json();
    const url = String(payload?.shareUrl || "");
    if (!url) throw new Error("Share URL unavailable");
    return url;
  };

  const shareRequest = async (
    requestId: string,
    requestTitle: string,
    channel: "native" | "facebook" | "messenger" | "sms"
  ) => {
    try {
      const url = await fetchShareUrl(requestId);
      const text =
        "Shared TradeScout request preview. Contact and claim are locked until join + verification.";

      if (channel === "native") {
        await share({
          url,
          title: requestTitle,
          text,
          contextLabel: "Request link",
          suppressRef: true,
        });
        return;
      }

      if (channel === "facebook") {
        await shareToPlatform({
          platform: "facebook",
          url,
          title: requestTitle,
          text,
          suppressRef: true,
        });
        return;
      }

      if (channel === "sms") {
        if (typeof window !== "undefined") {
          const body = encodeURIComponent(`${requestTitle}\n${text}\n${url}`);
          window.location.href = `sms:?&body=${body}`;
        }
        return;
      }

      // messenger
      if (typeof window !== "undefined") {
        const encodedUrl = encodeURIComponent(url);
        const fbFallback = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        const ua = (window.navigator?.userAgent || "").toLowerCase();
        const isMobile = /android|iphone|ipad|ipod/.test(ua);
        if (isMobile) {
          window.location.href = `fb-messenger://share/?link=${encodedUrl}`;
          window.setTimeout(() => {
            window.open(fbFallback, "_blank", "noopener,noreferrer");
          }, 700);
        } else {
          window.open(fbFallback, "_blank", "noopener,noreferrer");
        }
      }
    } catch (err: any) {
      toast({
        title: "Share failed",
        description: err?.message || "Could not create share link right now.",
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-6 md:p-8 text-center text-sm text-[color:var(--text-secondary)]">
          Sign in to see your Direct Connect requests.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="h-4 w-56 rounded bg-[color:var(--surface-intermediate)]" />
          <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
          <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
        </CardContent>
      </Card>
    );
  }

  const requests = data || [];
  const filteredRequests = requests.filter((r) => {
    const status = String(r.status || "").toLowerCase();
    if (requestFilter === "all") return true;
    if (requestFilter === "cancelled") return status === "cancelled";
    if (requestFilter === "accepted") return Boolean(r.dcAcceptedAssignmentId);
    return status !== "cancelled";
  });

  if (!requests.length) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-6 md:p-8 text-center text-sm text-[color:var(--text-secondary)]">
          No requests yet. Use Post Request to start.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          {(["all", "active", "accepted", "cancelled"] as const).map((f) => {
            const count = requests.filter((r) => {
              const status = String(r.status || "").toLowerCase();
              if (f === "all") return true;
              if (f === "cancelled") return status === "cancelled";
              if (f === "accepted") return Boolean(r.dcAcceptedAssignmentId);
              return status !== "cancelled";
            }).length;
            const active = requestFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setRequestFilter(f)}
                className="rounded-full border px-3 py-1 text-xs"
                style={{
                  borderColor: active ? "var(--theme-accent-primary)" : "var(--border-subtle)",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  backgroundColor: active
                    ? "color-mix(in oklab, var(--theme-accent-primary) 10%, transparent)"
                    : "var(--surface-intermediate)",
                }}
              >
                {f[0].toUpperCase() + f.slice(1)} ({count})
              </button>
            );
          })}
        </CardContent>
      </Card>

      {filteredRequests.map((r) => {
        const status = r.status || "open";
        const suggested = r.dcSuggestedCount ?? 0;
        const hasAccepted = Boolean(r.dcAcceptedAssignmentId);
        const lastEventAt = r.dcLastEventAt || r.createdAt || null;
        const canSend = status === "open" && Boolean(r.tradeId) && Boolean(r.countyFips);

        return (
          <Card
            key={r.id}
            className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
          >
            <CardContent className="space-y-3 p-3 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                    {r.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-xs text-[color:var(--text-secondary)] md:line-clamp-2">
                    {r.description}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("uppercase text-[10px]", statusTone(status))}
                >
                  {status.replace("_", " ")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
                <span>
                  {suggested > 0
                    ? `Sent to ${suggested} provider${suggested === 1 ? "" : "s"}`
                    : status === "open"
                      ? "Not sent yet"
                      : "No providers suggested"}
                </span>
                {status === "open" && !canSend && <span>Add a county and trade to send.</span>}
                {status === "open" && suggested === 0 && (
                  <WhyLink to={getHelpLink("directConnect")} />
                )}
                <Badge variant="outline" className="hidden sm:inline-flex">
                  Protected contact flow
                </Badge>
                {hasAccepted && <Badge variant="outline">Accepted by a provider</Badge>}
                {lastEventAt && (
                  <span>
                    Updated {formatDistanceToNow(new Date(lastEventAt), { addSuffix: true })}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <div className="flex w-full gap-2 sm:hidden">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => shareRequest(r.id, r.title, "messenger")}
                  >
                    <MessageCircle className="mr-1 h-3.5 w-3.5" />
                    Messenger
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => shareRequest(r.id, r.title, "sms")}
                  >
                    <Smartphone className="mr-1 h-3.5 w-3.5" />
                    SMS
                  </Button>
                </div>
                <div className="flex w-full gap-2 sm:hidden">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const threadId = r.dcConversationThreadId;
                      window.location.href = threadId
                        ? `/messages?thread=${encodeURIComponent(String(threadId))}`
                        : "/messages";
                    }}
                    disabled={!hasAccepted}
                  >
                    Messages
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
                    disabled={!canSend || routeMutation.isPending}
                    onClick={() => routeMutation.mutate(r.id)}
                  >
                    Send
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => shareRequest(r.id, r.title, "native")}
                >
                  <Share2 className="mr-1 h-3.5 w-3.5" />
                  Share
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  onClick={() => shareRequest(r.id, r.title, "facebook")}
                >
                  Facebook
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  onClick={() => shareRequest(r.id, r.title, "messenger")}
                >
                  Messenger
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  onClick={() => shareRequest(r.id, r.title, "sms")}
                >
                  SMS
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  onClick={() => {
                    const threadId = r.dcConversationThreadId;
                    window.location.href = threadId
                      ? `/messages?thread=${encodeURIComponent(String(threadId))}`
                      : "/messages";
                  }}
                  disabled={!hasAccepted}
                >
                  Open conversation
                </Button>
                {!hasAccepted && <WhyLink to={getHelpLink("messaging")} />}
                <Button
                  size="sm"
                  className="hidden bg-orange-500 text-white hover:bg-orange-600 sm:inline-flex"
                  disabled={!canSend || routeMutation.isPending}
                  onClick={() => routeMutation.mutate(r.id)}
                >
                  Send request
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden border-orange-500/60 text-orange-200 hover:bg-orange-500/10 sm:inline-flex"
                  disabled={status !== "routed" || expandMutation.isPending}
                  onClick={() => expandMutation.mutate(r.id)}
                >
                  Expand reach
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden border-rose-500/60 text-rose-200 hover:bg-rose-500/10 sm:inline-flex"
                  disabled={
                    (status !== "in_progress" && status !== "routed") || cancelMutation.isPending
                  }
                  onClick={() => cancelMutation.mutate(r.id)}
                >
                  Cancel request
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10 sm:inline-flex"
                  disabled={status !== "cancelled" || reopenMutation.isPending}
                  onClick={() => reopenMutation.mutate(r.id)}
                >
                  Reopen request
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!filteredRequests.length && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="p-4 md:p-6 text-center text-sm text-[color:var(--text-secondary)]">
            No requests in this filter.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DirectConnectShell() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const activeSection = useMemo<Section>(() => getSectionFromPath(location), [location]);

  const defaultCountyFips = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    return params.get("county") || undefined;
  }, [location]);

  const navigateSection = (section: Section) => {
    setLocation(buildHref(section));
  };

  const { data: inboxData } = useQuery<DirectConnectInboxItem[]>({
    queryKey: ["/api/direct-connect/inbox", "count"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/inbox");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: requestsData } = useQuery<DirectConnectRequest[]>({
    queryKey: ["/api/direct-connect/requests", "count"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/requests");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const navCounts = useMemo(
    () => ({
      inbox: (inboxData || []).filter((i) => i.assignment.status === "suggested").length,
      engagements: (requestsData || []).filter((r) => r.status !== "cancelled").length,
    }),
    [inboxData, requestsData]
  );

  const sectionMeta = SECTION_META[activeSection];

  let centerContent: ReactNode = null;
  switch (activeSection) {
    case "post":
      centerContent = <TasksHub defaultCountyFips={defaultCountyFips} embedded defaultTab="post" />;
      break;
    case "board":
      centerContent = (
        <TasksHub defaultCountyFips={defaultCountyFips} embedded defaultTab="browse" />
      );
      break;
    case "inbox":
      centerContent = <DirectConnectInbox />;
      break;
    case "pros":
      centerContent = <DirectConnectPros />;
      break;
    case "engagements":
      centerContent = <MyDirectConnectRequests />;
      break;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-7xl space-y-3 px-2.5 py-3 sm:px-3 sm:py-4 md:px-6 md:py-6">
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h1 className="text-xl font-semibold text-[color:var(--text-primary)] md:text-3xl">
                  Direct Connect
                </h1>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2">
                  <div className="text-[color:var(--text-secondary)]">Pending in inbox</div>
                  <div className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
                    {navCounts.inbox || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2">
                  <div className="text-[color:var(--text-secondary)]">Active requests</div>
                  <div className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
                    {navCounts.engagements || 0}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="xl:hidden">
          <SectionNav
            activeSection={activeSection}
            onSelect={navigateSection}
            counts={navCounts}
            mobile
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
          <Card className="hidden h-fit border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] xl:block">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Navigation</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <SectionNav
                activeSection={activeSection}
                onSelect={navigateSection}
                counts={navCounts}
              />
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
                    {sectionMeta.title}
                  </h2>
                </div>
                {sectionMeta.actionTarget !== activeSection && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigateSection(sectionMeta.actionTarget)}
                  >
                    {sectionMeta.actionLabel}
                  </Button>
                )}
              </CardContent>
            </Card>
            {centerContent}
          </div>
        </div>
      </div>
    </div>
  );
}
