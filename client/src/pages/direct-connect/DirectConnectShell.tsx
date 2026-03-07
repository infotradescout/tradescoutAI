import { ReactNode, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import TasksHub from "../tasks";
import DirectConnectPros from "./DirectConnectPros";
import { EmploymentBoard } from "./EmploymentBoard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  MoreHorizontal,
  ChevronRight,
  Zap,
  TrendingUp,
} from "lucide-react";

const SECTIONS = ["post", "board", "employment", "inbox", "pros", "engagements"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABELS: Record<Section, string> = {
  post: "Start Connection",
  board: "Odd Jobs",
  employment: "Employment",
  inbox: "Inbox",
  pros: "Pros",
  engagements: "My Connections",
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
    title: "Start a connection",
    description: "Pick the type, then submit a clear request.",
    actionLabel: "Go to My Connections",
    actionTarget: "engagements",
  },
  board: {
    title: "Odd jobs",
    description: "Browse open local requests (projects, repairs, quick help).",
    actionLabel: "Open Inbox",
    actionTarget: "inbox",
  },
  employment: {
    title: "Employment",
    description: "Jobs + resumes. Contact stays intent-gated through Scout.",
    actionLabel: "Post Odd Job",
    actionTarget: "post",
  },
  inbox: {
    title: "Inbox",
    description: "Review request updates and opportunities.",
    actionLabel: "View My Connections",
    actionTarget: "engagements",
  },
  pros: {
    title: "Pro directory",
    description: "Browse local pros and start a request.",
    actionLabel: "Start Connection",
    actionTarget: "post",
  },
  engagements: {
    title: "My connections",
    description: "Track status and next steps.",
    actionLabel: "Open Inbox",
    actionTarget: "inbox",
  },
};

const SECTION_ICONS: Record<Section, ReactNode> = {
  post: <ClipboardPlus className="h-5 w-5" />,
  board: <LayoutList className="h-5 w-5" />,
  employment: <BriefcaseBusiness className="h-5 w-5" />,
  inbox: <Inbox className="h-5 w-5" />,
  pros: <Users className="h-5 w-5" />,
  engagements: <BriefcaseBusiness className="h-5 w-5" />,
};

const SECTION_GROUPS: Array<{ title: string; sections: Section[]; icon?: ReactNode }> = [
  { title: "Post & Browse", sections: ["post", "board"], icon: <Zap className="h-4 w-4" /> },
  {
    title: "Hiring & Employment",
    sections: ["employment"],
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    title: "Your Activity",
    sections: ["engagements", "inbox"],
    icon: <TrendingUp className="h-4 w-4" />,
  },
  { title: "Find Professionals", sections: ["pros"], icon: <Users className="h-4 w-4" /> },
];

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
    return "bg-ts-orange/15 text-white border-ts-orange/40";
  }
  return "bg-white/10 text-white/70 border-white/15";
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

