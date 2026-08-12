import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const ADMIN_OFFERS_BASE = "/api/admin/jw-stone/offers";
const ADMIN_OFFERS_QUERY_ROOT = ["admin-jw-stone-offers"] as const;

type OfferTargetType = "stone" | "container";
type OfferStatus = "submitted" | "under_review" | "accepted" | "declined" | "withdrawn" | "expired";

type OperatorOffer = {
  id: string;
  status: OfferStatus;
  amountDisplay: string;
  submittedAt: string;
  target: {
    id: string;
    type: OfferTargetType;
    label: string;
  };
  maskedContact: {
    email: string;
    phone: string;
  };
  containerPriority?: {
    position: number;
    eligibleCount?: number | null;
  } | null;
  notifications?: OfferNotification[];
};

type RevealedContact = {
  email: string;
  phone: string;
};

type OfferNotification = {
  id: string;
  purpose: string;
  status: "queued" | "processing" | "sent" | "failed" | string;
  attemptCount?: number | null;
  nextAttemptAt?: string | null;
  lastAttemptAt?: string | null;
  sentAt?: string | null;
  failureSummary?: string | null;
};

type OfferEvent = {
  id: string;
  type: string;
  label?: string | null;
  summary?: string | null;
  actorLabel?: string | null;
  createdAt: string;
};

type OfferContainer = {
  id: string;
  title: string;
  description?: string | null;
  status: "draft" | "published" | "closed" | string;
  acceptingOffers: boolean;
  minimumOfferDisplay?: string | null;
  updatedAt?: string | null;
};

type StoneOfferSetting = {
  inventoryId: string;
  publicLabel: string;
  acceptingOffers: boolean;
  minimumOfferDisplay?: string | null;
  updatedAt?: string | null;
};

type ContainerDraft = {
  title: string;
  description: string;
  minimumOffer: string;
  acceptingOffers: boolean;
};

type JsonRecord = Record<string, unknown>;

class AdminOffersApiError extends Error {
  status: number;
  requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "AdminOffersApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

async function adminOffersRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && init.method !== "GET" && init.method !== "HEAD") {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi) throw new Error("Secure request identifiers are unavailable in this browser.");
    const random =
      typeof cryptoApi.randomUUID === "function"
        ? cryptoApi.randomUUID()
        : Array.from(cryptoApi.getRandomValues(new Uint8Array(24)), (byte) =>
            byte.toString(16).padStart(2, "0")
          ).join("");
    headers.set("Idempotency-Key", `jw-operator-${random}`);
  }

  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });
  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  if (!response.ok) {
    const record = isRecord(body) ? body : null;
    const message =
      (typeof record?.message === "string" && record.message.trim()) ||
      `Request failed (${response.status})`;
    const requestId =
      (typeof record?.requestId === "string" && record.requestId.trim()) ||
      response.headers.get("X-Request-Id") ||
      undefined;
    throw new AdminOffersApiError(message, response.status, requestId);
  }

  return body as T;
}

