import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  Star, 
  Clock, 
  Users,
  ChevronRight,
  Phone,
  FileText,
  CheckCircle
} from 'lucide-react';

export default function ContractorDashboardSimple() {
  const stats = {
    revenue: '$85,000',
    rating: '4.8',
    jobs: '12',
    inquiries: '15'
  };

  const recentInquiries = [
    {
      id: 1,
      project: 'Kitchen Remodel',
      homeowner: 'Sarah Johnson',
      value: '$25,000',
      status: 'New',
      location: 'Austin, TX'
    },
    {
      id: 2, 
      project: 'Bathroom Renovation',
      homeowner: 'Mike Chen', 
      value: '$8,500',
      status: 'Quoted',
      location: 'Austin, TX'
    },
    {
      id: 3,
      project: 'Deck Installation', 
      homeowner: 'Lisa Rodriguez',
      value: '$12,000', 
      status: 'Won',
      location: 'Round Rock, TX'
    }
  ];

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Contractor Dashboard</h1>
          <p className="text-gray-300 text-lg">Manage your business, track performance, and grow revenue</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Revenue</p>
                  <p className="text-3xl font-bold text-white">{stats.revenue}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Average Rating</p>
                  <p className="text-3xl font-bold text-white">{stats.rating}</p>
                </div>
                <Star className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Completed Jobs</p>
                  <p className="text-3xl font-bold text-white">{stats.jobs}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Inquiries</p>
                  <p className="text-3xl font-bold text-white">{stats.inquiries}</p>
                </div>
                <Users className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Inquiries */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Recent Project Inquiries</span>
              <Button variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                View All
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInquiries.map((inquiry) => (
                <div key={inquiry.id} className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{inquiry.project}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{inquiry.homeowner}</span>
                        <span>•</span>
                        <span>{inquiry.location}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-white font-bold">{inquiry.value}</p>
                      <Badge 
                        className={
                          inquiry.status === 'New' ? 'bg-orange-600' :
                          inquiry.status === 'Quoted' ? 'bg-yellow-600' :
                          'bg-green-600'
                        }
                      >
                        {inquiry.status}
                      </Badge>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-orange-600 text-orange-400 hover:bg-orange-600/20"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Contact
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm cursor-pointer hover:border-orange-600 transition-colors">
            <CardContent className="p-6 text-center">
              <Users className="h-12 w-12 text-orange-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Manage Connections</h3>
              <p className="text-gray-400 text-sm mb-4">Review and respond to new customer inquiries</p>
              <Button className="bg-orange-600 hover:bg-orange-700 w-full">
                View Connections
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm cursor-pointer hover:border-orange-600 transition-colors">
            <CardContent className="p-6 text-center">
              <Star className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Customer Reviews</h3>
              <p className="text-gray-400 text-sm mb-4">Manage reviews and build your reputation</p>
              <Button variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20 w-full">
                View Reviews
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm cursor-pointer hover:border-orange-600 transition-colors">
            <CardContent className="p-6 text-center">
              <Clock className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Schedule Jobs</h3>
              <p className="text-gray-400 text-sm mb-4">Manage your project timeline and appointments</p>
              <Button variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20 w-full">
                View Schedule
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}