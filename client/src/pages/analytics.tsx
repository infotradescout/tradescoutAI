import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Users, DollarSign, Eye, Calendar, Target, MapPin, Clock } from 'lucide-react';

const Analytics = memo(function Analytics() {
  const metrics = [
    { label: 'Total Requests', value: '247', change: '+12%', icon: Users, color: 'blue' },
    { label: 'Revenue', value: '$42,380', change: '+18%', icon: DollarSign, color: 'emerald' },
    { label: 'Profile Views', value: '1,284', change: '+7%', icon: Eye, color: 'purple' },
    { label: 'Conversion Rate', value: '24.3%', change: '+3%', icon: Target, color: 'orange' }
  ];

  const requestSources = [
    { source: 'Direct Search', requests: 89, percentage: 36 },
    { source: 'Facebook Groups', requests: 67, percentage: 27 },
    { source: 'Referrals', requests: 45, percentage: 18 },
    { source: 'Daily Deals', requests: 32, percentage: 13 },
    { source: 'Other', requests: 14, percentage: 6 }
  ];

  const recentProjects = [
    { 
      id: 1, 
      title: 'Kitchen Renovation', 
      client: 'Sarah Johnson', 
      value: '$8,500', 
      status: 'Completed',
      date: '2024-03-15',
      location: 'Beverly Hills, CA'
    },
    { 
      id: 2, 
      title: 'Bathroom Remodel', 
      client: 'Mike Chen', 
      value: '$5,200', 
      status: 'In Progress',
      date: '2024-03-10',
      location: 'Santa Monica, CA'
    },
    { 
      id: 3, 
      title: 'Deck Installation', 
      client: 'Emily Davis', 
      value: '$3,800', 
      status: 'Quoted',
      date: '2024-03-08',
      location: 'Pasadena, CA'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'emerald': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'purple': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'orange': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-600 hover:bg-emerald-700';
      case 'In Progress': return 'bg-blue-600 hover:bg-blue-700';
      case 'Quoted': return 'bg-yellow-600 hover:bg-yellow-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Business Analytics</h1>
          <p className="text-xl text-gray-300">
            Track your performance, opportunities, and revenue with detailed insights
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card key={index} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg ${getColorClasses(metric.color)}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/50">
                      {metric.change}
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{metric.value}</h3>
                  <p className="text-gray-400 text-sm">{metric.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-orange-600">Overview</TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-orange-600">Requests</TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-orange-600">Projects</TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-orange-600">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Request Sources */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Request Sources</CardTitle>
                  <CardDescription className="text-gray-400">
                    Where your project requests are coming from this month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {requestSources.map((source, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                          <span className="text-gray-300">{source.source}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-orange-500 h-2 rounded-full"
                              style={{ width: `${source.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-white font-medium w-8">{source.requests}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Trend */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Revenue Trend
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Monthly revenue over the last 6 months
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
                      const values = [28000, 32000, 35000, 38000, 40000, 42380];
                      const maxValue = Math.max(...values);
                      const percentage = (values[index] / maxValue) * 100;
                      
                      return (
                        <div key={month} className="flex items-center justify-between">
                          <span className="text-gray-300 w-8">{month}</span>
                          <div className="flex items-center gap-3 flex-1 ml-4">
                            <div className="w-full bg-slate-700 rounded-full h-3">
                              <div 
                                className="bg-emerald-500 h-3 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-white font-medium w-16">${(values[index] / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Request Management</CardTitle>
                <CardDescription className="text-gray-400">
                  Track and analyze your opportunity pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg text-center">
                    <h3 className="text-2xl font-bold text-blue-400 mb-1">73</h3>
                    <p className="text-gray-300">New Requests</p>
                    <p className="text-xs text-gray-500">This month</p>
                  </div>
                  <div className="p-4 bg-yellow-600/10 border border-yellow-600/20 rounded-lg text-center">
                    <h3 className="text-2xl font-bold text-yellow-400 mb-1">45</h3>
                    <p className="text-gray-300">In Progress</p>
                    <p className="text-xs text-gray-500">Being worked</p>
                  </div>
                  <div className="p-4 bg-emerald-600/10 border border-emerald-600/20 rounded-lg text-center">
                    <h3 className="text-2xl font-bold text-emerald-400 mb-1">29</h3>
                    <p className="text-gray-300">Converted</p>
                    <p className="text-xs text-gray-500">This month</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-white">Conversion Funnel</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <span className="text-gray-300">Requests Received</span>
                      <span className="text-white font-medium">247</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <span className="text-gray-300">Contacted</span>
                      <span className="text-white font-medium">198 (80%)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <span className="text-gray-300">Quoted</span>
                      <span className="text-white font-medium">134 (54%)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <span className="text-gray-300">Converted</span>
                      <span className="text-white font-medium">60 (24%)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Projects</CardTitle>
                <CardDescription className="text-gray-400">
                  Overview of your latest project activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentProjects.map((project) => (
                    <div key={project.id} className="p-4 bg-slate-700/30 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-white mb-1">{project.title}</h3>
                          <p className="text-gray-400 text-sm">Client: {project.client}</p>
                        </div>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-300">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                          <span>{project.value}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <span>{project.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Calendar className="w-4 h-4 text-purple-400" />
                          <span>{project.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Response Time</CardTitle>
                  <CardDescription className="text-gray-400">
                    How quickly you respond to new requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-orange-600/10 border-4 border-orange-600/20 mb-4">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-orange-400">2.3</span>
                        <span className="text-lg text-gray-400 ml-1">hrs</span>
                      </div>
                    </div>
                    <p className="text-gray-300">Average Response Time</p>
                    <Badge variant="outline" className="mt-2 text-emerald-400 border-emerald-400/50">
                      -15% from last month
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Customer Satisfaction</CardTitle>
                  <CardDescription className="text-gray-400">
                    Average rating from completed projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-600/10 border-4 border-emerald-600/20 mb-4">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-emerald-400">4.8</span>
                        <span className="text-lg text-gray-400 ml-1">/5</span>
                      </div>
                    </div>
                    <p className="text-gray-300">Overall Rating</p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      {[1,2,3,4,5].map((star) => (
                        <svg key={star} className="w-5 h-5 fill-yellow-400" viewBox="0 0 20 20">
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
            <Calendar className="w-4 h-4 mr-2" />
            View Full History
          </Button>
        </div>
      </div>
    </div>
  );
});

export default Analytics;
