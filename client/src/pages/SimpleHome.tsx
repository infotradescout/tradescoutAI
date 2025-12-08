import { memo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Home, Wrench, ShoppingCart, Building, Car, Shield, DollarSign, 
  TrendingUp, Clock, Star, Users, Package, MessageSquare, Heart,
  CheckCircle2, AlertCircle, Calendar, MapPin, Award, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface SimpleHomeDashboard {
  stats: {
    activeProjects: number;
    savedContractors: number;
    marketplaceListings: number;
    realEstateListings: number;
    totalViews: number;
    notifications: number;
  };
  myProjects?: any[];
  myListings?: any[];
  quotes?: any[];
  conversations?: any[];
  recentActivity?: Array<{
    id: string;
    title: string;
    createdAt: string;
  }>;
}

const defaultDashboard: SimpleHomeDashboard = {
  stats: {
    activeProjects: 0,
    savedContractors: 0,
    marketplaceListings: 0,
    realEstateListings: 0,
    totalViews: 0,
    notifications: 0
  },
  myProjects: [],
  myListings: [],
  quotes: [],
  conversations: [],
  recentActivity: []
};

const SimpleHome = memo(function SimpleHome() {
  const { user } = useAuth();

  // Fetch user-specific dashboard data
  const { data: dashboardData = defaultDashboard, isLoading } = useQuery<SimpleHomeDashboard>({
    queryKey: ['/api/dashboard', user?.id],
    enabled: !!user?.id,
  });

  const stats = dashboardData.stats;

  // Determine dashboard sections based on user role
  const isContractor = user?.role === 'contractor_user' || user?.role === 'accelerator_member';
  const isRealtor = user?.role === 'realtor';
  const isCarSalesman = user?.role === 'car_salesman';
  const isInsuranceAgent = user?.role === 'insurance_agent';
  const isMortgageBroker = user?.role === 'mortgage_broker';
  const isPropertyManager = user?.role === 'property_manager';
  const isHelper = user?.role === 'helper';
  const isProfessional = isContractor || isRealtor || isCarSalesman || isInsuranceAgent || isMortgageBroker || isPropertyManager;

  return (
    <div className="min-h-screen bg-[#0f1419] pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-orange-500 mb-2">
            Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'there'}
          </h1>
          <p className="text-slate-300 text-base">
            Your personalized dashboard
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {/* Stats based on user role */}
          {isContractor && (
            <>
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Wrench className="h-5 w-5 text-orange-500" />
                    <Badge variant="secondary" className="text-xs">{stats.activeProjects}</Badge>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {stats.activeProjects}
                  </div>
                  <p className="text-xs text-slate-200">Active Projects</p>
                </CardContent>
              </Card>
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <Badge variant="secondary" className="text-xs">4.8</Badge>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    4.8
                  </div>
                  <p className="text-xs text-slate-200">Average Rating</p>
                </CardContent>
              </Card>
            </>
          )}

          {isRealtor && (
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Building className="h-5 w-5 text-orange-500" />
                  <Badge variant="secondary" className="text-xs">{stats.realEstateListings}</Badge>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {stats.realEstateListings}
                </div>
                <p className="text-xs text-slate-200">Property Listings</p>
              </CardContent>
            </Card>
          )}

          {/* Universal stats for all users */}
          <Card className="bg-[#1a2332] border-[#2d3748]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Heart className="h-5 w-5 text-orange-500" />
                <Badge variant="secondary" className="text-xs">{stats.savedContractors}</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stats.savedContractors}
              </div>
              <p className="text-xs text-slate-200">Saved Items</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2332] border-[#2d3748]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="h-5 w-5 text-orange-500" />
                <Badge variant="secondary" className="text-xs">{stats.marketplaceListings}</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stats.marketplaceListings}
              </div>
              <p className="text-xs text-slate-200">My Listings</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2332] border-[#2d3748]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Eye className="h-5 w-5 text-orange-500" />
                <Badge variant="secondary" className="text-xs">New</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stats.totalViews}
              </div>
              <p className="text-xs text-slate-200">Profile Views</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid - Role-based content */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Left Column - Primary Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Contractor-specific sections */}
            {isContractor && (
              <>
                <Card className="bg-[#1a2332] border-[#2d3748]">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-orange-500" />
                      My Active Projects
                    </CardTitle>
                    <Link href="/contractor/projects">
                      <Button variant="ghost" size="sm">View All</Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {(dashboardData?.myProjects?.length ?? 0) > 0 ? (
                      <div className="space-y-3">
                        {dashboardData?.myProjects?.map((project: any) => (
                          <div key={project.id} className="flex items-center justify-between p-3 bg-[#1a2332]/80 rounded-lg">
                            <div>
                              <p className="font-medium text-white">{project.title}</p>
                              <p className="text-sm text-slate-200">{project.status}</p>
                            </div>
                            <Badge>{project.status}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Wrench className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-300 mb-4">No active projects yet</p>
                        <Link href="/contractor/leads">
                          <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                            Browse Project Requests
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Realtor-specific sections */}
            {isRealtor && (
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                    <Building className="h-5 w-5 text-orange-500" />
                    My Property Listings
                  </CardTitle>
                  <Link href="/exchange/real-estate/my-listings">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {(dashboardData?.myListings?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {dashboardData?.myListings?.map((listing: any) => (
                        <div key={listing.id} className="flex items-center justify-between p-3 bg-[#1a2332]/80 rounded-lg">
                          <div>
                            <p className="font-medium text-white">{listing.title}</p>
                            <p className="text-sm text-slate-200">${listing.price?.toLocaleString()}</p>
                          </div>
                          <Badge variant="secondary">{listing.views || 0} views</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Building className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-300 mb-4">No property listings yet</p>
                      <Link href="/exchange/real-estate/create">
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                          Create Listing
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Homeowner-specific sections */}
            {!isProfessional && (
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                    <Home className="h-5 w-5 text-orange-500" />
                    My Home Projects
                  </CardTitle>
                  <Link href="/request-quote">
                    <Button variant="ghost" size="sm">New Project</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {(dashboardData?.myProjects?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {dashboardData?.myProjects?.map((project: any) => (
                        <div key={project.id} className="flex items-center justify-between p-3 bg-[#1a2332]/80 rounded-lg">
                          <div>
                            <p className="font-medium text-white">{project.title}</p>
                            <p className="text-sm text-slate-200">{project.status}</p>
                          </div>
                          <Badge>{project.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Home className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-300 mb-4">No projects yet</p>
                      <Link href="/request-quote">
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                          Start Your First Project
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quotes & Estimates (contractor and homeowner) */}
            {((dashboardData?.quotes?.length ?? 0) > 0) && (
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-orange-500" />
                    {isContractor ? 'My Quotes' : 'Received Quotes'}
                  </CardTitle>
                  <Link href="/messages">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData?.quotes?.slice(0, 5).map((quote: any) => (
                      <div key={quote.id} className="flex items-center justify-between p-3 bg-[#1a2332]/80 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-white">{quote.title}</p>
                          <p className="text-sm text-slate-200">
                            ${Number(quote.totalCost).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={quote.status === 'accepted' ? 'default' : quote.status === 'sent' ? 'secondary' : 'outline'}>
                          {quote.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Conversations */}
            {((dashboardData?.conversations?.length ?? 0) > 0) && (
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-indigo-500" />
                    Active Conversations
                  </CardTitle>
                  <Link href="/messages">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData?.conversations?.slice(0, 5).map((conversation: any) => (
                      <Link key={conversation.id} href={`/messages/${conversation.id}`}>
                        <div className="flex items-center justify-between p-3 bg-[#1a2332]/80 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer">
                          <div className="flex-1">
                            <p className="font-medium text-white">
                              {conversation.projectType || 'Project Discussion'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">
                              {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                            {conversation.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Marketplace Listings (for anyone selling) */}
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                  My Marketplace Listings
                </CardTitle>
                <Link href="/marketplace/create">
                  <Button variant="ghost" size="sm">Create Listing</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {stats.marketplaceListings > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-200">
                      You have {stats.marketplaceListings} active listing{stats.marketplaceListings !== 1 ? 's' : ''}
                    </p>
                    <Link href="/marketplace/my-listings">
                      <Button size="sm" variant="outline" className="w-full">
                        Manage Listings
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-300 mb-4">No marketplace listings</p>
                    <Link href="/marketplace/create">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                        Create Your First Listing
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quick Actions & Widgets */}
          <div className="space-y-6">
            
            {/* Quick Actions */}
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardHeader>
                <CardTitle className="text-lg text-orange-500">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isContractor ? (
                  <>
                    <Link href="/contractor/leads">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full justify-start">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Find New Projects
                      </Button>
                    </Link>
                    <Link href="/contractor-profile">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full justify-start">
                        <Star className="h-4 w-4 mr-2" />
                        Update Profile
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/quote-calculator">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full justify-start">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Quote Calculator
                      </Button>
                    </Link>
                    <Link href="/find-contractors">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full justify-start">
                        <Wrench className="h-4 w-4 mr-2" />
                        Find Contractors
                      </Button>
                    </Link>
                    <Link href="/request-quote">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full justify-start">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Request Quote
                      </Button>
                    </Link>
                  </>
                )}
                <Link href="/marketplace">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full justify-start">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Browse Marketplace
                  </Button>
                </Link>
                <Link href="/community">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Community Feed
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Saved Contractors (for homeowners) */}
            {!isProfessional && (
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                    <Heart className="h-5 w-5 text-orange-500" />
                    Saved Contractors
                  </CardTitle>
                  <Link href="/saved-contractors">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {stats.savedContractors > 0 ? (
                    <p className="text-sm text-slate-200">
                      You have {stats.savedContractors} saved contractor{stats.savedContractors !== 1 ? 's' : ''}
                    </p>
                  ) : (
                    <div className="text-center py-6">
                      <Heart className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-200">No saved contractors yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardHeader>
                <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(dashboardData?.recentActivity?.length ?? 0) > 0 ? (
                  <div className="space-y-3">
                    {dashboardData?.recentActivity?.slice(0, 5).map((activity: any, idx: number) => (
                      <Link 
                        key={idx} 
                        href={`/community/post/${activity.id}`}
                        className="block text-sm hover:bg-[#0f1419] p-2 rounded transition-colors cursor-pointer"
                      >
                        <p className="text-white hover:text-orange-500 transition-colors">{activity.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Clock className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-200">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Community Preview Widget */}
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-orange-500 flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  Community
                </CardTitle>
                <Link href="/community">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300 mb-3">
                  See what's happening in your neighborhood
                </p>
                <Link href="/community">
                  <Button size="sm" variant="outline" className="w-full">
                    Go to Community Feed
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SimpleHome;
