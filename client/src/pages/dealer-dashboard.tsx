import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, Users, TrendingUp, DollarSign, Phone, MapPin, Calendar, Plus, Eye, Handshake, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function DealerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch partnerships
  const { data: partnerships = [], isLoading: partnershipsLoading } = useQuery({
    queryKey: ['/api/partnerships/my'],
  });

  // Fetch potential partners
  const { data: potentialPartners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ['/api/partnerships/find/contractor_user'],
    enabled: activeTab === 'referrals'
  });

  // Ensure partnerships is always an array
  const partnershipsList = Array.isArray(partnerships) ? partnerships : [];
  const partnersList = Array.isArray(potentialPartners) ? potentialPartners : [];

  // Mock dealer stats
  const dealerStats = {
    totalSales: 24,
    monthlyRevenue: 1250000,
    activeInventory: 87,
    pendingLeads: 12,
    contractorReferrals: 6,
    avgSalePrice: 52000
  };

  return (
    <div className="h-full bg-background">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dealer Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {user?.firstName || 'Dealer'}!</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-navy-800 border-navy-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Monthly Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{dealerStats.totalSales}</div>
              <p className="text-xs text-green-400">+12% from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-navy-800 border-navy-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${dealerStats.monthlyRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-green-400">+8% from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-navy-800 border-navy-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Active Inventory</CardTitle>
              <Car className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{dealerStats.activeInventory}</div>
              <p className="text-xs text-gray-300">vehicles available</p>
            </CardContent>
          </Card>

          <Card className="bg-navy-800 border-navy-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Pending Connections</CardTitle>
              <Users className="h-4 w-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{dealerStats.pendingLeads}</div>
              <p className="text-xs text-orange-400">requires follow-up</p>
            </CardContent>
          </Card>

          <Card className="bg-navy-800 border-navy-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Contractor Partners</CardTitle>
              <Phone className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{dealerStats.contractorReferrals}</div>
              <p className="text-xs text-purple-400">active referrals</p>
            </CardContent>
          </Card>

          <Card className="bg-navy-800 border-navy-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Avg Sale Price</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${dealerStats.avgSalePrice.toLocaleString()}
              </div>
              <p className="text-xs text-green-400">+3% from last month</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-navy-800 border-navy-700">
            <TabsTrigger value="overview" className="text-gray-300">Overview</TabsTrigger>
            <TabsTrigger value="inventory" className="text-gray-300">Inventory</TabsTrigger>
            <TabsTrigger value="connections" className="text-gray-300">Connections</TabsTrigger>
            <TabsTrigger value="referrals" className="text-gray-300">Referrals</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="bg-navy-800 border-navy-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Activity</CardTitle>
                <CardDescription className="text-gray-300">
                  Your latest sales and connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Car className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-white font-medium">2023 Honda Accord</p>
                        <p className="text-sm text-gray-300">Sold to Jennifer M.</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">$28,500</p>
                      <p className="text-xs text-gray-300">2 hours ago</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-white font-medium">New connection from Mike R.</p>
                        <p className="text-sm text-gray-300">Looking for pickup truck</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-purple-400" />
                      <div>
                        <p className="text-white font-medium">Contractor referral</p>
                        <p className="text-sm text-gray-300">Thompson Construction shared your info</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">Potential Sale</p>
                      <p className="text-xs text-gray-300">1 day ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <Card className="bg-navy-800 border-navy-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Vehicle Inventory</CardTitle>
                  <CardDescription className="text-gray-300">
                    Manage your available vehicles
                  </CardDescription>
                </div>
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vehicle
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-navy-700 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-white font-medium">2024 Ford F-150</h3>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Available</span>
                    </div>
                    <p className="text-gray-300 text-sm mb-2">XLT Crew Cab, 4x4, 3.5L V6</p>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-white">$48,999</span>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="p-4 bg-navy-700 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-white font-medium">2023 Toyota Camry</h3>
                      <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Pending</span>
                    </div>
                    <p className="text-gray-300 text-sm mb-2">SE, 2.5L 4-Cylinder, FWD</p>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-white">$32,450</span>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections" className="space-y-6">
            <Card className="bg-navy-800 border-navy-700">
              <CardHeader>
                <CardTitle className="text-white">Customer Connections</CardTitle>
                <CardDescription className="text-gray-300">
                  Potential customers and current inquiries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-navy-700 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-white font-medium">Sarah Johnson</h3>
                        <p className="text-gray-300 text-sm">Looking for family SUV</p>
                      </div>
                      <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded">Hot</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-300 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Downtown
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        2 days ago
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                        Contact
                      </Button>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-navy-700 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-white font-medium">Mike Rodriguez</h3>
                        <p className="text-gray-300 text-sm">Needs work truck under $35k</p>
                      </div>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Warm</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-300 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Westside
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        1 week ago
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                        Contact
                      </Button>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals" className="space-y-6">
            <div className="grid gap-6">
              {/* Active Partnerships */}
              <Card className="bg-navy-800 border-navy-700">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Handshake className="w-5 h-5" />
                      Active Partnerships ({partnershipsList.length})
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      Your contractor referral network
                    </CardDescription>
                  </div>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4 mr-2" />
                    New Partnership
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {partnershipsLoading ? (
                      <div className="text-center py-4 text-gray-400">Loading partnerships...</div>
                    ) : (
                      partnershipsList.map((partnership: any) => (
                      <div key={partnership.id} className="p-4 bg-navy-700 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-white font-medium">{partnership.partnerName}</h3>
                            <p className="text-gray-300 text-sm">
                              {partnership.partnershipType === 'dealer_contractor' ? 'Construction Partner' : 'Professional Partner'}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-white text-xs rounded ${
                            partnership.status === 'active' ? 'bg-green-600' : 
                            partnership.status === 'pending' ? 'bg-yellow-600' : 'bg-blue-600'
                          }`}>
                            {partnership.status === 'active' ? 'Active' : 
                             partnership.status === 'pending' ? 'Pending' : 'New'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-300 mb-3">
                          <p>{partnership.totalReferrals} referrals • ${partnership.totalCommissionEarned} earned</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                          <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                            Send Referral
                          </Button>
                        </div>
                      </div>
                      ))
                    )}

                    {!partnershipsLoading && partnershipsList.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <Handshake className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No partnerships yet</p>
                        <p className="text-sm">Start building your referral network!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Find New Partners */}
              <Card className="bg-navy-800 border-navy-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Find Contractor Partners
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Connect with local contractors in your area
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {partnersLoading ? (
                      <div className="text-center py-4 text-gray-400">Finding contractor partners...</div>
                    ) : (
                      partnersList.map((partner: any) => (
                      <div key={partner.id} className="p-4 bg-navy-700 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-white font-medium">
                                {partner.firstName} {partner.lastName}
                              </h3>
                              <div className="flex items-center gap-1 text-yellow-400">
                                <Star className="w-4 h-4 fill-current" />
                                <span className="text-sm">{partner.rating}</span>
                              </div>
                            </div>
                            <p className="text-gray-300 font-medium mb-1">{partner.companyName}</p>
                            <p className="text-gray-400 text-sm mb-2">
                              {partner.specialties.join(', ')} • {partner.completedJobs} jobs completed
                            </p>
                            <p className="text-gray-400 text-sm flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {partner.location}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                              Send Request
                            </Button>
                            <Button size="sm" variant="outline">
                              View Profile
                            </Button>
                          </div>
                        </div>
                      </div>
                      ))
                    )}

                    {!partnersLoading && partnersList.length === 0 && (
                      <div className="text-center py-6 text-gray-400">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>Looking for contractor partners...</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}