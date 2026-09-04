import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { normalizeConversationContext } from "@/components/messages/conversationContextAdapter";
import {
  procurementModeLabels,
  procurementModes,
  procurementStatusLabels,
  procurementUrgencyLabels,
  procurementUrgencies,
  procurementVehicleLabels,
  procurementVehicleTypes,
  type ProcurementMode,
  type ProcurementOrderStatus,
  type ProcurementUrgency,
  type ProcurementVehicleType,
} from "@shared/procurement";

type ItemDraft = {
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  brandPreference: string;
  sku: string;
  url: string;
  photoUrl: string;
  estimatedUnitPriceCents: number | null;
  supplierSnapshot: Record<string, unknown> | null;
  mustMatchExactly: boolean;
  substitutionAllowed: boolean;
};

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

const emptyItem = (): ItemDraft => ({
  itemName: "",
  description: "",
  quantity: 1,
  unit: "each",
  brandPreference: "",
  sku: "",
  url: "",
  photoUrl: "",
  estimatedUnitPriceCents: null,
  supplierSnapshot: null,
  mustMatchExactly: false,
  substitutionAllowed: true,
});

function money(cents?: number | null) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function sourceLabel(source?: string | null) {
  switch (source) {
    case "tradescout_supply_run":
      return "Supply Run";
    case "grunt_direct_ordering":
      return "Grunt direct order";
    case "admin_created":
      return "Created by admin";
    case "repeat_order":
      return "Repeat order";
    default:
      return "Order";
  }
}

function fulfillmentLabel(order: any) {
  return (
    order.fulfillmentWorkspaceName || order.fulfillmentworkspacename || "Waiting for assignment"
  );
}

function getIdFromPath() {
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  return decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
}

function getOrderToken() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") || "";
}

function getSupplyRunPrefill() {
  if (typeof window === "undefined") return { supplierUrl: "", itemName: "", notes: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    supplierUrl: params.get("supplierUrl") || params.get("url") || "",
    itemName: params.get("itemName") || params.get("material") || "",
    notes: params.get("notes") || "",
  };
}

