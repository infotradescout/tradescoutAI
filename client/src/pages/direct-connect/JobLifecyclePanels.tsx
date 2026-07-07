import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardContent className="p-4 text-sm text-[color:var(--text-secondary)]">{label}</CardContent>
    </Card>
  );
}

type ScheduleProposal = {
  scheduleProposalId: string;
  jobWorkspaceId: string;
  proposedStart: string | null;
  proposedEnd: string | null;
  timeWindow: string | null;
  notes: string | null;
  status: "proposed" | "accepted" | "change_requested" | "declined";
};

export function ReviewSchedulePanel({
  jobWorkspaceId,
  scheduleProposalId,
}: {
  jobWorkspaceId: string;
  scheduleProposalId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: proposal, isLoading } = useQuery<ScheduleProposal>({
    queryKey: [
      "/api/direct-connect/jobs",
      jobWorkspaceId,
      "schedule-proposals",
      scheduleProposalId,
    ],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/direct-connect/jobs/${jobWorkspaceId}/schedule-proposals/${scheduleProposalId}`
      ),
  });

  const respondMutation = useMutation({
    mutationFn: (decision: "accept" | "request_changes" | "decline") =>
      apiRequest(
        "POST",
        `/api/direct-connect/jobs/${jobWorkspaceId}/schedule-proposals/${scheduleProposalId}/respond`,
        { decision, note: note.trim() || undefined }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "/api/direct-connect/jobs",
          jobWorkspaceId,
          "schedule-proposals",
          scheduleProposalId,
        ],
      });
      toast({ title: "Response sent" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send response",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <LoadingCard label="Loading schedule..." />;
  if (!proposal) return null;

  const canRespond = proposal.status === "proposed";
  const start = proposal.proposedStart ? new Date(proposal.proposedStart) : null;
  const end = proposal.proposedEnd ? new Date(proposal.proposedEnd) : null;

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Proposed schedule</CardTitle>
          <Badge variant="outline">{proposal.status.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {start && (
          <p className="text-sm">
            {start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            {end
              ? ` – ${end.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
              : ""}
          </p>
        )}
        {proposal.timeWindow && (
          <p className="text-sm text-[color:var(--text-secondary)]">{proposal.timeWindow}</p>
        )}
        {proposal.notes && (
          <p className="text-sm text-[color:var(--text-secondary)]">{proposal.notes}</p>
        )}
        {canRespond && (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="min-h-[70px]"
            />
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => respondMutation.mutate("accept")}
                disabled={respondMutation.isPending}
                className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
              >
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("request_changes")}
                disabled={respondMutation.isPending}
              >
                Request changes
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("decline")}
                disabled={respondMutation.isPending}
              >
                Decline
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ReviewCompletionPanel({ jobWorkspaceId }: { jobWorkspaceId: string }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [responded, setResponded] = useState<"confirm" | "reject" | null>(null);

  const respondMutation = useMutation({
    mutationFn: (decision: "confirm" | "reject") =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/completion-request/respond`, {
        decision,
        requesterNotes: note.trim() || undefined,
      }),
    onSuccess: (_data, decision) => {
      setResponded(decision);
      toast({ title: decision === "confirm" ? "Completion confirmed" : "Completion rejected" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send response",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <CardTitle className="text-base">Business marked this job complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {responded ? (
          <p
            className={
              responded === "confirm" ? "text-sm text-emerald-400" : "text-sm text-rose-400"
            }
          >
            {responded === "confirm" ? "Completion confirmed." : "Completion rejected."}
          </p>
        ) : (
          <>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Confirm if the work is done, or reject if it still needs attention.
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="min-h-[70px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => respondMutation.mutate("confirm")}
                disabled={respondMutation.isPending}
                className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
              >
                Confirm complete
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("reject")}
                disabled={respondMutation.isPending}
              >
                Not done yet
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type InvoiceLine = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  unitAmount: number;
  totalAmount: number;
};

type InvoiceDetail = {
  invoiceId: string;
  jobWorkspaceId: string;
  title: string;
  summary: string;
  status: "draft" | "sent" | "acknowledged" | "disputed" | "paid_outside_platform" | "void";
  totalDue: number;
  lineItems: InvoiceLine[];
};

export function CreateInvoicePanel({ jobWorkspaceId }: { jobWorkspaceId: string }) {
  const { toast } = useToast();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [lineDraft, setLineDraft] = useState({
    name: "",
    quantity: "1",
    unit: "each",
    unitAmount: "",
  });
  const [lines, setLines] = useState<
    Array<{ name: string; quantity: number; unit: string; unitAmount: number }>
  >([]);
  const [sent, setSent] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/invoices`, {
        title: title.trim(),
        summary: summary.trim(),
      }),
    onSuccess: (data: any) => setInvoiceId(data.invoiceId),
    onError: (error: any) => {
      toast({
        title: "Could not start invoice",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);

  const saveLinesMutation = useMutation({
    mutationFn: () => {
      if (!invoiceId) throw new Error("Create the invoice first");
      return apiRequest(
        "PATCH",
        `/api/direct-connect/jobs/${jobWorkspaceId}/invoices/${invoiceId}`,
        {
          lineItems: lines.map((line) => ({
            type: "other",
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            unitAmount: line.unitAmount,
          })),
        }
      );
    },
    onError: (error: any) => {
      toast({
        title: "Could not save line items",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Create the invoice first");
      await saveLinesMutation.mutateAsync();
      return apiRequest(
        "POST",
        `/api/direct-connect/jobs/${jobWorkspaceId}/invoices/${invoiceId}/send`,
        {}
      );
    },
    onSuccess: () => {
      setSent(true);
      toast({ title: "Invoice sent" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send invoice",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <CardTitle className="text-base">Create invoice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <p className="text-sm text-emerald-400">Invoice sent.</p>
        ) : !invoiceId ? (
          <>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Invoice title"
            />
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summary of completed work"
              className="min-h-[100px]"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending || title.trim().length < 2 || summary.trim().length < 3
              }
            >
              Start invoice
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {line.name} ({line.quantity} {line.unit})
                  </span>
                  <span>{formatMoney(line.quantity * line.unitAmount)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={lineDraft.name}
                onChange={(e) => setLineDraft((c) => ({ ...c, name: e.target.value }))}
                placeholder="Item name"
                className="col-span-2"
              />
              <Input
                value={lineDraft.quantity}
                onChange={(e) => setLineDraft((c) => ({ ...c, quantity: e.target.value }))}
                placeholder="Qty"
                type="number"
              />
              <Input
                value={lineDraft.unitAmount}
                onChange={(e) => setLineDraft((c) => ({ ...c, unitAmount: e.target.value }))}
                placeholder="Amount"
                type="number"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setLines((current) => [
                  ...current,
                  {
                    name: lineDraft.name.trim(),
                    quantity: Number(lineDraft.quantity) || 1,
                    unit: lineDraft.unit.trim() || "each",
                    unitAmount: Number(lineDraft.unitAmount) || 0,
                  },
                ]);
                setLineDraft({ name: "", quantity: "1", unit: "each", unitAmount: "" });
              }}
              disabled={lineDraft.name.trim().length < 2}
            >
              Add line item
            </Button>
            <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-semibold">{formatMoney(total)}</span>
            </div>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || lines.length === 0}
              className="w-full bg-ts-orange text-text-black hover:bg-ts-orange/90"
            >
              Send invoice to requester
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ReviewInvoicePanel({
  jobWorkspaceId,
  invoiceId,
}: {
  jobWorkspaceId: string;
  invoiceId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: invoice, isLoading } = useQuery<InvoiceDetail>({
    queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, "invoices", invoiceId],
    queryFn: () =>
      apiRequest("GET", `/api/direct-connect/jobs/${jobWorkspaceId}/invoices/${invoiceId}`),
  });

  const respondMutation = useMutation({
    mutationFn: (decision: "acknowledge" | "dispute" | "mark_paid_outside_platform") =>
      apiRequest(
        "POST",
        `/api/direct-connect/jobs/${jobWorkspaceId}/invoices/${invoiceId}/respond`,
        {
          decision,
          note: note.trim() || undefined,
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, "invoices", invoiceId],
      });
      toast({ title: "Response sent" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send response",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <LoadingCard label="Loading invoice..." />;
  if (!invoice) return null;

  const canRespond = invoice.status === "sent";

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{invoice.title}</CardTitle>
          <Badge variant="outline">{invoice.status.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[color:var(--text-secondary)]">{invoice.summary}</p>
        <div className="space-y-1.5">
          {invoice.lineItems.map((line) => (
            <div key={line.id} className="flex justify-between text-sm">
              <span>
                {line.name} ({line.quantity} {line.unit})
              </span>
              <span>{formatMoney(line.totalAmount)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-3">
          <span className="text-sm font-semibold">Total due</span>
          <span className="text-sm font-semibold">{formatMoney(invoice.totalDue)}</span>
        </div>
        {canRespond && (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="min-h-[70px]"
            />
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => respondMutation.mutate("acknowledge")}
                disabled={respondMutation.isPending}
                className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
              >
                Acknowledge
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("mark_paid_outside_platform")}
                disabled={respondMutation.isPending}
              >
                Mark paid
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("dispute")}
                disabled={respondMutation.isPending}
              >
                Dispute
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const PAYMENT_TYPES = ["deposit", "prepayment", "milestone", "final", "other"] as const;

export function CreatePaymentRequestPanel({
  jobWorkspaceId,
  estimateId,
}: {
  jobWorkspaceId: string;
  estimateId: string;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<(typeof PAYMENT_TYPES)[number]>("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/payment-requests`, {
        estimateId,
        type,
        amount: Number(amount),
        description: description.trim(),
      }),
    onSuccess: () => {
      setSent(true);
      toast({ title: "Payment request sent" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send payment request",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <CardTitle className="text-base">Request deposit or payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <p className="text-sm text-emerald-400">Payment request sent.</p>
        ) : (
          <>
            <Select
              value={type}
              onValueChange={(v) => setType(v as (typeof PAYMENT_TYPES)[number])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              type="number"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this payment for?"
              className="min-h-[80px]"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !amount ||
                Number(amount) <= 0 ||
                description.trim().length < 3
              }
              className="w-full bg-ts-orange text-text-black hover:bg-ts-orange/90"
            >
              Send payment request
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type PaymentRequestDetail = {
  paymentRequestId: string;
  type: string;
  amount: number;
  description: string;
  status: "sent" | "acknowledged" | "paid_outside_platform" | "waived" | "declined";
};

export function ReviewPaymentRequestPanel({
  jobWorkspaceId,
  paymentRequestId,
}: {
  jobWorkspaceId: string;
  paymentRequestId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: paymentRequest, isLoading } = useQuery<PaymentRequestDetail>({
    queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, "payment-requests", paymentRequestId],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/direct-connect/jobs/${jobWorkspaceId}/payment-requests/${paymentRequestId}`
      ),
  });

  const respondMutation = useMutation({
    mutationFn: (decision: "acknowledge" | "paid_outside_platform" | "waive" | "decline") =>
      apiRequest(
        "POST",
        `/api/direct-connect/jobs/${jobWorkspaceId}/payment-requests/${paymentRequestId}/respond`,
        { decision, note: note.trim() || undefined }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "/api/direct-connect/jobs",
          jobWorkspaceId,
          "payment-requests",
          paymentRequestId,
        ],
      });
      toast({ title: "Response sent" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send response",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <LoadingCard label="Loading payment request..." />;
  if (!paymentRequest) return null;

  const canRespond = paymentRequest.status === "sent";

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {paymentRequest.type.charAt(0).toUpperCase() + paymentRequest.type.slice(1)} requested
          </CardTitle>
          <Badge variant="outline">{paymentRequest.status.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[color:var(--text-secondary)]">{paymentRequest.description}</p>
        <p className="text-lg font-semibold">{formatMoney(paymentRequest.amount)}</p>
        {canRespond && (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="min-h-[70px]"
            />
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => respondMutation.mutate("acknowledge")}
                disabled={respondMutation.isPending}
                className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
              >
                Acknowledge
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("paid_outside_platform")}
                disabled={respondMutation.isPending}
              >
                Mark paid
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("decline")}
                disabled={respondMutation.isPending}
              >
                Decline
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type Checkpoint = {
  checkpointId: string;
  title: string;
  status: string;
};

type ChangeOrder = {
  changeOrderId: string;
  title: string;
  scopeChangeSummary: string;
  totalDelta: number;
  status: string;
};

type PunchItem = {
  punchItemId: string;
  title: string;
  status: string;
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline">{status.replace(/_/g, " ")}</Badge>;
}

/**
 * Checkpoints, change orders, and punch list items are open-ended, multi-item
 * lists (either party can add to them over time) rather than a single next
 * step -- so unlike the estimate/schedule/invoice panels, this renders
 * whenever a job workspace exists instead of being gated to one ?action=.
 */
export function WorkTrackingPanel({
  jobWorkspaceId,
  viewerRole,
}: {
  jobWorkspaceId: string;
  viewerRole: "requester" | "provider";
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = (key: string) =>
    queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, key] });

  const onError = (title: string) => (error: any) =>
    toast({
      title,
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    });

  const { data: checkpointsData } = useQuery<{ checkpoints: Checkpoint[] }>({
    queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, "checkpoints"],
    queryFn: () => apiRequest("GET", `/api/direct-connect/jobs/${jobWorkspaceId}/checkpoints`),
  });
  const [checkpointTitle, setCheckpointTitle] = useState("");
  const createCheckpoint = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/checkpoints`, {
        title: checkpointTitle.trim(),
      }),
    onSuccess: () => {
      setCheckpointTitle("");
      invalidate("checkpoints");
    },
    onError: onError("Could not add checkpoint"),
  });
  const respondCheckpoint = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approve" | "report_issue" }) =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/checkpoints/${id}/respond`, {
        decision,
      }),
    onSuccess: () => invalidate("checkpoints"),
    onError: onError("Could not respond to checkpoint"),
  });

  const { data: changeOrdersData } = useQuery<{ changeOrders: ChangeOrder[] }>({
    queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, "change-orders"],
    queryFn: () => apiRequest("GET", `/api/direct-connect/jobs/${jobWorkspaceId}/change-orders`),
  });
  const [changeOrderTitle, setChangeOrderTitle] = useState("");
  const [changeOrderSummary, setChangeOrderSummary] = useState("");
  const createChangeOrder = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/change-orders`, {
        title: changeOrderTitle.trim(),
        scopeChangeSummary: changeOrderSummary.trim(),
      }),
    onSuccess: () => {
      setChangeOrderTitle("");
      setChangeOrderSummary("");
      invalidate("change-orders");
    },
    onError: onError("Could not create change order"),
  });
  const respondChangeOrder = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "approve" | "decline" | "request_changes";
    }) =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/change-orders/${id}/respond`, {
        decision,
      }),
    onSuccess: () => invalidate("change-orders"),
    onError: onError("Could not respond to change order"),
  });

  const { data: punchData } = useQuery<{ punchListItems: PunchItem[] }>({
    queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, "punch-list-items"],
    queryFn: () => apiRequest("GET", `/api/direct-connect/jobs/${jobWorkspaceId}/punch-list-items`),
  });
  const [punchTitle, setPunchTitle] = useState("");
  const createPunchItem = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/punch-list-items`, {
        title: punchTitle.trim(),
      }),
    onSuccess: () => {
      setPunchTitle("");
      invalidate("punch-list-items");
    },
    onError: onError("Could not add punch list item"),
  });
  const respondPunchItem = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "approve_resolved" | "reject_resolved" | "waive_item";
    }) =>
      apiRequest(
        "POST",
        `/api/direct-connect/jobs/${jobWorkspaceId}/punch-list-items/${id}/respond`,
        { decision }
      ),
    onSuccess: () => invalidate("punch-list-items"),
    onError: onError("Could not respond to punch list item"),
  });

  const checkpoints = checkpointsData?.checkpoints || [];
  const changeOrders = changeOrdersData?.changeOrders || [];
  const punchItems = punchData?.punchListItems || [];

  if (
    checkpoints.length === 0 &&
    changeOrders.length === 0 &&
    punchItems.length === 0 &&
    viewerRole !== "provider"
  ) {
    return null;
  }

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <CardTitle className="text-base">Work tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Checkpoints</p>
          {checkpoints.map((cp) => (
            <div key={cp.checkpointId} className="flex items-center justify-between text-sm">
              <span>{cp.title}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={cp.status} />
                {viewerRole === "requester" && cp.status === "requester_review" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        respondCheckpoint.mutate({ id: cp.checkpointId, decision: "approve" })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        respondCheckpoint.mutate({
                          id: cp.checkpointId,
                          decision: "report_issue",
                        })
                      }
                    >
                      Report issue
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {viewerRole === "provider" && (
            <div className="flex gap-2">
              <Input
                value={checkpointTitle}
                onChange={(e) => setCheckpointTitle(e.target.value)}
                placeholder="New checkpoint"
              />
              <Button
                variant="outline"
                onClick={() => createCheckpoint.mutate()}
                disabled={createCheckpoint.isPending || checkpointTitle.trim().length < 2}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-[color:var(--border-subtle)] pt-4">
          <p className="text-sm font-semibold">Change orders</p>
          {changeOrders.map((co) => (
            <div key={co.changeOrderId} className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {co.title} ({formatMoney(co.totalDelta)})
                </span>
                <StatusBadge status={co.status} />
              </div>
              <p className="text-xs text-[color:var(--text-secondary)]">{co.scopeChangeSummary}</p>
              {viewerRole === "requester" && co.status === "sent" && (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      respondChangeOrder.mutate({ id: co.changeOrderId, decision: "approve" })
                    }
                    className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      respondChangeOrder.mutate({
                        id: co.changeOrderId,
                        decision: "request_changes",
                      })
                    }
                  >
                    Request changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      respondChangeOrder.mutate({ id: co.changeOrderId, decision: "decline" })
                    }
                  >
                    Decline
                  </Button>
                </div>
              )}
            </div>
          ))}
          {viewerRole === "provider" && (
            <div className="space-y-2">
              <Input
                value={changeOrderTitle}
                onChange={(e) => setChangeOrderTitle(e.target.value)}
                placeholder="Change order title"
              />
              <Textarea
                value={changeOrderSummary}
                onChange={(e) => setChangeOrderSummary(e.target.value)}
                placeholder="What's changing in scope?"
                className="min-h-[70px]"
              />
              <Button
                variant="outline"
                onClick={() => createChangeOrder.mutate()}
                disabled={
                  createChangeOrder.isPending ||
                  changeOrderTitle.trim().length < 2 ||
                  changeOrderSummary.trim().length < 5
                }
              >
                Send change order
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-[color:var(--border-subtle)] pt-4">
          <p className="text-sm font-semibold">Punch list</p>
          {punchItems.map((item) => (
            <div key={item.punchItemId} className="flex items-center justify-between text-sm">
              <span>{item.title}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={item.status} />
                {viewerRole === "requester" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        respondPunchItem.mutate({
                          id: item.punchItemId,
                          decision: "approve_resolved",
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        respondPunchItem.mutate({
                          id: item.punchItemId,
                          decision: "waive_item",
                        })
                      }
                    >
                      Waive
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={punchTitle}
              onChange={(e) => setPunchTitle(e.target.value)}
              placeholder="New punch list item"
            />
            <Button
              variant="outline"
              onClick={() => createPunchItem.mutate()}
              disabled={createPunchItem.isPending || punchTitle.trim().length < 2}
            >
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
