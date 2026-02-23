import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CreditCard, DollarSign, Shield } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

type ProcessingMethod = "ach" | "card";
const ACH_THRESHOLD_USD = 1000;

interface CheckoutFormProps {
  paymentType: "contractor" | "marketplace";
  paymentId: string;
  amount: number;
  description: string;
  isOffPlatform?: boolean;
  processingMethod: ProcessingMethod;
  onProcessingMethodChange?: (method: ProcessingMethod) => void;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CheckoutForm = ({
  paymentType,
  paymentId,
  amount,
  description,
  isOffPlatform = false,
  processingMethod,
  onProcessingMethodChange,
  onSuccess,
  onCancel,
}: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);

  // Get payment methods (for display only)
  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ["/api/payments/methods", paymentType, String(amount)],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("amount", String(amount));
      sp.set(
        "paymentType",
        paymentType === "contractor" ? "contractor_service" : "marketplace_transaction"
      );
      const res = await fetch(`/api/payments/methods?${sp.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Get fee calculation
  const { data: feeData } = useQuery({
    queryKey: ["/api/payments/calculate-fees", paymentType, String(amount), processingMethod],
    queryFn: () =>
      apiRequest("POST", "/api/payments/calculate-fees", {
        amount,
        paymentType:
          paymentType === "contractor" ? "contractor_service" : "marketplace_transaction",
        processingMethod,
      }).then((res) => res.json()),
  });

  // Wallet balance (for marketplace payments)
  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"],
    enabled: paymentType === "marketplace",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOffPlatform) {
      try {
        await apiRequest("POST", "/api/payments/confirm-off-platform", {
          paymentId,
          paymentType,
          confirmationData: {
            method: "direct_payment", // This would come from a form
            notes: "Payment completed off-platform",
          },
        });

        toast({
          title: "Payment Confirmed",
          description: "Off-platform payment has been recorded.",
        });
        onSuccess?.();
      } catch (error: any) {
        toast({
          title: "Confirmation Failed",
          description: error?.message || "Unable to confirm off-platform payment.",
          variant: "destructive",
        });
      }
      return;
    }

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "Your payment has been processed successfully!",
      });
      onSuccess?.();
    }

    setIsLoading(false);
  };

  const handleWalletPay = async () => {
    if (paymentType !== "marketplace") return;

    setIsWalletLoading(true);
    try {
      await apiRequest("POST", "/api/payments/marketplace/pay-with-wallet", {
        transactionId: paymentId,
      });

      toast({
        title: "Payment Successful",
        description: "Your TradeScout balance was used for this purchase.",
      });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Wallet Payment Failed",
        description: error?.message || "Unable to pay with wallet balance.",
        variant: "destructive",
      });
    } finally {
      setIsWalletLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Complete Payment
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Payment Summary */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: "var(--surface-card)" }}>
            <div className="flex justify-between items-center">
              <span className="font-medium">Amount</span>
              <span className="text-xl font-bold">${amount.toFixed(2)}</span>
            </div>

            {feeData && !isOffPlatform && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Platform Fee</span>
                    <span>${feeData.platformFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Processing Fee</span>
                    <span>${feeData.stripeFee}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total Fees</span>
                    <span>${feeData.totalFees}</span>
                  </div>
                </div>
              </>
            )}

            {isOffPlatform && (
              <div className="mt-3">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <DollarSign className="w-3 h-3 mr-1" />
                  No Platform Fees
                </Badge>
              </div>
            )}
          </div>

          {/* TradeScout balance option (marketplace only) */}
          {paymentType === "marketplace" && walletData && !isOffPlatform && (
            <div className="bg-slate-900/70 border border-slate-700 p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  TradeScout Balance
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Available: ${parseFloat(walletData.balance || "0").toFixed(2)}
                </p>
              </div>
              <Button
                size="sm"
                disabled={isWalletLoading || parseFloat(walletData.balance || "0") < amount}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                onClick={handleWalletPay}
              >
                {isWalletLoading ? "Processing…" : "Pay with Balance"}
              </Button>
            </div>
          )}

          {/* Payment Method Selection */}
          {paymentType === "marketplace" && !isOffPlatform ? (
            <div className="space-y-3">
              <h4 className="font-medium">Pay with</h4>
              <div className="grid gap-3">
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    processingMethod === "ach"
                      ? "border-primary bg-primary/5"
                      : "border-slate-700 hover:bg-slate-900"
                  }`}
                  onClick={() => onProcessingMethodChange?.("ach")}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        Bank transfer (ACH)
                        {amount >= ACH_THRESHOLD_USD ? (
                          <Badge variant="default" className="text-xs">
                            Recommended
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600">
                        Lower processing costs on larger payments.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    processingMethod === "card"
                      ? "border-primary bg-primary/5"
                      : "border-slate-700 hover:bg-slate-900"
                  }`}
                  onClick={() => onProcessingMethodChange?.("card")}
                >
                  <div className="font-medium flex items-center gap-2">Card</div>
                  <p className="text-sm text-gray-600">Fastest checkout experience</p>
                </div>
              </div>
            </div>
          ) : paymentMethods ? (
            <div className="space-y-3">
              <h4 className="font-medium">Available Payment Methods</h4>
              <div className="grid gap-3">
                {paymentMethods.map((method: any) => (
                  <div
                    key={method.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      method.recommended
                        ? "border-primary bg-primary/5"
                        : "border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {method.name}
                          {method.recommended && (
                            <Badge variant="default" className="text-xs">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{method.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{method.fees}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isOffPlatform && stripePromise && (
              <div className="border p-4 rounded-lg">
                <PaymentElement />
              </div>
            )}

            {isOffPlatform && (
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      Off-Platform Payment
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-200">
                      Please complete payment directly with the service provider and confirm below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-4 h-4" />
              <span>Your payment information is secured with industry-standard encryption</span>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button onClick={onCancel} variant="outline" className="flex-1" disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={(!stripe && !isOffPlatform) || isLoading}
            className="flex-1"
          >
            {isLoading ? "Processing..." : isOffPlatform ? "Confirm Payment" : "Pay Now"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default function Checkout() {
  const [location, navigate] = useLocation();
  const [match, params] = useRoute("/checkout/:type/:id");

  const paymentType = params?.type as "contractor" | "marketplace";
  const paymentId = params?.id;

  // Parse URL parameters for payment details
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const urlAmount = Number(urlParams.get("amount")) || 0;
  const urlDescription = urlParams.get("description") || "Payment";
  const isOffPlatform = urlParams.get("off_platform") === "true";

  const { data: marketplaceTx } = useQuery<any>({
    queryKey: ["/api/payments/marketplace", paymentId],
    queryFn: async () => {
      if (paymentType !== "marketplace" || !paymentId) return null;
      const res = await fetch(`/api/payments/marketplace/${encodeURIComponent(paymentId)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(match && paymentType === "marketplace" && paymentId),
  });

