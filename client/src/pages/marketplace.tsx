import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Tool,
  TreePine,
  Utensils,
  Wine,
  Briefcase,
  MapIcon,
  Anchor,
  TreeDeciduous,
  Palette
} from "lucide-react";
import type { MarketplaceListing, MarketplaceCategory } from "@shared/schema";

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
  package: Package
};

// Featured categories for quick access
const featuredCategories = [
  { id: 'vehicles', name: 'Vehicles', icon: 'car', color: 'blue' },
  { id: 'tools', name: 'Tools & Equipment', icon: 'tools', color: 'orange' },
  { id: 'electronics', name: 'Electronics', icon: 'electronics', color: 'purple' },
  { id: 'home', name: 'Home & Garden', icon: 'home', color: 'green' },
  { id: 'food', name: 'Local Food', icon: 'food', color: 'red' },
  { id: 'business', name: 'Business', icon: 'business', color: 'indigo' }
];

// Price ranges for quick filtering
const priceRanges = [
  { label: 'Under $100', min: 0, max: 100 },
  { label: '$100 - $500', min: 100, max: 500 },
  { label: '$500 - $1,000', min: 500, max: 1000 },
  { label: '$1,000 - $5,000', min: 1000, max: 5000 },
  { label: '$5,000+', min: 5000, max: null }
];

// Condition options
const conditionOptions = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'parts_only', label: 'Parts Only' }
];

