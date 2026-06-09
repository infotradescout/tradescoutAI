import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Wrench,
  ShoppingCart,
  Building,
  Car,
  Shield,
  DollarSign,
  TrendingUp,
  Clock,
  ShieldCheck,
  Users,
  Package,
  MessageSquare,
  Heart,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Award,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { Page, Section } from "@/components/layout/PagePrimitives";

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
    notifications: 0,
  },
  myProjects: [],
  myListings: [],
  quotes: [],
  conversations: [],
  recentActivity: [],
};

const SimpleHome = memo(function SimpleHome() {
  const { user } = useAuth();

  // Fetch user-specific dashboard data
  const { data: dashboardData = defaultDashboard, isLoading } = useQuery<SimpleHomeDashboard>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user?.id,
  });

  const stats = dashboardData.stats;

  // Determine dashboard sections based on user role
  const isContractor = user?.role === "contractor_user" || user?.role === "accelerator_member";
  const isRealtor = user?.role === "realtor";
  const isCarSalesman = user?.role === "car_salesman";
  const isInsuranceAgent = user?.role === "insurance_agent";
  const isMortgageBroker = user?.role === "mortgage_broker";
  const isPropertyManager = user?.role === "property_manager";
  const isHelper = user?.role === "helper";
  const isProfessional =
    isContractor ||
    isRealtor ||
    isCarSalesman ||
    isInsuranceAgent ||
    isMortgageBroker ||
    isPropertyManager;

  return (
    <Page className="max-w-7xl pb-20 lg:pb-0">
      <Section
        title={`Welcome back, ${user?.firstName || user?.email?.split("@")[0] || "there"}`}
        subtitle="Your personalized dashboard"
      >
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {/* Stats based on user role */}
          {isContractor && (
            <>
              <Card className="bg-tsCard border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Wrench className="h-5 w-5 text-ts-orange" />
                    <Badge variant="secondary" className="text-xs">
                      {stats.activeProjects}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{stats.activeProjects}</div>
                  <p className="text-xs text-white/70">Active Projects</p>
                </CardContent>
              </Card>
              <Card className="bg-tsCard border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <ShieldCheck className="h-5 w-5 text-ts-orange" />
                    <Badge variant="secondary" className="text-xs">
                      {typeof (user as any)?.cvsScore === "number"
                        ? Math.round((user as any).cvsScore)
                        : "—"}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {typeof (user as any)?.cvsScore === "number"
                      ? Math.round((user as any).cvsScore)
                      : "—"}
                  </div>
                  <p className="text-xs text-white/70">Trust (CVS)</p>
                </CardContent>
              </Card>
            </>
          )}

          {isRealtor && (
            <Card className="bg-tsCard border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Building className="h-5 w-5 text-ts-orange" />
                  <Badge variant="secondary" className="text-xs">
                    {stats.realEstateListings}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{stats.realEstateListings}</div>
                <p className="text-xs text-white/70">HomeScout Listings</p>
              </CardContent>
            </Card>
          )}

          {/* Universal stats for all users */}
          <Card className="bg-tsCard border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Heart className="h-5 w-5 text-ts-orange" />
                <Badge variant="secondary" className="text-xs">
                  {stats.savedContractors}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stats.savedContractors}</div>
              <p className="text-xs text-white/70">Saved Items</p>
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="h-5 w-5 text-ts-orange" />
                <Badge variant="secondary" className="text-xs">
                  {stats.marketplaceListings}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stats.marketplaceListings}</div>
              <p className="text-xs text-white/70">My Listings</p>
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Eye className="h-5 w-5 text-ts-orange" />
                <Badge variant="secondary" className="text-xs">
                  New
                </Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stats.totalViews}</div>
              <p className="text-xs text-white/70">Profile Views</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid - Role-based content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Primary Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contractor-specific sections */}
            {isContractor && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-ts-orange" />
                    My Active Projects
                  </CardTitle>
                  <Link href="/project-tracker">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {(dashboardData?.myProjects?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.myProjects!.map((project: any) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 bg-tsCard/80 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-white">{project.title}</p>
                            <p className="text-sm text-white/70">{project.status}</p>
                          </div>
                          <Badge>{project.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Wrench className="h-12 w-12 text-white/70 dark:text-white/60 mx-auto mb-3" />
                      <p className="text-white/70 mb-4">No active projects yet</p>
                      <Link href="/business/requests">
                        <Button size="sm" className="bg-ts-orange-dark hover:bg-ts-orange-dark">
                          Browse Project Requests
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Realtor-specific sections */}
            {isRealtor && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                    <Building className="h-5 w-5 text-ts-orange" />
                    My HomeScout Listings
                  </CardTitle>
                  <Link href="/homescout-listings">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {(dashboardData?.myListings?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.myListings!.map((listing: any) => (
                        <div
                          key={listing.id}
                          className="flex items-center justify-between p-3 bg-tsCard/80 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-white">{listing.title}</p>
                            <p className="text-sm text-white/70">
                              ${listing.price?.toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="secondary">{listing.views || 0} views</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Building className="h-12 w-12 text-white/70 dark:text-white/60 mx-auto mb-3" />
                      <p className="text-white/70 mb-4">No HomeScout listings yet</p>
                      <Link href="/homescout-listings">
                        <Button size="sm" className="bg-ts-orange-dark hover:bg-ts-orange-dark">
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
              <Card className="bg-tsCard border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                    <Home className="h-5 w-5 text-ts-orange" />
                    My Home Projects
                  </CardTitle>
                  <Link href="/request-quote">
                    <Button variant="ghost" size="sm">
                      New Project
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {(dashboardData?.myProjects?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.myProjects!.map((project: any) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 bg-tsCard/80 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-white">{project.title}</p>
                            <p className="text-sm text-white/70">{project.status}</p>
                          </div>
                          <Badge>{project.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Home className="h-12 w-12 text-white/70 dark:text-white/60 mx-auto mb-3" />
                      <p className="text-white/70 mb-4">No projects yet</p>
                      <Link href="/request-quote">
                        <Button
                          size="sm"
                          className="bg-ts-orange hover:bg-ts-orange-dark text-white"
                        >
                          Start Your First Project
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quotes & Estimates (contractor and homeowner) */}
            {(dashboardData?.quotes?.length ?? 0) > 0 && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-ts-orange" />
                    {isContractor ? "My Quotes" : "Received Quotes"}
                  </CardTitle>
                  <Link href="/messages">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData.quotes!.slice(0, 5).map((quote: any) => (
                      <div
                        key={quote.id}
                        className="flex items-center justify-between p-3 bg-tsCard/80 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-white">{quote.title}</p>
                          <p className="text-sm text-white/70">
                            ${Number(quote.totalCost).toLocaleString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            quote.status === "accepted"
                              ? "default"
                              : quote.status === "sent"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {quote.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Conversations */}
            {(dashboardData?.conversations?.length ?? 0) > 0 && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-indigo-500" />
                    Active Conversations
                  </CardTitle>
                  <Link href="/messages">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData.conversations!.slice(0, 5).map((conversation: any) => (
                      <Link key={conversation.id} href={`/messages/${conversation.id}`}>
                        <div className="flex items-center justify-between p-3 bg-tsCard/80 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                          <div className="flex-1">
                            <p className="font-medium text-white">
                              {conversation.projectType || "Project Discussion"}
                            </p>
                            <p className="text-xs text-white/60 dark:text-white/70">
                              {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          <Badge
                            variant={conversation.status === "active" ? "default" : "secondary"}
                          >
                            {conversation.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Exchange Listings (for anyone selling) */}
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-ts-orange" />
                  My Exchange Listings
                </CardTitle>
                <Link href="/exchange">
                  <Button variant="ghost" size="sm">
                    Create Listing
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {stats.marketplaceListings > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-white/70">
                      You have {stats.marketplaceListings} active listing
                      {stats.marketplaceListings !== 1 ? "s" : ""}
                    </p>
                    <Link href="/exchange">
                      <Button size="sm" variant="outline" className="w-full">
                        Manage Listings
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-white/70 dark:text-white/60 mx-auto mb-3" />
                    <p className="text-white/70 mb-4">No Exchange listings</p>
                    <Link href="/exchange">
                      <Button size="sm" className="bg-ts-orange hover:bg-ts-orange-dark text-white">
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
            <Card className="bg-tsCard border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-ts-orange">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isContractor ? (
                  <>
                    <Link href="/business/requests">
                      <Button
                        size="sm"
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white w-full justify-start"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Find New Projects
                      </Button>
                    </Link>
                    <Link href="/contractors">
                      <Button
                        size="sm"
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white w-full justify-start"
                      >
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Update Profile
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/scout?intent=estimate">
                      <Button
                        size="sm"
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white w-full justify-start"
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Start an Estimate Request
                      </Button>
                    </Link>
                    <Link href="/contractors">
                      <Button
                        size="sm"
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white w-full justify-start"
                      >
                        <Wrench className="h-4 w-4 mr-2" />
                        Find Local Help
                      </Button>
                    </Link>
                    <Link href="/request-quote">
                      <Button
                        size="sm"
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white w-full justify-start"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Request Quote
                      </Button>
                    </Link>
                  </>
                )}
                <Link href="/exchange">
                  <Button
                    size="sm"
                    className="bg-ts-orange hover:bg-ts-orange-dark text-white w-full justify-start"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Browse Exchange
                  </Button>
                </Link>
                <Link href="/community">
                  <Button
                    size="sm"
                    className="bg-ts-orange hover:bg-ts-orange-dark text-white w-full justify-start"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Community Feed
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Saved Contractors (for homeowners) */}
            {!isProfessional && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                    <Heart className="h-5 w-5 text-ts-orange" />
                    Saved Contractors
                  </CardTitle>
                  <Link href="/saved-contractors">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {stats.savedContractors > 0 ? (
                    <p className="text-sm text-white/70">
                      You have {stats.savedContractors} saved contractor
                      {stats.savedContractors !== 1 ? "s" : ""}
                    </p>
                  ) : (
                    <div className="text-center py-6">
                      <Heart className="h-10 w-10 text-white/70 dark:text-white/60 mx-auto mb-2" />
                      <p className="text-sm text-white/70">No saved contractors yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card className="bg-tsCard border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                  <Clock className="h-5 w-5 text-ts-orange" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(dashboardData?.recentActivity?.length ?? 0) > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.recentActivity!.slice(0, 5).map((activity: any, idx: number) => (
                      <Link
                        key={idx}
                        href={`/community/post/${activity.id}`}
                        className="block text-sm hover:bg-tsBg p-2 rounded transition-colors cursor-pointer"
                      >
                        <p className="text-white hover:text-ts-orange transition-colors">
                          {activity.title}
                        </p>
                        <p className="text-xs text-white/60 dark:text-white/70">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Clock className="h-10 w-10 text-white/70 dark:text-white/60 mx-auto mb-2" />
                    <p className="text-sm text-white/70">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Community Preview Widget */}
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-ts-orange flex items-center gap-2">
                  <Users className="h-5 w-5 text-ts-orange" />
                  Community
                </CardTitle>
                <Link href="/community">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/70 mb-3">
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
      </Section>
    </Page>
  );
});
export default SimpleHome;
