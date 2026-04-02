import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Map, Users, TrendingUp, MapPin, Zap, Activity } from "lucide-react";

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

interface PublicHeatmapProps {
  compact?: boolean;
  showTitle?: boolean;
  className?: string;
}

export function PublicHeatmap({ compact = false, showTitle = true, className = "" }: PublicHeatmapProps) {
  const [timeframe, setTimeframe] = useState<string>("30d");

  const { data: heatmapData = [], isLoading } = useQuery({
    queryKey: ["/api/heatmap", timeframe],
    queryFn: () => apiRequest("GET", `/api/heatmap?timeframe=${timeframe}`),
    retry: false,
  });

  const totalInteractions = heatmapData.reduce((sum: number, point: HeatmapDataPoint) => sum + point.interactions, 0);
  const totalUsers = heatmapData.reduce((sum: number, point: HeatmapDataPoint) => sum + point.users, 0);
  const totalContractors = heatmapData.reduce((sum: number, point: HeatmapDataPoint) => sum + point.contractors, 0);
  const topLocations = [...heatmapData].sort((a: HeatmapDataPoint, b: HeatmapDataPoint) => b.interactions - a.interactions).slice(0, compact ? 3 : 5);

  const getIntensityClass = (interactions: number) => {
    const maxInteractions = Math.max(...heatmapData.map((p: HeatmapDataPoint) => p.interactions));
    const intensity = interactions / maxInteractions;
    
    if (intensity > 0.8) return "bg-red-500 text-white";
    if (intensity > 0.6) return "bg-ts-orange text-white";
    if (intensity > 0.4) return "bg-yellow-500 text-black";
    if (intensity > 0.2) return "bg-blue-400 text-white";
    return "bg-white/10 text-white/70";
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/10 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-white/10 rounded"></div>
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
              <Activity className="w-6 h-6 text-ts-orange" />
              TradeScout Activity Map
            </h2>
            <p className="text-white/60 mt-1">Real-time activity across the United States</p>
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

      {/* Promotional Stats */}
      <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-4'} gap-4`}>
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Total Activity</p>
                <p className="text-2xl font-bold text-white">{totalInteractions.toLocaleString()}</p>
              </div>
              <Zap className="w-8 h-8 text-ts-orange" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Active Users</p>
                <p className="text-2xl font-bold text-white">{totalUsers.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {!compact && (
          <>
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Contractors</p>
                    <p className="text-2xl font-bold text-white">{totalContractors.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Active Areas</p>
                    <p className="text-2xl font-bold text-white">{heatmapData.length}</p>
                  </div>
                  <MapPin className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Top Locations with Activity Visualization */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Map className="w-5 h-5" />
            Most Active Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topLocations.map((location: HeatmapDataPoint, index: number) => (
              <div key={`${location.state}-${location.county}`} 
                   className="flex items-center justify-between p-4 bg-white/10 rounded-lg border border-white/15 hover:border-ts-orange/30 transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">
                      {location.county}, {location.state}
                    </h4>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-white/5 border-white/15 text-white/70">
                        👷 {location.contractors}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-white/5 border-white/15 text-white/70">
                        🏠 {location.homeowners}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-ts-orange">
                    {location.interactions}
                  </p>
                  <p className="text-xs text-white/60">interactions</p>
                </div>
              </div>
            ))}
          </div>
          
          {topLocations.length === 0 && (
            <div className="text-center py-8 text-white/60">
              <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Activity data loading...</p>
            </div>
          )}
          
          {!compact && (
            <div className="mt-6 pt-4 border-t border-white/15">
              <p className="text-sm text-white/60 text-center">
                TradeScout connects contractors and homeowners across all 50 states and 3,112+ counties
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}