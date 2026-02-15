import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProfessionalBadge, ProfessionalNetworkLinks } from "@/components/professional-badges";
import { ConversationStarter, QuickContactButton } from "@/components/conversation-starter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  Filter,
  MapPin,
  DollarSign,
  Eye,
  Heart,
  Plus,
  Package,
  Car,
  Home,
  Wrench,
  Building,
  Building2,
  Fish,
  Apple,
  TrendingUp,
  Shield,
  Target,
  CheckCircle,
  AlertCircle,
  Clock,
  Star,
  Users,
  ArrowUpDown,
  Grid3X3,
  List,
  Settings,
  Bookmark,
  Share2,
  MessageCircle,
  Truck,
  Zap,
  Award,
  Hammer,
  PaintBucket,
  Monitor,
  Gamepad2,
  Music,
  Book,
  Shirt,
  Gem,
  Bike,
  Baby,
  Dog,
  Camera,
  Laptop,
  Smartphone,
  TreePine,
  Utensils,
  Wine,
  Briefcase,
  MapIcon,
  Anchor,
  TreeDeciduous,
  Palette,
} from "lucide-react";
import type { MarketplaceListing, MarketplaceCategory } from "@shared/schema";
import { Page } from "@/components/layout/PagePrimitives";

// Comprehensive category icons mapping
const categoryIcons = {
  // Vehicles & Transportation
  car: Car,
  truck: Truck,
  bike: Bike,
  motorcycle: Car,
  boat: Anchor,
  trailer: Car,

  // Tools & Equipment
  tools: Wrench,
  power_tools: Zap,
  hand_tools: Hammer,
  construction: Building,
  garden_tools: TreePine,
  heavy_equipment: Truck,

  // Electronics
  electronics: Monitor,
  computers: Laptop,
  phones: Smartphone,
  gaming: Gamepad2,
  audio: Music,
  cameras: Camera,
  smart_home: Home,

  // Home & Garden
  home: Home,
  furniture: Home,
  appliances: Package,
  garden: TreeDeciduous,
  decor: Palette,
  lighting: Zap,

  // Fashion & Accessories
  clothing: Shirt,
  shoes: Package,
  jewelry: Gem,
  accessories: Package,
  bags: Briefcase,

  // Sports & Recreation
  sports: Target,
  fitness: Users,
  outdoor: TreePine,
  cycling: Bike,
  water_sports: Fish,
  collectibles: Award,

  // Food & Beverages
  food: Apple,
  beverages: Wine,
  local_produce: TreeDeciduous,
  prepared_food: Utensils,
  artisan_goods: Package,

  // Books & Media
  books: Book,
  music: Music,
  movies: Monitor,
  magazines: Book,

  // Baby & Kids
  baby: Baby,
  toys: Package,
  kids_clothing: Shirt,

  // Pets
  pets: Dog,
  pet_supplies: Package,

  // Business & Industrial
  business: Briefcase,
  office: Monitor,
  industrial: Building,

  // Art & Crafts
  art: Palette,
  crafts: PaintBucket,
  antiques: Award,

  // Default fallback
  package: Package,

  // Property icons
  property_listings: Home,
  real_estate: Building,

  // Business icons
  business_opportunities: Building2,
  business_sales: Building2,
  sell_your_business: Building2,
};

