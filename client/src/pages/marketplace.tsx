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
  Fish
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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Community Marketplace
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Buy and sell high-value items in your local community
              </p>
            </div>
            <Button onClick={() => setLocation("/marketplace/sell")} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Sell Item
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
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
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
                  <label className="text-sm font-medium mb-2 block">Condition</label>
                  <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any Condition</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="like_new">Like New</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Price Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Min"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      type="number"
                    />
                    <Input
                      placeholder="Max"
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
                      <SelectItem value="date_desc">Newest First</SelectItem>
                      <SelectItem value="date_asc">Oldest First</SelectItem>
                      <SelectItem value="price_asc">Price: Low to High</SelectItem>
                      <SelectItem value="price_desc">Price: High to Low</SelectItem>
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
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No items found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Try adjusting your search filters or be the first to list an item.
                  </p>
                  <Button onClick={() => setLocation("/marketplace/sell")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Listing
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-lg font-bold text-blue-600 dark:text-blue-400">
                            <DollarSign className="h-4 w-4" />
                            {formatPrice(Number(listing.price), listing.priceType)}
                          </div>
                          <div className="flex items-center space-x-2 text-gray-500 text-sm">
                            <div className="flex items-center">
                              <Eye className="h-3 w-3 mr-1" />
                              {listing.viewCount}
                            </div>
                            <div className="flex items-center">
                              <Heart className="h-3 w-3 mr-1" />
                              {listing.favoriteCount}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <Badge variant="secondary" className="capitalize">
                            {listing.condition?.replace('_', ' ')}
                          </Badge>
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