import { useLocation } from "wouter";
import { getCurrentInternalPath, readSafeReturnPath } from "@/lib/postOnboardingRoute";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, XCircle, Mail, Upload, Shield } from "lucide-react";

const addressFormSchema = z.object({
  fullAddress: z.string().min(5, "Please enter your complete address"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "Valid ZIP code is required"),
  verificationMethod: z.enum([
    "utility_bill",
    "bank_statement",
    "lease_agreement",
    "property_deed",
    "postcard",
    "phone_verification",
  ]),
  phoneNumber: z.string().optional(),
});

const postcardVerificationSchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

type AddressFormData = z.infer<typeof addressFormSchema>;
type PostcardVerificationData = z.infer<typeof postcardVerificationSchema>;

export default function AddressVerification() {
  const [step, setStep] = useState<"form" | "postcard" | "complete">("form");
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const returnPath = readSafeReturnPath(getCurrentInternalPath(location));
  const queryClient = useQueryClient();

  // Get address verification status
  const { data: verificationStatus, isLoading } = useQuery({
    queryKey: ["/api/address-verification/status"],
  });

  const addressForm = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      fullAddress: "",
      city: "",
      state: "",
      zipCode: "",
      verificationMethod: "postcard",
      phoneNumber: "",
    },
  });

  const postcardForm = useForm<PostcardVerificationData>({
    resolver: zodResolver(postcardVerificationSchema),
    defaultValues: {
      code: "",
    },
  });

  // Submit address verification
  const submitVerificationMutation = useMutation({
    mutationFn: async (data: AddressFormData) => {
      return await apiRequest("POST", "/api/address-verification", data);
    },
    onSuccess: () => {
      if (addressForm.getValues("verificationMethod") === "postcard") {
        setStep("postcard");
        requestPostcardMutation.mutate();
      } else {
        toast({
          title: "Verification Submitted",
          description: "Your address verification has been submitted for review.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/address-verification/status"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: formatUserFacingErrorMessage(error, "Failed to submit verification."),
        variant: "destructive",
      });
    },
  });

  // Request postcard verification
  const requestPostcardMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/address-verification/postcard/request");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Postcard Sent",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Request Failed",
        description: formatUserFacingErrorMessage(error, "Failed to request postcard."),
        variant: "destructive",
      });
    },
  });

  // Verify postcard code
  const verifyPostcardMutation = useMutation({
    mutationFn: async (data: PostcardVerificationData) => {
      return await apiRequest("POST", "/api/address-verification/postcard/verify", data);
    },
    onSuccess: () => {
      setStep("complete");
      toast({
        title: "Address Verified!",
        description: "Your address has been successfully verified.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/address-verification/status"] });
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: formatUserFacingErrorMessage(error, "Failed to verify code."),
        variant: "destructive",
      });
    },
  });

  const onSubmitAddress = (data: AddressFormData) => {
    submitVerificationMutation.mutate(data);
  };

  const onSubmitPostcard = (data: PostcardVerificationData) => {
    verifyPostcardMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white/60 dark:text-white/60">Loading verification status...</p>
        </div>
      </div>
    );
  }

  // Show verification status if already verified or has verification in progress
  if ((verificationStatus as any)?.isVerified) {
    return (
      <div className="px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl text-green-700 dark:text-green-300">
                Address Verified!
              </CardTitle>
              <CardDescription>
                Your address has been successfully verified. You have full access to the platform.
              </CardDescription>
              {returnPath && (
                <Button onClick={() => navigate(returnPath)}>Return to saved request</Button>
              )}
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // Show deadline warning
  const daysRemaining = (verificationStatus as any)?.daysRemaining || 0;
  const isExpired = (verificationStatus as any)?.isExpired || false;

  return (
    <div className="px-6 py-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-ts-orange mb-2">Address Verification Required</h1>
          <p className="text-white/60 dark:text-white/60 max-w-2xl mx-auto">
            To maintain trust and security in our community, all users must verify their address
            within 14 days of account creation.
          </p>
        </div>

        {/* Status Alert */}
        <Alert
          className={`mb-6 ${isExpired ? "border-red-200 bg-red-50 dark:bg-red-950" : "border-ts-orange/30 bg-ts-orange/10 dark:bg-ts-orange/10"}`}
        >
          <Clock className={`h-4 w-4 ${isExpired ? "text-red-600" : "text-ts-orange"}`} />
          <AlertTitle
            className={
              isExpired ? "text-red-800 dark:text-red-200" : "text-ts-orange dark:text-ts-orange"
            }
          >
            {isExpired ? "Verification Overdue" : `${daysRemaining} Days Remaining`}
          </AlertTitle>
          <AlertDescription
            className={
              isExpired ? "text-red-700 dark:text-red-300" : "text-ts-orange dark:text-ts-orange"
            }
          >
            {isExpired
              ? "Your verification deadline has passed. Please complete verification to regain access to platform features."
              : `You have ${daysRemaining} days remaining to verify your address. After this period, access to platform features will be limited.`}
          </AlertDescription>
        </Alert>

        {step === "form" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Address Form */}
            <Card>
              <CardHeader>
                <CardTitle>Enter Your Address</CardTitle>
                <CardDescription>
                  Provide your current residential address for verification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...addressForm}>
                  <form onSubmit={addressForm.handleSubmit(onSubmitAddress)} className="space-y-4">
                    <FormField
                      control={addressForm.control}
                      name="fullAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="123 Main Street, Apt 4B"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addressForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Los Angeles" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={addressForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="CA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={addressForm.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="90210" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={addressForm.control}
                      name="verificationMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verification Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose verification method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="postcard">Postcard (Recommended)</SelectItem>
                              <SelectItem value="utility_bill">Utility Bill</SelectItem>
                              <SelectItem value="bank_statement">Bank Statement</SelectItem>
                              <SelectItem value="lease_agreement">Lease Agreement</SelectItem>
                              <SelectItem value="property_deed">Property Deed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submitVerificationMutation.isPending}
                    >
                      {submitVerificationMutation.isPending
                        ? "Submitting..."
                        : "Start Verification"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Verification Methods Info */}
            <Card>
              <CardHeader>
                <CardTitle>Verification Methods</CardTitle>
                <CardDescription>Choose the method that works best for you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600 mt-1" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        Postcard Verification
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        We'll mail a postcard with a verification code to your address. Most
                        reliable method.
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        Recommended
                      </Badge>
                    </div>
                  </div>

                  <div
                    className="flex items-start space-x-3 p-3 rounded-lg"
                    style={{ backgroundColor: "var(--surface-card)" }}
                  >
                    <Upload className="w-5 h-5 text-white/60 mt-1" />
                    <div>
                      <h4 className="font-medium text-white dark:text-white">Document Upload</h4>
                      <p className="text-sm text-white/70 dark:text-white/70">
                        Upload a document that shows your name and address (utility bill, bank
                        statement, etc.).
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "postcard" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Enter Postcard Code</CardTitle>
              <CardDescription>
                We've sent a verification postcard to your address. Enter the 6-digit code from the
                postcard below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...postcardForm}>
                <form onSubmit={postcardForm.handleSubmit(onSubmitPostcard)} className="space-y-4">
                  <FormField
                    control={postcardForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123456"
                            className="text-center text-2xl tracking-widest"
                            maxLength={6}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={verifyPostcardMutation.isPending}
                  >
                    {verifyPostcardMutation.isPending ? "Verifying..." : "Verify Address"}
                  </Button>
                </form>
              </Form>

              <Separator className="my-6" />

              <div className="text-center space-y-2">
                <p className="text-sm text-white/60 dark:text-white/60">
                  Didn't receive the postcard? It typically arrives within 5-7 business days.
                </p>
                <Button
                  variant="outline"
                  onClick={() => requestPostcardMutation.mutate()}
                  disabled={requestPostcardMutation.isPending}
                >
                  {requestPostcardMutation.isPending ? "Sending..." : "Request New Postcard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "complete" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl text-green-700 dark:text-green-300">
                Verification Complete!
              </CardTitle>
              <CardDescription>
                Your address has been successfully verified. You now have full access to the
                platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate("/")}>Continue to Platform</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
