import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Car, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  Phone,
  Mail,
  Plus,
  Eye,
  Star,
  FileText,
  Camera,
  Search,
  Target,
  Award,
  Clock,
  ShoppingCart
} from "lucide-react";

interface VehicleListing {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  condition: 'new' | 'used' | 'certified';
  status: 'available' | 'pending' | 'sold' | 'service';
  listingDate: string;
  views: number;
  inquiries: number;
  testDrives: number;
}

interface SalesStats {
  vehiclesSold: number;
  totalRevenue: number;
  averageSalePrice: number;
  commission: number;
  activeListings: number;
  conversionRate: number;
}

export default function CarSalesmanDashboard() {
  const { user } = useAuth();

  // Fetch car salesman-specific data
  const { data: listings = [], isLoading: isLoadingListings } = useQuery({
    queryKey: ["/api/car-sales/listings"],
    retry: false,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/car-sales/stats"],
    retry: false,
  });

  const mockStats: SalesStats = {
    vehiclesSold: 18,
    totalRevenue: 425000,
    averageSalePrice: 23611,
    commission: 12750,
    activeListings: 24,
    conversionRate: 24.5,
  };

  const mockListings: VehicleListing[] = [
    {
      id: '1',
      make: 'Toyota',
      model: 'Camry',
      year: 2024,
      price: 28500,
      mileage: 12000,
      condition: 'used',
      status: 'available',
      listingDate: '2025-01-10',
      views: 45,
      inquiries: 8,
      testDrives: 3,
    },
    {
      id: '2',
      make: 'Honda',
      model: 'Accord',
      year: 2025,
      price: 32000,
      mileage: 0,
      condition: 'new',
      status: 'pending',
      listingDate: '2025-01-08',
      views: 67,
      inquiries: 12,
      testDrives: 5,
    },
    {
      id: '3',
      make: 'Ford',
      model: 'F-150',
      year: 2023,
      price: 35500,
      mileage: 15000,
      condition: 'certified',
      status: 'sold',
      listingDate: '2025-01-05',
      views: 89,
      inquiries: 15,
      testDrives: 7,
    },
  ];

  const getStatusBadge = (status: VehicleListing['status']) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-600">Available</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600">Pending</Badge>;
      case 'sold':
        return <Badge className="bg-blue-600">Sold</Badge>;
      case 'service':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Service</Badge>;
    }
  };

  const getConditionBadge = (condition: VehicleListing['condition']) => {
    switch (condition) {
      case 'new':
        return <Badge className="bg-purple-600">New</Badge>;
      case 'used':
        return <Badge variant="outline" className="border-gray-500 text-gray-400">Used</Badge>;
      case 'certified':
        return <Badge className="bg-orange-600">Certified</Badge>;
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
          Auto Sales Dashboard - {user?.firstName || 'Sales Rep'}
        </h1>
        <p className="text-gray-300">Manage your inventory, track sales, and grow your automotive business</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-4">
          <Link href="/car-sales/new-listing">
            <Button className="bg-orange-500 hover:bg-orange-600 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Vehicle
            </Button>
          </Link>
          <Link href="/car-sales/customers">
            <Button variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customer CRM
            </Button>
          </Link>
          <Link href="/car-sales/financing">
            <Button variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financing Tools
            </Button>
          </Link>
          <Link href="/car-sales/trade-in">
            <Button variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Trade-In Valuator
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
                <p className="text-gray-400 text-sm">Vehicles Sold</p>
                <p className="text-2xl font-bold text-white">{mockStats.vehiclesSold}</p>
              </div>
              <Car className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800 border-navy-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Sales</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(mockStats.totalRevenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800 border-navy-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Commission Earned</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(mockStats.commission)}</p>
              </div>
              <Award className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800 border-navy-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Conversion Rate</p>
                <p className="text-2xl font-bold text-white">{mockStats.conversionRate}%</p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Vehicle Inventory */}
        <div className="lg:col-span-2">
          <Card className="bg-navy-800 border-navy-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Car className="h-5 w-5 text-orange-500" />
                Vehicle Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockListings.map((vehicle) => (
                  <div key={vehicle.id} className="bg-navy-700 rounded-lg p-4 border border-navy-600">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-white">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-2xl font-bold text-orange-500">{formatCurrency(vehicle.price)}</p>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(vehicle.status)}
                        {getConditionBadge(vehicle.condition)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-gray-400 text-sm mb-3">
                      <span>{vehicle.mileage.toLocaleString()} miles</span>
                      <span>Listed {new Date(vehicle.listingDate).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-gray-400 text-sm">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{vehicle.views} views</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span>{vehicle.inquiries} inquiries</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Car className="h-4 w-4" />
                          <span>{vehicle.testDrives} test drives</span>
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
          {/* Monthly Performance */}
          <Card className="bg-navy-800 border-navy-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Units Sold</span>
                <span className="text-white font-semibold">7</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Test Drives</span>
                <span className="text-white font-semibold">23</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Avg. Sale Time</span>
                <span className="text-white font-semibold">12 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Customer Rating</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  4.9
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Sales Tools */}
          <Card className="bg-navy-800 border-navy-700">
            <CardHeader>
              <CardTitle className="text-white">Sales Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/car-sales/payment-calculator">
                <Button variant="outline" className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Payment Calculator
                </Button>
              </Link>
              <Link href="/car-sales/vin-lookup">
                <Button variant="outline" className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600">
                  <Search className="h-4 w-4 mr-2" />
                  VIN Lookup
                </Button>
              </Link>
              <Link href="/car-sales/appointments">
                <Button variant="outline" className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Test Drive
                </Button>
              </Link>
              <Link href="/car-sales/follow-up">
                <Button variant="outline" className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600">
                  <Clock className="h-4 w-4 mr-2" />
                  Follow-up Manager
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}