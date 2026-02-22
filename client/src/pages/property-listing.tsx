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
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { Home, MapPin, DollarSign, Building, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StateCountySelector } from "@/components/state-county-selector";

// Property listing form schema
const propertyListingSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  price: z.string().min(1, "Price is required"),
  priceType: z.enum(["fixed", "negotiable", "best_offer"]),
  propertyType: z.enum(["house", "condo", "townhouse", "land", "commercial", "multifamily"]),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "Zip code is required"),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  squareFeet: z.string().optional(),
  lotSize: z.string().optional(),
  yearBuilt: z.string().optional(),
  condition: z.enum(["new", "excellent", "good", "fair", "needs_work"]),
  isForSale: z.boolean().default(true),
  isForRent: z.boolean().default(false),
  monthlyRent: z.string().optional(),
  features: z.array(z.string()).default([]),
});

type PropertyListingForm = z.infer<typeof propertyListingSchema>;

const propertyTypes = [
  { value: "house", label: "Single Family House" },
  { value: "condo", label: "Condominium" },
  { value: "townhouse", label: "Townhouse" },
  { value: "land", label: "Land/Lot" },
  { value: "commercial", label: "Commercial Property" },
  { value: "multifamily", label: "Multi-Family" },
];

const conditionOptions = [
  { value: "new", label: "New Construction" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "needs_work", label: "Needs Work" },
];

const propertyFeatures = [
  "Garage",
  "Pool",
  "Fireplace",
  "Hardwood Floors",
  "Updated Kitchen",
  "Central Air",
  "Basement",
  "Deck/Patio",
  "Fenced Yard",
  "Mountain View",
  "Ocean View",
  "City View",
  "Recently Renovated",
  "Move-in Ready",
];

