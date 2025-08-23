import { memo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Phone, Mail, MapPin, Calendar, Clock, Filter, Search, TrendingUp } from 'lucide-react';

const LeadManagement = memo(function LeadManagement() {
  const [selectedLead, setSelectedLead] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const leads = [
    {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      phone: "(555) 123-4567",
      location: "Beverly Hills, CA",
      service: "Kitchen Renovation",
      budget: "$15,000-$25,000",
      status: "new",
      priority: "high",
      source: "Facebook",
      dateAdded: "2024-03-20",
      lastContact: "Never",
      notes: "Interested in complete kitchen remodel. Mentioned timeline of 2 months."
    },
    {
      id: 2,
      name: "Mike Chen",
      email: "mike.chen@email.com",
      phone: "(555) 234-5678",
      location: "Santa Monica, CA",
      service: "Bathroom Remodel",
      budget: "$8,000-$12,000",
      status: "contacted",
      priority: "medium",
      source: "Website",
      dateAdded: "2024-03-18",
      lastContact: "2024-03-19",
      notes: "Responded to initial quote. Scheduled for site visit next week."
    },
    {
      id: 3,
      name: "Emily Davis",
      email: "emily.davis@email.com",
      phone: "(555) 345-6789",
      location: "Pasadena, CA",
      service: "Deck Installation",
      budget: "$5,000-$8,000",
      status: "quoted",
      priority: "medium",
      source: "Referral",
      dateAdded: "2024-03-15",
      lastContact: "2024-03-17",
      notes: "Quote sent. Waiting for response. Very interested in composite decking."
    },
    {
      id: 4,
      name: "David Wilson",
      email: "david.wilson@email.com",
      phone: "(555) 456-7890",
      location: "Malibu, CA",
      service: "Pool Installation",
      budget: "$35,000-$50,000",
      status: "proposal",
      priority: "high",
      source: "Google",
      dateAdded: "2024-03-10",
      lastContact: "2024-03-18",
      notes: "Detailed proposal submitted. High-value project. Very qualified buyer."
    },
    {
      id: 5,
      name: "Lisa Brown",
      email: "lisa.brown@email.com",
      phone: "(555) 567-8901",
      location: "Manhattan Beach, CA",
      service: "Home Addition",
      budget: "$25,000-$40,000",
      status: "won",
      priority: "high",
      source: "Daily Deals",
      dateAdded: "2024-03-05",
      lastContact: "2024-03-19",
      notes: "Project won! Contract signed. Start date scheduled for April 1st."
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-600 hover:bg-blue-700';
      case 'contacted': return 'bg-yellow-600 hover:bg-yellow-700';
      case 'quoted': return 'bg-purple-600 hover:bg-purple-700';
      case 'proposal': return 'bg-orange-600 hover:bg-orange-700';
      case 'won': return 'bg-emerald-600 hover:bg-emerald-700';
      case 'lost': return 'bg-red-600 hover:bg-red-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const filteredLeads = filterStatus === 'all' 
    ? leads 
    : leads.filter(lead => lead.status === filterStatus);

  const leadStats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    quoted: leads.filter(l => l.status === 'quoted').length,
    won: leads.filter(l => l.status === 'won').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Lead Management</h1>
          <p className="text-xl text-gray-300">
            Track and manage your customer leads through the sales pipeline
          </p>
        </div>

        {/* Lead Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">{leadStats.total}</p>
              <p className="text-gray-400 text-sm">Total Leads</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{leadStats.new}</p>
              <p className="text-gray-400 text-sm">New</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{leadStats.contacted}</p>
              <p className="text-gray-400 text-sm">Contacted</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{leadStats.quoted}</p>
              <p className="text-gray-400 text-sm">Quoted</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{leadStats.won}</p>
              <p className="text-gray-400 text-sm">Won</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pipeline" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="pipeline" className="data-[state=active]:bg-orange-600">Sales Pipeline</TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-orange-600">Lead Details</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-orange-600">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-orange-500" />
                      Lead Pipeline
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Manage leads through your sales process
                    </CardDescription>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="all">All Leads</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="quoted">Quoted</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <Input 
                        placeholder="Search leads..."
                        className="pl-10 w-64 bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="p-4 bg-slate-700/30 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-white mb-1">{lead.name}</h3>
                          <p className="text-gray-400 text-sm">{lead.service}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`border ${getPriorityColor(lead.priority)}`}>
                            {lead.priority}
                          </Badge>
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Phone className="w-4 h-4 text-blue-400" />
                          <span>{lead.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Mail className="w-4 h-4 text-emerald-400" />
                          <span>{lead.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <MapPin className="w-4 h-4 text-purple-400" />
                          <span>{lead.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Calendar className="w-4 h-4 text-orange-400" />
                          <span>{lead.dateAdded}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-300 text-sm">Budget: <span className="text-emerald-400 font-medium">{lead.budget}</span></p>
                          <p className="text-gray-400 text-xs">Source: {lead.source}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">Call</Button>
                          <Button size="sm" variant="outline">Email</Button>
                          <Button size="sm" className="bg-orange-600 hover:bg-orange-700">View</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Lead Details</CardTitle>
                <CardDescription className="text-gray-400">
                  Detailed view and interaction history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedLead ? (
                  <div>Lead details would go here</div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">Select a lead from the pipeline to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Conversion Rates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Lead to Contact</span>
                      <span className="text-emerald-400 font-medium">85%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Contact to Quote</span>
                      <span className="text-emerald-400 font-medium">67%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Quote to Proposal</span>
                      <span className="text-emerald-400 font-medium">45%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Proposal to Win</span>
                      <span className="text-emerald-400 font-medium">30%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Response Times
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
                      <p className="text-blue-400 font-medium">Average Response Time</p>
                      <p className="text-2xl font-bold text-white">2.3 hours</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-gray-300">
                        <span>&lt; 1 hour</span>
                        <span>45%</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>1-4 hours</span>
                        <span>32%</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>4-24 hours</span>
                        <span>18%</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>&gt; 24 hours</span>
                        <span>5%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default LeadManagement;