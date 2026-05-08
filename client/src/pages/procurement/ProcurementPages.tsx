import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
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
  mustMatchExactly: false,
  substitutionAllowed: true,
});

function money(cents?: number | null) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function getIdFromPath() {
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  return decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
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
    <main className="min-h-screen bg-neutral-950 text-white">
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
  return useQuery<OrderBundle>({
    queryKey: ["/api/procurement/orders", id],
    queryFn: () => apiRequest("GET", `/api/procurement/orders/${encodeURIComponent(id)}`),
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
                  {order.source_channel} ·{" "}
                  {order.fulfillmentWorkspaceName || order.fulfillmentworkspacename || "Unassigned"}
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
  const [orderType, setOrderType] = useState<ProcurementMode>("buy_deliver");
  const [urgency, setUrgency] = useState<ProcurementUrgency>("flexible");
  const [vehicleType, setVehicleType] = useState<ProcurementVehicleType>("unsure");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    preferredSupplierName: "",
    preferredSupplierAddress: "",
    pickupAddress: "",
    deliveryAddress: "",
    notes: "",
    budgetLimitCents: "",
  });
  const [error, setError] = useState("");

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
      navigate(mode === "grunt" ? `/grunt/order/${id}` : `/utilities/supply-run/${id}`);
    },
    onError: (err: any) => setError(err?.message || "Could not submit this order."),
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
                      <input
                        className={inputClass}
                        value={item.url}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, url: e.target.value };
                          setItems(next);
                        }}
                      />
                    </Field>
                  </div>
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
      eyebrow="TradeScout Procurement Engine"
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
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useOrder(id);
  const [status, setStatus] = useState<ProcurementOrderStatus>("submitted");
  const [eta, setEta] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const latestQuote = data?.quotes?.[0];
  const canOperate = portal === "admin" || portal === "grunt";
  const base =
    portal === "grunt"
      ? "/grunt/admin/orders"
      : portal === "admin"
        ? "/admin/procurement"
        : "/utilities/supply-run";

  const approve = useMutation({
    mutationFn: () => apiRequest("POST", `/api/procurement/orders/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/procurement/orders", id] }),
  });
  const updateStatus = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/orders/${id}/status`, {
        status,
        partnerEta: eta || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/procurement/orders", id] }),
  });
  const uploadProof = useMutation({
    mutationFn: async () => {
      if (!proofFile) throw new Error("Choose a file first.");
      const uploaded = await uploadPrivateObject(proofFile);
      return apiRequest("POST", `/api/procurement/orders/${id}/proof`, {
        proofType: "delivery",
        objectKey: uploaded.objectKey,
        fileName: proofFile.name,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/procurement/orders", id] }),
  });

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
      eyebrow={portal === "grunt" ? "Grunt Ordering System" : "Procurement Engine"}
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
              <div>Source: {data.order.source_channel}</div>
              <div>
                Fulfillment:{" "}
                {data.order.fulfillmentWorkspaceName ||
                  data.order.fulfillmentworkspacename ||
                  "Unassigned"}
              </div>
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
                <div key={item.id} className="rounded-md bg-neutral-900 p-3 text-sm">
                  <div className="font-bold">{item.item_name}</div>
                  <div className="text-neutral-300">
                    {item.quantity} {item.unit || "each"}{" "}
                    {item.brand_preference ? `· ${item.brand_preference}` : ""}
                  </div>
                  {item.description ? (
                    <div className="mt-1 text-neutral-400">{item.description}</div>
                  ) : null}
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
        </div>
        <div className="space-y-4">
          {latestQuote ? (
            <Card>
              <h2 className="mb-3 text-lg font-bold">Quote</h2>
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
                <button
                  onClick={() => approve.mutate()}
                  className="mt-4 w-full rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black"
                >
                  Approve Quote
                </button>
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
                  href={`/api/procurement/orders/${id}/files/${file.id}/download`}
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
                Update Status
              </button>
              <Field label="Upload delivery proof">
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
                Upload Proof
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
  return <OrderDetail portal="grunt" />;
}

export function AdminProcurementPage() {
  const [filters, setFilters] = useState({
    status: "",
    sourceChannel: "",
    fulfillmentWorkspace: "",
  });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.sourceChannel) params.set("sourceChannel", filters.sourceChannel);
    if (filters.fulfillmentWorkspace)
      params.set("fulfillmentWorkspace", filters.fulfillmentWorkspace);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [filters]);
  const { data, isLoading, error } = useOrders(query);
  return (
    <Shell
      title="Procurement"
      eyebrow="Admin"
      action={
        <Link
          href="/admin/procurement/workspaces"
          className="rounded-md bg-white/10 px-4 py-2 text-sm font-bold"
        >
          Workspaces
        </Link>
      }
    >
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className={inputClass}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All statuses</option>
            {statusOptions.map((value) => (
              <option key={value} value={value}>
                {procurementStatusLabels[value]}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={filters.sourceChannel}
            onChange={(e) => setFilters({ ...filters, sourceChannel: e.target.value })}
          >
            <option value="">All channels</option>
            <option value="tradescout_supply_run">TradeScout Supply Run</option>
            <option value="grunt_direct_ordering">Grunt Direct Ordering</option>
          </select>
          <select
            className={inputClass}
            value={filters.fulfillmentWorkspace}
            onChange={(e) => setFilters({ ...filters, fulfillmentWorkspace: e.target.value })}
          >
            <option value="">All fulfillment</option>
            <option value="grunt">Grunt</option>
          </select>
        </div>
      </Card>
      {isLoading ? (
        <Card>Loading procurement orders...</Card>
      ) : error ? (
        <Card>Could not load orders.</Card>
      ) : (
        <OrderList orders={data?.orders || []} basePath="/admin/procurement" />
      )}
    </Shell>
  );
}

export function AdminProcurementDetailPage() {
  const id = getIdFromPath();
  const queryClient = useQueryClient();
  const { data } = useOrder(id);
  const [edit, setEdit] = useState({ deliveryAddress: "", internalNotes: "" });
  const [lines, setLines] = useState([
    { lineType: "materials_estimate", label: "Materials estimate", amount: "" },
    { lineType: "delivery_fee", label: "Delivery fee", amount: "" },
    { lineType: "service_fee", label: "Service fee", amount: "" },
    { lineType: "contingency_buffer", label: "Contingency buffer", amount: "" },
  ]);
  const quote = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/orders/${id}/quote`, {
        send: true,
        lines: lines
          .filter((line) => Number(line.amount) > 0)
          .map((line) => ({
            lineType: line.lineType,
            label: line.label,
            amountCents: Math.round(Number(line.amount) * 100),
          })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/procurement/orders", id] }),
  });
  const assign = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/procurement/orders/${id}/assign-fulfillment`, {
        workspaceSlug: "grunt",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/procurement/orders", id] }),
  });
  const saveOrder = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/procurement/orders/${id}`, {
        deliveryAddress: edit.deliveryAddress || data?.order.delivery_address,
        internalNotes: edit.internalNotes || data?.order.internal_notes || "",
      }),
    onSuccess: () => {
      setEdit({ deliveryAddress: "", internalNotes: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/orders", id] });
    },
  });
  return (
    <>
      <OrderDetail portal="admin" />
      <div className="bg-neutral-950 px-4 pb-10 text-white">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-lg font-bold">Admin order edit</h2>
            <Field label="Delivery address">
              <textarea
                className={inputClass}
                rows={3}
                value={edit.deliveryAddress || data?.order.delivery_address || ""}
                onChange={(event) => setEdit({ ...edit, deliveryAddress: event.target.value })}
              />
            </Field>
            <Field label="Internal notes">
              <textarea
                className={inputClass}
                rows={4}
                value={edit.internalNotes || data?.order.internal_notes || ""}
                onChange={(event) => setEdit({ ...edit, internalNotes: event.target.value })}
              />
            </Field>
            <button
              onClick={() => saveOrder.mutate()}
              className="mt-4 rounded-md bg-white/10 px-4 py-2 text-sm font-bold"
            >
              Save Order Details
            </button>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">Admin quote builder</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {lines.map((line, index) => (
                <Field key={line.lineType} label={line.label}>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount}
                    onChange={(e) => {
                      const next = [...lines];
                      next[index] = { ...line, amount: e.target.value };
                      setLines(next);
                    }}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => quote.mutate()}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black"
              >
                Send Quote
              </button>
              <button
                onClick={() => assign.mutate()}
                className="rounded-md bg-white/10 px-4 py-2 text-sm font-bold"
              >
                Assign Grunt
              </button>
            </div>
          </Card>
        </div>
      </div>
    </>
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

export function ProcurementWorkspacesPage() {
  const queryClient = useQueryClient();
  const [newWorkspace, setNewWorkspace] = useState({
    slug: "",
    name: "",
    workspaceType: "fulfillment_partner",
    publicName: "",
    tagline: "",
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/procurement/workspaces"],
    queryFn: () => apiRequest("GET", "/api/procurement/workspaces"),
  });
  const create = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/procurement/workspaces", {
        slug: newWorkspace.slug,
        name: newWorkspace.name,
        workspaceType: newWorkspace.workspaceType,
        branding: {
          publicName: newWorkspace.publicName || newWorkspace.name,
          tagline: newWorkspace.tagline,
        },
      }),
    onSuccess: () => {
      setNewWorkspace({
        slug: "",
        name: "",
        workspaceType: "fulfillment_partner",
        publicName: "",
        tagline: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/workspaces"] });
    },
  });
  return (
    <Shell
      title="Procurement Workspaces"
      eyebrow="Admin"
      action={
        <Link
          href="/admin/procurement"
          className="rounded-md bg-white/10 px-4 py-2 text-sm font-bold"
        >
          Orders
        </Link>
      }
    >
      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">Create workspace</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name">
            <input
              className={inputClass}
              value={newWorkspace.name}
              onChange={(event) => setNewWorkspace({ ...newWorkspace, name: event.target.value })}
            />
          </Field>
          <Field label="Slug">
            <input
              className={inputClass}
              value={newWorkspace.slug}
              onChange={(event) => setNewWorkspace({ ...newWorkspace, slug: event.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputClass}
              value={newWorkspace.workspaceType}
              onChange={(event) =>
                setNewWorkspace({ ...newWorkspace, workspaceType: event.target.value })
              }
            >
              <option value="platform">Platform</option>
              <option value="fulfillment_partner">Fulfillment partner</option>
              <option value="supplier">Supplier</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Public name">
            <input
              className={inputClass}
              value={newWorkspace.publicName}
              onChange={(event) =>
                setNewWorkspace({ ...newWorkspace, publicName: event.target.value })
              }
            />
          </Field>
          <div className="lg:col-span-2">
            <Field label="Tagline">
              <input
                className={inputClass}
                value={newWorkspace.tagline}
                onChange={(event) =>
                  setNewWorkspace({ ...newWorkspace, tagline: event.target.value })
                }
              />
            </Field>
          </div>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={!newWorkspace.name.trim() || !newWorkspace.slug.trim() || create.isPending}
          className="mt-4 rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black disabled:opacity-60"
        >
          Create Workspace
        </button>
      </Card>
      {isLoading ? (
        <Card>Loading workspaces...</Card>
      ) : error ? (
        <Card>Could not load workspaces.</Card>
      ) : (
        <div className="grid gap-3">
          {(data?.workspaces || []).map((workspace: any) => (
            <Link key={workspace.id} href={`/admin/procurement/workspaces/${workspace.id}`}>
              <Card className="cursor-pointer">
                <div className="font-black">{workspace.name}</div>
                <div className="text-sm text-neutral-300">
                  {workspace.slug} · {workspace.workspace_type}
                </div>
                <div className="text-sm text-neutral-500">{workspace.tagline}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function ProcurementWorkspaceDetailPage() {
  const id = getIdFromPath();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/procurement/workspaces"],
    queryFn: () => apiRequest("GET", "/api/procurement/workspaces"),
  });
  const workspace = (data?.workspaces || []).find((entry: any) => entry.id === id);
  const [draft, setDraft] = useState<any | null>(null);
  const form = draft || workspace || {};
  const save = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/procurement/workspaces/${id}`, {
        slug: form.slug,
        name: form.name,
        workspaceType: form.workspace_type || form.workspaceType,
        status: form.status,
        branding: {
          publicName: form.public_name || form.publicName || form.name,
          tagline: form.tagline || "",
          primaryColor: form.primary_color || form.primaryColor || "",
          supportEmail: form.support_email || form.supportEmail || "",
          supportPhone: form.support_phone || form.supportPhone || "",
        },
      }),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/workspaces"] });
    },
  });

  if (isLoading) {
    return (
      <Shell title="Workspace" eyebrow="Admin">
        <Card>Loading workspace...</Card>
      </Shell>
    );
  }

  if (error || !workspace) {
    return (
      <Shell title="Workspace" eyebrow="Admin">
        <Card>Could not load this workspace.</Card>
      </Shell>
    );
  }

  const update = (key: string, value: string) => setDraft({ ...form, [key]: value });

  return (
    <Shell
      title={workspace.name}
      eyebrow="Admin Workspace"
      action={
        <Link
          href="/admin/procurement/workspaces"
          className="rounded-md bg-white/10 px-4 py-2 text-sm font-bold"
        >
          Back
        </Link>
      }
    >
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Workspace name">
            <input
              className={inputClass}
              value={form.name || ""}
              onChange={(event) => update("name", event.target.value)}
            />
          </Field>
          <Field label="Slug">
            <input
              className={inputClass}
              value={form.slug || ""}
              onChange={(event) => update("slug", event.target.value)}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputClass}
              value={form.workspace_type || form.workspaceType || "fulfillment_partner"}
              onChange={(event) => update("workspace_type", event.target.value)}
            >
              <option value="platform">Platform</option>
              <option value="fulfillment_partner">Fulfillment partner</option>
              <option value="supplier">Supplier</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Status">
            <input
              className={inputClass}
              value={form.status || ""}
              onChange={(event) => update("status", event.target.value)}
            />
          </Field>
          <Field label="Public name">
            <input
              className={inputClass}
              value={form.public_name || form.publicName || ""}
              onChange={(event) => update("public_name", event.target.value)}
            />
          </Field>
          <Field label="Primary color">
            <input
              className={inputClass}
              value={form.primary_color || form.primaryColor || ""}
              onChange={(event) => update("primary_color", event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Tagline">
              <textarea
                className={inputClass}
                rows={3}
                value={form.tagline || ""}
                onChange={(event) => update("tagline", event.target.value)}
              />
            </Field>
          </div>
        </div>
        <button
          onClick={() => save.mutate()}
          className="mt-4 rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black"
        >
          Save Workspace
        </button>
      </Card>
    </Shell>
  );
}
