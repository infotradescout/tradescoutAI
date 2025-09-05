import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  BarChart3, 
  Home, 
  DollarSign,
  Calendar,
  MapPin,
  Search,
  Download,
  Eye
} from "lucide-react";

export default function RealtorMarketAnalysis() {
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [analysisData, setAnalysisData] = useState<any>(null);

  const marketTrends = [
    {
      neighborhood: "Downtown Area",
      avgPrice: "$475,000",
      priceChange: "+5.2%",
      daysOnMarket: "18 days",
      soldProperties: 24,
      status: "Hot Market"
    },
    {
      neighborhood: "Riverside District", 
      avgPrice: "$625,000",
      priceChange: "+2.8%",
      daysOnMarket: "32 days",
      soldProperties: 15,
      status: "Steady"
    },
    {
      neighborhood: "Suburban Hills",
      avgPrice: "$385,000", 
      priceChange: "-1.5%",
      daysOnMarket: "45 days",
      soldProperties: 18,
      status: "Cooling"
    }
  ];

  const generateAnalysis = () => {
    // Mock CMA generation
    const mockAnalysis = {
      estimatedValue: "$475,000",
      priceRange: "$450,000 - $500,000",
      comparables: [
        {
          address: "123 Oak Street",
          soldPrice: "$465,000",
          soldDate: "Jan 15, 2024",
          beds: 3,
          baths: 2,
          sqft: 1850
        },
        {
          address: "456 Maple Ave",
          soldPrice: "$485,000", 
          soldDate: "Dec 20, 2023",
          beds: 3,
          baths: 2.5,
          sqft: 1920
        }
      ]
    };
    setAnalysisData(mockAnalysis);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Hot Market": return "bg-red-600";
      case "Steady": return "bg-green-600";
      case "Cooling": return "bg-blue-600";
      default: return "bg-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <TrendingUp className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Market Analysis</h1>
              <p className="text-gray-400">Generate CMAs and analyze market trends</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* CMA Generator */}
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-blue-400" />
                  Comparative Market Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="address">Property Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main Street, City, State"
                    className="bg-navy-700/50 border-navy-600"
                    data-testid="input-property-address"
                  />
                </div>

                <div>
                  <Label htmlFor="propertyType">Property Type</Label>
                  <Select onValueChange={setPropertyType}>
                    <SelectTrigger className="bg-navy-700/50 border-navy-600" data-testid="select-property-type">
                      <SelectValue placeholder="Select property type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single-family">Single Family Home</SelectItem>
                      <SelectItem value="condo">Condominium</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="multi-family">Multi-Family</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={generateAnalysis}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="button-generate-cma"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Generate CMA Report
                </Button>
              </CardContent>
            </Card>

            {/* Market Statistics */}
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-400" />
                  Market Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg. Home Price</span>
                    <span className="font-semibold text-green-400">$485,000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Price Change (YoY)</span>
                    <span className="font-semibold text-green-400">+6.8%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg. Days on Market</span>
                    <span className="font-semibold">28 days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Properties Sold (30d)</span>
                    <span className="font-semibold">157 homes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Market Temperature</span>
                    <Badge className="bg-orange-600">Balanced</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CMA Results */}
          {analysisData && (
            <Card className="bg-navy-800/50 border-navy-600 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    CMA Results
                  </span>
                  <Button size="sm" variant="outline" data-testid="button-download-cma">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6 bg-green-500/10 rounded-lg mb-6">
                  <p className="text-sm text-gray-400 mb-2">Estimated Market Value</p>
                  <p className="text-3xl font-bold text-green-400">{analysisData.estimatedValue}</p>
                  <p className="text-sm text-gray-400 mt-1">Range: {analysisData.priceRange}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">Recent Comparable Sales</h4>
                  <div className="space-y-3">
                    {analysisData.comparables.map((comp, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-navy-700/30 rounded-lg">
                        <div>
                          <h5 className="font-medium">{comp.address}</h5>
                          <p className="text-sm text-gray-400">{comp.beds} bed • {comp.baths} bath • {comp.sqft} sqft</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-400">{comp.soldPrice}</p>
                          <p className="text-sm text-gray-400">{comp.soldDate}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Neighborhood Trends */}
          <Card className="bg-navy-800/50 border-navy-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-400" />
                Neighborhood Market Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {marketTrends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-navy-700/30 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <Home className="h-6 w-6 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{trend.neighborhood}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>Avg: {trend.avgPrice}</span>
                          <span>DOM: {trend.daysOnMarket}</span>
                          <span>Sold: {trend.soldProperties}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge className={getStatusColor(trend.status)}>
                        {trend.status}
                      </Badge>
                      <p className={`text-sm font-medium mt-1 ${trend.priceChange.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                        {trend.priceChange}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}