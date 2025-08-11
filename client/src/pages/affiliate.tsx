import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, TrendingUp, Users, DollarSign, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AffiliateProgram {
  id: string;
  affiliateCode: string;
  referralLink: string;
  commissionRate: string;
  status: string;
  totalCommissionEarned: string;
  totalCommissionPaid: string;
  createdAt: string;
  payoutMethod?: string;
  payoutDetails?: string;
}

interface AffiliateStats {
  totalReferrals: number;
  convertedReferrals: number;
  totalCommissionEarned: string;
  totalCommissionPaid: string;
  conversionRate: number;
}

interface Referral {
  id: string;
  affiliateCode: string;
  sourceUrl?: string;
  status: string;
  convertedAt?: string;
  createdAt: string;
  referredUserId?: string;
}

interface Commission {
  id: string;
  revenueAmount: string;
  commissionAmount: string;
  description: string;
  status: string;
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
}

interface Payout {
  id: string;
  totalAmount: string;
  payoutMethod: string;
  status: string;
  processedAt?: string;
  createdAt: string;
  notes?: string;
}

export default function AffiliatePage() {
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Join affiliate program mutation
  const joinAffiliateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/affiliate/join"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/dashboard"] });
      toast({
        title: "Welcome to TradeScout Affiliates!",
        description: "Your affiliate program has been activated. Start sharing your link to earn 25% commission on all revenue from your referrals!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join affiliate program",
        variant: "destructive",
      });
    },
  });

  // Get affiliate dashboard data
  const { data: dashboardData, isLoading } = useQuery<{
    program: AffiliateProgram;
    stats: AffiliateStats;
    referrals: Referral[];
    commissions: Commission[];
    payouts: Payout[];
  }>({
    queryKey: ["/api/affiliate/dashboard"],
    retry: false,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: { payoutMethod: string; payoutDetails: string }) =>
      apiRequest("PUT", "/api/affiliate/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/dashboard"] });
      toast({
        title: "Settings Updated",
        description: "Your affiliate settings have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      });
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  // If user hasn't joined the affiliate program yet
  if (!dashboardData || !dashboardData.program) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">TradeScout Affiliate Program</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Earn 25% commission on all revenue from your referrals
            </p>
          </div>

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">Join Our Affiliate Program</CardTitle>
              <CardDescription className="text-center">
                Start earning recurring commissions by sharing TradeScout with your network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Share Your Link</h3>
                  <p className="text-sm text-muted-foreground">Get a personalized referral link to share</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Earn Commissions</h3>
                  <p className="text-sm text-muted-foreground">Get 25% of all revenue from your referrals</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Get Paid</h3>
                  <p className="text-sm text-muted-foreground">Receive recurring payouts from subscription revenue</p>
                </div>
              </div>
              
              <div className="bg-primary/5 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">What you'll earn commission on:</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Contractor subscription fees (recurring)</li>
                  <li>• Marketplace transaction fees</li>
                  <li>• Premium services and features</li>
                  <li>• Foundation donations (platform fees)</li>
                </ul>
              </div>

              <Button 
                onClick={() => joinAffiliateMutation.mutate()} 
                disabled={joinAffiliateMutation.isPending}
                className="w-full"
                size="lg"
              >
                {joinAffiliateMutation.isPending ? "Joining..." : "Join Affiliate Program"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { program, stats, referrals, commissions, payouts } = dashboardData as {
    program: AffiliateProgram;
    stats: AffiliateStats;
    referrals: Referral[];
    commissions: Commission[];
    payouts: Payout[];
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Affiliate Dashboard</h1>
          <p className="text-muted-foreground">
            Track your referrals, commissions, and earnings
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReferrals}</div>
              <p className="text-xs text-muted-foreground">
                {stats.convertedReferrals} converted ({stats.conversionRate.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commission Earned</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCommissionEarned}</div>
              <p className="text-xs text-muted-foreground">Total lifetime earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commission Paid</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCommissionPaid}</div>
              <p className="text-xs text-muted-foreground">Total payments received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(parseFloat(stats.totalCommissionEarned) - parseFloat(stats.totalCommissionPaid)).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting next payout</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Referral Link Section */}
            <Card>
              <CardHeader>
                <CardTitle>Your Referral Link</CardTitle>
                <CardDescription>Share this link to earn commissions on all revenue from your referrals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Input 
                    value={program.referralLink} 
                    readOnly 
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(program.referralLink, "Referral link")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="text-sm">
                    <strong>Affiliate Code:</strong> {program.affiliateCode}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(program.affiliateCode, "Affiliate code")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Commission Rate: {program.commissionRate}%</h4>
                  <p className="text-sm text-muted-foreground">
                    You earn 25% commission on all revenue generated by users who sign up through your referral link, 
                    including recurring subscription fees and transaction fees.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Referrals</CardTitle>
                </CardHeader>
                <CardContent>
                  {referrals.length === 0 ? (
                    <p className="text-muted-foreground">No referrals yet. Start sharing your link!</p>
                  ) : (
                    <div className="space-y-3">
                      {referrals.slice(0, 5).map((referral: Referral) => (
                        <div key={referral.id} className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {referral.status === 'converted' ? 'Converted' : 'Clicked'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(referral.createdAt), 'MMM d, yyyy')}
                            </div>
                          </div>
                          <Badge variant={referral.status === 'converted' ? 'default' : 'secondary'}>
                            {referral.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Commissions</CardTitle>
                </CardHeader>
                <CardContent>
                  {commissions.length === 0 ? (
                    <p className="text-muted-foreground">No commissions yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {commissions.slice(0, 5).map((commission: Commission) => (
                        <div key={commission.id} className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">${commission.commissionAmount}</div>
                            <div className="text-xs text-muted-foreground">
                              {commission.description}
                            </div>
                          </div>
                          <Badge variant={
                            commission.status === 'approved' ? 'default' : 
                            commission.status === 'pending' ? 'secondary' : 'outline'
                          }>
                            {commission.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="referrals">
            <Card>
              <CardHeader>
                <CardTitle>All Referrals</CardTitle>
                <CardDescription>Track all clicks and conversions from your referral link</CardDescription>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <p className="text-muted-foreground">No referrals yet. Share your link to get started!</p>
                ) : (
                  <div className="space-y-4">
                    {referrals.map((referral: Referral) => (
                      <div key={referral.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={referral.status === 'converted' ? 'default' : 'secondary'}>
                            {referral.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(referral.createdAt), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        {referral.sourceUrl && (
                          <div className="text-sm text-muted-foreground">
                            Source: {referral.sourceUrl}
                          </div>
                        )}
                        {referral.convertedAt && (
                          <div className="text-sm text-green-600">
                            Converted: {format(new Date(referral.convertedAt), 'MMM d, yyyy h:mm a')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <CardTitle>Commission History</CardTitle>
                <CardDescription>View all commissions earned from your referrals</CardDescription>
              </CardHeader>
              <CardContent>
                {commissions.length === 0 ? (
                  <p className="text-muted-foreground">No commissions yet.</p>
                ) : (
                  <div className="space-y-4">
                    {commissions.map((commission: Commission) => (
                      <div key={commission.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold">${commission.commissionAmount}</div>
                          <Badge variant={
                            commission.status === 'approved' ? 'default' : 
                            commission.status === 'pending' ? 'secondary' : 'outline'
                          }>
                            {commission.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-1">
                          {commission.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Revenue: ${commission.revenueAmount} • 
                          Created: {format(new Date(commission.createdAt), 'MMM d, yyyy')}
                          {commission.approvedAt && (
                            <> • Approved: {format(new Date(commission.approvedAt), 'MMM d, yyyy')}</>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>Track all payments received from your affiliate commissions</CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <p className="text-muted-foreground">No payouts yet. Commissions are paid monthly once they reach $100.</p>
                ) : (
                  <div className="space-y-4">
                    {payouts.map((payout: Payout) => (
                      <div key={payout.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold">${payout.totalAmount}</div>
                          <Badge variant={
                            payout.status === 'completed' ? 'default' : 
                            payout.status === 'processing' ? 'secondary' : 'outline'
                          }>
                            {payout.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Method: {payout.payoutMethod}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created: {format(new Date(payout.createdAt), 'MMM d, yyyy')}
                          {payout.processedAt && (
                            <> • Processed: {format(new Date(payout.processedAt), 'MMM d, yyyy')}</>
                          )}
                        </div>
                        {payout.notes && (
                          <div className="text-sm text-muted-foreground mt-2">
                            Notes: {payout.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Affiliate Settings</CardTitle>
                <CardDescription>Configure your payout preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payoutMethod">Payout Method</Label>
                  <select 
                    id="payoutMethod"
                    className="w-full p-2 border rounded-md"
                    defaultValue={program.payoutMethod || 'paypal'}
                  >
                    <option value="paypal">PayPal</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="stripe">Stripe Connect</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payoutDetails">Payout Details</Label>
                  <Input
                    id="payoutDetails"
                    placeholder="Email for PayPal, account details for bank transfer"
                    defaultValue={program.payoutDetails || ''}
                  />
                </div>

                <Button 
                  onClick={() => {
                    const payoutMethod = (document.getElementById('payoutMethod') as HTMLSelectElement).value;
                    const payoutDetails = (document.getElementById('payoutDetails') as HTMLInputElement).value;
                    updateSettingsMutation.mutate({ payoutMethod, payoutDetails });
                  }}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>

                <div className="bg-yellow-50 p-4 rounded-lg mt-6">
                  <h4 className="font-semibold mb-2">Payout Schedule</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Payouts are processed monthly on the 1st</li>
                    <li>• Minimum payout amount: $100</li>
                    <li>• Commissions are held for 30 days before being eligible for payout</li>
                    <li>• PayPal payouts typically process within 1-2 business days</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}