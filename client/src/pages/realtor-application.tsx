import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { SEOHelmet } from "@/components/SEOHelmet";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Home,
  Shield,
  FileText,
  Award,
  MapPin,
  DollarSign,
  Star,
  Info,
} from "lucide-react";

const realtorApplicationSchema = z.object({
  licenseNumber: z.string().min(5, "License number is required"),
  brokerageName: z.string().min(2, "Brokerage name is required"),
  mlsId: z.string().optional(),
  specializations: z.array(z.string()).min(1, "Select at least one specialization"),
  yearsExperience: z.string().min(1, "Years of experience is required"),
  licenseState: z.string().min(2, "License state is required"),
  licenseExpiration: z.string().min(1, "License expiration date is required"),
  serviceCounties: z.array(z.string()).min(1, "Select at least one service area"),
  serviceCities: z.array(z.string()).optional(),
  serviceZipCodes: z.array(z.string()).optional(),
});

type RealtorApplicationForm = z.infer<typeof realtorApplicationSchema>;

const realEstateSpecializations = [
  "Residential Sales",
  "Commercial Real Estate",
  "Luxury Properties",
  "First-Time Homebuyers",
  "Investment Properties",
  "New Construction",
  "Condominiums",
  "Land/Lots",
  "Foreclosures/REO",
  "Short Sales",
  "Property Management",
  "Relocation Services",
];

const states = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

export default function RealtorApplication() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [serviceCounties, setServiceCounties] = useState<string[]>([]);

  const form = useForm<RealtorApplicationForm>({
    resolver: zodResolver(realtorApplicationSchema),
    defaultValues: {
      licenseNumber: "",
      brokerageName: "",
      mlsId: "",
      specializations: [],
      yearsExperience: "",
      licenseState: "",
      licenseExpiration: "",
      serviceCounties: [],
      serviceCities: [],
      serviceZipCodes: [],
    },
  });

  const submitApplicationMutation = useMutation({
    mutationFn: async (data: RealtorApplicationForm) => {
      const {
        serviceCounties: submittedCounties,
        serviceCities = [],
        serviceZipCodes = [],
        ...application
      } = data;
      return apiRequest("POST", "/api/realtor/application", {
        ...application,
        serviceAreas: {
          counties: submittedCounties,
          cities: serviceCities,
          zipCodes: serviceZipCodes,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({
        title: "Application Submitted Successfully!",
        description:
          "Your realtor application has been submitted for review. You'll be notified once verified.",
      });
      form.reset();
      setSelectedSpecializations([]);
      setServiceCounties([]);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/pre-scout-setup?mode=signin");
        }, 500);
        return;
      }
      toast({
        title: "Application Failed",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RealtorApplicationForm) => {
    submitApplicationMutation.mutate(data);
  };

  const handleSpecializationToggle = (specialization: string) => {
    setSelectedSpecializations((prev) => {
      const next = prev.includes(specialization)
        ? prev.filter((s) => s !== specialization)
        : [...prev, specialization];
      form.setValue("specializations", next, { shouldDirty: true, shouldValidate: true });
      return next;
    });
  };

  if (!isAuthenticated) {
    return (
      <div className=" flex items-center justify-center p-4">
        <SEOHelmet
          title="Realtor Application | Join TradeScout"
          description="Apply as a realtor on TradeScout to participate in local property and referral workflows."
          canonical="https://www.thetradescout.com/realtor-application"
        />
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-ts-orange mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-white/60 mb-4">You need to be logged in to apply as a realtor.</p>
            <Button asChild className="bg-ts-orange-dark hover:bg-ts-orange-dark">
              <Link href="/pre-scout-setup?mode=signin">Log In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className=" text-white">
      <SEOHelmet
        title="Realtor Application | Join TradeScout"
        description="Apply as a realtor on TradeScout to participate in local property and referral workflows."
        canonical="https://www.thetradescout.com/realtor-application"
      />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" asChild>
            <Link href="/exchange" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Exchange
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Home className="h-8 w-8 text-blue-500" />
            Realtor Network Application
          </h1>
          <p className="text-white/60">
            Join our verified realtor network and sell properties with a professional badge
          </p>
        </div>

        {/* Benefits Section */}
        <Card className="mb-8 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-500/20">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              Realtor Network Benefits
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-400 mt-1" />
                <div>
                  <h4 className="font-medium">Verified Realtor Badge</h4>
                  <p className="text-sm text-white/70">Display your professional credentials</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-green-400 mt-1" />
                <div>
                  <h4 className="font-medium">Geographic Specialization</h4>
                  <p className="text-sm text-white/70">Target your service areas</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-emerald-400 mt-1" />
                <div>
                  <h4 className="font-medium">Professional Listings</h4>
                  <p className="text-sm text-white/70">Higher conversion rates</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-purple-400 mt-1" />
                <div>
                  <h4 className="font-medium">Trust & Credibility</h4>
                  <p className="text-sm text-white/70">Build client confidence</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Form */}
        <Card className="bg-tsCard border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Realtor Verification Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* License Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-400">License Information</h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Real Estate License Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter license number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="licenseState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License State</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {states.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="licenseExpiration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Expiration Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="yearsExperience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Years of Experience</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Years" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Brokerage Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-400">Brokerage Information</h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="brokerageName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brokerage Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter brokerage name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mlsId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MLS ID (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter MLS ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Specializations */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-400">Specializations</h3>
                  <p className="text-sm text-white/60">Select your areas of expertise</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {realEstateSpecializations.map((specialization) => (
                      <div key={specialization} className="flex items-center space-x-2">
                        <Checkbox
                          id={specialization}
                          checked={selectedSpecializations.includes(specialization)}
                          onCheckedChange={() => handleSpecializationToggle(specialization)}
                        />
                        <label
                          htmlFor={specialization}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {specialization}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Service Areas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-400">Service Areas</h3>
                  <p className="text-sm text-white/60">Define your geographic coverage</p>

                  <FormField
                    control={form.control}
                    name="serviceCounties"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Counties (comma-separated)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Los Angeles County, Orange County"
                            value={serviceCounties.join(", ")}
                            onChange={(e) => {
                              const counties = e.target.value
                                .split(",")
                                .map((value) => value.trim());
                              setServiceCounties(counties);
                              field.onChange(counties.filter(Boolean));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Professional Tips */}
                <div className="mt-8 p-6 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Info className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Application Tips
                      </h4>
                      <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
                        <li>• Ensure your license is current and in good standing</li>
                        <li>• Provide accurate brokerage affiliation information</li>
                        <li>• Select specializations that match your expertise</li>
                        <li>• Define realistic service areas for better connection quality</li>
                        <li>• Verification typically takes 2-3 business days</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={
                      submitApplicationMutation.isPending || selectedSpecializations.length === 0
                    }
                    className="bg-blue-600 hover:bg-blue-700 flex-1"
                  >
                    {submitApplicationMutation.isPending ? (
                      <>
                        <Shield className="h-4 w-4 mr-2 animate-spin" />
                        Submitting Application...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit Application
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={submitApplicationMutation.isPending}
                  >
                    Clear Form
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