// Sort options
const sortOptions = [
  { value: 'date_desc', label: 'Newest First' },
  { value: 'date_asc', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'views_desc', label: 'Most Popular' },
  { value: 'location', label: 'Nearest First' }
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPriceRange, setSelectedPriceRange] = useState("");

  // Fetch categories
  const { data: categories = [] } = useQuery<MarketplaceCategory[]>({
    queryKey: ["/api/marketplace/categories"],
  });

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (selectedCategory && selectedCategory !== 'all') params.append('categoryId', selectedCategory);
    if (selectedState && selectedState !== 'all') params.append('state', selectedState);
    if (selectedCondition && selectedCondition !== 'all') params.append('condition', selectedCondition);
    if (sortBy) params.append('sortBy', sortBy);
    if (priceMin) params.append('priceMin', priceMin);
    if (priceMax) params.append('priceMax', priceMax);
    return params.toString();
  };

  // Fetch listings with filters
  const { data: listings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/listings", buildQueryParams()],
  });

  // Handle price range selection
  const handlePriceRangeChange = (range: typeof priceRanges[0]) => {
    setPriceMin(range.min.toString());
    setPriceMax(range.max ? range.max.toString() : '');
    setSelectedPriceRange(`${range.min}-${range.max || 'max'}`);
  };

  // Save listing mutation
  const saveListingMutation = useMutation({
    mutationFn: (listingId: string) => apiRequest("POST", `/api/marketplace/listings/${listingId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      toast({
        title: "Saved!",
        description: "Item saved to your collection",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save item",
        variant: "destructive",
      });
    },
  });

  const formatPrice = (price: number, priceType: string) => {
    if (priceType === "negotiable") return "Price Negotiable";
    if (priceType === "contact") return "Contact for Price";
    if (priceType === "best_offer") return `${formatCurrency(price)} OBO`;
    return formatCurrency(price);
  };

  const formatCurrency = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
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
    const IconComponent = categoryIcons[iconName as keyof typeof categoryIcons] || Package;
    return <IconComponent className="h-6 w-6" />;
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Trust & Quality Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="flex items-center justify-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Quality Items from Trusted Sellers</span>
            </div>
            <div className="flex items-center justify-center">
              <Shield className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Verified Quality & Authenticity</span>
            </div>
            <div className="flex items-center justify-center">
              <Target className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Professional-Grade Equipment</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Exchange Hub
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Quality equipment, vehicles, and items from trusted sellers
            </p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center text-sm text-emerald-600">
                <DollarSign className="h-4 w-4 mr-1" />
                Competitive pricing
              </div>
              <div className="flex items-center text-sm text-blue-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Quality equipment
              </div>
            </div>
          </div>
          
          {isAuthenticated && (
            <Button 
              onClick={() => setLocation('/marketplace/list')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              List Item
            </Button>
          )}
        </div>

        {/* Featured Categories */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Browse Categories
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredCategories.map((category) => (
              <Card 
                key={category.id}
                className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                  selectedCategory === category.id 
                    ? `border-${category.color}-500 bg-${category.color}-50 dark:bg-${category.color}-900/20`
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => {
                  setSelectedCategory(selectedCategory === category.id ? '' : category.id);
                }}
              >
                <CardContent className="p-4 text-center">
                  <div className={`mx-auto mb-2 w-12 h-12 rounded-lg bg-${category.color}-100 dark:bg-${category.color}-900/30 flex items-center justify-center`}>
                    {getFeaturedCategoryIcon(category.icon)}
                  </div>
                  <h3 className="font-medium text-sm text-gray-900 dark:text-white">
                    {category.name}
                  </h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
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
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {(selectedCategory || selectedCondition || selectedState || priceMin || priceMax) && (
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
                                {getCategoryIcon(category.iconName || 'package')}
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
                          variant={selectedPriceRange === `${range.min}-${range.max || 'max'}` ? "default" : "outline"}
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
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Verification Notice for Food Category */}
        {selectedCategory === 'food' && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                    Local Food & Artisan Goods - Verification Required
                  </h3>
                  <p className="text-emerald-800 dark:text-emerald-200 text-sm mb-4">
                    For food safety and legal compliance, all buyers and sellers in the Local Food & Artisan Goods 
                    category must complete identity verification and provide proof of following all applicable laws.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">For Sellers:</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <li>• Valid ID or Driver's License</li>
                        <li>• Food Handler's Permit (if applicable)</li>
                        <li>• Kitchen Inspection Certificate</li>
                        <li>• Proof of Legal Compliance</li>
                      </ul>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">For Buyers:</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <li>• Valid ID or Driver's License</li>
                        <li>• Age verification (18+)</li>
                        <li>• Address verification</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      Start Verification Process
                    </Button>
                    <Button variant="outline" size="sm">
                      Learn More About Requirements
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
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
        ) : listings.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="flex flex-col items-center justify-center">
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No items found
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md">
                  Adjust your search criteria or be the first to list an item for sale.
                </p>
                {isAuthenticated && (
                  <Button 
                    onClick={() => setLocation('/marketplace/list')}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    List Your First Item
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
              : "space-y-4"
          }>
            {listings.map((listing) => (
              <Card 
                key={listing.id} 
                className="group cursor-pointer transition-all hover:shadow-lg"
                onClick={() => setLocation(`/marketplace/item/${listing.id}`)}
              >
                {viewMode === 'grid' ? (
                  <>
                    <div className="relative overflow-hidden rounded-t-lg">
                      <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                        <Package className="h-12 w-12 text-gray-400" />
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="text-xs">
                          {listing.condition}
                        </Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 bg-white/80 hover:bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveListingMutation.mutate(listing.id);
                          }}
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {listing.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {listing.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-emerald-600">
                          {formatPrice(parseFloat(listing.price), listing.priceType)}
                        </span>
                        <div className="flex items-center text-xs text-gray-500">
                          <MapPin className="h-3 w-3 mr-1" />
                          {formatLocationString(listing)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(listing.createdAt || '').toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <Eye className="h-3 w-3 mr-1" />
                          {listing.viewCount || 0}
                        </div>
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
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
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
                                {new Date(listing.createdAt || '').toLocaleDateString()}
                              </span>
                              <span className="flex items-center">
                                <Eye className="h-3 w-3 mr-1" />
                                {listing.viewCount || 0}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-emerald-600 mb-1">
                              {formatPrice(parseFloat(listing.price), listing.priceType)}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {listing.condition}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}