import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Search, Heart, ShoppingBag, Star, MapPin, Filter, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ReportContentModal } from "@/components/ReportContentModal";

interface HandmadeProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  compareAtPrice?: string;
  primaryImageUrl?: string;
  images?: string[];
  materials?: string[];
  colors?: string[];
  city?: string;
  stateCode?: string;
  freeShipping: boolean;
  featured: boolean;
  viewCount: number;
  favoriteCount: number;
  inStock: boolean;
  sellerId: string;
}

interface HandmadeCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
}

export default function HandmadeMarketplace() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("featured");
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    materials: [] as string[],
    freeShipping: false,
    inStock: true,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<HandmadeCategory[]>({
    queryKey: ["/api/handmade/categories"],
  });

  // Fetch products
  const { data: products = [], isLoading } = useQuery<HandmadeProduct[]>({
    queryKey: ["/api/handmade/products", {
      search: searchTerm,
      categoryId: selectedCategory,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      materials: filters.materials,
      inStock: filters.inStock,
      featured: sortBy === "featured",
    }],
  });

  const handleToggleFavorite = async (productId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorites",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("POST", `/api/handmade/products/${productId}/favorite`);
      toast({
        title: "Success",
        description: "Favorite updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorite",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(price));
  };

  const renderProductCard = (product: HandmadeProduct) => (
    <Card key={product.id} className="group hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="relative aspect-square overflow-hidden rounded-t-lg">
          {product.primaryImageUrl ? (
            <img
              src={product.primaryImageUrl}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full bg-[#0f1419] flex items-center justify-center">
              <ShoppingBag className="w-16 h-16 text-gray-400" />
            </div>
          )}
          {product.featured && (
            <Badge className="absolute top-2 left-2 bg-blue-500">Featured</Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-[#0f1419]/80 hover:bg-[#0f1419]"
            onClick={(e) => {
              e.preventDefault();
              handleToggleFavorite(product.id);
            }}
          >
            <Heart className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <Link href={`/handmade/products/${product.id}`}>
          <h3 className="font-medium text-lg mb-2 hover:text-blue-600 transition-colors line-clamp-2">
            {product.title}
          </h3>
        </Link>
        
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold text-xl text-blue-600">
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-sm text-gray-500 line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>

        {product.city && product.stateCode && (
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
            <MapPin className="w-3 h-3" />
            <span>{product.city}, {product.stateCode}</span>
          </div>
        )}

        {product.materials && product.materials.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {product.materials.slice(0, 3).map((material) => (
              <Badge key={material} variant="secondary" className="text-xs">
                {material}
              </Badge>
            ))}
            {product.materials.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{product.materials.length - 3} more
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3" />
            <span>{product.favoriteCount} favorites</span>
          </div>
          <div className="flex items-center gap-2">
            {product.freeShipping && (
              <Badge variant="outline" className="text-xs">Free Shipping</Badge>
            )}
            {!product.inStock && (
              <Badge variant="error" className="text-xs">Out of Stock</Badge>
            )}
          </div>
        </div>
      </CardContent>
      
      {isAuthenticated && (
        <CardFooter className="pt-0 px-4 pb-4">
          <ReportContentModal
            contentType="handmade_product"
            contentId={product.id}
            contentOwnerId={product.sellerId}
            triggerClassName="ml-auto"
          />
        </CardFooter>
      )}
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Handmade Marketplace</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Discover unique, handcrafted items from talented artisans in your community.
          Support local makers and find one-of-a-kind treasures.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search handmade products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600">View:</span>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8 flex gap-4 justify-center">
        <Link href="/handmade-marketplace">
          <Button className="bg-blue-600 hover:bg-blue-700">
            Start Selling
          </Button>
        </Link>
        {isAuthenticated && (
          <Link href="/handmade-marketplace">
            <Button variant="outline">
              <Heart className="w-4 h-4 mr-2" />
              My Favorites
            </Button>
          </Link>
        )}
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-t-lg"></div>
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className={`
          ${viewMode === "grid" 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
            : "space-y-4"
          }
        `}>
          {products.map(renderProductCard)}
        </div>
      ) : (
        <div className="text-center py-16">
          <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium mb-2">No products found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search or filters to find what you're looking for.
          </p>
          <Button variant="outline" onClick={() => {
            setSearchTerm("");
            setSelectedCategory("");
            setFilters({
              minPrice: "",
              maxPrice: "",
              materials: [],
              freeShipping: false,
              inStock: true,
            });
          }}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Categories Section */}
      {categories.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Shop by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Card 
                key={category.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedCategory(category.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <ShoppingBag className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium text-sm">{category.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}