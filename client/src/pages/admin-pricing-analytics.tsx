
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  MapPin, 
  Wrench,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface PricingAnalytics {
  averageQuotes: {
    byTrade: Record<string, { average: number; count: number; trend: number }>;
    byRegion: Record<string, { average: number; count: number; trend: number }>;
    byProject: Record<string, { average: number; count: number; trend: number }>;
  };
  priceFluctuations: {
    trades: Array<{
      tradeId: string;
      tradeName: string;
      currentAvg: number;
      previousAvg: number;
      percentChange: number;
      period: string;
    }>;
    regions: Array<{
      countyId: string;
      countyName: string;
      stateCode: string;
      currentAvg: number;
      previousAvg: number;
      percentChange: number;
      period: string;
    }>;
  };
  popularProjects: Array<{
    projectType: string;
    quoteCount: number;
    averageValue: number;
    growth: number;
  }>;
  marketInsights: {
    topPerformingRegions: Array<{
      county: string;
      state: string;
      averageQuote: number;
      volume: number;
    }>;
    emergingTrends: Array<{
      trend: string;
      growth: number;
      description: string;
    }>;
  };
}

export default function AdminPricingAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedView, setSelectedView] = useState<'overview' | 'trades' | 'regions' | 'trends'>('overview');

  // Fetch pricing analytics
  const { data: analytics, isLoading, refetch } = useQuery<PricingAnalytics>({
    queryKey: ['/api/admin/pricing-analytics', timeframe],
    queryFn: async () => {
      const result = await apiRequest('GET', `/api/admin/pricing-analytics?timeframe=${timeframe}`);
      return result as PricingAnalytics;
    },
    enabled: !!user && ['head_admin', 'ops_admin'].includes(user.role || ''),
  });

  // Update calculator pricing
  const handleUpdatePricing = async () => {
    try {
      const result = await apiRequest('POST', '/api/admin/pricing-analytics/update-calculator');
      toast({
        title: "Pricing Updated",
        description: `Updated ${result.updatedCount} pricing entries based on current market data.`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update calculator pricing. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Export analytics data
  const handleExportData = async () => {
    try {
      const response = await fetch(`/api/admin/pricing-analytics/export?timeframe=${timeframe}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pricing-analytics-${timeframe}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Export Complete",
          description: "Analytics data has been downloaded as CSV.",
        });
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data.",
        variant: "destructive",
      });
    }
  };

  if (!user || !['head_admin', 'ops_admin'].includes(user.role || '')) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
            <p className="text-red-600">Admin access required to view pricing analytics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="bg-navy-700 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Total Trades Tracked</p>
              <p className="text-2xl font-bold text-white">
                {Object.keys(analytics?.averageQuotes?.byTrade || {}).length}
              </p>
            </div>
            <Wrench className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-navy-700 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Regions with Data</p>
              <p className="text-2xl font-bold text-white">
                {Object.keys(analytics?.averageQuotes?.byRegion || {}).length}
              </p>
            </div>
            <MapPin className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-navy-700 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Popular Projects</p>
              <p className="text-2xl font-bold text-white">
                {analytics?.popularProjects?.length || 0}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-navy-700 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Avg Quote Value</p>
              <p className="text-2xl font-bold text-white">
                ${Math.round((
                  ((Object.values(analytics?.averageQuotes?.byTrade || {}) as Array<{ average: number }>))
                    .reduce((sum, trade) => sum + trade.average, 0) /
                  Math.max(Object.keys(analytics?.averageQuotes?.byTrade || {}).length, 1)
                )).toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPriceFluctuations = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-navy-700 border-navy-600">
        <CardHeader>
          <CardTitle className="text-white">Trade Price Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.priceFluctuations?.trades?.slice(0, 10).map((trade: PricingAnalytics['priceFluctuations']['trades'][number]) => (
              <div key={trade.tradeId} className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{trade.tradeName}</p>
                  <p className="text-gray-400 text-sm">${trade.currentAvg.toLocaleString()} avg</p>
                </div>
                <div className="flex items-center gap-2">
                  {trade.percentChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    trade.percentChange > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {trade.percentChange > 0 ? '+' : ''}{trade.percentChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-navy-700 border-navy-600">
        <CardHeader>
          <CardTitle className="text-white">Regional Price Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.priceFluctuations?.regions?.slice(0, 10).map((region: PricingAnalytics['priceFluctuations']['regions'][number]) => (
              <div key={region.countyId} className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{region.countyName}, {region.stateCode}</p>
                  <p className="text-gray-400 text-sm">${region.currentAvg.toLocaleString()} avg</p>
                </div>
                <div className="flex items-center gap-2">
                  {region.percentChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    region.percentChange > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {region.percentChange > 0 ? '+' : ''}{region.percentChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPopularProjects = () => (
    <Card className="bg-navy-700 border-navy-600">
      <CardHeader>
        <CardTitle className="text-white">Popular Project Types</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {analytics?.popularProjects?.slice(0, 15).map((project: PricingAnalytics['popularProjects'][number], index: number) => (
            <div key={project.projectType} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center">
                  {index + 1}
                </Badge>
                <div>
                  <p className="text-white font-medium capitalize">
                    {project.projectType.replace(/-/g, ' ')}
                  </p>
                  <p className="text-gray-400 text-sm">{project.quoteCount} quotes</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold">${project.averageValue.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">avg value</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Pricing Analytics</h1>
          <p className="text-gray-300">Monitor market trends and update calculator pricing</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
            <SelectTrigger className="w-32 bg-navy-600 border-navy-500 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-navy-700 border-navy-600">
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={handleExportData} variant="outline" className="border-navy-400">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button onClick={handleUpdatePricing} className="bg-orange-500 hover:bg-orange-600">
            <RefreshCw className="h-4 w-4 mr-2" />
            Update Calculator
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'trades', label: 'By Trade', icon: Wrench },
          { id: 'regions', label: 'By Region', icon: MapPin },
          { id: 'trends', label: 'Market Trends', icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={selectedView === id ? "default" : "outline"}
            onClick={() => setSelectedView(id as any)}
            className={selectedView === id ? "bg-orange-500" : "border-navy-400"}
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </Button>
        ))}
      </div>

      {selectedView === 'overview' && renderOverview()}

      {(selectedView === 'trades' || selectedView === 'regions') && renderPriceFluctuations()}

      {selectedView === 'trends' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderPopularProjects()}
          
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Market Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="text-white font-medium mb-3">Top Performing Regions</h4>
                  <div className="space-y-2">
                    {analytics?.marketInsights?.topPerformingRegions?.slice(0, 5).map((region: PricingAnalytics['marketInsights']['topPerformingRegions'][number]) => (
                      <div key={`${region.county}-${region.state}`} className="flex justify-between">
                        <span className="text-gray-300">{region.county}, {region.state}</span>
                        <span className="text-white">${region.averageQuote.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-white font-medium mb-3">Emerging Trends</h4>
                  <div className="space-y-3">
                    {analytics?.marketInsights?.emergingTrends?.map((trend: PricingAnalytics['marketInsights']['emergingTrends'][number]) => (
                      <div key={trend.trend} className="border-l-2 border-orange-500 pl-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white font-medium">{trend.trend}</span>
                          <Badge className="bg-green-600">+{trend.growth}%</Badge>
                        </div>
                        <p className="text-gray-400 text-sm">{trend.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {analytics && (
        <Card className="bg-navy-700 border-navy-600 mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-gray-300 text-sm">Data Collection</p>
                <p className="text-green-500 font-semibold">Active</p>
              </div>
              <div className="text-center">
                <p className="text-gray-300 text-sm">Last Calculator Update</p>
                <p className="text-white">2 hours ago</p>
              </div>
              <div className="text-center">
                <p className="text-gray-300 text-sm">Market Coverage</p>
                <p className="text-white">
                  {Object.keys(analytics.averageQuotes.byRegion).length} regions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
