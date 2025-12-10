import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Headphones, 
  Users, 
  FileText, 
  BarChart3, 
  Shield, 
  Calendar,
  CheckCircle,
  AlertTriangle,
  Target,
  Plus,
  TrendingUp,
  MessageSquare,
  Settings
} from "lucide-react";

export default function StaffDashboard() {
  const { user } = useAuth();

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'support_agent': return 'Support Agent';
      case 'content_moderator': return 'Content Moderator';
      case 'territory_manager': return 'Territory Manager';
      case 'contractor_success': return 'Contractor Success';
      case 'content_seo': return 'Content & SEO';
      case 'analytics_specialist': return 'Analytics Specialist';
      case 'marketing_specialist': return 'Marketing Specialist';
      default: return 'Staff Member';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'support_agent': return Headphones;
      case 'content_moderator': return Shield;
      case 'territory_manager': return Users;
      case 'contractor_success': return Target;
      case 'content_seo': return FileText;
      case 'analytics_specialist': return BarChart3;
      case 'marketing_specialist': return TrendingUp;
      default: return Settings;
    }
  };

  const RoleIcon = getRoleIcon(user?.role || '');

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <RoleIcon className="h-8 w-8 text-teal-500 mr-3" />
          {getRoleDisplayName(user?.role || '')} Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Platform operations and team collaboration</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Today's Tasks</p>
                <p className="text-2xl font-bold text-white">8</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Tickets</p>
                <p className="text-2xl font-bold text-white">23</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Response Time</p>
                <p className="text-2xl font-bold text-white">2.3h</p>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Team Rating</p>
                <p className="text-2xl font-bold text-white">4.9</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <RoleIcon className="h-5 w-5 mr-2" />
                Role-Specific Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {user?.role === 'support_agent' && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Support Tools</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Button className="bg-teal-500 hover:bg-teal-600 text-white justify-start">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Ticket Queue
                      </Button>
                      <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                        <Users className="h-4 w-4 mr-2" />
                        User Lookup
                      </Button>
                    </div>
                  </div>
                )}
                
                {user?.role === 'content_moderator' && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Moderation Tools</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Button className="bg-teal-500 hover:bg-teal-600 text-white justify-start">
                        <Shield className="h-4 w-4 mr-2" />
                        Review Queue
                      </Button>
                      <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Flagged Content
                      </Button>
                    </div>
                  </div>
                )}

                {user?.role === 'analytics_specialist' && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Analytics Tools</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Button className="bg-teal-500 hover:bg-teal-600 text-white justify-start">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Platform Analytics
                      </Button>
                      <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Performance Reports
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-white font-semibold mb-3">General Staff Tools</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Documentation
                    </Button>
                    <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                      <Calendar className="h-4 w-4 mr-2" />
                      Team Calendar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full bg-teal-500 hover:bg-teal-600 text-white justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
                <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Team Chat
                </Button>
                <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Knowledge Base
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Tasks Completed</span>
                    <span className="text-white">85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Quality Score</span>
                    <span className="text-white">92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Response Time</span>
                    <span className="text-white">Good</span>
                  </div>
                  <Progress value={78} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Team Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="text-white">Weekly team meeting</p>
                  <p className="text-gray-400 text-xs">Tomorrow at 10:00 AM</p>
                </div>
                <div className="text-sm">
                  <p className="text-white">New platform features</p>
                  <p className="text-gray-400 text-xs">Training scheduled for Friday</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Staff Navigation */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Staff Resources</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-teal-500 flex flex-col items-center justify-center space-y-1">
            <FileText className="h-5 w-5 text-teal-400" />
            <span className="text-xs">Documentation</span>
          </Button>
          <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-teal-500 flex flex-col items-center justify-center space-y-1">
            <Calendar className="h-5 w-5 text-green-400" />
            <span className="text-xs">Schedule</span>
          </Button>
          <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-teal-500 flex flex-col items-center justify-center space-y-1">
            <MessageSquare className="h-5 w-5 text-blue-400" />
            <span className="text-xs">Team Chat</span>
          </Button>
          <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-teal-500 flex flex-col items-center justify-center space-y-1">
            <BarChart3 className="h-5 w-5 text-orange-400" />
            <span className="text-xs">Reports</span>
          </Button>
        </div>
      </div>
    </div>
  );
}