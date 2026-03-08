import { ReactNode, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { WorkRequest } from "@shared/schema";
import TasksHub from "../tasks";
import DirectConnectPros from "./DirectConnectPros";
import { EmploymentBoard } from "./EmploymentBoard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { interpretWorkRequestStateForScout } from "@/utils/interpretWorkRequestState";
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
  MessageCircle,
  MoreHorizontal,
  ChevronRight,
  Zap,
  TrendingUp,
  Paperclip,
  ImagePlus,
  FolderKanban,
  Clock3,
} from "lucide-react";

const SECTIONS = ["post", "board", "employment", "inbox", "pros", "engagements"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABELS: Record<Section, string> = {
  post: "New Request",
  board: "Local Requests",
  employment: "Jobs",
  inbox: "Pros Responding",
  pros: "Find Pros",
  engagements: "Request Tracker",
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
    title: "New request",
    description: "Tell people what you need, add photos if you have them, and send your request.",
    actionLabel: "View My Requests",
    actionTarget: "engagements",
  },
  board: {
    title: "Local requests",
    description: "See open requests in your area.",
    actionLabel: "Start a request",
    actionTarget: "post",
  },
  employment: {
    title: "Jobs",
    description: "Post a job or a resume and talk through Scout.",
    actionLabel: "Start a request",
    actionTarget: "post",
  },
  inbox: {
    title: "Pros responding",
    description: "Review who has responded and move accepted work into conversation.",
    actionLabel: "View request tracker",
    actionTarget: "engagements",
  },
  pros: {
    title: "Find pros",
    description: "Look through local pros, then send a request when you're ready.",
    actionLabel: "Start a request",
    actionTarget: "post",
  },
  engagements: {
    title: "Request tracker",
    description:
      "See what still needs your action, what is already out with pros, and what is in conversation.",
    actionLabel: "View replies",
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
  { title: "Start", sections: ["post", "pros", "board"], icon: <Zap className="h-4 w-4" /> },
  {
    title: "Work paths",
    sections: ["employment"],
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    title: "Manage",
    sections: ["engagements", "inbox"],
    icon: <TrendingUp className="h-4 w-4" />,
  },
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
    attachmentCount?: number | null;
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
  attachmentCount?: number | null;
  dcSuggestedCount?: number | null;
  dcAcceptedAssignmentId?: string | null;
  dcConversationThreadId?: string | null;
  dcLastEventAt?: string | null;
};

type RequestFilter = "all" | "open" | "routed" | "in_progress" | "completed" | "cancelled";

type RequestWorkflowStage =
  | "ready_to_send"
  | "waiting_on_pros"
  | "active_conversation"
  | "completed"
  | "cancelled";

const REQUEST_FILTERS: RequestFilter[] = [
  "all",
  "open",
  "routed",
  "in_progress",
  "completed",
  "cancelled",
];

function getRequestWorkflowStage(request: DirectConnectRequest): RequestWorkflowStage {
  const status = String(request.status || "open").toLowerCase();
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "in_progress" || Boolean(request.dcConversationThreadId)) {
    return "active_conversation";
  }
  if (status === "routed") return "waiting_on_pros";
  return "ready_to_send";
}