function DirectConnectRequestComposer({ defaultCountyFips }: { defaultCountyFips?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [requestType, setRequestType] = useState<
    | "service_request"
    | "business_request"
    | "customer_support"
    | "employment"
    | "buy_sell"
    | "other"
  >("service_request");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const requestTypeMeta: Record<
    | "service_request"
    | "business_request"
    | "customer_support"
    | "employment"
    | "buy_sell"
    | "other",
    {
      label: string;
      category: string;
      titlePlaceholder: string;
      descriptionPlaceholder: string;
      budgetLabelMin: string;
      budgetLabelMax: string;
      budgetPlaceholderMin: string;
      budgetPlaceholderMax: string;
    }
  > = {
    service_request: {
      label: "Hire provider",
      category: "service_request",
      titlePlaceholder: "Need a provider for...",
      descriptionPlaceholder: "What needs to be done, timeline, and requirements.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "500",
      budgetPlaceholderMax: "2500",
    },
    business_request: {
      label: "Hire business partner",
      category: "business_request",
      titlePlaceholder: "Need another business for...",
      descriptionPlaceholder: "Scope, timing, and business requirements.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "300",
      budgetPlaceholderMax: "5000",
    },
    customer_support: {
      label: "Customer handoff",
      category: "customer_support",
      titlePlaceholder: "Need help for a customer with...",
      descriptionPlaceholder: "Customer need, location context, and urgency.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1500",
    },
    employment: {
      label: "Employment",
      category: "employment",
      titlePlaceholder: "Hiring for role / contract...",
      descriptionPlaceholder: "Role, schedule, skills needed, and start date.",
      budgetLabelMin: "Pay min (optional)",
      budgetLabelMax: "Pay max (optional)",
      budgetPlaceholderMin: "18",
      budgetPlaceholderMax: "35",
    },
    buy_sell: {
      label: "Buy / sell / source",
      category: "buy_sell",
      titlePlaceholder: "Need source for materials...",
      descriptionPlaceholder: "What item/material, quantity, and deadline?",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1500",
    },
    other: {
      label: "Other",
      category: "other",
      titlePlaceholder: "What do you need help with?",
      descriptionPlaceholder: "Add details so Scout can route this correctly.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1000",
    },
  };

  const activeRequestMeta = requestTypeMeta[requestType];

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        category: activeRequestMeta.category,
      };

      if (defaultCountyFips) payload.countyFips = defaultCountyFips;
      const stateCode =
        typeof (user as any)?.stateCode === "string" ? String((user as any).stateCode) : "";
      if (stateCode.trim().length === 2) payload.stateCode = stateCode.trim().toUpperCase();

      const min = Number(budgetMin);
      const max = Number(budgetMax);
      if (Number.isFinite(min) && min > 0) payload.budgetMin = min;
      if (Number.isFinite(max) && max > 0) payload.budgetMax = max;

      return apiRequest("POST", "/api/direct-connect/requests", payload);
    },
    onSuccess: () => {
      toast({
        title: "Connection posted",
        description: "Your request is live in Direct Connect.",
      });
      setTitle("");
      setDescription("");
      setBudgetMin("");
      setBudgetMax("");
      setShowOptional(false);
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests", "count"] });
      navigate("/direct-connect/engagements");
    },
    onError: (error: any) => {
      const isVerificationGate =
        error?.status === 428 ||
        String(error?.code || "").toUpperCase() === "VERIFICATION_REQUIRED";
      if (isVerificationGate) {
        toast({
          title: "Address verification required",
          description:
            error?.message || "Complete verification before posting Direct Connect requests.",
          variant: "destructive",
        });
        navigate("/verification");
        return;
      }

      toast({
        title: "Could not post project",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 10;

  return (
    <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Start connection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-[color:var(--text-secondary)]">Connection type</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {(
              Object.entries(requestTypeMeta) as Array<
                [
                  keyof typeof requestTypeMeta,
                  (typeof requestTypeMeta)[keyof typeof requestTypeMeta],
                ]
              >
            ).map(([key, meta]) => {
              const active = requestType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRequestType(key)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs text-left transition-colors",
                    active
                      ? "border-ts-orange bg-ts-orange/20 text-white"
                      : "border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-[color:var(--text-secondary)]"
                  )}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-[color:var(--text-secondary)]">Title</label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={activeRequestMeta.titlePlaceholder}
            className="bg-[color:var(--surface-intermediate)] border-[color:var(--border-subtle)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-[color:var(--text-secondary)]">Scope</label>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={activeRequestMeta.descriptionPlaceholder}
            rows={3}
            className="bg-[color:var(--surface-intermediate)] border-[color:var(--border-subtle)]"
          />
        </div>
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1 text-xs text-[color:var(--text-secondary)]"
            onClick={() => setShowOptional((current) => !current)}
          >
            {showOptional ? "Hide optional budget" : "Add optional budget"}
          </Button>
          {showOptional && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-[color:var(--text-secondary)]">
                  {activeRequestMeta.budgetLabelMin}
                </label>
                <Input
                  value={budgetMin}
                  onChange={(event) => setBudgetMin(event.target.value)}
                  inputMode="numeric"
                  placeholder={activeRequestMeta.budgetPlaceholderMin}
                  className="bg-[color:var(--surface-intermediate)] border-[color:var(--border-subtle)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[color:var(--text-secondary)]">
                  {activeRequestMeta.budgetLabelMax}
                </label>
                <Input
                  value={budgetMax}
                  onChange={(event) => setBudgetMax(event.target.value)}
                  inputMode="numeric"
                  placeholder={activeRequestMeta.budgetPlaceholderMax}
                  className="bg-[color:var(--surface-intermediate)] border-[color:var(--border-subtle)]"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !canSubmit}
            className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
          >
            {createMutation.isPending ? "Posting..." : "Start connection"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick action card component
function QuickActionCard({
  section,
  label,
  description,
  icon,
  count,
  isActive,
  onClick,
}: {
  section: Section;
  label: string;
  description: string;
  icon: ReactNode;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border p-4 transition-all duration-300",
        "hover:scale-105 hover:shadow-lg",
        isActive
          ? "border-[color:var(--theme-accent-primary)] bg-[color:var(--theme-accent-primary)]/10"
          : "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] hover:border-[color:var(--theme-accent-primary)]/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <div
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border",
                isActive
                  ? "border-[color:var(--theme-accent-primary)] bg-[color:var(--theme-accent-primary)]/20"
                  : "border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
              )}
            >
              {icon}
            </div>
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{label}</h3>
          </div>
          <p className="text-xs text-[color:var(--text-secondary)] line-clamp-1">{description}</p>
        </div>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {count}
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 text-[color:var(--text-secondary)] group-hover:text-[color:var(--theme-accent-primary)] transition-colors" />
      </div>
    </button>
  );
}

// Navigation grid component
function NavigationGrid({
  activeSection,
  onSelect,
  counts,
}: {
  activeSection: Section;
  onSelect: (section: Section) => void;
  counts?: Partial<Record<Section, number>>;
}) {
  return (
    <div className="space-y-4">
      {SECTION_GROUPS.map((group) => (
        <div key={group.title} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            {group.icon && <div className="text-[color:var(--text-secondary)]">{group.icon}</div>}
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-secondary)]">
              {group.title}
            </h3>
          </div>
          <div className="grid gap-2">
            {group.sections.map((section) => {
              const count = counts?.[section] ?? 0;
              return (
                <QuickActionCard
                  key={section}
                  section={section}
                  label={SECTION_LABELS[section]}
                  description={SECTION_META[section].description}
                  icon={SECTION_ICONS[section]}
                  count={count}
                  isActive={section === activeSection}
                  onClick={() => onSelect(section)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DirectConnectInbox() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [whyJobAssignmentId, setWhyJobAssignmentId] = useState<string | null>(null);
  const [declineAssignmentId, setDeclineAssignmentId] = useState<string | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [mobileActionAssignmentId, setMobileActionAssignmentId] = useState<string | null>(null);
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
          Sign in to view your inbox.
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
          No inbox items yet.
        </CardContent>
      </Card>
    );
  }

  const currentWhyJobSnapshot = items.find((i) => i.assignment.id === whyJobAssignmentId)
    ?.assignment.scoreSnapshot;
  const currentAcceptedForInvoice = items.find((i) => i.assignment.id === creatingInvoice);

  return (
    <div className="space-y-3">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="flex gap-1.5 overflow-x-auto p-2">
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
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all"
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
        const isExpanded = expandedAssignmentId === assignment.id;
        const isMobileActionOpen = mobileActionAssignmentId === assignment.id;

        return (
          <Card
            key={assignment.id}
            className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] hover:border-[color:var(--theme-accent-primary)]/50 transition-colors"
          >
            <CardContent className="space-y-3 p-3 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                    {request?.title || "Direct Connect opportunity"}
                  </h3>
                  <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)] md:line-clamp-2">
                    {request?.description || "Connection request."}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("uppercase text-[10px]", statusTone(status))}
                >
                  {status.replace("_", " ")}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--text-secondary)]">
                <span className="truncate">
                  {[
                    request?.status ? `Request ${String(request.status).replace("_", " ")}` : null,
                    request?.tradeId ? `Trade ${request.tradeId}` : null,
                    request?.countyFips,
                  ]
                    .filter(Boolean)
                    .join(" • ") || "Local match"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[11px] md:hidden"
                  onClick={() =>
                    setExpandedAssignmentId((current) =>
                      current === assignment.id ? null : assignment.id
                    )
                  }
                >
                  {isExpanded ? "Less" : "More"}
                </Button>
              </div>

              {isExpanded && (
                <div className="space-y-1 text-[11px] text-[color:var(--text-secondary)] md:hidden">
                  {createdAt && (
                    <div>
                      Routed {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                    </div>
                  )}
                  {typeof snapshot?.score === "number" && (
                    <div>Score {Math.round(snapshot.score)}</div>
                  )}
                  {typeof snapshot?.distanceMiles === "number" && (
                    <div>{snapshot.distanceMiles.toFixed(1)} mi away</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MyDirectConnectRequests() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [mobileActionRequestId, setMobileActionRequestId] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<
    "all" | "open" | "routed" | "in_progress" | "accepted" | "completed" | "cancelled"
  >("all");
  const { toast } = useToast();

  const { data: requestsData, isLoading } = useQuery<DirectConnectRequest[]>({
    queryKey: ["/api/direct-connect/requests"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/requests");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const filteredRequests = useMemo(() => {
    if (!requestsData) return [];
    if (requestFilter === "all") return requestsData.filter((r) => r.status !== "cancelled");
    return requestsData.filter((r) => r.status === requestFilter);
  }, [requestsData, requestFilter]);

  const routeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/route`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request routed successfully" });
    },
  });

  const expandMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/route?expand=true`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Reach expanded" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request cancelled" });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/reopen`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request reopened" });
    },
  });

  if (!isAuthenticated || !user) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-6 md:p-8 text-center text-sm text-[color:var(--text-secondary)]">
          Sign in to view your requests.
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
        </CardContent>
      </Card>
    );
  }

  if (!filteredRequests.length) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-4 md:p-6 text-center text-sm text-[color:var(--text-secondary)]">
          No matches.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="flex gap-1.5 overflow-x-auto p-2">
          {(
            ["all", "open", "routed", "in_progress", "accepted", "completed", "cancelled"] as const
          ).map((f) => {
            const count =
              f === "all"
                ? requestsData?.filter((r) => r.status !== "cancelled").length || 0
                : requestsData?.filter((r) => r.status === f).length || 0;
            const active = requestFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setRequestFilter(f)}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all"
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
        const status = String(r.status || "open").toLowerCase();
        const hasAccepted =
          status === "in_progress" || status === "completed" || Boolean(r.dcConversationThreadId);
        const canSend = status === "open";
        const isMobileActionOpen = mobileActionRequestId === r.id;
        return (
          <Card
            key={r.id}
            className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] hover:border-[color:var(--theme-accent-primary)]/50 transition-colors"
          >
            <CardContent className="space-y-3 p-3 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                    {r.title}
                  </h3>
                  <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)] md:line-clamp-2">
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
                {r.tradeId && <span>Trade: {r.tradeId}</span>}
                {r.countyFips && <span>County: {r.countyFips}</span>}
                {r.dcSuggestedCount && <span>Suggested: {r.dcSuggestedCount}</span>}
              </div>

              <div className="flex flex-wrap gap-1.5 sm:hidden">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() =>
                    setMobileActionRequestId((current) => (current === r.id ? null : r.id))
                  }
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
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
                {!hasAccepted && <WhyLink to={getHelpLink("messaging")} />}
                <Button
                  size="sm"
                  className="h-8 px-2 text-xs bg-ts-orange text-text-black hover:bg-ts-orange/90"
                  disabled={!canSend || routeMutation.isPending}
                  onClick={() => routeMutation.mutate(r.id)}
                >
                  Route
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  disabled={status !== "routed" || expandMutation.isPending}
                  onClick={() => expandMutation.mutate(r.id)}
                >
                  Expand reach
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                  disabled={
                    (status !== "open" && status !== "in_progress" && status !== "routed") ||
                    cancelMutation.isPending
                  }
                  onClick={() => cancelMutation.mutate(r.id)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                  disabled={status !== "cancelled" || reopenMutation.isPending}
                  onClick={() => reopenMutation.mutate(r.id)}
                >
                  Reopen
                </Button>
              </div>

              {isMobileActionOpen && (
                <div className="flex flex-wrap items-center justify-end gap-1.5 sm:hidden">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      const threadId = r.dcConversationThreadId;
                      window.location.href = threadId
                        ? `/messages?thread=${encodeURIComponent(String(threadId))}`
                        : "/messages";
                    }}
                    disabled={!hasAccepted}
                  >
                    <MessageCircle className="mr-1 h-3.5 w-3.5" />
                    Msg
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 px-2 text-xs bg-ts-orange text-text-black hover:bg-ts-orange/90"
                    disabled={!canSend || routeMutation.isPending}
                    onClick={() => routeMutation.mutate(r.id)}
                  >
                    Route
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    disabled={status !== "routed" || expandMutation.isPending}
                    onClick={() => expandMutation.mutate(r.id)}
                  >
                    Expand
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                    disabled={
                      (status !== "open" && status !== "in_progress" && status !== "routed") ||
                      cancelMutation.isPending
                    }
                    onClick={() => cancelMutation.mutate(r.id)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                    disabled={status !== "cancelled" || reopenMutation.isPending}
                    onClick={() => reopenMutation.mutate(r.id)}
                  >
                    Reopen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function DirectConnectShell() {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const activeSection = useMemo<Section>(() => getSectionFromPath(location), [location]);

  const defaultCountyFips = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    return params.get("county") || undefined;
  }, [location]);

  const navigateSection = (section: Section) => {
    navigate(buildHref(section));
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

  const navCounts: Partial<Record<Section, number>> = useMemo(
    () => ({
      inbox: (inboxData || []).filter((i) => i.assignment.status === "suggested").length,
      engagements: (requestsData || []).filter((r) => r.status !== "cancelled").length,
    }),
    [inboxData, requestsData]
  );

  const sectionMeta = SECTION_META[activeSection];
  const isPostComposer = activeSection === "post";
  const showMobileNavAboveContent = true;

  let centerContent: ReactNode = null;
  switch (activeSection) {
    case "post":
      centerContent = <DirectConnectRequestComposer defaultCountyFips={defaultCountyFips} />;
      break;
    case "board":
      centerContent = (
        <TasksHub defaultCountyFips={defaultCountyFips} embedded defaultTab="browse" />
      );
      break;
    case "employment":
      centerContent = <EmploymentBoard defaultCountyFips={defaultCountyFips} />;
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
      <div className="mx-auto w-full max-w-7xl space-y-4 px-2.5 py-3 sm:px-3 sm:py-4 md:px-6 md:py-6">
        {/* Header Section */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[color:var(--text-primary)]">
              Direct Connect
            </h1>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1">
              Start requests, browse opportunities, and manage connections in one place.
            </p>
          </div>

          {/* Status Pills */}
          <div
            className={cn("flex flex-wrap gap-2", activeSection === "post" ? "hidden sm:flex" : "")}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2 text-sm">
              <Inbox className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
              <span className="text-[color:var(--text-secondary)]">Inbox</span>
              <span className="font-semibold text-[color:var(--text-primary)]">
                {navCounts.inbox || 0}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2 text-sm">
              <TrendingUp className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
              <span className="text-[color:var(--text-secondary)]">Active</span>
              <span className="font-semibold text-[color:var(--text-primary)]">
                {navCounts.engagements || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Sidebar Navigation */}
          <div className="hidden lg:block">
            <Card className="sticky top-20 border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <NavigationGrid
                  activeSection={activeSection}
                  onSelect={navigateSection}
                  counts={navCounts}
                />
              </CardContent>
            </Card>
          </div>

          {/* Mobile Navigation */}
          {showMobileNavAboveContent && (
            <div className="lg:hidden">
              <div className="grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3">
                {SECTION_GROUPS.flatMap((group) =>
                  group.sections.map((section) => {
                    const count = navCounts[section] ?? 0;
                    return (
                      <QuickActionCard
                        key={section}
                        section={section}
                        label={SECTION_LABELS[section]}
                        description={SECTION_META[section].description}
                        icon={SECTION_ICONS[section]}
                        count={count}
                        isActive={section === activeSection}
                        onClick={() => navigateSection(section)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="min-w-0 space-y-4">
            <Card
              className={cn(
                "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]",
                isPostComposer ? "hidden md:block" : ""
              )}
            >
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                    {sectionMeta.title}
                  </h2>
                  <p className="text-xs text-[color:var(--text-secondary)] mt-1">
                    {sectionMeta.description}
                  </p>
                </div>
                {sectionMeta.actionTarget !== activeSection && (
                  <Button
                    size="sm"
                    onClick={() => navigateSection(sectionMeta.actionTarget)}
                    className="bg-ts-orange text-text-black hover:bg-ts-orange/90 whitespace-nowrap"
                  >
                    {sectionMeta.actionLabel}
                  </Button>
                )}
              </CardContent>
            </Card>
            {centerContent}
            {!showMobileNavAboveContent && (
              <div className="lg:hidden">
                <div className="grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3">
                  {SECTION_GROUPS.flatMap((group) =>
                    group.sections.map((section) => {
                      const count = navCounts[section] ?? 0;
                      return (
                        <QuickActionCard
                          key={section}
                          section={section}
                          label={SECTION_LABELS[section]}
                          description={SECTION_META[section].description}
                          icon={SECTION_ICONS[section]}
                          count={count}
                          isActive={section === activeSection}
                          onClick={() => navigateSection(section)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
