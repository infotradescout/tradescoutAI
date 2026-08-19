import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminWorkspace,
  AdminWorkspaceSubnav,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import {
  procurementModeLabels,
  procurementStatusLabels,
  procurementUrgencyLabels,
  procurementVehicleLabels,
  type ProcurementMode,
  type ProcurementOrderStatus,
  type ProcurementUrgency,
  type ProcurementVehicleType,
} from "@shared/procurement";

type OrderBundle = {
  order: any;
  items: any[];
  files: any[];
  quotes: any[];
  events: any[];
  proofs: any[];
  messages?: any[];
  supplierQuotes?: any[];
};

type QuoteLineDraft = {
  lineType: string;
  label: string;
  amount: string;
};

type SupplierRequestDraft = {
  supplierName: string;
  supplierEmail: string;
  supplierPhone: string;
  supplierAddress: string;
};

const statusOptions: ProcurementOrderStatus[] = [
  "submitted",
  "needs_review",
  "quote_pending",
  "quote_sent",
  "approved",
  "assigned_to_fulfillment",
  "accepted_by_fulfillment",
  "rejected_by_fulfillment",
  "supplier_confirmed",
  "purchase_pending",
  "purchased",
  "driver_assigned",
  "pickup_started",
  "picked_up",
  "delivery_started",
  "delivered",
  "proof_uploaded",
  "completed",
  "cancelled",
  "failed",
  "refunded",
];

const initialQuoteLines = (): QuoteLineDraft[] => [
  { lineType: "materials_estimate", label: "Materials estimate", amount: "" },
  { lineType: "delivery_fee", label: "Delivery fee", amount: "" },
  { lineType: "service_fee", label: "Service fee", amount: "" },
  { lineType: "contingency_buffer", label: "Contingency buffer", amount: "" },
];

const emptySupplierRequest = (): SupplierRequestDraft => ({
  supplierName: "",
  supplierEmail: "",
  supplierPhone: "",
  supplierAddress: "",
});