export default function PropertyListing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [propertyStateCode, setPropertyStateCode] = useState<string>("");
  const [propertyCountyFips, setPropertyCountyFips] = useState<string>("");
  const [inspectionFile, setInspectionFile] = useState<File | null>(null);
  const [inspectionDate, setInspectionDate] = useState<string>("");
  const [inspectionSummary, setInspectionSummary] = useState<string>("");
  const [listingAuthorType, setListingAuthorType] = useState<"owner" | "agent">("owner");
  const [presaleSuggestions, setPresaleSuggestions] = useState<
    { title: string; why?: string; effort?: string; costRange?: string; timeline?: string }[]
  >([]);

  const form = useForm<PropertyListingForm>({
    resolver: zodResolver(propertyListingSchema),
    defaultValues: {
      priceType: "fixed",
      propertyType: "house",
      condition: "good",
      isForSale: true,
      isForRent: false,
      features: [],
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: PropertyListingForm) => {
      if (!propertyStateCode || !propertyCountyFips) {
        throw new Error("Select the property state and county.");
      }

      const listingData = {
        title: data.title,
        description: data.description,
        price: parseFloat(data.price),
        countyFips: propertyCountyFips,
        stateCode: propertyStateCode,
        listingAuthorType,
        city: data.city,
        zipCode: data.zipCode,
        address1: data.address,
        propertyType: data.propertyType,
        beds: data.bedrooms ? parseInt(data.bedrooms) : undefined,
        baths: data.bathrooms ? parseFloat(data.bathrooms) : undefined,
        sqft: data.squareFeet ? parseInt(data.squareFeet) : undefined,
        yearBuilt: data.yearBuilt ? parseInt(data.yearBuilt) : undefined,
        features: selectedFeatures,
      };

      return apiRequest("POST", "/api/homescout/listings", listingData);
    },
    onSuccess: async (data: any) => {
      toast({
        title: "Property Submitted Successfully!",
        description:
          "Your property has been submitted for admin review. It will appear in the marketplace once approved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/homescout/my-listings"] });
      form.reset();

      const id = data?.id;
      if (typeof id === "string" && id.length > 0) {
        // Optional: attach a seller pre-listing inspection report right away.
        if (inspectionFile) {
          try {
            const { publicUrl } = await uploadObject(inspectionFile);
            await apiRequest("POST", `/api/homescout/listings/${id}/inspection-reports`, {
              reportType: "seller_pre_listing",
              reportUrl: publicUrl,
              inspectionDate: inspectionDate?.trim() || null,
              summary: inspectionSummary?.trim() || null,
            });
          } catch (err: any) {
            toast({
              title: "Listing created, but report upload failed",
              description: err?.message || "You can upload it later from the listing page.",
              variant: "destructive",
            });
          }
        }

        setLocation(`/homescout/listings/${id}`);
      }

      setInspectionFile(null);
      setInspectionDate("");
      setInspectionSummary("");
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Listing",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const presaleSuggestionsMutation = useMutation({
    mutationFn: async () => {
      if (!propertyStateCode || !propertyCountyFips) {
        throw new Error("Select the property state and county first.");
      }

      const values = form.getValues();
      const sqft = values.squareFeet ? Number.parseInt(values.squareFeet, 10) : undefined;
      const yearBuilt = values.yearBuilt ? Number.parseInt(values.yearBuilt, 10) : undefined;

      return apiRequest("POST", "/api/homescout/presale-suggestions", {
        stateCode: propertyStateCode,
        countyFips: propertyCountyFips,
        propertyType: values.propertyType,
        condition: values.condition,
        sqft: Number.isFinite(sqft as any) ? sqft : undefined,
        yearBuilt: Number.isFinite(yearBuilt as any) ? yearBuilt : undefined,
        features: selectedFeatures,
      });
    },
    onSuccess: (data: any) => {
      const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setPresaleSuggestions(suggestions);
    },
    onError: (err: any) => {
      toast({
        title: "Could not generate suggestions",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PropertyListingForm) => {
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
          <Home className="h-8 w-8 text-orange-600" />
          <div>
            <h1 className="text-3xl font-bold text-orange-500">List Your Property</h1>
            <p className="text-gray-600 dark:text-gray-400">
              List any property location. Select the state and county where the property is located.
            </p>
          </div>
        </div>
      </div>

      {/* Approval Notice */}
      <Alert className="mb-8 border-blue-500/20 bg-blue-500/10">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-100">
          <strong>Approval Process:</strong> All property listings require admin approval before
          going live. This ensures accuracy and helps maintain our trusted marketplace environment.
          You'll be notified once your listing is reviewed.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-orange-600" />
            Property Details
          </CardTitle>
          <CardDescription>
            Provide comprehensive information to help buyers understand your property's value
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {String((user as any)?.role || "") === "realtor" ? (
                <div className="rounded-md border p-4 bg-muted/20 space-y-2">
                  <div className="font-medium">Posting as</div>
                  <div className="flex items-center gap-6 flex-wrap">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="listingAuthorType"
                        value="owner"
                        checked={listingAuthorType === "owner"}
                        onChange={() => setListingAuthorType("owner")}
                      />
                      Owner
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="listingAuthorType"
                        value="agent"
                        checked={listingAuthorType === "agent"}
                        onChange={() => setListingAuthorType("agent")}
                      />
                      Agent
                    </label>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Agent-posted listings require an approved Realtor profile.
                  </div>
                </div>
              ) : null}
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-500">Basic Information</h3>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Beautiful 3BR Home in Prime Location"
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your property's features, location benefits, and what makes it special..."
                          className="min-h-32"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select property type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {propertyTypes.map((type) => (
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
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {conditionOptions.map((condition) => (
                              <SelectItem key={condition.value} value={condition.value}>
                                {condition.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Optional inspection report */}
              <div className="space-y-4 pt-6 border-t border-border/60">
                <h3 className="text-lg font-semibold text-orange-500">
                  Inspection Report (Optional)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  If you have a recent home inspection report, you can attach it now. You can also
                  add it later from the listing page.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormLabel>Inspection date (optional)</FormLabel>
                    <Input
                      type="date"
                      value={inspectionDate}
                      onChange={(e) => setInspectionDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Report file (PDF preferred)</FormLabel>
                    <Input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setInspectionFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel>Quick summary (optional)</FormLabel>
                  <Textarea
                    value={inspectionSummary}
                    onChange={(e) => setInspectionSummary(e.target.value)}
                    placeholder="Any highlights you want buyers to understand up front…"
                  />
                </div>
              </div>

              {/* Prep suggestions */}
              <div className="space-y-4 pt-6 border-t border-border/60">
                <h3 className="text-lg font-semibold text-orange-500">Prep Suggestions</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Quick, practical steps that can increase appeal before photos and showings.
                </p>

                <div className="flex items-center gap-3 flex-col sm:flex-row">
                  <Button
                    type="button"
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
                    onClick={() => presaleSuggestionsMutation.mutate()}
                    disabled={presaleSuggestionsMutation.isPending}
                  >
                    {presaleSuggestionsMutation.isPending ? "Generating..." : "Get suggestions"}
                  </Button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 w-full">
                    Uses your property details plus your selected county.
                  </div>
                </div>

                {presaleSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    {presaleSuggestions.slice(0, 10).map((s, idx) => (
                      <div key={`${idx}-${s.title}`} className="rounded-md border p-3 bg-muted/30">
                        <div className="font-medium">{s.title}</div>
                        {s.why ? (
                          <div className="text-sm text-muted-foreground mt-1">{s.why}</div>
                        ) : null}
                        <div className="text-xs text-muted-foreground mt-2">
                          {[
                            s.effort ? `effort: ${s.effort}` : null,
                            s.costRange ? `cost: ${s.costRange}` : null,
                            s.timeline ? `timeline: ${s.timeline}` : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-500 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-orange-600" />
                  Location
                </h3>

                <StateCountySelector
                  selectedState={propertyStateCode}
                  selectedCounty={propertyCountyFips}
                  onStateChange={(nextStateCode) => {
                    setPropertyStateCode(nextStateCode);
                    form.setValue("state", nextStateCode, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  onCountyChange={setPropertyCountyFips}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main Street" {...field} />
                      </FormControl>
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
                          <Input placeholder="CA" {...field} disabled />
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

              {/* Property Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-500">Property Details</h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bedrooms</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="3" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bathrooms</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="2.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="squareFeet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Feet</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="yearBuilt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year Built</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2020" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="lotSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lot Size</FormLabel>
                      <FormControl>
                        <Input placeholder="0.25 acres or 10,000 sq ft" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-500 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-600" />
                  Pricing
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price</FormLabel>
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

                <div className="flex items-center space-x-4">
                  <FormField
                    control={form.control}
                    name="isForSale"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>For Sale</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isForRent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>For Rent</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch("isForRent") && (
                  <FormField
                    control={form.control}
                    name="monthlyRent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Rent</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="3000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Property Features */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-500">Property Features</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select features that make your property special
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {propertyFeatures.map((feature) => (
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
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {createListingMutation.isPending
                    ? "Creating HomeScout Listing..."
                    : "List on HomeScout"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
