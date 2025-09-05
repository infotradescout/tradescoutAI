import { memo, useState } from 'react';
import { Home, Search, Filter, MapPin, Bed, Bath, Square, Heart, Eye, Star, Phone, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RealEstateMarketplace = memo(function RealEstateMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState("all");
  const [propertyType, setPropertyType] = useState("all");
  const [bedrooms, setBedrooms] = useState("all");

  const properties = [
    {
      id: 1,
      title: "Modern Family Home in Maple Grove",
      price: "$675,000",
      beds: 4,
      baths: 3,
      sqft: 2400,
      address: "1247 Oak Street, Maple Grove, CA",
      type: "Single Family",
      status: "For Sale",
      images: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop"],
      agent: {
        name: "Jennifer Martinez",
        company: "Premier Realty",
        phone: "(555) 123-4567",
        rating: 4.9,
        reviews: 127
      },
      features: ["Updated Kitchen", "Hardwood Floors", "2-Car Garage", "Fenced Yard"],
      daysOnMarket: 12,
      views: 234,
      saves: 45,
      description: "Beautiful updated home in desirable neighborhood with excellent schools.",
      yearBuilt: 2018,
      lotSize: "0.25 acres"
    },
    {
      id: 2,
      title: "Luxury Condo with City Views",
      price: "$450,000",
      beds: 2,
      baths: 2,
      sqft: 1200,
      address: "888 Downtown Plaza, Unit 15A, Los Angeles, CA",
      type: "Condo",
      status: "For Sale",
      images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop"],
      agent: {
        name: "Michael Chen",
        company: "Urban Properties",
        phone: "(555) 234-5678",
        rating: 4.8,
        reviews: 89
      },
      features: ["City Views", "Balcony", "In-Unit Laundry", "Gym Access"],
      daysOnMarket: 5,
      views: 189,
      saves: 32,
      description: "Stunning high-rise condo with panoramic city views and luxury amenities.",
      yearBuilt: 2020,
      lotSize: "N/A"
    },
    {
      id: 3,
      title: "Charming Craftsman Bungalow",
      price: "$525,000",
      beds: 3,
      baths: 2,
      sqft: 1800,
      address: "456 Elm Avenue, Pasadena, CA",
      type: "Single Family",
      status: "For Sale",
      images: ["https://images.unsplash.com/photo-1598228723793-52759bba239c?w=400&h=300&fit=crop"],
      agent: {
        name: "Sarah Thompson",
        company: "Heritage Homes",
        phone: "(555) 345-6789",
        rating: 4.7,
        reviews: 156
      },
      features: ["Original Character", "Updated Plumbing", "Large Lot", "Fruit Trees"],
      daysOnMarket: 8,
      views: 156,
      saves: 28,
      description: "Classic craftsman with original details and modern updates in historic neighborhood.",
      yearBuilt: 1925,
      lotSize: "0.18 acres"
    },
    {
      id: 4,
      title: "New Construction Townhome",
      price: "$399,000",
      beds: 3,
      baths: 2.5,
      sqft: 1650,
      address: "789 Village Square, Irvine, CA",
      type: "Townhome",
      status: "For Sale",
      images: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop"],
      agent: {
        name: "Robert Davis",
        company: "New Home Specialists",
        phone: "(555) 456-7890",
        rating: 4.9,
        reviews: 203
      },
      features: ["Brand New", "Smart Home", "2-Car Garage", "HOA Amenities"],
      daysOnMarket: 2,
      views: 298,
      saves: 67,
      description: "Brand new energy-efficient townhome in master-planned community.",
      yearBuilt: 2024,
      lotSize: "0.05 acres"
    }
  ];

  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Home className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Real Estate Marketplace</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Find your perfect home with trusted local realtors
          </p>
        </div>

        {/* Real Estate Professional Tools */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-orange-400">
              <Home className="h-5 w-5" />
              Real Estate Professional Tools
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <a href="/realtor-dashboard" className="bg-navy-700/50 hover:bg-navy-700 rounded-lg p-4 transition-all duration-300 group text-center">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <div className="text-sm font-medium text-white">Dashboard</div>
              </a>
              <a href="/realtor/clients" className="bg-navy-700/50 hover:bg-navy-700 rounded-lg p-4 transition-all duration-300 group text-center">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-white">Clients</div>
              </a>
              <a href="/realtor/market-analysis" className="bg-navy-700/50 hover:bg-navy-700 rounded-lg p-4 transition-all duration-300 group text-center">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 00-2 2h2a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-white">Market Analysis</div>
              </a>
              <a href="/realtor/connections" className="bg-navy-700/50 hover:bg-navy-700 rounded-lg p-4 transition-all duration-300 group text-center">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-white">Connections</div>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by location, school, etc..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-navy-700 border-navy-600 text-white"
                />
              </div>
              
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Price Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="under-300k">Under $300,000</SelectItem>
                  <SelectItem value="300k-500k">$300,000 - $500,000</SelectItem>
                  <SelectItem value="500k-750k">$500,000 - $750,000</SelectItem>
                  <SelectItem value="over-750k">Over $750,000</SelectItem>
                </SelectContent>
              </Select>

              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Property Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="single-family">Single Family</SelectItem>
                  <SelectItem value="condo">Condo</SelectItem>
                  <SelectItem value="townhome">Townhome</SelectItem>
                  <SelectItem value="multi-family">Multi-Family</SelectItem>
                </SelectContent>
              </Select>

              <Select value={bedrooms} onValueChange={setBedrooms}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Bedrooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Bedrooms</SelectItem>
                  <SelectItem value="1">1+ Bedrooms</SelectItem>
                  <SelectItem value="2">2+ Bedrooms</SelectItem>
                  <SelectItem value="3">3+ Bedrooms</SelectItem>
                  <SelectItem value="4">4+ Bedrooms</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400 text-sm">{properties.length} properties found</span>
            </div>
          </CardContent>
        </Card>

        {/* Property Listings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {properties.map((property) => (
            <Card key={property.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm hover:bg-navy-700/50 transition-colors">
              <CardHeader className="p-0">
                <div className="relative">
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="w-full h-64 object-cover rounded-t-lg"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-orange-600 hover:bg-orange-700">
                      {property.status}
                    </Badge>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-2">
                    <Button size="sm" variant="secondary" className="p-2">
                      <Heart className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="secondary" className="p-2">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="secondary" className="bg-black/50 text-white">
                      {property.daysOnMarket} days on market
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">{property.title}</h3>
                    <p className="text-3xl font-bold text-orange-400">{property.price}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mb-4 text-gray-300">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">{property.address}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Bed className="h-4 w-4" />
                    {property.beds} beds
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Bath className="h-4 w-4" />
                    {property.baths} baths
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Square className="h-4 w-4" />
                    {property.sqft.toLocaleString()} sqft
                  </div>
                </div>

                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {property.description}
                </p>

                <div className="mb-4">
                  <p className="text-gray-400 text-sm mb-2">Key Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {property.features.slice(0, 3).map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {property.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{property.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4 p-3 bg-navy-700/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium text-sm">{property.agent.name}</p>
                    <p className="text-gray-400 text-xs">{property.agent.company}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                      <span className="text-yellow-400 text-xs">{property.agent.rating}</span>
                    </div>
                    <p className="text-gray-400 text-xs">{property.agent.reviews} reviews</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="text-gray-400 text-sm">
                    Built {property.yearBuilt} • Lot: {property.lotSize}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {property.views} views • {property.saves} saved
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-orange-600 hover:bg-orange-700 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contact Agent
                  </Button>
                  <Button variant="outline" className="flex-1 border-orange-600 text-orange-400 hover:bg-orange-600/20 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule Tour
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-8">
          <Button className="bg-orange-600 hover:bg-orange-700 px-8">
            Load More Properties
          </Button>
        </div>
      </div>
    </div>
  );
});

export default RealEstateMarketplace;