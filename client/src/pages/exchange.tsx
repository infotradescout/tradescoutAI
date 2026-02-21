import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Megaphone,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  Factory,
  Filter,
  Gavel,
  Eye,
  Heart,
  HeartHandshake,
  HelpCircle,
  Info,
  MapPin,
  Package,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Share2,
  MessageSquare,
  Copy,
  Building,
  Clock,
  ExternalLink,
  Tag,
  TrendingUp,
  Upload as UploadIcon,
  Home,
  Wrench,
  Trees,
  Briefcase,
  Smartphone,
  Trophy,
  Palette,
  Gem,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { share } from "@/utils/share";

interface ExchangeItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: "new" | "like_new" | "good" | "fair";
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

interface ExchangePromotion {
  id: string;
  slug: string;
  title: string;
  description: string;
  offerDetails: string;
  businessName: string;
  promoCode?: string | null;
  expiresAt?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  isFeatured?: boolean;
  viewCount: number;
  leadCount: number;
}

interface CompanyPromotion {
  id: string;
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
  title: string;
  description: string;
  dealDetails: string;
  dealType:
    | "percentage_off"
    | "dollar_off"
    | "bogo"
    | "free_shipping"
    | "bundle_deal"
    | "clearance";
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
  {
    id: "business",
    name: "Sell Your Business",
    icon: Building2,
    description: "Complete businesses, franchises, opportunities",
  },
  {
    id: "real-estate",
    name: "HomeScout",
    icon: Home,
    description: "Homes, land, commercial properties",
  },
  { id: "vehicles", name: "Vehicles", icon: Car, description: "Cars, trucks, motorcycles, boats" },
  {
    id: "construction",
    name: "Construction Equipment",
    icon: Wrench,
    description: "Heavy machinery, tools, equipment",
  },
  {
    id: "tools",
    name: "Tools & Hardware",
    icon: Wrench,
    description: "Professional tools, hardware",
  },
  {
    id: "furniture",
    name: "Furniture & Home",
    icon: Home,
    description: "Quality furniture and home goods",
  },
  {
    id: "farm",
    name: "Farm Equipment",
    icon: Trees,
    description: "Agricultural equipment and livestock",
  },
  {
    id: "business-equipment",
    name: "Business Equipment",
    icon: Briefcase,
    description: "Office and commercial equipment",
  },
  {
    id: "electronics",
    name: "Electronics",
    icon: Smartphone,
    description: "High-end electronics and technology",
  },
  {
    id: "sports",
    name: "Sports & Recreation",
    icon: Trophy,
    description: "Premium sports and recreation equipment",
  },
  {
    id: "collectibles",
    name: "Art & Collectibles",
    icon: Palette,
    description: "Artwork, antiques, collectibles",
  },
  {
    id: "jewelry",
    name: "Jewelry & Luxury",
    icon: Gem,
    description: "Fine jewelry and luxury items",
  },
  {
    id: "local-food",
    name: "Local Food & Artisan",
    icon: Package,
    description: "Local foods and handmade goods",
  },
  {
    id: "other",
    name: "Other High-Value Items",
    icon: Package,
    description: "Other premium equipment and valuables",
  },
];

