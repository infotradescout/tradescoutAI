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
import { MapPin, Search, Filter, SlidersHorizontal, Calculator } from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { Link } from "wouter";

import type { Contractor, County, Trade } from "@shared/schema";
import { SEOHelmet, createBreadcrumbStructuredData, createServiceStructuredData } from "@/components/SEOHelmet";

export default function ContractorBoard() {
  const [selectedState, setSelectedState] = useState("");
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

  // Get all counties when we have a selected state
  const { data: allCounties } = useQuery<County[]>({
    queryKey: ['/api/counties', selectedState],
    queryFn: async () => {
      if (!selectedState) return [];
      const response = await fetch(`/api/counties?state=${selectedState}`);
      if (!response.ok) throw new Error('Failed to fetch counties');
      return response.json();
    },
    enabled: !!selectedState,
  });

  // Counties come pre-filtered from API
  const counties = allCounties || [];

  // Reset county when state changes
  useEffect(() => {
    if (selectedState && selectedCounty) {
      // Check if current county belongs to new state
      const countyExists = counties.some(county => county.fips === selectedCounty);
      if (!countyExists) {
        setSelectedCounty("");
      }
    }
  }, [selectedState, selectedCounty, counties]);

  // US States list
  const states = [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' }
  ];

  const { data: trades } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
  });

  const { data: mainTrades } = useQuery<Trade[]>({
    queryKey: ['/api/trades', { main: true }],
  });

  // Get total site-wide contractor count
  const { data: allContractors } = useQuery({
    queryKey: ['/api/contractors'],
    queryFn: async () => {
      const response = await fetch('/api/contractors?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch contractors');
      return response.json();
    },
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

  const activeFiltersCount = [selectedState, selectedCounty, selectedTrade].filter(Boolean).length;
  const hasActiveFilters = activeFiltersCount > 0 || searchQuery;
  
  // Show site-wide count if no filters, otherwise show filtered count
  const displayCount = hasActiveFilters ? filteredContractors.length : (allContractors?.length || 0);
  const displayText = hasActiveFilters ? 
    `${filteredContractors.length} contractor${filteredContractors.length !== 1 ? 's' : ''} found` :
    `${allContractors?.length || 0} contractors available nationwide`;

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

  // Generate SEO data based on current filters
  const selectedStateName = selectedState ? states.find(s => s.code === selectedState)?.name : '';
  const selectedCountyName = selectedCounty ? counties.find(c => c.fips === selectedCounty)?.name : '';
  const selectedTradeName = selectedTrade ? trades?.find(t => t.id === selectedTrade)?.name : '';

  const seoTitle = `Find ${selectedTradeName || 'Contractors'}${selectedStateName ? ` in ${selectedStateName}` : ''}${selectedCountyName ? `, ${selectedCountyName}` : ''} | TradeScout`;
  const seoDescription = `Find verified ${selectedTradeName || 'contractors'}${selectedStateName ? ` in ${selectedStateName}` : ''}${selectedCountyName ? `, ${selectedCountyName}` : ''}. Get 3 free quotes, read reviews, and hire with confidence. Licensed and insured contractors for all home improvement projects.`;

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Find Contractors', url: '/contractors/board' }
  ];

  if (selectedStateName) {
    breadcrumbItems.push({ name: selectedStateName, url: `/contractors/board?state=${selectedState}` });
  }
  if (selectedCountyName) {
    breadcrumbItems.push({ name: selectedCountyName, url: `/contractors/board?state=${selectedState}&county=${selectedCounty}` });
  }
  if (selectedTradeName) {
    breadcrumbItems.push({ name: selectedTradeName, url: `/contractors/board?state=${selectedState}&county=${selectedCounty}&trade=${selectedTrade}` });
  }

  const serviceStructuredData = selectedTradeName ? createServiceStructuredData({
    name: `${selectedTradeName} Services`,
    description: `Professional ${selectedTradeName.toLowerCase()} services in ${selectedStateName || 'your area'}`,
    category: selectedTradeName,
    areaServed: selectedStateName || 'United States',
    provider: 'TradeScout'
  }) : null;

  const contractorListStructuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${selectedTradeName || 'Contractors'} in ${selectedStateName || 'United States'}`,
    "description": `Directory of verified ${selectedTradeName?.toLowerCase() || 'contractors'} serving ${selectedStateName || 'the United States'}`,
    "numberOfItems": filteredContractors.length,
    "itemListElement": filteredContractors.slice(0, 10).map((contractor, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "LocalBusiness",
        "name": contractor.companyName,
        "description": contractor.about,
        "url": `${window.location.origin}/contractors/${contractor.id}`,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": selectedCountyName || "Local Area",
          "addressRegion": selectedStateName || "US",
          "addressCountry": "US"
        }
      }
    }))
  };

  const combinedStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      createBreadcrumbStructuredData(breadcrumbItems),
      contractorListStructuredData,
      ...(serviceStructuredData ? [serviceStructuredData] : [])
    ]
  };

  return (
    <>
      <SEOHelmet 
        title={seoTitle}
        description={seoDescription}
        keywords={`${selectedTradeName || 'contractors'}, ${selectedStateName || 'local'} contractors, verified contractors, free quotes, home improvement${selectedTradeName ? `, ${selectedTradeName.toLowerCase()}` : ''}`}
        structuredData={combinedStructuredData}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-gray-400">
            {breadcrumbItems.map((item, index) => (
              <li key={item.url} className="flex items-center">
                {index > 0 && <span className="mx-2 text-gray-500">/</span>}
                {index === breadcrumbItems.length - 1 ? (
                  <span className="text-orange-500 font-medium">{item.name}</span>
                ) : (
                  <Link href={item.url}>
                    <span className="hover:text-white transition-colors cursor-pointer">{item.name}</span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6" data-testid="page-title">
            {selectedTradeName ? `Find ${selectedTradeName} Contractors` : 'Find Contractors'}
            {selectedStateName && (
              <span className="block text-3xl md:text-4xl text-orange-500 mt-2">
                in {selectedStateName}
              </span>
            )}
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Connect with verified, local contractors for your next project
          </p>
          
          {/* Contractor CTA - Facebook Signup */}
          <div className="mb-8 space-y-4">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 max-w-md mx-auto border border-blue-500/30">
              <h3 className="text-white font-semibold text-lg mb-2">Join as a Contractor</h3>
              <p className="text-blue-100 text-sm mb-4">Get recommendations and grow your business</p>
              <div className="space-y-3">
                <Button 
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white border border-blue-400"
                  onClick={() => window.location.href = '/api/auth/facebook'}
                  data-testid="button-contractor-facebook-signup"
                >
                  <SiFacebook className="mr-2 h-4 w-4" />
                  Quick Signup with Facebook
                </Button>
                <Link href="/contractors/signup">
                  <Button variant="outline" className="w-full text-blue-700 border-blue-300 hover:bg-blue-50">
                    Sign up with Email
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          
          {/* Pre-launch notice & Tours */}
          <div className="mb-8 text-center space-y-4">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-blue-300 text-sm">
                🚧 TradeScout is launching soon! Explore contractors and get quotes while we finish building additional features.
              </p>
            </div>
            

          </div>
        </header>

        {/* State, County and Trade Quick Filters */}
        <div className="max-w-4xl mx-auto mb-8" data-testid="contractor-search">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Select Your State
              </label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white" data-testid="location-filter">
                  <SelectValue placeholder="Choose your state..." />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                  {states.map((state) => (
                    <SelectItem 
                      key={state.code} 
                      value={state.code}
                      className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                    >
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Select Your County
              </label>
              <Select value={selectedCounty} onValueChange={setSelectedCounty} disabled={!selectedState}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white disabled:opacity-50">
                  <SelectValue placeholder={selectedState ? "Choose your county..." : "Select state first"} />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                  {counties.map((county) => (
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
                Service Needed
              </label>
              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white" data-testid="trade-filter">
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
            {selectedState && (
              <Badge variant="secondary" className="bg-navy-600 text-white">
                {states.find(s => s.code === selectedState)?.name}
                <button
                  onClick={() => setSelectedState("")}
                  className="ml-1 hover:text-red-400"
                >
                  ×
                </button>
              </Badge>
            )}

            {selectedCounty && (
              <Badge variant="secondary" className="bg-navy-600 text-white">
                {counties.find(c => c.fips === selectedCounty)?.name}
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-navy-700 border-navy-600 text-white" data-testid="contractor-sorting">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent className="bg-navy-700 border-navy-600 text-white">
                <SelectItem value="recommended" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Most Recommended</SelectItem>
                <SelectItem value="positive" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Highest Positive Score</SelectItem>
                <SelectItem value="total" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Most Recommendations</SelectItem>
                <SelectItem value="newest" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Newest</SelectItem>
              </SelectContent>
            </Select>
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
                    State
                  </label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                      <SelectValue placeholder="All states" />
                    </SelectTrigger>
                    <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                      <SelectItem value="" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">All states</SelectItem>
                      {states.map((state) => (
                        <SelectItem 
                          key={state.code} 
                          value={state.code}
                          className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                        >
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    County
                  </label>
                  <Select value={selectedCounty} onValueChange={setSelectedCounty} disabled={!selectedState}>
                    <SelectTrigger className="bg-navy-600 border-navy-500 text-white disabled:opacity-50">
                      <SelectValue placeholder={selectedState ? "All counties" : "Select state first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                      <SelectItem value="" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">All counties</SelectItem>
                      {counties.map((county) => (
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
                      <SelectItem value="">All trades</SelectItem>
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
                      <SelectItem value="recommended" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Most Recommended</SelectItem>
                      <SelectItem value="positive" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Highest Positive Score</SelectItem>
                      <SelectItem value="total" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Most Recommendations</SelectItem>
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
      <div className="mb-6">
        <p className="text-gray-300 text-center">
          {isLoading ? 'Loading contractors...' : 
           contractors ? `Found ${contractors.length} contractors` : 
           'No contractors loaded'}
        </p>
      </div>
      
      {filteredContractors && filteredContractors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContractors.map((contractor: Contractor) => (
            <ContractorCard key={contractor.id} contractor={contractor} />
          ))}
        </div>
      ) : contractors && contractors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contractors.map((contractor: Contractor) => (
            <ContractorCard key={contractor.id} contractor={contractor} />
          ))}
        </div>
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
      
      {/* Quote Calculator CTA */}
      <Card className="bg-gradient-to-r from-orange-600 to-orange-700 border-orange-500 mt-12">
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white/20 rounded-full p-3">
              <Calculator className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Get Instant Project Estimates
              </h3>
              <p className="text-orange-100 max-w-2xl mx-auto">
                Not sure about project costs? Use our smart calculator to get accurate estimates for your home improvement projects. 
                Get connected with the top 3 contractors in your area automatically.
              </p>
            </div>
            <Link href="/calculator">
              <Button 
                size="lg" 
                className="bg-white text-orange-600 hover:bg-orange-50 font-semibold px-8 py-3 text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Calculator className="mr-2 h-5 w-5" />
                Calculate Project Cost
              </Button>
            </Link>
            <div className="flex items-center space-x-6 text-orange-100 text-sm">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-orange-200 rounded-full mr-2"></span>
                Instant estimates
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-orange-200 rounded-full mr-2"></span>
                Regional pricing
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-orange-200 rounded-full mr-2"></span>
                Material breakdown
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </main>
    </>
  );
}