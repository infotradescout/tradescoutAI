import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ContractorCard from "@/components/contractor-card";
import { MapPin } from "lucide-react";
import type { Contractor, County, Trade } from "@shared/schema";

export default function ContractorBoard() {
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");
  const [sortBy, setSortBy] = useState("recommended");

  const { data: contractors, isLoading, error } = useQuery<Contractor[]>({
    queryKey: ['/api/contractors', { county: selectedCounty, trade: selectedTrade, sort: sortBy }],
    enabled: true,
  });

  const { data: counties } = useQuery<County[]>({
    queryKey: ['/api/counties', { state: 'CA' }],
  });

  const { data: trades } = useQuery<Trade[]>({
    queryKey: ['/api/trades'],
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
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
      {/* Header with Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {selectedCounty ? `${selectedCounty} County ` : ''}Contractors
          </h1>
          <p className="text-gray-300 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {contractors?.length || 0} verified contractors
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 mt-4 lg:mt-0">
          <Select value={selectedCounty} onValueChange={setSelectedCounty}>
            <SelectTrigger className="w-48 bg-navy-700 border-navy-600 text-white">
              <SelectValue placeholder="All Counties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Counties</SelectItem>
              {counties?.map((county: any) => (
                <SelectItem key={county.id} value={county.fips}>
                  {county.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedTrade} onValueChange={setSelectedTrade}>
            <SelectTrigger className="w-48 bg-navy-700 border-navy-600 text-white">
              <SelectValue placeholder="All Trades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Trades</SelectItem>
              {trades?.map((trade: any) => (
                <SelectItem key={trade.id} value={trade.slug}>
                  {trade.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 bg-navy-700 border-navy-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Most Recommended</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="years">Most Experienced</SelectItem>
              <SelectItem value="verified">Recently Verified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contractor Grid */}
      {contractors && contractors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contractors.map((contractor: Contractor) => (
            <ContractorCard key={contractor.id} contractor={contractor} />
          ))}
        </div>
      ) : (
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No contractors found</h3>
            <p className="text-gray-400 mb-6">
              Try adjusting your filters or expanding your search area.
            </p>
            <Button 
              onClick={() => {
                setSelectedCounty("");
                setSelectedTrade("");
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Load More */}
      {contractors && contractors.length >= 20 && (
        <div className="text-center mt-12">
          <Button 
            variant="outline" 
            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
          >
            Load More Contractors
          </Button>
        </div>
      )}
    </div>
  );
}