export default function Exchange() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [priceRange, setPriceRange] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [contactItem, setContactItem] = useState<ExchangeItem | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryOffer, setInquiryOffer] = useState("");

  // Sales section filters
  const [salesSearchQuery, setSalesSearchQuery] = useState("");
  const [salesCategory, setSalesCategory] = useState("");
  const [dealType, setDealType] = useState("");
  const [salesSortBy, setSalesSortBy] = useState("newest");

  const [route, navigate] = useLocation();

  // Real estate has its own portal (HomeScout). Keep the Exchange category for discoverability,
  // but route users into the dedicated surface.
  useEffect(() => {
    if (selectedCategory === "real-estate") {
      navigate("/real-estate-marketplace");
    }
  }, [selectedCategory, navigate]);

  const locationCtx = useLocationContext();
  const stateCode = locationCtx.stateCode as string | undefined;
  const countyFips = locationCtx.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(locationCtx as any);

  // Sell tab draft state (prefill from Scout)
  const [sellTitle, setSellTitle] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellDescription, setSellDescription] = useState("");
  const [sellLocation, setSellLocation] = useState("");
  const [sellLocationVisibility, setSellLocationVisibility] = useState<"exact" | "meetup_only">(
    "exact"
  );
  const [sellImages, setSellImages] = useState<string[]>([]);
  const [sellCategoryId, setSellCategoryId] = useState<string>("");
  const [sellCondition, setSellCondition] = useState<string>("");
  const [hasScoutDraft, setHasScoutDraft] = useState(false);

  // Fetch exchange items
  const { data: items, isLoading } = useQuery<ExchangeItem[]>({
    queryKey: [
      "/api/exchange/items",
      selectedCategory,
      searchQuery,
      sortBy,
      priceRange,
      conditionFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") {
        params.append("categoryId", selectedCategory);
      }
      // Local-first (not gated): pass locality context as a preference, not a filter.
      if (stateCode) params.append("stateCode", stateCode);
      if (countyFips) params.append("countyFips", countyFips);
      // Search query support
      if (searchQuery) params.append("search", searchQuery);
      if (sortBy) params.append("sort", sortBy);
      if (priceRange) {
        const raw = String(priceRange);
        if (raw.endsWith("+")) {
          const min = Number(raw.slice(0, -1));
          if (Number.isFinite(min)) params.append("priceMin", String(min));
        } else if (raw.includes("-")) {
          const [minRaw, maxRaw] = raw.split("-", 2);
          const min = Number(minRaw);
          const max = Number(maxRaw);
          if (Number.isFinite(min)) params.append("priceMin", String(min));
          if (Number.isFinite(max)) params.append("priceMax", String(max));
        }
      }
      if (conditionFilter && conditionFilter !== "any") params.append("condition", conditionFilter);

      const response = await fetch(`/api/exchange/items?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch items");
      const json = await response.json();

      return json;
    },
    enabled: activeTab === "browse",
  });

  const createListingMutation = useMutation({
    mutationFn: async (body: any) => {
      return apiRequest("POST", "/api/marketplace/listings", body);
    },
    onSuccess: () => {
      setSellPrice("");
      setSellDescription("");
      setSellLocation("");
      setSellLocationVisibility("exact");
      setSellImages([]);
      setSellCategoryId("");
      setSellCondition("");
      toast({
        title: "Listing submitted",
        description: "Your listing was submitted and is pending approval before going live.",
      });

      queryClient.invalidateQueries({
        queryKey: [
          "/api/exchange/items",
          selectedCategory,
          searchQuery,
          sortBy,
          priceRange,
          conditionFilter,
        ],
      });

      setActiveTab("browse");
    },
    onError: (error: any) => {
      const message =
        (error && (error.message || (error as any).toString())) || "Failed to create listing";
      toast({
        title: "Could not publish listing",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Fetch Exchange promotions (all business types)
  const { data: exchangePromotions, isLoading: exchangePromotionsLoading } = useQuery<
    ExchangePromotion[]
  >({
    queryKey: ["/api/exchange/promotions", salesSearchQuery, salesSortBy, countyFips],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salesSearchQuery) params.append("search", salesSearchQuery);
      if (salesSortBy) params.append("sort", salesSortBy);
      if (countyFips) params.append("county", countyFips);

      const response = await fetch(`/api/exchange/promotions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch promotions");
      return response.json();
    },
    enabled: activeTab === "promotions",
  });

  // Favorites / watchlist
  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/marketplace/favorites"],
    queryFn: async () => apiRequest("GET", "/api/marketplace/favorites"),
    enabled: isAuthenticated,
  });

  const favoriteListingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const favorite of favorites || []) {
      const idCandidate =
        favorite?.listingId ??
        favorite?.listing_id ??
        favorite?.marketplaceListingId ??
        favorite?.marketplace_listing_id;
      if (idCandidate) ids.add(String(idCandidate));
    }
    return ids;
  }, [favorites]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (payload: { listingId: string; wasSaved: boolean }) => {
      if (payload.wasSaved) {
        return apiRequest("DELETE", `/api/marketplace/favorites/${payload.listingId}`);
      }
      return apiRequest("POST", "/api/marketplace/favorites", { listingId: payload.listingId });
    },
    onSuccess: (_res, payload) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/favorites"] });
      toast({
        title: payload.wasSaved ? "Removed from saved" : "Saved listing",
        description: payload.wasSaved
          ? "Listing removed from your watchlist."
          : "Listing added to your watchlist.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not update saved listings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const inquiryMutation = useMutation({
    mutationFn: async (payload: { listingId: string; message: string; offerAmount?: number }) => {
      return apiRequest("POST", "/api/marketplace/inquiries", payload);
    },
    onSuccess: () => {
      toast({
        title: "Request sent",
        description: "Your request is now waiting for seller review.",
      });
      setContactItem(null);
      setInquiryMessage("");
      setInquiryOffer("");
    },
    onError: (error: any) => {
      toast({
        title: "Could not send request",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch company promotions
  const { data: companyPromotions, isLoading: companyPromotionsLoading } = useQuery<
    CompanyPromotion[]
  >({
    queryKey: ["/api/exchange/company-promotions", salesSearchQuery, dealType, salesSortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salesSearchQuery) params.append("search", salesSearchQuery);
      if (dealType) params.append("dealType", dealType);
      if (salesSortBy) params.append("sort", salesSortBy);

      const response = await fetch(`/api/exchange/company-promotions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch company promotions");
      return response.json();
    },
    enabled: activeTab === "sales",
  });

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const isSaved = favoriteListingIds.has(String(item.id));
      const matchesSaved = !savedOnly || isSaved;
      return matchesSearch && matchesSaved;
    });
  }, [items, searchQuery, savedOnly, favoriteListingIds]);

  const getCategoryIcon = (categoryId: string) => {
    const category = EXCHANGE_CATEGORIES.find((cat) => cat.id === categoryId);
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
      new: "bg-green-500",
      like_new: "bg-blue-500",
      "like-new": "bg-blue-500",
      good: "bg-yellow-500",
      fair: "bg-orange-500",
    };
    return colors[condition as keyof typeof colors] || "bg-tsBg/10";
  };

  const shareLink = async (url: string, title: string, text?: string) => {
    await share({
      path: url,
      title,
      text,
      contextLabel: "Share link",
    });
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

    // Scout-driven drafts always arrive with the sell tab preselected
    // and at least one of these fields populated. Mark a one-shot
    // "draft created" state so users understand why the form is filled.
    if (tab === "sell" && (title || description || price || loc)) {
      setHasScoutDraft(true);
    }
  }, [route]);

  const activeCategoryMeta = EXCHANGE_CATEGORIES.find((cat) => cat.id === selectedCategory);
  const localLabel = (() => {
    if (!countyCommitted) return "Set home county";
    if (locationCtx.countyName && stateCode) return `${locationCtx.countyName}, ${stateCode}`;
    if (locationCtx.label) return locationCtx.label;
    if (stateCode) return stateCode;
    return "Home county set";
  })();

  const formatListedTime = (dateLike: string) => {
    const ts = new Date(dateLike).getTime();
    if (!Number.isFinite(ts)) return "";
    const diffHours = Math.floor((Date.now() - ts) / (1000 * 60 * 60));
    if (diffHours < 1) return "Just listed";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return new Date(dateLike).toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6">
      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/65 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">Exchange listings</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              Local results
            </Badge>
            <Badge
              variant="outline"
              className="border-slate-700 text-slate-300"
              title={
                countyCommitted
                  ? "Using your committed county"
                  : "Set your county to prioritize local listings"
              }
            >
              Area: {localLabel}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-4 bg-tsCard border border-tsBorder rounded-xl overflow-hidden text-[10px] sm:text-[11px]">
          <TabsTrigger
            value="browse"
            className="flex items-center justify-center px-2 py-1.5 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            Browse
          </TabsTrigger>
          <TabsTrigger
            value="promotions"
            className="flex items-center justify-center px-2 py-1.5 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            <Megaphone className="h-3 w-3 mr-1" />
            <span>Promos</span>
          </TabsTrigger>
          <TabsTrigger
            value="sales"
            className="flex items-center justify-center px-2 py-1.5 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700 relative"
          >
            <Tag className="h-3 w-3 mr-1" />
            <span>Sales</span>
            <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5">
              HOT
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="flex items-center justify-center px-2 py-1.5 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            Categories
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className="flex items-center justify-center px-2 py-1.5 text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700"
          >
            Sell
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <Card className="bg-tsCard border-tsBorder">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                <Card
                  className={`min-w-[180px] bg-slate-900/40 border-tsBorder hover:border-orange-500/50 transition-colors cursor-pointer ${
                    !selectedCategory ? "border-orange-500/60" : ""
                  }`}
                  onClick={() => setSelectedCategory("")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-orange-500/15 rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-orange-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">All</div>
                        <div className="text-[11px] text-slate-400 truncate">Browse everything</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {EXCHANGE_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  const active = selectedCategory === category.id;
                  return (
                    <Card
                      key={category.id}
                      className={`min-w-[180px] bg-slate-900/40 border-tsBorder hover:border-orange-500/50 transition-colors cursor-pointer ${
                        active ? "border-orange-500/60" : ""
                      }`}
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-orange-500/15 rounded-lg flex items-center justify-center">
                            <IconComponent className="h-5 w-5 text-orange-300" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {category.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {category.description}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                <div className="min-w-0 truncate">
                  {activeCategoryMeta ? `Selected: ${activeCategoryMeta.name}` : "Selected: All"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-slate-700 text-slate-200"
                  onClick={() => setActiveTab("sell")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Sell
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-[260px,1fr] gap-4">
            <Card className="bg-tsCard border-tsBorder h-fit xl:sticky xl:top-20">
              <CardHeader className="pb-1">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Filter className="h-4 w-4 text-orange-400" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search items"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-10 bg-slate-800 border-slate-700 text-white text-sm"
                  />
                </div>

                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue placeholder="Price Range" />
                  </SelectTrigger>
                  <SelectContent className="bg-tsCard border-tsBorder">
                    <SelectItem value="">Any Price</SelectItem>
                    <SelectItem value="0-1000">Under $1K</SelectItem>
                    <SelectItem value="1000-5000">$1K - $5K</SelectItem>
                    <SelectItem value="5000-25000">$5K - $25K</SelectItem>
                    <SelectItem value="25000-100000">$25K - $100K</SelectItem>
                    <SelectItem value="100000+">$100K+</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={conditionFilter} onValueChange={setConditionFilter}>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue placeholder="Condition" />
                  </SelectTrigger>
                  <SelectContent className="bg-tsCard border-tsBorder">
                    <SelectItem value="any">Any Condition</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="like_new">Like New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-tsCard border-tsBorder">
                    <SelectItem value="date_desc">Newest First</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 h-9 border-slate-600 text-slate-200 text-sm"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("");
                      setPriceRange("");
                      setConditionFilter("");
                      setSortBy("date_desc");
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    className="flex-1 h-9 bg-orange-500 hover:bg-orange-600 text-sm"
                    onClick={() => setActiveTab("sell")}
                  >
                    Sell
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tsBorder bg-tsCard px-3 py-2">
                <div className="text-sm text-slate-200">
                  <span className="font-semibold text-white">{filteredItems?.length ?? 0}</span>{" "}
                  results
                  {activeCategoryMeta ? (
                    <span className="text-slate-400"> in {activeCategoryMeta.name}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={savedOnly ? "default" : "outline"}
                    className={
                      savedOnly
                        ? "h-7 bg-orange-500 hover:bg-orange-600 text-white"
                        : "h-7 border-slate-600 text-slate-200"
                    }
                    onClick={() => setSavedOnly((prev) => !prev)}
                  >
                    <Heart className="h-3 w-3 mr-1" />
                    {savedOnly ? "Saved only" : "All listings"}
                  </Button>
                  <div className="text-xs text-slate-400">Marketplace-style local board</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="bg-tsCard border-tsBorder animate-pulse">
                      <div className="aspect-square bg-slate-700 rounded-t-lg"></div>
                      <CardContent className="p-3">
                        <div className="h-4 bg-slate-700 rounded mb-2"></div>
                        <div className="h-4 bg-slate-700 rounded mb-2"></div>
                        <div className="h-3 bg-slate-700 rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))
                ) : filteredItems?.length > 0 ? (
                  filteredItems.map((item) => {
                    const IconComponent = getCategoryIcon(item.category);
                    return (
                      <Card
                        key={item.id}
                        className="bg-tsCard border-tsBorder hover:border-orange-500/50 transition-colors overflow-hidden"
                      >
                        <div className="relative">
                          {item.images && item.images.length > 0 ? (
                            <div className="aspect-square bg-slate-900 overflow-hidden">
                              <img
                                src={item.images[0]}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                              />
                            </div>
                          ) : (
                            <div className="aspect-square bg-slate-800 flex items-center justify-center">
                              <IconComponent className="h-12 w-12 text-slate-500" />
                            </div>
                          )}
                          {item.featured && (
                            <Badge className="absolute top-2 right-2 bg-orange-500">Featured</Badge>
                          )}
                          <Badge
                            className={`absolute top-2 left-2 ${getConditionBadge(item.condition)}`}
                          >
                            {item.condition}
                          </Badge>
                        </div>
                        <CardContent className="p-3">
                          <p className="text-lg sm:text-xl font-bold text-white mb-1">
                            {formatPrice(item.price)}
                          </p>
                          <h3 className="font-semibold text-slate-100 mb-1 line-clamp-2 leading-tight text-sm">
                            {item.title}
                          </h3>
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <div className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              <span className="line-clamp-1">{item.location}</span>
                            </div>
                            <span>{formatListedTime(item.createdAt)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex items-center">
                              <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center mr-2">
                                <span className="text-[11px] text-white">
                                  {item.seller.name[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] text-slate-200 truncate">
                                  {item.seller.name}
                                </p>
                                <div className="flex items-center text-[10px] text-slate-400">
                                  <Star className="h-3 w-3 text-yellow-500 mr-1" />
                                  <span>{item.seller.rating}</span>
                                  {item.seller.verified ? (
                                    <span className="ml-1 text-emerald-400">• verified</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-8 w-8 p-0 ${
                                  favoriteListingIds.has(String(item.id))
                                    ? "text-rose-400 hover:text-rose-300"
                                    : "text-slate-300 hover:text-white"
                                }`}
                                onClick={() => {
                                  if (!isAuthenticated) {
                                    navigate("/pre-scout-setup?mode=signin");
                                    return;
                                  }
                                  const wasSaved = favoriteListingIds.has(String(item.id));
                                  toggleFavoriteMutation.mutate({
                                    listingId: String(item.id),
                                    wasSaved,
                                  });
                                }}
                              >
                                <Heart
                                  className={`h-3 w-3 ${
                                    favoriteListingIds.has(String(item.id)) ? "fill-current" : ""
                                  }`}
                                />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-slate-300 hover:text-white"
                                onClick={() =>
                                  shareLink(
                                    `/exchange?item=${encodeURIComponent(item.id)}`,
                                    item.title || "Exchange listing",
                                    item.description
                                  )
                                }
                              >
                                <Share2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 px-2.5 bg-orange-500 hover:bg-orange-600 text-xs"
                                onClick={() => {
                                  if (!isAuthenticated) {
                                    navigate("/pre-scout-setup?mode=signin");
                                    return;
                                  }
                                  setContactItem(item);
                                  setInquiryMessage(
                                    `Hi, I would like a quote for \"${item.title}\".`
                                  );
                                }}
                              >
                                Request Quote
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {item.views}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {item.favorites}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="col-span-full">
                    <EmptyState
                      icon={<Search />}
                      title="No items found"
                      description="Try broader filters or switch categories."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="promotions" className="space-y-6">
          {/* Promotions Search */}
          <Card className="bg-tsCard border-tsBorder">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search promotions..."
                    value={salesSearchQuery}
                    onChange={(e) => setSalesSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <Select value={salesSortBy} onValueChange={setSalesSortBy}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-tsCard border-tsBorder">
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="ending_soon">Ending Soon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Promotions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Megaphone className="h-6 w-6 mr-2 text-orange-500" />
                Promotions
              </h2>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => navigate("/promotions")}
              >
                Create Promotion
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exchangePromotionsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="bg-tsCard border-tsBorder animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-slate-600 rounded mb-4"></div>
                      <div className="h-6 bg-slate-600 rounded mb-2"></div>
                      <div className="h-4 bg-slate-600 rounded mb-4"></div>
                      <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                    </CardContent>
                  </Card>
                ))
              ) : exchangePromotions && exchangePromotions.length > 0 ? (
                exchangePromotions.map((promo) => (
                  <Card
                    key={promo.id}
                    className="bg-tsCard border-tsBorder hover:border-orange-500/50 transition-colors"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                            <Megaphone className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{promo.businessName}</h3>
                            {promo.isFeatured ? (
                              <Badge className="mt-1 bg-orange-500/20 text-orange-300 border-orange-500/50 text-xs">
                                Featured
                              </Badge>
                            ) : null}
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
                          <span className="text-orange-400 font-semibold">
                            {promo.offerDetails}
                          </span>
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
                                `/exchange?tab=promotions&promo=${encodeURIComponent(promo.slug || promo.id)}`,
                                promo.title,
                                promo.description
                              )
                            }
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600"
                            onClick={() => {
                              if (promo.ctaUrl) {
                                window.open(promo.ctaUrl, "_blank", "noopener,noreferrer");
                                return;
                              }
                              navigate("/messages");
                            }}
                          >
                            {promo.ctaLabel || "View Offer"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-3 text-center py-12">
                  <Megaphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No promotions found.</p>
                  <Button className="bg-orange-500 hover:bg-orange-600">
                    Create the first promotion
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Store Sales Search */}
          <Card className="bg-tsCard border-tsBorder">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search store sales and deals..."
                    value={salesSearchQuery}
                    onChange={(e) => setSalesSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <Select value={salesCategory} onValueChange={setSalesCategory}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-tsCard border-tsBorder">
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
                  <SelectContent className="bg-tsCard border-tsBorder">
                    <SelectItem value="all">All Deals</SelectItem>
                    <SelectItem value="percentage_off">Percentage Off</SelectItem>
                    <SelectItem value="dollar_off">Dollar Amount Off</SelectItem>
                    <SelectItem value="bogo">Buy One Get One</SelectItem>
                    <SelectItem value="clearance">Clearance</SelectItem>
                    <SelectItem value="contractor_special">Business Special</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={salesSortBy} onValueChange={setSalesSortBy}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-tsCard border-tsBorder">
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="ending_soon">Ending Soon</SelectItem>
                    <SelectItem value="biggest_savings">Biggest Savings</SelectItem>
                    <SelectItem value="most_popular">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Store Sales Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Building className="h-6 w-6 mr-2 text-blue-500" />
                Store Sales & Deals
              </h2>
              <Button
                variant="outline"
                className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
              >
                Advertise with Us
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companyPromotionsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="bg-tsCard border-tsBorder animate-pulse">
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
                  <Card
                    key={promotion.id}
                    className="bg-tsCard border-tsBorder hover:border-blue-500/50 transition-colors"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-16 h-16 bg-tsBg rounded-lg flex items-center justify-center mr-3">
                            {promotion.companyLogo ? (
                              <img
                                src={promotion.companyLogo}
                                alt={promotion.companyName}
                                className="w-12 h-12 object-contain"
                              />
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
                          <span className="text-blue-400 font-semibold text-lg">
                            {promotion.dealDetails}
                          </span>
                          {promotion.discountValue && (
                            <Badge className="bg-red-500 text-white">
                              Save{" "}
                              {promotion.dealType === "percentage_off"
                                ? `${promotion.discountValue}%`
                                : `$${promotion.discountValue}`}
                            </Badge>
                          )}
                        </div>
                        {promotion.originalPrice && promotion.salePrice && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400 line-through">
                              ${promotion.originalPrice}
                            </span>
                            <span className="text-green-400 font-bold text-lg">
                              ${promotion.salePrice}
                            </span>
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
                                promotion.description
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
                  <Button
                    variant="outline"
                    className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                  >
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
                <Card
                  key={category.id}
                  className="bg-tsCard border-tsBorder hover:border-orange-500/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setActiveTab("browse");
                  }}
                >
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
          <Card className="bg-tsCard border-tsBorder">
            <CardHeader>
              <CardTitle className="text-white">List Your Item</CardTitle>
              <p className="text-gray-400">
                Create a clear, trustworthy listing for other TradeScout members
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {hasScoutDraft && (
                <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 flex items-start gap-2">
                  <Sparkles className="h-3 w-3 mt-[2px]" />
                  <div>
                    <p className="font-semibold">Draft created from Scout</p>
                    <p className="mt-0.5 text-[11px] text-amber-100/90">
                      We pre-filled this listing based on your last Scout request. Edit any field
                      before you publish&mdash;nothing goes live until you confirm.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="text-white">
                      Item Title
                    </Label>
                    <Input
                      id="title"
                      placeholder="Example: 16ft enclosed trailer with ramp"
                      className="bg-slate-700 border-slate-600 text-white"
                      value={sellTitle}
                      onChange={(e) => setSellTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="category" className="text-white">
                      Category
                    </Label>
                    <Select value={sellCategoryId} onValueChange={setSellCategoryId}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-tsCard border-tsBorder">
                        {EXCHANGE_CATEGORIES.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="price" className="text-white">
                      Price
                    </Label>
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
                    <Label htmlFor="condition" className="text-white">
                      Condition
                    </Label>
                    <Select value={sellCondition} onValueChange={setSellCondition}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent className="bg-tsCard border-tsBorder">
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="like_new">Like New</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="description" className="text-white">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Describe condition, age, and what's included..."
                      className="bg-slate-700 border-slate-600 text-white min-h-32"
                      value={sellDescription}
                      onChange={(e) => setSellDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="location" className="text-white">
                      Location
                    </Label>
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
                        <p className="text-sm text-gray-500">
                          Add up to 8 photos that show real condition
                        </p>
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer">
                          <UploadIcon className="h-4 w-4" />
                          <span>Choose Files</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []).slice(
                                0,
                                8 - sellImages.length
                              );
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
                            <div
                              key={url + idx}
                              className="relative group rounded-lg overflow-hidden border border-slate-700"
                            >
                              <img src={url} alt="Listing" className="w-full h-24 object-cover" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() =>
                                  setSellImages((prev) => prev.filter((_, i) => i !== idx))
                                }
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
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
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

                    if (!stateCode || !countyFips) {
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
                        description:
                          "Pick the closest category so the right people see your listing.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const mappedCondition =
                      sellCondition === "new" ||
                      sellCondition === "like_new" ||
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
                      county: countyFips,
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

      <Dialog
        open={Boolean(contactItem)}
        onOpenChange={(open) => {
          if (!open) {
            setContactItem(null);
            setInquiryMessage("");
            setInquiryOffer("");
          }
        }}
      >
        <DialogContent className="bg-tsCard border-tsBorder">
          <DialogHeader>
            <DialogTitle className="text-white">Request Quote</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
              <p className="text-xs text-slate-400">Listing</p>
              <p className="text-sm font-semibold text-white">{contactItem?.title || "Item"}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Request</Label>
              <Textarea
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Tell the seller what you need and ask for a quote..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Offer amount (optional)</Label>
              <Input
                type="number"
                min="0"
                value={inquiryOffer}
                onChange={(e) => setInquiryOffer(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Example: 2200"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-200"
                onClick={() => {
                  setContactItem(null);
                  setInquiryMessage("");
                  setInquiryOffer("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                disabled={
                  inquiryMutation.isPending || !contactItem?.id || inquiryMessage.trim().length < 4
                }
                onClick={() => {
                  if (!contactItem?.id) return;
                  const offerValue = Number(inquiryOffer);
                  inquiryMutation.mutate({
                    listingId: String(contactItem.id),
                    message: inquiryMessage.trim(),
                    offerAmount:
                      Number.isFinite(offerValue) && offerValue > 0 ? offerValue : undefined,
                  });
                }}
              >
                {inquiryMutation.isPending ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
