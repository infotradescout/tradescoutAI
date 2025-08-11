import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Anchor,
  Bike,
  Hammer,
  Fish,
  TrendingUp,
  Shield,
  Target
} from "lucide-react";
import type { MarketplaceListing, MarketplaceCategory } from "@shared/schema";

// Icon mapping for categories
const categoryIcons = {
  Package,
  Car,
  Home,
  Wrench,
  Building,
  Anchor,
  Bike,
  Hammer,
  Fish,
  Tractor: Package // Fallback since Tractor isn't in lucide-react
};

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  // Fetch categories
  const { data: categories = [] } = useQuery<MarketplaceCategory[]>({
    queryKey: ["/api/marketplace/categories"],
  });

  // Fetch listings with filters
  const { data: listings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/listings", {
      search: searchQuery,
      categoryId: selectedCategory,
      state: selectedState,
      condition: selectedCondition,
      sortBy,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
    }],
  });

  const formatPrice = (price: number, priceType: string) => {
    if (priceType === "negotiable") return "Price Negotiable";
    if (priceType === "contact") return "Contact for Price";
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Investment Benefits Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center space-x-8 text-sm">
            <span className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Build Wealth Through Smart Asset Acquisition
            </span>
            <span className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Tax-Advantaged Investment Opportunities
            </span>
            <span className="flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Professional Equipment for Income Generation
            </span>
          </div>
        </div>
      </div>
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Asset Exchange Hub
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Smart investments in premium equipment, vehicles, and high-value assets
              </p>
              <div className="flex items-center space-x-6 mt-2 text-sm text-green-600 dark:text-green-400">
                <span className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Tax-advantaged purchases
                </span>
                <span className="flex items-center">
                  <Building className="h-4 w-4 mr-1" />
                  Asset appreciation potential
                </span>
              </div>
            </div>
            <Button onClick={() => setLocation("/marketplace/sell")} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              List Asset
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  Investment Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search Assets</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Find your next investment..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Asset Class</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Asset Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Asset Classes</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center">
                            {getCategoryIcon(category.iconName)}
                            <span className="ml-2">{category.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Asset Quality</label>
                  <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Conditions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Conditions</SelectItem>
                      <SelectItem value="new">Premium (New)</SelectItem>
                      <SelectItem value="like_new">Excellent (Like New)</SelectItem>
                      <SelectItem value="good">Solid Investment (Good)</SelectItem>
                      <SelectItem value="fair">Value Opportunity (Fair)</SelectItem>
                      <SelectItem value="poor">Project Asset (Poor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Investment Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Min Investment"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      type="number"
                    />
                    <Input
                      placeholder="Max Investment"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      type="number"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">State</label>
                  <Input
                    placeholder="State"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  />
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium mb-2 block">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Latest Opportunities</SelectItem>
                      <SelectItem value="date_asc">Established Assets</SelectItem>
                      <SelectItem value="price_asc">Entry-Level Investments</SelectItem>
                      <SelectItem value="price_desc">Premium Assets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Listings Grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-t-lg" />
                    <CardContent className="p-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" />
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <TrendingUp className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No investment opportunities found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Adjust your investment criteria or be the first to list a high-value asset for wealth building.
                  </p>
                  <Button onClick={() => setLocation("/marketplace/sell")} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" />
                    List Investment Asset
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <Card key={listing.id} className="group hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
                    <Link href={`/marketplace/listing/${listing.slug}`}>
                      <div className="aspect-video relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {listing.images && listing.images.length > 0 ? (
                          <img
                            src={listing.images[listing.primaryImageIndex || 0] || ''}
                            alt={listing.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                        {listing.isPromoted && (
                          <Badge className="absolute top-2 left-2 bg-yellow-500 text-white">
                            Featured
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                          {listing.title}
                        </h3>
                        <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm mb-2">
                          <MapPin className="h-3 w-3 mr-1" />
                          {formatLocationString(listing)}
                        </div>
                        
                        {/* Investment Metrics */}
                        <div className="flex space-x-1 mb-3">
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20">
                            Tax Benefits
                          </Badge>
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-900/20">
                            Appreciation Asset
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              <DollarSign className="h-4 w-4" />
                              {formatPrice(Number(listing.price), listing.priceType)}
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400">
                              Smart Investment
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center space-x-2 text-gray-500 text-xs">
                              <div className="flex items-center">
                                <Eye className="h-3 w-3 mr-1" />
                                {listing.viewCount}
                              </div>
                              <div className="flex items-center">
                                <Heart className="h-3 w-3 mr-1" />
                                {listing.favoriteCount}
                              </div>
                            </div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400">
                              Est. 8-12% ROI
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-between items-center">
                          <Badge variant="secondary" className="capitalize">
                            {listing.condition === 'new' ? 'Premium Asset' :
                             listing.condition === 'like_new' ? 'Excellent Quality' :
                             listing.condition === 'good' ? 'Solid Investment' :
                             listing.condition === 'fair' ? 'Value Opportunity' : 'Project Asset'}
                          </Badge>
                          <div className="text-xs text-gray-500">
                            Wealth Building
                          </div>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}