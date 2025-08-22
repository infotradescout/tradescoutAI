import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Briefcase, 
  TrendingUp, 
  Users, 
  Star,
  DollarSign,
  Calendar,
  ChevronRight,
  Award,
  Target,
  Clock,
  Phone,
  MapPin,
  CheckCircle,
  AlertCircle,
  FileText,
  Zap
} from "lucide-react";

interface InquiryData {
  id: string;
  title: string;
  homeownerName: string;
  status: 'new' | 'contacted' | 'quoted' | 'won' | 'lost';
  value: number;
  location: string;
  createdAt: string;
}

interface ContractorStats {
  totalInquiries: number;
  wonInquiries: number;
  revenue: number;
  averageRating: number;
  completedJobs: number;
  responseRate: number;
}

export default function ContractorDashboard() {
  const { user } = useAuth();

  // Mock data for contractor dashboard
  const mockInquiries: InquiryData[] = [
    {
      id: '1',
      title: 'Kitchen Remodel',
      homeownerName: 'Sarah Johnson',
      status: 'new',
      value: 25000,
      location: 'Austin, TX',
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      title: 'Bathroom Renovation',
      homeownerName: 'Mike Chen',
      status: 'quoted',
      value: 8500,
      location: 'Austin, TX',
      createdAt: '2024-01-14',
    },
    {
      id: '3',
      title: 'Deck Installation',
      homeownerName: 'Lisa Rodriguez',
      status: 'won',
      value: 12000,
      location: 'Round Rock, TX',
      createdAt: '2024-01-12',
    },
  ];

  const mockStats: ContractorStats = {
    totalInquiries: 15,
    wonInquiries: 8,
    revenue: 85000,
    averageRating: 4.8,
    completedJobs: 12,
    responseRate: 95,
  };

  const getStatusBadge = (status: InquiryData['status']) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-orange-500">New</Badge>;
      case 'contacted':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Contacted</Badge>;
      case 'quoted':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Quoted</Badge>;
      case 'won':
        return <Badge className="bg-green-600">Won</Badge>;
      case 'lost':
        return <Badge variant="outline" className="border-red-500 text-red-500">Lost</Badge>;
    }
  };

  const getStatusIcon = (status: InquiryData['status']) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'contacted':
        return <Phone className="h-4 w-4 text-blue-500" />;
      case 'quoted':
        return <FileText className="h-4 w-4 text-yellow-500" />;
      case 'won':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'lost':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {user?.firstName || 'Contractor'}
        </h1>
        <p className="text-gray-300">Manage customer inquiries, track performance, and grow your business</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30 card-enhanced cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-500/30 rounded-lg flex items-center justify-center">
                  <Zap className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">New Inquiries</h3>
                  <p className="text-gray-400 text-sm">Review fresh opportunities</p>
                </div>
              </div>
              <Badge className="bg-orange-500 text-white">
                {mockInquiries.filter(l => l.status === 'new').length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Link href="/contractors/accelerator">
          <Card className="bg-navy-700 border-navy-600 card-enhanced cursor-pointer hover:border-orange-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Award className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Accelerator</h3>
                    <p className="text-gray-400 text-sm">Premium membership</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="bg-navy-700 border-navy-600 card-enhanced">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Performance</h3>
                  <p className="text-gray-400 text-sm">{mockStats.responseRate}% response rate</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{mockStats.averageRating}</p>
                <div className="flex items-center">
                  <Star className="h-3 w-3 text-yellow-400 fill-current" />
                  <span className="text-xs text-gray-400 ml-1">rating</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Target className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-white">{mockStats.totalInquiries}</p>
            <p className="text-sm text-gray-400">Customer Inquiries</p>
          </CardContent>
        </Card>
        
        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-white">{mockStats.wonInquiries}</p>
            <p className="text-sm text-gray-400">Won Inquiries</p>
          </CardContent>
        </Card>
        
        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-white">${mockStats.revenue.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Revenue YTD</p>
          </CardContent>
        </Card>
        
        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Briefcase className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-white">{mockStats.completedJobs}</p>
            <p className="text-sm text-gray-400">Completed Jobs</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Recent Inquiries
              <Button variant="ghost" className="text-orange-500 hover:text-orange-400 p-0">
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockInquiries.map((inquiry) => (
                <div key={inquiry.id} className="flex items-center justify-between p-4 bg-navy-600 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(inquiry.status)}
                    <div>
                      <p className="text-white font-medium">{inquiry.title}</p>
                      <p className="text-gray-400 text-sm">{inquiry.homeownerName}</p>
                      <div className="flex items-center text-gray-500 text-xs mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {inquiry.location}
                        <span className="mx-2">•</span>
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(inquiry.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(inquiry.status)}
                    <p className="text-white font-semibold mt-1">
                      ${inquiry.value.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {mockInquiries.length === 0 && (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No inquiries yet</p>
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    Optimize Your Profile
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white">Business Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Inquiry Conversion Rate</span>
                  <span className="text-white font-semibold">
                    {Math.round((mockStats.wonInquiries / mockStats.totalInquiries) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(mockStats.wonInquiries / mockStats.totalInquiries) * 100} 
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Response Rate</span>
                  <span className="text-white font-semibold">{mockStats.responseRate}%</span>
                </div>
                <Progress value={mockStats.responseRate} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Customer Satisfaction</span>
                  <span className="text-white font-semibold">{mockStats.averageRating}/5.0</span>
                </div>
                <Progress value={(mockStats.averageRating / 5) * 100} className="h-2" />
              </div>

              <div className="pt-4 border-t border-navy-600">
                <h4 className="text-white font-semibold mb-4">Growth Recommendations</h4>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-white text-sm">Complete your profile</p>
                      <p className="text-gray-400 text-xs">Add photos and certifications</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Clock className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-white text-sm">Improve response time</p>
                      <p className="text-gray-400 text-xs">Respond to inquiries within 1 hour</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Award className="h-4 w-4 text-purple-500 mt-0.5" />
                    <div>
                      <p className="text-white text-sm">Join Accelerator Program</p>
                      <p className="text-gray-400 text-xs">Get priority leads and training</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business Navigation Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Expand Your Business</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link href="/contractor/recommendation-generator">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-orange-500 flex flex-col items-center justify-center space-y-1">
              <Zap className="h-5 w-5 text-blue-400" />
              <span className="text-xs">Smart Recommendations</span>
            </Button>
          </Link>
          <Link href="/community">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-orange-500 flex flex-col items-center justify-center space-y-1">
              <Users className="h-5 w-5 text-purple-400" />
              <span className="text-xs">Community</span>
            </Button>
          </Link>
          <Link href="/marketplace">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-orange-500 flex flex-col items-center justify-center space-y-1">
              <Star className="h-5 w-5 text-yellow-400" />
              <span className="text-xs">Marketplace</span>
            </Button>
          </Link>
          <Link href="/exchange">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-orange-500 flex flex-col items-center justify-center space-y-1">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-xs">Exchange</span>
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" className="w-full h-16 border-navy-500 hover:border-orange-500 flex flex-col items-center justify-center space-y-1">
              <Award className="h-5 w-5 text-orange-400" />
              <span className="text-xs">Leaderboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}