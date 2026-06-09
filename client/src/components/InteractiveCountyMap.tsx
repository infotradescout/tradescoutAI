import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Map,
  Users,
  ShieldCheck,
  Facebook,
  MapPin,
  TrendingUp,
  Award,
  ExternalLink,
  Clock,
  MessageSquare,
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
};

interface InteractiveCountyMapProps {
  className?: string;
  showTitle?: boolean;
  variant?: "homeowner" | "contractor" | "general";
}

export function InteractiveCountyMap({
  className = "",
  showTitle = true,
  variant = "general",
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

  const { data: countyContractors = [], isLoading: loadingContractors } = useQuery<
    CountyContractor[]
  >({
    queryKey: ["/api/contractors/county", selectedCounty?.state, selectedCounty?.county],
    queryFn: async () => {
      if (!selectedCounty) return [];
      const response = await apiRequest(
        "GET",
        `/api/contractors/by-county?state=${selectedCounty.state}&county=${selectedCounty.county}`
      );
      return response as CountyContractor[];
    },
    enabled: !!selectedCounty,
    retry: false,
  });

  // Group data by state for better organization
  const stateData = useMemo(() => {
    if (!Array.isArray(heatmapData)) return {};

    const grouped = heatmapData.reduce(
      (acc: Record<string, HeatmapDataPoint[]>, county: HeatmapDataPoint) => {
        if (!acc[county.state]) acc[county.state] = [];
        acc[county.state].push(county);
        return acc;
      },
      {}
    );

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
        totalInteractions: counties.reduce(
          (sum: number, county: HeatmapDataPoint) => sum + county.interactions,
          0
        ),
        totalContractors: counties.reduce(
          (sum: number, county: HeatmapDataPoint) => sum + county.contractors,
          0
        ),
        counties: counties.slice(0, 10), // Top 10 counties per state
      }))
      .sort((a, b) => b.totalInteractions - a.totalInteractions)
      .slice(0, 15); // Top 15 states
  }, [stateData]);

  const getIntensityColor = (interactions: number, maxInteractions: number) => {
    const intensity = maxInteractions > 0 ? interactions / maxInteractions : 0;
    if (intensity > 0.8) return "bg-red-500 hover:bg-red-400";
    if (intensity > 0.6) return "bg-ts-orange hover:bg-ts-orange";
    if (intensity > 0.4) return "bg-yellow-500 hover:bg-yellow-400";
    if (intensity > 0.2) return "bg-blue-500 hover:bg-blue-400";
    return "bg-white/10 hover:bg-white/10";
  };

  const generateFacebookGroupUrl = (state: string, county: string) => {
    const searchQuery = `TradeScout ${county} ${state} contractors homeowners`;
    return `https://www.facebook.com/search/groups/?q=${encodeURIComponent(searchQuery)}`;
  };

  const maxInteractions =
    Array.isArray(heatmapData) && heatmapData.length > 0
      ? Math.max(...heatmapData.map((p: HeatmapDataPoint) => p.interactions))
      : 0;

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-white/10 rounded"></div>
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
              <Map className="w-6 h-6 text-ts-orange" />
              Interactive County Explorer
            </h2>
            <p className="text-white/60 mt-1">
              {variant === "homeowner" && "Find contractors and join local homeowner communities"}
              {variant === "contractor" && "Explore business opportunities and contractor networks"}
              {variant === "general" && "Discover active communities across the United States"}
            </p>
          </div>

          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white/5 border-white/10">
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
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent className="bg-white/5 border-white/10 max-h-64">
            <SelectItem value="">All States</SelectItem>
            {topStates.map(({ state }) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedState && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedState("")}
            className="border-white/15 text-white/70"
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* Interactive Map Grid */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/10">
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
              .filter((stateInfo) => !selectedState || stateInfo.state === selectedState)
              .flatMap((stateInfo) => stateInfo.counties)
              .slice(0, 30)
              .map((county) => (
                <Dialog key={`${county.state}-${county.county}`}>
                  <DialogTrigger asChild>
                    <button
                      className={`p-4 rounded-lg border border-white/15 transition-all duration-200 text-left hover:border-ts-orange/30 hover:shadow-lg ${getIntensityColor(county.interactions, maxInteractions)}`}
                      onClick={() => setSelectedCounty(county)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-white text-sm">{county.county}</h4>
                          <p className="text-xs text-white/70 opacity-90">{county.state}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{county.interactions}</p>
                          <p className="text-xs text-white/70 opacity-90">interactions</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs bg-black/20 border-white/10 text-white/70"
                        >
                          👷 {county.contractors}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs bg-black/20 border-white/10 text-white/70"
                        >
                          🏠 {county.homeowners}
                        </Badge>
                      </div>
                    </button>
                  </DialogTrigger>

                  <DialogContent className="bg-tsCard border-white/10 text-white max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-ts-orange" />
                        {county.county}, {county.state}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                      {/* County Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/5 p-4 rounded-lg">
                          <p className="text-sm text-white/60">Total Activity</p>
                          <p className="text-2xl font-bold text-ts-orange">{county.interactions}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg">
                          <p className="text-sm text-white/60">Contractors</p>
                          <p className="text-2xl font-bold text-blue-400">{county.contractors}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg">
                          <p className="text-sm text-white/60">Homeowners</p>
                          <p className="text-2xl font-bold text-green-400">{county.homeowners}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg">
                          <p className="text-sm text-white/60">Total Users</p>
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
                                Connect with other{" "}
                                {variant === "contractor" ? "contractors" : "homeowners"} in{" "}
                                {county.county}, {county.state}. Share experiences, get referrals,
                                and build your local network.
                              </p>
                              <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() =>
                                  window.open(
                                    "/community?state=" + county.state + "&county=" + county.county,
                                    "_blank"
                                  )
                                }
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
                      {variant !== "contractor" && (
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Award className="w-5 h-5 text-ts-orange" />
                            Top Contractors in {county.county}
                          </h3>

                          {loadingContractors ? (
                            <div className="space-y-3">
                              {[1, 2, 3].map((i) => (
                                <div
                                  key={i}
                                  className="h-20 bg-white/10 rounded animate-pulse"
                                ></div>
                              ))}
                            </div>
                          ) : Array.isArray(countyContractors) && countyContractors.length > 0 ? (
                            <div className="space-y-4 max-h-64 overflow-y-auto">
                              {Array.isArray(countyContractors) &&
                                countyContractors
                                  .slice(0, 5)
                                  .map((contractor: CountyContractor) => (
                                    <Card
                                      key={contractor.id}
                                      className="bg-white/5 border-white/15"
                                    >
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
                                              <span className="inline-flex items-center gap-2 text-white/60 text-sm">
                                                <ShieldCheck className="w-4 h-4 text-ts-orange" />
                                                <span>CVS pending</span>
                                                <span className="text-white/40">•</span>
                                                <span>
                                                  {contractor.recommendationCount} recommendations
                                                </span>
                                              </span>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="flex items-center text-white/60 text-sm">
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
                                              className="text-xs border-ts-orange/30 text-ts-orange"
                                            >
                                              {specialty}
                                            </Badge>
                                          ))}
                                        </div>

                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/15 text-white/70"
                                            onClick={() => {
                                              window.location.href = `/direct-connect?intent=hire&contractorId=${encodeURIComponent(
                                                contractor.id
                                              )}`;
                                            }}
                                          >
                                            <MessageSquare className="w-4 h-4 mr-1" />
                                            Start a Request
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-white/60">
                              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>No contractor data available for this county yet.</p>
                              <p className="text-sm mt-2">
                                Check back soon as we expand our network!
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Business Opportunities for Contractors */}
                      {variant === "contractor" && (
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
                                  <li>
                                    •{" "}
                                    {county.contractors < 10
                                      ? "Low"
                                      : county.contractors < 25
                                        ? "Medium"
                                        : "High"}{" "}
                                    competition
                                  </li>
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
            <div className="text-center py-12 text-white/60">
              <Map className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No activity data available</p>
              <p className="text-sm">
                Activity data will appear as users interact with the platform
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
