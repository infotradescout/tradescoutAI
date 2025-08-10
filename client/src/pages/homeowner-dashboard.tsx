import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  MapPin, 
  Star, 
  Clock, 
  ChevronRight,
  Home,
  TrendingUp,
  Users,
  CheckCircle,
  AlertCircle,
  Calendar
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
        <Link href="/contractors/board">
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
                  <Link href="/contractors/board">
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
              <div className="p-4 bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-lg">
                <h4 className="text-white font-semibold mb-2">Winter Home Maintenance</h4>
                <p className="text-gray-300 text-sm mb-3">
                  Get your home ready for winter with our recommended contractor checklist.
                </p>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                  Learn More
                </Button>
              </div>
              
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
    </div>
  );
}