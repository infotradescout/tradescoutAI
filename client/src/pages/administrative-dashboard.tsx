import { memo } from 'react';
import { Shield, Users, FileText, BarChart3, Settings, AlertTriangle, CheckCircle, Clock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const AdministrativeDashboard = memo(function AdministrativeDashboard() {
  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Administrative Dashboard</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Platform oversight and management controls
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Platform Health</p>
                  <p className="text-2xl font-bold text-green-400">98.5%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Active Users</p>
                  <p className="text-2xl font-bold text-white">87,420</p>
                </div>
                <Users className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Pending Reviews</p>
                  <p className="text-2xl font-bold text-yellow-400">234</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">System Alerts</p>
                  <p className="text-2xl font-bold text-red-400">3</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* User Management */}
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-navy-700/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Total Registered Users</p>
                    <p className="text-gray-400 text-sm">All time platform users</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">125,847</p>
                    <p className="text-green-400 text-xs">↑ 12% this month</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { role: "Homeowners", count: 78420, percentage: 62 },
                    { role: "Contractors", count: 28500, percentage: 23 },
                    { role: "Helpers", count: 15200, percentage: 12 },
                    { role: "Realtors", count: 3727, percentage: 3 }
                  ].map((role, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">{role.role}</span>
                        <span className="text-white">{role.count.toLocaleString()}</span>
                      </div>
                      <Progress value={role.percentage} className="h-2" />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
                    Manage Users
                  </Button>
                  <Button variant="outline" className="flex-1 border-orange-600 text-orange-400 hover:bg-orange-600/20">
                    Export Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Monitoring */}
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                System Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { metric: "Server Response Time", value: "145ms", status: "good", target: "< 200ms" },
                  { metric: "Database Performance", value: "98.2%", status: "excellent", target: "> 95%" },
                  { metric: "Storage Usage", value: "67%", status: "good", target: "< 80%" },
                  { metric: "API Availability", value: "99.9%", status: "excellent", target: "> 99%" },
                ].map((metric, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-navy-700/50 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">{metric.metric}</p>
                      <p className="text-gray-400 text-xs">Target: {metric.target}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{metric.value}</p>
                      <Badge variant={
                        metric.status === 'excellent' ? 'default' :
                        metric.status === 'good' ? 'secondary' : 'destructive'
                      } className="text-xs">
                        {metric.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full mt-4 bg-orange-600 hover:bg-orange-700">
                View Detailed Analytics
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Admin Actions */}
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Recent Admin Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { action: "User verification approved", user: "Johnson Construction", time: "2 hours ago", admin: "Sarah Admin" },
                  { action: "Content moderation review", user: "Community Post #2847", time: "4 hours ago", admin: "Mike Moderator" },
                  { action: "Payment dispute resolved", user: "HomeRepair Pro", time: "6 hours ago", admin: "Lisa Admin" },
                  { action: "New contractor application", user: "Elite Landscaping", time: "8 hours ago", admin: "Auto-System" },
                  { action: "Error report investigated", user: "Bug Report #1205", time: "1 day ago", admin: "Tech Support" },
                ].map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-navy-700/50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <div className="flex-1">
                      <p className="text-white text-sm">{activity.action}</p>
                      <p className="text-gray-400 text-xs">
                        {activity.user} • by {activity.admin}
                      </p>
                    </div>
                    <div className="text-gray-400 text-xs">{activity.time}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Alerts */}
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                System Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { 
                    type: "warning", 
                    title: "High Storage Usage", 
                    message: "Database storage is at 78% capacity", 
                    time: "30 min ago",
                    action: "Review cleanup policies"
                  },
                  { 
                    type: "info", 
                    title: "Scheduled Maintenance", 
                    message: "Database backup scheduled for 2:00 AM", 
                    time: "2 hours ago",
                    action: "Monitor progress"
                  },
                  { 
                    type: "success", 
                    title: "Security Scan Complete", 
                    message: "Weekly security scan completed successfully", 
                    time: "1 day ago",
                    action: "View report"
                  }
                ].map((alert, index) => (
                  <div key={index} className="p-4 bg-navy-700/50 rounded-lg border-l-4 border-l-orange-400">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white font-medium text-sm">{alert.title}</h4>
                      <Badge variant={
                        alert.type === 'warning' ? 'destructive' :
                        alert.type === 'success' ? 'default' : 'secondary'
                      } className="text-xs">
                        {alert.type}
                      </Badge>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{alert.message}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-xs">{alert.time}</span>
                      <Button size="sm" variant="outline" className="text-xs">
                        {alert.action}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Administrative Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700">
                <FileText className="h-6 w-6" />
                Generate Reports
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-green-600 hover:bg-green-700">
                <Users className="h-6 w-6" />
                User Management
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700">
                <BarChart3 className="h-6 w-6" />
                System Analytics
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700">
                <Settings className="h-6 w-6" />
                Platform Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default AdministrativeDashboard;