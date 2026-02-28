import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  MessageSquare,
  Heart,
  Star,
  Shield,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Target,
  Plus,
  TrendingUp,
  Flag,
} from "lucide-react";

import { useLocationContext } from "@/hooks/useLocationContext";
import { formatCityOnly } from "@/utils/locationDisplay";

export default function CommunityDashboard() {
  const { user } = useAuth();
  const location = useLocationContext();
  const { label: locationLabel } = location;
  const cityHeadline = formatCityOnly({ label: locationLabel });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Users className="h-8 w-8 text-cyan-500 mr-3" />
          Community Dashboard
        </h1>
        <p className="text-white/60 mt-2">
          Engage with your neighborhood community in {cityHeadline || "your area"}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Community Score</p>
                <p className="text-2xl font-bold text-white">4.8</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Posts Created</p>
                <p className="text-2xl font-bold text-white">24</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Helpful Votes</p>
                <p className="text-2xl font-bold text-white">156</p>
              </div>
              <Heart className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Moderation Actions</p>
                <p className="text-2xl font-bold text-white">
                  {user?.role?.includes("moderator") ? "8" : "0"}
                </p>
              </div>
              <Shield className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Community Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-white font-semibold mb-3">Recent Discussions</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-tsCard rounded-lg">
                      <p className="text-white text-sm">
                        Neighborhood Safety Initiative Discussion
                      </p>
                      <p className="text-white/60 text-xs mt-1">12 comments • 2 hours ago</p>
                    </div>
                    <div className="p-3 bg-tsCard rounded-lg">
                      <p className="text-white text-sm">Local Business Recommendations</p>
                      <p className="text-white/60 text-xs mt-1">8 comments • 5 hours ago</p>
                    </div>
                  </div>
                </div>

                {user?.role?.includes("moderator") && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Moderation Tools</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        className="border-red-500 text-red-400 justify-start"
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        Review Reports
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/15 text-white/70 justify-start"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        User Management
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  New Post
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-white/15 text-white/70 justify-start"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Join Discussion
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-white/15 text-white/70 justify-start"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Community Events
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Community Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Active Members</span>
                  <span className="text-white">1,247</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">This Week's Posts</span>
                  <span className="text-white">89</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Response Rate</span>
                  <span className="text-white">94%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Community Navigation */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Explore Community</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="w-full h-16 border-white/10 hover:border-cyan-500 flex flex-col items-center justify-center space-y-1"
          >
            <MessageSquare className="h-5 w-5 text-cyan-400" />
            <span className="text-xs">Forums</span>
          </Button>
          <Button
            variant="outline"
            className="w-full h-16 border-white/10 hover:border-cyan-500 flex flex-col items-center justify-center space-y-1"
          >
            <Calendar className="h-5 w-5 text-green-400" />
            <span className="text-xs">Events</span>
          </Button>
          <Button
            variant="outline"
            className="w-full h-16 border-white/10 hover:border-cyan-500 flex flex-col items-center justify-center space-y-1"
          >
            <Users className="h-5 w-5 text-blue-400" />
            <span className="text-xs">Members</span>
          </Button>
          <Button
            variant="outline"
            className="w-full h-16 border-white/10 hover:border-cyan-500 flex flex-col items-center justify-center space-y-1"
          >
            <Flag className="h-5 w-5 text-ts-orange" />
            <span className="text-xs">Guidelines</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
