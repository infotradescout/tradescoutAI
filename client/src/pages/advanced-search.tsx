import { memo, useState } from 'react';
import { Search, SlidersHorizontal, Compass, Award, DollarSign, Clock, Users2, Briefcase, Crown, Target, Map, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

const AdvancedSearch = memo(function AdvancedSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState([25]);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [rating, setRating] = useState([4.0]);
  const [viewMode, setViewMode] = useState("list");

  const serviceCategories = [
    { id: 'electrical', name: 'Electrical', count: 847 },
    { id: 'plumbing', name: 'Plumbing', count: 923 },
    { id: 'roofing', name: 'Roofing', count: 634 },
    { id: 'hvac', name: 'HVAC', count: 567 },
    { id: 'flooring', name: 'Flooring', count: 445 },
    { id: 'painting', name: 'Painting', count: 789 },
    { id: 'landscaping', name: 'Landscaping', count: 678 },
    { id: 'remodeling', name: 'Kitchen/Bath Remodeling', count: 356 }
  ];

  const specializations = [
    'Residential', 'Commercial', 'Industrial', 'Emergency Services',
    'Green/Eco-Friendly', 'Historic Renovation', 'ADA Compliance', 'Smart Home Integration'
  ];

  const certifications = [
    'Licensed', 'Bonded', 'Insured', 'BBB Accredited', 'OSHA Certified',
    'EPA Certified', 'Energy Star Partner', 'Lead-Safe Certified'
  ];

  const searchResults = [
    {
      id: 1,
      name: "Elite Electrical Services",
      rating: 4.9,
      reviewCount: 127,
      location: "Los Angeles, CA",
      distance: "5.2 miles",
      specializations: ["Residential", "Smart Home", "Emergency Services"],
      certifications: ["Licensed", "Bonded", "Insured"],
      priceRange: "$$",
      availability: "Available Today",
      profileImage: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop",
      verified: true,
      responseTime: "< 2 hours",
      completedJobs: 247
    },
    {
      id: 2,
      name: "Pro Plumbing Solutions", 
      rating: 4.8,
      reviewCount: 89,
      location: "Pasadena, CA",
      distance: "12.7 miles",
      specializations: ["Residential", "Commercial", "Emergency Services"],
      certifications: ["Licensed", "Insured", "EPA Certified"],
      priceRange: "$$$",
      availability: "Next Week",
      profileImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop",
      verified: true,
      responseTime: "< 4 hours",
      completedJobs: 156
    },
    {
      id: 3,
      name: "Precision Roofing Co.",
      rating: 4.7,
      reviewCount: 203,
      location: "Burbank, CA", 
      distance: "18.3 miles",
      specializations: ["Residential", "Commercial", "Historic Renovation"],
      certifications: ["Licensed", "Bonded", "Insured", "OSHA Certified"],
      priceRange: "$$",
      availability: "Available Tomorrow",
      profileImage: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100&h=100&fit=crop",
      verified: true,
      responseTime: "< 6 hours",
      completedJobs: 334
    }
  ];

  const savedSearches = [
    { name: "Emergency Plumbers Nearby", filters: "Plumbing • Emergency • < 10 miles • 4.5+ stars" },
    { name: "Kitchen Remodelers", filters: "Remodeling • Residential • $5,000-$15,000 • Licensed" },
    { name: "Eco-Friendly Contractors", filters: "All Categories • Green/Eco • Energy Star • Any Price" }
  ];

  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Search className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Advanced Search</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Find the perfect contractor with detailed filters and smart matching
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5" />
                  Search Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Basic Search */}
                  <div>
                    <Label className="text-white mb-2 block">What do you need?</Label>
                    <Input
                      placeholder="e.g., electrical repair, kitchen remodel..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <Label className="text-white mb-2 block">Location</Label>
                    <Input
                      placeholder="Enter city, zip, or address"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="bg-navy-700 border-navy-600 text-white mb-3"
                    />
                    <div>
                      <Label className="text-white text-sm mb-2 block">Radius: {radius[0]} miles</Label>
                      <Slider
                        value={radius}
                        onValueChange={setRadius}
                        max={50}
                        min={1}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Service Categories */}
                  <div>
                    <Label className="text-white mb-3 block">Service Categories</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {serviceCategories.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox id={category.id} />
                          <label
                            htmlFor={category.id}
                            className="text-sm text-gray-300 cursor-pointer flex-1"
                          >
                            {category.name}
                          </label>
                          <span className="text-xs text-gray-400">({category.count})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price Range */}
                  <div>
                    <Label className="text-white mb-2 block">
                      Price Range: ${priceRange[0]} - ${priceRange[1]}
                    </Label>
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      max={25000}
                      min={0}
                      step={250}
                      className="w-full"
                    />
                  </div>

                  {/* Rating */}
                  <div>
                    <Label className="text-white mb-2 block">
                      Minimum Rating: {rating[0]} stars
                    </Label>
                    <Slider
                      value={rating}
                      onValueChange={setRating}
                      max={5}
                      min={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  {/* Specializations */}
                  <div>
                    <Label className="text-white mb-3 block">Specializations</Label>
                    <div className="space-y-2">
                      {specializations.map((spec) => (
                        <div key={spec} className="flex items-center space-x-2">
                          <Checkbox id={spec} />
                          <label
                            htmlFor={spec}
                            className="text-sm text-gray-300 cursor-pointer"
                          >
                            {spec}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Certifications */}
                  <div>
                    <Label className="text-white mb-3 block">Required Certifications</Label>
                    <div className="space-y-2">
                      {certifications.map((cert) => (
                        <div key={cert} className="flex items-center space-x-2">
                          <Checkbox id={cert} />
                          <label
                            htmlFor={cert}
                            className="text-sm text-gray-300 cursor-pointer"
                          >
                            {cert}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Availability */}
                  <div>
                    <Label className="text-white mb-2 block">Availability</Label>
                    <Select>
                      <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Available Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full bg-orange-600 hover:bg-orange-700">
                    Apply Filters
                  </Button>
                  
                  <Button variant="outline" className="w-full border-orange-600 text-orange-400 hover:bg-orange-600/20">
                    Clear All
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Saved Searches */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-lg">Saved Searches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {savedSearches.map((search, index) => (
                    <div key={index} className="p-3 bg-navy-700/50 rounded-lg hover:bg-navy-600/50 transition-colors cursor-pointer">
                      <h4 className="text-white font-medium text-sm">{search.name}</h4>
                      <p className="text-gray-400 text-xs mt-1">{search.filters}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4 border-orange-600 text-orange-400 hover:bg-orange-600/20">
                  Save Current Search
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-white text-2xl font-bold">Search Results</h2>
                <p className="text-gray-400">{searchResults.length} contractors found</p>
              </div>
              
              <div className="flex items-center gap-4">
                <Select>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white w-48">
                    <SelectValue placeholder="Sort by Relevance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Best Match</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="distance">Closest</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="reviews">Most Reviews</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    onClick={() => setViewMode('list')}
                    className={viewMode === 'list' ? 'bg-orange-600 hover:bg-orange-700' : 'border-navy-600 text-gray-400 hover:bg-navy-600/50'}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'map' ? 'default' : 'outline'}
                    onClick={() => setViewMode('map')}
                    className={viewMode === 'map' ? 'bg-orange-600 hover:bg-orange-700' : 'border-navy-600 text-gray-400 hover:bg-navy-600/50'}
                  >
                    <Map className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-6">
              {searchResults.map((contractor) => (
                <Card key={contractor.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm hover:bg-navy-700/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      {/* Profile Image */}
                      <div className="flex-shrink-0">
                        <img
                          src={contractor.profileImage}
                          alt={contractor.name}
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                      </div>

                      {/* Main Content */}
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-white text-xl font-semibold">{contractor.name}</h3>
                              {contractor.verified && (
                                <Badge className="bg-blue-600 hover:bg-blue-700">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <div className="flex items-center gap-1">
                                <Crown className="h-4 w-4 text-yellow-400 fill-current" />
                                <span className="text-white">{contractor.rating}</span>
                                <span>({contractor.reviewCount} reviews)</span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Compass className="h-4 w-4" />
                                <span>{contractor.location} • {contractor.distance}</span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Briefcase className="h-4 w-4" />
                                <span>{contractor.completedJobs} jobs completed</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-orange-400 font-bold text-lg">{contractor.priceRange}</div>
                            <div className="text-green-400 text-sm">{contractor.availability}</div>
                          </div>
                        </div>

                        {/* Specializations */}
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1">
                            {contractor.specializations.map((spec, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Certifications */}
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-1">
                            {contractor.certifications.map((cert, index) => (
                              <Badge key={index} className="bg-green-600/20 text-green-400 text-xs">
                                <Award className="h-3 w-3 mr-1" />
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Response Time */}
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex items-center gap-1 text-gray-400 text-sm">
                            <Clock className="h-4 w-4" />
                            <span>Responds {contractor.responseTime}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                          <Button className="bg-orange-600 hover:bg-orange-700">
                            View Profile
                          </Button>
                          <Button variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                            Contact
                          </Button>
                          <Button variant="outline" className="border-navy-600 text-gray-400 hover:bg-navy-600/50">
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More */}
            <div className="text-center mt-8">
              <Button className="bg-orange-600 hover:bg-orange-700 px-8">
                Load More Results
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AdvancedSearch;