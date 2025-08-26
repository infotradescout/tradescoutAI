import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Building, 
  Home, 
  TrendingUp, 
  Users, 
  MapPin, 
  DollarSign, 
  Calendar,
  Phone,
  Mail,
  Plus,
  Eye,
  Star,
  FileText,
  Camera,
  Search
} from "lucide-react";

interface PropertyListing {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  status: 'active' | 'pending' | 'sold' | 'withdrawn';
  listingDate: string;
  views: number;
  inquiries: number;
}

interface RealtorStats {
  activeListings: number;
  soldThisMonth: number;
  totalRevenue: number;
  averagePrice: number;
  clientsServed: number;
  marketShare: number;
}

export default function RealtorDashboard() {
  const { user } = useAuth();

  // Fetch realtor-specific data
  const { data: listings = [], isLoading: isLoadingListings } = useQuery({
    queryKey: ["/api/realtor/listings"],
    retry: false,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/realtor/stats"],
    retry: false,
  });

  const mockStats: RealtorStats = {
    activeListings: 12,
    soldThisMonth: 5,
    totalRevenue: 285000,
    averagePrice: 475000,
    clientsServed: 38,
    marketShare: 3.2,
  };

  const mockListings: PropertyListing[] = [
    {
      id: '1',
      address: '123 Oak Street, Austin, TX',
      price: 525000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 2100,
      status: 'active',
      listingDate: '2025-01-10',
      views: 89,
      inquiries: 7,
    },
    {
      id: '2',
      address: '456 Pine Avenue, Round Rock, TX',
      price: 415000,
      bedrooms: 4,
      bathrooms: 3,
      sqft: 2450,
      status: 'pending',
      listingDate: '2025-01-05',
      views: 124,
      inquiries: 12,
    },
    {
      id: '3',
      address: '789 Maple Drive, Cedar Park, TX',
      price: 385000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1950,
      status: 'sold',
      listingDate: '2024-12-20',
      views: 156,
      inquiries: 18,
    },
  ];

  const getStatusBadge = (status: PropertyListing['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600">Pending</Badge>;
      case 'sold':
        return <Badge className="bg-blue-600">Sold</Badge>;
      case 'withdrawn':
        return <Badge variant="outline" className="border-red-500 text-red-500">Withdrawn</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoadingListings || isLoadingStats) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-navy-600/50 rounded-md w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-navy-600/50 rounded-lg"></div>
            ))}
          </div>
          <div className="h-64 bg-navy-600/50 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Realtor Dashboard - {user?.firstName || 'Agent'}
        </h1>
        <p className="text-gray-300">Manage your listings, track sales, and grow your real estate business</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-4">
          <Link href="/property-listing">
            <Button className="bg-orange-500 hover:bg-orange-600 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Listing
            </Button>
          </Link>
          <Link href="/realtor/clients">
            <Button variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manage Clients
            </Button>
          </Link>
          <Link href="/realtor/market-analysis">
            <Button variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Market Analysis
            </Button>
          </Link>
          <Link href="/realtor/connections">
            <Button variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Connection Generator
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-navy-800 border-navy-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Listings</p>
                <p className="text-2xl font-bold text-white">{mockStats.activeListings}</p>
              </div>
              <Building className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800 border-navy-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Sold This Month</p>
                <p className="text-2xl font-bold text-white">{mockStats.soldThisMonth}</p>
              </div>
              <Home className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800 border-navy-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Commission Revenue</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(mockStats.totalRevenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800 border-navy-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg. Sale Price</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(mockStats.averagePrice)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Listings */}
        <div className="lg:col-span-2">
          <Card className="bg-navy-800 border-navy-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building className="h-5 w-5 text-orange-500" />
                Recent Listings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockListings.map((listing) => (
                  <div key={listing.id} className="bg-navy-700 rounded-lg p-4 border border-navy-600">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-white">{listing.address}</h3>
                        <p className="text-2xl font-bold text-orange-500">{formatCurrency(listing.price)}</p>
                      </div>
                      {getStatusBadge(listing.status)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-gray-400 text-sm mb-3">
                      <span>{listing.bedrooms} bed</span>
                      <span>{listing.bathrooms} bath</span>
                      <span>{listing.sqft.toLocaleString()} sqft</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-gray-400 text-sm">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{listing.views} views</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span>{listing.inquiries} inquiries</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600">
                          <Camera className="h-4 w-4 mr-1" />
                          Photos
                        </Button>
                        <Button size="sm" variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600">
                          <FileText className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance & Tools */}
        <div className="space-y-6">
          {/* Performance Summary */}
          <Card className="bg-navy-800 border-navy-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Clients Served</span>
                <span className="text-white font-semibold">{mockStats.clientsServed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Market Share</span>
                <span className="text-white font-semibold">{mockStats.marketShare}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Response Rate</span>
                <span className="text-white font-semibold">98%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Avg. Days on Market</span>
                <span className="text-white font-semibold">18 days</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tools */}
          <Card className="bg-navy-800 border-navy-700">
            <CardHeader>
              <CardTitle className="text-white">Quick Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/realtor/calculator">
                <Button variant="outline" className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Commission Calculator
                </Button>
              </Link>
              <Link href="/realtor/cma">
                <Button variant="outline" className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  CMA Generator
                </Button>
              </Link>
              <Link href="/realtor/appointments">
                <Button variant="outline" className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Showing
                </Button>
              </Link>
              <Link href="/realtor/contacts">
                <Button variant="outline" className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600">
                  <Phone className="h-4 w-4 mr-2" />
                  Contact Manager
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}