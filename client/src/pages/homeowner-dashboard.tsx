import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HomeownerTipsRotator } from "@/components/HomeownerTipsRotator";
import {
  Calculator,
  MapPin,
  Star,
  Clock,
  ChevronRight,
  Home,
  Users,
  CheckCircle,
  AlertCircle,
  Calendar,
  Heart,
  MessageSquare,
  Share2,
  Trophy
} from "lucide-react";

interface ProjectData {
  id: string;
  title: string;
  status: 'estimate_requested' | 'in_progress' | 'completed';
  contractorName?: string;
  estimatedCost?: number;
  createdAt: string;
}

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalSpent: number;
}

export default function HomeownerDashboard() {
  const { user } = useAuth();

  // Mock data for now - replace with real API calls
  const mockProjects: ProjectData[] = [
    {
      id: '1',
      title: 'Roof Repair',
      status: 'estimate_requested',
      estimatedCost: 5200,
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      title: 'Kitchen Renovation',
      status: 'in_progress',
      contractorName: 'Elite Kitchen Co.',
      estimatedCost: 15000,
      createdAt: '2024-01-10',
    },
    {
      id: '3',
      title: 'Plumbing Repair',
      status: 'completed',
      contractorName: 'Quick Fix Plumbing',
      estimatedCost: 450,
      createdAt: '2024-01-05',
    },
  ];

  const mockStats: DashboardStats = {
    totalProjects: 3,
    activeProjects: 2,
    completedProjects: 1,
    totalSpent: 15450,
  };

  const getStatusBadge = (status: ProjectData['status']) => {
    switch (status) {
      case 'estimate_requested':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Estimate Requested</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
    }
  };

  const getStatusIcon = (status: ProjectData['status']) => {
    switch (status) {
      case 'estimate_requested':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {user?.firstName || 'Homeowner'}
        </h1>
        <p className="text-gray-300">Manage your home improvement projects and find contractors</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/contractor-board">
          <Card className="bg-navy-700 border-navy-600 card-enhanced cursor-pointer hover:border-orange-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Find Contractors</h3>
                    <p className="text-gray-400 text-sm">Search verified contractors</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/quote-calculator">
          <Card className="bg-navy-700 border-navy-600 card-enhanced cursor-pointer hover:border-orange-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Calculator className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Get Estimate</h3>
                    <p className="text-gray-400 text-sm">Calculate project costs</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="bg-gradient-to-r from-green-500/20 to-green-600/20 border-green-500/30 card-enhanced">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-500/30 rounded-lg flex items-center justify-center">
                  <Home className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">My Projects</h3>
                  <p className="text-gray-400 text-sm">{mockStats.activeProjects} active</p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white">
                {mockStats.totalProjects}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Home className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-white">{mockStats.totalProjects}</p>
            <p className="text-sm text-gray-400">Total Projects</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Clock className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-white">{mockStats.activeProjects}</p>
            <p className="text-sm text-gray-400">Active Projects</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-white">{mockStats.completedProjects}</p>
            <p className="text-sm text-gray-400">Completed</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-white">${mockStats.totalSpent.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Total Invested</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Recent Projects
              <Button variant="ghost" className="text-orange-500 hover:text-orange-400 p-0">
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 bg-navy-600 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(project.status)}
                    <div>
                      <p className="text-white font-medium">{project.title}</p>
                      <p className="text-gray-400 text-sm">
                        {project.contractorName || 'Finding contractors...'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(project.status)}
                    {project.estimatedCost && (
                      <p className="text-white font-semibold mt-1">
                        ${project.estimatedCost.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {mockProjects.length === 0 && (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No projects yet</p>
                  <Link href="/contractor-board">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                      Start Your First Project
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white">Recommended for You</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <HomeownerTipsRotator />

              <div className="p-4 bg-navy-600 rounded-lg">
                <h4 className="text-white font-semibold mb-2">Top Rated Contractors</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-orange-500 rounded text-white text-xs flex items-center justify-center font-bold">
                        AC
                      </div>
                      <span className="text-white text-sm">Apex Construction</span>
                    </div>
                    <div className="flex items-center">
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                      <span className="text-gray-400 text-xs ml-1">4.9</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-orange-500 rounded text-white text-xs flex items-center justify-center font-bold">
                        EP
                      </div>
                      <span className="text-white text-sm">Elite Plumbing</span>
                    </div>
                    <div className="flex items-center">
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                      <span className="text-gray-400 text-xs ml-1">4.7</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Community Feed - Social Media Style */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-white mb-6">Community Feed</h2>
        
        {/* Feed Posts */}
        <div className="space-y-6 max-w-2xl">
          {/* Sample Post 1 - Contractor Showcase */}
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              {/* Post Header */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                  AC
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Apex Construction</p>
                  <p className="text-gray-400 text-sm">2 hours ago • Los Angeles, CA</p>
                </div>
                <Badge className="bg-blue-500">Contractor</Badge>
              </div>

              {/* Post Content */}
              <p className="text-white mb-4">
                Just completed this beautiful kitchen renovation for the Martinez family! 
                Modern cabinets, quartz countertops, and all new appliances. 
                What do you think? 🔨✨
              </p>

              {/* Post Image */}
              <div className="bg-navy-600 rounded-lg h-64 flex items-center justify-center mb-4">
                <p className="text-gray-400">Kitchen renovation photo</p>
              </div>

              {/* Post Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-navy-600">
                <Button variant="ghost" className="text-gray-400 hover:text-orange-500">
                  <Heart className="h-5 w-5 mr-2" />
                  24 likes
                </Button>
                <Button variant="ghost" className="text-gray-400 hover:text-orange-500">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  8 comments
                </Button>
                <Button variant="ghost" className="text-gray-400 hover:text-orange-500">
                  <Share2 className="h-5 w-5 mr-2" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sample Post 2 - Community Question */}
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                  SM
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">Sarah Martinez</p>
                  <p className="text-gray-400 text-sm">5 hours ago • Sunset Hills</p>
                </div>
                <Badge className="bg-green-500">Homeowner</Badge>
              </div>

              <p className="text-white mb-4">
                Looking for recommendations for a reliable plumber in the area. 
                Need help with a kitchen sink issue. Any suggestions?
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-navy-600">
                <Button variant="ghost" className="text-gray-400 hover:text-orange-500">
                  <Heart className="h-5 w-5 mr-2" />
                  12 likes
                </Button>
                <Button variant="ghost" className="text-gray-400 hover:text-orange-500">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  15 comments
                </Button>
                <Button variant="ghost" className="text-gray-400 hover:text-orange-500">
                  <Share2 className="h-5 w-5 mr-2" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sample Post 3 - Marketplace Item */}
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  JD
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">John Davis</p>
                  <p className="text-gray-400 text-sm">1 day ago</p>
                </div>
                <Badge className="bg-purple-500">Marketplace</Badge>
              </div>

              <p className="text-white font-semibold mb-2">DeWalt Power Drill Set - $120</p>
              <p className="text-gray-300 mb-4">
                Barely used, includes case and 2 batteries. Perfect condition!
              </p>

              <div className="bg-navy-600 rounded-lg h-48 flex items-center justify-center mb-4">
                <p className="text-gray-400">Power drill photo</p>
              </div>

              <div className="flex items-center justify-between">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white flex-1 mr-2">
                  View Details
                </Button>
                <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10">
                  <Heart className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Load More */}
          <div className="text-center py-4">
            <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10">
              Load More Posts
            </Button>
          </div>
        </div>

        {/* Sidebar - Quick Links */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/marketplace">
              <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-orange-500 flex flex-col items-center justify-center space-y-1">
                <Star className="h-5 w-5 text-yellow-400" />
                <span className="text-xs">Marketplace</span>
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-orange-500 flex flex-col items-center justify-center space-y-1">
                <Trophy className="h-5 w-5 text-orange-400" />
                <span className="text-xs">Leaderboard</span>
              </Button>
            </Link>
            <Link href="/foundation">
              <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-orange-500 flex flex-col items-center justify-center space-y-1">
                <Home className="h-5 w-5 text-blue-400" />
                <span className="text-xs">Foundation</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}