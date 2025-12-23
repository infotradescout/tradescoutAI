import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  Factory,
  Filter,
  Gavel,
  HeartHandshake,
  HelpCircle,
  Info,
  MapPin,
  Package,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  TrendingUp,
  Upload as UploadIcon,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
  Upload as UploadIcon
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLocationContext } from "@/hooks/useLocationContext";

interface ExchangeItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: 'new' | 'like-new' | 'good' | 'fair';
  images: string[];
  location: string;
  seller: {
    id: string;
    name: string;
    rating: number;
    verified: boolean;
  };
  createdAt: string;
  featured: boolean;
  views: number;
  favorites: number;
}

interface ContractorPromo {
  id: string;
  contractorId: string;
  title: string;
  description: string;
  offerDetails: string;
  discountType: 'percentage' | 'fixed_amount' | 'free_service' | 'bundle_deal';
  discountValue: number;
  minimumJobValue?: number;
  promoCode?: string;
  isActive: boolean;
  maxUses?: number;
  currentUses: number;
  serviceAreas: string[];
  tradeCategories: string[];
  startsAt: string;
  expiresAt?: string;
  slug: string;
  viewCount: number;
  clickCount: number;
  leadCount: number;
  contractor: {
    id: string;
    name: string;
    businessName: string;
    rating: number;
    verified: boolean;
    phone: string;
  };
}

interface CompanyPromotion {
  id: string;
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
  title: string;
  description: string;
  dealDetails: string;
  dealType: 'percentage_off' | 'dollar_off' | 'bogo' | 'free_shipping' | 'bundle_deal' | 'clearance';
  discountValue?: number;
  originalPrice?: number;
  salePrice?: number;
  promoCode?: string;
  minimumPurchase?: number;
  maxDiscount?: number;
  productCategories: string[];
  targetAudience: string[];
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  isFeatured: boolean;
  availableStates?: string[];
  storeLocationsOnly: boolean;
  slug: string;
  viewCount: number;
  clickCount: number;
  redemptionCount: number;
  terms?: string;
  restrictions?: string;
}

const EXCHANGE_CATEGORIES = [
  { id: 'business', name: 'Sell Your Business', icon: Building, description: 'Complete businesses, franchises, opportunities' },
  { id: 'real-estate', name: 'Real Estate', icon: Home, description: 'Houses, land, commercial properties' },
  { id: 'vehicles', name: 'Vehicles', icon: Car, description: 'Cars, trucks, motorcycles, boats' },
  { id: 'construction', name: 'Construction Equipment', icon: Wrench, description: 'Heavy machinery, tools, equipment' },
  { id: 'tools', name: 'Tools & Hardware', icon: Wrench, description: 'Professional tools, hardware' },
  { id: 'furniture', name: 'Furniture & Home', icon: Home, description: 'Quality furniture and home goods' },
  { id: 'farm', name: 'Farm Equipment', icon: TreePine, description: 'Agricultural equipment and livestock' },
  { id: 'business-equipment', name: 'Business Equipment', icon: Briefcase, description: 'Office and commercial equipment' },
  { id: 'electronics', name: 'Electronics', icon: Smartphone, description: 'High-end electronics and technology' },
  { id: 'sports', name: 'Sports & Recreation', icon: Trophy, description: 'Premium sports and recreation equipment' },
  { id: 'collectibles', name: 'Art & Collectibles', icon: Palette, description: 'Artwork, antiques, collectibles' },
  { id: 'jewelry', name: 'Jewelry & Luxury', icon: Gem, description: 'Fine jewelry and luxury items' },
  { id: 'local-food', name: 'Local Food & Artisan', icon: Package, description: 'Local foods and handmade goods' },
  { id: 'other', name: 'Other High-Value Items', icon: Package, description: 'Other premium equipment and valuables' }
];

