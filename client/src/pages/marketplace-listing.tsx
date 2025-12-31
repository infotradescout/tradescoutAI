import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  DollarSign, 
  MapPin,
  Clock,
  Shield,
  Eye,
  Info,
  Image as ImageIcon,
  X,
  Upload
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const marketplaceListingSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  price: z.string().min(1, "Price is required"),
  originalPrice: z.string().optional(),
  priceType: z.enum(["fixed", "negotiable", "obo", "trade"]),
  condition: z.enum(["new", "like_new", "good", "fair", "needs_repair"]),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "ZIP code is required"),
  locationVisibility: z.enum(["exact", "meetup_only"]),
  images: z.array(z.string()).optional(),
});

type MarketplaceListingForm = z.infer<typeof marketplaceListingSchema>;

export default function MarketplaceListing() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const form = useForm<MarketplaceListingForm>({
    resolver: zodResolver(marketplaceListingSchema),
    defaultValues: {
      title: "",
      description: "",
      price: "",
      originalPrice: "",
      priceType: "fixed",
      condition: "good",
      category: "",
      subcategory: "",
      city: "",
      state: "",
      zipCode: "",
      locationVisibility: "exact",
      images: [],
    },
  });

  const handleImagesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingImage(true);
    try {
      const newImageUrls: string[] = [];
      
      for (const file of files) {
        if (uploadedImages.length + newImageUrls.length >= 8) {
          toast({
            title: "Upload limit reached",
            description: "You can upload a maximum of 8 images per listing.",
            variant: "destructive",
          });
          break;
        }

        const { publicUrl } = await uploadObject(file);
        newImageUrls.push(publicUrl);
      }

      const updatedImages = [...uploadedImages, ...newImageUrls];
      setUploadedImages(updatedImages);
      form.setValue("images", updatedImages);

      toast({
        title: "Images uploaded",
        description: `${newImageUrls.length} image(s) added successfully.`,
      });
    } catch (error) {
      console.error("Image upload failed:", error);
      toast({
        title: "Upload failed",
        description: "Could not upload images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    const updated = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(updated);
    form.setValue("images", updated);
  };

  // Fetch marketplace categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/marketplace/categories"],
    retry: false,
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: MarketplaceListingForm) => {
      return apiRequest("POST", "/api/marketplace/listings", {
        ...data,
        sellerId: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      toast({
        title: "Listing Submitted Successfully!",
        description: "Your listing has been submitted for admin review. It will appear in the Exchange once approved.",
      });
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Create Listing",
        description: "There was an error creating your listing. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MarketplaceListingForm) => {
    createListingMutation.mutate(data);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-gray-600 mb-4">You need to be logged in to create Exchange listings.</p>
            <Button asChild className="bg-orange-600 hover:bg-orange-700">
              <Link href="/login">Log In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
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
            <Package className="h-8 w-8 text-orange-500" />
            Create Exchange Listing
          </h1>
          <p className="text-gray-400">
            List your quality items for the TradeScout community to discover
          </p>
        </div>

        {/* Approval Notice */}
        <Alert className="mb-8 border-blue-500/20 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-100">
            <strong>Approval Process:</strong> All listings require admin approval before going live. 
            This ensures quality standards and helps maintain our trusted Exchange environment. 
            You'll be notified once your listing is reviewed.
          </AlertDescription>
        </Alert>

        {/* Form */}
        <Card className="bg-navy-800 border-navy-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Listing Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter item title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    {/* Image Upload Section */}
                    <div className="space-y-3">
                  <FormLabel className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-orange-500" />
                    Photos (up to 8)
                  </FormLabel>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedImages.map((url, index) => (
                      <div key={index} className="relative group aspect-square">
                        <img
                          src={url}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border-2 border-navy-600"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ))}
                    
                    {uploadedImages.length < 8 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="aspect-square border-2 border-dashed border-navy-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-orange-500 hover:bg-orange-500/5 transition-colors"
                      >
                        {uploadingImage ? (
                          <>
                            <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-gray-400">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-gray-400" />
                            <span className="text-xs text-gray-400">Add Photo</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImagesSelected}
                  />
                  
                  <p className="text-xs text-gray-400">
                    Upload clear, well-lit photos of your item from multiple angles. Maximum 8 images.
                  </p>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoriesLoading ? (
                              <SelectItem value="loading">Loading...</SelectItem>
                            ) : (
                              (categories as any[]).map((category: any) => (
                                <SelectItem key={category.id} value={category.slug}>
                                  {category.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
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
                          placeholder="Describe your item in detail. Include condition, features, and any relevant history..."
                          rows={4}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pricing & Condition */}
                <div className="grid md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price ($)</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" type="number" step="0.01" {...field} />
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
                            <SelectItem value="obo">Or Best Offer</SelectItem>
                            <SelectItem value="trade">Open to Trade</SelectItem>
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
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="like_new">Like New</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="needs_repair">Needs Repair</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Location */}
                <div className="grid md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter city" {...field} />
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
                          <Input placeholder="CA" maxLength={2} {...field} />
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
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Location privacy */}
                <FormField
                  control={form.control}
                  name="locationVisibility"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Location privacy</FormLabel>
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(value) => {
                          if (value === "exact" || value === "meetup_only") {
                            field.onChange(value);
                          }
                        }}
                        className="inline-flex rounded-lg border border-slate-700 bg-slate-900 text-xs"
                      >
                        <ToggleGroupItem
                          value="exact"
                          className="px-3 py-1.5 data-[state=on]:bg-orange-500 data-[state=on]:text-white data-[state=on]:border-orange-500/80"
                        >
                          Show exact area
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="meetup_only"
                          className="px-3 py-1.5 data-[state=on]:bg-slate-800 data-[state=on]:text-white"
                        >
                          Meetup only
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <p className="text-xs text-gray-400">
                        Meetup only hides your exact spot and skips hyper-local alerts.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Value Enhancement Tips */}
                <div className="mt-8 p-6 bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Shield className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                        Smart Listing Tips
                      </h4>
                      <ul className="text-orange-800 dark:text-orange-200 text-sm space-y-1">
                        <li>• Include detailed photos showing actual condition</li>
                        <li>• Mention any warranties, original packaging, or documentation</li>
                        <li>• Highlight unique features or modifications that add value</li>
                        <li>• Be honest about wear - transparency builds trust and satisfaction</li>
                        <li>• Research comparable items to price competitively</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={createListingMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700 flex-1"
                  >
                    {createListingMutation.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Submitting for Review...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit for Approval
                      </>
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={createListingMutation.isPending}
                  >
                    Clear Form
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Post-Submission Information */}
        <Card
          className="mt-8 border-slate-600"
          style={{ backgroundColor: "var(--surface-card)" }}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Eye className="h-6 w-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-2">
                  What Happens Next?
                </h4>
                <div className="text-gray-300 text-sm space-y-2">
                  <p><strong>Review Process:</strong> Our team reviews all submissions to ensure quality and accuracy.</p>
                  <p><strong>Timeline:</strong> Most listings are reviewed within 24-48 hours.</p>
                  <p><strong>Notification:</strong> You'll receive an email when your listing is approved or if changes are needed.</p>
                  <p><strong>Going Live:</strong> Once approved, your listing becomes visible to all TradeScout users.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}