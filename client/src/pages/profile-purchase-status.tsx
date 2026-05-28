import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  ReceiptText,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SEOHelmet } from "@/components/SEOHelmet";
import {
  TRADESCOUT_TRANSACTION_FEE_LABEL,
  TRADESCOUT_TRANSACTION_FEE_USD,
} from "@shared/platformRevenue";

type PurchaseStatusResponse = {
  purchase: {
    id: string;
    offerType: "service" | "item";
    purchaseStatus: string;
    paymentStatus: string;
    shippingStatus?: string | null;
    quantity: number;
    unitPrice: number;
    shippingCost: number;
    platformFee?: number;
    sellerAmount?: number;
    totalAmount: number;
    currency: string;
    receiptDocumentId?: string | null;
    workRequestId?: string | null;
    metadata?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
  };
  offer: {
    id: string;
    title: string;
    description?: string | null;
    fulfillmentMode?: string | null;
    itemSku?: string | null;
    metadata?: Record<string, any>;
  };
  viewerRole: "buyer" | "seller";
  reviewBoundary: string;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value || 0));
}

function pretty(value?: string | null) {
  return String(value || "pending").replace(/_/g, " ");
}

export default function ProfilePurchaseStatus() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [messageType, setMessageType] = useState("status_update");
  const [orderMessage, setOrderMessage] = useState("");

  const purchaseQuery = useQuery<PurchaseStatusResponse>({
    queryKey: ["/api/profile-offer-purchases", id],
    queryFn: async () => {
      const response = await fetch(`/api/profile-offer-purchases/${encodeURIComponent(id || "")}`, {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to load order");
      return data;
    },
    enabled: Boolean(id),
  });

  const data = purchaseQuery.data;
  const purchase = data?.purchase;
  const offer = data?.offer;
  const metadata = purchase?.metadata || {};
  const offerMetadata = offer?.metadata || {};
  const imageUrls = Array.isArray(offerMetadata.imageUrls || offerMetadata.images)
    ? offerMetadata.imageUrls || offerMetadata.images
    : [];
  const trackingNumber = metadata.trackingNumber ? String(metadata.trackingNumber) : "";
  const trackingCarrier = metadata.trackingCarrier ? String(metadata.trackingCarrier) : "";
  const orderMessages = Array.isArray(metadata.orderMessages) ? metadata.orderMessages : [];

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/profile-offer-purchases/${encodeURIComponent(id || "")}/order-message`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageType, message: orderMessage }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to send update");
      return data;
    },
    onSuccess: () => {
      setOrderMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/profile-offer-purchases", id] });
    },
  });

  return (
    <>
      <SEOHelmet
        title="Profile Purchase Status | TradeScout"
        description="Review a TradeScout profile purchase, receipt, fulfillment, and accounting status."
      />
      <div className="min-h-screen bg-tsBackground text-white">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
          <Button
            variant="ghost"
            className="text-white/60 hover:text-white"
            onClick={() =>
              navigate(data?.viewerRole === "seller" ? "/offer-services" : "/exchange")
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {purchaseQuery.isLoading ? (
            <Card className="border-white/10 bg-tsCard">
              <CardContent className="p-6 text-sm text-white/50">Loading order...</CardContent>
            </Card>
          ) : purchaseQuery.isError || !purchase || !offer ? (
            <Card className="border-white/10 bg-tsCard">
              <CardContent className="p-6 text-sm text-white/60">
                This order could not be found, or you do not have access to it.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-white/10 bg-tsCard">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Package className="h-5 w-5 text-ts-orange" />
                    {offer.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    {imageUrls[0] ? (
                      <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                        <img
                          src={String(imageUrls[0])}
                          alt={offer.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 space-y-2">
                      {offer.description ? (
                        <p className="text-sm leading-relaxed text-white/60">{offer.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-white/10 text-white/70">
                          {data.viewerRole}
                        </Badge>
                        {offerMetadata.itemCategory ? (
                          <Badge variant="outline" className="border-white/10 text-white/70">
                            {String(offerMetadata.itemCategory)}
                          </Badge>
                        ) : null}
                        {offerMetadata.taxCategory ? (
                          <Badge variant="outline" className="border-white/10 text-white/70">
                            tax: {String(offerMetadata.taxCategory)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/40">
                        <Clock className="h-3.5 w-3.5" />
                        Order
                      </div>
                      <p className="mt-2 text-sm font-semibold capitalize text-white">
                        {pretty(purchase.purchaseStatus)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/40">
                        <ReceiptText className="h-3.5 w-3.5" />
                        Payment
                      </div>
                      <p className="mt-2 text-sm font-semibold capitalize text-white">
                        {pretty(purchase.paymentStatus)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/40">
                        <Truck className="h-3.5 w-3.5" />
                        Fulfillment
                      </div>
                      <p className="mt-2 text-sm font-semibold capitalize text-white">
                        {pretty(purchase.shippingStatus)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div className="flex justify-between gap-3">
                        <span className="text-white/50">Quantity</span>
                        <span>{purchase.quantity}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/50">Unit price</span>
                        <span>{money(purchase.unitPrice, purchase.currency)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/50">Shipping</span>
                        <span>{money(purchase.shippingCost, purchase.currency)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/50">{TRADESCOUT_TRANSACTION_FEE_LABEL}</span>
                        <span>
                          {money(
                            purchase.platformFee ?? TRADESCOUT_TRANSACTION_FEE_USD,
                            purchase.currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/50">Seller subtotal</span>
                        <span>
                          {money(
                            purchase.sellerAmount ??
                              purchase.totalAmount - TRADESCOUT_TRANSACTION_FEE_USD,
                            purchase.currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 font-semibold">
                        <span className="text-white/70">Total</span>
                        <span>{money(purchase.totalAmount, purchase.currency)}</span>
                      </div>
                    </div>
                  </div>

                  {trackingNumber || trackingCarrier ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                        Tracking
                      </div>
                      <p className="mt-1 text-white/70">
                        {[trackingCarrier, trackingNumber].filter(Boolean).join(" ")}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Order updates</p>
                        <p className="mt-1 text-xs text-white/45">
                          Purchase-scoped messages only. Phone, email, links, and off-platform
                          contact are blocked
                        </p>
                      </div>
                    </div>
                    {orderMessages.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {orderMessages.slice(-6).map((entry: any) => (
                          <div
                            key={String(entry.id || entry.at)}
                            className="rounded-md border border-white/10 bg-black/20 p-2"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                              <Badge variant="outline" className="border-white/10 text-white/60">
                                {String(entry.actorRole || "participant")}
                              </Badge>
                              <span>{pretty(String(entry.messageType || "status_update"))}</span>
                              {entry.at ? (
                                <span>{new Date(String(entry.at)).toLocaleString()}</span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-white/70">
                              {String(entry.message || "")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-white/45">No order updates yet.</p>
                    )}
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          ["status_update", "Status"],
                          ["buyer_question", "Question"],
                          ["pickup_coordination", "Pickup"],
                          ["fulfillment_issue", "Issue"],
                        ].map(([value, label]) => (
                          <Button
                            key={value}
                            type="button"
                            size="sm"
                            variant={messageType === value ? "default" : "outline"}
                            className="h-7 px-2 text-xs"
                            onClick={() => setMessageType(value)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      <Textarea
                        value={orderMessage}
                        onChange={(event) => setOrderMessage(event.target.value)}
                        placeholder="Add a purchase-scoped update. Do not include phone, email, links, or payment instructions."
                        className="min-h-[84px] border-white/10 bg-white/5 text-white placeholder:text-white/30"
                      />
                      {sendMessageMutation.isError ? (
                        <p className="text-xs text-red-300">
                          {(sendMessageMutation.error as Error)?.message || "Failed to send update"}
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        disabled={!orderMessage.trim() || sendMessageMutation.isPending}
                        onClick={() => sendMessageMutation.mutate()}
                      >
                        {sendMessageMutation.isPending ? "Sending..." : "Add update"}
                      </Button>
                    </div>
                  </div>

                  {(offerMetadata.fulfillmentPolicy || offerMetadata.returnPolicy) && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {offerMetadata.fulfillmentPolicy ? (
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                            Fulfillment policy
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-white/65">
                            {String(offerMetadata.fulfillmentPolicy)}
                          </p>
                        </div>
                      ) : null}
                      {offerMetadata.returnPolicy ? (
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                            Return policy
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-white/65">
                            {String(offerMetadata.returnPolicy)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-tsCard">
                <CardContent className="flex gap-3 p-4 text-sm text-white/60">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ts-orange" />
                  <p>
                    {data.reviewBoundary ||
                      "Contact, payment movement, shipment handoff, and accounting posting remain review-gated."}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
