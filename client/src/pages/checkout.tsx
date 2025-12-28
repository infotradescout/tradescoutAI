import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

interface CheckoutFormProps {
  paymentType: 'contractor' | 'marketplace';
  paymentId: string;
  amount: number;
  description: string;
  isOffPlatform?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CheckoutForm = ({ 
  paymentType, 
  paymentId, 
  amount, 
  description, 
  isOffPlatform = false,
  onSuccess, 
  onCancel 
}: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  
  // Get payment methods
  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ["/api/payments/methods"],
  });

  // Get fee calculation
  const { data: feeData } = useQuery({
    queryKey: ["/api/payments/calculate-fees"],
    queryFn: () => apiRequest("POST", "/api/payments/calculate-fees", {
      amount,
      paymentType: paymentType === 'contractor' ? 'contractor_service' : 'marketplace_transaction'
    }).then(res => res.json())
  });

  // Wallet balance (for marketplace payments)
  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"],
    enabled: paymentType === 'marketplace',
  });

  useEffect(() => {
    if (!isOffPlatform && !clientSecret) {
      // Create PaymentIntent as soon as the page loads
      const endpoint = paymentType === 'contractor' 
        ? "/api/payments/contractor/create-intent"
        : "/api/payments/marketplace/create-intent";
      
      const bodyKey = paymentType === 'contractor' ? 'contractorPaymentId' : 'transactionId';
      
      apiRequest("POST", endpoint, { [bodyKey]: paymentId })
        .then(res => res.json())
        .then((data) => {
          setClientSecret(data.clientSecret);
        })
        .catch(error => {
          console.error('Failed to create payment intent:', error);
          toast({
            title: "Setup Failed",
            description: "Unable to initialize payment. Please try again.",
            variant: "destructive",
          });
        });
    }
  }, [paymentType, paymentId, isOffPlatform, clientSecret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOffPlatform) {
      try {
        await apiRequest("POST", "/api/payments/confirm-off-platform", {
          paymentId,
          paymentType,
          confirmationData: {
            method: "direct_payment", // This would come from a form
            notes: "Payment completed off-platform"
          }
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
    if (paymentType !== 'marketplace') return;

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

  if (!isOffPlatform && !clientSecret && stripePromise) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Complete Payment
          </CardTitle>
          <CardDescription>
            {description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Payment Summary */}
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: "var(--surface-card)" }}
          >
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
          {paymentType === 'marketplace' && walletData && !isOffPlatform && (
            <div className="bg-slate-900/70 border border-slate-700 p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  TradeScout Balance
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Available: ${parseFloat(walletData.balance || '0').toFixed(2)}
                </p>
              </div>
              <Button
                size="sm"
                disabled={isWalletLoading || parseFloat(walletData.balance || '0') < amount}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                onClick={handleWalletPay}
              >
                {isWalletLoading ? 'Processing…' : 'Pay with Balance'}
              </Button>
            </div>
          )}

          {/* Payment Method Selection */}
          {paymentMethods && (
            <div className="space-y-3">
              <h4 className="font-medium">Available Payment Methods</h4>
              <div className="grid gap-3">
                {paymentMethods.map((method: any) => (
                  <div
                    key={method.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      method.recommended
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {method.name}
                          {method.recommended && (
                            <Badge variant="default" className="text-xs">Recommended</Badge>
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
          )}

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isOffPlatform && stripePromise && clientSecret && (
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
          <Button 
            onClick={onCancel} 
            variant="outline" 
            className="flex-1"
            disabled={isLoading}
          >
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
  const [location] = useLocation();
  const [match, params] = useRoute("/checkout/:type/:id");
  
  const paymentType = params?.type as 'contractor' | 'marketplace';
  const paymentId = params?.id;
  
  // Parse URL parameters for payment details
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const amount = Number(urlParams.get('amount')) || 0;
  const description = urlParams.get('description') || 'Payment';
  const isOffPlatform = urlParams.get('off_platform') === 'true';

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
    window.location.href = '/payments/success';
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
        amount={amount}
        description={description}
        isOffPlatform={true}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    );
  }

  // Render with Stripe Elements for on-platform payments
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        paymentType={paymentType}
        paymentId={paymentId}
        amount={amount}
        description={description}
        isOffPlatform={false}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </Elements>
  );
}