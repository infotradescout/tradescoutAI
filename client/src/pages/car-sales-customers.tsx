import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  Star,
  Calendar,
  DollarSign,
  Car,
  Filter,
  Plus,
  Eye
} from "lucide-react";

export default function CarSalesCustomers() {
  const [searchTerm, setSearchTerm] = useState("");

  const customers = [
    {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah.j@email.com",
      phone: "(555) 123-4567",
      status: "Active Lead",
      interest: "2023 Honda Accord",
      budget: "$25,000 - $30,000",
      lastContact: "2 days ago",
      rating: 4.5,
      notes: "Very interested, needs financing options"
    },
    {
      id: 2,
      name: "Mike Chen",
      email: "mchen@email.com", 
      phone: "(555) 234-5678",
      status: "Hot Lead",
      interest: "2024 Toyota Camry",
      budget: "$35,000+",
      lastContact: "1 hour ago",
      rating: 5.0,
      notes: "Ready to purchase this week"
    },
    {
      id: 3,
      name: "Lisa Rodriguez",
      email: "lisa.r@email.com",
      phone: "(555) 345-6789",
      status: "Follow Up",
      interest: "Used SUV",
      budget: "$20,000 - $25,000",
      lastContact: "1 week ago", 
      rating: 3.5,
      notes: "Needs more time to decide"
    }
  ];

  const prospects = [
    {
      id: 4,
      name: "David Wilson",
      email: "dwilson@email.com",
      phone: "(555) 456-7890",
      source: "Website Inquiry",
      interest: "Electric Vehicles",
      date: "Today"
    },
    {
      id: 5,
      name: "Amanda Foster",
      email: "afoster@email.com",
      phone: "(555) 567-8901",
      source: "Referral",
      interest: "Luxury Sedan",
      date: "Yesterday"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Users className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Customer Management</h1>
                <p className="text-gray-400">Track leads, customers, and sales opportunities</p>
              </div>
            </div>
            
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-customer">
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-navy-800/50 border-navy-600"
              />
            </div>
            <Button variant="outline" className="border-navy-600">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          <Tabs defaultValue="customers" className="space-y-6">
            <TabsList className="bg-navy-800/50 border border-navy-600">
              <TabsTrigger value="customers">Active Customers</TabsTrigger>
              <TabsTrigger value="prospects">New Prospects</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="space-y-4">
              {customers.map((customer) => (
                <Card key={customer.id} className="bg-navy-800/50 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-blue-400" />
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-lg">{customer.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                            <div className="flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              {customer.email}
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {customer.phone}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge 
                          variant={customer.status === "Hot Lead" ? "default" : "secondary"}
                          className={customer.status === "Hot Lead" ? "bg-green-600" : ""}
                        >
                          {customer.status}
                        </Badge>
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm">{customer.rating}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-navy-700">
                      <div>
                        <p className="text-sm text-gray-400">Interested In</p>
                        <p className="font-medium flex items-center gap-2">
                          <Car className="h-4 w-4 text-orange-400" />
                          {customer.interest}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-400">Budget Range</p>
                        <p className="font-medium flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-400" />
                          {customer.budget}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-400">Last Contact</p>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          {customer.lastContact}
                        </p>
                      </div>
                    </div>

                    {customer.notes && (
                      <div className="mt-4 p-3 bg-navy-700/30 rounded-lg">
                        <p className="text-sm text-gray-300">{customer.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" data-testid="button-view-customer">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <Button size="sm" variant="outline" data-testid="button-contact-customer">
                        <Phone className="h-4 w-4 mr-2" />
                        Contact
                      </Button>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" data-testid="button-schedule-appointment">
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="prospects" className="space-y-4">
              {prospects.map((prospect) => (
                <Card key={prospect.id} className="bg-navy-800/50 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-orange-400" />
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-lg">{prospect.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                            <div className="flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              {prospect.email}
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {prospect.phone}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Badge variant="secondary">
                        New Prospect
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-navy-700">
                      <div>
                        <p className="text-sm text-gray-400">Source</p>
                        <p className="font-medium">{prospect.source}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-400">Interest</p>
                        <p className="font-medium">{prospect.interest}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-400">Received</p>
                        <p className="font-medium">{prospect.date}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700" data-testid="button-contact-prospect">
                        <Phone className="h-4 w-4 mr-2" />
                        Make First Contact
                      </Button>
                      <Button size="sm" variant="outline" data-testid="button-qualify-prospect">
                        Qualify Lead
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="archived">
              <Card className="bg-navy-800/50 border-navy-600">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Archived Customers</h3>
                  <p className="text-gray-400">Archived customers will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}