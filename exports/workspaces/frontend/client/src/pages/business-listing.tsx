import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Building2, DollarSign, Users, TrendingUp, FileText, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Business listing form schema
const businessListingSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters"),
  description: z.string().min(100, "Description must be at least 100 characters"),
  price: z.string().min(1, "Price is required"),
  priceType: z.enum(["fixed", "negotiable", "best_offer"]),
  businessType: z.enum([
    "restaurant",
    "retail",
    "service",
    "manufacturing",
    "technology",
    "franchise",
    "online",
    "business_package",
    "other",
  ]),
  offeringType: z.enum(["complete_business", "business_package", "franchise_opportunity"]),
  industry: z.string().min(2, "Industry is required"),
  location: z.string().min(5, "Location is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "Zip code is required"),
  yearEstablished: z.string().optional(),
  employees: z.string().optional(),
  monthlyRevenue: z.string().optional(),
  annualRevenue: z.string().optional(),
  reasonForSelling: z.string().min(20, "Please explain why you're selling"),
  includesTraining: z.boolean().default(false),
  includesInventory: z.boolean().default(false),
  includesEquipment: z.boolean().default(false),
  includesLease: z.boolean().default(false),
  includesCustomerBase: z.boolean().default(false),
  features: z.array(z.string()).default([]),
});

type BusinessListingForm = z.infer<typeof businessListingSchema>;

const businessTypes = [
  { value: "restaurant", label: "Restaurant/Food Service" },
  { value: "retail", label: "Retail Store" },
  { value: "service", label: "Service Business" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "technology", label: "Technology/Software" },
  { value: "franchise", label: "Franchise" },
  { value: "online", label: "Online Business" },
  { value: "business_package", label: "Business Package/Model" },
  { value: "other", label: "Other" },
];

const offeringTypes = [
  { value: "complete_business", label: "Complete Business Sale" },
  { value: "business_package", label: "Business Package/System" },
  { value: "franchise_opportunity", label: "Franchise Opportunity" },
];

const businessFeatures = [
  "Established Customer Base",
  "Strong Online Presence",
  "Recurring Revenue",
  "Low Competition",
  "Growth Potential",
  "Prime Location",
  "Long-term Contracts",
  "Profitable Operations",
  "Experienced Staff",
  "Updated Equipment",
  "Strong Brand Recognition",
  "Multiple Revenue Streams",
  "Proven Business Model",
  "Comprehensive Training",
  "Marketing Systems",
  "Operations Manual",
  "Territory Protection",
  "Ongoing Support",
];

