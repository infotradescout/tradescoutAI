import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { Link } from "wouter";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
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

type ProcurementOrder = {
  id: string;
  order_number?: string | null;
  order_type?: ProcurementMode | string | null;
  status: ProcurementOrderStatus | string;
  source_channel?: string | null;
  fulfillment_workspace_name?: string | null;
  fulfillmentworkspacename?: string | null;
  delivery_address?: string | null;
  pickup_address?: string | null;
  preferred_supplier_name?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  urgency?: ProcurementUrgency | string | null;
  vehicle_type?: ProcurementVehicleType | string | null;
  quoted_total_cents?: number | null;
  approved_total_cents?: number | null;
  budget_limit_cents?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  eta?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
};

type ProcurementOrdersResponse = {
  orders: ProcurementOrder[];
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

const activeFulfillmentStatuses = new Set<string>([
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
]);

const closedStatuses = new Set<string>(["completed", "cancelled", "failed", "refunded"]);

function readable(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "Not recorded";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(cents?: number | null): string {
  if (cents == null) return "Not recorded";
  return (Number(cents) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function sourceLabel(source?: string | null): string {
  if (source === "tradescout_supply_run") return "TradeScout Supply Run";
  if (source === "grunt_direct_ordering") return "Grunt direct order";
  if (source === "admin_created") return "Created by admin";
  if (source === "repeat_order") return "Repeat order";
  return readable(source || "order");
}

function fulfillmentLabel(order: ProcurementOrder): string {
  return (
    order.fulfillment_workspace_name ||
    order.fulfillmentworkspacename ||
    "Waiting for assignment"
  );
}

function StatusBadge({ status }: { status: ProcurementOrder["status"] }) {
  const normalized = String(status || "");
  if (normalized === "completed") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Completed
      </Badge>
    );
  }
  if (closedStatuses.has(normalized)) {
    return (
      <Badge className="border-red-400/25 bg-red-400/10 text-red-100">
        {procurementStatusLabels[normalized as ProcurementOrderStatus] || readable(normalized)}
      </Badge>
    );
  }
  if (normalized === "needs_review" || normalized === "quote_pending") {
    return (
      <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
        {procurementStatusLabels[normalized as ProcurementOrderStatus] || readable(normalized)}
      </Badge>
    );
  }
  if (activeFulfillmentStatuses.has(normalized)) {
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

export default function AdminProcurementPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sourceChannel, setSourceChannel] = useState("all");
  const [fulfillmentWorkspace, setFulfillmentWorkspace] = useState("all");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (sourceChannel !== "all") params.set("sourceChannel", sourceChannel);
    if (fulfillmentWorkspace !== "all") {
      params.set("fulfillmentWorkspace", fulfillmentWorkspace);
    }
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [fulfillmentWorkspace, sourceChannel, status]);

  const ordersQuery = useQuery<ProcurementOrdersResponse>({
    queryKey: ["/api/procurement/orders", query],
    queryFn: () =>
      apiRequest("GET", `/api/procurement/orders${query}`) as Promise<ProcurementOrdersResponse>,
    retry: false,
  });

  const orders = ordersQuery.data?.orders || [];
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) =>
      [
        order.order_number,
        order.customer_name,
        order.customer_email,
        order.customer_phone,
        order.delivery_address,
        order.pickup_address,
        order.preferred_supplier_name,
        order.id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [orders, search]);

  const summary = useMemo(
    () => ({
      total: orders.length,
      needsReview: orders.filter((order) =>
        ["submitted", "needs_review", "quote_pending"].includes(String(order.status))
      ).length,
      fulfillment: orders.filter((order) => activeFulfillmentStatuses.has(String(order.status)))
        .length,
      closed: orders.filter((order) => closedStatuses.has(String(order.status))).length,
    }),
    [orders]
  );

  return (
    <AdminWorkspace data-testid="admin-procurement-v2">
      <AdminSection
        title="Procurement"
        description="Supply Run and Grunt order intake, quote state, fulfillment assignment, delivery progress, and proof completion. Order writes remain in the existing detail workspace."
        className="pt-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => ordersQuery.refetch()}
              disabled={ordersQuery.isFetching}
              className="border-white/12 bg-transparent text-white/65"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Link href="/admin/procurement/workspaces">
              <Button
                type="button"
                variant="outline"
                className="border-white/12 bg-transparent text-white/65"
              >
                Fulfillment workspaces
              </Button>
            </Link>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Orders returned",
              value: ordersQuery.isError ? "—" : summary.total,
              detail: ordersQuery.isError ? "Order source unavailable" : "Current server-filtered queue",
              tone: ordersQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Needs review",
              value: ordersQuery.isError ? "—" : summary.needsReview,
              detail: "Submitted, review, or quote-pending",
              tone:
                ordersQuery.isError || summary.needsReview > 0 ? "warning" : "good",
            },
            {
              label: "In fulfillment",
              value: ordersQuery.isError ? "—" : summary.fulfillment,
              detail: "Assigned through proof upload",
              tone: ordersQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Closed",
              value: ordersQuery.isError ? "—" : summary.closed,
              detail: "Completed, cancelled, failed, or refunded",
              tone: ordersQuery.isError ? "warning" : "neutral",
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title="Order queue"
        description="Expand an order for customer, supplier, vehicle, route, value, and timing context. Open the detail workspace for quotes, assignment, status, messages, and proof writes."
        className="pt-0"
      >
        <AdminToolbar>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <div className="relative min-w-[15rem] flex-1 md:max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/28" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order, customer, supplier, or address"
                className="border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/28"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[13rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {procurementStatusLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceChannel} onValueChange={setSourceChannel}>
              <SelectTrigger className="w-[13rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="tradescout_supply_run">TradeScout Supply Run</SelectItem>
                <SelectItem value="grunt_direct_ordering">Grunt direct order</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fulfillmentWorkspace} onValueChange={setFulfillmentWorkspace}>
              <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Fulfillment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All fulfillment</SelectItem>
                <SelectItem value="grunt">Grunt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-white/35">
            {filteredOrders.length} of {orders.length} orders
          </span>
        </AdminToolbar>

        {ordersQuery.isLoading ? (
          <QueueLoading label="Loading procurement orders…" />
        ) : ordersQuery.isError ? (
          <QueueUnavailable label="Procurement orders are unavailable. No order state was changed." />
        ) : filteredOrders.length ? (
          <AdminList className="mt-4">
            {filteredOrders.map((order) => (
              <details key={order.id} className="group">
                <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1.1fr)_minmax(12rem,0.65fr)_minmax(10rem,0.55fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">
                        {order.order_number || order.id}
                      </p>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-white/48">
                      {order.customer_name || order.customer_email || "Customer not recorded"}
                    </p>
                    <p className="mt-1 text-xs text-white/30">Created {formatDate(order.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Source
                    </p>
                    <p className="mt-2 text-sm text-white/62">
                      {sourceLabel(order.source_channel)}
                    </p>
                    <p className="mt-1 text-xs text-white/32">
                      {procurementModeLabels[order.order_type as ProcurementMode] ||
                        readable(order.order_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Fulfillment
                    </p>
                    <p className="mt-2 text-sm text-white/62">{fulfillmentLabel(order)}</p>
                    <p className="mt-1 text-xs text-white/32">ETA {formatDate(order.eta)}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/30 transition-transform group-open:rotate-180" />
                </summary>

                <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <DetailBlock
                      label="Delivery"
                      value={order.delivery_address || "Not recorded"}
                    />
                    <DetailBlock
                      label="Pickup"
                      value={order.pickup_address || "Not recorded"}
                    />
                    <DetailBlock
                      label="Preferred supplier"
                      value={order.preferred_supplier_name || "Open sourcing"}
                    />
                    <DetailBlock
                      label="Vehicle"
                      value={
                        procurementVehicleLabels[
                          order.vehicle_type as ProcurementVehicleType
                        ] || readable(order.vehicle_type)
                      }
                    />
                    <DetailBlock
                      label="Urgency"
                      value={
                        procurementUrgencyLabels[order.urgency as ProcurementUrgency] ||
                        readable(order.urgency)
                      }
                    />
                    <DetailBlock
                      label="Quoted total"
                      value={money(order.quoted_total_cents)}
                    />
                    <DetailBlock
                      label="Approved total"
                      value={money(order.approved_total_cents)}
                    />
                    <DetailBlock
                      label="Budget limit"
                      value={money(order.budget_limit_cents)}
                    />
                  </div>
                  <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-xs text-white/35">
                      Updated {formatDate(order.updated_at)}
                    </p>
                    <Link href={`/admin/procurement/${order.id}`}>
                      <Button
                        type="button"
                        className="bg-orange-500 text-black hover:bg-orange-400"
                      >
                        Open order workspace
                      </Button>
                    </Link>
                  </div>
                </div>
              </details>
            ))}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No procurement orders match these filters"
            description="Change the status, source, fulfillment, or search filter."
          />
        )}
      </AdminSection>
    </AdminWorkspace>
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

function QueueLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
      <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function QueueUnavailable({ label }: { label: string }) {
  return (
    <div className="border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
      {label}
    </div>
  );
}
