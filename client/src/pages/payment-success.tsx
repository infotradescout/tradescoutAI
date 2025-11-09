import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Home, Receipt } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function PaymentSuccess() {
  const [location] = useLocation();
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  useEffect(() => {
    // Parse payment_intent from URL if present
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const paymentIntentId = urlParams.get('payment_intent');
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    
    if (paymentIntentId) {
      setPaymentDetails({
        paymentIntentId,
        paymentIntentClientSecret
      });
    }

    // Auto-redirect after 10 seconds
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 10000);

    return () => clearTimeout(timer);
  }, [location]);

  return (
    <div className="min-h-screen bg-[#0f1419] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-6">
          {/* Success Icon */}
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>

          {/* Success Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-orange-500">
              Payment Successful!
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Your payment has been processed successfully. You should receive a confirmation email shortly.
            </p>
          </div>

          {/* Payment Details */}
          {paymentDetails && (
            <div className="bg-[#0f1419] dark:bg-[#1a2332] p-4 rounded-lg text-left">
              <h3 className="font-medium text-orange-500 mb-2">
                Transaction Details
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div className="flex justify-between">
                  <span>Payment ID:</span>
                  <span className="font-mono text-xs">
                    {paymentDetails.paymentIntentId.substring(0, 20)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-green-600 font-medium">Completed</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Return to Home
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link href="/payments/history">
                <Receipt className="w-4 h-4 mr-2" />
                View Payment History
              </Link>
            </Button>
          </div>

          {/* Auto-redirect Notice */}
          <p className="text-xs text-gray-500">
            You'll be automatically redirected to the home page in 10 seconds.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}