function routeId(location: string): string {
  const pathname = (location || "").split(/[?#]/, 1)[0] || "";
  return decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
}

function queryParam(location: string, name: string): string {
  const query = location.includes("?") ? location.split("?")[1]?.split("#")[0] || "" : "";
  return new URLSearchParams(query).get(name) || "";
}

function money(cents?: number | string | null): string {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function readable(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "Not recorded";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function localDateTimeValue(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string | number | Date);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fulfillmentLabel(order: any): string {
  return (
    order?.fulfillmentWorkspaceName ||
    order?.fulfillment_workspace_name ||
    order?.fulfillmentworkspacename ||
    "Waiting for assignment"
  );
}

function sourceLabel(source?: string | null): string {
  if (source === "tradescout_supply_run") return "TradeScout Supply Run";
  if (source === "grunt_direct_ordering") return "Grunt direct order";
  if (source === "admin_created") return "Created by admin";
  if (source === "repeat_order") return "Repeat order";
  return readable(source || "order");
}

function StatusBadge({ status }: { status: ProcurementOrderStatus | string }) {
  const normalized = String(status || "");
  if (normalized === "completed") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Completed
      </Badge>
    );
  }
  if (["cancelled", "failed", "refunded"].includes(normalized)) {
    return (
      <Badge className="border-red-400/25 bg-red-400/10 text-red-100">
        {procurementStatusLabels[normalized as ProcurementOrderStatus] || readable(normalized)}
      </Badge>
    );
  }
  if (["needs_review", "quote_pending"].includes(normalized)) {
    return (
      <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
        {procurementStatusLabels[normalized as ProcurementOrderStatus] || readable(normalized)}
      </Badge>
    );
  }
  if (
    [
      "assigned_to_fulfillment",
      "accepted_by_fulfillment",
      "supplier_confirmed",
      "purchase_pending",
      "purchased",
      "driver_assigned",
      "pickup_started",
      "picked_up",
      "delivery_started",
      "delivered",
      "proof_uploaded",
    ].includes(normalized)
  ) {
    return (
      <Badge className="border-sky-400/25 bg-sky-400/10 text-sky-200">
        {procurementStatusLabels[normalized as ProcurementOrderStatus] || readable(normalized)}
      </Badge>
    );
  }
  return (
    <Badge className="border-white/15 bg-white/5 text-white/52">
      {procurementStatusLabels[normalized as ProcurementOrderStatus] || readable(normalized)}
    </Badge>
  );
}

export default function AdminProcurementDetailPage() {
  const [location] = useLocation();
  const id = useMemo(() => routeId(location), [location]);
  const checkoutSessionId = useMemo(() => queryParam(location, "session_id"), [location]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("overview");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState<ProcurementOrderStatus>("submitted");
  const [eta, setEta] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofType, setProofType] = useState<"receipt" | "pickup" | "delivery">("delivery");
  const [quoteLines, setQuoteLines] = useState<QuoteLineDraft[]>(initialQuoteLines);
  const [supplierRequest, setSupplierRequest] =
    useState<SupplierRequestDraft>(emptySupplierRequest);
  const [supplierResponseUrl, setSupplierResponseUrl] = useState("");
  const [actionError, setActionError] = useState("");
  const [verifiedCheckoutSession, setVerifiedCheckoutSession] = useState("");

  const orderQueryKey = ["/api/procurement/orders", id, "admin"];
  const orderQuery = useQuery<OrderBundle>({
    queryKey: orderQueryKey,
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/procurement/orders/${encodeURIComponent(id)}`
      ) as Promise<OrderBundle>,
    enabled: Boolean(id),
    retry: false,
  });

  const data = orderQuery.data;
  const order = data?.order;
  const latestQuote = Array.isArray(data?.quotes) ? data?.quotes?.[0] : null;
  const items = Array.isArray(data?.items) ? data.items : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const supplierQuotes = Array.isArray(data?.supplierQuotes) ? data.supplierQuotes : [];
  const filesAndProofs = useMemo(
    () => [...(Array.isArray(data?.files) ? data.files : []), ...(Array.isArray(data?.proofs) ? data.proofs : [])],
    [data?.files, data?.proofs]
  );

  const invalidateOrder = () => queryClient.invalidateQueries({ queryKey: orderQueryKey });

  useEffect(() => {
    if (!order?.id) return;
    setDeliveryAddress(String(order.delivery_address || ""));
    setInternalNotes(String(order.internal_notes || ""));
    setStatus((order.status || "submitted") as ProcurementOrderStatus);
    setEta(localDateTimeValue(order.partner_eta || order.eta));
  }, [order?.id]);

  useEffect(() => {
    if (order?.status) setStatus(order.status as ProcurementOrderStatus);
  }, [order?.status]);

  const saveOrderMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/procurement/orders/${id}`, {
        deliveryAddress,
        internalNotes,
      }),
    onSuccess: () => {
      setActionError("");
      invalidateOrder();
      toast({ title: "Order details saved" });
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "The order details were not changed.");
      setActionError(message);
      toast({ title: "Save failed", description: message, variant: "destructive" });
    },
  });

  const quoteMutation = useMutation({
    mutationFn: () => {
      const lines = quoteLines
        .filter((line) => Number(line.amount) > 0)
        .map((line) => ({
          lineType: line.lineType,
          label: line.label,
          amountCents: Math.round(Number(line.amount) * 100),
        }));
      if (!lines.length) throw new Error("Enter at least one quote amount.");
      return apiRequest("POST", `/api/procurement/orders/${id}/quote`, {
        send: true,
        lines,
      });
    },
    onSuccess: () => {
      setActionError("");
      setQuoteLines(initialQuoteLines());
      invalidateOrder();
      toast({ title: "Quote sent" });
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "The quote was not sent.");
      setActionError(message);
      toast({ title: "Quote failed", description: message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/orders/${id}/assign-fulfillment`, {
        workspaceSlug: "grunt",
      }),
    onSuccess: () => {
      setActionError("");
      invalidateOrder();
      toast({ title: "Order sent to Grunt" });
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "The order was not assigned.");
      setActionError(message);
      toast({ title: "Assignment failed", description: message, variant: "destructive" });
    },
  });

  const supplierQuoteMutation = useMutation({
    mutationFn: () => {
      if (!supplierRequest.supplierName.trim()) throw new Error("Supplier name is required.");
      return apiRequest(
        "POST",
        `/api/procurement/orders/${id}/supplier-quotes`,
        supplierRequest
      );
    },
    onSuccess: (result: any) => {
      setActionError("");
      setSupplierResponseUrl(String(result?.responseUrl || ""));
      setSupplierRequest(emptySupplierRequest());
      invalidateOrder();
      toast({ title: "Supplier quote requested" });
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "The supplier request was not sent.");
      setActionError(message);
      toast({ title: "Supplier request failed", description: message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/procurement/orders/${id}/approve`, {}),
    onSuccess: () => {
      setActionError("");
      invalidateOrder();
      toast({ title: "Quote manually approved" });
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "The quote was not approved.");
      setActionError(message);
      toast({ title: "Approval failed", description: message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/orders/${id}/checkout-session`, {}),
    onSuccess: (result: any) => {
      if (result?.url) window.location.href = result.url;
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "Checkout could not be started.");
      setActionError(message);
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
    },
  });

  const verifyCheckoutMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest("POST", `/api/procurement/orders/${id}/verify-checkout`, { sessionId }),
    onSuccess: () => {
      setActionError("");
      invalidateOrder();
      toast({ title: "Checkout verified" });
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "Checkout could not be verified.");
      setActionError(message);
      toast({ title: "Verification failed", description: message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (
      checkoutSessionId &&
      checkoutSessionId !== verifiedCheckoutSession &&
      order?.status === "quote_sent" &&
      !verifyCheckoutMutation.isPending
    ) {
      setVerifiedCheckoutSession(checkoutSessionId);
      verifyCheckoutMutation.mutate(checkoutSessionId);
    }
  }, [checkoutSessionId, order?.status, verifiedCheckoutSession]);

  const updateStatusMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/orders/${id}/status`, {
        status,
        partnerEta: eta ? new Date(eta).toISOString() : null,
      }),
    onSuccess: () => {
      setActionError("");
      invalidateOrder();
      toast({ title: "Fulfillment status updated" });
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "Status and ETA were not changed.");
      setActionError(message);
      toast({ title: "Status update failed", description: message, variant: "destructive" });
    },
  });

  const proofMutation = useMutation({
    mutationFn: async () => {
      if (!proofFile) throw new Error("Choose a proof file first.");
      const uploaded = await uploadPrivateObject(proofFile);
      return apiRequest("POST", `/api/procurement/orders/${id}/proof`, {
        proofType,
        objectKey: uploaded.objectKey,
        fileName: proofFile.name,
      });
    },
    onSuccess: () => {
      setActionError("");
      setProofFile(null);
      invalidateOrder();
      toast({ title: "Proof uploaded" });
    },
    onError: (error: unknown) => {
      const message = formatUserFacingErrorMessage(error, "The proof file was not stored.");
      setActionError(message);
      toast({ title: "Proof upload failed", description: message, variant: "destructive" });
    },
  });

  if (!id) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Order identifier missing"
          description="Return to Procurement and choose an order workspace."
          action={
            <Link href="/admin/procurement">
              <Button variant="outline">Back to Procurement</Button>
            </Link>
          }
        />
      </AdminWorkspace>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <AdminWorkspace>
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/45">
          <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
          Loading procurement order…
        </div>
      </AdminWorkspace>
    );
  }

  if (orderQuery.isError || !data || !order) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Procurement order unavailable"
          description="The order could not be loaded. No quote, assignment, status, proof, or order detail was changed."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => orderQuery.refetch()}>
                Retry
              </Button>
              <Link href="/admin/procurement">
                <Button variant="outline">Back to Procurement</Button>
              </Link>
            </div>
          }
        />
      </AdminWorkspace>
    );
  }

  return (
    <AdminWorkspace data-testid="admin-procurement-order-v2">
      <AdminSection
        title={order.order_number || `Order ${id}`}
        description={`${sourceLabel(order.source_channel)} · ${
          procurementModeLabels[order.order_type as ProcurementMode] || readable(order.order_type)
        } · created ${formatDate(order.created_at)}`}
        className="pt-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => orderQuery.refetch()}
              disabled={orderQuery.isFetching}
              className="border-white/12 bg-transparent text-white/65"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${orderQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Link href="/admin/procurement">
              <Button
                type="button"
                variant="outline"
                className="border-white/12 bg-transparent text-white/65"
              >
                Back to Procurement
              </Button>
            </Link>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Status",
              value: <StatusBadge status={order.status} />,
              detail: `Updated ${formatDate(order.updated_at)}`,
              tone: ["cancelled", "failed", "refunded"].includes(String(order.status))
                ? "danger"
                : "neutral",
            },
            {
              label: "Latest quote",
              value: latestQuote ? money(latestQuote.total_amount_cents) : "Not quoted",
              detail: latestQuote ? `${latestQuote.lines?.length || 0} quote lines` : "No quote stored",
              tone: latestQuote ? "good" : "warning",
            },
            {
              label: "Items",
              value: items.length,
              detail: `${filesAndProofs.length} files and proofs`,
            },
            {
              label: "Fulfillment",
              value: fulfillmentLabel(order),
              detail: `ETA ${formatDate(order.partner_eta || order.eta)}`,
              tone: fulfillmentLabel(order) === "Waiting for assignment" ? "warning" : "good",
            },
          ]}
        />
      </AdminSection>

      {actionError ? (
        <div className="border-y border-red-400/20 bg-red-400/5 px-4 py-4 text-sm text-red-100">
          {actionError}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            {[
              ["overview", "Overview"],
              ["quote", "Quote & Suppliers"],
              ["fulfillment", "Fulfillment"],
              ["evidence", "Evidence"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="overview" className="mt-6 space-y-7">
          <AdminSection
            title="Order context"
            description="Customer, route, supplier preference, vehicle, urgency, and budget evidence stored on this order."
            className="pt-0"
          >
            <div className="grid gap-5 border-y border-white/10 px-3 py-5 sm:px-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailBlock label="Customer" value={order.customer_name || "Not recorded"} />
              <DetailBlock label="Email" value={order.customer_email || "Not recorded"} />
              <DetailBlock label="Phone" value={order.customer_phone || "Not recorded"} />
              <DetailBlock
                label="Urgency"
                value={
                  procurementUrgencyLabels[order.urgency as ProcurementUrgency] ||
                  readable(order.urgency)
                }
              />
              <DetailBlock
                label="Vehicle"
                value={
                  procurementVehicleLabels[order.vehicle_type as ProcurementVehicleType] ||
                  readable(order.vehicle_type)
                }
              />
              <DetailBlock
                label="Preferred supplier"
                value={order.preferred_supplier_name || "Open sourcing"}
              />
              <DetailBlock label="Pickup" value={order.pickup_address || "Not recorded"} />
              <DetailBlock label="Budget limit" value={money(order.budget_limit_cents)} />
            </div>
          </AdminSection>

          <AdminSection
            title="Requested items"
            description="Stored item identity, quantity, supplier snapshot, exact-match rules, and source links."
            className="pt-0"
          >
            {items.length ? (
              <AdminList>
                {items.map((item, index) => (
                  <details key={item.id || `${item.item_name}-${index}`} className="group">
                    <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(10rem,0.5fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{item.item_name || "Unnamed item"}</p>
                        <p className="mt-1 text-sm text-white/48">
                          {item.quantity || 0} {item.unit || "each"}
                          {item.brand_preference ? ` · ${item.brand_preference}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                          Estimated unit
                        </p>
                        <p className="mt-2 text-sm text-white/62">
                          {item.estimated_unit_price_cents
                            ? money(item.estimated_unit_price_cents)
                            : "Not estimated"}
                        </p>
                      </div>
                      <FileText className="h-4 w-4 text-white/30" />
                    </summary>
                    <div className="grid gap-5 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4 md:grid-cols-2 xl:grid-cols-4">
                      <DetailBlock label="Description" value={item.description || "Not recorded"} />
                      <DetailBlock label="SKU" value={item.sku || "Not recorded"} />
                      <DetailBlock
                        label="Match rule"
                        value={item.must_match_exactly ? "Must match exactly" : "Equivalent allowed"}
                      />
                      <DetailBlock
                        label="Substitution"
                        value={item.substitution_allowed === false ? "Not allowed" : "Allowed"}
                      />
                      <DetailBlock
                        label="Supplier host"
                        value={item.supplier_snapshot?.host || "Not recorded"}
                      />
                      <DetailBlock
                        label="Supplier link"
                        value={item.url || "Not recorded"}
                      />
                    </div>
                  </details>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No order items"
                description="This order has no stored item records."
              />
            )}
          </AdminSection>

          <AdminSection
            title="Editable order details"
            description="The existing admin PATCH route owns delivery-address and internal-note updates."
            className="pt-0"
          >
            <div className="grid gap-5 border-y border-white/10 px-3 py-5 sm:px-4 xl:grid-cols-2">
              <Field label="Delivery address">
                <Textarea
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  rows={4}
                  className="border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Internal notes">
                <Textarea
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  rows={4}
                  className="border-white/10 bg-black/20 text-white"
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                onClick={() => saveOrderMutation.mutate()}
                disabled={saveOrderMutation.isPending}
                className="bg-orange-500 text-black hover:bg-orange-400"
              >
                {saveOrderMutation.isPending ? "Saving…" : "Save order details"}
              </Button>
            </div>
          </AdminSection>
        </TabsContent>

        <TabsContent value="quote" className="mt-6 space-y-7">
          <AdminSection
            title="Customer quote"
            description="Current quote evidence and the existing manual approval or checkout path when a quote is awaiting customer approval."
            className="pt-0"
          >
            {latestQuote ? (
              <div className="space-y-4">
                <AdminList>
                  {(Array.isArray(latestQuote.lines) ? latestQuote.lines : []).map((line: any) => (
                    <div
                      key={line.id || `${line.line_type}-${line.label}`}
                      className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4"
                    >
                      <div>
                        <p className="font-semibold text-white">{line.label}</p>
                        <p className="mt-1 text-xs text-white/32">{readable(line.line_type)}</p>
                      </div>
                      <span className="font-semibold text-white/72">{money(line.amount_cents)}</span>
                    </div>
                  ))}
                </AdminList>
                <div className="flex flex-col gap-3 border-y border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-white/30">Total</p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {money(latestQuote.total_amount_cents)}
                    </p>
                  </div>
                  {order.status === "quote_sent" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => approveMutation.mutate()}
                        disabled={approveMutation.isPending}
                        className="border-white/12 bg-transparent text-white/65"
                      >
                        {approveMutation.isPending ? "Approving…" : "Manual approval"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => checkoutMutation.mutate()}
                        disabled={checkoutMutation.isPending}
                        className="bg-orange-500 text-black hover:bg-orange-400"
                      >
                        {checkoutMutation.isPending ? "Starting…" : "Open checkout"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <AdminEmptyState
                title="No customer quote"
                description="Build and send the first quote below."
              />
            )}
          </AdminSection>

          <AdminSection
            title="Quote builder"
            description="Positive line amounts are converted from dollars to cents and sent through the existing quote endpoint."
            className="pt-0"
          >
            <div className="grid gap-4 border-y border-white/10 px-3 py-5 sm:px-4 md:grid-cols-2 xl:grid-cols-4">
              {quoteLines.map((line, index) => (
                <Field key={line.lineType} label={line.label}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount}
                    onChange={(event) =>
                      setQuoteLines((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, amount: event.target.value } : entry
                        )
                      )
                    }
                    className="border-white/10 bg-black/20 text-white"
                  />
                </Field>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                onClick={() => quoteMutation.mutate()}
                disabled={quoteMutation.isPending}
                className="bg-orange-500 text-black hover:bg-orange-400"
              >
                {quoteMutation.isPending ? "Sending…" : "Send quote"}
              </Button>
            </div>
          </AdminSection>

          <AdminSection
            title="Supplier quote requests"
            description="Create the existing supplier response link and inspect stored supplier responses."
            className="pt-0"
          >
            <div className="grid gap-4 border-y border-white/10 px-3 py-5 sm:px-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Supplier name">
                <Input
                  value={supplierRequest.supplierName}
                  onChange={(event) =>
                    setSupplierRequest((current) => ({
                      ...current,
                      supplierName: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Supplier email">
                <Input
                  value={supplierRequest.supplierEmail}
                  onChange={(event) =>
                    setSupplierRequest((current) => ({
                      ...current,
                      supplierEmail: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Supplier phone">
                <Input
                  value={supplierRequest.supplierPhone}
                  onChange={(event) =>
                    setSupplierRequest((current) => ({
                      ...current,
                      supplierPhone: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Supplier address">
                <Input
                  value={supplierRequest.supplierAddress}
                  onChange={(event) =>
                    setSupplierRequest((current) => ({
                      ...current,
                      supplierAddress: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-black/20 text-white"
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {supplierResponseUrl ? (
                <a
                  href={supplierResponseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-sm text-emerald-200 underline underline-offset-4"
                >
                  {supplierResponseUrl}
                </a>
              ) : (
                <span className="text-xs text-white/35">No new response link generated.</span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => supplierQuoteMutation.mutate()}
                disabled={supplierQuoteMutation.isPending || !supplierRequest.supplierName.trim()}
                className="border-white/12 bg-transparent text-white/65"
              >
                {supplierQuoteMutation.isPending ? "Requesting…" : "Request supplier quote"}
              </Button>
            </div>

            <div className="mt-6">
              {supplierQuotes.length ? (
                <AdminList>
                  {supplierQuotes.map((quote: any) => (
                    <div
                      key={quote.id}
                      className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.5fr)_minmax(12rem,0.65fr)] lg:items-center"
                    >
                      <div>
                        <p className="font-semibold text-white">{quote.supplier_name}</p>
                        <p className="mt-1 text-xs text-white/35">
                          {quote.supplier_email || quote.supplier_phone || "Contact not recorded"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">
                          Materials
                        </p>
                        <p className="mt-2 text-sm text-white/62">
                          {quote.material_total_cents
                            ? money(quote.material_total_cents)
                            : "Waiting for price"}
                        </p>
                      </div>
                      <div className="text-sm text-white/52">
                        <p>{readable(quote.status)}</p>
                        <p className="mt-1 text-xs text-white/32">
                          Ready {formatDate(quote.pickup_ready_at)}
                        </p>
                      </div>
                      {quote.availability_summary || quote.supplier_notes ? (
                        <div className="lg:col-span-3 border-t border-white/10 pt-3 text-sm leading-6 text-white/48">
                          {[quote.availability_summary, quote.supplier_notes]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </AdminList>
              ) : (
                <AdminEmptyState
                  title="No supplier quote responses"
                  description="No supplier request or response is stored on this order."
                />
              )}
            </div>
          </AdminSection>
        </TabsContent>

        <TabsContent value="fulfillment" className="mt-6 space-y-7">
          <AdminSection
            title="Fulfillment control"
            description="The existing status route owns order status and partner ETA. Assignment remains scoped to the existing Grunt workspace."
            className="pt-0"
          >
            <div className="grid gap-5 border-y border-white/10 px-3 py-5 sm:px-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailBlock label="Current workspace" value={fulfillmentLabel(order)} />
              <DetailBlock label="Current status" value={readable(order.status)} />
              <DetailBlock label="Current ETA" value={formatDate(order.partner_eta || order.eta)} />
              <DetailBlock label="Delivery address" value={order.delivery_address || "Not recorded"} />
            </div>
            <div className="mt-6 grid gap-4 border-y border-white/10 px-3 py-5 sm:px-4 md:grid-cols-2">
              <Field label="Status">
                <Select value={status} onValueChange={(value) => setStatus(value as ProcurementOrderStatus)}>
                  <SelectTrigger className="border-white/10 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {procurementStatusLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Partner ETA">
                <Input
                  type="datetime-local"
                  value={eta}
                  onChange={(event) => setEta(event.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
                className="border-white/12 bg-transparent text-white/65"
              >
                <Truck className="mr-2 h-4 w-4" />
                {assignMutation.isPending ? "Assigning…" : "Send to Grunt"}
              </Button>
              <Button
                type="button"
                onClick={() => updateStatusMutation.mutate()}
                disabled={updateStatusMutation.isPending}
                className="bg-orange-500 text-black hover:bg-orange-400"
              >
                {updateStatusMutation.isPending ? "Updating…" : "Update status and ETA"}
              </Button>
            </div>
          </AdminSection>

          <AdminSection
            title="Upload fulfillment proof"
            description="The file is stored through the existing private-object upload path before the proof record is created."
            className="pt-0"
          >
            <div className="grid gap-4 border-y border-white/10 px-3 py-5 sm:px-4 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:items-end">
              <Field label="Proof type">
                <Select
                  value={proofType}
                  onValueChange={(value) =>
                    setProofType(value as "receipt" | "pickup" | "delivery")
                  }
                >
                  <SelectTrigger className="border-white/10 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="pickup">Pickup proof</SelectItem>
                    <SelectItem value="delivery">Delivery proof</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Private file">
                <Input
                  type="file"
                  onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                  className="border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                onClick={() => proofMutation.mutate()}
                disabled={proofMutation.isPending || !proofFile}
                className="border-white/12 bg-transparent text-white/65"
              >
                {proofMutation.isPending ? "Uploading…" : "Upload proof"}
              </Button>
            </div>
          </AdminSection>
        </TabsContent>

        <TabsContent value="evidence" className="mt-6 space-y-7">
          <div className="grid gap-7 xl:grid-cols-2">
            <AdminSection
              title="Order timeline"
              description="Stored status events in server order."
              className="pt-0"
            >
              {events.length ? (
                <AdminList>
                  {events.map((event: any) => (
                    <div key={event.id} className="px-3 py-4 sm:px-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-white">
                          {procurementStatusLabels[event.status as ProcurementOrderStatus] ||
                            readable(event.status)}
                        </p>
                        <span className="text-xs text-white/32">
                          {formatDate(event.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/52">
                        {event.message || "No event message recorded."}
                      </p>
                    </div>
                  ))}
                </AdminList>
              ) : (
                <AdminEmptyState
                  title="No order events"
                  description="No status timeline record exists for this order."
                />
              )}
            </AdminSection>

            <AdminSection
              title="Files and proofs"
              description="Private downloads remain protected by the existing order file route."
              className="pt-0"
            >
              {filesAndProofs.length ? (
                <AdminList>
                  {filesAndProofs.map((file: any) => (
                    <a
                      key={file.id}
                      href={`/api/procurement/orders/${id}/files/${file.id}/download`}
                      className="grid gap-2 px-3 py-3 transition hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                    >
                      <div>
                        <p className="font-semibold text-white">
                          {file.file_name || `${readable(file.proof_type)} proof`}
                        </p>
                        <p className="mt-1 text-xs text-white/32">
                          {file.file_type || readable(file.proof_type)}
                        </p>
                      </div>
                      <FileText className="h-4 w-4 text-white/35" />
                    </a>
                  ))}
                </AdminList>
              ) : (
                <AdminEmptyState
                  title="No files or proofs"
                  description="No private order evidence is stored."
                />
              )}
            </AdminSection>
          </div>

          <AdminSection
            title="Order messages"
            description="Read-only message evidence attached to this order and governed by the existing order access rules."
            className="pt-0"
          >
            {messages.length ? (
              <AdminList>
                {messages.map((message: any) => (
                  <div key={message.id} className="px-3 py-4 sm:px-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge className="border-white/15 bg-white/5 text-white/52">
                        {message.sender_type === "customer" ? "Customer" : "Order team"}
                      </Badge>
                      <span className="text-xs text-white/32">
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/58">
                      {message.body}
                    </p>
                  </div>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No order messages"
                description="No message record is attached to this order."
              />
            )}
          </AdminSection>

          <div className="flex items-center gap-3 border-y border-white/10 px-4 py-4 text-xs text-white/42">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Order evidence remains attached to this procurement record; this page creates no public
            document link.
          </div>
        </TabsContent>
      </Tabs>
    </AdminWorkspace>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-white/42">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
        {label}
      </p>
      <p className="mt-2 break-words text-sm leading-6 text-white/58">{value}</p>
    </div>
  );
}