function getRequestFilterLabel(filter: RequestFilter): string {
  switch (filter) {
    case "all":
      return "All";
    case "open":
      return "Ready to send";
    case "routed":
      return "Waiting on pros";
    case "in_progress":
      return "In conversation";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function getRequestStageLabel(stage: RequestWorkflowStage): string {
  switch (stage) {
    case "ready_to_send":
      return "Ready to send";
    case "waiting_on_pros":
      return "Waiting on pros";
    case "active_conversation":
      return "In conversation";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function getRequestStageSummary(stage: RequestWorkflowStage): string {
  switch (stage) {
    case "ready_to_send":
      return "This request is saved on your board and still needs to be sent to matching pros.";
    case "waiting_on_pros":
      return "TradeScout has already sent this request out. You're waiting to see who responds.";
    case "active_conversation":
      return "A pro has engaged with this request, so your next step is to continue the conversation.";
    case "completed":
      return "This request is done. You can review the details or reopen it only by creating a new request.";
    case "cancelled":
      return "This request is paused. Reopen it when you want TradeScout to work it again.";
  }
}

function matchesRequestFilter(request: DirectConnectRequest, filter: RequestFilter): boolean {
  const stage = getRequestWorkflowStage(request);
  if (filter === "all") return stage !== "cancelled";
  if (filter === "open") return stage === "ready_to_send";
  if (filter === "routed") return stage === "waiting_on_pros";
  if (filter === "in_progress") return stage === "active_conversation";
  if (filter === "completed") return stage === "completed";
  return stage === "cancelled";
}

function countRequestsByStage(
  requests: DirectConnectRequest[] | undefined,
  stage: RequestWorkflowStage
): number {
  return (requests || []).filter((request) => getRequestWorkflowStage(request) === stage).length;
}

type DraftAttachment = {
  file: File;
  previewUrl: string;
};

function buildRequestAttachmentUrl(requestId: string, index: number): string {
  return `/api/direct-connect/requests/${encodeURIComponent(requestId)}/attachments/${index}`;
}

function RequestAttachmentStrip({
  requestId,
  attachmentCount,
}: {
  requestId: string;
  attachmentCount?: number | null;
}) {
  const total = typeof attachmentCount === "number" ? attachmentCount : 0;
  if (total <= 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
        <Paperclip className="h-3.5 w-3.5" />
        Request photos
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: total }).map((_, index) => (
          <a
            key={`${requestId}-attachment-${index}`}
            href={buildRequestAttachmentUrl(requestId, index)}
            target="_blank"
            rel="noreferrer"
            className="group relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
          >
            <img
              src={buildRequestAttachmentUrl(requestId, index)}
              alt={`Request photo ${index + 1}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

function DirectConnectRequestComposer({ defaultCountyFips }: { defaultCountyFips?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const attachmentsRef = useRef<DraftAttachment[]>([]);
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
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);

  const replaceAttachments = (next: DraftAttachment[]) => {
    attachmentsRef.current = next;
    setAttachments(next);
  };

  const clearAttachments = () => {
    attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    attachmentsRef.current = [];
    setAttachments([]);
  };

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
      label: "Hire someone",
      category: "service_request",
      titlePlaceholder: "I need help with...",
      descriptionPlaceholder:
        "What needs to be done, when you need it, and anything important to know.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "500",
      budgetPlaceholderMax: "2500",
    },
    business_request: {
      label: "Find a business",
      category: "business_request",
      titlePlaceholder: "Looking for a business to help with...",
      descriptionPlaceholder: "What you need, when you need it, and any business requirements.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "300",
      budgetPlaceholderMax: "5000",
    },
    customer_support: {
      label: "Help a customer",
      category: "customer_support",
      titlePlaceholder: "A customer needs help with...",
      descriptionPlaceholder: "Explain the issue, where it is, and how urgent it is.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1500",
    },
    employment: {
      label: "Jobs",
      category: "employment",
      titlePlaceholder: "Hiring for role / contract...",
      descriptionPlaceholder: "Role, schedule, skills needed, and start date.",
      budgetLabelMin: "Pay min (optional)",
      budgetLabelMax: "Pay max (optional)",
      budgetPlaceholderMin: "18",
      budgetPlaceholderMax: "35",
    },
    buy_sell: {
      label: "Buy or sell",
      category: "buy_sell",
      titlePlaceholder: "Looking to buy or sell...",
      descriptionPlaceholder: "What item or material do you need, how much, and by when?",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1500",
    },
    other: {
      label: "Other",
      category: "other",
      titlePlaceholder: "What do you need help with?",
      descriptionPlaceholder: "Add enough detail so the right people can understand the request.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1000",
    },
  };

  const activeRequestMeta = requestTypeMeta[requestType];

  const createMutation = useMutation({
    mutationFn: async () => {
      const uploadedAttachmentKeys: string[] = [];
      for (const attachment of attachmentsRef.current) {
        const { objectKey } = await uploadPrivateObject(attachment.file);
        uploadedAttachmentKeys.push(objectKey);
      }

      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        category: activeRequestMeta.category,
        ...(uploadedAttachmentKeys.length > 0 ? { attachments: uploadedAttachmentKeys } : {}),
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
        title: "Request sent",
        description: "Your request is live.",
      });
      setTitle("");
      setDescription("");
      setBudgetMin("");
      setBudgetMax("");
      setShowOptional(false);
      clearAttachments();
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
          description: error?.message || "Finish verification before sending a request.",
          variant: "destructive",
        });
        navigate("/verification");
        return;
      }

      toast({
        title: "Could not send request",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 10;

  const handleAttachmentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const remaining = Math.max(0, 6 - attachmentsRef.current.length);
    const files = Array.from(event.target.files || []).slice(0, remaining);
    if (!files.length) {
      event.target.value = "";
      return;
    }

    const next = [
      ...attachmentsRef.current,
      ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ].slice(0, 6);
    replaceAttachments(next);
    event.target.value = "";
  };

  const removeAttachmentAt = (index: number) => {
    const current = attachmentsRef.current[index];
    if (current) {
      URL.revokeObjectURL(current.previewUrl);
    }
    replaceAttachments(attachmentsRef.current.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">New request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/70 p-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-[color:var(--theme-accent-primary)]/25 bg-[color:var(--theme-accent-primary)]/10 p-2 text-[color:var(--theme-accent-primary)]">
              <ImagePlus className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[color:var(--text-primary)]">
                Photos help people understand the job faster
              </p>
              <p className="text-xs text-[color:var(--text-secondary)]">
                Add photos of the space, damage, or materials so people know what they're looking at
                before they reply.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-[color:var(--text-secondary)]">Request type</label>
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
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-[color:var(--text-secondary)]">Request photos</label>
            <span className="text-[11px] text-[color:var(--text-secondary)]">
              {attachments.length}/6 added
            </span>
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-3 transition-colors hover:border-[color:var(--theme-accent-primary)]/50">
            <div className="flex items-center gap-2 text-sm text-[color:var(--text-primary)]">
              <ImagePlus className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
              Add photos to this request
            </div>
            <span className="text-xs text-[color:var(--text-secondary)]">JPG, PNG, WEBP</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAttachmentSelect}
            />
          </label>
          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {attachments.map((attachment, index) => (
                <div
                  key={`${attachment.file.name}-${index}`}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[color:var(--border-subtle)]"
                >
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.file.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                    onClick={() => removeAttachmentAt(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
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
            {createMutation.isPending ? "Sending..." : "Send request"}
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
      if (!res.ok) throw new Error("Failed to load replies");
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
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                    {canRespond ? "New reply" : "Saved request"}
                  </p>
                  <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                    {request?.title || "New opportunity"}
                  </h3>
                  <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)] md:line-clamp-2">
                    {request?.description || "Request details."}
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
                    <div>Sent {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</div>
                  )}
                  {typeof snapshot?.score === "number" && (
                    <div>Fit score {Math.round(snapshot.score)}</div>
                  )}
                  {typeof snapshot?.distanceMiles === "number" && (
                    <div>{snapshot.distanceMiles.toFixed(1)} mi away</div>
                  )}
                </div>
              )}

              {request?.id && request.attachmentCount ? (
                <RequestAttachmentStrip
                  requestId={request.id}
                  attachmentCount={request.attachmentCount}
                />
              ) : null}
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
  const [, navigate] = useLocation();
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [mobileActionRequestId, setMobileActionRequestId] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");
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
    return requestsData.filter((request) => matchesRequestFilter(request, requestFilter));
  }, [requestsData, requestFilter]);

  const routeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/route`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request sent out" });
    },
  });

  const expandMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/route?expand=true`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Search widened" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request canceled" });
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
        <CardContent className="space-y-4 p-6 text-center md:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--theme-accent-primary)]/25 bg-[color:var(--theme-accent-primary)]/10 text-[color:var(--theme-accent-primary)]">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              No requests in this view
            </p>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Start a request and it will show up here with updates, photos, and next steps.
            </p>
          </div>
          <div className="flex justify-center">
            <Button
              className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
              onClick={() => navigate("/direct-connect")}
            >
              Start request
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="space-y-3 p-3">
          <div className="space-y-1 px-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
              Request stages
            </p>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Each request moves through one clear stage at a time: ready to send, waiting on pros,
              or in conversation.
            </p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {REQUEST_FILTERS.map((f) => {
              const count =
                requestsData?.filter((request) => matchesRequestFilter(request, f)).length || 0;
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
                  {getRequestFilterLabel(f)} ({count})
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {filteredRequests.map((r) => {
        const status = String(r.status || "open").toLowerCase();
        const interpreted = interpretWorkRequestStateForScout(r as unknown as WorkRequest);
        const stage = getRequestWorkflowStage(r);
        const hasAccepted = stage === "active_conversation" || stage === "completed";
        const canSend = stage === "ready_to_send";
        const canExpand = stage === "waiting_on_pros";
        const canMessage = Boolean(r.dcConversationThreadId) || stage === "active_conversation";
        const canCancel =
          stage === "ready_to_send" ||
          stage === "waiting_on_pros" ||
          stage === "active_conversation";
        const canReopen = stage === "cancelled";
        const isExpanded = expandedRequestId === r.id;
        const isMobileActionOpen = mobileActionRequestId === r.id;
        const timelineStamp = r.dcLastEventAt || r.createdAt;
        const statusFacts = [
          r.tradeId ? `Trade ${r.tradeId}` : null,
          r.countyFips ? `County ${r.countyFips}` : null,
          typeof r.dcSuggestedCount === "number" && r.dcSuggestedCount > 0
            ? `${r.dcSuggestedCount} routed`
            : null,
          typeof r.attachmentCount === "number" && r.attachmentCount > 0
            ? `${r.attachmentCount} photos`
            : null,
        ].filter(Boolean);
        return (
          <Card
            key={r.id}
            className="overflow-hidden border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] transition-colors hover:border-[color:var(--theme-accent-primary)]/50"
          >
            <CardContent className="space-y-4 p-4 md:p-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/75 p-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                      {getRequestStageLabel(stage)}
                    </p>
                    {timelineStamp && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--text-secondary)]">
                        <Clock3 className="h-3 w-3" />
                        {formatDistanceToNow(new Date(timelineStamp), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-[color:var(--text-primary)] md:text-lg">
                    {r.title}
                  </h3>
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    {interpreted.primaryPhrase}
                  </p>
                  {interpreted.secondaryPhrase && (
                    <p className="text-xs text-[color:var(--text-secondary)]/90">
                      {interpreted.secondaryPhrase}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn("h-fit uppercase text-[10px]", statusTone(status))}
                >
                  {status.replace("_", " ")}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-[color:var(--text-primary)]">{r.description}</p>
                {statusFacts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
                    {statusFacts.map((fact) => (
                      <span
                        key={fact}
                        className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 py-1"
                      >
                        {fact}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <RequestAttachmentStrip requestId={r.id} attachmentCount={r.attachmentCount} />

              <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/65 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                      What happens now
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--text-primary)]">
                      {getRequestStageSummary(stage)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() =>
                      setExpandedRequestId((current) => (current === r.id ? null : r.id))
                    }
                  >
                    {isExpanded ? "Hide details" : "Show details"}
                  </Button>
                </div>
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

              {isExpanded && (
                <div className="grid gap-2 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/55 p-3 text-sm text-[color:var(--text-secondary)] md:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                      Status
                    </p>
                    <p className="mt-1 text-[color:var(--text-primary)]">
                      {getRequestStageLabel(stage)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                      Conversation
                    </p>
                    <p className="mt-1 text-[color:var(--text-primary)]">
                      {canMessage
                        ? "You can open the thread now."
                        : "Messaging unlocks after a pro engages."}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                      Other actions
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {canExpand && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          disabled={expandMutation.isPending}
                          onClick={() => expandMutation.mutate(r.id)}
                        >
                          Widen search
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(r.id)}
                        >
                          Cancel request
                        </Button>
                      )}
                      {canReopen && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                          disabled={reopenMutation.isPending}
                          onClick={() => reopenMutation.mutate(r.id)}
                        >
                          Reopen request
                        </Button>
                      )}
                      {!canMessage && <WhyLink to={getHelpLink("messaging")} />}
                    </div>
                  </div>
                </div>
              )}

              <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                {canSend && (
                  <Button
                    size="sm"
                    className="h-8 px-2 text-xs bg-ts-orange text-text-black hover:bg-ts-orange/90"
                    disabled={routeMutation.isPending}
                    onClick={() => routeMutation.mutate(r.id)}
                  >
                    Send to pros
                  </Button>
                )}
                {stage === "waiting_on_pros" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={() => navigate("/direct-connect/inbox")}
                  >
                    Check replies
                  </Button>
                )}
                {canMessage && (
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
                  >
                    Open messages
                  </Button>
                )}
                {canReopen && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                    disabled={reopenMutation.isPending}
                    onClick={() => reopenMutation.mutate(r.id)}
                  >
                    Reopen request
                  </Button>
                )}
              </div>

              {isMobileActionOpen && (
                <div className="flex flex-wrap items-center justify-end gap-1.5 sm:hidden">
                  {canSend && (
                    <Button
                      size="sm"
                      className="h-8 px-2 text-xs bg-ts-orange text-text-black hover:bg-ts-orange/90"
                      disabled={routeMutation.isPending}
                      onClick={() => routeMutation.mutate(r.id)}
                    >
                      Send to pros
                    </Button>
                  )}
                  {stage === "waiting_on_pros" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      onClick={() => navigate("/direct-connect/inbox")}
                    >
                      Check replies
                    </Button>
                  )}
                  {canMessage && (
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
                    >
                      <MessageCircle className="mr-1 h-3.5 w-3.5" />
                      Open messages
                    </Button>
                  )}
                  {canReopen && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                      disabled={reopenMutation.isPending}
                      onClick={() => reopenMutation.mutate(r.id)}
                    >
                      Reopen request
                    </Button>
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
  const requestSummary = useMemo(
    () => ({
      readyToSend: countRequestsByStage(requestsData, "ready_to_send"),
      waitingOnPros: countRequestsByStage(requestsData, "waiting_on_pros"),
      inConversation: countRequestsByStage(requestsData, "active_conversation"),
    }),
    [requestsData]
  );

  const sectionMeta = SECTION_META[activeSection];
  const isManageMode = activeSection === "engagements" || activeSection === "inbox";
  const activeModeSections = isManageMode
    ? (["engagements", "inbox"] as const)
    : (["post", "pros", "board", "employment"] as const);
  const isPostComposer = activeSection === "post";

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
      <div className="mx-auto w-full max-w-6xl space-y-4 px-2.5 py-3 sm:px-3 sm:py-4 md:px-6 md:py-6">
        {/* Header Section */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[color:var(--text-primary)]">
              Direct Connect
            </h1>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1">
              {isManageMode
                ? "Follow one governed path: send a request, wait for responses, then move accepted work into conversation."
                : "Start a request, choose the right path, and keep local work moving through Scout."}
            </p>
          </div>

          {/* Status Pills */}
          <div
            className={cn("flex flex-wrap gap-2", activeSection === "post" ? "hidden sm:flex" : "")}
          >
            {isManageMode ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2 text-sm">
                  <Zap className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Ready to send</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {requestSummary.readyToSend}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2 text-sm">
                  <Inbox className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Waiting on pros</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {requestSummary.waitingOnPros}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2 text-sm">
                  <MessageCircle className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">In conversation</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {requestSummary.inConversation}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2 text-sm">
                  <Inbox className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Pros responding</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {navCounts.inbox || 0}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Open requests</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {navCounts.engagements || 0}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeModeSections.map((section) => {
            const active = section === activeSection;
            const count = navCounts[section] ?? 0;
            return (
              <button
                key={section}
                type="button"
                onClick={() => navigateSection(section)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-[color:var(--theme-accent-primary)] bg-[color:var(--theme-accent-primary)]/10 text-[color:var(--text-primary)]"
                    : "border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-[color:var(--text-secondary)]"
                )}
              >
                <span className="text-[color:var(--theme-accent-primary)]">
                  {SECTION_ICONS[section]}
                </span>
                <span>{SECTION_LABELS[section]}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

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
                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
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
        </div>
      </div>
    </div>
  );
}
