import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Share2, Eye, MousePointer, TrendingUp, Calendar, DollarSign, MapPin, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const promoFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be under 100 characters"),
  description: z.string().min(1, "Description is required"),
  offerDetails: z.string().min(1, "Offer details are required"),
  discountType: z.enum(["percentage", "fixed_amount", "free_service", "bundle_deal"]),
  discountValue: z.string().optional(),
  minimumJobValue: z.string().optional(),
  promoCode: z.string().max(20).optional(),
  maxUses: z.string().optional(),
  expiresAt: z.string().optional(),
});

type PromoFormValues = z.infer<typeof promoFormSchema>;

interface ContractorPromo {
  id: string;
  title: string;
  description: string;
  offerDetails: string;
  discountType: string;
  discountValue: string;
  minimumJobValue: string;
  promoCode?: string;
  isActive: boolean;
  maxUses?: number;
  currentUses: number;
  viewCount: number;
  clickCount: number;
  connectionCount: number;
  slug: string;
  expiresAt?: string;
  createdAt: string;
}

function PromoForm({ promo, onClose }: { promo?: ContractorPromo; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<PromoFormValues>({
    resolver: zodResolver(promoFormSchema),
    defaultValues: {
      title: promo?.title || "",
      description: promo?.description || "",
      offerDetails: promo?.offerDetails || "",
      discountType: promo?.discountType as any || "percentage",
      discountValue: promo?.discountValue || "",
      minimumJobValue: promo?.minimumJobValue || "",
      promoCode: promo?.promoCode || "",
      maxUses: promo?.maxUses?.toString() || "",
      expiresAt: promo?.expiresAt ? new Date(promo.expiresAt).toISOString().split('T')[0] : "",
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: PromoFormValues) => apiRequest("/api/contractor-promos", {
      method: "POST",
      body: {
        ...data,
        discountValue: data.discountValue ? parseFloat(data.discountValue) : null,
        minimumJobValue: data.minimumJobValue ? parseFloat(data.minimumJobValue) : null,
        maxUses: data.maxUses ? parseInt(data.maxUses) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-promos"] });
      toast({ title: "Promo created successfully!" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create promo", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: PromoFormValues) => apiRequest(`/api/contractor-promos/${promo!.id}`, {
      method: "PUT",
      body: {
        ...data,
        discountValue: data.discountValue ? parseFloat(data.discountValue) : null,
        minimumJobValue: data.minimumJobValue ? parseFloat(data.minimumJobValue) : null,
        maxUses: data.maxUses ? parseInt(data.maxUses) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-promos"] });
      toast({ title: "Promo updated successfully!" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to update promo", variant: "destructive" });
    }
  });

  const onSubmit = (data: PromoFormValues) => {
    if (promo) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Promo Title</FormLabel>
              <FormControl>
                <Input placeholder="Winter Special - 20% Off All Services" {...field} />
              </FormControl>
              <FormDescription>This will be the main headline for your promo</FormDescription>
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
                  placeholder="Get ready for winter with our professional roofing services. Limited time offer for new customers."
                  {...field} 
                />
              </FormControl>
              <FormDescription>Detailed description of your promotional offer</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="offerDetails"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Offer Details</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="20% off all roofing installations and repairs. Free inspection included. Valid through December 31st."
                  {...field} 
                />
              </FormControl>
              <FormDescription>Specific terms and conditions of your offer</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="discountType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select discount type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Off</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount Off</SelectItem>
                    <SelectItem value="free_service">Free Service</SelectItem>
                    <SelectItem value="bundle_deal">Bundle Deal</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discountValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount Value</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="20 (for 20% or $20)" 
                    type="number" 
                    step="0.01" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>Amount or percentage</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="minimumJobValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Job Value</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="500" 
                    type="number" 
                    step="0.01" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>Minimum project cost to qualify</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="promoCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Promo Code (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="WINTER20" {...field} />
                </FormControl>
                <FormDescription>Custom code customers can mention</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="maxUses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Uses (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="50" 
                    type="number" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>Limit number of customers</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expiration Date (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>When the promo expires</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending 
              ? "Saving..." 
              : promo ? "Update Promo" : "Create Promo"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}

function PromoCard({ promo }: { promo: ContractorPromo }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/contractor-promos/${promo.id}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-promos"] });
      toast({ title: "Promo deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete promo", variant: "destructive" });
    }
  });

  const shareUrl = `${window.location.origin}/promo/${promo.slug}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Promo link copied to clipboard!" });
  };

  const formatDiscountValue = () => {
    if (promo.discountType === 'percentage') {
      return `${promo.discountValue}%`;
    } else if (promo.discountType === 'fixed_amount') {
      return `$${promo.discountValue}`;
    }
    return promo.discountValue;
  };

  const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
  const isUsageLimitReached = promo.maxUses && promo.currentUses >= promo.maxUses;

  return (
    <Card className={`${!promo.isActive || isExpired || isUsageLimitReached ? 'opacity-60' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{promo.title}</CardTitle>
            <CardDescription className="mt-1">{promo.description}</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Promo</DialogTitle>
                  <DialogDescription>
                    Update your promotional campaign details
                  </DialogDescription>
                </DialogHeader>
                <PromoForm promo={promo} onClose={() => setShowForm(false)} />
              </DialogContent>
            </Dialog>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant={promo.isActive && !isExpired && !isUsageLimitReached ? "default" : "secondary"}>
            {!promo.isActive ? "Inactive" : isExpired ? "Expired" : isUsageLimitReached ? "Limit Reached" : "Active"}
          </Badge>
          <Badge variant="outline">
            <DollarSign className="h-3 w-3 mr-1" />
            {formatDiscountValue()} Off
          </Badge>
          {promo.expiresAt && (
            <Badge variant="outline">
              <Calendar className="h-3 w-3 mr-1" />
              Expires {new Date(promo.expiresAt).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-medium text-orange-600 mb-1">Offer Details:</p>
            <p className="text-gray-600">{promo.offerDetails}</p>
          </div>

          {promo.promoCode && (
            <div className="text-sm">
              <p className="font-medium">Promo Code:</p>
              <code className="bg-[#0f1419] px-2 py-1 rounded text-sm">{promo.promoCode}</code>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
            <div>
              <div className="flex items-center justify-center text-blue-600 mb-1">
                <Eye className="h-4 w-4 mr-1" />
              </div>
              <div className="text-2xl font-bold">{promo.viewCount}</div>
              <div className="text-sm text-gray-500">Views</div>
            </div>
            <div>
              <div className="flex items-center justify-center text-green-600 mb-1">
                <MousePointer className="h-4 w-4 mr-1" />
              </div>
              <div className="text-2xl font-bold">{promo.clickCount}</div>
              <div className="text-sm text-gray-500">Clicks</div>
            </div>
            <div>
              <div className="flex items-center justify-center text-orange-600 mb-1">
                <TrendingUp className="h-4 w-4 mr-1" />
              </div>
              <div className="text-2xl font-bold">{promo.connectionCount}</div>
              <div className="text-sm text-gray-500">Connections</div>
            </div>
          </div>

          {promo.maxUses && (
            <div className="text-sm">
              <p className="font-medium">Usage:</p>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((promo.currentUses / promo.maxUses) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs">{promo.currentUses}/{promo.maxUses}</span>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Share Link:</span>
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Share2 className="h-4 w-4 mr-1" />
                Copy Link
              </Button>
            </div>
            <div className="mt-2 p-2 bg-[#0f1419] rounded text-xs break-all">
              {shareUrl}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ContractorPromos() {
  const [showForm, setShowForm] = useState(false);
  
  const { data: promos, isLoading } = useQuery({
    queryKey: ["/api/contractor-promos"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1419] py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">Loading your promos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Promotional Campaigns</h1>
            <p className="text-gray-600 mt-2">
              Create and manage your promotional offers with shareable links for local marketing
            </p>
          </div>
          
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Promo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Promotional Campaign</DialogTitle>
                <DialogDescription>
                  Create a shareable promotional offer that you can use for local marketing
                </DialogDescription>
              </DialogHeader>
              <PromoForm onClose={() => setShowForm(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {!promos || promos.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-gray-500 mb-4">
                <MapPin className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No promotional campaigns yet</h3>
                <p className="text-sm">
                  Create your first promotional campaign to start attracting customers with special offers
                </p>
              </div>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Promo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {promos.map((promo: ContractorPromo) => (
              <PromoCard key={promo.id} promo={promo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}