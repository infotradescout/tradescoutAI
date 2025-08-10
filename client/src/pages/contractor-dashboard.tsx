import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Eye, 
  Star, 
  Clock, 
  TrendingUp, 
  Edit, 
  Camera, 
  ThumbsUp,
  CheckCircle,
  Shield,
  Calendar,
  Phone,
  Mail,
  ArrowRight,
  Settings
} from "lucide-react";

interface DashboardData {
  contractor: any;
  leads: any[];
  recommendations: any[];
  stats: {
    totalLeads: number;
    newLeads: number;
    ratingSummary: {
      count: number;
      average: number;
    };
  };
}

export default function ContractorDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/contractor/dashboard"],
    enabled: isAuthenticated,
    retry: false,
  });

  const leadActionMutation = useMutation({
    mutationFn: async ({ leadId, action }: { leadId: string; action: 'accept' | 'decline' }) => {
      return apiRequest('PUT', `/api/leads/${leadId}`, { 
        status: action === 'accept' ? 'accepted' : 'declined' 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/dashboard"] });
      toast({
        title: "Success",
        description: "Lead status updated successfully.",
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
        description: "Failed to update lead status. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">
              {isUnauthorizedError(error) 
                ? "Please log in to access your dashboard."
                : "Failed to load dashboard data. Please try again later."
              }
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Contractor Profile Found</h3>
            <p className="text-gray-400 mb-6">
              You need to create a contractor profile to access the dashboard.
            </p>
            <Button className="bg-orange-500 hover:bg-orange-600">
              Create Contractor Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contractor, leads, recommendations, stats } = dashboardData;
  const companyInitials = contractor?.companyName?.split(' ').map((word: string) => word[0]).join('').slice(0, 2).toUpperCase() || 'CC';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Dashboard Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {contractor?.companyName || 'Contractor'}
          </h1>
          <p className="text-gray-300">Here's what's happening with your business</p>
        </div>
        <div className="flex space-x-4 mt-4 lg:mt-0">
          <Button variant="outline" className="border-navy-600 text-white hover:bg-navy-600">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 glow-effect">
            <TrendingUp className="h-4 w-4 mr-2" />
            Upgrade to Accelerator
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">New Leads</p>
                <p className="text-2xl font-bold text-white">{stats?.newLeads || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <p className="text-green-400 text-sm mt-2">
              {stats?.newLeads > 3 ? '+' : ''}
              {Math.max(0, (stats?.newLeads || 0) - 3)} from last week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Leads</p>
                <p className="text-2xl font-bold text-white">{stats?.totalLeads || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Eye className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-2">All time</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Rating</p>
                <p className="text-2xl font-bold text-white">
                  {stats?.ratingSummary?.average?.toFixed(1) || '0.0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              {stats?.ratingSummary?.count || 0} reviews
            </p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Response Rate</p>
                <p className="text-2xl font-bold text-white">
                  {leads?.length > 0 ? Math.round((leads.filter(l => l.status !== 'new').length / leads.length) * 100) : 0}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <p className="text-green-400 text-sm mt-2">
              Avg {contractor?.responseTimeSla || 2} hrs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="leads" className="space-y-6">
        <TabsList className="bg-navy-700 border-navy-600">
          <TabsTrigger value="leads" className="data-[state=active]:bg-orange-500">
            Leads ({stats?.newLeads || 0})
          </TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-orange-500">
            Profile
          </TabsTrigger>
          <TabsTrigger value="reviews" className="data-[state=active]:bg-orange-500">
            Reviews ({stats?.ratingSummary?.count || 0})
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-orange-500">
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="bg-navy-700 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    Recent Leads
                    <Badge variant="secondary">{leads?.length || 0} total</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {leads && leads.length > 0 ? (
                    <div className="space-y-4">
                      {leads.slice(0, 5).map((lead: any) => (
                        <Card key={lead.id} className="bg-navy-600 border-navy-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="text-white font-semibold">{lead.projectType}</h4>
                                <p className="text-gray-300 text-sm">
                                  {lead.description?.slice(0, 100) || 'No description provided'}
                                  {lead.description?.length > 100 && '...'}
                                </p>
                              </div>
                              <Badge 
                                className={
                                  lead.status === 'new' ? 'bg-orange-500/20 text-orange-400' :
                                  lead.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }
                              >
                                {lead.status}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">
                                {new Date(lead.createdAt).toLocaleDateString()}
                              </span>
                              
                              {lead.status === 'new' && (
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    onClick={() => leadActionMutation.mutate({ leadId: lead.id, action: 'accept' })}
                                    disabled={leadActionMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => leadActionMutation.mutate({ leadId: lead.id, action: 'decline' })}
                                    disabled={leadActionMutation.isPending}
                                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                                  >
                                    Decline
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">No leads yet</h3>
                      <p className="text-gray-400">New leads will appear here when homeowners contact you.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Verification Status */}
              <Card className="bg-navy-700 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Verification Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">License</span>
                    <Badge className={contractor?.verifiedLicensed ? "bg-green-600" : "bg-yellow-600"}>
                      {contractor?.verifiedLicensed ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </>
                      ) : (
                        'Pending'
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Insurance</span>
                    <Badge className={contractor?.verifiedInsured ? "bg-green-600" : "bg-yellow-600"}>
                      {contractor?.verifiedInsured ? (
                        <>
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </>
                      ) : (
                        'Pending'
                      )}
                    </Badge>
                  </div>
                  {contractor?.lastVerified && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Next Review</span>
                      <span className="text-gray-400 text-sm">
                        {new Date(new Date(contractor.lastVerified).getTime() + 6 * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-navy-700 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start border-navy-500 hover:bg-navy-600">
                    <Edit className="h-4 w-4 mr-2 text-orange-500" />
                    Update Profile
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-navy-500 hover:bg-navy-600">
                    <Camera className="h-4 w-4 mr-2 text-orange-500" />
                    Add Photos
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-navy-500 hover:bg-navy-600">
                    <ThumbsUp className="h-4 w-4 mr-2 text-orange-500" />
                    Request Reviews
                  </Button>
                </CardContent>
              </Card>

              {/* Accelerator Upgrade */}
              <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Unlock More Leads</h3>
                  <p className="text-gray-300 text-sm mb-4">
                    Join Accelerator for priority lead access and advanced tools.
                  </p>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 glow-effect">
                    Learn More
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Company Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Company Name</label>
                        <p className="text-white">{contractor?.companyName || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Years in Business</label>
                        <p className="text-white">{contractor?.yearsInBusiness || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Phone</label>
                        <p className="text-white">{contractor?.phone || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Email</label>
                        <p className="text-white">{contractor?.email || 'Not set'}</p>
                      </div>
                    </div>
                  </div>

                  {/* About */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">About Your Business</h3>
                    <p className="text-gray-300">
                      {contractor?.about || 'Add a description of your business to help homeowners understand your services and expertise.'}
                    </p>
                  </div>

                  <Button className="bg-orange-500 hover:bg-orange-600">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>

                <div>
                  {/* Profile Picture */}
                  <div className="text-center mb-6">
                    <div className="w-24 h-24 bg-orange-500 rounded-xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                      {companyInitials}
                    </div>
                    <Button variant="outline" size="sm" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                      <Camera className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>

                  {/* Contact Actions */}
                  <div className="space-y-2">
                    {contractor?.phone && (
                      <Button variant="outline" className="w-full justify-start border-navy-500">
                        <Phone className="h-4 w-4 mr-2" />
                        {contractor.phone}
                      </Button>
                    )}
                    {contractor?.email && (
                      <Button variant="outline" className="w-full justify-start border-navy-500">
                        <Mail className="h-4 w-4 mr-2" />
                        {contractor.email}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Customer Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations && recommendations.length > 0 ? (
                <div className="space-y-6">
                  {recommendations.map((review: any) => (
                    <div key={review.id} className="border-b border-navy-600 pb-6 last:border-b-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex text-yellow-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-current' : ''}`} />
                          ))}
                        </div>
                        <span className="text-gray-400 text-sm">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-gray-300">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No reviews yet</h3>
                  <p className="text-gray-400 mb-6">
                    Customer reviews will appear here once you complete projects.
                  </p>
                  <Button className="bg-orange-500 hover:bg-orange-600">
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Request Reviews
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-navy-700 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Lead Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Leads</span>
                    <span className="text-white font-semibold">{stats?.totalLeads || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Response Rate</span>
                    <span className="text-white font-semibold">
                      {leads?.length > 0 ? Math.round((leads.filter(l => l.status !== 'new').length / leads.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg. Response Time</span>
                    <span className="text-white font-semibold">{contractor?.responseTimeSla || 2} hours</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-navy-700 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Customer Satisfaction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Average Rating</span>
                    <span className="text-white font-semibold">
                      {stats?.ratingSummary?.average?.toFixed(1) || '0.0'}/5.0
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Reviews</span>
                    <span className="text-white font-semibold">{stats?.ratingSummary?.count || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Recommendation Rate</span>
                    <span className="text-white font-semibold">
                      {stats?.ratingSummary?.count > 0 ? Math.round((stats.ratingSummary.average / 5) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
