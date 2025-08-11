import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { 
  CreditCard, 
  Shield, 
  Truck, 
  Star, 
  ArrowLeft,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Link, useLocation } from "wouter";

// Initialize Stripe - will need VITE_STRIPE_PUBLIC_KEY
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

interface CheckoutFormProps {
  listingId: string;
  onSuccess: () => void;
}

function CheckoutForm({ listingId, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Payment succeeded
        onSuccess();
        toast({
          title: "Payment Successful",
          description: "Your purchase has been completed!",
        });
      }
    } catch (error) {
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred during payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Payment Information</h3>
        <PaymentElement />
      </div>
      
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || isProcessing}
        size="lg"
      >
        {isProcessing ? (
          "Processing Payment..."
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Complete Purchase
          </>
        )}
      </Button>
    </form>
  );
}

export default function Checkout() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [clientSecret, setClientSecret] = useState("");
  const [listingId, setListingId] = useState("");

  // Get listing ID from URL params or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const listingIdParam = urlParams.get('listing');
    
    if (listingIdParam) {
      setListingId(listingIdParam);
    } else {
      // Redirect back if no listing specified
      toast({
        title: "No Item Selected",
        description: "Please select an item to purchase",
        variant: "destructive",
      });
      setLocation("/marketplace");
    }
  }, []);

  // Fetch listing details
  const { data: listing, isLoading: isLoadingListing } = useQuery({
    queryKey: ["/api/marketplace/listings", listingId],
    enabled: !!listingId,
  });

  // Create payment intent
  useEffect(() => {
    if (listingId && listing) {
      apiRequest("POST", "/api/create-payment-intent", { listingId })
        .then((response) => response.json())
        .then((data) => {
          setClientSecret(data.clientSecret);
        })
        .catch((error) => {
          console.error("Error creating payment intent:", error);
          toast({
            title: "Payment Setup Error",
            description: "Unable to initialize payment. Please try again.",
            variant: "destructive",
          });
        });
    }
  }, [listingId, listing]);

  const handlePaymentSuccess = async () => {
    try {
      // Create transaction record
      await apiRequest("POST", "/api/marketplace/transactions", {
        listingId: listing.id,
        sellerId: listing.sellerId,
        totalAmount: listing.price,
        status: 'completed',
        paymentMethod: 'stripe',
      });

      // Redirect to success page
      setLocation(`/checkout/success?transaction=${listing.id}`);
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast({
        title: "Transaction Error",
        description: "Payment successful but failed to record transaction",
        variant: "destructive",
      });
    }
  };

  if (!stripePromise) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Payment Not Available</h3>
              <p className="text-muted-foreground mb-4">
                Payment processing is not configured. Stripe keys are required.
              </p>
              <Link href="/marketplace">
                <Button>Return to Marketplace</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoadingListing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="animate-pulse">
              <div className="aspect-square bg-muted rounded-t-lg" />
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-6 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-6 bg-muted rounded" />
                  <div className="h-32 bg-muted rounded" />
                  <div className="h-12 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Item Not Found</h3>
              <p className="text-muted-foreground mb-4">
                The item you're trying to purchase could not be found.
              </p>
              <Link href="/marketplace">
                <Button>Return to Marketplace</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/marketplace/${listing.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Item
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Secure Checkout</h1>
            <p className="text-muted-foreground">
              Complete your purchase safely and securely
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                <CardDescription>Review your purchase details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <img
                    src={listing.images?.[0] || "/placeholder-image.jpg"}
                    alt={listing.title}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{listing.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {listing.description?.substring(0, 100)}...
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{listing.condition}</Badge>
                      {listing.isVerifiedSeller && (
                        <Badge variant="default">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified Seller
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      ${listing.price}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Item Price</span>
                    <span>${listing.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee (5%)</span>
                    <span>${(listing.price * 0.05).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>
                      {listing.freeShipping ? (
                        <Badge variant="secondary">Free</Badge>
                      ) : (
                        `$${listing.shippingCost || 0}`
                      )}
                    </span>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-primary">
                      ${(listing.price * 1.05 + (listing.shippingCost || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Buyer Protection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Secure Payment</h4>
                    <p className="text-sm text-muted-foreground">
                      Your payment is processed securely through Stripe
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Truck className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Shipping Protection</h4>
                    <p className="text-sm text-muted-foreground">
                      Tracked shipping with delivery confirmation
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Star className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Quality Guarantee</h4>
                    <p className="text-sm text-muted-foreground">
                      30-day return policy for qualifying items
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
                <CardDescription>
                  Enter your payment information to complete the purchase
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <CheckoutForm listingId={listingId} onSuccess={handlePaymentSuccess} />
                  </Elements>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Preparing secure checkout...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <div className="text-sm text-muted-foreground">{user?.email}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <div className="text-sm text-muted-foreground">
                      {user?.firstName} {user?.lastName}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}