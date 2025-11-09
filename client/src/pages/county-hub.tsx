import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Building, TrendingUp, Star, MessageSquare } from 'lucide-react';

const CountyHub = memo(function CountyHub() {
  const countyData = {
    name: "Los Angeles County",
    state: "California",
    population: "10.2M",
    contractors: 1247,
    activeProjects: 89,
    facebookGroup: "LA County TradeScout Community"
  };

  const topContractors = [
    { name: "Elite Construction Co.", rating: 4.9, jobs: 156, trade: "General Contractor" },
    { name: "Perfect Plumbing Services", rating: 4.8, jobs: 203, trade: "Plumbing" },
    { name: "Advanced Electric Solutions", rating: 4.9, jobs: 178, trade: "Electrical" },
    { name: "Premium Roofing Experts", rating: 4.7, jobs: 134, trade: "Roofing" }
  ];

  const recentActivity = [
    { type: "project", description: "New kitchen remodel project posted in Beverly Hills", time: "2 hours ago" },
    { type: "contractor", description: "Elite Construction Co. completed a bathroom renovation", time: "4 hours ago" },
    { type: "review", description: "Perfect Plumbing received a 5-star review", time: "6 hours ago" },
    { type: "join", description: "3 new homeowners joined the community", time: "8 hours ago" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-8 h-8 text-orange-500" />
            <div>
              <h1 className="text-4xl font-bold text-white">{countyData.name}</h1>
              <p className="text-xl text-gray-300">{countyData.state}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-blue-400" />
                  <div>
                    <p className="text-2xl font-bold text-white">{countyData.population}</p>
                    <p className="text-sm text-gray-400">Population</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Building className="w-6 h-6 text-orange-400" />
                  <div>
                    <p className="text-2xl font-bold text-white">{countyData.contractors}</p>
                    <p className="text-sm text-gray-400">Verified Contractors</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="text-2xl font-bold text-white">{countyData.activeProjects}</p>
                    <p className="text-sm text-gray-400">Active Projects</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-6 h-6 text-purple-400" />
                  <div>
                    <p className="text-lg font-bold text-white">TradeScout</p>
                    <p className="text-sm text-gray-400">Community Group</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Contractors */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-orange-500" />
                Top Rated Contractors
              </CardTitle>
              <CardDescription className="text-gray-400">
                Elite professionals in your area
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topContractors.map((contractor, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-white">{contractor.name}</h3>
                      <p className="text-sm text-gray-400">{contractor.trade}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-300">{contractor.rating}</span>
                        </div>
                        <span className="text-sm text-gray-400">• {contractor.jobs} jobs</span>
                      </div>
                    </div>
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                      View Profile
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Activity</CardTitle>
              <CardDescription className="text-gray-400">
                What's happening in your community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-slate-700/20 rounded-lg">
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className="border-orange-500 text-orange-400">
                        {activity.type}
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-300">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Join Community Button */}
        <div className="mt-8 text-center">
          <Card className="bg-gradient-to-r from-orange-600/20 to-orange-500/20 border-orange-500/30">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                Join the {countyData.name} Community
              </h2>
              <p className="text-gray-300 mb-6">
                Connect with local contractors, homeowners, and community members on TradeScout
              </p>
              <Button size="lg" className="bg-orange-600 hover:bg-orange-700">
                Join Community Group
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
});

export default CountyHub;