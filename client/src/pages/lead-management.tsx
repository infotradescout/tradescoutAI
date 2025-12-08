import { memo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Phone, Mail, MapPin, Calendar, Clock, Filter, Search, TrendingUp, Wrench, DollarSign } from 'lucide-react';
import { getStatusColorClass } from '@/lib/colors';

const ProjectTracker = memo(function ProjectTracker() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const projects = [
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
    return getStatusColorClass(status);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const filteredProjects = filterStatus === 'all' 
    ? projects 
    : projects.filter(project => project.status === filterStatus);

  const projectStats = {
    total: projects.length,
    new: projects.filter(p => p.status === 'new').length,
    contacted: projects.filter(p => p.status === 'contacted').length,
    quoted: projects.filter(p => p.status === 'quoted').length,
    won: projects.filter(p => p.status === 'won').length
  };

  return (
    <div className="min-h-screen gradient-bg pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Project Tracker</h1>
          <p className="text-gray-400">Manage and track your project opportunities</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400">Total Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{projectStats.total}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400">New Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">{projectStats.new}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">{projectStats.contacted}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400">Quoted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-400">{projectStats.quoted}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400">Projects Won</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">{projectStats.won}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-white">All Projects</CardTitle>
                <CardDescription>Track and manage project requests</CardDescription>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    placeholder="Search projects..." 
                    className="pl-10 bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40 bg-slate-900/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <Card key={project.id} className="bg-slate-900/50 border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                          <Badge className={`${getStatusColor(project.status)} text-white border-0`}>
                            {project.status}
                          </Badge>
                          <Badge variant="outline" className={`${getPriorityColor(project.priority)} border`}>
                            {project.priority}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-gray-400">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            <span>{project.service}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{project.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span>{project.budget}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Added {project.dateAdded}</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-500 mt-2">{project.notes}</p>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-700">
                          <Phone className="w-4 h-4 mr-2" />
                          Call
                        </Button>
                        <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-700">
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default ProjectTracker;
