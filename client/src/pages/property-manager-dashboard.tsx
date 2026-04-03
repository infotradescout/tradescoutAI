import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { 
  Building, 
  DollarSign, 
  Users, 
  Wrench, 
  Phone, 
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Target,
  Home,
  Plus,
  TrendingUp,
  Key,
  Eye
} from "lucide-react";
import { Page, Section } from "@/components/layout/PagePrimitives";

interface Property {
  id: string;
  address: string;
  units: number;
  occupiedUnits: number;
  monthlyRent: number;
  status: 'fully_occupied' | 'partially_vacant' | 'maintenance_required' | 'under_renovation';
  lastInspection: string;
  nextMaintenanceDate: string;
}

interface MaintenanceRequest {
  id: string;
  propertyAddress: string;
  unit: string;
  tenant: string;
  issue: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'open' | 'in_progress' | 'completed';
  submittedDate: string;
}

interface PropertyManagerStats {
  totalProperties: number;
  totalUnits: number;
  occupancyRate: number;
  monthlyRevenue: number;
  maintenanceRequests: number;
  collectionsRate: number;
}

export default function PropertyManagerDashboard() {
  const { user } = useAuth();

  const mockStats: PropertyManagerStats = {
    totalProperties: 8,
    totalUnits: 124,
    occupancyRate: 94.5,
    monthlyRevenue: 186750,
    maintenanceRequests: 12,
    collectionsRate: 97.2,
  };

  const mockProperties: Property[] = [
    {
      id: '1',
      address: '1234 Oak Avenue, Austin, TX',
      units: 24,
      occupiedUnits: 22,
      monthlyRent: 32400,
      status: 'partially_vacant',
      lastInspection: '2024-01-05',
      nextMaintenanceDate: '2024-02-15',
    },
    {
      id: '2',
      address: '5678 Pine Street, Austin, TX',
      units: 16,
      occupiedUnits: 16,
      monthlyRent: 28800,
      status: 'fully_occupied',
      lastInspection: '2024-01-10',
      nextMaintenanceDate: '2024-03-01',
    },
    {
      id: '3',
      address: '9012 Elm Drive, Austin, TX',
      units: 12,
      occupiedUnits: 10,
      monthlyRent: 18000,
      status: 'maintenance_required',
      lastInspection: '2023-12-20',
      nextMaintenanceDate: '2024-01-25',
    },
  ];

  const mockMaintenanceRequests: MaintenanceRequest[] = [
    {
      id: '1',
      propertyAddress: '1234 Oak Avenue',
      unit: 'Apt 204',
      tenant: 'Sarah Johnson',
      issue: 'Leaking faucet in kitchen',
      priority: 'medium',
      status: 'open',
      submittedDate: '2024-01-15',
    },
    {
      id: '2',
      propertyAddress: '5678 Pine Street',
      unit: 'Apt 105',
      tenant: 'Michael Chen',
      issue: 'Heating system not working',
      priority: 'high',
      status: 'in_progress',
      submittedDate: '2024-01-14',
    },
    {
      id: '3',
      propertyAddress: '9012 Elm Drive',
      unit: 'Apt 301',
      tenant: 'Lisa Rodriguez',
      issue: 'Broken window latch',
      priority: 'low',
      status: 'open',
      submittedDate: '2024-01-13',
    },
  ];

  const getStatusColor = (status: Property['status']) => {
    switch (status) {
      case 'fully_occupied': return 'bg-green-500';
      case 'partially_vacant': return 'bg-yellow-500';
      case 'maintenance_required': return 'bg-ts-orange';
      case 'under_renovation': return 'bg-blue-500';
      default: return 'bg-tsCard/95';
    }
  };

  const getStatusText = (status: Property['status']) => {
    switch (status) {
      case 'fully_occupied': return 'Fully Occupied';
      case 'partially_vacant': return 'Partially Vacant';
      case 'maintenance_required': return 'Maintenance Required';
      case 'under_renovation': return 'Under Renovation';
      default: return status;
    }
  };

  const getPriorityColor = (priority: MaintenanceRequest['priority']) => {
    switch (priority) {
      case 'emergency': return 'text-red-600 bg-red-100';
      case 'high': return 'text-ts-orange bg-ts-orange/10';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-white/60 bg-tsCard';
    }
  };

  return (
    <Page className="max-w-7xl">
      <Section
        title={
          <span className="flex items-center gap-2">
            <Building className="h-6 w-6 text-indigo-500" />
            Property Manager Dashboard
          </span>
        }
        subtitle="Manage properties, track maintenance, and optimize operations"
      >

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Total Properties</p>
                <p className="text-2xl font-bold text-white">{mockStats.totalProperties}</p>
              </div>
              <Building className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Occupancy Rate</p>
                <p className="text-2xl font-bold text-white">{mockStats.occupancyRate}%</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Monthly Revenue</p>
                <p className="text-2xl font-bold text-white">${mockStats.monthlyRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Open Requests</p>
                <p className="text-2xl font-bold text-white">{mockStats.maintenanceRequests}</p>
              </div>
              <Wrench className="h-8 w-8 text-ts-orange" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Property Portfolio */}
        <div className="lg:col-span-2">
          <Card className="bg-tsCard border-white/10 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center">
                  <Home className="h-5 w-5 mr-2" />
                  Property Portfolio
                </CardTitle>
                <Button size="sm" className="bg-indigo-500 hover:bg-indigo-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockProperties.map((property) => (
                  <div key={property.id} className="p-4 bg-tsCard rounded-lg border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(property.status)}`}></div>
                        <h3 className="font-semibold text-white">{property.address}</h3>
                      </div>
                      <span className="text-sm text-white/60">{getStatusText(property.status)}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-white/60">Occupancy</p>
                        <p className="text-white">{property.occupiedUnits}/{property.units} units</p>
                      </div>
                      <div>
                        <p className="text-white/60">Monthly Rent</p>
                        <p className="text-white">${property.monthlyRent.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Last Inspection</p>
                        <p className="text-white">{new Date(property.lastInspection).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Next Maintenance</p>
                        <p className="text-white">{new Date(property.nextMaintenanceDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <Button size="sm" variant="outline" className="border-white/15 text-white/70">
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                      <Button size="sm" variant="outline" className="border-white/15 text-white/70">
                        <Calendar className="h-3 w-3 mr-1" />
                        Schedule
                      </Button>
                      <Button size="sm" variant="outline" className="border-white/15 text-white/70">
                        <FileText className="h-3 w-3 mr-1" />
                        Reports
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Requests */}
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Wrench className="h-5 w-5 mr-2" />
                Recent Maintenance Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockMaintenanceRequests.map((request) => (
                  <div key={request.id} className="p-4 bg-tsCard rounded-lg border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold text-white">{request.propertyAddress} - {request.unit}</h3>
                        <Badge className={getPriorityColor(request.priority)} variant="secondary">
                          {request.priority} priority
                        </Badge>
                      </div>
                      <span className="text-sm text-white/60 capitalize">{request.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-white/70 mb-2">{request.issue}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Tenant: {request.tenant}</span>
                      <span className="text-white/60">Submitted: {new Date(request.submittedDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <Button size="sm" variant="outline" className="border-white/15 text-white/70">
                        <Phone className="h-3 w-3 mr-1" />
                        Contact
                      </Button>
                      <Button size="sm" variant="outline" className="border-white/15 text-white/70">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Assign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Items & Tools */}
        <div className="space-y-6">
          {/* Urgent Actions */}
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-ts-orange" />
                Urgent Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">2 emergency requests</p>
                    <p className="text-red-400 text-xs">Immediate attention needed</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-red-500 text-red-400">
                    View
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">3 lease renewals</p>
                    <p className="text-yellow-400 text-xs">Expiring next month</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-yellow-500 text-yellow-400">
                    Review
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tools */}
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Quick Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full bg-indigo-500 hover:bg-indigo-600 text-white justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Tenant
                </Button>
                <Button variant="outline" className="w-full border-white/15 text-white/70 justify-start">
                  <Wrench className="h-4 w-4 mr-2" />
                  Find Contractors
                </Button>
                <Button variant="outline" className="w-full border-white/15 text-white/70 justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Inspection
                </Button>
                <Button variant="outline" className="w-full border-white/15 text-white/70 justify-start">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Reports
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">Occupancy Rate</span>
                    <span className="text-white">{mockStats.occupancyRate}%</span>
                  </div>
                  <Progress value={mockStats.occupancyRate} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">Collections Rate</span>
                    <span className="text-white">{mockStats.collectionsRate}%</span>
                  </div>
                  <Progress value={mockStats.collectionsRate} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">Maintenance Response</span>
                    <span className="text-white">85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vacant Units */}
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Vacant Units</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white text-sm">Oak Ave - Apt 105</p>
                    <p className="text-white/60 text-xs">Available Jan 20</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-white/15 text-white/70">
                    <Key className="h-3 w-3 mr-1" />
                    Show
                  </Button>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white text-sm">Oak Ave - Apt 208</p>
                    <p className="text-white/60 text-xs">Available Feb 1</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-white/15 text-white/70">
                    <Key className="h-3 w-3 mr-1" />
                    Show
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </Section>
    </Page>
  );
}