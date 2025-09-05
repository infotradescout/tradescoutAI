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
  MessageSquare,
  Calendar,
  Tag,
  Plus,
  Edit,
  Filter,
  Heart,
  Star,
  Home
} from "lucide-react";

export default function RealtorContacts() {
  const [searchTerm, setSearchTerm] = useState("");

  const contacts = [
    {
      id: 1,
      name: "Sarah Martinez",
      email: "sarah.martinez@email.com",
      phone: "(555) 123-4567",
      type: "Client",
      status: "Active",
      lastContact: "2 days ago",
      tags: ["Buyer", "First-time"],
      notes: "Looking for family home under $500k",
      source: "Referral",
      rating: 5
    },
    {
      id: 2,
      name: "David Chen",
      email: "dchen@email.com",
      phone: "(555) 234-5678", 
      type: "Client",
      status: "Under Contract",
      lastContact: "1 day ago",
      tags: ["Seller", "Investment"],
      notes: "Selling rental property, may buy another",
      source: "Website",
      rating: 4
    },
    {
      id: 3,
      name: "Amanda Foster", 
      email: "amanda.foster@email.com",
      phone: "(555) 345-6789",
      type: "Lead",
      status: "Follow-up",
      lastContact: "3 days ago",
      tags: ["Buyer", "Luxury"],
      notes: "High-end property buyer, budget 800k+",
      source: "Open House",
      rating: null
    },
    {
      id: 4,
      name: "Mike Rodriguez",
      email: "mike.r@email.com",
      phone: "(555) 456-7890",
      type: "Partner",
      status: "Active",
      lastContact: "1 week ago",
      tags: ["Contractor", "Referral Source"],
      notes: "Kitchen remodeling specialist",
      source: "Networking Event",
      rating: 5
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-600";
      case "Follow-up": return "bg-yellow-600";
      case "Under Contract": return "bg-blue-600";
      case "Closed": return "bg-gray-600";
      default: return "bg-gray-600";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Client": return <Users className="h-4 w-4" />;
      case "Lead": return <Star className="h-4 w-4" />;
      case "Partner": return <Heart className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-gray-400 text-sm">Not rated</span>;
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Star 
            key={i} 
            className={`h-3 w-3 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Users className="h-8 w-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Contact Management</h1>
                <p className="text-gray-400">Manage clients, leads, and professional contacts</p>
              </div>
            </div>
            
            <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-add-contact">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-navy-800/50 border-navy-600"
                data-testid="input-search-contacts"
              />
            </div>
            <Button variant="outline" className="border-navy-600" data-testid="button-filter-contacts">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="bg-navy-800/50 border border-navy-600">
              <TabsTrigger value="all">All Contacts</TabsTrigger>
              <TabsTrigger value="clients">Clients</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="partners">Partners</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {contacts.map((contact) => (
                <Card key={contact.id} className="bg-navy-800/50 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                          {getTypeIcon(contact.type)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{contact.name}</h3>
                            <Badge className="bg-blue-600">{contact.type}</Badge>
                            <Badge className={getStatusColor(contact.status)}>
                              {contact.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-3">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Mail className="h-4 w-4" />
                              {contact.email}
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Phone className="h-4 w-4" />
                              {contact.phone}
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Calendar className="h-4 w-4" />
                              Last contact: {contact.lastContact}
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Home className="h-4 w-4" />
                              Source: {contact.source}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-purple-400" />
                              <div className="flex gap-1">
                                {contact.tags.map((tag, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">Rating:</span>
                              {renderStars(contact.rating)}
                            </div>
                          </div>

                          {contact.notes && (
                            <div className="p-3 bg-navy-700/30 rounded-lg">
                              <p className="text-sm text-gray-300">{contact.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid="button-edit-contact">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" data-testid="button-call-contact">
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline" data-testid="button-email-contact">
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </Button>
                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700" data-testid="button-schedule-contact">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="clients">
              <div className="space-y-4">
                {contacts.filter(c => c.type === "Client").map((contact) => (
                  <Card key={contact.id} className="bg-navy-800/50 border-navy-600">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                            <Users className="h-6 w-6 text-green-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{contact.name}</h3>
                            <p className="text-sm text-gray-400">{contact.email} • {contact.phone}</p>
                            <div className="flex gap-1 mt-1">
                              {contact.tags.map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Badge className={getStatusColor(contact.status)}>
                          {contact.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="leads">
              <div className="space-y-4">
                {contacts.filter(c => c.type === "Lead").map((contact) => (
                  <Card key={contact.id} className="bg-navy-800/50 border-navy-600">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                            <Star className="h-6 w-6 text-yellow-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{contact.name}</h3>
                            <p className="text-sm text-gray-400">{contact.email} • {contact.phone}</p>
                            <p className="text-sm text-gray-500">Source: {contact.source}</p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" data-testid="button-convert-lead">
                          Convert to Client
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="partners">
              <div className="space-y-4">
                {contacts.filter(c => c.type === "Partner").map((contact) => (
                  <Card key={contact.id} className="bg-navy-800/50 border-navy-600">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                            <Heart className="h-6 w-6 text-red-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{contact.name}</h3>
                            <p className="text-sm text-gray-400">{contact.email} • {contact.phone}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {renderStars(contact.rating)}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700" data-testid="button-send-referral">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send Referral
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}