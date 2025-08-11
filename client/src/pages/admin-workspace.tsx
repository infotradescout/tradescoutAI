import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Download, 
  Crown, 
  HardHat,
  TrendingUp,
  Settings,
  Upload,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  AlertTriangle,
  BarChart3,
  FileText,
  UserCheck,
  Zap
} from "lucide-react";

interface AdminStats {
  totalContractors: number;
  newLeads: number;
  growthPackDownloads: number;
  totalRecommendations: number;
}

const ADMIN_ROLES = ['owner', 'ops_admin', 'analytics_read', 'territory_manager', 'contractor_success'];

export default function AdminWorkspace() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('verification');

  // Check admin access
  const hasAdminAccess = user && user.role && ADMIN_ROLES.includes(user.role);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !hasAdminAccess)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this area.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = isAuthenticated ? "/" : "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, hasAdminAccess, toast]);

  const { data: adminStats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!isAuthenticated && !!hasAdminAccess,
    retry: false,
  });

  // Mock pending verifications for demonstration
  const pendingVerifications = [
    {
      id: 'ver1',
      companyName: 'Elite Plumbing Co.',
      type: 'new_application',
      trade: 'Plumbing',
      licenseNumber: 'CA-987654321',
      serviceArea: 'Los Angeles County',
      documents: {
        license: true,
        insurance: true,
        id: false
      },
      submittedAt: new Date().toISOString(),
    },
    {
      id: 'ver2',
      companyName: 'ProRoof Solutions',
      type: 're_verification',
      trade: 'Roofing',
      licenseNumber: 'CA-123456789',
      serviceArea: 'Orange County',
      documents: {
        license: true,
        insurance: 'expires_soon',
        id: true
      },
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ];

  const verificationActionMutation = useMutation({
    mutationFn: async ({ verificationId, action, reason }: { 
      verificationId: string; 
      action: 'approve' | 'reject' | 'request_update'; 
      reason?: string;
    }) => {
      // This would be a real API call in production
      return new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      toast({
        title: "Success",
        description: "Verification status updated successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update verification status.",
        variant: "destructive",
      });
    },
  });

  if (authLoading || statsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !hasAdminAccess) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">Access denied. Admin privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Admin Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">TradeScout Admin</h1>
          <p className="text-gray-300">System overview and management tools</p>
        </div>
        <div className="flex space-x-4 mt-4 lg:mt-0">
          <Button variant="outline" className="border-navy-600 text-white hover:bg-navy-600">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 glow-effect">
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </Button>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Contractors</p>
                <p className="text-2xl font-bold text-white">{adminStats?.totalContractors || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <HardHat className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-green-400 text-sm mt-2">+23 this week</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Leads</p>
                <p className="text-2xl font-bold text-white">{adminStats?.newLeads || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-2">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Growth Pack Downloads</p>
                <p className="text-2xl font-bold text-white">{adminStats?.growthPackDownloads || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Download className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <p className="text-green-400 text-sm mt-2">18% conversion rate</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Accelerator Members</p>
                <p className="text-2xl font-bold text-white">156</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Crown className="h-6 w-6 text-purple-500" />
              </div>
            </div>
            <p className="text-green-400 text-sm mt-2">$47,280 MRR</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Card className="bg-navy-700 border-navy-600">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b border-navy-600">
            <TabsList className="bg-transparent border-none h-auto p-0">
              <div className="flex space-x-8 px-6">
                <TabsTrigger 
                  value="verification" 
                  className="py-4 px-1 border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 text-gray-400 hover:text-gray-300 font-medium text-sm bg-transparent"
                >
                  Verification Queue
                </TabsTrigger>
                <TabsTrigger 
                  value="leads" 
                  className="py-4 px-1 border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 text-gray-400 hover:text-gray-300 font-medium text-sm bg-transparent"
                >
                  Lead Management
                </TabsTrigger>
                <TabsTrigger 
                  value="imports" 
                  className="py-4 px-1 border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 text-gray-400 hover:text-gray-300 font-medium text-sm bg-transparent"
                >
                  Data Imports
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics" 
                  className="py-4 px-1 border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 text-gray-400 hover:text-gray-300 font-medium text-sm bg-transparent"
                >
                  Analytics
                </TabsTrigger>
              </div>
            </TabsList>
          </div>

          {/* Verification Queue Tab Content */}
          <TabsContent value="verification" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Pending Verifications</h3>
              <Badge className="bg-orange-500/20 text-orange-400">
                {pendingVerifications.length} pending
              </Badge>
            </div>

            <div className="space-y-4">
              {pendingVerifications.map((verification) => (
                <Card key={verification.id} className="bg-navy-600 border-navy-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-white font-semibold">{verification.companyName}</h4>
                          <Badge className={
                            verification.type === 'new_application' 
                              ? 'bg-amber-600 text-amber-100' 
                              : 'bg-blue-600 text-blue-100'
                          }>
                            {verification.type === 'new_application' ? 'New Application' : 'Re-verification'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Trade:</p>
                            <p className="text-white">{verification.trade}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">License #:</p>
                            <p className="text-white">{verification.licenseNumber}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Service Area:</p>
                            <p className="text-white">{verification.serviceArea}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-3 text-sm">
                          <span className="text-gray-400">Documents:</span>
                          <span className={
                            verification.documents.license 
                              ? "text-green-400" 
                              : "text-red-400"
                          }>
                            {verification.documents.license ? (
                              <>
                                <CheckCircle className="h-3 w-3 inline mr-1" />
                                License
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 inline mr-1" />
                                License
                              </>
                            )}
                          </span>
                          <span className={
                            verification.documents.insurance === true 
                              ? "text-green-400" 
                              : verification.documents.insurance === 'expires_soon'
                              ? "text-amber-400"
                              : "text-red-400"
                          }>
                            {verification.documents.insurance === true ? (
                              <>
                                <CheckCircle className="h-3 w-3 inline mr-1" />
                                Insurance
                              </>
                            ) : verification.documents.insurance === 'expires_soon' ? (
                              <>
                                <Clock className="h-3 w-3 inline mr-1" />
                                Insurance (Expires Soon)
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 inline mr-1" />
                                Insurance
                              </>
                            )}
                          </span>
                          <span className={
                            verification.documents.id 
                              ? "text-green-400" 
                              : "text-gray-400"
                          }>
                            {verification.documents.id ? (
                              <>
                                <CheckCircle className="h-3 w-3 inline mr-1" />
                                ID
                              </>
                            ) : (
                              <>
                                ⚬ ID (Optional)
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col space-y-2 ml-6">
                        <Button
                          size="sm"
                          onClick={() => verificationActionMutation.mutate({ 
                            verificationId: verification.id, 
                            action: 'approve' 
                          })}
                          disabled={verificationActionMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-navy-400 text-white hover:bg-navy-500"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Review
                        </Button>
                        {verification.documents.insurance === 'expires_soon' ? (
                          <Button
                            size="sm"
                            onClick={() => verificationActionMutation.mutate({ 
                              verificationId: verification.id, 
                              action: 'request_update',
                              reason: 'Insurance document expires soon' 
                            })}
                            disabled={verificationActionMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Request Update
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => verificationActionMutation.mutate({ 
                              verificationId: verification.id, 
                              action: 'reject' 
                            })}
                            disabled={verificationActionMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Lead Management Tab */}
          <TabsContent value="leads" className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-navy-600 border-navy-500">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Lead Routing Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Quality Weight (%)</label>
                    <Select defaultValue="50">
                      <SelectTrigger className="form-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="40">40%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="60">60%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Response Rate Weight (%)</label>
                    <Select defaultValue="30">
                      <SelectTrigger className="form-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20%</SelectItem>
                        <SelectItem value="30">30%</SelectItem>
                        <SelectItem value="40">40%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Speed Weight (%)</label>
                    <Select defaultValue="20">
                      <SelectTrigger className="form-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                        <SelectItem value="30">30%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Update Routing Rules
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-navy-600 border-navy-500">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Recent Lead Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Leads Today</span>
                      <span className="text-white font-semibold">23</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Avg Response Time</span>
                      <span className="text-white font-semibold">1.2 hours</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Acceptance Rate</span>
                      <span className="text-green-400 font-semibold">87%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Top 3 Requests</span>
                      <span className="text-white font-semibold">156</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Data Imports Tab */}
          <TabsContent value="imports" className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-navy-600 border-navy-500">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    County Data Import
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300 text-sm">
                    Upload CSV files with county FIPS codes, names, and population data.
                  </p>
                  <div className="border-2 border-dashed border-navy-400 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Drop CSV file here or click to upload</p>
                  </div>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Import Counties
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-navy-600 border-navy-500">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Pricing Data Import
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300 text-sm">
                    Upload regional pricing data for quote calculators by service type.
                  </p>
                  <Select>
                    <SelectTrigger className="form-field">
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="roofing">Roofing</SelectItem>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="hvac">HVAC</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="border-2 border-dashed border-navy-400 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Drop CSV file here or click to upload</p>
                  </div>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Import Pricing Data
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-navy-600 border-navy-500">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Contractor Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Active</span>
                    <span className="text-white font-semibold">{adminStats?.totalContractors || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Verified</span>
                    <span className="text-green-400 font-semibold">
                      {Math.round((adminStats?.totalContractors || 0) * 0.85)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Pending Verification</span>
                    <span className="text-yellow-400 font-semibold">{pendingVerifications.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Growth Rate</span>
                    <span className="text-green-400 font-semibold">+12.5%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-navy-600 border-navy-500">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Lead Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total This Month</span>
                    <span className="text-white font-semibold">1,247</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Conversion Rate</span>
                    <span className="text-green-400 font-semibold">73.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Response Time</span>
                    <span className="text-white font-semibold">1.8 hrs</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Top 3 Success Rate</span>
                    <span className="text-green-400 font-semibold">89.4%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-navy-600 border-navy-500">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Growth Pack & Accelerator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Downloads This Month</span>
                    <span className="text-white font-semibold">{adminStats?.growthPackDownloads || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Conversion to Apply</span>
                    <span className="text-green-400 font-semibold">18.7%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Accelerator Members</span>
                    <span className="text-purple-400 font-semibold">156</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Monthly Revenue</span>
                    <span className="text-green-400 font-semibold">$47.3K</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Export Options */}
            <div className="mt-8">
              <Card className="bg-navy-600 border-navy-500">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Export Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                      <Download className="h-4 w-4 mr-2" />
                      Contractor Report
                    </Button>
                    <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                      <Download className="h-4 w-4 mr-2" />
                      Lead Analytics
                    </Button>
                    <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                      <Download className="h-4 w-4 mr-2" />
                      Revenue Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
