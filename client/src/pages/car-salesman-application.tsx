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
  Car,
  Shield,
  FileText,
  Award,
  MapPin,
  DollarSign,
  Star,
  Info,
  Wrench,
} from "lucide-react";

const carSalesmanApplicationSchema = z.object({
  dealershipName: z.string().min(2, "Dealership name is required"),
  dealerLicense: z.string().min(5, "Dealer license number is required"),
  salesmanLicense: z.string().optional(),
  specializations: z.array(z.string()).min(1, "Select at least one specialization"),
  brandsSpecialty: z.array(z.string()).min(1, "Select at least one brand specialty"),
  yearsExperience: z.string().min(1, "Years of experience is required"),
  licenseState: z.string().min(2, "License state is required"),
  licenseExpiration: z.string().min(1, "License expiration date is required"),
  serviceCounties: z.array(z.string()).min(1, "Select at least one service area"),
  serviceCities: z.array(z.string()).optional(),
  serviceZipCodes: z.array(z.string()).optional(),
});

type CarSalesmanApplicationForm = z.infer<typeof carSalesmanApplicationSchema>;

const vehicleSpecializations = [
  "New Vehicle Sales",
  "Used Vehicle Sales",
  "Luxury Vehicles",
  "Commercial Vehicles",
  "Electric Vehicles",
  "Hybrid Vehicles",
  "Sports Cars",
  "SUVs & Trucks",
  "Motorcycles",
  "RVs & Trailers",
  "Fleet Sales",
  "Certified Pre-Owned",
];

const carBrands = [
  "Toyota",
  "Honda",
  "Ford",
  "Chevrolet",
  "Nissan",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Lexus",
  "Acura",
  "Infiniti",
  "Cadillac",
  "Lincoln",
  "Buick",
  "GMC",
  "Ram",
  "Jeep",
  "Chrysler",
  "Dodge",
  "Subaru",
  "Mazda",
  "Kia",
  "Hyundai",
  "Volvo",
  "Jaguar",
  "Land Rover",
  "Porsche",
  "Ferrari",
  "Lamborghini",
  "Maserati",
  "Bentley",
  "Rolls-Royce",
  "Tesla",
  "Rivian",
  "Lucid",
  "Genesis",
  "Alfa Romeo",
  "MINI",
  "Volkswagen",
  "Other",
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

export default function CarSalesmanApplication() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [serviceCounties, setServiceCounties] = useState<string[]>([]);

  const form = useForm<CarSalesmanApplicationForm>({
    resolver: zodResolver(carSalesmanApplicationSchema),
    defaultValues: {
      dealershipName: "",
      dealerLicense: "",
      salesmanLicense: "",
      specializations: [],
      brandsSpecialty: [],
      yearsExperience: "",
      licenseState: "",
      licenseExpiration: "",
      serviceCounties: [],
      serviceCities: [],
      serviceZipCodes: [],
    },
  });

  const submitApplicationMutation = useMutation({
    mutationFn: async (data: CarSalesmanApplicationForm) => {
      const {
        serviceCounties: submittedCounties,
        serviceCities = [],
        serviceZipCodes = [],
        ...application
      } = data;
      return apiRequest("POST", "/api/car-salesman/application", {
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
          "Your car salesman application has been submitted for review. You'll be notified once verified.",
      });
      form.reset();
      setSelectedSpecializations([]);
      setSelectedBrands([]);
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

  const onSubmit = (data: CarSalesmanApplicationForm) => {
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

  const handleBrandToggle = (brand: string) => {
    setSelectedBrands((prev) => {
      const next = prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand];
      form.setValue("brandsSpecialty", next, { shouldDirty: true, shouldValidate: true });
      return next;
    });
  };

  if (!isAuthenticated) {
    return (
      <div className=" flex items-center justify-center p-4">
        <SEOHelmet
          title="Car Salesman Application | Join TradeScout"
          description="Apply as a licensed car salesman on TradeScout to join local auto marketplace and referral workflows."
          canonical="https://www.thetradescout.com/car-salesman-application"
        />
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-ts-orange mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-white/60 mb-4">
              You need to be logged in to apply as a car salesman.
            </p>
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
        title="Car Salesman Application | Join TradeScout"
        description="Apply as a licensed car salesman on TradeScout to join local auto marketplace and referral workflows."
        canonical="https://www.thetradescout.com/car-salesman-application"
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
            <Car className="h-8 w-8 text-red-500" />
            Licensed Car Salesman Network
          </h1>
          <p className="text-white/60">
            Join our verified automotive sales network and sell vehicles with a professional badge
          </p>
        </div>

        {/* Benefits Section */}
        <Card className="mb-8 bg-gradient-to-r from-red-900/20 to-orange-900/20 border-red-500/20">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              Car Salesman Network Benefits
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-red-400 mt-1" />
                <div>
                  <h4 className="font-medium">Licensed Professional Badge</h4>
                  <p className="text-sm text-white/70">Display your dealership credentials</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wrench className="h-5 w-5 text-ts-orange mt-1" />
                <div>
                  <h4 className="font-medium">Brand Specialization</h4>
                  <p className="text-sm text-white/70">Showcase your automotive expertise</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-emerald-400 mt-1" />
                <div>
                  <h4 className="font-medium">Higher Conversion Rates</h4>
                  <p className="text-sm text-white/70">Licensed status builds trust</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-purple-400 mt-1" />
                <div>
                  <h4 className="font-medium">Professional Credibility</h4>
                  <p className="text-sm text-white/70">Stand out from private sellers</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Form */}
        <Card className="bg-tsCard border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-500" />
              Car Salesman Verification Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* License Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-400">License Information</h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dealerLicense"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dealer License Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter dealer license number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="salesmanLicense"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salesman License (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter salesman license" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
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
                  </div>
                </div>

                {/* Dealership Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-400">Dealership Information</h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dealershipName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dealership Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter dealership name" {...field} />
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

                {/* Specializations */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-400">Vehicle Specializations</h3>
                  <p className="text-sm text-white/60">Select your areas of expertise</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {vehicleSpecializations.map((specialization) => (
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

                {/* Brand Specialties */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-400">Brand Specialties</h3>
                  <p className="text-sm text-white/60">Select brands you specialize in selling</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {carBrands.map((brand) => (
                      <div key={brand} className="flex items-center space-x-2">
                        <Checkbox
                          id={brand}
                          checked={selectedBrands.includes(brand)}
                          onCheckedChange={() => handleBrandToggle(brand)}
                        />
                        <label
                          htmlFor={brand}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {brand}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Service Areas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-400">Service Areas</h3>
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
                <div className="mt-8 p-6 bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Info className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                        Application Tips
                      </h4>
                      <ul className="text-red-800 dark:text-red-200 text-sm space-y-1">
                        <li>• Ensure your dealer license is current and in good standing</li>
                        <li>• Provide accurate dealership affiliation information</li>
                        <li>• Select specializations that match your sales experience</li>
                        <li>• Include brand certifications if applicable</li>
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
                      submitApplicationMutation.isPending ||
                      selectedSpecializations.length === 0 ||
                      selectedBrands.length === 0
                    }
                    className="bg-red-600 hover:bg-red-700 flex-1"
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
