import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { 
  Shield, 
  Users, 
  Settings, 
  BarChart3, 
  Database, 
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Target,
  Plus,
  TrendingUp,
  MessageSquare,
  Eye,
  Lock
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'moderator': return 'Moderator';
      case 'ops_admin': return 'Operations Admin';
      case 'super_admin': return 'Super Admin';
      case 'head_admin': return 'Head Admin';
      default: return 'Administrator';
    }
  };

  const getAdminLevel = (role: string) => {
    switch (role) {
      case 'moderator': return 1;
      case 'ops_admin': return 2;
      case 'super_admin': return 3;
      case 'head_admin': return 4;
      default: return 0;
    }
  };

  const adminLevel = getAdminLevel(user?.role || '');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Shield className="h-8 w-8 text-red-500 mr-3" />
          {getRoleDisplayName(user?.role || '')} Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Platform administration and oversight</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-white">12,847</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Pending Reports</p>
                <p className="text-2xl font-bold text-white">23</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">System Health</p>
                <p className="text-2xl font-bold text-white">98.5%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Revenue</p>
                <p className="text-2xl font-bold text-white">$284K</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card className="bg-navy-700 border-navy-600 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Administrative Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Basic Moderation (Level 1+) */}
                {adminLevel >= 1 && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Content Moderation</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Button className="bg-red-500 hover:bg-red-600 text-white justify-start">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Review Reports
                      </Button>
                      <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                        <Eye className="h-4 w-4 mr-2" />
                        Content Review
                      </Button>
                    </div>
                  </div>
                )}

                {/* Operations Management (Level 2+) */}
                {adminLevel >= 2 && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Operations Management</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Link href="/admin/panel">
                        <Button className="w-full bg-red-500 hover:bg-red-600 text-white justify-start">
                          <Settings className="h-4 w-4 mr-2" />
                          Admin Panel
                        </Button>
                      </Link>
                      <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Platform Analytics
                      </Button>
                    </div>
                  </div>
                )}

                {/* Full Platform Control (Level 3+) */}
                {adminLevel >= 3 && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Platform Control</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                        <Database className="h-4 w-4 mr-2" />
                        System Settings
                      </Button>
                      <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                        <Lock className="h-4 w-4 mr-2" />
                        Security Center
                      </Button>
                    </div>
                  </div>
                )}

                {/* User Management (Level 4 only) */}
                {adminLevel >= 4 && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Ultimate Authority</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Button variant="outline" className="border-red-500 text-red-400 justify-start">
                        <Users className="h-4 w-4 mr-2" />
                        Manage Admins
                      </Button>
                      <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                        <Shield className="h-4 w-4 mr-2" />
                        Global Permissions
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Recent Admin Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-navy-600 rounded-lg">
                  <p className="text-white text-sm">User report resolved: Spam content removed</p>
                  <p className="text-gray-400 text-xs mt-1">2 hours ago</p>
                </div>
                <div className="p-3 bg-navy-600 rounded-lg">
                  <p className="text-white text-sm">New contractor verification approved</p>
                  <p className="text-gray-400 text-xs mt-1">5 hours ago</p>
                </div>
                <div className="p-3 bg-navy-600 rounded-lg">
                  <p className="text-white text-sm">System maintenance completed</p>
                  <p className="text-gray-400 text-xs mt-1">1 day ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Admin Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-white font-semibold">{getRoleDisplayName(user?.role || '')}</h3>
                <p className="text-gray-400 text-sm">Level {adminLevel} Access</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full bg-red-500 hover:bg-red-600 text-white justify-start">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Review Reports
                </Button>
                {adminLevel >= 2 && (
                  <Link href="/admin/panel">
                    <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Admin Panel
                    </Button>
                  </Link>
                )}
                <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Server Health</span>
                    <span className="text-white">98.5%</span>
                  </div>
                  <Progress value={98.5} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Database Performance</span>
                    <span className="text-white">95%</span>
                  </div>
                  <Progress value={95} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Active Sessions</span>
                    <span className="text-white">1,247</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">High report volume</p>
                    <p className="text-yellow-400 text-xs">23 pending reviews</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">System update available</p>
                    <p className="text-blue-400 text-xs">Security patches ready</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Administrative Tools */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Administrative Tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/admin/panel">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-red-500 flex flex-col items-center justify-center space-y-1">
              <Settings className="h-5 w-5 text-red-400" />
              <span className="text-xs">Admin Panel</span>
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-red-500 flex flex-col items-center justify-center space-y-1">
              <Users className="h-5 w-5 text-blue-400" />
              <span className="text-xs">User Management</span>
            </Button>
          </Link>
          <Link href="/admin/analytics">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-red-500 flex flex-col items-center justify-center space-y-1">
              <BarChart3 className="h-5 w-5 text-green-400" />
              <span className="text-xs">Analytics</span>
            </Button>
          </Link>
          <Link href="/admin/monitoring">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-red-500 flex flex-col items-center justify-center space-y-1">
              <Eye className="h-5 w-5 text-purple-400" />
              <span className="text-xs">Monitoring</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}