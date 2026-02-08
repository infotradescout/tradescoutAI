import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  MapPin,
  Home,
  Briefcase,
  Network,
  Star,
  MessageSquare,
  Plus,
  ShieldCheck
} from "lucide-react";

export default function RealtorConnections() {
  const [activeTab, setActiveTab] = useState("contractors");

  const contractors = [
    {
      id: 1,
      name: "Elite Home Contractors",
      contact: "Mike Rodriguez",
      phone: "(555) 123-4567",
      email: "mike@elitehome.com",
      specialty: "Kitchen & Bath Remodeling",
      rating: 4.8,
      completedProjects: 45,
      location: "Downtown Area",
      status: "Preferred Partner",
      responseTime: "2 hours"
    },
    {
      id: 2,
      name: "Precision Roofing Co.",
      contact: "Sarah Johnson",
      phone: "(555) 234-5678", 
      email: "sarah@precisionroofing.com",
      specialty: "Roofing & Gutters",
      rating: 4.9,
      completedProjects: 78,
      location: "Citywide",
      status: "Active Partner",
      responseTime: "4 hours"
    },
    {
      id: 3,
      name: "Garden State Landscaping",
      contact: "David Chen",
      phone: "(555) 345-6789",
      email: "david@gardenstatescape.com", 
      specialty: "Landscaping & Outdoor Living",
      rating: 4.6,
      completedProjects: 32,
      location: "Suburban Areas",
      status: "New Partner",
      responseTime: "6 hours"
    }
  ];

  const lenders = [
    {
      id: 1,
      name: "First National Mortgage",
      contact: "Amanda Foster",
      phone: "(555) 456-7890",
      email: "afoster@firstnational.com",
      specialty: "Conventional & FHA Loans",
      rating: 4.7,
      avgCloseTime: "28 days",
      approvalRate: "94%",
      status: "Preferred Lender"
    },
    {
      id: 2,
      name: "Community Credit Union",
      contact: "James Wilson", 
      phone: "(555) 567-8901",
      email: "jwilson@communitycu.org",
      specialty: "First-Time Buyers",
      rating: 4.8,
      avgCloseTime: "25 days", 
      approvalRate: "91%",
      status: "Partner"
    }
  ];

  const inspectors = [
    {
      id: 1,
      name: "Metro Home Inspections",
      contact: "Lisa Rodriguez",
      phone: "(555) 678-9012",
      email: "lisa@metroinspect.com",
      specialty: "Residential Inspections",
      rating: 4.9,
      avgTurnaround: "24 hours",
      certifications: ["ASHI", "NAHI"],
      status: "Trusted Partner"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Preferred Partner":
      case "Preferred Lender": return "bg-green-600 hover:bg-green-700";
      case "Active Partner":
      case "Partner": return "bg-blue-600 hover:bg-blue-700"; 
      case "New Partner": return "bg-orange-600 hover:bg-orange-700";
      case "Trusted Partner": return "bg-purple-600 hover:bg-purple-700";
      default: return "bg-gray-600 hover:bg-gray-700";
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < Math.floor(rating) ? 'text-yellow-500 fill-current' : 'text-muted-foreground'}`} 
      />
    ));
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Network className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Professional Network</h1>
                <p className="text-muted-foreground">Manage your trusted contractors, lenders, and service providers</p>
              </div>
            </div>
            
            <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-connection">
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted border border-border">
              <TabsTrigger value="contractors">Contractors</TabsTrigger>
              <TabsTrigger value="lenders">Lenders</TabsTrigger>
              <TabsTrigger value="inspectors">Inspectors</TabsTrigger>
              <TabsTrigger value="others">Other Services</TabsTrigger>
            </TabsList>

            <TabsContent value="contractors" className="space-y-4">
              {contractors.map((contractor) => (
                <Card key={contractor.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                          <Home className="h-8 w-8 text-primary" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{contractor.name}</h3>
                            <Badge className={getStatusColor(contractor.status)}>
                              {contractor.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                {contractor.contact}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <ShieldCheck className="h-4 w-4" />
                                Contact protected via TradeScout
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Briefcase className="h-4 w-4" />
                                {contractor.specialty}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {contractor.location}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Rating</p>
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {renderStars(contractor.rating)}
                                </div>
                                <span className="font-medium">{contractor.rating}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Completed Projects</p>
                              <p className="font-semibold">{contractor.completedProjects}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Response Time</p>
                              <p className="font-semibold text-green-600 dark:text-green-400">{contractor.responseTime}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="button-contact-contractor"
                          onClick={() => {
                            window.location.href = `/direct-connect?intent=collaborate&source=realtor_connections&target=${encodeURIComponent(
                              contractor.name
                            )}`;
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Start Direct Connect
                        </Button>
                        <Button size="sm" className="bg-primary hover:bg-primary/90" data-testid="button-refer-contractor">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Refer
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="lenders" className="space-y-4">
              {lenders.map((lender) => (
                <Card key={lender.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                          <Briefcase className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{lender.name}</h3>
                            <Badge className={getStatusColor(lender.status)}>
                              {lender.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                {lender.contact}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <ShieldCheck className="h-4 w-4" />
                                Contact protected via TradeScout
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Briefcase className="h-4 w-4" />
                              {lender.specialty}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Rating</p>
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {renderStars(lender.rating)}
                                </div>
                                <span className="font-medium">{lender.rating}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Avg. Close Time</p>
                              <p className="font-semibold text-blue-600 dark:text-blue-400">{lender.avgCloseTime}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Approval Rate</p>
                              <p className="font-semibold text-green-600 dark:text-green-400">{lender.approvalRate}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="button-contact-lender"
                          onClick={() => {
                            window.location.href = `/direct-connect?intent=collaborate&source=realtor_connections&target=${encodeURIComponent(
                              lender.name
                            )}`;
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Start Direct Connect
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-refer-lender">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Refer Client
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="inspectors" className="space-y-4">
              {inspectors.map((inspector) => (
                <Card key={inspector.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                          <Home className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{inspector.name}</h3>
                            <Badge className={getStatusColor(inspector.status)}>
                              {inspector.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                {inspector.contact}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <ShieldCheck className="h-4 w-4" />
                                Contact protected via TradeScout
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Rating</p>
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {renderStars(inspector.rating)}
                                </div>
                                <span className="font-medium">{inspector.rating}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Turnaround</p>
                              <p className="font-semibold text-blue-600 dark:text-blue-400">{inspector.avgTurnaround}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Certifications</p>
                              <p className="font-semibold">{inspector.certifications.join(", ")}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="button-schedule-inspection"
                        onClick={() => {
                          window.location.href = `/direct-connect?intent=collaborate&source=realtor_connections&target=${encodeURIComponent(
                            inspector.name
                          )}`;
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Start Direct Connect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="others">
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Other Service Providers</h3>
                  <p className="text-muted-foreground mb-6">
                    Add other professionals like attorneys, appraisers, and title companies
                  </p>
                  <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-service-provider">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service Provider
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
  );
}
