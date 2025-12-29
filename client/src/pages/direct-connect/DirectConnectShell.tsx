import { ReactNode, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import TasksHub from "../tasks";
import WorkerMarketplacePage from "../worker-marketplace";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WhyThisJobModal } from "./WhyThisJobModal";

const SECTIONS = ["post", "board", "inbox", "pros", "engagements"] as const;

type Section = (typeof SECTIONS)[number];

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
};

type DirectConnectRequest = {
  id: string;
  title: string;
  description: string;
  status: string;
  budgetMin?: string | null;
  budgetMax?: string | null;
  createdAt?: string | null;
  dcSuggestedCount?: number | null;
  dcAcceptedAssignmentId?: string | null;
  dcLastEventAt?: string | null;
};

function DirectConnectInbox() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

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
    mutationFn: async (payload: { id: string; decision: "accept" | "decline"; reason?: string }) => {
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
    reason?: string,
  ) => {
    await respondMutation.mutateAsync({ id: assignmentId, decision, reason });
  };

  const [whyJobAssignmentId, setWhyJobAssignmentId] = useState<string | null>(null);
  const [declineAssignmentId, setDeclineAssignmentId] = useState<string | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);

  if (!isAuthenticated || !user) {
    return (
      <Card className="bg-navy-800 border-navy-700">
        <CardContent className="p-8 text-center text-sm text-gray-300">
          Sign in with a contractor profile to see Direct Connect opportunities routed to you.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-navy-800 border-navy-700">
        <CardContent className="p-6 space-y-3">
          <div className="h-4 w-40 bg-navy-700 rounded" />
          <div className="h-20 bg-navy-700 rounded" />
          <div className="h-20 bg-navy-700 rounded" />
        </CardContent>
      </Card>
    );
  }

  const items = data || [];

  if (!items.length) {
    return (
      <Card className="bg-navy-800 border-navy-700">
        <CardContent className="p-8 text-center text-sm text-gray-300">
          When homeowners route Direct Connect requests to you, they will appear here as opportunities you can accept or decline.
        </CardContent>
      </Card>
    );
  }

  const currentWhyJobSnapshot = items.find((i) => i.assignment.id === whyJobAssignmentId)?.assignment.scoreSnapshot;

  const currentAcceptedForInvoice = items.find((i) => i.assignment.id === creatingInvoice);

  const getSlaCopy = (snapshot?: DirectConnectInboxItem["assignment"]["scoreSnapshot"] | null) => {
    if (!snapshot) return "Fast response recommended for higher selection chances.";
    if (typeof snapshot.responseRate === "number") {
      if (snapshot.responseRate >= 0.8) return "Most providers respond within about 30 minutes.";
      if (snapshot.responseRate >= 0.5) return "Most providers respond within a few hours.";
      return "Responses may take a bit longer; fast replies can help you stand out.";
    }
    return "Fast response recommended for higher selection chances.";
  };

  return (
    <div className="space-y-4">
      <Card className="bg-navy-800 border-navy-700">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-semibold text-white">Direct Connect inbox</h2>
          <p className="text-xs text-gray-300 max-w-xl">
            These are opportunities routed to you via Direct Connect. Accept to start a shared message thread; decline to pass.
          </p>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {items.map((item) => {
          const { assignment, request } = item;
          const status = assignment.status || "suggested";
          const snapshot = assignment.scoreSnapshot || undefined;
          const createdAt = assignment.createdAt || request?.createdAt;

          const reasons = snapshot?.reasons || [];
          const recCount = snapshot?.recommendationCount || 0;

          const primaryReasons = reasons.slice(0, 2);
          const slaCopy = getSlaCopy(snapshot);

          return (
            <Card key={assignment.id} className="bg-navy-800 border-navy-700">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {request?.title || "Direct Connect request"}
                    </h3>
                    <p className="mt-1 text-xs text-gray-300 line-clamp-2">
                      {request?.description || "A homeowner has routed this opportunity to you via Direct Connect."}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400">{slaCopy}</p>
                  </div>
                  <Badge
                    variant={status === "accepted" ? "default" : status === "declined" ? "outline" : "secondary"}
                    className={cn(
                      "text-[10px] uppercase tracking-wide px-2 py-0.5",
                      status === "accepted" && "bg-green-500 text-white border-transparent",
                      status === "declined" && "border-red-500 text-red-200",
                    )}
                  >
                    {status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
                  {request?.tradeId && (
                    <Badge variant="outline" className="border-navy-500 text-gray-200">
                      Trade: {request.tradeId}
                    </Badge>
                  )}
                  {request?.countyFips && (
                    <Badge variant="outline" className="border-navy-500 text-gray-200">
                      County FIPS: {request.countyFips}
                    </Badge>
                  )}
                  {typeof snapshot?.score === "number" && (
                    <Badge variant="outline" className="border-navy-500 text-gray-200">
                      Match score: {Math.round(snapshot.score)}
                    </Badge>
                  )}
                  {recCount > 0 && (
                    <Badge variant="outline" className="border-navy-500 text-gray-200">
                      {recCount} neighbor recommendations
                    </Badge>
                  )}
                  {createdAt && (
                    <span className="text-[11px] text-gray-400">
                      Routed {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                    </span>
                  )}
                </div>

                {reasons.length > 0 && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-gray-300">
                    <div className="truncate">
                      <span className="font-medium">Why this job:</span>{" "}
                      {primaryReasons.join(" · ")}
                      {reasons.length > primaryReasons.length && "  b7 more"}
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      className="border-navy-600 text-gray-200 hover:bg-navy-700 flex-shrink-0"
                      onClick={() => setWhyJobAssignmentId(assignment.id)}
                    >
                      Why this job?
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-end pt-1">
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-gray-500 text-gray-100 hover:bg-gray-800"
                    onClick={() => {
                      window.location.href = "/messages";
                    }}
                    disabled={status !== "accepted"}
                  >
                    Open thread
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-gray-500 text-gray-100 hover:bg-gray-800"
                    disabled={status !== "accepted" || !!creatingInvoice}
                    onClick={() => {
                      if (status === "accepted") {
                        setCreatingInvoice(assignment.id);
                      }
                    }}
                  >
                    Create invoice
                  </Button>
                  <Button
                    size="xs"
                    className="bg-green-500 hover:bg-green-600 text-white"
                    disabled={status !== "suggested" || respondMutation.isPending}
                    onClick={() => handleRespond(assignment.id, "accept")}
                  >
                    Accept
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-red-500 text-red-200 hover:bg-red-500/10"
                    disabled={status !== "suggested" || respondMutation.isPending}
                    onClick={() => setDeclineAssignmentId(assignment.id)}
                  >
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <WhyThisJobModal
        open={!!whyJobAssignmentId}
        onOpenChange={(open) => {
          if (!open) setWhyJobAssignmentId(null);
        }}
        snapshot={currentWhyJobSnapshot}
      />

      <Sheet
        open={!!creatingInvoice && !!currentAcceptedForInvoice}
        onOpenChange={(open) => {
          if (!open) setCreatingInvoice(null);
        }}
      >
        <SheetContent side="bottom" className="bg-navy-900 border-navy-700 max-w-full w-full">
          <SheetHeader className="text-left mb-2">
            <SheetTitle className="text-sm text-white">Create invoice for this Direct Connect job</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 text-xs text-gray-200">
            <p>
              This will open your Finances workspace so you can create an invoice for this engagement and optionally
              record payment.
            </p>
            {currentAcceptedForInvoice?.request?.title && (
              <p>
                <span className="font-semibold">Suggested project title:</span> {currentAcceptedForInvoice.request.title}
              </p>
            )}
            <div className="flex justify-between items-center pt-2">
              <Button
                size="xs"
                variant="ghost"
                className="text-gray-300 hover:bg-transparent hover:text-white"
                onClick={() => setCreatingInvoice(null)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => {
                  const title =
                    currentAcceptedForInvoice?.request?.title || "Direct Connect job";
                  const clientName =
                    (currentAcceptedForInvoice?.request as any)?.homeownerName || "";
                  const params = new URLSearchParams();
                  if (title) params.set("project", title);
                  if (clientName) params.set("client", clientName);
                  window.location.href =
                    "/finances/invoices" + (params.toString() ? `?${params.toString()}` : "");
                }}
              >
                Open Finances to create invoice
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!declineAssignmentId} onOpenChange={(open) => !open && setDeclineAssignmentId(null)}>
        <SheetContent side="bottom" className="bg-navy-900 border-navy-700 max-w-full w-full">
          <SheetHeader className="text-left mb-2">
            <SheetTitle className="text-sm text-white">Why are you declining this opportunity?</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 text-sm text-gray-200">
            <p className="text-xs text-gray-400">
              Your answer is private and only used to improve future matches. Homeowners wont see this.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                "Too far",
                "Not my specialty",
                "Unavailable",
                "Budget mismatch",
              ].map((label) => (
                <Button
                  key={label}
                  size="xs"
                  variant="outline"
                  className="border-navy-600 text-gray-100 hover:bg-navy-700"
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
            <div className="pt-3 flex justify-between items-center">
              <Button
                size="xs"
                variant="ghost"
                className="text-gray-300 hover:bg-transparent hover:text-white"
                onClick={() => setDeclineAssignmentId(null)}
              >
                Keep for now
              </Button>
              <Button
                size="xs"
                variant="outline"
                className="border-red-500 text-red-200 hover:bg-red-500/10"
                disabled={!declineAssignmentId || respondMutation.isPending}
                onClick={async () => {
                  if (!declineAssignmentId) return;
                  await handleRespond(declineAssignmentId, "decline", "Unavailable");
                  setDeclineAssignmentId(null);
                }}
              >
                Decline without a reason
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
  });

  if (!isAuthenticated) {
    return (
      <Card className="bg-navy-800 border-navy-700">
        <CardContent className="p-8 text-center text-sm text-gray-300">
          Sign in to see your Direct Connect requests and their progress.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-navy-800 border-navy-700">
        <CardContent className="p-6 space-y-3">
          <div className="h-4 w-48 bg-navy-700 rounded" />
          <div className="h-20 bg-navy-700 rounded" />
          <div className="h-20 bg-navy-700 rounded" />
        </CardContent>
      </Card>
    );
  }

  const requests = data || [];

  if (!requests.length) {
    return (
      <Card className="bg-navy-800 border-navy-700">
        <CardContent className="p-8 text-center text-sm text-gray-300">
          When you start Direct Connect requests, you’ll see their routing and acceptance status here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-navy-800 border-navy-700">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-semibold text-white">My Direct Connect requests</h2>
          <p className="text-xs text-gray-300 max-w-xl">
            Track which requests have been routed, how many providers were suggested, and when someone accepts.
          </p>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {requests.map((r) => {
          const status = r.status || "open";
          const suggested = r.dcSuggestedCount ?? 0;
          const hasAccepted = Boolean(r.dcAcceptedAssignmentId);
          const lastEventAt = r.dcLastEventAt || r.createdAt || null;

          return (
            <Card key={r.id} className="bg-navy-800 border-navy-700">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{r.title}</h3>
                    <p className="mt-1 text-xs text-gray-300 line-clamp-2">{r.description}</p>
                  </div>
                  <Badge
                    variant={status === "in_progress" ? "default" : status === "routed" ? "secondary" : "outline"}
                    className={cn(
                      "text-[10px] uppercase tracking-wide px-2 py-0.5",
                      status === "in_progress" && "bg-green-500 text-white border-transparent",
                      status === "routed" && "bg-orange-500/20 text-orange-300 border-orange-500/40",
                    )}
                  >
                    {status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
                  <span>
                    {suggested > 0
                      ? `Routed to ${suggested} provider${suggested === 1 ? "" : "s"}`
                      : status === "open"
                        ? "Not routed yet"
                        : "No providers suggested yet"}
                  </span>
                  {hasAccepted && (
                    <Badge variant="outline" className="border-green-500 text-green-200">
                      Accepted by a provider
                    </Badge>
                  )}
                  {lastEventAt && (
                    <span className="text-[11px] text-gray-400">
                      Updated {formatDistanceToNow(new Date(lastEventAt), { addSuffix: true })}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 justify-end pt-1">
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-gray-500 text-gray-100 hover:bg-gray-800"
                    onClick={() => {
                      window.location.href = "/messages";
                    }}
                    disabled={!hasAccepted}
                  >
                    Open conversation
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-orange-500 text-orange-200 hover:bg-orange-500/10"
                    disabled={status !== "routed" || expandMutation.isPending}
                    onClick={() => expandMutation.mutate(r.id)}
                  >
                    Expand reach
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function DirectConnectShell() {
  const [location, setLocation] = useLocation();

  const activeSection = useMemo<Section>(() => getSectionFromPath(location), [location]);

  const navigateSection = (section: Section) => {
    setLocation(buildHref(section));
  };

  let centerContent: ReactNode = null;
  switch (activeSection) {
    case "post":
      centerContent = <TasksHub />;
      break;
    case "board":
      centerContent = <TasksHub />;
      break;
    case "inbox":
      centerContent = <DirectConnectInbox />;
      break;
    case "pros":
      centerContent = <WorkerMarketplacePage />;
      break;
    case "engagements":
      centerContent = <MyDirectConnectRequests />;
      break;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      <div className="max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8 pb-20 flex gap-6">
        {/* Left rail: Direct Connect nav */}
        <div className="w-56 shrink-0 hidden md:block">
          <div className="sticky top-20 space-y-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Direct Connect
            </h2>
            {SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => navigateSection(section)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  activeSection === section
                    ? "bg-orange-500/15 text-orange-400"
                    : "text-gray-300 hover:text-white hover:bg-navy-700/80",
                )}
              >
                <span className="capitalize">
                  {section === "post" && "Post"}
                  {section === "board" && "Board"}
                  {section === "inbox" && "Inbox"}
                  {section === "pros" && "Pros"}
                  {section === "engagements" && "My requests"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Center + right: list/detail + thread */}
        <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            {centerContent}
          </div>

          {/* Right panel: thread + actions (to be wired later) */}
          <aside className="w-full lg:w-80 shrink-0 bg-navy-900/60 border border-navy-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-2">Conversation & actions</h2>
            <p className="text-xs text-gray-300">
              When you engage with a provider, the shared message thread and quote/commit/invoice actions will appear here.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