function adminOffersMutation<T>(
  path: string,
  method: "POST" | "PATCH",
  body: JsonRecord = {}
): Promise<T> {
  return adminOffersRequest<T>(path, {
    method,
    body: JSON.stringify(body),
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readCollection<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];
  const direct = payload[key];
  if (Array.isArray(direct)) return direct as T[];
  const data = payload.data;
  if (isRecord(data) && Array.isArray(data[key])) return data[key] as T[];
  return [];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function isAuthorizationError(error: unknown): boolean {
  return error instanceof AdminOffersApiError && (error.status === 401 || error.status === 403);
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not reported" : date.toLocaleString();
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function minimumInputFromDisplay(value?: string | null): string {
  return value ? value.replace(/[$,\s]/g, "") : "";
}

function normalizeOptionalUsd(
  value: string
): { ok: true; value: string | null } | { ok: false; message: string } {
  const trimmed = value.trim().replace(/^\$/, "");
  if (!trimmed) return { ok: true, value: null };
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    return { ok: false, message: "Enter a USD amount with no more than two decimal places." };
  }

  const whole = match[1].replace(/^0+(?=\d)/, "");
  const fraction = (match[2] || "").padEnd(2, "0");
  if (!/[1-9]/.test(`${whole}${fraction}`)) {
    return { ok: false, message: "A posted minimum must be greater than zero." };
  }
  return { ok: true, value: `${whole}.${fraction}` };
}

function offerStatusClass(status: string): string {
  if (status === "accepted") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "declined" || status === "expired" || status === "withdrawn") {
    return "border-slate-500/40 bg-slate-500/10 text-slate-300";
  }
  if (status === "under_review") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-sky-500/40 bg-sky-500/10 text-sky-200";
}

function isTerminalOfferStatus(status: OfferStatus): boolean {
  return (
    status === "accepted" || status === "declined" || status === "withdrawn" || status === "expired"
  );
}

function notificationTruth(notification: OfferNotification): string {
  if (notification.status === "sent") {
    return notification.sentAt
      ? `Sent ${formatTimestamp(notification.sentAt)}.`
      : "The outbox reports sent; no sent timestamp was returned.";
  }
  if (notification.status === "processing") {
    return "An attempt is in progress; delivery is not yet confirmed.";
  }
  if (notification.status === "failed") {
    return "The outbox reports a terminal failure for the recorded attempt schedule.";
  }
  if (notification.status === "queued") {
    return notification.nextAttemptAt
      ? `Queued; not sent yet. Next attempt ${formatTimestamp(notification.nextAttemptAt)}.`
      : "Queued; not sent yet.";
  }
  return `The server reports “${humanize(notification.status)}”; delivery is not inferred.`;
}

function AccessAwareError({ error, title }: { error: unknown; title: string }) {
  const authorizationError = isAuthorizationError(error);
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{authorizationError ? "Access not authorized" : title}</AlertTitle>
      <AlertDescription>
        {authorizationError
          ? "This account is not authorized for this JW operator workspace. The server decides access for every request."
          : getErrorMessage(error)}
      </AlertDescription>
    </Alert>
  );
}

type ConfirmationActionProps = {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  triggerTestId?: string;
  confirmTestId?: string;
};

