import { memo, useState } from 'react';
import { Home, DollarSign, Users, Calendar, FileText, Vote, Wrench, BarChart3, MessageSquare, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommunityShell } from '@/components/layout/CommunityShell';
import { useNotifications } from "@/hooks/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocationContext } from "@/hooks/useLocationContext";
import { useParams } from "wouter";

type HoaDashboard = {
  hoaId: string;
  hoaName: string;
  memberCount: number;
  activeMembers: number;
  openVotesCount: number;
  groupType: "hoa";
  recentVotes: {
    id: string;
    title: string;
    status: string;
    closesAt: string | null;
  }[];
  balance?: number;
  recentTransactions?: {
    id: string;
    type: string;
    amount: number;
    occurredAt: string;
  }[];
};

const HOADashboard = memo(function HOADashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const params = useParams();
  const hoaId = params?.hoaId as string | undefined;
  const location = useLocationContext({
    layer: "hoa",
    hoaId: hoaId ?? undefined,
  });

  const { data, isLoading, isError } = useQuery<{ dashboard: HoaDashboard}>(
    {
      queryKey: ["/api/hoa/dashboard", location.layer, location.stateCode, location.countyFips, location.hoaId],
      queryFn: async () => {
        const query = hoaId ? `?hoaId=${encodeURIComponent(hoaId)}` : "";
        const res = await fetch(`/api/hoa/dashboard${query}`);
        if (!res.ok) {
          throw new Error("Failed to load HOA dashboard");
        }
        return res.json();
      },
      enabled: !!user,
    }
  );

  const dashboard = data?.dashboard;

  return (
    <CommunityShell sectionLabel="HOA Dashboard" notificationsCount={unreadCount}>
      <div className="w-full py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Home className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">HOA Management</h1>
          </div>
          <p className="text-gray-300 text-lg">
            {dashboard ? `${dashboard.hoaName} Dashboard` : "Loading HOA dashboard..."}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" data-testid="hoa-dashboard-metrics">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Units</p>
                  <p className="text-2xl font-bold text-white">{dashboard ? dashboard.memberCount : 0}</p>
                </div>
                <Home className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-white">{dashboard && typeof dashboard.balance === 'number' ? `$${dashboard.balance.toLocaleString()}` : '--'}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Active Residents</p>
                  <p className="text-2xl font-bold text-white">{dashboard ? dashboard.activeMembers : 0}</p>
                </div>
                <Users className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Collection Rate</p>
                  <p className="text-2xl font-bold text-white">{dashboard && typeof dashboard.balance === 'number' ? '100%' : '--'}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-navy-800/50 backdrop-blur-sm">
            <TabsTrigger value="overview" className="data-[state=active]:bg-orange-600">Overview</TabsTrigger>
            <TabsTrigger value="financials" className="data-[state=active]:bg-orange-600">Financials</TabsTrigger>
            <TabsTrigger value="maintenance" className="data-[state=active]:bg-orange-600">Maintenance</TabsTrigger>
            <TabsTrigger value="voting" className="data-[state=active]:bg-orange-600">Voting</TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-orange-600">Documents</TabsTrigger>
            <TabsTrigger value="residents" className="data-[state=active]:bg-orange-600">Residents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activities */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Recent Activities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { type: "payment", message: "Unit 247 - HOA dues received", time: "2 hours ago", status: "success" },
                      { type: "maintenance", message: "Pool maintenance scheduled", time: "4 hours ago", status: "info" },
                      { type: "vote", message: "Landscaping proposal - Voting closed", time: "1 day ago", status: "warning" },
                      { type: "document", message: "Monthly financial report uploaded", time: "2 days ago", status: "info" },
                    ].map((activity, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-navy-700/50 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.status === 'success' ? 'bg-green-400' :
                          activity.status === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                        }`} />
                        <div className="flex-1">
                          <p className="text-white text-sm">{activity.message}</p>
                          <p className="text-gray-400 text-xs">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Current Issues */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Active Maintenance Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { issue: "Pool pump replacement", priority: "High", unit: "Common Area", status: "In Progress" },
                      { issue: "Parking lot lighting", priority: "Medium", unit: "Common Area", status: "Scheduled" },
                      { issue: "Mailbox repair", priority: "Low", unit: "Building B", status: "Pending" },
                    ].map((issue, index) => (
                      <div key={index} className="p-3 bg-navy-700/50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-white font-medium">{issue.issue}</p>
                          <Badge variant={
                            issue.priority === 'High' ? 'destructive' :
                            issue.priority === 'Medium' ? 'default' : 'secondary'
                          }>
                            {issue.priority}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>{issue.unit}</span>
                          <span>{issue.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="financials" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Budget Overview */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    2024 Budget Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {[
                      { category: "Maintenance & Repairs", budget: 120000, spent: 85000, percentage: 71 },
                      { category: "Landscaping", budget: 45000, spent: 32000, percentage: 71 },
                      { category: "Insurance", budget: 35000, spent: 35000, percentage: 100 },
                      { category: "Utilities", budget: 55000, spent: 41000, percentage: 75 },
                      { category: "Management Fees", budget: 25000, spent: 18500, percentage: 74 },
                    ].map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-white">{item.category}</span>
                          <span className="text-gray-400">${item.spent.toLocaleString()} / ${item.budget.toLocaleString()}</span>
                        </div>
                        <Progress value={item.percentage} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Status */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Payment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400">96%</div>
                      <p className="text-gray-400 text-sm">Collection Rate</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Paid on time</span>
                        <span className="text-green-400">141 units</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Late payments</span>
                        <span className="text-yellow-400">4 units</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Outstanding</span>
                        <span className="text-red-400">2 units</span>
                      </div>
                    </div>

                    <Button className="w-full bg-orange-600 hover:bg-orange-700">
                      Send Payment Reminders
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Approved Vendors */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Approved Vendors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { name: "Elite Pool Service", specialty: "Pool Maintenance", rating: 4.9, jobs: 12 },
                      { name: "GreenScape Landscaping", specialty: "Landscaping", rating: 4.8, jobs: 8 },
                      { name: "Reliable Handyman", specialty: "General Repairs", rating: 4.7, jobs: 15 },
                      { name: "ProClean Services", specialty: "Cleaning", rating: 4.6, jobs: 6 },
                    ].map((vendor, index) => (
                      <div key={index} className="p-3 bg-navy-700/50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-white font-medium">{vendor.name}</p>
                            <p className="text-gray-400 text-sm">{vendor.specialty}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-yellow-400 text-sm">★ {vendor.rating}</div>
                            <div className="text-gray-400 text-xs">{vendor.jobs} jobs</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance Requests */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Recent Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { request: "Broken gate remote", unit: "Unit 145", status: "Completed", date: "2 days ago" },
                      { request: "Leaky faucet in clubhouse", unit: "Common Area", status: "In Progress", date: "3 days ago" },
                      { request: "Parking lot pothole", unit: "Building A", status: "Scheduled", date: "5 days ago" },
                      { request: "Burned out hallway light", unit: "Building C", status: "Pending", date: "1 week ago" },
                    ].map((request, index) => (
                      <div key={index} className="p-3 bg-navy-700/50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-white text-sm">{request.request}</p>
                          <Badge variant={
                            request.status === 'Completed' ? 'default' :
                            request.status === 'In Progress' ? 'default' :
                            request.status === 'Scheduled' ? 'secondary' : 'destructive'
                          }>
                            {request.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{request.unit}</span>
                          <span>{request.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="voting" className="mt-6">
            <div className="space-y-6">
              {/* Active Votes */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Vote className="h-5 w-5" />
                    Active Voting
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {[
                      {
                        title: "Playground Equipment Upgrade",
                        description: "Proposal to replace existing playground equipment with new, safer options",
                        budget: "$25,000",
                        deadline: "5 days remaining",
                        votes: { yes: 89, no: 23, abstain: 12 },
                        total: 147
                      },
                      {
                        title: "Pool Area Security Cameras",
                        description: "Installation of security cameras around the pool area for safety",
                        budget: "$8,500",
                        deadline: "12 days remaining",
                        votes: { yes: 67, no: 15, abstain: 8 },
                        total: 147
                      }
                    ].map((vote, index) => (
                      <div key={index} className="p-4 bg-navy-700/50 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-white font-semibold text-lg">{vote.title}</h3>
                            <p className="text-gray-400 text-sm mt-1">{vote.description}</p>
                            <p className="text-orange-400 text-sm mt-2">Budget: {vote.budget}</p>
                          </div>
                          <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                            {vote.deadline}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-green-400">Yes: {vote.votes.yes}</span>
                            <span className="text-red-400">No: {vote.votes.no}</span>
                            <span className="text-gray-400">Abstain: {vote.votes.abstain}</span>
                          </div>
                          <Progress value={(vote.votes.yes + vote.votes.no + vote.votes.abstain) / vote.total * 100} className="h-2" />
                          <p className="text-gray-400 text-xs">
                            {vote.votes.yes + vote.votes.no + vote.votes.abstain} of {vote.total} votes cast
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  HOA Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { name: "CC&Rs (Covenants, Conditions & Restrictions)", type: "Legal", date: "Updated 2024", size: "2.4 MB" },
                    { name: "Monthly Financial Report - March 2024", type: "Financial", date: "March 2024", size: "1.8 MB" },
                    { name: "Board Meeting Minutes - March 15", type: "Minutes", date: "March 2024", size: "456 KB" },
                    { name: "Reserve Study 2024", type: "Financial", date: "January 2024", size: "3.2 MB" },
                    { name: "Insurance Policy Documentation", type: "Legal", date: "January 2024", size: "1.1 MB" },
                    { name: "Architectural Guidelines", type: "Guidelines", date: "Updated 2023", size: "892 KB" },
                  ].map((doc, index) => (
                    <div key={index} className="p-4 bg-navy-700/50 rounded-lg hover:bg-navy-600/50 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-orange-400 mt-1" />
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-sm">{doc.name}</h4>
                          <div className="flex justify-between items-center mt-2">
                            <Badge variant="outline" className="text-xs">
                              {doc.type}
                            </Badge>
                            <div className="text-gray-400 text-xs">
                              {doc.date} • {doc.size}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 flex gap-3">
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    Upload Document
                  </Button>
                  <Button variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                    Document Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="residents" className="mt-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Resident Directory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { unit: "101", name: "Johnson Family", phone: "(555) 123-4567", status: "Active", board: false },
                    { unit: "102", name: "Maria Rodriguez", phone: "(555) 234-5678", status: "Active", board: true },
                    { unit: "103", name: "Thompson Household", phone: "(555) 345-6789", status: "Active", board: false },
                    { unit: "104", name: "David Chen", phone: "(555) 456-7890", status: "Active", board: false },
                    { unit: "105", name: "Wilson Family", phone: "(555) 567-8901", status: "Late Payment", board: false },
                    { unit: "106", name: "Sarah Mitchell", phone: "(555) 678-9012", status: "Active", board: true },
                  ].map((resident, index) => (
                    <div key={index} className="p-4 bg-navy-700/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-medium">Unit {resident.unit}</p>
                          <p className="text-gray-400 text-sm">{resident.name}</p>
                        </div>
                        {resident.board && (
                          <Badge className="bg-purple-600 hover:bg-purple-700 text-xs">
                            Board
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-2">{resident.phone}</p>
                      
                      <Badge variant={resident.status === 'Active' ? 'default' : 'destructive'} className="text-xs">
                        {resident.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 flex gap-3">
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    Add Resident
                  </Button>
                  <Button variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                    Export Directory
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default HOADashboard;