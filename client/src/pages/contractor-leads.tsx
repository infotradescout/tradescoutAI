import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MapPin, DollarSign, Calendar, MessageSquare, Filter } from "lucide-react";

const ContractorLeads = memo(function ContractorLeads() {
  // Mock data - would come from API in real app
  const leads = [
    {
      id: 1,
      title: "Kitchen Renovation",
      description: "Complete kitchen remodel including cabinets, countertops, and appliances. Looking for experienced contractor with portfolio.",
      budget: "$25,000 - $50,000",
      timeline: "Within 1-2 months",
      location: "Los Angeles, CA 90001",
      postedDate: "2 hours ago",
      responses: 3,
      status: "new"
    },
    {
      id: 2,
      title: "Bathroom Plumbing Repair",
      description: "Need urgent repair for leaking pipes and fixture replacement in master bathroom.",
      budget: "$1,000 - $5,000",
      timeline: "As soon as possible",
      location: "Beverly Hills, CA 90210",
      postedDate: "5 hours ago",
      responses: 8,
      status: "hot"
    },
    {
      id: 3,
      title: "Exterior House Painting",
      description: "2-story house exterior painting. Approximately 2,500 sq ft. Surface prep needed.",
      budget: "$5,000 - $10,000",
      timeline: "Within 1 month",
      location: "Santa Monica, CA 90401",
      postedDate: "1 day ago",
      responses: 12,
      status: "active"
    },
    {
      id: 4,
      title: "HVAC System Installation",
      description: "Installing new central air conditioning system for 1,800 sq ft home. Need licensed professional.",
      budget: "$10,000 - $25,000",
      timeline: "1-3 months",
      location: "Pasadena, CA 91101",
      postedDate: "2 days ago",
      responses: 5,
      status: "active"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'hot':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1419] pb-20 lg:pb-0">
      <div className="container mx-auto px-4 py-6 lg:py-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 lg:mb-12">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-5xl font-bold text-white mb-1">Project Opportunities</h1>
                  <p className="text-lg text-slate-400">
                    Connect with homeowners looking for your services
                  </p>
                </div>
              </div>
              <Button variant="outline" className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500 mb-1">{leads.length}</p>
                  <p className="text-sm text-slate-400">Available Projects</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500 mb-1">2</p>
                  <p className="text-sm text-slate-400">New Today</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500 mb-1">12</p>
                  <p className="text-sm text-slate-400">Your Responses</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-500 mb-1">5</p>
                  <p className="text-sm text-slate-400">Pending Replies</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Leads List */}
          <div className="space-y-4">
            {leads.map((lead) => (
              <Card key={lead.id} className="bg-[#1a2332] border-[#2d3748] shadow-xl hover:border-orange-500/30 transition-all">
                <CardHeader className="border-b border-[#2d3748] pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl text-white">{lead.title}</CardTitle>
                        <Badge className={`${getStatusColor(lead.status)} border`}>
                          {lead.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">Posted {lead.postedDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400 mb-1">Responses</p>
                      <p className="text-2xl font-bold text-orange-500">{lead.responses}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-slate-200 mb-6 leading-relaxed">{lead.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <DollarSign className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Budget</p>
                        <p className="text-white font-medium">{lead.budget}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Timeline</p>
                        <p className="text-white font-medium">{lead.timeline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm md:col-span-2">
                      <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Location</p>
                        <p className="text-white font-medium">{lead.location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white" data-testid={`button-respond-${lead.id}`}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Respond to Project
                    </Button>
                    <Button variant="outline" className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]">
                      View Details
                    </Button>
                    <Button variant="outline" className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]">
                      Save for Later
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State (hidden when there are leads) */}
          {leads.length === 0 && (
            <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
              <CardContent className="pt-12 pb-12 text-center">
                <TrendingUp className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">No Projects Available</h2>
                <p className="text-slate-400 mb-6">
                  Check back soon for new project opportunities in your area
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
});

export default ContractorLeads;