function ConfirmationAction({
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  disabled = false,
  destructive = false,
  triggerVariant = "outline",
  triggerTestId,
  confirmTestId,
}: ConfirmationActionProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={triggerVariant}
          disabled={disabled || pending}
          data-testid={triggerTestId}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            data-testid={confirmTestId}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function OfferEventTimeline({
  events,
  isLoading,
  error,
}: {
  events: OfferEvent[];
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading event history…
      </p>
    );
  }
  if (error) return <AccessAwareError error={error} title="Could not load event history" />;
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">No event history was returned.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5" aria-label="Offer event history">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className="absolute -left-[1.55rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{event.label || humanize(event.type)}</p>
            <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
              {formatTimestamp(event.createdAt)}
            </time>
          </div>
          {event.summary ? (
            <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p>
          ) : null}
          {event.actorLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">Recorded actor: {event.actorLabel}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function OfferNotifications({
  offerId,
  notifications,
  onRetry,
  retryingId,
}: {
  offerId: string;
  notifications: OfferNotification[];
  onRetry: (offerId: string, notificationId: string) => void;
  retryingId: string | null;
}) {
  return (
    <section aria-labelledby={`offer-${offerId}-notifications`} className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h4 id={`offer-${offerId}-notifications`} className="text-sm font-semibold">
          Email outbox
        </h4>
      </div>
      {!notifications.length ? (
        <p className="text-sm text-muted-foreground">
          No email outbox records were returned for this offer.
        </p>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{humanize(notification.purpose)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notificationTruth(notification)}
                  </p>
                </div>
                <Badge variant="outline">{humanize(notification.status)}</Badge>
              </div>
              <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-foreground">Attempts: </dt>
                  <dd className="inline">{notification.attemptCount ?? "Not reported"}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">Last attempt: </dt>
                  <dd className="inline">{formatTimestamp(notification.lastAttemptAt)}</dd>
                </div>
              </dl>
              {notification.failureSummary ? (
                <p className="mt-2 text-xs text-destructive">
                  Redacted failure summary: {notification.failureSummary}
                </p>
              ) : null}
              {notification.status === "failed" ? (
                <div className="mt-3">
                  <ConfirmationAction
                    triggerLabel="Retry notification"
                    title="Create a new notification attempt?"
                    description="This requests a new outbox attempt. It does not change the offer or claim that email delivery succeeded."
                    confirmLabel="Create retry"
                    onConfirm={() => onRetry(offerId, notification.id)}
                    pending={retryingId === notification.id}
                    triggerTestId={`retry-notification-${notification.id}`}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type OfferCardProps = {
  offer: OperatorOffer;
  revealedContact?: RevealedContact;
  expanded: boolean;
  events: OfferEvent[];
  eventsLoading: boolean;
  eventsError: unknown;
  revealPending: boolean;
  decisionPending: boolean;
  retryingNotificationId: string | null;
  onToggleEvents: () => void;
  onReveal: (offerId: string) => void;
  onDecision: (offerId: string, decision: "accept" | "decline") => void;
  onRetry: (offerId: string, notificationId: string) => void;
};

function OfferCard({
  offer,
  revealedContact,
  expanded,
  events,
  eventsLoading,
  eventsError,
  revealPending,
  decisionPending,
  retryingNotificationId,
  onToggleEvents,
  onReveal,
  onDecision,
  onRetry,
}: OfferCardProps) {
  const terminal = isTerminalOfferStatus(offer.status);
  const priority = offer.target.type === "container" ? offer.containerPriority : null;

  return (
    <Card data-testid={`offer-card-${offer.id}`} className="border-border">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {offer.target.type === "container" ? "Container" : "Stone"}
              </Badge>
              <Badge variant="outline" className={offerStatusClass(offer.status)}>
                {humanize(offer.status)}
              </Badge>
              {priority?.position ? (
                <Badge
                  variant="outline"
                  className="border-violet-500/40 bg-violet-500/10 text-violet-200"
                  aria-label={`Staff-only container priority ${priority.position}`}
                >
                  Staff-only priority {priority.position}
                  {priority.eligibleCount ? ` of ${priority.eligibleCount}` : ""}
                </Badge>
              ) : null}
            </div>
            <CardTitle className="break-words text-lg">{offer.target.label}</CardTitle>
            <CardDescription className="mt-1 break-all">
              Target ID: {offer.target.id}
            </CardDescription>
          </div>
          <div className="sm:text-right">
            <p className="text-xl font-semibold tabular-nums">{offer.amountDisplay}</p>
            <p className="text-xs text-muted-foreground">
              Submitted {formatTimestamp(offer.submittedAt)}
            </p>
          </div>
        </div>
        {priority?.position ? (
          <p className="text-xs text-muted-foreground">
            The server supplies this restricted container order from current eligible offers using
            amount descending, then submission time and immutable ID. This page does not recalculate
            it.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <section
          aria-labelledby={`offer-${offer.id}-contact`}
          className="rounded-lg border border-border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              <h4 id={`offer-${offer.id}-contact`} className="text-sm font-semibold">
                Contact gate
              </h4>
            </div>
            <Badge variant={revealedContact ? "default" : "secondary"}>
              {revealedContact ? "Revealed by audited review" : "Masked"}
            </Badge>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1 break-all" data-testid={`offer-email-${offer.id}`}>
                {revealedContact?.email || offer.maskedContact.email || "Masked value unavailable"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Phone
              </dt>
              <dd className="mt-1" data-testid={`offer-phone-${offer.id}`}>
                {revealedContact?.phone || offer.maskedContact.phone || "Masked value unavailable"}
              </dd>
            </div>
          </dl>
          {!revealedContact ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Full contact is not loaded with the queue. A successful audited review action must
              return it.
            </p>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-2" aria-label={`Actions for ${offer.target.label}`}>
          {!revealedContact ? (
            <ConfirmationAction
              triggerLabel="Review / reveal contact"
              title="Review this offer and reveal contact?"
              description="This is a distinct, audited contact-access decision. Full contact is shown only if the server authorizes and records the action. It does not accept the offer."
              confirmLabel="Review and reveal"
              onConfirm={() => onReveal(offer.id)}
              pending={revealPending}
              triggerVariant="secondary"
              triggerTestId={`reveal-offer-${offer.id}`}
              confirmTestId={`confirm-reveal-offer-${offer.id}`}
            />
          ) : null}
          <ConfirmationAction
            triggerLabel="Accept"
            title="Accept this offer for conversation?"
            description="Acceptance records JW's decision to continue a private commercial conversation. It is not payment, a reservation, title transfer, or a binding sale, and it does not reveal contact."
            confirmLabel="Accept offer"
            onConfirm={() => onDecision(offer.id, "accept")}
            pending={decisionPending}
            disabled={terminal}
            triggerTestId={`accept-offer-${offer.id}`}
            confirmTestId={`confirm-accept-offer-${offer.id}`}
          />
          <ConfirmationAction
            triggerLabel="Decline"
            title="Decline this offer?"
            description="Declining is a terminal offer decision. The event remains in the immutable history."
            confirmLabel="Decline offer"
            onConfirm={() => onDecision(offer.id, "decline")}
            pending={decisionPending}
            disabled={terminal}
            destructive
            triggerVariant="destructive"
            triggerTestId={`decline-offer-${offer.id}`}
            confirmTestId={`confirm-decline-offer-${offer.id}`}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onToggleEvents}
            aria-expanded={expanded}
            aria-controls={`offer-${offer.id}-events`}
          >
            {expanded ? "Hide history" : "Show history"}
          </Button>
        </div>

        <Separator />
        <OfferNotifications
          offerId={offer.id}
          notifications={offer.notifications || []}
          onRetry={onRetry}
          retryingId={retryingNotificationId}
        />

        {expanded ? (
          <section
            id={`offer-${offer.id}-events`}
            aria-labelledby={`offer-${offer.id}-events-title`}
          >
            <div className="mb-3 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h4 id={`offer-${offer.id}-events-title`} className="text-sm font-semibold">
                Offer event history
              </h4>
            </div>
            <OfferEventTimeline events={events} isLoading={eventsLoading} error={eventsError} />
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OfferQueuePanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [targetFilter, setTargetFilter] = useState<"all" | OfferTargetType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OfferStatus>("all");
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [revealedContacts, setRevealedContacts] = useState<Record<string, RevealedContact>>({});

  const queueUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (targetFilter !== "all") params.set("targetType", targetFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    return `${ADMIN_OFFERS_BASE}?${params.toString()}`;
  }, [statusFilter, targetFilter]);

  const offersQuery = useQuery<OperatorOffer[]>({
    queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "queue", targetFilter, statusFilter],
    queryFn: async () => {
      const payload = await adminOffersRequest<unknown>(queueUrl);
      return readCollection<OperatorOffer>(payload, "offers").filter(
        (offer) => String(offer.status) !== "pending_verification"
      );
    },
  });

  const eventsQuery = useQuery<OfferEvent[]>({
    queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "events", expandedOfferId],
    enabled: Boolean(expandedOfferId),
    queryFn: async () => {
      const payload = await adminOffersRequest<unknown>(
        `${ADMIN_OFFERS_BASE}/${encodeURIComponent(expandedOfferId || "")}/events`
      );
      return readCollection<OfferEvent>(payload, "events");
    },
  });

  const revealMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const payload = await adminOffersMutation<unknown>(
        `${ADMIN_OFFERS_BASE}/${encodeURIComponent(offerId)}/review/reveal-contact`,
        "POST"
      );
      const contact = isRecord(payload) && isRecord(payload.contact) ? payload.contact : null;
      if (
        !contact ||
        typeof contact.email !== "string" ||
        typeof contact.phone !== "string" ||
        !contact.email.trim() ||
        !contact.phone.trim()
      ) {
        throw new Error("The review was not reported with complete contact data.");
      }
      return { email: contact.email, phone: contact.phone } satisfies RevealedContact;
    },
    onSuccess: async (contact, offerId) => {
      setRevealedContacts((current) => ({ ...current, [offerId]: contact }));
      await queryClient.invalidateQueries({
        queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "events", offerId],
      });
      toast({
        title: "Contact revealed",
        description: "The server authorized and recorded the review action.",
      });
    },
    onError: (error) => {
      toast({
        title: "Contact remains masked",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const decisionMutation = useMutation({
    mutationFn: ({ offerId, decision }: { offerId: string; decision: "accept" | "decline" }) =>
      adminOffersMutation(
        `${ADMIN_OFFERS_BASE}/${encodeURIComponent(offerId)}/${decision}`,
        "POST"
      ),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "queue"] }),
        queryClient.invalidateQueries({
          queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "events", variables.offerId],
        }),
      ]);
      toast({
        title: variables.decision === "accept" ? "Offer accepted" : "Offer declined",
        description:
          variables.decision === "accept"
            ? "The private conversation decision was recorded; no payment or sale was created."
            : "The terminal decision was recorded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Decision not recorded",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: ({ offerId, notificationId }: { offerId: string; notificationId: string }) =>
      adminOffersMutation(
        `${ADMIN_OFFERS_BASE}/${encodeURIComponent(offerId)}/outbox/${encodeURIComponent(notificationId)}/retry`,
        "POST"
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "queue"] });
      toast({
        title: "Retry created",
        description:
          "The outbox will report the result of the new attempt; delivery is not yet confirmed.",
      });
      if (expandedOfferId === variables.offerId) {
        await queryClient.invalidateQueries({
          queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "events", variables.offerId],
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Retry not created",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const offers = offersQuery.data || [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Masked private-offer queue</CardTitle>
          <CardDescription>
            Filters are sent to the restricted endpoint. Queue order and container priority are
            accepted only from the server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="jw-offer-target-filter">Target</Label>
              <Select
                value={targetFilter}
                onValueChange={(value) => setTargetFilter(value as typeof targetFilter)}
              >
                <SelectTrigger id="jw-offer-target-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All targets</SelectItem>
                  <SelectItem value="stone">Stones</SelectItem>
                  <SelectItem value="container">Containers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jw-offer-status-filter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
              >
                <SelectTrigger id="jw-offer-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All operator-visible states</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under review</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => offersQuery.refetch()}
              disabled={offersQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${offersQuery.isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {offersQuery.error ? (
        <AccessAwareError error={offersQuery.error} title="Could not load private offers" />
      ) : null}
      {offersQuery.isLoading ? (
        <p
          className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading masked offers…
        </p>
      ) : null}
      {!offersQuery.isLoading && !offersQuery.error && offers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">No operator-visible offers match these filters.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pending verification offers are not part of this queue.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4" aria-live="polite">
        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            revealedContact={revealedContacts[offer.id]}
            expanded={expandedOfferId === offer.id}
            events={expandedOfferId === offer.id ? eventsQuery.data || [] : []}
            eventsLoading={expandedOfferId === offer.id && eventsQuery.isLoading}
            eventsError={expandedOfferId === offer.id ? eventsQuery.error : null}
            revealPending={revealMutation.isPending && revealMutation.variables === offer.id}
            decisionPending={
              decisionMutation.isPending && decisionMutation.variables?.offerId === offer.id
            }
            retryingNotificationId={
              retryMutation.isPending && retryMutation.variables?.offerId === offer.id
                ? retryMutation.variables.notificationId
                : null
            }
            onToggleEvents={() =>
              setExpandedOfferId((current) => (current === offer.id ? null : offer.id))
            }
            onReveal={(offerId) => revealMutation.mutate(offerId)}
            onDecision={(offerId, decision) => decisionMutation.mutate({ offerId, decision })}
            onRetry={(offerId, notificationId) => retryMutation.mutate({ offerId, notificationId })}
          />
        ))}
      </div>
    </div>
  );
}

const EMPTY_CONTAINER_DRAFT: ContainerDraft = {
  title: "",
  description: "",
  minimumOffer: "",
  acceptingOffers: true,
};

function ContainersPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContainerDraft>(EMPTY_CONTAINER_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);

  const containersQuery = useQuery<OfferContainer[]>({
    queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "containers"],
    queryFn: async () => {
      const payload = await adminOffersRequest<unknown>(`${ADMIN_OFFERS_BASE}/containers`);
      return readCollection<OfferContainer>(payload, "containers");
    },
  });

  const editingContainer = (containersQuery.data || []).find((item) => item.id === editingId);

  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: JsonRecord }) =>
      id
        ? adminOffersMutation(
            `${ADMIN_OFFERS_BASE}/containers/${encodeURIComponent(id)}`,
            "PATCH",
            body
          )
        : adminOffersMutation(`${ADMIN_OFFERS_BASE}/containers`, "POST", body),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "containers"] });
      setEditingId(null);
      setDraft(EMPTY_CONTAINER_DRAFT);
      setFormError(null);
      toast({
        title: variables.id ? "Container updated" : "Draft container created",
        description: variables.id
          ? "The server recorded the container settings."
          : "The new container remains unpublished until a separate publish action succeeds.",
      });
    },
    onError: (error) => {
      toast({
        title: "Container not saved",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (containerId: string) =>
      adminOffersMutation(
        `${ADMIN_OFFERS_BASE}/containers/${encodeURIComponent(containerId)}/publish`,
        "POST"
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "containers"] });
      toast({
        title: "Container published",
        description: "The server reports the container as published.",
      });
    },
    onError: (error) => {
      toast({
        title: "Container not published",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (containerId: string) =>
      adminOffersMutation(
        `${ADMIN_OFFERS_BASE}/containers/${encodeURIComponent(containerId)}/close`,
        "POST"
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "containers"] }),
        queryClient.invalidateQueries({ queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "queue"] }),
      ]);
      toast({
        title: "Container closed",
        description: "The server reports offer intake as closed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Container not closed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const beginEdit = (container: OfferContainer) => {
    setEditingId(container.id);
    setDraft({
      title: container.title,
      description: container.description || "",
      minimumOffer: minimumInputFromDisplay(container.minimumOfferDisplay),
      acceptingOffers: container.acceptingOffers,
    });
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setDraft(EMPTY_CONTAINER_DRAFT);
    setFormError(null);
  };

  const saveDraft = () => {
    if (!draft.title.trim()) {
      setFormError("A public container title is required.");
      return;
    }
    const minimum = normalizeOptionalUsd(draft.minimumOffer);
    if (!minimum.ok) {
      setFormError(minimum.message);
      return;
    }
    setFormError(null);
    saveMutation.mutate({
      id: editingId,
      body: {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        minimumOffer: minimum.value,
        acceptingOffers: draft.acceptingOffers,
      },
    });
  };

  const saveStopsIntake = Boolean(editingContainer?.acceptingOffers && !draft.acceptingOffers);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit container" : "Create container"}</CardTitle>
          <CardDescription>
            New records begin as drafts. Publishing and closing require separate confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jw-container-title">Public title</Label>
            <Input
              id="jw-container-title"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Container title"
              maxLength={160}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jw-container-description">Public description</Label>
            <Textarea
              id="jw-container-description"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Describe only confirmed container details."
              maxLength={2000}
              className="min-h-28"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jw-container-minimum">Optional public minimum (USD)</Label>
            <Input
              id="jw-container-minimum"
              inputMode="decimal"
              value={draft.minimumOffer}
              onChange={(event) =>
                setDraft((current) => ({ ...current, minimumOffer: event.target.value }))
              }
              placeholder="No minimum posted"
              aria-describedby="jw-container-minimum-help"
            />
            <p id="jw-container-minimum-help" className="text-xs text-muted-foreground">
              Leave blank to post no minimum. Hidden reserves are not represented here.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="jw-container-accepting">Accepting offers</Label>
              <p className="text-xs text-muted-foreground">
                The server enforces this target setting.
              </p>
            </div>
            <Switch
              id="jw-container-accepting"
              checked={draft.acceptingOffers}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, acceptingOffers: checked }))
              }
              disabled={editingContainer?.status === "closed"}
            />
          </div>
          {editingContainer?.status === "closed" ? (
            <p className="text-xs text-muted-foreground">
              This record is closed. Reopening requires a server-supported action that this release
              does not assume.
            </p>
          ) : null}
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {saveStopsIntake ? (
              <ConfirmationAction
                triggerLabel="Save and stop offers"
                title="Save these changes and stop container offers?"
                description="The settings update will request that the server stop new offers for this container. Existing offer history remains."
                confirmLabel="Save and stop offers"
                onConfirm={saveDraft}
                pending={saveMutation.isPending}
                destructive
                triggerVariant="destructive"
                triggerTestId="save-container"
              />
            ) : (
              <Button
                type="button"
                onClick={saveDraft}
                disabled={saveMutation.isPending}
                data-testid="save-container"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {editingId ? "Save container" : "Create draft container"}
              </Button>
            )}
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                disabled={saveMutation.isPending}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Real containers</h3>
          <p className="text-sm text-muted-foreground">
            Only server records appear here. No placeholder inventory is created by this page.
          </p>
        </div>
        {containersQuery.error ? (
          <AccessAwareError error={containersQuery.error} title="Could not load containers" />
        ) : null}
        {containersQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading containers…
          </p>
        ) : null}
        {!containersQuery.isLoading &&
        !containersQuery.error &&
        !(containersQuery.data || []).length ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No containers have been created.
            </CardContent>
          </Card>
        ) : null}
        {(containersQuery.data || []).map((container) => (
          <Card key={container.id} data-testid={`container-${container.id}`}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{humanize(container.status)}</Badge>
                    <Badge variant={container.acceptingOffers ? "default" : "secondary"}>
                      {container.acceptingOffers ? "Accepting offers" : "Offer intake closed"}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{container.title}</CardTitle>
                  <CardDescription className="mt-1 break-all">
                    Container ID: {container.id}
                  </CardDescription>
                </div>
                <p className="text-sm font-medium">
                  {container.minimumOfferDisplay
                    ? `Posted minimum ${container.minimumOfferDisplay}`
                    : "No minimum posted"}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {container.description ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {container.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No public description was returned.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => beginEdit(container)}
                >
                  Edit container
                </Button>
                {container.status === "draft" ? (
                  <ConfirmationAction
                    triggerLabel="Publish container"
                    title="Publish this container?"
                    description="Publishing makes this real container available on the JW storefront according to the server-owned settings."
                    confirmLabel="Publish container"
                    onConfirm={() => publishMutation.mutate(container.id)}
                    pending={
                      publishMutation.isPending && publishMutation.variables === container.id
                    }
                    triggerTestId={`publish-container-${container.id}`}
                  />
                ) : null}
                {container.status !== "closed" ? (
                  <ConfirmationAction
                    triggerLabel="Close container"
                    title="Close this container?"
                    description="Closing stops new offers for this container. Existing offers and their event history remain."
                    confirmLabel="Close container"
                    onConfirm={() => closeMutation.mutate(container.id)}
                    pending={closeMutation.isPending && closeMutation.variables === container.id}
                    destructive
                    triggerVariant="destructive"
                    triggerTestId={`close-container-${container.id}`}
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StoneSettingEditor({
  setting,
  pending,
  onSave,
}: {
  setting: StoneOfferSetting;
  pending: boolean;
  onSave: (inventoryId: string, acceptingOffers: boolean, minimumOffer: string | null) => void;
}) {
  const [acceptingOffers, setAcceptingOffers] = useState(setting.acceptingOffers);
  const [minimumOffer, setMinimumOffer] = useState(
    minimumInputFromDisplay(setting.minimumOfferDisplay)
  );
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const normalized = normalizeOptionalUsd(minimumOffer);
    if (!normalized.ok) {
      setError(normalized.message);
      return;
    }
    setError(null);
    onSave(setting.inventoryId, acceptingOffers, normalized.value);
  };

  const closesIntake = setting.acceptingOffers && !acceptingOffers;

  return (
    <Card data-testid={`stone-setting-${setting.inventoryId}`}>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">{setting.publicLabel}</CardTitle>
            <CardDescription className="mt-1 break-all">
              Inventory ID: {setting.inventoryId}
            </CardDescription>
          </div>
          <Badge variant={setting.acceptingOffers ? "default" : "secondary"}>
            Current: {setting.acceptingOffers ? "accepting offers" : "closed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor={`stone-minimum-${setting.inventoryId}`}>
              Optional public minimum (USD)
            </Label>
            <Input
              id={`stone-minimum-${setting.inventoryId}`}
              inputMode="decimal"
              value={minimumOffer}
              onChange={(event) => setMinimumOffer(event.target.value)}
              placeholder="No minimum posted"
            />
          </div>
          <div className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3">
            <Switch
              id={`stone-accepting-${setting.inventoryId}`}
              checked={acceptingOffers}
              onCheckedChange={setAcceptingOffers}
            />
            <Label htmlFor={`stone-accepting-${setting.inventoryId}`}>Accepting offers</Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave the minimum blank to publish no minimum. The server remains authoritative for
          eligibility.
        </p>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {closesIntake ? (
          <ConfirmationAction
            triggerLabel="Save and close stone offers"
            title="Stop new offers for this stone?"
            description="This requests a server-owned intake closure for the canonical inventory ID. Existing offer history remains."
            confirmLabel="Save and close offers"
            onConfirm={save}
            pending={pending}
            destructive
            triggerVariant="destructive"
            triggerTestId={`save-stone-${setting.inventoryId}`}
          />
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={pending}
            data-testid={`save-stone-${setting.inventoryId}`}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Save stone settings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StoneSettingsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const settingsQuery = useQuery<StoneOfferSetting[]>({
    queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "stone-settings"],
    queryFn: async () => {
      const payload = await adminOffersRequest<unknown>(`${ADMIN_OFFERS_BASE}/stone-settings`);
      return readCollection<StoneOfferSetting>(payload, "stones");
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({
      inventoryId,
      acceptingOffers,
      minimumOffer,
    }: {
      inventoryId: string;
      acceptingOffers: boolean;
      minimumOffer: string | null;
    }) =>
      adminOffersMutation(
        `${ADMIN_OFFERS_BASE}/stone-settings/${encodeURIComponent(inventoryId)}`,
        "PATCH",
        { acceptingOffers, minimumOffer }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "stone-settings"] }),
        queryClient.invalidateQueries({ queryKey: [...ADMIN_OFFERS_QUERY_ROOT, "queue"] }),
      ]);
      toast({
        title: "Stone settings updated",
        description: "The server recorded the target policy.",
      });
    },
    onError: (error) => {
      toast({
        title: "Stone settings not saved",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Stone offer settings</h3>
        <p className="text-sm text-muted-foreground">
          Settings are keyed by canonical inventory ID. This page does not invent or rename
          inventory.
        </p>
      </div>
      {settingsQuery.error ? (
        <AccessAwareError error={settingsQuery.error} title="Could not load stone settings" />
      ) : null}
      {settingsQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading stone settings…
        </p>
      ) : null}
      {!settingsQuery.isLoading && !settingsQuery.error && !(settingsQuery.data || []).length ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No canonical stone settings were returned.
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {(settingsQuery.data || []).map((setting) => (
          <StoneSettingEditor
            key={`${setting.inventoryId}-${setting.updatedAt || "initial"}-${setting.acceptingOffers}-${setting.minimumOfferDisplay || "none"}`}
            setting={setting}
            pending={
              saveMutation.isPending && saveMutation.variables?.inventoryId === setting.inventoryId
            }
            onSave={(inventoryId, acceptingOffers, minimumOffer) =>
              saveMutation.mutate({ inventoryId, acceptingOffers, minimumOffer })
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminJwStoneOffersPage() {
  const [activeTab, setActiveTab] = useState("queue");

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Restricted operator tool
          </Badge>
          <Badge variant="secondary">JW Stone</Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Private offers and containers
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
          Review masked private offers, manage real offer targets, and inspect recorded notification
          state. The server evaluates authority for every read and action.
        </p>
      </header>

      <Alert>
        <Eye className="h-4 w-4" />
        <AlertTitle>Contact remains sealed until an audited review succeeds</AlertTitle>
        <AlertDescription>
          Accept and reveal are separate actions. Accepting continues a private commercial
          conversation only; it does not create payment, reservation, title transfer, or a sale.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto" aria-label="JW Stone operator areas">
          <TabsTrigger value="queue" data-testid="offers-tab" className="flex-1 sm:flex-none">
            Offer queue
          </TabsTrigger>
          <TabsTrigger
            value="containers"
            data-testid="containers-tab"
            className="flex-1 sm:flex-none"
          >
            Containers
          </TabsTrigger>
          <TabsTrigger value="stones" data-testid="stones-tab" className="flex-1 sm:flex-none">
            Stone settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-5">
          <OfferQueuePanel />
        </TabsContent>
        <TabsContent value="containers" className="mt-5">
          <ContainersPanel />
        </TabsContent>
        <TabsContent value="stones" className="mt-5">
          <StoneSettingsPanel />
        </TabsContent>
      </Tabs>

      <footer className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Queue masking, contact reveal, priority, target eligibility, mutations, and notification
          truth all remain server-owned. This interface does not grant authority by rendering a
          control.
        </p>
      </footer>
    </main>
  );
}
