import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Search, 
  MapPin, 
  DollarSign, 
  Star, 
  Eye,
  Heart,
  MessageSquare,
  Filter,
  Plus,
  Building,
  Home,
  Car,
  Wrench,
  Palette,
  TreePine,
  Briefcase,
  Smartphone,
  Trophy,
  Gem,
  Package
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [priceRange, setPriceRange] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch exchange items
  const { data: items, isLoading } = useQuery<ExchangeItem[]>({
    queryKey: ['/api/exchange/items', selectedCategory, locationFilter, sortBy, priceRange, conditionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
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
    return colors[condition as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Exchange</h1>
        <p className="text-gray-300">Premium equipment and valuable items marketplace</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-800 border-slate-700">
          <TabsTrigger value="browse" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Browse Items
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Categories
          </TabsTrigger>
          <TabsTrigger value="sell" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Sell Item
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          {/* Search and Filters */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
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
                  <SelectContent className="bg-slate-800 border-slate-700">
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
                  <SelectContent className="bg-slate-800 border-slate-700">
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
                  <SelectContent className="bg-slate-800 border-slate-700">
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
                <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
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
                  <Card key={item.id} className="bg-slate-800 border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer">
                    <div className="relative">
                      <div className="h-48 bg-slate-700 rounded-t-lg flex items-center justify-center">
                        <IconComponent className="h-12 w-12 text-slate-500" />
                      </div>
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
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Contact
                        </Button>
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

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EXCHANGE_CATEGORIES.map((category) => {
              const IconComponent = category.icon;
              return (
                <Card key={category.id} className="bg-slate-800 border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer"
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
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">List Your Item</CardTitle>
              <p className="text-gray-400">Create a premium listing for your valuable item</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="text-white">Item Title</Label>
                    <Input id="title" placeholder="Enter item title" className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  
                  <div>
                    <Label htmlFor="category" className="text-white">Category</Label>
                    <Select>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
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
                    <Input id="price" type="number" placeholder="Enter price" className="bg-slate-700 border-slate-600 text-white" />
                  </div>

                  <div>
                    <Label htmlFor="condition" className="text-white">Condition</Label>
                    <Select>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
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
                      placeholder="Describe your item in detail..." 
                      className="bg-slate-700 border-slate-600 text-white min-h-32"
                    />
                  </div>

                  <div>
                    <Label htmlFor="location" className="text-white">Location</Label>
                    <Input id="location" placeholder="City, State" className="bg-slate-700 border-slate-600 text-white" />
                  </div>

                  <div>
                    <Label className="text-white">Images</Label>
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                      <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">Click to upload images</p>
                      <p className="text-sm text-gray-500">Up to 8 high-quality images</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Save Draft
                </Button>
                <Button className="bg-orange-500 hover:bg-orange-600">
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