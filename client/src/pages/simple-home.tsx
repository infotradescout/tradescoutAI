import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Users, 
  Star, 
  TrendingUp, 
  Shield, 
  Calendar,
  MessageCircle,
  Award,
  MapPin,
  ChevronRight,
  Building,
  Zap
} from "lucide-react";

export default function SimpleHome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            Welcome to TradeScout
          </h1>
          <p className="text-xl text-slate-300 mb-6 max-w-2xl mx-auto">
            Your trusted platform for connecting with verified contractors and exploring quality home services.
          </p>
          <Badge className="bg-green-600 text-white px-4 py-2">
            Platform Active - All Systems Running
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-slate-800/50 border-slate-600 hover:bg-slate-700/50 transition-colors cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Find Contractors</h3>
              <p className="text-slate-300 text-sm mb-4">
                Search through our network of verified contractors in your area.
              </p>
              <Button className="w-full bg-orange-500 hover:bg-orange-600">
                Start Search
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-600 hover:bg-slate-700/50 transition-colors cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Daily Deals</h3>
              <p className="text-slate-300 text-sm mb-4">
                Discover exclusive daily deals and save on home services.
              </p>
              <Button className="w-full bg-blue-500 hover:bg-blue-600">
                View Deals
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-600 hover:bg-slate-700/50 transition-colors cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Community</h3>
              <p className="text-slate-300 text-sm mb-4">
                Connect with your local community and share experiences.
              </p>
              <Button className="w-full bg-green-500 hover:bg-green-600">
                Join Groups
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Platform Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400 mb-2">125K+</div>
            <div className="text-slate-400">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400 mb-2">28.5K</div>
            <div className="text-slate-400">Contractors</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400 mb-2">1,247</div>
            <div className="text-slate-400">Counties</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400 mb-2">89%</div>
            <div className="text-slate-400">Retention Rate</div>
          </div>
        </div>

        {/* Featured Sections */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card className="bg-slate-800/50 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Shield className="w-5 h-5 mr-2 text-green-400" />
                Verified Contractors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-4">
                All contractors undergo rigorous verification including license checks, 
                insurance verification, and background screening for your safety.
              </p>
              <div className="flex items-center text-sm text-green-400">
                <Award className="w-4 h-4 mr-1" />
                100% Verified Network
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-blue-400" />
                County-Centric Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-4">
                Organized by county to ensure you connect with contractors who 
                understand your local regulations and community needs.
              </p>
              <div className="flex items-center text-sm text-blue-400">
                <Building className="w-4 h-4 mr-1" />
                3,000+ Counties Covered
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-500/50">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Explore TradeScout Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button variant="ghost" className="justify-between h-auto p-4 text-left">
                <div>
                  <div className="font-medium text-white">Calculator</div>
                  <div className="text-xs text-slate-300">Get estimates</div>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" className="justify-between h-auto p-4 text-left">
                <div>
                  <div className="font-medium text-white">Messages</div>
                  <div className="text-xs text-slate-300">Chat directly</div>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" className="justify-between h-auto p-4 text-left">
                <div>
                  <div className="font-medium text-white">Helpers</div>
                  <div className="text-xs text-slate-300">Find workers</div>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" className="justify-between h-auto p-4 text-left">
                <div>
                  <div className="font-medium text-white">Settings</div>
                  <div className="text-xs text-slate-300">Customize</div>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}