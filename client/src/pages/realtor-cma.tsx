import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Home, 
  Search, 
  Download, 
  Eye,
  DollarSign,
  Calendar,
  BarChart3,
  MapPin,
  Ruler,
  Settings
} from "lucide-react";

export default function RealtorCMA() {
  const [searchAddress, setSearchAddress] = useState("");
  const [cmaData, setCmaData] = useState<any>(null);

  const recentCMAs = [
    {
      id: 1,
      address: "123 Oak Street, Downtown",
      estimatedValue: "$475,000",
      dateCreated: "2 days ago",
      status: "Delivered",
      client: "Sarah Martinez"
    },
    {
      id: 2, 
      address: "456 Maple Avenue, Riverside",
      estimatedValue: "$625,000",
      dateCreated: "1 week ago",
      status: "Draft",
      client: "David Chen"
    },
    {
      id: 3,
      address: "789 Pine Drive, Suburban Hills",
      estimatedValue: "$385,000", 
      dateCreated: "2 weeks ago",
      status: "Delivered",
      client: "Amanda Foster"
    }
  ];

  const generateCMA = () => {
    // Mock CMA generation
    const mockCMA = {
      subject: {
        address: searchAddress || "123 Main Street, Downtown Area",
        estimatedValue: "$475,000",
        priceRange: "$450,000 - $500,000",
        beds: 3,
        baths: 2,
        sqft: 1850,
        yearBuilt: 2018
      },
      comparables: [
        {
          id: 1,
          address: "125 Oak Street",
          soldPrice: "$465,000",
          soldDate: "Jan 15, 2024",
          beds: 3,
          baths: 2,
          sqft: 1850,
          daysOnMarket: 18,
          distance: "0.2 miles"
        },
        {
          id: 2,
          address: "456 Maple Ave", 
          soldPrice: "$485,000",
          soldDate: "Dec 20, 2023",
          beds: 3,
          baths: 2.5,
          sqft: 1920,
          daysOnMarket: 25,
          distance: "0.4 miles"
        },
        {
          id: 3,
          address: "789 Elm Street",
          soldPrice: "$455,000",
          soldDate: "Nov 28, 2023", 
          beds: 2,
          baths: 2,
          sqft: 1780,
          daysOnMarket: 32,
          distance: "0.3 miles"
        }
      ],
      marketTrends: {
        avgDaysOnMarket: 25,
        priceChangeYoY: "+6.8%",
        inventoryLevel: "Low",
        absorption: "2.3 months"
      }
    };
    setCmaData(mockCMA);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered": return "bg-green-600";
      case "Draft": return "bg-yellow-600";
      case "In Progress": return "bg-blue-600";
      default: return "bg-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <BarChart3 className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Comparative Market Analysis</h1>
              <p className="text-gray-400">Generate professional CMAs for your clients</p>
            </div>
          </div>

          <Tabs defaultValue="create" className="space-y-6">
            <TabsList className="bg-navy-800/50 border border-navy-600">
              <TabsTrigger value="create">Create New CMA</TabsTrigger>
              <TabsTrigger value="recent">Recent CMAs</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* CMA Generator */}
                <Card className="bg-navy-800/50 border-navy-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-green-400" />
                      Property Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="searchAddress">Property Address</Label>
                      <Input
                        id="searchAddress"
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                        placeholder="123 Main Street, City, State ZIP"
                        className="bg-navy-700/50 border-navy-600"
                        data-testid="input-search-address"
                      />
                    </div>

                    <Button 
                      onClick={generateCMA}
                      className="w-full bg-green-600 hover:bg-green-700"
                      data-testid="button-generate-cma"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Generate CMA Report
                    </Button>

                    <div className="text-sm text-gray-400 space-y-2">
                      <p>• Automatically pulls recent comparable sales</p>
                      <p>• Includes market trend analysis</p>
                      <p>• Professional PDF output for clients</p>
                    </div>
                  </CardContent>
                </Card>

                {/* CMA Settings */}
                <Card className="bg-navy-800/50 border-navy-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-blue-400" />
                      Analysis Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Search Radius</Label>
                        <select className="w-full p-2 bg-navy-700/50 border border-navy-600 rounded text-sm">
                          <option>0.5 miles</option>
                          <option>1.0 miles</option>
                          <option>1.5 miles</option>
                        </select>
                      </div>
                      <div>
                        <Label>Time Period</Label>
                        <select className="w-full p-2 bg-navy-700/50 border border-navy-600 rounded text-sm">
                          <option>Last 6 months</option>
                          <option>Last 12 months</option>
                          <option>Last 18 months</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Min Bedrooms</Label>
                        <select className="w-full p-2 bg-navy-700/50 border border-navy-600 rounded text-sm">
                          <option>Any</option>
                          <option>2+</option>
                          <option>3+</option>
                          <option>4+</option>
                        </select>
                      </div>
                      <div>
                        <Label>Property Type</Label>
                        <select className="w-full p-2 bg-navy-700/50 border border-navy-600 rounded text-sm">
                          <option>All Types</option>
                          <option>Single Family</option>
                          <option>Condo</option>
                          <option>Townhouse</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* CMA Results */}
              {cmaData && (
                <div className="space-y-6">
                  {/* Subject Property */}
                  <Card className="bg-navy-800/50 border-navy-600">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Home className="h-5 w-5 text-green-400" />
                          Subject Property Analysis
                        </span>
                        <Button size="sm" variant="outline" data-testid="button-download-pdf">
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold mb-2">{cmaData.subject.address}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Bedrooms</span>
                              <span>{cmaData.subject.beds}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Bathrooms</span>
                              <span>{cmaData.subject.baths}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Square Feet</span>
                              <span>{cmaData.subject.sqft.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Year Built</span>
                              <span>{cmaData.subject.yearBuilt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="p-6 bg-green-500/10 rounded-lg">
                            <p className="text-sm text-gray-400 mb-2">Estimated Market Value</p>
                            <p className="text-3xl font-bold text-green-400">{cmaData.subject.estimatedValue}</p>
                            <p className="text-sm text-gray-400 mt-1">Range: {cmaData.subject.priceRange}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Comparable Sales */}
                  <Card className="bg-navy-800/50 border-navy-600">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-400" />
                        Recent Comparable Sales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {cmaData.comparables.map((comp) => (
                          <div key={comp.id} className="flex items-center justify-between p-4 bg-navy-700/30 rounded-lg">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <Home className="h-6 w-6 text-blue-400" />
                              </div>
                              
                              <div>
                                <h5 className="font-medium">{comp.address}</h5>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                  <span>{comp.beds} bed • {comp.baths} bath • {comp.sqft.toLocaleString()} sqft</span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {comp.distance}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="font-semibold text-green-400 text-lg">{comp.soldPrice}</p>
                              <p className="text-sm text-gray-400">{comp.soldDate}</p>
                              <p className="text-sm text-blue-400">{comp.daysOnMarket} days on market</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Market Trends */}
                  <Card className="bg-navy-800/50 border-navy-600">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-purple-400" />
                        Market Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                          <p className="text-sm text-gray-400 mb-2">Avg Days on Market</p>
                          <p className="text-2xl font-bold text-purple-400">{cmaData.marketTrends.avgDaysOnMarket}</p>
                        </div>
                        
                        <div className="text-center p-4 bg-green-500/10 rounded-lg">
                          <p className="text-sm text-gray-400 mb-2">Price Change (YoY)</p>
                          <p className="text-2xl font-bold text-green-400">{cmaData.marketTrends.priceChangeYoY}</p>
                        </div>
                        
                        <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                          <p className="text-sm text-gray-400 mb-2">Inventory Level</p>
                          <p className="text-2xl font-bold text-orange-400">{cmaData.marketTrends.inventoryLevel}</p>
                        </div>
                        
                        <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                          <p className="text-sm text-gray-400 mb-2">Market Absorption</p>
                          <p className="text-2xl font-bold text-blue-400">{cmaData.marketTrends.absorption}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="recent" className="space-y-4">
              {recentCMAs.map((cma) => (
                <Card key={cma.id} className="bg-navy-800/50 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                          <Home className="h-6 w-6 text-green-400" />
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-lg">{cma.address}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>Client: {cma.client}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {cma.dateCreated}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getStatusColor(cma.status)}>
                            {cma.status}
                          </Badge>
                          <span className="font-semibold text-green-400">{cma.estimatedValue}</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" data-testid="button-view-cma">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button size="sm" variant="outline" data-testid="button-download-cma">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="templates">
              <Card className="bg-navy-800/50 border-navy-600">
                <CardContent className="p-8 text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">CMA Templates</h3>
                  <p className="text-gray-400 mb-6">
                    Customize your CMA reports with branded templates and layouts
                  </p>
                  <Button className="bg-green-600 hover:bg-green-700" data-testid="button-manage-templates">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Templates
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}