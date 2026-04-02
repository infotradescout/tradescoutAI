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
  MapPin,
  Home,
  DollarSign,
  Calendar,
  Plus,
  Eye,
  Edit,
} from "lucide-react";

export default function RealtorClients() {
  const [searchTerm, setSearchTerm] = useState("");

  const activeClients = [
    {
      id: 1,
      name: "Sarah & John Martinez",
      email: "smartinez@email.com",
      phone: "(555) 123-4567",
      type: "Buyer",
      budget: "$450,000 - $550,000",
      location: "Downtown Area",
      status: "Active Search",
      properties: 8,
      lastContact: "2 days ago",
    },
    {
      id: 2,
      name: "David Chen",
      email: "dchen@email.com",
      phone: "(555) 234-5678",
      type: "Seller",
      listingPrice: "$725,000",
      location: "Riverside District",
      status: "Market Ready",
      properties: 1,
      lastContact: "1 day ago",
    },
    {
      id: 3,
      name: "Amanda Foster",
      email: "afoster@email.com",
      phone: "(555) 345-6789",
      type: "Buyer",
      budget: "$300,000 - $400,000",
      location: "Suburban Area",
      status: "Under Contract",
      properties: 12,
      lastContact: "3 hours ago",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active Search":
        return "bg-blue-600";
      case "Market Ready":
        return "bg-green-600";
      case "Under Contract":
        return "bg-ts-orange-dark";
      case "Closed":
        return "bg-white/10";
      default:
        return "bg-white/10";
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "Buyer" ? <Home className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />;
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-8">
      <div className="container mx-auto px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Users className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Client Management</h1>
                <p className="text-white/60">Manage your buyers, sellers, and prospects</p>
              </div>
            </div>

            <Button className="bg-green-600 hover:bg-green-700" data-testid="button-add-client">
              <Plus className="h-4 w-4 mr-2" />
              Add New Client
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-tsCard/50 border-white/10"
                data-testid="input-search-clients"
              />
            </div>
            <Button
              variant="outline"
              className="border-white/10"
              data-testid="button-filter-clients"
            >
              Filter
            </Button>
          </div>

          <Tabs defaultValue="active" className="space-y-6">
            <TabsList className="bg-tsCard/50 border border-white/10">
              <TabsTrigger value="active">Active Clients</TabsTrigger>
              <TabsTrigger value="prospects">Prospects</TabsTrigger>
              <TabsTrigger value="closed">Closed Deals</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeClients.map((client) => (
                <Card key={client.id} className="bg-tsCard/50 border-white/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                          {getTypeIcon(client.type)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{client.name}</h3>
                            <Badge className="bg-blue-600">{client.type}</Badge>
                            <Badge className={getStatusColor(client.status)}>{client.status}</Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-white/60">
                              <Mail className="h-4 w-4" />
                              {client.email}
                            </div>
                            <div className="flex items-center gap-2 text-white/60">
                              <Phone className="h-4 w-4" />
                              {client.phone}
                            </div>
                            <div className="flex items-center gap-2 text-white/60">
                              <MapPin className="h-4 w-4" />
                              {client.location}
                            </div>
                            <div className="flex items-center gap-2 text-white/60">
                              <Calendar className="h-4 w-4" />
                              Last contact: {client.lastContact}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-white/60">
                                {client.type === "Buyer" ? "Budget Range" : "Listing Price"}
                              </p>
                              <p className="font-semibold text-green-400">
                                {client.type === "Buyer" ? client.budget : client.listingPrice}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-white/60">Properties Viewed/Listed</p>
                              <p className="font-semibold">{client.properties} properties</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid="button-view-client">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="button-start-direct-connect-client"
                          onClick={() => {
                            window.location.href = `/direct-connect?intent=follow_up&source=realtor_clients&target=${encodeURIComponent(
                              client.name
                            )}`;
                          }}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Start Direct Connect
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          data-testid="button-schedule-showing"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="prospects">
              <Card className="bg-tsCard/50 border-white/10">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-white/60 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Prospects Yet</h3>
                  <p className="text-white/60 mb-6">Potential clients will appear here</p>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-add-prospect"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Prospect
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="closed">
              <Card className="bg-tsCard/50 border-white/10">
                <CardContent className="p-8 text-center">
                  <Home className="h-12 w-12 text-white/60 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Closed Deals</h3>
                  <p className="text-white/60">Completed transactions will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