export default function BusinessListing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const form = useForm<BusinessListingForm>({
    resolver: zodResolver(businessListingSchema),
    defaultValues: {
      priceType: "negotiable",
      businessType: "other",
      offeringType: "complete_business",
      includesTraining: false,
      includesInventory: false,
      includesEquipment: false,
      includesLease: false,
      includesCustomerBase: false,
      features: [],
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: BusinessListingForm) => {
      // First get the Sell Your Business category ID
      const categories = await apiRequest("GET", "/api/marketplace/categories");
      const businessCategory = categories.find((cat: any) => cat.name === "Sell Your Business");

      if (!businessCategory) {
        throw new Error("Business category not found");
      }

      const listingData = {
        categoryId: businessCategory.id,
        title: data.title,
        description: data.description,
        price: parseFloat(data.price),
        priceType: data.priceType,
        county: data.city, // Using city as county for now
        state: data.state,
        city: data.city,
        zipCode: data.zipCode,
        condition: "excellent", // Default for businesses
        specifications: {
          offeringType: data.offeringType,
          businessType: data.businessType,
          industry: data.industry,
          yearEstablished: data.yearEstablished ? parseInt(data.yearEstablished) : undefined,
          employees: data.employees ? parseInt(data.employees) : undefined,
          monthlyRevenue: data.monthlyRevenue ? parseFloat(data.monthlyRevenue) : undefined,
          annualRevenue: data.annualRevenue ? parseFloat(data.annualRevenue) : undefined,
          reasonForSelling: data.reasonForSelling,
          includesTraining: data.includesTraining,
          includesInventory: data.includesInventory,
          includesEquipment: data.includesEquipment,
          includesLease: data.includesLease,
          includesCustomerBase: data.includesCustomerBase,
          features: selectedFeatures,
          location: data.location,
        },
        isLocalPickupOnly: true,
        willShip: false,
      };

      return apiRequest("POST", "/api/marketplace/listings", listingData);
    },
    onSuccess: () => {
      toast({
        title: "Business Submitted Successfully!",
        description:
          "Your business has been submitted for admin review. It will appear in the marketplace once approved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Listing",
        description: formatUserFacingErrorMessage(error, "Something went wrong. Please try again."),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BusinessListingForm) => {
    const formData = { ...data, features: selectedFeatures };
    createListingMutation.mutate(formData);
  };

  const handleFeatureToggle = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="h-8 w-8 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-bold text-ts-orange">List Your Business Opportunity</h1>
            <p className="text-white/60 dark:text-white/60">
              Sell complete businesses, business packages, or franchise opportunities to qualified
              buyers
            </p>
          </div>
        </div>
      </div>

      {/* Approval Notice */}
      <Alert className="mb-8 border-blue-500/20 bg-blue-500/10">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-100">
          <strong>Approval Process:</strong> All business listings require admin approval before
          going live. This ensures authenticity and helps maintain our trusted marketplace
          environment. You'll be notified once your listing is reviewed.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Business Details
          </CardTitle>
          <CardDescription>
            Provide comprehensive information to help buyers understand your business's value and
            potential
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-ts-orange">Basic Information</h3>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Established Pizza Restaurant in Prime Location"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your business operations, customer base, competitive advantages, growth potential, and what makes it a valuable opportunity..."
                          className="min-h-40"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="offeringType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What Are You Offering?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select offering type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {offeringTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose between selling an existing business, proven business model/package,
                        or franchise opportunity
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select business type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {businessTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
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
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Food & Beverage, Construction, Healthcare"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-ts-orange">Location</h3>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Location</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main Street or General Area" {...field} />
                      </FormControl>
                      <FormDescription>
                        Provide general location - specific address can be shared with qualified
                        buyers
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
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

                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input placeholder="90210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Business Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-ts-orange flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Business Performance
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="yearEstablished"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year Established</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2015" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Employees</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthlyRevenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Average Monthly Revenue</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50000" {...field} />
                        </FormControl>
                        <FormDescription>
                          Optional - helps qualified buyers understand scale
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="annualRevenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Revenue</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="600000" {...field} />
                        </FormControl>
                        <FormDescription>Optional - provide if comfortable sharing</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-ts-orange flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  Pricing & Terms
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asking Price</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="500000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed Price</SelectItem>
                            <SelectItem value="negotiable">Negotiable</SelectItem>
                            <SelectItem value="best_offer">Best Offer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reasonForSelling"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for Selling</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Retirement, relocation, pursuing other opportunities..."
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Honest explanation helps build trust with potential buyers
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* What's Included */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-ts-orange flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  What's Included in Sale
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="includesTraining"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Training & Support</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="includesInventory"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Current Inventory</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="includesEquipment"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Equipment & Assets</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="includesLease"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Lease Agreement</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="includesCustomerBase"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Customer Database</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Business Features */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-ts-orange">Key Business Strengths</h3>
                <p className="text-sm text-white/60 dark:text-white/60">
                  Select features that highlight your business's competitive advantages
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {businessFeatures.map((feature) => (
                    <div key={feature} className="flex items-center space-x-2">
                      <Checkbox
                        id={feature}
                        checked={selectedFeatures.includes(feature)}
                        onCheckedChange={() => handleFeatureToggle(feature)}
                      />
                      <label
                        htmlFor={feature}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {feature}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <Button type="button" variant="outline" onClick={() => setLocation("/marketplace")}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createListingMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {createListingMutation.isPending ? "Creating Listing..." : "List Business"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
