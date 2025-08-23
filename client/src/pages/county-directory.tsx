import { memo, useState } from 'react';
import { MapPin, Search, Users, Building, TrendingUp, ChevronRight, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CountyDirectory = memo(function CountyDirectory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  const counties = [
    {
      id: 1,
      name: "Los Angeles County",
      state: "California",
      fipsCode: "06037",
      population: 10014009,
      contractors: 2847,
      homeowners: 15623,
      helpers: 892,
      realtors: 456,
      activeProjects: 234,
      avgRating: 4.7,
      featured: true,
      description: "Major metropolitan hub with extensive construction and real estate activity"
    },
    {
      id: 2,
      name: "Cook County",
      state: "Illinois",
      fipsCode: "17031",
      population: 5275541,
      contractors: 1923,
      homeowners: 12456,
      helpers: 567,
      realtors: 389,
      activeProjects: 189,
      avgRating: 4.6,
      featured: true,
      description: "Chicago metropolitan area with diverse housing market and construction needs"
    },
    {
      id: 3,
      name: "Harris County",
      state: "Texas",
      fipsCode: "48201",
      population: 4731145,
      contractors: 1567,
      homeowners: 11234,
      helpers: 445,
      realtors: 298,
      activeProjects: 156,
      avgRating: 4.5,
      featured: false,
      description: "Houston area with rapid growth and significant infrastructure development"
    },
    {
      id: 4,
      name: "Maricopa County",
      state: "Arizona",
      fipsCode: "04013",
      population: 4485414,
      contractors: 1289,
      homeowners: 9876,
      helpers: 378,
      realtors: 234,
      activeProjects: 134,
      avgRating: 4.4,
      featured: false,
      description: "Phoenix metropolitan area with booming construction and housing markets"
    },
    {
      id: 5,
      name: "San Diego County",
      state: "California",
      fipsCode: "06073",
      population: 3298634,
      contractors: 1156,
      homeowners: 8965,
      helpers: 334,
      realtors: 267,
      activeProjects: 112,
      avgRating: 4.8,
      featured: true,
      description: "Coastal California community with premium construction and real estate services"
    },
    {
      id: 6,
      name: "Orange County",
      state: "California",
      fipsCode: "06059",
      population: 3186989,
      contractors: 1087,
      homeowners: 8734,
      helpers: 298,
      realtors: 345,
      activeProjects: 98,
      avgRating: 4.9,
      featured: true,
      description: "Affluent Southern California region with high-end construction projects"
    }
  ];

  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">County Directory</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Explore TradeScout communities across all 3,000+ U.S. counties
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search counties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-navy-700 border-navy-600 text-white"
                />
              </div>
              
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="california">California</SelectItem>
                  <SelectItem value="texas">Texas</SelectItem>
                  <SelectItem value="florida">Florida</SelectItem>
                  <SelectItem value="new-york">New York</SelectItem>
                  <SelectItem value="illinois">Illinois</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">County Name</SelectItem>
                  <SelectItem value="population">Population</SelectItem>
                  <SelectItem value="contractors">Most Contractors</SelectItem>
                  <SelectItem value="activity">Most Active</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>

              <Button className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Advanced Filters
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">{counties.length} counties found</span>
              <Badge className="bg-orange-600 hover:bg-orange-700">
                3,142 Total Counties Available
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Featured Counties */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-8">
          <CardHeader>
            <CardTitle className="text-white">Featured Counties</CardTitle>
            <p className="text-gray-400">High-activity communities with excellent contractor networks</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {counties.filter(county => county.featured).slice(0, 3).map((county) => (
                <div key={county.id} className="bg-navy-700/50 rounded-lg p-4 hover:bg-navy-600/50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-white font-semibold">{county.name}</h3>
                      <p className="text-gray-400 text-sm">{county.state}</p>
                    </div>
                    <Badge className="bg-orange-600 hover:bg-orange-700 text-xs">
                      ★ {county.avgRating}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="text-gray-300">
                      <span className="text-orange-400">{county.contractors}</span> Contractors
                    </div>
                    <div className="text-gray-300">
                      <span className="text-blue-400">{county.homeowners.toLocaleString()}</span> Homeowners
                    </div>
                    <div className="text-gray-300">
                      <span className="text-green-400">{county.helpers}</span> Helpers
                    </div>
                    <div className="text-gray-300">
                      <span className="text-purple-400">{county.realtors}</span> Realtors
                    </div>
                  </div>

                  <Button className="w-full bg-orange-600 hover:bg-orange-700 text-sm">
                    Explore County
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* All Counties List */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">All Counties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {counties.map((county) => (
                <div key={county.id} className="bg-navy-700/50 rounded-lg p-6 hover:bg-navy-600/50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white">{county.name}</h3>
                        {county.featured && (
                          <Badge className="bg-orange-600 hover:bg-orange-700">Featured</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          FIPS: {county.fipsCode}
                        </Badge>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">{county.state} • Population: {county.population.toLocaleString()}</p>
                      <p className="text-gray-300 text-sm">{county.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-yellow-400">★</span>
                          <span className="text-white text-sm">{county.avgRating}</span>
                        </div>
                        <p className="text-gray-400 text-xs">{county.activeProjects} active projects</p>
                      </div>
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-navy-800/50 rounded-lg">
                      <div className="text-orange-400 text-lg font-bold">{county.contractors}</div>
                      <div className="text-gray-400 text-xs">Contractors</div>
                    </div>
                    <div className="text-center p-3 bg-navy-800/50 rounded-lg">
                      <div className="text-blue-400 text-lg font-bold">{county.homeowners.toLocaleString()}</div>
                      <div className="text-gray-400 text-xs">Homeowners</div>
                    </div>
                    <div className="text-center p-3 bg-navy-800/50 rounded-lg">
                      <div className="text-green-400 text-lg font-bold">{county.helpers}</div>
                      <div className="text-gray-400 text-xs">Helpers</div>
                    </div>
                    <div className="text-center p-3 bg-navy-800/50 rounded-lg">
                      <div className="text-purple-400 text-lg font-bold">{county.realtors}</div>
                      <div className="text-gray-400 text-xs">Realtors</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            <div className="text-center mt-8">
              <Button className="bg-orange-600 hover:bg-orange-700 px-8">
                Load More Counties
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Platform Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400 mb-2">3,142</div>
                <div className="text-gray-400">Total Counties</div>
                <div className="text-green-400 text-sm">All 50 states + territories</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">2,847</div>
                <div className="text-gray-400">Active Counties</div>
                <div className="text-green-400 text-sm">91% coverage</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-2">125,847</div>
                <div className="text-gray-400">Total Users</div>
                <div className="text-green-400 text-sm">Across all counties</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">4.7</div>
                <div className="text-gray-400">Avg Rating</div>
                <div className="text-green-400 text-sm">Platform-wide</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default CountyDirectory;