// Featured categories optimized for both contractors and homeowners with smart value messaging
const featuredCategories = [
  {
    id: "professional_tools",
    name: "Quality Tools",
    icon: "tools",
    color: "orange",
    description: "Tools that maintain their value and perform reliably",
    valueProposition: "Smart long-term choices",
    benefits: ["Proven durability", "Reliable performance", "Value retention"],
  },
  {
    id: "work_vehicles",
    name: "Reliable Vehicles",
    icon: "truck",
    color: "blue",
    description: "Well-maintained vehicles from trusted owners",
    valueProposition: "Dependable transportation",
    benefits: ["Service history included", "Local maintenance records", "Fair pricing"],
  },
  {
    id: "heavy_equipment",
    name: "Equipment & Machinery",
    icon: "construction",
    color: "amber",
    description: "Professional-grade equipment with maintenance records",
    valueProposition: "Capability expansion",
    benefits: ["Professional grade", "Maintenance tracked", "Performance verified"],
  },
  {
    id: "home_improvement",
    name: "Home & Garden",
    icon: "home",
    color: "emerald",
    description: "Quality items for homeowners who value craftsmanship",
    valueProposition: "Enhance your property",
    benefits: ["Quality materials", "Lasting results", "Property value boost"],
  },
  {
    id: "specialty_items",
    name: "Specialty & Collectibles",
    icon: "gem",
    color: "purple",
    description: "Unique items with documented provenance and quality",
    valueProposition: "Distinctive finds",
    benefits: ["Authenticated quality", "Unique character", "Value appreciation"],
  },
  {
    id: "property_listings",
    name: "HomeScout Listings",
    icon: "home",
    color: "violet",
    description: "Quality homes and properties from trusted sellers",
    valueProposition: "Real estate opportunities",
    benefits: ["Market value pricing", "Detailed property info", "Local expertise"],
  },
  {
    id: "business_opportunities",
    name: "Business Opportunities",
    icon: "building2",
    color: "emerald",
    description: "Complete businesses, franchises, and business packages with proven systems",
    valueProposition: "Income-generating opportunities",
    benefits: ["Revenue history", "Proven systems", "Growth potential"],
  },
  {
    id: "local_marketplace",
    name: "Community Exchange",
    icon: "users",
    color: "blue",
    description: "Local community members sharing quality items",
    valueProposition: "Neighborhood connections",
    benefits: ["Local pickup", "Community verified", "Support neighbors"],
  },
];

// Price ranges for quick filtering
const priceRanges = [
  { label: "Under $100", min: 0, max: 100 },
  { label: "$100 - $500", min: 100, max: 500 },
  { label: "$500 - $1,000", min: 500, max: 1000 },
  { label: "$1,000 - $5,000", min: 1000, max: 5000 },
  { label: "$5,000+", min: 5000, max: null },
];

// Condition options
const conditionOptions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "parts_only", label: "Parts Only" },
];

