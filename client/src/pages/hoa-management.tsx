import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Building, DollarSign, Users, Vote, Wrench, Calendar, TrendingUp, Phone, Mail, Star, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface HOA {
  id: string;
  name: string;
  address: string;
  totalUnits: number;
  monthlyFees: string;
  reserves: string;
  managementCompany: string;
  boardMembers: Array<{
    name: string;
    position: string;
    term: string;
  }>;
  amenities: string[];
  nextMeeting: string;
}

interface Vote {
  id: string;
  title: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  requiredQuorum: number;
  currentVotes: number;
  votesFor: number;
  votesAgainst: number;
  estimatedCost: string;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  monthlyContract: string;
  rating: number;
  status: string;
  services: string[];
}

interface HOAMember {
  id: string;
  role: string;
  unitNumber?: string;
  canViewFinances: boolean;
  canEditDocuments: boolean;
  canManageVendors: boolean;
  canCreateVotes: boolean;
  votingRights: boolean;
  inGoodStanding: boolean;
}

export default function HOAManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Mock HOA ID for demo purposes
  const hoaId = 'hoa-1';

  // Fetch user's HOA membership and permissions
  const { data: memberData, isLoading: memberLoading } = useQuery<HOAMember>({
    queryKey: ['/api/hoa', hoaId, 'member'],
    queryFn: async () => {
      const response = await fetch(`/api/hoa/${hoaId}/member`);
      if (!response.ok) {
        throw new Error('Not a member of this HOA');
      }
      return response.json();
    },
    enabled: !!user,
    retry: false
  });

  const { data: hoa, isLoading: hoaLoading } = useQuery({
    queryKey: ['/api/hoa', hoaId],
    queryFn: () => fetch(`/api/hoa/${hoaId}`).then(res => res.json())
  });

  const { data: finances, isLoading: financesLoading } = useQuery({
    queryKey: ['/api/hoa', hoaId, 'finances'],
    queryFn: () => fetch(`/api/hoa/${hoaId}/finances`).then(res => res.json()),
    enabled: memberData?.canViewFinances || false
  });

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['/api/hoa', hoaId, 'vendors'],
    queryFn: () => fetch(`/api/hoa/${hoaId}/vendors`).then(res => res.json()),
    initialData: []
  });

  const { data: votes = [], isLoading: votesLoading } = useQuery({
    queryKey: ['/api/hoa', hoaId, 'votes'],
    queryFn: () => fetch(`/api/hoa/${hoaId}/votes`).then(res => res.json()),
    initialData: []
  });

  // Placeholder for refreshing financial data
  const refreshFinancials = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/hoa', hoaId, 'finances'] });
  };

  const submitVoteMutation = useMutation({
    mutationFn: async ({ voteId, decision }: { voteId: string; decision: string }) => {
      const response = await fetch(`/api/hoa/votes/${voteId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      if (!response.ok) throw new Error('Failed to submit vote');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Vote Submitted",
        description: "Your vote has been recorded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/hoa', hoaId, 'votes'] });
    },
    onError: () => {
      toast({
        title: "Vote Failed",
        description: "Unable to submit vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (voteId: string, decision: 'for' | 'against') => {
    submitVoteMutation.mutate({ voteId, decision });
  };

  const getVoteProgress = (vote: Vote) => {
    return Math.min((vote.currentVotes / vote.requiredQuorum) * 100, 100);
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} days remaining` : 'Voting closed';
  };

  // New function for fee collection
  const handleFeeCollection = async (residentId: string, amount: number) => {
    try {
      const response = await fetch('/api/hoa/collect-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoaId: hoa?.id, // Use hoa?.id to safely access the id
          residentId,
          amount,
          description: 'Monthly HOA dues'
        })
      });

      if (response.ok) {
        const result = await response.json();
        setNotification({
          type: 'success',
          message: `Fee collection initiated for $${amount}`
        });
        refreshFinancials();
      } else {
        throw new Error('Fee collection failed');
      }
    } catch (error) {
      console.error("Fee collection error:", error);
      setNotification({
        type: 'error',
        message: 'Fee collection failed'
      });
    }
  };


  // Helper function to get role display name
  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      'member': 'Member',
      'board_member': 'Board Member',
      'president': 'President',
      'vice_president': 'Vice President',
      'treasurer': 'Treasurer',
      'secretary': 'Secretary'
    };
    return roleNames[role] || role;
  };

  if (hoaLoading || memberLoading) {
    return (
      <div className="min-h-screen gradient-bg p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-2 text-slate-400">Loading HOA information...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show message if user is not a member
  if (!memberData && !memberLoading) {
    return (
      <div className="min-h-screen gradient-bg p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700 text-center p-12">
            <Building className="w-16 h-16 text-orange-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Not an HOA Member</h2>
            <p className="text-slate-400 mb-6">You need to be a member of this HOA to access this page.</p>
            <Button data-testid="button-back-home" onClick={() => window.location.href = '/'} className="bg-orange-500 hover:bg-orange-600">
              Return Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg p-6" data-testid="hoa-management-page">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Building className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">HOA Management</h1>
          </div>
          {hoa && (
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-orange-400">{hoa.name}</h2>
              <p className="text-slate-300">{hoa.address}</p>
              {memberData && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Badge className="bg-teal-600 text-white" data-testid="badge-member-role">
                    {getRoleDisplayName(memberData.role)}
                  </Badge>
                  {memberData.unitNumber && (
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      Unit {memberData.unitNumber}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {hoa && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Building className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white">{hoa.totalUnits}</div>
                <p className="text-slate-400">Total Units</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white">${hoa.monthlyFees}</div>
                <p className="text-slate-400">Monthly Fees</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">${parseInt(hoa.reserves).toLocaleString()}</div>
                <p className="text-slate-400">Reserves</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-orange-400" />
                </div>
                <div className="text-sm font-bold text-white">
                  {new Date(hoa.nextMeeting).toLocaleDateString()}
                </div>
                <p className="text-slate-400">Next Meeting</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={`grid w-full ${memberData?.canViewFinances ? 'grid-cols-5' : 'grid-cols-4'} bg-slate-800/50`}>
            <TabsTrigger value="overview" className="data-[state=active]:bg-orange-500">Overview</TabsTrigger>
            {memberData?.canViewFinances && (
              <TabsTrigger value="finances" className="data-[state=active]:bg-orange-500" data-testid="tab-finances">
                Finances
              </TabsTrigger>
            )}
            <TabsTrigger value="voting" className="data-[state=active]:bg-orange-500">Voting</TabsTrigger>
            <TabsTrigger value="vendors" className="data-[state=active]:bg-orange-500">Vendors</TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-orange-500">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {hoa && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Users className="w-5 h-5 text-blue-400" />
                      <span>Board Members</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(hoa.boardMembers || []).map((member: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                        <div>
                          <div className="font-semibold text-white">{member.name}</div>
                          <div className="text-sm text-slate-400">{member.position}</div>
                        </div>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {member.term}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Star className="w-5 h-5 text-yellow-400" />
                      <span>Amenities</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {(hoa.amenities || []).map((amenity: string, index: number) => (
                        <Badge key={index} variant="secondary" className="bg-orange-500/20 text-orange-400 justify-center">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {memberData?.canViewFinances && (
            <TabsContent value="finances" className="space-y-6">
              {finances && !financesLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Financial Summary</CardTitle>
                      {['treasurer', 'president', 'vice_president'].includes(memberData.role) && (
                        <p className="text-sm text-green-400 mt-1">Full Access</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Total Revenue</span>
                        <span className="text-green-400 font-semibold">${parseInt(finances.totalRevenue).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Total Expenses</span>
                        <span className="text-red-400 font-semibold">${parseInt(finances.totalExpenses).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Reserves</span>
                        <span className="text-blue-400 font-semibold">${parseInt(finances.reserves).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Outstanding Fees</span>
                        <span className="text-orange-400 font-semibold">${parseInt(finances.outstandingFees).toLocaleString()}</span>
                      </div>
                      {/* Button to trigger fee collection - only for treasurer/president */}
                      {['treasurer', 'president', 'vice_president'].includes(memberData.role) && (
                        <Button 
                          onClick={() => handleFeeCollection(user?.id || '', parseInt(hoa?.monthlyFees || '0'))} 
                          className="w-full bg-teal-600 hover:bg-teal-700" 
                          disabled={!hoa}
                          data-testid="button-collect-fees"
                        >
                          Collect Monthly Fees
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Expense Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(finances.expenseCategories || []).map((category: any, index: number) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">{category.category}</span>
                          <span className="text-white">{category.percentage}%</span>
                        </div>
                        <Progress value={category.percentage} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          )}

          <TabsContent value="voting" className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                  <Vote className="w-5 h-5 text-purple-400" />
                  <span>Active Votes</span>
                </h3>
                {memberData?.canCreateVotes && (
                  <Badge className="bg-purple-600 text-white" data-testid="badge-can-create-votes">
                    Can Create Votes
                  </Badge>
                )}
              </div>
              {!memberData?.votingRights && (
                <Card className="bg-yellow-500/10 border-yellow-500/50">
                  <CardContent className="p-4">
                    <p className="text-yellow-400 text-sm">
                      ⚠️ Your voting rights are currently suspended. Please contact the HOA board.
                    </p>
                  </CardContent>
                </Card>
              )}
              {(votes || []).map((vote: Vote) => (
                <Card key={vote.id} className="bg-slate-800/50 border-slate-700" data-testid={`vote-${vote.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <CardTitle className="text-white">{vote.title}</CardTitle>
                        <Badge variant={vote.status === 'active' ? 'default' : 'secondary'} className="bg-purple-500/20 text-purple-400">
                          {vote.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-orange-400">${parseInt(vote.estimatedCost).toLocaleString()}</div>
                        <p className="text-sm text-slate-400">Estimated Cost</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-slate-300 leading-relaxed">{vote.description}</p>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Participation ({vote.currentVotes} / {vote.requiredQuorum} required)</span>
                        <span className="text-white">{Math.round(getVoteProgress(vote))}%</span>
                      </div>
                      <Progress value={getVoteProgress(vote)} className="h-3" />
                      <p className="text-sm text-slate-400">{getTimeRemaining(vote.endDate)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-500/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-400">{vote.votesFor}</div>
                        <p className="text-green-300">For</p>
                      </div>
                      <div className="text-center p-4 bg-red-500/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-400">{vote.votesAgainst}</div>
                        <p className="text-red-300">Against</p>
                      </div>
                    </div>

                    {vote.status === 'active' && memberData?.votingRights && (
                      <div className="flex space-x-4">
                        <Button 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleVote(vote.id, 'for')}
                          disabled={submitVoteMutation.isPending}
                          data-testid={`vote-for-${vote.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Vote For
                        </Button>
                        <Button 
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleVote(vote.id, 'against')}
                          disabled={submitVoteMutation.isPending}
                          data-testid={`vote-against-${vote.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Vote Against
                        </Button>
                      </div>
                    )}
                    {vote.status === 'active' && !memberData?.votingRights && (
                      <p className="text-yellow-400 text-sm text-center">
                        Voting rights suspended - Contact HOA board
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(vendors || []).map((vendor: Vendor) => (
                <Card key={vendor.id} className="bg-slate-800/50 border-slate-700" data-testid={`vendor-${vendor.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-white">{vendor.name}</CardTitle>
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                          {vendor.category}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-white font-semibold">{vendor.rating}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">{vendor.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">{vendor.email}</span>
                      </div>
                    </div>

                    <div className="text-center p-3 bg-green-500/20 rounded-lg">
                      <div className="text-xl font-bold text-green-400">${parseInt(vendor.monthlyContract).toLocaleString()}</div>
                      <p className="text-green-300">Monthly Contract</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-white font-medium">Services:</h4>
                      <div className="flex flex-wrap gap-1">
                        {(vendor.services || []).map((service, index) => (
                          <Badge key={index} variant="outline" className="text-xs border-slate-600 text-slate-400">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button variant="outline" className="w-full" data-testid={`contact-vendor-${vendor.id}`}>
                      <Wrench className="w-4 h-4 mr-2" />
                      Request Service
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">HOA Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Document Library</h3>
                  <p className="text-slate-400">Access to CC&Rs, budgets, meeting minutes, and other important documents.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}