import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Briefcase, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Phone, 
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Target,
  Building,
  Plus,
  BarChart3,
  Store
} from "lucide-react";

export default function BusinessOwnerDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Store className="h-8 w-8 text-purple-500 mr-3" />
          Business Owner Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Manage your business operations and growth initiatives</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Monthly Revenue</p>
                <p className="text-2xl font-bold text-white">$45,250</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Projects</p>
                <p className="text-2xl font-bold text-white">12</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Team Members</p>
                <p className="text-2xl font-bold text-white">28</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Growth Rate</p>
                <p className="text-2xl font-bold text-white">+15.3%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
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
                <BarChart3 className="h-5 w-5 mr-2" />
                Business Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-white font-semibold mb-3">Find Business Services</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button className="bg-purple-500 hover:bg-purple-600 text-white justify-start">
                      <Building className="h-4 w-4 mr-2" />
                      Find Contractors
                    </Button>
                    <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Business Services
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-white font-semibold mb-3">Business Tools</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Project Calculator
                    </Button>
                    <Button variant="outline" className="border-navy-400 text-gray-300 justify-start">
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Management
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
                <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
                <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Hire Services
                </Button>
                <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}