import { memo, useState } from "react";
import { Car, Search, Filter, MapPin, Calendar, Fuel, Users, Star, Heart, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VehicleMarketplaceShell } from "@/shells/VehicleMarketplaceShell";
import { SEOHelmet } from "@/components/SEOHelmet";

const VehicleMarketplace = memo(function VehicleMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState("all");
  const [vehicleType, setVehicleType] = useState("all");
  const [location, setLocation] = useState("all");

  const vehicles = [
    {
      id: 1,
      title: "2021 Ford F-150 XLT",
      price: "$38,500",
      year: 2021,
      make: "Ford",
      model: "F-150 XLT",
      mileage: "45,000",
      location: "Los Angeles, CA",
      dealer: "Peterson Ford",
      rating: 4.8,
      features: ["4WD", "Crew Cab", "Backup Camera", "Bluetooth"],
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
      condition: "Excellent",
      fuel: "Gasoline",
      transmission: "Automatic",
      views: 145,
      saved: 23,
    },
    {
      id: 2,
      title: "2022 Toyota Camry Hybrid",
      price: "$32,900",
      year: 2022,
      make: "Toyota",
      model: "Camry Hybrid",
      mileage: "28,000",
      location: "Orange, CA",
      dealer: "Toyota of Orange",
      rating: 4.9,
      features: ["Hybrid", "Lane Assist", "Apple CarPlay", "Sunroof"],
      image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=300&fit=crop",
      condition: "Like New",
      fuel: "Hybrid",
      transmission: "CVT",
      views: 89,
      saved: 17,
    },
    {
      id: 3,
      title: "2020 Chevrolet Silverado",
      price: "$42,000",
      year: 2020,
      make: "Chevrolet",
      model: "Silverado 1500",
      mileage: "52,000",
      location: "Riverside, CA",
      dealer: "Chevy Center",
      rating: 4.6,
      features: ["V8 Engine", "Towing Package", "Leather Seats", "Remote Start"],
      image: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=400&h=300&fit=crop",
      condition: "Good",
      fuel: "Gasoline",
      transmission: "Automatic",
      views: 203,
      saved: 31,
    },
    {
      id: 4,
      title: "2023 Tesla Model 3",
      price: "$45,990",
      year: 2023,
      make: "Tesla",
      model: "Model 3",
      mileage: "12,000",
      location: "San Diego, CA",
      dealer: "Tesla San Diego",
      rating: 4.9,
      features: ["Autopilot", "Premium Audio", "Glass Roof", "Supercharging"],
      image: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400&h=300&fit=crop",
      condition: "Excellent",
      fuel: "Electric",
      transmission: "Single Speed",
      views: 267,
      saved: 45,
    },
  ];

  return (
    <VehicleMarketplaceShell>
      <SEOHelmet
        title="Vehicle Marketplace | Buy and Sell Local Vehicles"
        description="Browse TradeScout's local vehicle marketplace to find used vehicles from trusted sellers and dealers."
        canonical="https://www.thetradescout.com/vehicle-marketplace"
      />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Car className="h-8 w-8 text-ts-orange" />
          <h1 className="text-4xl font-bold text-white">Vehicle Marketplace</h1>
        </div>
        <p className="text-white/70 text-lg">
          Find quality pre-owned vehicles from trusted dealers in your area
        </p>
      </div>

      {/* Professional Seller Tools */}
      <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm mb-8">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-ts-orange">
            <Car className="h-5 w-5" />
            Car Sales Professional Tools
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/car-salesman-dashboard"
              className="bg-tsCard/50 hover:bg-tsCard rounded-lg p-4 transition-all duration-300 group text-center"
            >
              <div className="w-10 h-10 bg-ts-orange rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Car className="h-5 w-5 text-white" />
              </div>
              <div className="text-sm font-medium text-white">Dashboard</div>
            </a>
            <a
              href="/car-sales-new-listing"
              className="bg-tsCard/50 hover:bg-tsCard rounded-lg p-4 transition-all duration-300 group text-center"
            >
              <div className="w-10 h-10 bg-ts-orange rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <div className="text-sm font-medium text-white">New Listing</div>
            </a>
            <a
              href="/car-sales-customers"
              className="bg-tsCard/50 hover:bg-tsCard rounded-lg p-4 transition-all duration-300 group text-center"
            >
              <div className="w-10 h-10 bg-ts-orange rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="text-sm font-medium text-white">Customers</div>
            </a>
            <a
              href="/car-sales-financing"
              className="bg-tsCard/50 hover:bg-tsCard rounded-lg p-4 transition-all duration-300 group text-center"
            >
              <div className="w-10 h-10 bg-ts-orange rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
              <div className="text-sm font-medium text-white">Financing</div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/60" />
              <Input
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-tsCard border-white/10 text-white"
              />
            </div>

            <Select value={priceRange} onValueChange={setPriceRange}>
              <SelectTrigger className="bg-tsCard border-white/10 text-white">
                <SelectValue placeholder="Price Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                <SelectItem value="under-25k">Under $25,000</SelectItem>
                <SelectItem value="25k-35k">$25,000 - $35,000</SelectItem>
                <SelectItem value="35k-50k">$35,000 - $50,000</SelectItem>
                <SelectItem value="over-50k">Over $50,000</SelectItem>
              </SelectContent>
            </Select>

            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger className="bg-tsCard border-white/10 text-white">
                <SelectValue placeholder="Vehicle Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sedan">Sedan</SelectItem>
                <SelectItem value="suv">SUV</SelectItem>
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="hybrid">Hybrid/Electric</SelectItem>
              </SelectContent>
            </Select>

            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="bg-tsCard border-white/10 text-white">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="los-angeles">Los Angeles</SelectItem>
                <SelectItem value="orange-county">Orange County</SelectItem>
                <SelectItem value="riverside">Riverside</SelectItem>
                <SelectItem value="san-diego">San Diego</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-white/60" />
            <span className="text-white/60 text-sm">{vehicles.length} vehicles found</span>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Listings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {Array.isArray(vehicles)
          ? vehicles.map((vehicle) => (
              <Card
                key={vehicle.id}
                className="bg-tsCard/50 border-white/10 backdrop-blur-sm hover:bg-tsCard/50 transition-colors"
              >
                <CardHeader className="p-0">
                  <div className="relative">
                    <img
                      src={vehicle.image}
                      alt={vehicle.title}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-ts-orange-dark hover:bg-ts-orange-dark">
                        {vehicle.condition}
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
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-xl font-semibold text-white mb-1">{vehicle.title}</h2>
                      <p className="text-white/60 text-sm">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-ts-orange">{vehicle.price}</p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-yellow-400 text-sm">{vehicle.rating}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-white/70">
                      <Calendar className="h-4 w-4" />
                      {vehicle.year}
                    </div>
                    <div className="flex items-center gap-2 text-white/70">
                      <MapPin className="h-4 w-4" />
                      {vehicle.mileage} miles
                    </div>
                    <div className="flex items-center gap-2 text-white/70">
                      <Fuel className="h-4 w-4" />
                      {vehicle.fuel}
                    </div>
                    <div className="flex items-center gap-2 text-white/70">
                      <Users className="h-4 w-4" />
                      {vehicle.transmission}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <MapPin className="h-4 w-4" />
                      {vehicle.location}
                    </div>
                    <div className="text-white/60 text-sm">
                      {vehicle.views} views • {vehicle.saved} saved
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-white/60 text-sm mb-2">Key Features:</p>
                    <div className="flex flex-wrap gap-1">
                      {vehicle.features.slice(0, 3).map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {vehicle.features.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{vehicle.features.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 bg-ts-orange-dark hover:bg-ts-orange-dark">
                      Request Quote
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20"
                    >
                      View Details
                    </Button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-white/60 text-sm">
                      Listed by <span className="text-ts-orange">{vehicle.dealer}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          : null}
      </div>

      {/* Load More */}
      <div className="text-center mt-8">
        <Button className="bg-ts-orange-dark hover:bg-ts-orange-dark px-8">
          Load More Vehicles
        </Button>
      </div>
    </VehicleMarketplaceShell>
  );
});

export default VehicleMarketplace;