function Shell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <main className="min-h-full text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow ? (
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
                {eyebrow}
              </div>
            ) : null}
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          </div>
          {action}
        </div>
        {children}
      </div>
    </main>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-white/10 bg-white/[0.04] p-4 ${className}`}>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-neutral-200">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400";

function StatusBadge({ status }: { status: ProcurementOrderStatus }) {
  return (
    <span className="rounded-full border border-orange-400/40 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-200">
      {procurementStatusLabels[status] || status}
    </span>
  );
}

function useOrders(query = "") {
  return useQuery({
    queryKey: ["/api/procurement/orders", query],
    queryFn: () => apiRequest("GET", `/api/procurement/orders${query}`),
  });
}

function useOrder(id: string) {
  const token = getOrderToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return useQuery<OrderBundle>({
    queryKey: ["/api/procurement/orders", id, token],
    queryFn: () => apiRequest("GET", `/api/procurement/orders/${encodeURIComponent(id)}${query}`),
    enabled: Boolean(id),
  });
}

function OrderList({ orders, basePath }: { orders: any[]; basePath: string }) {
  if (!orders.length) {
    return (
      <Card>
        <p className="text-sm text-neutral-300">No orders yet.</p>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <Link key={order.id} href={`${basePath}/${order.id}`}>
          <Card className="cursor-pointer transition hover:border-orange-400/50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-bold">{order.order_number}</div>
                <div className="text-sm text-neutral-300">
                  {procurementModeLabels[order.order_type as ProcurementMode] || order.order_type} ·{" "}
                  {order.delivery_address}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {sourceLabel(order.source_channel)} · {fulfillmentLabel(order)}
                </div>
              </div>
              <StatusBadge status={order.status as ProcurementOrderStatus} />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function OrderForm({ mode }: { mode: "tradescout" | "grunt" }) {
  const [, navigate] = useLocation();
  const prefill = useMemo(() => getSupplyRunPrefill(), []);
  const [orderType, setOrderType] = useState<ProcurementMode>("buy_deliver");
  const [urgency, setUrgency] = useState<ProcurementUrgency>("flexible");
  const [vehicleType, setVehicleType] = useState<ProcurementVehicleType>("unsure");
  const [items, setItems] = useState<ItemDraft[]>(() => [
    {
      ...emptyItem(),
      itemName: prefill.itemName,
      url: prefill.supplierUrl,
    },
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [resolvingItemIndex, setResolvingItemIndex] = useState<number | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    preferredSupplierName: "",
    preferredSupplierAddress: "",
    pickupAddress: "",
    deliveryAddress: "",
    notes: prefill.notes,
    budgetLimitCents: "",
  });
  const [error, setError] = useState("");

  const resolveItemLink = async (index: number) => {
    const item = items[index];
    if (!item?.url.trim()) {
      setError("Paste a supplier product link first.");
      return;
    }
    setError("");
    setResolvingItemIndex(index);
    try {
      const data = await apiRequest("POST", "/api/procurement/products/resolve", {
        url: item.url,
      });
      const product = data?.product || {};
      const next = [...items];
      next[index] = {
        ...item,
        itemName: item.itemName || product.title || "",
        brandPreference: item.brandPreference || product.brand || "",
        sku: item.sku || product.sku || "",
        photoUrl: item.photoUrl || product.imageUrl || "",
        estimatedUnitPriceCents: item.estimatedUnitPriceCents ?? product.priceCents ?? null,
        supplierSnapshot: product,
      };
      setItems(next);
      if (product.status === "unavailable") {
        setError(product.message || "Could not read product details from that link.");
      }
    } catch (err: any) {
      setError(formatUserFacingErrorMessage(err, "Could not read that supplier link."));
    } finally {
      setResolvingItemIndex(null);
    }
  };

  const createOrder = useMutation({
    mutationFn: async () => {
      setError("");
      const uploadedFiles: Array<{
        objectKey: string;
        fileName: string;
        fileType: string;
        fileSize: number;
        filePurpose: string;
      }> = [];
      for (const file of files) {
        const uploaded = await uploadPrivateObject(file);
        uploadedFiles.push({
          objectKey: uploaded.objectKey,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          filePurpose: "source",
        });
      }
      const cleanItems = items
        .map((item) => ({ ...item, itemName: item.itemName.trim() }))
        .filter((item) => item.itemName.length > 0);
      if (!form.deliveryAddress.trim()) throw new Error("Delivery address is required.");
      if (!cleanItems.length) throw new Error("Add at least one item.");
      return apiRequest("POST", "/api/procurement/orders", {
        sourceChannel: mode === "grunt" ? "grunt_direct_ordering" : "tradescout_supply_run",
        orderType,
        urgency,
        vehicleType,
        ...form,
        budgetLimitCents: form.budgetLimitCents
          ? Math.round(Number(form.budgetLimitCents) * 100)
          : null,
        items: cleanItems,
        files: uploadedFiles,
      });
    },
    onSuccess: (data) => {
      const id = data?.order?.id;
      const token = data?.order?.public_access_token;
      navigate(
        mode === "grunt"
          ? `/grunt/order/${id}${token ? `?token=${encodeURIComponent(token)}` : ""}`
          : `/utilities/supply-run/${id}`
      );
    },
    onError: (err: any) =>
      setError(formatUserFacingErrorMessage(err, "Could not submit this order.")),
  });

  const title = mode === "grunt" ? "Get Supplies Delivered" : "Start Supply Run";
  const subtitle =
    mode === "grunt"
      ? "Order from any local store or supplier"
      : "Order materials from anywhere. Fulfilled by Grunt.";

  return (
    <Shell
      title={title}
      eyebrow={mode === "grunt" ? "Grunt Ordering System" : "TradeScout Supply Run"}
    >
      <div className="mb-5 rounded-lg bg-orange-500/10 p-4 text-sm font-semibold text-orange-100">
        {subtitle}
      </div>
      {error ? (
        <div className="mb-4 rounded-md bg-red-500/20 p-3 text-sm text-red-100">{error}</div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg font-bold">What kind of run is this?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {procurementModes.map((modeOption) => (
                <button
                  key={modeOption}
                  type="button"
                  onClick={() => setOrderType(modeOption)}
                  className={`rounded-md border p-3 text-left text-sm font-bold ${
                    orderType === modeOption
                      ? "border-orange-400 bg-orange-500/15 text-orange-100"
                      : "border-white/10 bg-neutral-900 text-neutral-200"
                  }`}
                >
                  {mode === "grunt" && modeOption === "pickup_my_order"
                    ? "Pickup an Existing Order"
                    : modeOption === "help_me_source_it" && mode === "grunt"
                      ? "Request a Quote"
                      : procurementModeLabels[modeOption]}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold">Items</h2>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="rounded-md border border-white/10 bg-neutral-900 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Item name">
                      <input
                        className={inputClass}
                        value={item.itemName}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, itemName: e.target.value };
                          setItems(next);
                        }}
                      />
                    </Field>
                    <Field label="Quantity">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className={inputClass}
                        value={item.quantity}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, quantity: Number(e.target.value) };
                          setItems(next);
                        }}
                      />
                    </Field>
                    <Field label="Unit">
                      <input
                        className={inputClass}
                        value={item.unit}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, unit: e.target.value };
                          setItems(next);
                        }}
                      />
                    </Field>
                    <Field label="Brand preference">
                      <input
                        className={inputClass}
                        value={item.brandPreference}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, brandPreference: e.target.value };
                          setItems(next);
                        }}
                      />
                    </Field>
                    <Field label="SKU">
                      <input
                        className={inputClass}
                        value={item.sku}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, sku: e.target.value };
                          setItems(next);
                        }}
                      />
                    </Field>
                    <Field label="URL">
                      <div className="flex gap-2">
                        <input
                          className={inputClass}
                          value={item.url}
                          onChange={(e) => {
                            const next = [...items];
                            next[index] = {
                              ...item,
                              url: e.target.value,
                              supplierSnapshot: null,
                            };
                            setItems(next);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => resolveItemLink(index)}
                          disabled={resolvingItemIndex === index}
                          className="shrink-0 rounded-md bg-white/10 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {resolvingItemIndex === index ? "Reading..." : "Use Link"}
                        </button>
                      </div>
                    </Field>
                  </div>
                  {item.supplierSnapshot ? (
                    <div className="mt-3 flex gap-3 rounded-md border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                      {item.photoUrl ? (
                        <img
                          src={item.photoUrl}
                          alt=""
                          className="h-14 w-14 rounded-md object-cover"
                        />
                      ) : null}
                      <div>
                        <div className="font-bold">
                          {String(item.supplierSnapshot.host || "Supplier")} snapshot saved
                        </div>
                        <div className="text-emerald-100/80">
                          {item.estimatedUnitPriceCents
                            ? `${money(item.estimatedUnitPriceCents)} estimate`
                            : "Price needs confirmation"}
                          {item.sku ? ` · SKU ${item.sku}` : ""}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <Field label="Description">
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={item.description}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...item, description: e.target.value };
                        setItems(next);
                      }}
                    />
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-200">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.substitutionAllowed}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, substitutionAllowed: e.target.checked };
                          setItems(next);
                        }}
                      />
                      Substitution allowed
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.mustMatchExactly}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, mustMatchExactly: e.target.checked };
                          setItems(next);
                        }}
                      />
                      Must match exactly
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 rounded-md bg-white/10 px-4 py-2 text-sm font-bold"
              onClick={() => setItems([...items, emptyItem()])}
            >
              Add Item
            </button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg font-bold">Details</h2>
            <div className="space-y-3">
              {mode === "grunt" ? (
                <>
                  <Field label="Customer name">
                    <input
                      className={inputClass}
                      value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    />
                  </Field>
                  <Field label="Customer email">
                    <input
                      className={inputClass}
                      value={form.customerEmail}
                      onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    />
                  </Field>
                  <Field label="Customer phone">
                    <input
                      className={inputClass}
                      value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    />
                  </Field>
                </>
              ) : null}
              <Field label="Delivery address">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.deliveryAddress}
                  onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                />
              </Field>
              <Field label="Preferred supplier/store">
                <input
                  className={inputClass}
                  value={form.preferredSupplierName}
                  onChange={(e) => setForm({ ...form, preferredSupplierName: e.target.value })}
                />
              </Field>
              <Field label="Supplier address">
                <input
                  className={inputClass}
                  value={form.preferredSupplierAddress}
                  onChange={(e) => setForm({ ...form, preferredSupplierAddress: e.target.value })}
                />
              </Field>
              <Field label="Pickup location">
                <input
                  className={inputClass}
                  value={form.pickupAddress}
                  onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
                />
              </Field>
              <Field label="Budget limit">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={form.budgetLimitCents}
                  onChange={(e) => setForm({ ...form, budgetLimitCents: e.target.value })}
                />
              </Field>
              <Field label="Urgency">
                <select
                  className={inputClass}
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as ProcurementUrgency)}
                >
                  {procurementUrgencies.map((value) => (
                    <option key={value} value={value}>
                      {procurementUrgencyLabels[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vehicle">
                <select
                  className={inputClass}
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as ProcurementVehicleType)}
                >
                  {procurementVehicleTypes.map((value) => (
                    <option key={value} value={value}>
                      {procurementVehicleLabels[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Receipts, photos, screenshots, or lists">
                <input
                  className={inputClass}
                  type="file"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
            <button
              type="button"
              disabled={createOrder.isPending}
              onClick={() => createOrder.mutate()}
              className="mt-4 w-full rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black disabled:opacity-60"
            >
              {createOrder.isPending
                ? "Submitting..."
                : mode === "grunt"
                  ? "Get Supplies Delivered"
                  : "Order Supplies"}
            </button>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

export function SupplyRunHome() {
  const { data, isLoading, error } = useOrders("?sourceChannel=tradescout_supply_run");
  return (
    <Shell
      title="Supply Run"
      eyebrow="Order Supplies"
      action={
        <Link
          href="/utilities/supply-run/new"
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black"
        >
          Start Supply Run
        </Link>
      }
    >
      <p className="mb-5 text-neutral-300">Order materials from anywhere. Fulfilled by Grunt.</p>
      {isLoading ? (
        <Card>Loading orders...</Card>
      ) : error ? (
        <Card>Could not load supply runs.</Card>
      ) : (
        <OrderList orders={data?.orders || []} basePath="/utilities/supply-run" />
      )}
    </Shell>
  );
}

export function SupplyRunNew() {
  return <OrderForm mode="tradescout" />;
}

export function GruntOrderNew() {
  return <OrderForm mode="grunt" />;
}

export function OrderDetail({
  portal = "tradescout",
}: {
  portal?: "tradescout" | "grunt" | "admin";
}) {
  const id = getIdFromPath();
  const orderToken = getOrderToken();
  const tokenQuery = orderToken ? `?token=${encodeURIComponent(orderToken)}` : "";
  const checkoutSessionId =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("session_id") || "";
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useOrder(id);
  const orderQueryKey = ["/api/procurement/orders", id, orderToken];
  const [status, setStatus] = useState<ProcurementOrderStatus>("submitted");
  const [eta, setEta] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofType, setProofType] = useState<"receipt" | "pickup" | "delivery">("delivery");
  const [actionError, setActionError] = useState("");
  const latestQuote = data?.quotes?.[0];
  const orderContext = normalizeConversationContext(
    {
      kind: "procurement",
      label: "Supply Run",
      title: data?.order?.order_number || "Order messages",
      entityId: id,
    },
    "Order messages"
  );
  const canOperate = portal === "admin" || portal === "grunt";
  const base =
    portal === "grunt"
      ? "/grunt/admin/orders"
      : portal === "admin"
        ? "/admin/procurement"
        : "/utilities/supply-run";

  const approve = useMutation({
    mutationFn: () => apiRequest("POST", `/api/procurement/orders/${id}/approve${tokenQuery}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderQueryKey }),
    onError: (err: any) => setActionError(err?.message || "Could not approve quote."),
  });
  const startCheckout = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/orders/${id}/checkout-session${tokenQuery}`, {}),
    onSuccess: (result) => {
      if (result?.url) window.location.href = result.url;
    },
    onError: (err: any) => setActionError(err?.message || "Could not start checkout."),
  });
  const verifyCheckout = useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest("POST", `/api/procurement/orders/${id}/verify-checkout${tokenQuery}`, {
        sessionId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderQueryKey }),
    onError: (err: any) => setActionError(err?.message || "Could not verify checkout."),
  });
  const updateStatus = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/orders/${id}/status`, {
        status,
        partnerEta: eta || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderQueryKey }),
    onError: (err: any) => setActionError(err?.message || "Could not update status."),
  });
  const acceptRun = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/grunt/orders/${id}/accept`, {
        message: "Grunt accepted the run.",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderQueryKey }),
    onError: (err: any) => setActionError(err?.message || "Could not accept run."),
  });
  const rejectRun = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/grunt/orders/${id}/reject`, {
        message: "Grunt rejected the run.",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderQueryKey }),
    onError: (err: any) => setActionError(err?.message || "Could not reject run."),
  });
  const uploadProof = useMutation({
    mutationFn: async () => {
      if (!proofFile) throw new Error("Choose a file first.");
      const uploaded = await uploadPrivateObject(proofFile);
      return apiRequest("POST", `/api/procurement/orders/${id}/proof`, {
        proofType,
        objectKey: uploaded.objectKey,
        fileName: proofFile.name,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderQueryKey }),
    onError: (err: any) => setActionError(err?.message || "Could not upload proof."),
  });

  useEffect(() => {
    if (data?.order?.status) {
      setStatus(data.order.status as ProcurementOrderStatus);
    }
  }, [data?.order?.status]);

  useEffect(() => {
    if (checkoutSessionId && !verifyCheckout.isPending && data?.order?.status === "quote_sent") {
      verifyCheckout.mutate(checkoutSessionId);
    }
  }, [checkoutSessionId, data?.order?.status]);

  if (isLoading)
    return (
      <Shell title="Order">
        <Card>Loading order...</Card>
      </Shell>
    );
  if (error || !data)
    return (
      <Shell title="Order">
        <Card>Could not load this order.</Card>
      </Shell>
    );

  return (
    <Shell
      title={data.order.order_number}
      eyebrow={portal === "grunt" ? "Grunt Ordering System" : "Supply Run"}
      action={
        <Link href={base} className="rounded-md bg-white/10 px-4 py-2 text-sm font-bold">
          Back
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">
                  {procurementModeLabels[data.order.order_type as ProcurementMode] ||
                    data.order.order_type}
                </h2>
                <p className="text-sm text-neutral-300">{data.order.delivery_address}</p>
              </div>
              <StatusBadge status={data.order.status as ProcurementOrderStatus} />
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>Order path: {sourceLabel(data.order.source_channel)}</div>
              <div>Fulfillment Partner: {fulfillmentLabel(data.order)}</div>
              <div>
                Urgency: {procurementUrgencyLabels[data.order.urgency as ProcurementUrgency]}
              </div>
              <div>
                Vehicle:{" "}
                {procurementVehicleLabels[data.order.vehicle_type as ProcurementVehicleType]}
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">Items</h2>
            <div className="space-y-2">
              {data.items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-md bg-neutral-900 p-3 text-sm">
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt=""
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{item.item_name}</div>
                    <div className="text-neutral-300">
                      {item.quantity} {item.unit || "each"}{" "}
                      {item.brand_preference ? `· ${item.brand_preference}` : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                      {item.sku ? <span>SKU {item.sku}</span> : null}
                      {item.estimated_unit_price_cents ? (
                        <span>{money(item.estimated_unit_price_cents)} est.</span>
                      ) : null}
                      {item.supplier_snapshot?.host ? (
                        <span>{item.supplier_snapshot.host}</span>
                      ) : null}
                      {item.url ? (
                        <a
                          className="text-orange-200"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Supplier link
                        </a>
                      ) : null}
                    </div>
                    {item.description ? (
                      <div className="mt-1 text-neutral-400">{item.description}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">Timeline</h2>
            <div className="space-y-2">
              {data.events.length ? (
                data.events.map((event) => (
                  <div key={event.id} className="rounded-md border border-white/10 p-3 text-sm">
                    <div className="font-bold">
                      {procurementStatusLabels[event.status as ProcurementOrderStatus] ||
                        event.status}
                    </div>
                    <div className="text-neutral-300">{event.message}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {new Date(event.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-400">No events yet.</p>
              )}
            </div>
          </Card>
          <Card data-testid="procurement-order-messages">
            <div className="mb-3">
              <div className="text-xs font-bold uppercase tracking-wide text-orange-300">
                {orderContext.label}
              </div>
              <h2 className="text-lg font-bold">Order messages</h2>
              <p className="text-xs text-neutral-400">
                Updates shown here stay attached to this order and follow its access rules.
              </p>
            </div>
            {data.messages?.length ? (
              <div className="space-y-2">
                {data.messages.map((message) => (
                  <div key={message.id} className="rounded-md border border-white/10 p-3 text-sm">
                    <div className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                      {message.sender_type === "customer" ? "Customer" : "Order team"}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-neutral-200">{message.body}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {new Date(message.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No order messages yet.</p>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          {latestQuote ? (
            <Card>
              <h2 className="mb-3 text-lg font-bold">Quote</h2>
              {actionError ? (
                <div className="mb-3 rounded-md bg-red-500/20 p-2 text-sm text-red-100">
                  {actionError}
                </div>
              ) : null}
              {latestQuote.lines.map((line: any) => (
                <div
                  key={line.id}
                  className="flex justify-between border-b border-white/10 py-2 text-sm"
                >
                  <span>{line.label}</span>
                  <span>{money(line.amount_cents)}</span>
                </div>
              ))}
              <div className="mt-3 flex justify-between text-lg font-black">
                <span>Total</span>
                <span>{money(latestQuote.total_amount_cents)}</span>
              </div>
              {data.order.status === "quote_sent" ? (
                <div className="mt-4 grid gap-2">
                  <button
                    onClick={() => startCheckout.mutate()}
                    disabled={startCheckout.isPending}
                    className="w-full rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black disabled:opacity-60"
                  >
                    {startCheckout.isPending ? "Starting Checkout..." : "Pay Quote"}
                  </button>
                  <button
                    onClick={() => approve.mutate()}
                    disabled={approve.isPending}
                    className="w-full rounded-md bg-white/10 px-4 py-2 text-sm font-bold"
                  >
                    Manual Approval
                  </button>
                </div>
              ) : null}
            </Card>
          ) : null}
          <Card>
            <h2 className="mb-3 text-lg font-bold">Files</h2>
            {[...data.files, ...data.proofs].length ? (
              [...data.files, ...data.proofs].map((file) => (
                <a
                  key={file.id}
                  className="mb-2 block rounded-md bg-neutral-900 p-3 text-sm text-orange-200"
                  href={`/api/procurement/orders/${id}/files/${file.id}/download${tokenQuery}`}
                >
                  {file.file_name || `${file.proof_type} proof`}
                </a>
              ))
            ) : (
              <p className="text-sm text-neutral-400">No files uploaded.</p>
            )}
          </Card>
          {canOperate ? (
            <Card>
              <h2 className="mb-3 text-lg font-bold">Fulfillment</h2>
              <Field label="Status">
                <select
                  className={inputClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProcurementOrderStatus)}
                >
                  {statusOptions.map((value) => (
                    <option key={value} value={value}>
                      {procurementStatusLabels[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ETA">
                <input
                  className={inputClass}
                  type="datetime-local"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
              </Field>
              <button
                onClick={() => updateStatus.mutate()}
                className="mt-3 w-full rounded-md bg-white/10 px-4 py-2 text-sm font-bold"
              >
                Update ETA / Status
              </button>
              {portal === "grunt" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => acceptRun.mutate()}
                    className="rounded-md bg-green-500 px-4 py-2 text-sm font-black text-black"
                  >
                    Accept Run
                  </button>
                  <button
                    onClick={() => rejectRun.mutate()}
                    className="rounded-md bg-red-500/90 px-4 py-2 text-sm font-black text-white"
                  >
                    Reject Run
                  </button>
                </div>
              ) : null}
              <Field label="Proof type">
                <select
                  className={inputClass}
                  value={proofType}
                  onChange={(e) =>
                    setProofType(e.target.value as "receipt" | "pickup" | "delivery")
                  }
                >
                  <option value="receipt">Receipt</option>
                  <option value="pickup">Pickup proof</option>
                  <option value="delivery">Delivery proof</option>
                </select>
              </Field>
              <Field label="Upload receipt or proof">
                <input
                  className={inputClass}
                  type="file"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
              </Field>
              <button
                onClick={() => uploadProof.mutate()}
                className="mt-3 w-full rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black"
              >
                {proofType === "receipt"
                  ? "Upload Receipt"
                  : proofType === "pickup"
                    ? "Upload Pickup Proof"
                    : "Upload Delivery Proof"}
              </button>
            </Card>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

export function SupplyRunDetail() {
  return <OrderDetail portal="tradescout" />;
}

export function GruntOrderDetail() {
  return <OrderDetail portal="tradescout" />;
}

export function GruntAdminOrderDetail() {
  return <OrderDetail portal="grunt" />;
}

export function SupplierQuoteResponsePage() {
  const token = getIdFromPath();
  const [form, setForm] = useState({
    materialTotal: "",
    pickupReadyAt: "",
    availabilitySummary: "",
    supplierNotes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/procurement/supplier-quotes", token],
    queryFn: () =>
      apiRequest("GET", `/api/procurement/supplier-quotes/${encodeURIComponent(token)}`),
    enabled: Boolean(token),
  });
  const respond = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/supplier-quotes/${encodeURIComponent(token)}/respond`, {
        materialTotalCents: form.materialTotal
          ? Math.round(Number(form.materialTotal) * 100)
          : null,
        pickupReadyAt: form.pickupReadyAt || null,
        availabilitySummary: form.availabilitySummary,
        supplierNotes: form.supplierNotes,
      }),
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) {
    return (
      <Shell title="Supplier Quote" eyebrow="Supply Run">
        <Card>Loading quote request...</Card>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell title="Supplier Quote" eyebrow="Supply Run">
        <Card>Could not load this supplier quote request.</Card>
      </Shell>
    );
  }

  if (submitted || data.supplierQuote?.status === "responded") {
    return (
      <Shell title="Quote Received" eyebrow="Supply Run">
        <Card>Thanks. TradeScout received your supplier quote.</Card>
      </Shell>
    );
  }

  return (
    <Shell title="Supplier Quote" eyebrow={data.supplierQuote?.supplier_name || "Supply Run"}>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg font-bold">{data.supplierQuote?.order_number}</h2>
            <div className="grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
              <div>Delivery: {data.supplierQuote?.delivery_address}</div>
              <div>
                Urgency:{" "}
                {procurementUrgencyLabels[data.supplierQuote?.urgency as ProcurementUrgency]}
              </div>
              <div>
                Vehicle:{" "}
                {
                  procurementVehicleLabels[
                    data.supplierQuote?.vehicle_type as ProcurementVehicleType
                  ]
                }
              </div>
              <div>Preferred store: {data.supplierQuote?.preferred_supplier_name || "Open"}</div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">Requested items</h2>
            <div className="space-y-2">
              {(data.items || []).map((item: any, index: number) => (
                <div
                  key={`${item.item_name}-${index}`}
                  className="rounded-md bg-neutral-900 p-3 text-sm"
                >
                  <div className="font-bold">{item.item_name}</div>
                  <div className="text-neutral-300">
                    {item.quantity} {item.unit || "each"}{" "}
                    {item.brand_preference ? `· ${item.brand_preference}` : ""}
                  </div>
                  {item.sku ? <div className="text-xs text-neutral-500">SKU {item.sku}</div> : null}
                  {item.url ? (
                    <a
                      className="text-xs text-orange-200"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Product link
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Your response</h2>
          <div className="space-y-3">
            <Field label="Materials total">
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={form.materialTotal}
                onChange={(event) => setForm({ ...form, materialTotal: event.target.value })}
              />
            </Field>
            <Field label="Pickup ready">
              <input
                className={inputClass}
                type="datetime-local"
                value={form.pickupReadyAt}
                onChange={(event) => setForm({ ...form, pickupReadyAt: event.target.value })}
              />
            </Field>
            <Field label="Availability">
              <textarea
                className={inputClass}
                rows={4}
                value={form.availabilitySummary}
                onChange={(event) => setForm({ ...form, availabilitySummary: event.target.value })}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className={inputClass}
                rows={4}
                value={form.supplierNotes}
                onChange={(event) => setForm({ ...form, supplierNotes: event.target.value })}
              />
            </Field>
          </div>
          {respond.error ? (
            <div className="mt-3 rounded-md bg-red-500/20 p-2 text-sm text-red-100">
              {(respond.error as any)?.message || "Could not submit quote."}
            </div>
          ) : null}
          <button
            onClick={() => respond.mutate()}
            disabled={respond.isPending}
            className="mt-4 w-full rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black disabled:opacity-60"
          >
            {respond.isPending ? "Submitting..." : "Send Quote"}
          </button>
        </Card>
      </div>
    </Shell>
  );
}

export function GruntAdminOrdersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/grunt/orders"],
    queryFn: () => apiRequest("GET", "/api/grunt/orders"),
  });
  return (
    <Shell
      title="Grunt Orders"
      eyebrow="Grunt Ordering System"
      action={
        <Link
          href="/grunt/order"
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black"
        >
          Get Supplies Delivered
        </Link>
      }
    >
      {isLoading ? (
        <Card>Loading Grunt orders...</Card>
      ) : error ? (
        <Card>Could not load Grunt orders.</Card>
      ) : (
        <OrderList orders={data?.orders || []} basePath="/grunt/admin/orders" />
      )}
    </Shell>
  );
}
