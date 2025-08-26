import { memo, useState } from 'react';
import { BarChart3, Users2, TrendingUp, DollarSign, MapPin, Calendar, Clock, Award, Target, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const PlatformAnalytics = memo(function PlatformAnalytics() {
  const [timeRange, setTimeRange] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview");

  const overviewStats = [
    { label: "Total Users", value: "12,847", change: "+8.2%", trend: "up", icon: Users2, color: "text-blue-400" },
    { label: "Active Contractors", value: "3,429", change: "+12.1%", trend: "up", icon: Award, color: "text-green-400" },
    { label: "Platform Revenue", value: "$127,340", change: "+15.7%", trend: "up", icon: DollarSign, color: "text-purple-400" },
    { label: "Successful Projects", value: "8,934", change: "+9.8%", trend: "up", icon: Target, color: "text-orange-400" }
  ];

  const userGrowth = [
    { month: "Jan", homeowners: 820, contractors: 145, total: 965 },
    { month: "Feb", homeowners: 1240, contractors: 189, total: 1429 },
    { month: "Mar", homeowners: 1680, contractors: 234, total: 1914 },
    { month: "Apr", homeowners: 2100, contractors: 298, total: 2398 },
    { month: "May", homeowners: 2640, contractors: 367, total: 3007 },
    { month: "Jun", homeowners: 3180, contractors: 445, total: 3625 }
  ];

  const topCounties = [
    { name: "Los Angeles County, CA", users: 2847, contractors: 423, projects: 1268 },
    { name: "Orange County, CA", users: 1934, contractors: 298, projects: 876 },
    { name: "San Diego County, CA", users: 1678, contractors: 234, projects: 654 },
    { name: "Cook County, IL", users: 1456, contractors: 189, projects: 543 },
    { name: "Harris County, TX", users: 1298, contractors: 167, projects: 478 }
  ];

  const revenueBreakdown = [
    { source: "Accelerator Memberships", amount: 45280, percentage: 35.6 },
    { source: "Connection Generation Fees", amount: 38520, percentage: 30.2 },
    { source: "Transaction Fees", amount: 25680, percentage: 20.2 },
    { source: "Premium Features", amount: 12740, percentage: 10.0 },
    { source: "Advertising Revenue", amount: 5120, percentage: 4.0 }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-orange-400" />
              <div>
                <h1 className="text-4xl font-bold text-white">Platform Analytics</h1>
                <p className="text-gray-300 text-lg">Comprehensive insights into platform performance and growth</p>
              </div>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 bg-navy-700 border-navy-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-navy-800 border-navy-600">
            <TabsTrigger value="overview" className="data-[state=active]:bg-orange-600">Overview</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-orange-600">Users</TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-orange-600">Revenue</TabsTrigger>
            <TabsTrigger value="geography" className="data-[state=active]:bg-orange-600">Geography</TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-orange-600">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {overviewStats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <Card key={index} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">{stat.label}</p>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                          <p className={`text-sm ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                            {stat.change} from last period
                          </p>
                        </div>
                        <IconComponent className={`h-8 w-8 ${stat.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Growth Chart */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  User Growth Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userGrowth.map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-white font-medium w-12">{month.month}</span>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-600 text-white">{month.homeowners} Homeowners</Badge>
                          <Badge className="bg-green-600 text-white">{month.contractors} Contractors</Badge>
                        </div>
                      </div>
                      <div className="text-white font-bold">{month.total.toLocaleString()} Total</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users2 className="h-5 w-5" />
                    User Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Homeowners</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">9,418</span>
                        <Badge className="bg-blue-600">73.3%</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Contractors</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">3,429</span>
                        <Badge className="bg-green-600">26.7%</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Daily Active Users</span>
                      <span className="text-white font-bold">3,247</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Weekly Active Users</span>
                      <span className="text-white font-bold">8,934</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Monthly Active Users</span>
                      <span className="text-white font-bold">12,847</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Revenue Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {revenueBreakdown.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white">{item.source}</span>
                        <span className="text-white font-bold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="w-full bg-navy-700 rounded-full h-2">
                        <div 
                          className="bg-orange-600 h-2 rounded-full" 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="border-orange-600 text-orange-400">
                          {item.percentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Revenue Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Monthly Recurring Revenue</span>
                      <span className="text-white font-bold">$89,450</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Average Revenue Per User</span>
                      <span className="text-white font-bold">$9.92</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Customer Lifetime Value</span>
                      <span className="text-white font-bold">$347</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="geography" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Top Counties by User Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topCounties.map((county, index) => (
                    <div key={index} className="p-4 bg-navy-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium">{county.name}</h3>
                        <Badge className="bg-orange-600 text-white">#{index + 1}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-gray-400">Total Users</p>
                          <p className="text-white font-bold">{county.users.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-400">Contractors</p>
                          <p className="text-white font-bold">{county.contractors}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-400">Projects</p>
                          <p className="text-white font-bold">{county.projects}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Zap className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">98.7%</div>
                  <div className="text-gray-400 text-sm">Platform Uptime</div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">1.2s</div>
                  <div className="text-gray-400 text-sm">Avg Response Time</div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Target className="h-8 w-8 text-green-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">92.3%</div>
                  <div className="text-gray-400 text-sm">Success Rate</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default PlatformAnalytics;