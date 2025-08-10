import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import ContractorCard from "@/components/contractor-card";
import ContractorCardSkeleton from "@/components/contractor-card-skeleton";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { GuestGate } from "@/components/guest-gate";
import { MapPin, Search, Filter, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";
import type { Contractor, County, Trade } from "@shared/schema";

export default function ContractorBoard() {
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");
  const [sortBy, setSortBy] = useState("recommended");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: contractors, isLoading, error } = useQuery<Contractor[]>({
    queryKey: ['/api/contractors', selectedCounty, selectedTrade, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCounty) params.append('county', selectedCounty);
      if (selectedTrade) params.append('trade', selectedTrade);
      if (sortBy) params.append('sort', sortBy);
      
      const response = await fetch(`/api/contractors?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch contractors');
      return response.json();
    },
    enabled: true,
  });

  const { data: counties } = useQuery<County[]>({
    queryKey: ['/api/counties?state=CA'],
  });

  const { data: trades } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
  });

  const { data: mainTrades } = useQuery<Trade[]>({
    queryKey: ['/api/trades', { main: true }],
  });

  // Filter contractors based on search query
  const filteredContractors = useMemo(() => {
    if (!contractors) return [];
    
    return contractors.filter(contractor => {
      const matchesSearch = !searchQuery || 
        contractor.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contractor.about?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [contractors, searchQuery]);

  const activeFiltersCount = [selectedCounty, selectedTrade].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="h-8 bg-navy-600/50 rounded-md animate-pulse mb-4 max-w-md" />
          <div className="h-4 bg-navy-600/50 rounded-md animate-pulse max-w-lg" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <ContractorCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">Failed to load contractors. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Find Contractors
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Connect with verified, local contractors for your next project
        </p>
        
        {/* County and Trade Quick Filters */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Select Your County
              </label>
              <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Choose your county..." />
                </SelectTrigger>
                <SelectContent>
                  {counties?.map((county) => (
                    <SelectItem key={county.id} value={county.id}>
                      {county.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Service Needed
              </label>
              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="What service do you need?" />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                  {trades?.map((trade) => (
                    <SelectItem 
                      key={trade.id} 
                      value={trade.id}
                      className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                    >
                      {trade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search contractors, companies, or services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-navy-700 border-navy-600 text-white placeholder-gray-400"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="border-navy-600 text-gray-300 hover:bg-navy-600"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 bg-orange-500 text-white">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* Active Filter Pills */}
            {selectedCounty && (
              <Badge variant="secondary" className="bg-navy-600 text-white">
                {counties?.find(c => c.id === selectedCounty)?.name}
                <button
                  onClick={() => setSelectedCounty("")}
                  className="ml-1 hover:text-red-400"
                >
                  ×
                </button>
              </Badge>
            )}

            {selectedTrade && (
              <Badge variant="secondary" className="bg-navy-600 text-white">
                {trades?.find(t => t.id === selectedTrade)?.name}
                <button
                  onClick={() => setSelectedTrade("")}
                  className="ml-1 hover:text-red-400"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-400">
              {filteredContractors.length} contractor{filteredContractors.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>

        {/* Expanded Filter Options */}
        {showFilters && (
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    County
                  </label>
                  <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                    <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                      <SelectValue placeholder="All counties" />
                    </SelectTrigger>
                    <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                      <SelectItem value="" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">All counties</SelectItem>
                      {counties?.map((county) => (
                        <SelectItem 
                          key={county.fips} 
                          value={county.fips}
                          className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                        >
                          {county.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Trade
                  </label>
                  <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                    <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                      <SelectValue placeholder="All trades" />
                    </SelectTrigger>
                    <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                      <SelectItem value="" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">All trades</SelectItem>
                      {mainTrades?.map((trade) => (
                        <SelectItem 
                          key={trade.id} 
                          value={trade.id}
                          className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                        >
                          {trade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sort by
                  </label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                      <SelectItem value="recommended" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Recommended</SelectItem>
                      <SelectItem value="rating" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Highest Rated</SelectItem>
                      <SelectItem value="reviews" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Most Reviews</SelectItem>
                      <SelectItem value="newest" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Newest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results */}
      {filteredContractors && filteredContractors.length > 0 ? (
        <GuestGate
          action="contact contractors"
          title="Create Account to Contact Contractors"
          description="Connect directly with verified contractors, request quotes, and save your favorite professionals."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContractors.map((contractor: Contractor) => (
              <ContractorCard key={contractor.id} contractor={contractor} />
            ))}
          </div>
        </GuestGate>
      ) : (
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery || selectedCounty || selectedTrade ? 'No contractors found' : 'No contractors available'}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchQuery || selectedCounty || selectedTrade 
                ? 'Try adjusting your search criteria or filters'
                : 'Check back later for new contractor listings'
              }
            </p>
            {(searchQuery || selectedCounty || selectedTrade) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCounty("");
                  setSelectedTrade("");
                }}
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}