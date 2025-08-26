import { memo, useState } from 'react';
import { Headphones, Plus, MessageSquare, Clock, CheckCircle2, XCircle, AlertTriangle, Users2, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const SupportTickets = memo(function SupportTickets() {
  const [activeTab, setActiveTab] = useState("open");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const { toast } = useToast();

  const openTickets = [
    {
      id: 1,
      subject: "Cannot verify contractor license",
      category: "Account",
      priority: "high",
      status: "open",
      user: {
        name: "Mike Johnson",
        email: "mike@example.com",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face"
      },
      description: "I uploaded my contractor license documents 3 days ago but my account is still showing as unverified. I need to start getting connections for my roofing business.",
      createdAt: "2024-03-20T10:30:00Z",
      updatedAt: "2024-03-20T14:15:00Z",
      assignedTo: "Sarah Wilson",
      messages: 3
    },
    {
      id: 2,
      subject: "Payment issue with subscription",
      category: "Billing",
      priority: "medium",
      status: "in_progress",
      user: {
        name: "Jennifer Smith",
        email: "jennifer@example.com",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612d76c?w=40&h=40&fit=crop&crop=face"
      },
      description: "My credit card was charged but my Accelerator membership is not showing as active. I need access to the premium features.",
      createdAt: "2024-03-20T09:15:00Z",
      updatedAt: "2024-03-20T13:45:00Z",
      assignedTo: "Tom Davis",
      messages: 5
    }
  ];

  const resolvedTickets = [
    {
      id: 3,
      subject: "How to add more service areas",
      category: "General",
      priority: "low",
      status: "resolved",
      user: {
        name: "Bob Wilson",
        email: "bob@example.com",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face"
      },
      description: "I need to expand my service areas to include more counties. How do I update my profile?",
      createdAt: "2024-03-19T16:20:00Z",
      resolvedAt: "2024-03-19T17:45:00Z",
      assignedTo: "Sarah Wilson",
      messages: 2
    }
  ];

  const handleAssignTicket = (ticketId: number, agent: string) => {
    toast({
      title: "Ticket Assigned",
      description: `Ticket has been assigned to ${agent}.`,
    });
  };

  const handleUpdateStatus = (ticketId: number, status: string) => {
    toast({
      title: "Status Updated",
      description: `Ticket status has been updated to ${status}.`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-blue-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-600 text-red-400';
      case 'medium':
        return 'border-yellow-600 text-yellow-400';
      case 'low':
        return 'border-green-600 text-green-400';
      default:
        return 'border-gray-600 text-gray-400';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Account':
        return 'bg-blue-600';
      case 'Billing':
        return 'bg-purple-600';
      case 'Technical':
        return 'bg-orange-600';
      case 'General':
        return 'bg-gray-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Headphones className="h-8 w-8 text-orange-400" />
              <div>
                <h1 className="text-4xl font-bold text-white">Support Tickets</h1>
                <p className="text-gray-300 text-lg">Manage customer support requests and issues</p>
              </div>
            </div>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Open Tickets</p>
                  <p className="text-2xl font-bold text-white">{openTickets.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">In Progress</p>
                  <p className="text-2xl font-bold text-white">8</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Resolved Today</p>
                  <p className="text-2xl font-bold text-white">15</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Avg Response Time</p>
                  <p className="text-2xl font-bold text-white">2.1h</p>
                </div>
                <Users2 className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tickets List */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="flex items-center justify-between">
                <TabsList className="bg-navy-800 border-navy-600">
                  <TabsTrigger value="open" className="data-[state=active]:bg-orange-600">
                    Open ({openTickets.length})
                  </TabsTrigger>
                  <TabsTrigger value="resolved" className="data-[state=active]:bg-orange-600">
                    Resolved ({resolvedTickets.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="data-[state=active]:bg-orange-600">
                    All Tickets
                  </TabsTrigger>
                </TabsList>

                <Button variant="outline" size="sm" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>

              <TabsContent value="open" className="space-y-4">
                {openTickets.map((ticket) => (
                  <Card 
                    key={ticket.id} 
                    className={`bg-navy-800/50 border-navy-600 backdrop-blur-sm cursor-pointer transition-colors hover:bg-navy-700/50 ${selectedTicket?.id === ticket.id ? 'ring-2 ring-orange-600' : ''}`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(ticket.status)}
                          <div>
                            <h3 className="text-white font-medium">{ticket.subject}</h3>
                            <p className="text-gray-400 text-sm">#{ticket.id} • {ticket.user.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                            {ticket.priority.toUpperCase()}
                          </Badge>
                          <Badge className={getCategoryColor(ticket.category)}>
                            {ticket.category}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-gray-300 text-sm mb-4 line-clamp-2">{ticket.description}</p>

                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <div className="flex items-center gap-4">
                          <span>Assigned to: {ticket.assignedTo}</span>
                          <span>{ticket.messages} messages</span>
                        </div>
                        <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="resolved" className="space-y-4">
                {resolvedTickets.map((ticket) => (
                  <Card 
                    key={ticket.id} 
                    className="bg-navy-800/50 border-navy-600 backdrop-blur-sm cursor-pointer transition-colors hover:bg-navy-700/50"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(ticket.status)}
                          <div>
                            <h3 className="text-white font-medium">{ticket.subject}</h3>
                            <p className="text-gray-400 text-sm">#{ticket.id} • {ticket.user.name}</p>
                          </div>
                        </div>
                        <Badge className="bg-green-600 text-white">RESOLVED</Badge>
                      </div>

                      <p className="text-gray-300 text-sm mb-4 line-clamp-2">{ticket.description}</p>

                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>Resolved by: {ticket.assignedTo}</span>
                        <span>{new Date(ticket.resolvedAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* Ticket Detail */}
          <div className="space-y-6">
            {selectedTicket ? (
              <>
                <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Ticket #{selectedTicket.id}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={selectedTicket.user.avatar} />
                        <AvatarFallback>{selectedTicket.user.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-white font-medium">{selectedTicket.user.name}</p>
                        <p className="text-gray-400 text-sm">{selectedTicket.user.email}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-2">Subject</h4>
                      <p className="text-gray-300">{selectedTicket.subject}</p>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-2">Description</h4>
                      <p className="text-gray-300">{selectedTicket.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white">Priority</Label>
                        <Select defaultValue={selectedTicket.priority}>
                          <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-white">Status</Label>
                        <Select defaultValue={selectedTicket.status}>
                          <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-white">Assign To</Label>
                      <Select defaultValue={selectedTicket.assignedTo}>
                        <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sarah Wilson">Sarah Wilson</SelectItem>
                          <SelectItem value="Tom Davis">Tom Davis</SelectItem>
                          <SelectItem value="Mike Chen">Mike Chen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark as Resolved
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full border-orange-600 text-orange-400 hover:bg-orange-600/20"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Add Response
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Quick Response</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea 
                      placeholder="Type your response to the customer..."
                      className="bg-navy-700 border-navy-600 text-white"
                      rows={4}
                    />
                    <Button className="w-full bg-orange-600 hover:bg-orange-700">
                      Send Response
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Select a Ticket</h3>
                  <p className="text-gray-400">Choose a ticket from the list to view details and respond</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SupportTickets;