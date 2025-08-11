import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Map, Users, TrendingUp, MapPin } from "lucide-react";

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

export function UserHeatmap() {
  const [timeframe, setTimeframe] = useState<string>("30d");

  const { data: heatmapData = [], isLoading } = useQuery({
    queryKey: ["/api/admin/heatmap", timeframe],
    queryFn: () => apiRequest("GET", `/api/admin/heatmap?timeframe=${timeframe}`),
    retry: false,
  });

  const totalInteractions = heatmapData.reduce((sum: number, point: HeatmapDataPoint) => sum + point.interactions, 0);
  const totalUsers = heatmapData.reduce((sum: number, point: HeatmapDataPoint) => sum + point.users, 0);
  const topLocations = [...heatmapData].sort((a: HeatmapDataPoint, b: HeatmapDataPoint) => b.interactions - a.interactions).slice(0, 5);

  const getIntensityClass = (interactions: number) => {
    const maxInteractions = Math.max(...heatmapData.map((p: HeatmapDataPoint) => p.interactions));
    const intensity = interactions / maxInteractions;
    
    if (intensity > 0.8) return "bg-red-500 text-white";
    if (intensity > 0.6) return "bg-orange-500 text-white";
    if (intensity > 0.4) return "bg-yellow-500 text-black";
    if (intensity > 0.2) return "bg-blue-400 text-white";
    return "bg-slate-600 text-gray-300";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Map className="w-6 h-6 text-orange-500" />
            User Activity Heatmap
          </h2>
          <p className="text-gray-400 mt-1">Geographic distribution of user interactions across the United States</p>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Interactions</p>
                <p className="text-2xl font-bold text-white">{totalInteractions.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-white">{totalUsers.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Locations</p>
                <p className="text-2xl font-bold text-white">{heatmapData.length}</p>
              </div>
              <MapPin className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="skeleton-enhanced h-96 rounded-lg" />
          <div className="skeleton-enhanced h-64 rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Heatmap Visualization */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Map className="w-5 h-5" />
                Activity Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {heatmapData.map((point: HeatmapDataPoint) => (
                  <div
                    key={`${point.state}-${point.county}`}
                    className={`p-3 rounded-lg border transition-all hover:scale-105 ${getIntensityClass(point.interactions)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">
                          {point.county}, {point.state}
                        </h4>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {point.interactions} interactions
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {point.users} users
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>👷 {point.contractors}</div>
                        <div>🏠 {point.homeowners}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-slate-600">
                <p className="text-sm text-gray-400 mb-2">Activity Level:</p>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span className="text-xs text-gray-400">Very High</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span className="text-xs text-gray-400">High</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span className="text-xs text-gray-400">Medium</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-400 rounded"></div>
                    <span className="text-xs text-gray-400">Low</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-slate-600 rounded"></div>
                    <span className="text-xs text-gray-400">Very Low</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Locations */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Top Active Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topLocations.map((location: HeatmapDataPoint, index: number) => (
                  <div key={`${location.state}-${location.county}`} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          {location.county}, {location.state}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {location.users} users • {location.contractors} contractors • {location.homeowners} homeowners
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-400">
                        {location.interactions}
                      </p>
                      <p className="text-xs text-gray-400">interactions</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {topLocations.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No activity data available for the selected timeframe</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}