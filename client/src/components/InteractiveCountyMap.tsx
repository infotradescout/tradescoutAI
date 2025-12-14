import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Map, 
  Users, 
  Star, 
  Facebook, 
  MapPin, 
  TrendingUp, 
  Award,
  ExternalLink,
  Phone,
  Mail,
  Clock
} from "lucide-react";

type HeatmapDataPoint = {
  state: string;
  county: string;
  interactions: number;
  users: number;
  contractors: number;
  homeowners: number;
  latitude: number;
  longitude: number;
};

type CountyContractor = {
  id: string;
  businessName: string;
  rating: number;
  recommendationCount: number;
  specialties: string[];
  isVerified: boolean;
  yearsInBusiness: number;
  phone?: string;
  email?: string;
};

interface InteractiveCountyMapProps {
  className?: string;
  showTitle?: boolean;
  variant?: 'homeowner' | 'contractor' | 'general';
}

export function InteractiveCountyMap({ 
  className = "", 
  showTitle = true, 
  variant = 'general' 
}: InteractiveCountyMapProps) {
  const [timeframe, setTimeframe] = useState<string>("30d");
  const [selectedCounty, setSelectedCounty] = useState<HeatmapDataPoint | null>(null);
  const [selectedState, setSelectedState] = useState<string>("");

  const { data: heatmapData = [], isLoading } = useQuery<HeatmapDataPoint[]>({
    queryKey: ["/api/heatmap", timeframe],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/heatmap?timeframe=${timeframe}`);
      return response as HeatmapDataPoint[];
    },
    retry: false,
  });

  const { data: countyContractors = [], isLoading: loadingContractors } = useQuery<CountyContractor[]>({
    queryKey: ["/api/contractors/county", selectedCounty?.state, selectedCounty?.county],
    queryFn: async () => {
      if (!selectedCounty) return [];
      const response = await apiRequest("GET", `/api/contractors/by-county?state=${selectedCounty.state}&county=${selectedCounty.county}`);
      return response as CountyContractor[];
    },
    enabled: !!selectedCounty,
    retry: false,
  });

  // Group data by state for better organization
  const stateData = useMemo(() => {
    if (!Array.isArray(heatmapData)) return {};
    
    const grouped = heatmapData.reduce((acc: Record<string, HeatmapDataPoint[]>, county: HeatmapDataPoint) => {
      if (!acc[county.state]) acc[county.state] = [];
      acc[county.state].push(county);
      return acc;
    }, {});
    
    // Sort counties by activity within each state
    Object.values(grouped).forEach((counties: HeatmapDataPoint[]) => {
      counties.sort((a: HeatmapDataPoint, b: HeatmapDataPoint) => b.interactions - a.interactions);
    });
    
    return grouped;
  }, [heatmapData]);

  const topStates = useMemo(() => {
    return Object.entries(stateData)
      .map(([state, counties]: [string, HeatmapDataPoint[]]) => ({
        state,
        totalInteractions: counties.reduce((sum: number, county: HeatmapDataPoint) => sum + county.interactions, 0),
        totalContractors: counties.reduce((sum: number, county: HeatmapDataPoint) => sum + county.contractors, 0),
        counties: counties.slice(0, 10) // Top 10 counties per state
      }))
      .sort((a, b) => b.totalInteractions - a.totalInteractions)
      .slice(0, 15); // Top 15 states
  }, [stateData]);

  const getIntensityColor = (interactions: number, maxInteractions: number) => {
    const intensity = maxInteractions > 0 ? interactions / maxInteractions : 0;
    if (intensity > 0.8) return "bg-red-500 hover:bg-red-400";
    if (intensity > 0.6) return "bg-orange-500 hover:bg-orange-400";
    if (intensity > 0.4) return "bg-yellow-500 hover:bg-yellow-400";
    if (intensity > 0.2) return "bg-blue-500 hover:bg-blue-400";
    return "bg-slate-600 hover:bg-slate-500";
  };

  const generateFacebookGroupUrl = (state: string, county: string) => {
    const searchQuery = `TradeScout ${county} ${state} contractors homeowners`;
    return `https://www.facebook.com/search/groups/?q=${encodeURIComponent(searchQuery)}`;
  };

  const maxInteractions = Array.isArray(heatmapData) && heatmapData.length > 0 
    ? Math.max(...heatmapData.map((p: HeatmapDataPoint) => p.interactions))
    : 0;

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {showTitle && (
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Map className="w-6 h-6 text-orange-500" />
              Interactive County Explorer
            </h2>
            <p className="text-gray-400 mt-1">
              {variant === 'homeowner' && "Find contractors and join local homeowner communities"}
              {variant === 'contractor' && "Explore business opportunities and contractor networks"}
              {variant === 'general' && "Discover active communities across the United States"}
            </p>
          </div>
          
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* State Filter */}
      <div className="flex gap-4 items-center">
        <Select value={selectedState} onValueChange={setSelectedState}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 max-h-64">
            <SelectItem value="">All States</SelectItem>
            {topStates.map(({ state }) => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedState && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedState("")}
            className="border-slate-600 text-slate-300"
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* Interactive Map Grid */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Most Active Counties
            <Badge variant="outline" className="ml-2 text-xs">
              Click to explore
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {topStates
              .filter(stateInfo => !selectedState || stateInfo.state === selectedState)
              .flatMap(stateInfo => stateInfo.counties)
              .slice(0, 30)
              .map((county) => (
                <Dialog key={`${county.state}-${county.county}`}>
                  <DialogTrigger asChild>
                    <button
                      className={`p-4 rounded-lg border border-slate-600/50 transition-all duration-200 text-left hover:border-orange-500/50 hover:shadow-lg ${getIntensityColor(county.interactions, maxInteractions)}`}
                      onClick={() => setSelectedCounty(county)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-white text-sm">
                            {county.county}
                          </h4>
                          <p className="text-xs text-gray-200 opacity-90">
                            {county.state}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">
                            {county.interactions}
                          </p>
                          <p className="text-xs text-gray-200 opacity-90">
                            interactions
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs bg-black/20 border-gray-300 text-gray-200">
                          👷 {county.contractors}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-black/20 border-gray-300 text-gray-200">
                          🏠 {county.homeowners}
                        </Badge>
                      </div>
                    </button>
                  </DialogTrigger>
                  
                  <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-orange-500" />
                        {county.county}, {county.state}
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      {/* County Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg">
                          <p className="text-sm text-gray-400">Total Activity</p>
                          <p className="text-2xl font-bold text-orange-400">{county.interactions}</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg">
                          <p className="text-sm text-gray-400">Contractors</p>
                          <p className="text-2xl font-bold text-blue-400">{county.contractors}</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg">
                          <p className="text-sm text-gray-400">Homeowners</p>
                          <p className="text-2xl font-bold text-green-400">{county.homeowners}</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg">
                          <p className="text-sm text-gray-400">Total Users</p>
                          <p className="text-2xl font-bold text-purple-400">{county.users}</p>
                        </div>
                      </div>

                      {/* TradeScout Community Groups CTA */}
                      <Card className="bg-gradient-to-r from-blue-600/20 to-blue-700/20 border-blue-500/30">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                              <Facebook className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white mb-2">
                                Join Your Local TradeScout Community
                              </h3>
                              <p className="text-blue-100 text-sm mb-4">
                                Connect with other {variant === 'contractor' ? 'contractors' : 'homeowners'} in {county.county}, {county.state}. 
                                Share experiences, get referrals, and build your local network.
                              </p>
                              <Button 
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => window.open('/community?state=' + county.state + '&county=' + county.county, '_blank')}
                              >
                                <Facebook className="w-4 h-4 mr-2" />
                                Open TradeScout Community
                                <ExternalLink className="w-4 h-4 ml-2" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Top Contractors */}
                      {variant !== 'contractor' && (
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Award className="w-5 h-5 text-orange-500" />
                            Top Contractors in {county.county}
                          </h3>
                          
                          {loadingContractors ? (
                            <div className="space-y-3">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 bg-slate-700 rounded animate-pulse"></div>
                              ))}
                            </div>
                          ) : Array.isArray(countyContractors) && countyContractors.length > 0 ? (
                            <div className="space-y-4 max-h-64 overflow-y-auto">
                              {Array.isArray(countyContractors) && countyContractors.slice(0, 5).map((contractor: CountyContractor) => (
                                <Card key={contractor.id} className="bg-slate-800 border-slate-600">
                                  <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                      <div>
                                        <h4 className="font-semibold text-white flex items-center gap-2">
                                          {contractor.businessName}
                                          {contractor.isVerified && (
                                            <Badge className="bg-green-600 text-white text-xs">
                                              Verified
                                            </Badge>
                                          )}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                          <div className="flex text-yellow-400">
                                            {[...Array(5)].map((_, i) => (
                                              <Star 
                                                key={i} 
                                                className={`w-4 h-4 ${i < contractor.rating ? 'fill-current' : ''}`} 
                                              />
                                            ))}
                                          </div>
                                          <span className="text-gray-400 text-sm">
                                            ({contractor.recommendationCount} RECOMMENDATIONS)
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="flex items-center text-gray-400 text-sm">
                                          <Clock className="w-4 h-4 mr-1" />
                                          {contractor.yearsInBusiness}+ years
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-1 mb-3">
                                      {contractor.specialties.slice(0, 3).map((specialty) => (
                                        <Badge 
                                          key={specialty} 
                                          variant="outline" 
                                          className="text-xs border-orange-500/30 text-orange-300"
                                        >
                                          {specialty}
                                        </Badge>
                                      ))}
                                    </div>
                                    
                                    <div className="flex gap-2">
                                      {contractor.phone && (
                                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                                          <Phone className="w-4 h-4 mr-1" />
                                          Call
                                        </Button>
                                      )}
                                      {contractor.email && (
                                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                                          <Mail className="w-4 h-4 mr-1" />
                                          Email
                                        </Button>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-400">
                              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>No contractor data available for this county yet.</p>
                              <p className="text-sm mt-2">Check back soon as we expand our network!</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Business Opportunities for Contractors */}
                      {variant === 'contractor' && (
                        <Card className="bg-gradient-to-r from-green-600/20 to-green-700/20 border-green-500/30">
                          <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                              <TrendingUp className="w-5 h-5 text-green-500" />
                              Business Opportunities
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-green-100 mb-2">Market Activity:</p>
                                <ul className="space-y-1 text-green-200">
                                  <li>• {county.homeowners} active homeowners</li>
                                  <li>• {county.interactions} recent interactions</li>
                                  <li>• Growing demand for services</li>
                                </ul>
                              </div>
                              <div>
                                <p className="text-green-100 mb-2">Competition Level:</p>
                                <ul className="space-y-1 text-green-200">
                                  <li>• {county.contractors} registered contractors</li>
                                  <li>• {county.contractors < 10 ? 'Low' : county.contractors < 25 ? 'Medium' : 'High'} competition</li>
                                  <li>• Good growth potential</li>
                                </ul>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
          </div>
          
          {(!Array.isArray(heatmapData) || heatmapData.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              <Map className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No activity data available</p>
              <p className="text-sm">Activity data will appear as users interact with the platform</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}