  const baseAmount = useMemo(() => {
    if (paymentType === "marketplace") {
      const txAmount = marketplaceTx?.totalAmount != null ? Number(marketplaceTx.totalAmount) : NaN;
      if (Number.isFinite(txAmount) && txAmount > 0) return txAmount;
    }
    return urlAmount;
  }, [paymentType, marketplaceTx, urlAmount]);

  const description = useMemo(() => {
    if (paymentType === "marketplace" && marketplaceTx?.notes) {
      return String(marketplaceTx.notes);
    }
    return urlDescription;
  }, [paymentType, marketplaceTx, urlDescription]);

  const [processingMethod, setProcessingMethod] = useState<ProcessingMethod>(() => {
    if (paymentType === "marketplace" && baseAmount >= ACH_THRESHOLD_USD) return "ach";
    return "card";
  });
  const [methodTouched, setMethodTouched] = useState(false);

  useEffect(() => {
    if (methodTouched) return;
    if (paymentType === "marketplace" && baseAmount >= ACH_THRESHOLD_USD)
      setProcessingMethod("ach");
    else setProcessingMethod("card");
  }, [baseAmount, paymentType, methodTouched]);

  const [clientSecret, setClientSecret] = useState<string>("");
  const [effectiveAmount, setEffectiveAmount] = useState<number>(baseAmount);
  const { toast } = useToast();

  useEffect(() => {
    setEffectiveAmount(baseAmount);
  }, [baseAmount]);

  useEffect(() => {
    if (!match || !paymentType || !paymentId) return;
    if (isOffPlatform) return;
    if (!stripePromise) return;

    // Create PaymentIntent for this payment and method choice.
    const endpoint =
      paymentType === "contractor"
        ? "/api/payments/contractor/create-intent"
        : "/api/payments/marketplace/create-intent";
    const body: any =
      paymentType === "contractor"
        ? { contractorPaymentId: paymentId }
        : { transactionId: paymentId, processingMethod };

    setClientSecret("");

    apiRequest("POST", endpoint, body)
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(String(data.clientSecret || ""));
        if (paymentType === "marketplace") {
          const eff = Number(data.effectiveTotalAmount ?? baseAmount);
          if (Number.isFinite(eff) && eff > 0) setEffectiveAmount(eff);
          else setEffectiveAmount(baseAmount);
        } else {
          setEffectiveAmount(baseAmount);
        }
      })
      .catch((error) => {
        console.error("Failed to create payment intent:", error);
        toast({
          title: "Setup Failed",
          description: "Unable to initialize payment. Please try again.",
          variant: "destructive",
        });
      });
  }, [match, paymentType, paymentId, isOffPlatform, processingMethod, baseAmount, toast]);

  if (!match || !paymentType || !paymentId) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <Card>
          <CardContent className="pt-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invalid Payment Link</h2>
            <p className="text-gray-600">
              The payment link appears to be invalid. Please contact support if this issue persists.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSuccess = () => {
    navigate("/payment-success");
  };

  const handleCancel = () => {
    window.history.back();
  };

  // Render without Stripe Elements for off-platform payments
  if (isOffPlatform || !stripePromise) {
    return (
      <CheckoutForm
        paymentType={paymentType}
        paymentId={paymentId}
        amount={baseAmount}
        description={description}
        isOffPlatform={true}
        processingMethod={"card"}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    );
  }

  if (!clientSecret) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div
          className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
          aria-label="Loading"
        />
      </div>
    );
  }

  // Render with Stripe Elements for on-platform payments (clientSecret-bound)
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }} key={clientSecret}>
      <CheckoutForm
        paymentType={paymentType}
        paymentId={paymentId}
        amount={effectiveAmount}
        description={description}
        isOffPlatform={false}
        processingMethod={processingMethod}
        onProcessingMethodChange={(method) => {
          setMethodTouched(true);
          setProcessingMethod(method);
        }}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </Elements>
  );
}