// Sort options
const sortOptions = [
  { value: "date_desc", label: "Newest First" },
  { value: "date_asc", label: "Oldest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "views_desc", label: "Most Popular" },
  { value: "location", label: "Nearest First" },
];

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPriceRange, setSelectedPriceRange] = useState("");

  // Fetch categories
  const { data: categories = [] } = useQuery<MarketplaceCategory[]>({
    queryKey: ["/api/marketplace/categories"],
  });

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);
    if (selectedCategory && selectedCategory !== "all")
      params.append("categoryId", selectedCategory);
    if (selectedState && selectedState !== "all") params.append("state", selectedState);
    if (selectedCondition && selectedCondition !== "all")
      params.append("condition", selectedCondition);
    if (sortBy) params.append("sortBy", sortBy);
    if (priceMin) params.append("priceMin", priceMin);
    if (priceMax) params.append("priceMax", priceMax);
    return params.toString();
  };

  // Fetch listings with filters
  const { data: listings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/listings", buildQueryParams()],
  });

  // Handle price range selection
  const handlePriceRangeChange = (range: (typeof priceRanges)[0]) => {
    setPriceMin(range.min.toString());
    setPriceMax(range.max ? range.max.toString() : "");
    setSelectedPriceRange(`${range.min}-${range.max || "max"}`);
  };

  // Save listing mutation
  const saveListingMutation = useMutation({
    mutationFn: (listingId: string) =>
      apiRequest("POST", `/api/marketplace/listings/${listingId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      toast({
        title: "Saved",
        description: "Listing added to your saved items.",
      });
    },
    onError: () => {
      toast({
        title: "Could not save listing",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Boost listing mutation
  const boostListingMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const response = await apiRequest("POST", `/api/marketplace/listings/${listingId}/boost`);
      return response as any;
    },
    onSuccess: (data: any) => {
      const checkoutUrl = data?.checkoutUrl as string | undefined;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      if (data?.transactionId) {
        const fallbackUrl = `/checkout/marketplace/${data.transactionId}?amount=50.00&description=${encodeURIComponent("Boost your listing for 7 days")}`;
        window.location.href = fallbackUrl;
      }
    },
    onError: () => {
      toast({
        title: "Could not start boost",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatPrice = (
    price: number,
    priceType: MarketplaceListing["priceType"] | string = "fixed"
  ) => {
    if (!Number.isFinite(price)) return "—";
    const base = formatCurrency(price);
    switch (priceType) {
      case "negotiable":
        return `${base} (negotiable)`;
      case "best_offer":
      case "obo":
        return `${base} OBO`;
      case "auction":
        return `${base} (auction)`;
      case "firm":
        return `${base} firm`;
      case "trade":
        return `${base} + trade`;
      case "quoted":
        return "Quoted";
      default:
        return base;
    }
  };

  const formatLocationString = (listing: MarketplaceListing) => {
    const parts = [listing.city, listing.county, listing.state].filter(Boolean);
    return parts.join(", ");
  };

  const getCategoryIcon = (iconName: string) => {
    const IconComponent = categoryIcons[iconName as keyof typeof categoryIcons] || Package;
    return <IconComponent className="h-4 w-4" />;
  };

  const getFeaturedCategoryIcon = (iconName: string) => {
    const iconMap = {
      ...categoryIcons,
      tools: Wrench,
      truck: Truck,
      construction: Building,
      package: Package,
      briefcase: Briefcase,
      users: Users,
      home: Home,
      gem: Gem,
    };
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || Package;
    return <IconComponent className="h-6 w-6 text-orange-600" />;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedState("");
    setSelectedCondition("");
    setPriceMin("");
    setPriceMax("");
    setSelectedPriceRange("");
    setSortBy("date_desc");
  };

  return (
    <Page className="max-w-none px-0">
      <div>
        {/* Smart Value Banner */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Quality Items, Smart Decisions</h2>
              <p className="text-sm text-orange-100">
                Where quality meets value from trusted community members
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-center bg-white/10 rounded-lg p-4">
                <Award className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Quality Verified</div>
                  <div className="text-xs text-orange-100">Items vetted by experts</div>
                </div>
              </div>
              <div className="flex items-center justify-center bg-white/10 rounded-lg p-4">
                <TrendingUp className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Value Focused</div>
                  <div className="text-xs text-orange-100">Smart pricing decisions</div>
                </div>
              </div>
              <div className="flex items-center justify-center bg-white/10 rounded-lg p-4">
                <Shield className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Trust Protected</div>
                  <div className="text-xs text-orange-100">Verified seller network</div>
                </div>
              </div>
              <div className="flex items-center justify-center bg-white/10 rounded-lg p-4">
                <Users className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Community Driven</div>
                  <div className="text-xs text-orange-100">Local connections matter</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <h1 className="text-lg font-semibold text-orange-500">Quality Exchange</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Where smart buyers and quality sellers connect for lasting value
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl">
                The Marketplace never runs outside ads. Every placement is a real listing from
                someone in the TradeScout network, and boosts only change how community listings are
                ordered and highlighted, never what you see from third parties.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center text-sm bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-3 py-2 rounded-lg">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Quality Assured
                </div>
                <div className="flex items-center text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg">
                  <Shield className="h-4 w-4 mr-2" />
                  Trust Protected
                </div>
                <div className="flex items-center text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-2 rounded-lg">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Smart Pricing
                </div>
                <div className="flex items-center text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-2 rounded-lg">
                  <Heart className="h-4 w-4 mr-2" />
                  Community Focused
                </div>
              </div>
            </div>

            {isAuthenticated && (
              <div className="flex flex-col gap-2 mt-4 sm:mt-0">
                <Button
                  onClick={() => setLocation("/marketplace/list")}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  List Your Item
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Share quality with your community
                </p>
                {/* Professional Network Access */}
                <div className="mt-4">
                  <ProfessionalNetworkLinks />
                </div>
              </div>
            )}
          </div>

          {/* Featured Categories */}
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-medium text-orange-500 mb-1">
                Smart Choices for Every Need
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Quality items from trusted community members who understand value
              </p>
            </div>

            {/* Value Decision Psychology Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/10 dark:via-indigo-900/10 dark:to-purple-900/10 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-orange-500">Smart Value Decisions</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Whether you're building a business or enhancing your home, quality choices
                      lead to lasting satisfaction
                    </p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Value Appreciation
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    Quality Assured
                  </Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredCategories.map((category) => (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-all border group rounded-xl shadow-sm ${
                    selectedCategory === category.id
                      ? `border-orange-500 bg-orange-50 dark:bg-orange-900/20`
                      : "border-tsBorder hover:border-orange-300 dark:hover:border-orange-600"
                  }`}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === category.id ? "" : category.id);
                  }}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 flex items-center justify-center">
                        {getFeaturedCategoryIcon(category.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-orange-500 mb-1">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {category.description}
                        </p>
                        <div className="flex items-center text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          {category.valueProposition}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {category.benefits.map((benefit, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs border-gray-300 text-gray-600"
                            >
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Search and Filters */}
          <Card className="rounded-xl border border-tsBorder bg-tsCard shadow-sm">
            <CardContent className="p-5 space-y-4">
              {/* Search Bar */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search for items, brands, or keywords..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 text-sm"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {(selectedCategory ||
                    selectedCondition ||
                    selectedState ||
                    priceMin ||
                    priceMax) && (
                    <Badge variant="secondary" className="ml-1">
                      Active
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Category Filter */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(category.iconName || "package")}
                                {category.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Condition Filter */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Condition</label>
                      <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Condition</SelectItem>
                          {conditionOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Location Filter */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Location</label>
                      <Select value={selectedState} onValueChange={setSelectedState}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any State</SelectItem>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="NY">New York</SelectItem>
                          {/* Add more states as needed */}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sort Filter */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Sort By</label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Price Range Quick Filters */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Price Range</label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {priceRanges.map((range) => (
                        <Button
                          key={range.label}
                          variant={
                            selectedPriceRange === `${range.min}-${range.max || "max"}`
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => handlePriceRangeChange(range)}
                        >
                          {range.label}
                        </Button>
                      ))}
                    </div>

                    {/* Custom Price Range */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input
                          placeholder="Min price"
                          type="number"
                          value={priceMin}
                          onChange={(e) => setPriceMin(e.target.value)}
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Max price"
                          type="number"
                          value={priceMax}
                          onChange={(e) => setPriceMax(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clear Filters */}
                  <div className="flex justify-between items-center pt-4 border-t">
                    <Button variant="ghost" onClick={clearFilters} className="text-red-600">
                      Clear All Filters
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">View:</span>
                      <Button
                        variant={viewMode === "grid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verification Notice for Local Exchange Category */}
          {selectedCategory === "local_marketplace" && (
            <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Local Exchange - Community Verified
                    </h3>
                    <p className="text-blue-800 dark:text-blue-200 text-sm mb-4">
                      Our local exchange connects verified community members for safe, trusted
                      transactions. All participants must complete address verification for
                      security.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2">Trust & Safety:</h4>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                          <li>• Address verification required</li>
                          <li>• Community reputation scores</li>
                          <li>• Secure local meetup suggestions</li>
                          <li>• Transaction protection guidance</li>
                        </ul>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2">Community Benefits:</h4>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                          <li>• Support local contractors</li>
                          <li>• Reduce transportation costs</li>
                          <li>• Build neighborhood connections</li>
                          <li>• Quick local pickup options</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Complete Verification
                      </Button>
                      <Button variant="outline" size="sm">
                        Learn About Safety
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quality Tools & Equipment Notice */}
          {(selectedCategory === "professional_tools" ||
            selectedCategory === "heavy_equipment") && (
            <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Award className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                      Quality Tools & Equipment
                    </h3>
                    <p className="text-orange-800 dark:text-orange-200 text-sm mb-4">
                      These items come from experienced owners who understand quality and
                      maintenance. Each listing includes usage history and care details to help you
                      make confident purchasing decisions.
                    </p>

                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          Quality Verified
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Items checked by knowledgeable owners
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
                          Smart Value
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Quality items maintain worth over time
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <Users className="h-4 w-4 mr-2 text-purple-600" />
                          Owner Stories
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Learn from experienced equipment owners
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <Shield className="h-4 w-4 mr-2 text-emerald-600" />
                          Trust Network
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Community-verified seller ratings
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Home & Garden Notice */}
          {selectedCategory === "home_improvement" && (
            <Card className="mb-6 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Home className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                      Home & Garden Excellence
                    </h3>
                    <p className="text-emerald-800 dark:text-emerald-200 text-sm mb-4">
                      Quality home improvement items from homeowners and professionals who value
                      lasting results. Find materials and tools that enhance property value and
                      deliver lasting satisfaction.
                    </p>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
                          Property Value
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Quality improvements that add lasting value
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <Award className="h-4 w-4 mr-2 text-blue-600" />
                          Proven Results
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Items with track records of performance
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <Users className="h-4 w-4 mr-2 text-purple-600" />
                          Community Tips
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Installation and usage advice included
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Specialty & Collectibles Notice */}
          {selectedCategory === "specialty_items" && (
            <Card className="mb-6 border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Gem className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                      Specialty & Collectibles
                    </h3>
                    <p className="text-purple-800 dark:text-purple-200 text-sm mb-4">
                      Unique items with verified authenticity and documented history. These pieces
                      often appreciate in value when properly maintained and cared for by
                      knowledgeable owners.
                    </p>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <CheckCircle className="h-4 w-4 mr-2 text-purple-600" />
                          Authenticated Items
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Verified provenance and quality documentation
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
                          Value Appreciation
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Quality pieces that often gain worth over time
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <Users className="h-4 w-4 mr-2 text-blue-600" />
                          Expert Network
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Connect with knowledgeable collectors and enthusiasts
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Business Opportunities Notice */}
          {(selectedCategory === "business_opportunities" ||
            selectedCategory === "business_sales") && (
            <Card className="mb-6 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Building2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                      Business Opportunities & Sales
                    </h3>
                    <p className="text-emerald-800 dark:text-emerald-200 text-sm mb-4">
                      Complete businesses, proven business packages, and franchises with established
                      revenue streams. Find turnkey operations, tested business models, and
                      growth-ready opportunities from experienced entrepreneurs.
                    </p>

                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
                          Complete Businesses
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Established operations with proven revenue streams
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <CheckCircle className="h-4 w-4 mr-2 text-blue-600" />
                          Business Packages
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Tested business models with systems and training
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <Users className="h-4 w-4 mr-2 text-purple-600" />
                          Franchises
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Proven brands with ongoing support and territory rights
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <Star className="h-4 w-4 mr-2 text-amber-600" />
                          Turnkey Solutions
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Ready-to-operate opportunities with full documentation
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center">
                        <Star className="h-4 w-4 mr-2 text-amber-600" />
                        <strong>Income & Wealth Building:</strong> From complete businesses with
                        established revenue to proven business packages and franchises - find
                        opportunities that generate immediate income while building long-term value
                        through business ownership.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* HomeScout Listings Notice */}
          {selectedCategory === "property_listings" && (
            <Card className="mb-6 border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-800">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Home className="h-6 w-6 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-violet-900 dark:text-violet-100 mb-2">
                      HomeScout Real Estate
                    </h3>
                    <p className="text-violet-800 dark:text-violet-200 text-sm mb-4">
                      Quality homes and properties listed by trusted community members and real
                      estate professionals. Find your next home or property opportunity with
                      comprehensive details and fair pricing.
                    </p>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2 text-violet-600" />
                          Market Value
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Competitive pricing based on local market conditions
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                          Detailed Information
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Complete property details and neighborhood insights
                        </p>
                      </div>
                      <div className="bg-tsCard p-4 rounded-lg">
                        <h4 className="font-medium text-orange-500 mb-2 flex items-center">
                          <Shield className="h-4 w-4 mr-2 text-blue-600" />
                          Trusted Sellers
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Verified property owners and licensed agents
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center">
                        <Star className="h-4 w-4 mr-2 text-amber-600" />
                        <strong>Property Investment Opportunity:</strong> Quality properties in
                        desirable neighborhoods often appreciate over time, making smart purchases
                        both a home and a valuable long-term decision.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-orange-500">
                {isLoading ? "Loading..." : `${listings.length} items found`}
              </h3>
              {listings.length > 0 && (
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-gray-400" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Listings Grid/List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-t-lg"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "space-y-4"
              }
            >
              {listings.length === 0 ? (
                <div className="col-span-full">
                  <Card className="text-center rounded-xl border border-tsBorder bg-tsCard shadow-sm">
                    <CardContent className="py-10 space-y-3">
                      <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-base font-medium text-orange-500">No listings found</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Try adjusting your filters or check back later for new items.
                      </p>
                      {isAuthenticated && (
                        <Button
                          onClick={() => setLocation("/marketplace/list")}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          List an Item
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                listings.map((listing) => (
                  <Card
                    key={listing.id}
                    className="group cursor-pointer transition-all rounded-xl border border-tsBorder bg-tsCard shadow-sm hover:border-orange-500/30"
                    onClick={() => setLocation(`/marketplace/item/${listing.id}`)}
                  >
                    {viewMode === "grid" ? (
                      <>
                        <div className="relative overflow-hidden rounded-t-lg">
                          <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                            <Package className="h-12 w-12 text-gray-400" />
                          </div>
                          <div className="absolute top-2 left-2">
                            <Badge variant="secondary" className="text-xs">
                              {listing.condition}
                            </Badge>
                            {listing.isPromoted &&
                              listing.promotedUntil &&
                              new Date(listing.promotedUntil) > new Date() && (
                                <div className="mt-1">
                                  <Badge
                                    variant="default"
                                    className="text-[10px] bg-amber-500 text-black"
                                  >
                                    Boosted
                                  </Badge>
                                </div>
                              )}
                          </div>
                          <div className="absolute top-2 right-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveListingMutation.mutate(listing.id);
                              }}
                            >
                              <Heart className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <h3 className="text-base font-medium text-orange-500 line-clamp-2">
                            {listing.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {listing.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-lg font-bold text-orange-600">
                                {formatPrice(
                                  parseFloat(listing.price),
                                  listing.priceType || "fixed"
                                )}
                              </span>
                              {listing.originalPrice &&
                                parseFloat(listing.originalPrice) > parseFloat(listing.price) && (
                                  <div className="text-sm text-gray-500 line-through">
                                    {formatCurrency(parseFloat(listing.originalPrice))}
                                  </div>
                                )}
                            </div>
                            <div className="text-right">
                              <div className="flex items-center text-xs text-gray-500 mb-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                {formatLocationString(listing)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center text-xs text-gray-500">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(listing.createdAt || "").toLocaleDateString()}
                              </div>
                              <div className="flex items-center text-xs text-gray-500">
                                <Eye className="h-3 w-3 mr-1" />
                                {listing.viewCount || 0}
                              </div>
                            </div>
                            {isAuthenticated && user?.id === listing.sellerId && (
                              <div
                                className="flex items-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500 px-3 py-1 text-[11px] text-amber-600 hover:bg-amber-500/10"
                                  onClick={() => boostListingMutation.mutate(listing.id)}
                                  disabled={boostListingMutation.isPending}
                                >
                                  Boost for $50
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Contact Seller Button */}
                          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                            <QuickContactButton
                              listing={listing}
                              sellerId={listing.sellerId}
                              className="w-full"
                            />
                          </div>
                        </CardContent>
                      </>
                    ) : (
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg flex items-center justify-center">
                              <Package className="h-8 w-8 text-gray-400" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-orange-500 mb-1">
                                  {listing.title}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                  {listing.description}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span className="flex items-center">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {formatLocationString(listing)}
                                  </span>
                                  <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {new Date(listing.createdAt || "").toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center">
                                    <Eye className="h-3 w-3 mr-1" />
                                    {listing.viewCount || 0}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-emerald-600 mb-1">
                                  {formatPrice(
                                    parseFloat(listing.price),
                                    listing.priceType || "fixed"
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {listing.condition}
                                  </Badge>
                                </div>
                                {/* Contact Seller Button */}
                                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                                  <QuickContactButton
                                    listing={listing}
                                    sellerId={listing.sellerId}
                                    className="text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
