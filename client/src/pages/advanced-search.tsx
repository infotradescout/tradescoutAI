import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, Save, Bell, MapPin, Star, Truck, Shield, Heart } from "lucide-react";
import { Link } from "wouter";

export default function AdvancedSearch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("");
  const [verifiedSellersOnly, setVerifiedSellersOnly] = useState(false);
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [buyerProtectionOnly, setBuyerProtectionOnly] = useState(false);
  const [sortBy, setSortBy] = useState("date_desc");
  const [saveSearchEnabled, setSaveSearchEnabled] = useState(false);

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ["/api/marketplace/categories"],
  });

  // Fetch search results
  const { data: searchResults, isLoading: isSearching, refetch: performSearch } = useQuery({
    queryKey: ["/api/marketplace/search", {
      query: searchQuery,
      category: selectedCategory,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      location,
      condition,
      verifiedOnly: verifiedSellersOnly,
      freeShipping: freeShippingOnly,
      buyerProtection: buyerProtectionOnly,
      sortBy
    }],
    enabled: false, // Manual trigger
  });

  // Save search mutation
  const saveSearchMutation = useMutation({
    mutationFn: async (searchData: any) => {
      const response = await apiRequest("POST", "/api/saved-searches", searchData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Search Saved",
        description: "You'll receive alerts when new matching items are listed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
    },
  });

  // Get user's saved searches
  const { data: savedSearches } = useQuery({
    queryKey: ["/api/saved-searches"],
  });

  const handleSearch = () => {
    // Log search analytics
    apiRequest("POST", "/api/search-analytics", {
      searchQuery,
      searchType: "marketplace",
      filters: {
        category: selectedCategory,
        priceRange,
        location,
        condition,
        verifiedOnly: verifiedSellersOnly,
        freeShipping: freeShippingOnly,
        buyerProtection: buyerProtectionOnly,
        sortBy
      }
    });
    
    performSearch();
  };

  const handleSaveSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a search term before saving",
        variant: "destructive",
      });
      return;
    }

    saveSearchMutation.mutate({
      searchType: "marketplace",
      searchQuery,
      filters: {
        category: selectedCategory,
        priceRange,
        location,
        condition,
        verifiedOnly: verifiedSellersOnly,
        freeShipping: freeShippingOnly,
        buyerProtection: buyerProtectionOnly,
        sortBy
      },
      alertsEnabled: saveSearchEnabled
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setPriceRange([0, 10000]);
    setLocation("");
    setCondition("");
    setVerifiedSellersOnly(false);
    setFreeShippingOnly(false);
    setBuyerProtectionOnly(false);
    setSortBy("date_desc");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Advanced Marketplace Search</h1>
          <p className="text-muted-foreground">
            Find exactly what you're looking for with powerful search filters
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Search Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Search Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search Query */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search Terms</Label>
                  <Input
                    id="search"
                    placeholder="What are you looking for?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range */}
                <div className="space-y-2">
                  <Label>Price Range</Label>
                  <div className="px-2">
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      max={10000}
                      step={100}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                      <span>${priceRange[0]}</span>
                      <span>${priceRange[1]}</span>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="City, State or ZIP"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                {/* Condition */}
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Condition</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="like_new">Like New</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">For Parts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Special Filters */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="verified"
                      checked={verifiedSellersOnly}
                      onCheckedChange={setVerifiedSellersOnly}
                    />
                    <Label htmlFor="verified" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Verified Sellers Only
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="free-shipping"
                      checked={freeShippingOnly}
                      onCheckedChange={setFreeShippingOnly}
                    />
                    <Label htmlFor="free-shipping" className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Free Shipping
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="buyer-protection"
                      checked={buyerProtectionOnly}
                      onCheckedChange={setBuyerProtectionOnly}
                    />
                    <Label htmlFor="buyer-protection" className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Buyer Protection
                    </Label>
                  </div>
                </div>

                <Separator />

                {/* Save Search */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="save-search">Save this search</Label>
                    <Switch
                      id="save-search"
                      checked={saveSearchEnabled}
                      onCheckedChange={setSaveSearchEnabled}
                    />
                  </div>
                  {saveSearchEnabled && (
                    <p className="text-sm text-muted-foreground">
                      Get alerts when new items match your search
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button onClick={handleSearch} className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                  {saveSearchEnabled && (
                    <Button 
                      onClick={handleSaveSearch} 
                      variant="outline" 
                      className="w-full"
                      disabled={saveSearchMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Search
                    </Button>
                  )}
                  <Button onClick={clearFilters} variant="ghost" className="w-full">
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Saved Searches */}
            {savedSearches && savedSearches.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Saved Searches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {savedSearches.map((search: any) => (
                      <div key={search.id} className="p-2 border rounded-md">
                        <div className="font-medium">{search.searchQuery}</div>
                        <div className="text-sm text-muted-foreground">
                          {search.alertsEnabled && (
                            <Badge variant="secondary" className="mr-2">
                              <Bell className="h-3 w-3 mr-1" />
                              Alerts On
                            </Badge>
                          )}
                          Saved {new Date(search.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Search Results */}
          <div className="lg:col-span-3">
            {/* Sort Options */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Label>Sort by:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Newest First</SelectItem>
                    <SelectItem value="date_asc">Oldest First</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="distance">Distance</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {searchResults && (
                <div className="text-sm text-muted-foreground">
                  {searchResults.length} results found
                </div>
              )}
            </div>

            {/* Search Results */}
            {isSearching ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="aspect-square bg-muted rounded-t-lg" />
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-6 bg-muted rounded mb-2" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {searchResults.map((listing: any) => (
                  <Card key={listing.id} className="group hover:shadow-lg transition-shadow">
                    <div className="relative">
                      <img
                        src={listing.images?.[0] || "/placeholder-image.jpg"}
                        alt={listing.title}
                        className="aspect-square object-cover rounded-t-lg"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                      >
                        <Heart className="h-4 w-4" />
                      </Button>
                      {listing.isVerifiedSeller && (
                        <Badge className="absolute top-2 left-2">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2 group-hover:text-primary">
                        {listing.title}
                      </h3>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold text-primary">
                          ${listing.price}
                        </span>
                        <Badge variant="secondary">{listing.condition}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <MapPin className="h-4 w-4" />
                        <span>{listing.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/marketplace/${listing.id}`}>
                          <Button size="sm" className="flex-1">
                            View Details
                          </Button>
                        </Link>
                        <Button size="sm" variant="outline">
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : searchResults && searchResults.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search criteria or browse all listings
                  </p>
                  <Link href="/marketplace">
                    <Button>Browse All Listings</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Advanced Marketplace Search</h3>
                  <p className="text-muted-foreground">
                    Use the filters on the left to find exactly what you're looking for
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}