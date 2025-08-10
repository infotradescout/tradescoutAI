import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  MapPin, 
  Star, 
  Clock, 
  Calculator,
  Users,
  ChevronRight,
  Zap,
  Target,
  Award,
  TrendingUp
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {user?.firstName || 'User'}
        </h1>
        <p className="text-gray-300">Here's what's happening in your area</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/contractors/board">
          <Card className="bg-navy-700 border-navy-600 card-enhanced cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center glow-orange">
                    <MapPin className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Find Contractors</h3>
                    <p className="text-gray-400 text-sm">Search verified contractors in your area</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/quote">
          <Card className="bg-navy-700 border-navy-600 card-enhanced cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center glow-orange">
                    <Calculator className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Get Quote</h3>
                    <p className="text-gray-400 text-sm">Calculate project estimates</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/growth-pack">
          <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30 card-enhanced cursor-pointer glow-orange">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-500/30 rounded-lg flex items-center justify-center glow-orange-strong">
                    <TrendingUp className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">For Contractors</h3>
                    <p className="text-gray-400 text-sm">FREE Growth Pack resources</p>
                  </div>
                </div>
                <Badge className="bg-orange-500 text-white">
                  FREE
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Platform Statistics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Platform Updates</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-navy-700 border-navy-600 text-center card-enhanced">
            <CardContent className="p-4">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Zap className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-white">100%</p>
              <p className="text-sm text-gray-400">Loading Speed</p>
            </CardContent>
          </Card>
          
          <Card className="bg-navy-700 border-navy-600 text-center card-enhanced">
            <CardContent className="p-4">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Target className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-white">Enhanced</p>
              <p className="text-sm text-gray-400">User Experience</p>
            </CardContent>
          </Card>
          
          <Card className="bg-navy-700 border-navy-600 text-center card-enhanced">
            <CardContent className="p-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Award className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-white">New</p>
              <p className="text-sm text-gray-400">Visual Design</p>
            </CardContent>
          </Card>
          
          <Card className="bg-navy-700 border-navy-600 text-center card-enhanced">
            <CardContent className="p-4">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-white">Fixed</p>
              <p className="text-sm text-gray-400">TypeScript Issues</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-navy-600 rounded-lg">
                <div>
                  <p className="text-white font-medium">Roof Replacement Quote</p>
                  <p className="text-gray-400 text-sm">Requested 2 days ago</p>
                </div>
                <Badge variant="secondary">Pending</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-navy-600 rounded-lg">
                <div>
                  <p className="text-white font-medium">Plumbing Repair</p>
                  <p className="text-gray-400 text-sm">Completed 1 week ago</p>
                </div>
                <Badge className="bg-green-600">Completed</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white">Top Contractors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                  AC
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Apex Construction</p>
                  <div className="flex items-center space-x-2">
                    <div className="flex text-yellow-400">
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                    </div>
                    <span className="text-gray-400 text-sm">4.9 (42 recommendations)</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-400 border-green-400">
                  Licensed
                </Badge>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                  EP
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Elite Plumbing Co.</p>
                  <div className="flex items-center space-x-2">
                    <div className="flex text-yellow-400">
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4" />
                    </div>
                    <span className="text-gray-400 text-sm">4.7 (28 recommendations)</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-400 border-green-400">
                  Licensed
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