export default function Exchange() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [priceRange, setPriceRange] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Sales section filters
  const [salesSearchQuery, setSalesSearchQuery] = useState("");
  const [salesCategory, setSalesCategory] = useState("");
  const [dealType, setDealType] = useState("");
  const [salesSortBy, setSalesSortBy] = useState("newest");

  const [route] = useLocation();

  const locationCtx = useLocationContext();
  const stateCode = locationCtx.stateCode as string | undefined;
  const county = (locationCtx.countyFips || (locationCtx as any).county) as
    | string
    | undefined;

  // Sell tab draft state (prefill from Scout)
  const [sellTitle, setSellTitle] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellDescription, setSellDescription] = useState("");
  const [sellLocation, setSellLocation] = useState("");
  const [sellLocationVisibility, setSellLocationVisibility] = useState<"exact" | "meetup_only">("exact");
  const [sellImages, setSellImages] = useState<string[]>([]);
  const [sellCategoryId, setSellCategoryId] = useState<string>("");
  const [sellCondition, setSellCondition] = useState<string>("");

  // Fetch exchange items
  const { data: items, isLoading } = useQuery<ExchangeItem[]>({
    queryKey: ['/api/exchange/items', selectedCategory, locationFilter, sortBy, priceRange, conditionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('categoryId', selectedCategory);
      }
      if (locationFilter) params.append('location', locationFilter);
      if (sortBy) params.append('sort', sortBy);
      if (priceRange) params.append('priceRange', priceRange);
      if (conditionFilter) params.append('condition', conditionFilter);
      
      const response = await fetch(`/api/exchange/items?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch items');
      return response.json();
    },
    enabled: activeTab === "browse",
  });

  const createListingMutation = useMutation({
    mutationFn: async (body: any) => {
      return apiRequest("POST", "/api/marketplace/listings", body);
    },
    onSuccess: () => {
      setSellTitle("");
      setSellPrice("");
      setSellDescription("");
      setSellLocation("");
      setSellLocationVisibility("exact");
      setSellImages([]);
      setSellCategoryId("");
      setSellCondition("");
      toast({
        title: "Listing submitted",
        description:
          "Your listing was submitted and is pending approval before going live.",
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/exchange/items", selectedCategory, locationFilter, sortBy, priceRange, conditionFilter],
      });

      setActiveTab("browse");
    },
    onError: (error: any) => {
      const message =
        (error && (error.message || (error as any).toString())) ||
        "Failed to create listing";
      toast({
        title: "Could not publish listing",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Fetch contractor promotions
  const { data: contractorPromos, isLoading: contractorPromosLoading } = useQuery<ContractorPromo[]>({
    queryKey: ['/api/exchange/contractor-promos', salesSearchQuery, salesCategory, salesSortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salesSearchQuery) params.append('search', salesSearchQuery);
      if (salesCategory) params.append('category', salesCategory);
      if (salesSortBy) params.append('sort', salesSortBy);
      
      const response = await fetch(`/api/exchange/contractor-promos?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch contractor promotions');
      return response.json();
    },
    enabled: activeTab === "sales",
  });

  // Fetch company promotions
  const { data: companyPromotions, isLoading: companyPromotionsLoading } = useQuery<CompanyPromotion[]>({
    queryKey: ['/api/exchange/company-promotions', salesSearchQuery, dealType, salesSortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salesSearchQuery) params.append('search', salesSearchQuery);
      if (dealType) params.append('dealType', dealType);
      if (salesSortBy) params.append('sort', salesSortBy);
      
      const response = await fetch(`/api/exchange/company-promotions?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch company promotions');
      return response.json();
    },
    enabled: activeTab === "sales",
  });

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [items, searchQuery]);

  const getCategoryIcon = (categoryId: string) => {
    const category = EXCHANGE_CATEGORIES.find(cat => cat.id === categoryId);
    return category ? category.icon : Package;
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    }
    return `$${price.toLocaleString()}`;
  };

  const getConditionBadge = (condition: string) => {
    const colors = {
      'new': 'bg-green-500',
      'like-new': 'bg-blue-500',
      'good': 'bg-yellow-500',
      'fair': 'bg-orange-500'
    };
    return colors[condition as keyof typeof colors] || 'bg-[#0f1419]0';
  };

  const shareLink = async (url: string, title: string, text?: string) => {
    try {
      const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
      const shareText = (text || '').toString().slice(0, 200);

      if (navigator.share) {
        try {
          await navigator.share({ title, text: shareText, url: fullUrl });
          return;
        } catch (err: any) {
          if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
            return;
          }
        }
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(fullUrl);
        toast({
          title: 'Link copied',
          description: 'Share link copied to your clipboard.',
        });
      } else {
        toast({
          title: 'Unable to share automatically',
          description: 'Copy the link from your browser address bar to share.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Unable to share',
        description: 'Something went wrong while preparing the share link.',
        variant: 'destructive',
      });
    }
  };

  // Allow Scout to prefill the sell form via
  // /exchange?tab=sell&title=...&description=...&price=...&loc=...
  useEffect(() => {
    if (!route) return;

    const queryIndex = route.indexOf("?");
    if (queryIndex === -1) return;

    const search = route.slice(queryIndex + 1);
    const params = new URLSearchParams(search);

    const tab = params.get("tab");
    const title = params.get("title");
    const description = params.get("description");
    const price = params.get("price");
    const loc = params.get("loc");

    if (tab === "sell") {
      setActiveTab("sell");
    }

    if (title) setSellTitle(title);
    if (description) setSellDescription(description);
    if (price) setSellPrice(price);
    if (loc) setSellLocation(loc);
  }, [route]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Exchange</h1>
        <p className="text-gray-300">Local exchange for properties, vehicles, businesses, equipment, and other big-ticket deals</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-5 bg-[#1a2332] border border-slate-700 rounded-xl overflow-hidden text-[11px] sm:text-xs">
          <TabsTrigger
            value="browse"
            className="flex items-center justify-center px-2.5 py-2 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            Browse Items
          </TabsTrigger>
          <TabsTrigger
            value="sales"
            className="flex items-center justify-center px-2.5 py-2 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700 relative"
          >
            <Tag className="h-3 w-3 mr-1" />
            <span>Sales &amp; Deals</span>
            <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5">HOT</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="flex items-center justify-center px-2.5 py-2 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            Categories
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className="flex items-center justify-center px-2.5 py-2 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            Sell Item
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          {/* Search and Filters */}
          <Card className="bg-[#1a2332] border-slate-700">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search local properties, vehicles, equipment, and more..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="all">All Categories</SelectItem>
                    {EXCHANGE_CATEGORIES.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Price Range" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="any">Any Price</SelectItem>
                    <SelectItem value="0-1000">Under $1K</SelectItem>
                    <SelectItem value="1000-5000">$1K - $5K</SelectItem>
                    <SelectItem value="5000-25000">$5K - $25K</SelectItem>
                    <SelectItem value="25000-100000">$25K - $100K</SelectItem>
                    <SelectItem value="100000+">$100K+</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={conditionFilter} onValueChange={setConditionFilter}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Condition" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="any">Any Condition</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="like-new">Like New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="bg-[#1a2332] border-slate-700 animate-pulse">
                  <div className="h-48 bg-slate-700 rounded-t-lg"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-slate-700 rounded mb-2"></div>
                    <div className="h-6 bg-slate-700 rounded mb-2"></div>
                    <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))
            ) : filteredItems?.length > 0 ? (
              filteredItems.map((item) => {
                const IconComponent = getCategoryIcon(item.category);
                return (
                  <Card key={item.id} className="bg-[#1a2332] border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer">
                    <div className="relative">
                      {item.images && item.images.length > 0 ? (
                        <div className="h-48 bg-slate-900 rounded-t-lg overflow-hidden">
                          <img
                            src={item.images[0]}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-48 bg-slate-700 rounded-t-lg flex items-center justify-center">
                          <IconComponent className="h-12 w-12 text-slate-500" />
                        </div>
                      )}
                      {item.featured && (
                        <Badge className="absolute top-2 right-2 bg-orange-500">
                          Featured
                        </Badge>
                      )}
                      <Badge className={`absolute top-2 left-2 ${getConditionBadge(item.condition)}`}>
                        {item.condition}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-white mb-1 line-clamp-1">{item.title}</h3>
                      <p className="text-2xl font-bold text-orange-500 mb-2">{formatPrice(item.price)}</p>
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{item.description}</p>
                      
                      <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {item.location}
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center">
                            <Eye className="h-3 w-3 mr-1" />
                            {item.views}
                          </div>
                          <div className="flex items-center">
                            <Heart className="h-3 w-3 mr-1" />
                            {item.favorites}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center mr-2">
                            <span className="text-xs text-white">{item.seller.name[0]}</span>
                          </div>
                          <div>
                            <p className="text-xs text-white">{item.seller.name}</p>
                            <div className="flex items-center">
                              <Star className="h-3 w-3 text-yellow-500 mr-1" />
                              <span className="text-xs text-gray-400">{item.seller.rating}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-300 hover:text-white"
                            onClick={() =>
                              shareLink(
                                `/exchange?item=${encodeURIComponent(item.id)}`,
                                item.title || 'Exchange listing',
                                item.description,
                              )
                            }
                          >
                            <Share2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Contact
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400">No items found matching your criteria.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales and Deals Search */}
          <Card className="bg-[#1a2332] border-slate-700">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search contractor promos and deals..."
                    value={salesSearchQuery}
                    onChange={(e) => setSalesSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <Select value={salesCategory} onValueChange={setSalesCategory}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="tools">Tools & Hardware</SelectItem>
                    <SelectItem value="lumber">Lumber & Materials</SelectItem>
                    <SelectItem value="equipment">Equipment & Machinery</SelectItem>
                    <SelectItem value="electrical">Electrical Supplies</SelectItem>
                    <SelectItem value="plumbing">Plumbing Supplies</SelectItem>
                    <SelectItem value="paint">Paint & Finishing</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dealType} onValueChange={setDealType}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Deal Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="all">All Deals</SelectItem>
                    <SelectItem value="percentage_off">Percentage Off</SelectItem>
                    <SelectItem value="dollar_off">Dollar Amount Off</SelectItem>
                    <SelectItem value="bogo">Buy One Get One</SelectItem>
                    <SelectItem value="clearance">Clearance</SelectItem>
                    <SelectItem value="contractor_special">Contractor Special</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={salesSortBy} onValueChange={setSalesSortBy}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2332] border-slate-700">
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="ending_soon">Ending Soon</SelectItem>
                    <SelectItem value="biggest_savings">Biggest Savings</SelectItem>
                    <SelectItem value="most_popular">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Contractor Promotions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Wrench className="h-6 w-6 mr-2 text-orange-500" />
                Contractor Promotions
              </h2>
              <Button className="bg-orange-500 hover:bg-orange-600">
                Post Your Promotion
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contractorPromosLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="bg-[#1a2332] border-slate-700 animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-slate-600 rounded mb-4"></div>
                      <div className="h-6 bg-slate-600 rounded mb-2"></div>
                      <div className="h-4 bg-slate-600 rounded mb-4"></div>
                      <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                    </CardContent>
                  </Card>
                ))
              ) : contractorPromos && contractorPromos.length > 0 ? (
                contractorPromos.map((promo) => (
                  <Card key={promo.id} className="bg-[#1a2332] border-slate-700 hover:border-orange-500/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                            <Wrench className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{promo.contractor.businessName}</h3>
                            <div className="flex items-center">
                              <Star className="h-4 w-4 text-yellow-400 mr-1" />
                              <span className="text-sm text-gray-300">{promo.contractor.rating}</span>
                              {promo.contractor.verified && (
                                <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/50 text-xs">
                                  Verified
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {promo.expiresAt && (
                          <Badge variant="outline" className="border-orange-500/50 text-orange-400">
                            <Clock className="h-3 w-3 mr-1" />
                            Expires {new Date(promo.expiresAt).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>

                      <h4 className="text-lg font-semibold text-white mb-2">{promo.title}</h4>
                      <p className="text-gray-300 text-sm mb-3">{promo.description}</p>
                      
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
                        <div className="flex items-center mb-2">
                          <Percent className="h-4 w-4 text-orange-400 mr-2" />
                          <span className="text-orange-400 font-semibold">{promo.offerDetails}</span>
                        </div>
                        {promo.promoCode && (
                          <div className="flex items-center justify-between bg-slate-700 rounded p-2">
                            <span className="text-sm text-gray-300">Promo Code:</span>
                            <div className="flex items-center">
                              <code className="bg-slate-600 px-2 py-1 rounded text-orange-400 font-mono text-sm mr-2">
                                {promo.promoCode}
                              </code>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">
                          {promo.viewCount} views • {promo.leadCount} leads
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white"
                            onClick={() =>
                              shareLink(
                                `/exchange?tab=sales&promo=${encodeURIComponent(promo.slug || promo.id)}`,
                                promo.title,
                                promo.description,
                              )
                            }
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                            Contact Contractor
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-3 text-center py-12">
                  <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No contractor promotions found.</p>
                  <Button className="bg-orange-500 hover:bg-orange-600">
                    Post the First Promotion
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Company Promotions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Building className="h-6 w-6 mr-2 text-blue-500" />
                Store Sales & Promotions
              </h2>
              <Button variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white">
                Advertise with Us
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companyPromotionsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="bg-[#1a2332] border-slate-700 animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-16 bg-slate-600 rounded mb-4"></div>
                      <div className="h-6 bg-slate-600 rounded mb-2"></div>
                      <div className="h-4 bg-slate-600 rounded mb-4"></div>
                      <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                    </CardContent>
                  </Card>
                ))
              ) : companyPromotions && companyPromotions.length > 0 ? (
                companyPromotions.map((promotion) => (
                  <Card key={promotion.id} className="bg-[#1a2332] border-slate-700 hover:border-blue-500/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-16 h-16 bg-[#0f1419] rounded-lg flex items-center justify-center mr-3">
                            {promotion.companyLogo ? (
                              <img src={promotion.companyLogo} alt={promotion.companyName} className="w-12 h-12 object-contain" />
                            ) : (
                              <Building className="h-8 w-8 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{promotion.companyName}</h3>
                            {promotion.isFeatured && (
                              <Badge className="bg-blue-500 text-white text-xs">Featured</Badge>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="border-red-500/50 text-red-400">
                          <Clock className="h-3 w-3 mr-1" />
                          Ends {new Date(promotion.expiresAt).toLocaleDateString()}
                        </Badge>
                      </div>

                      <h4 className="text-lg font-semibold text-white mb-2">{promotion.title}</h4>
                      <p className="text-gray-300 text-sm mb-3">{promotion.description}</p>
                      
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-blue-400 font-semibold text-lg">{promotion.dealDetails}</span>
                          {promotion.discountValue && (
                            <Badge className="bg-red-500 text-white">
                              Save {promotion.dealType === 'percentage_off' ? `${promotion.discountValue}%` : `$${promotion.discountValue}`}
                            </Badge>
                          )}
                        </div>
                        {promotion.originalPrice && promotion.salePrice && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400 line-through">${promotion.originalPrice}</span>
                            <span className="text-green-400 font-bold text-lg">${promotion.salePrice}</span>
                          </div>
                        )}
                        {promotion.promoCode && (
                          <div className="flex items-center justify-between bg-slate-700 rounded p-2 mt-2">
                            <span className="text-sm text-gray-300">Use Code:</span>
                            <div className="flex items-center">
                              <code className="bg-slate-600 px-2 py-1 rounded text-blue-400 font-mono text-sm mr-2">
                                {promotion.promoCode}
                              </code>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">
                          {promotion.viewCount} views • {promotion.redemptionCount} used
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white"
                            onClick={() =>
                              shareLink(
                                `/exchange?tab=sales&companyPromo=${encodeURIComponent(promotion.slug || promotion.id)}`,
                                promotion.title,
                                promotion.description,
                              )
                            }
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Shop Now
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-3 text-center py-12">
                  <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No store promotions available.</p>
                  <Button variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white">
                    Partner with Us
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EXCHANGE_CATEGORIES.map((category) => {
              const IconComponent = category.icon;
              return (
                <Card key={category.id} className="bg-[#1a2332] border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setActiveTab("browse");
                      }}>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mr-4">
                        <IconComponent className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{category.name}</h3>
                        <p className="text-sm text-gray-400">{category.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="sell" className="space-y-6">
          <Card className="bg-[#1a2332] border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">List Your Item</CardTitle>
              <p className="text-gray-400">Create a clear, trustworthy listing for other TradeScout members</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="text-white">Item Title</Label>
                    <Input
                      id="title"
                      placeholder="Example: 16ft enclosed trailer with ramp"
                      className="bg-slate-700 border-slate-600 text-white"
                      value={sellTitle}
                      onChange={(e) => setSellTitle(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="category" className="text-white">Category</Label>
                    <Select
                      value={sellCategoryId}
                      onValueChange={setSellCategoryId}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2332] border-slate-700">
                        {EXCHANGE_CATEGORIES.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="price" className="text-white">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="Asking price (USD)"
                      className="bg-slate-700 border-slate-600 text-white"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="condition" className="text-white">Condition</Label>
                    <Select
                      value={sellCondition}
                      onValueChange={setSellCondition}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2332] border-slate-700">
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="like-new">Like New</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="description" className="text-white">Description</Label>
                    <Textarea 
                      id="description" 
                      placeholder="Describe condition, age, and what's included..." 
                      className="bg-slate-700 border-slate-600 text-white min-h-32"
                      value={sellDescription}
                      onChange={(e) => setSellDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="location" className="text-white">Location</Label>
                    <Input
                      id="location"
                      placeholder="Where can buyers pick it up? (City, State)"
                      className="bg-slate-700 border-slate-600 text-white"
                      value={sellLocation}
                      onChange={(e) => setSellLocation(e.target.value)}
                    />
                    <div className="mt-3 space-y-1">
                      <Label className="text-xs text-gray-300">Location privacy</Label>
                      <ToggleGroup
                        type="single"
                        value={sellLocationVisibility}
                        onValueChange={(value) => {
                          if (value === "exact" || value === "meetup_only") {
                            setSellLocationVisibility(value);
                          }
                        }}
                        className="inline-flex rounded-lg border border-slate-700 bg-slate-800 text-xs"
                      >
                        <ToggleGroupItem
                          value="exact"
                          className="px-3 py-1.5 data-[state=on]:bg-orange-500 data-[state=on]:text-white data-[state=on]:border-orange-500/80"
                        >
                          Show exact area
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="meetup_only"
                          className="px-3 py-1.5 data-[state=on]:bg-slate-700 data-[state=on]:text-white"
                        >
                          Meetup only
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <p className="text-[11px] text-gray-400">
                        Meetup only hides your exact spot and skips hyper-local alerts.
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-white">Images</Label>
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center space-y-4">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Plus className="h-10 w-10 text-gray-400" />
                        <p className="text-gray-400">Drop in clear, well-lit photos</p>
                        <p className="text-sm text-gray-500">Add up to 8 photos that show real condition</p>
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer">
                          <UploadIcon className="h-4 w-4" />
                          <span>Choose Files</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []).slice(0, 8 - sellImages.length);
                              const uploaded: string[] = [];
                              for (const file of files) {
                                try {
                                  const { publicUrl } = await uploadObject(file);
                                  uploaded.push(publicUrl);
                                } catch (err) {
                                  console.error("Image upload failed", err);
                                }
                              }
                              if (uploaded.length) {
                                setSellImages((prev) => [...prev, ...uploaded].slice(0, 8));
                              }
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {sellImages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                          {sellImages.map((url, idx) => (
                            <div key={url + idx} className="relative group rounded-lg overflow-hidden border border-slate-700">
                              <img src={url} alt="Listing" className="w-full h-24 object-cover" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setSellImages((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Save Draft
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  disabled={createListingMutation.isPending}
                  onClick={() => {
                    if (!isAuthenticated) {
                      toast({
                        title: "Sign in required",
                        description:
                          "You need an account to publish a listing. Please sign in and try again.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (!stateCode || !county) {
                      toast({
                        title: "Location needed",
                        description:
                          "Set your community location first so we can place this listing on the right local board.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (!sellTitle.trim()) {
                      toast({
                        title: "Add a title",
                        description: "Give your listing a clear title before publishing.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const numericPrice = Number(sellPrice);
                    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
                      toast({
                        title: "Add a valid price",
                        description: "Enter a positive price so buyers know what you are asking.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (!sellCategoryId) {
                      toast({
                        title: "Choose a category",
                        description: "Pick the closest category so the right people see your listing.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const mappedCondition =
                      sellCondition === "new" ||
                      sellCondition === "like-new" ||
                      sellCondition === "excellent" ||
                      sellCondition === "good" ||
                      sellCondition === "fair" ||
                      sellCondition === "poor" ||
                      sellCondition === "parts_only"
                        ? sellCondition
                        : "good";

                    const body: any = {
                      title: sellTitle.trim(),
                      description: sellDescription.trim() || sellTitle.trim(),
                      price: numericPrice,
                      categoryId: sellCategoryId,
                      state: stateCode,
                      county,
                      condition: mappedCondition,
                      isLocalPickupOnly: true,
                      willShip: false,
                      images: sellImages,
                      locationVisibility: sellLocationVisibility,
                    };

                    if (sellLocation.trim()) {
                      body.city = sellLocation.trim();
                    }

                    createListingMutation.mutate(body);
                  }}
                >
                  Publish Listing
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}