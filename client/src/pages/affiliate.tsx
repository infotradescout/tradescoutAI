import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Copy, Share2, TrendingUp, Users, DollarSign, Calendar, Check, ExternalLink, Zap } from "lucide-react";
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

  // Get affiliate dashboard data - automatically created for all users
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
        description: "Your payout settings have been saved successfully.",
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
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const program = dashboardData?.program;
  const stats = dashboardData?.stats;
  const referrals = dashboardData?.referrals || [];
  const commissions = dashboardData?.commissions || [];
  const payouts = dashboardData?.payouts || [];

  // Generate referral link (even if program not set up yet)
  const baseUrl = window.location.origin;
  const affiliateLink = program?.referralLink || `${baseUrl}/?ref=YOUR_CODE`;

  return (
    <div className="min-h-screen gradient-bg pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <Share2 className="w-8 h-8 text-orange-500" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Your Affiliate Dashboard</h1>
              <p className="text-gray-400">Every link you share automatically earns you 10% commission</p>
            </div>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-blue-200 font-medium">Automatic Affiliate Program</p>
              <p className="text-blue-300/80 text-sm">No signup needed! As a TradeScout member, you automatically earn 10% commission on ALL revenue from anyone who signs up through your links.</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats?.totalReferrals || 0}</div>
              <p className="text-sm text-gray-400 mt-1">
                {stats?.convertedReferrals || 0} converted ({stats?.conversionRate || 0}%)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">
                ${stats?.totalCommissionEarned || "0.00"}
              </div>
              <p className="text-sm text-gray-400 mt-1">Lifetime commissions</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Paid Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">
                ${stats?.totalCommissionPaid || "0.00"}
              </div>
              <p className="text-sm text-gray-400 mt-1">Total payments received</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Commission Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-400">
                {program?.commissionRate || "10"}%
              </div>
              <p className="text-sm text-gray-400 mt-1">On all revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Automatic Affiliate Tracking */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/30 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Automatic Affiliate Tracking
            </CardTitle>
            <CardDescription className="text-gray-300">
              ANY link you share from TradeScout automatically includes your tracking code - no special link needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-400" />
                How It Works
              </h4>
              <p className="text-gray-300 mb-4">
                Share any page from TradeScout - the homepage, a marketplace listing, a contractor profile, or a county page. 
                Your unique tracking code is automatically attached to every URL you share.
              </p>
              <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                <p className="text-gray-400 text-sm mb-2">Examples of links you can share:</p>
                <ul className="text-gray-300 text-sm space-y-1 font-mono">
                  <li>→ tradescout.com <span className="text-orange-400">?ref=your_code</span></li>
                  <li>→ tradescout.com/marketplace <span className="text-orange-400">?ref=your_code</span></li>
                  <li>→ tradescout.com/county/cook-il <span className="text-orange-400">?ref=your_code</span></li>
                  <li>→ tradescout.com/contractors <span className="text-orange-400">?ref=your_code</span></li>
                </ul>
                <p className="text-emerald-400 text-xs mt-3">✓ Tracking code automatically added when you share any link</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <h4 className="text-white font-semibold mb-2">10% Marketplace Promotions</h4>
                <p className="text-sm text-gray-400">Commission when contractors boost marketplace listings</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <h4 className="text-white font-semibold mb-2">10% Marketplace Sales</h4>
                <p className="text-sm text-gray-400">Earnings from all marketplace transactions</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <h4 className="text-white font-semibold mb-2">10% Ad Revenue</h4>
                <p className="text-sm text-gray-400">Share of platform advertising revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">How It Works</CardTitle>
                <CardDescription>Your automatic affiliate program explained</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-3">
                      <Share2 className="w-6 h-6 text-orange-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">1. Share ANY Link</h3>
                    <p className="text-gray-400 text-sm">
                      Share any page from TradeScout on social media, email, or anywhere online. Your tracking code is automatically added to every URL.
                    </p>
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">2. People Sign Up</h3>
                    <p className="text-gray-400 text-sm">
                      When someone joins TradeScout through your link, they're automatically tracked as your referral forever.
                    </p>
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-3">
                      <DollarSign className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">3. Earn 10% Forever</h3>
                    <p className="text-gray-400 text-sm">
                      You earn 10% of ALL revenue from your referrals - marketplace promotions, sales, and platform ads.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-700/30 p-6 rounded-lg">
                  <h4 className="text-white font-semibold mb-3">Why 10% is Powerful</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Free Platform:</strong> TradeScout is 100% free for contractors - no fees ever - making it easy to refer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Marketplace Revenue:</strong> Every marketplace promotion and transaction generates commission for you</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span><strong>No Cap:</strong> There's no limit to how much you can earn - the more people you refer, the more you make</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Passive Income:</strong> After sharing once, you continue earning from your referrals indefinitely</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Your Referrals</CardTitle>
                <CardDescription>Track everyone who joined through your link</CardDescription>
              </CardHeader>
              <CardContent>
                {referrals.length > 0 ? (
                  <div className="space-y-3">
                    {referrals.map((referral) => (
                      <div key={referral.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div>
                          <p className="text-white font-medium">Referral #{referral.id.slice(0, 8)}</p>
                          <p className="text-sm text-gray-400">{format(new Date(referral.createdAt), "MMM d, yyyy")}</p>
                        </div>
                        <Badge className={referral.status === 'converted' ? 'bg-emerald-500' : 'bg-gray-600'}>
                          {referral.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No referrals yet</h3>
                    <p className="text-gray-400 mb-6">Start sharing your link to earn commissions!</p>
                    <Button 
                      onClick={() => copyToClipboard(affiliateLink, "Affiliate link")}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Your Link
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Commission History</CardTitle>
                <CardDescription>View all commissions earned</CardDescription>
              </CardHeader>
              <CardContent>
                {commissions.length > 0 ? (
                  <div className="space-y-3">
                    {commissions.map((commission) => (
                      <div key={commission.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div className="flex-1">
                          <p className="text-white font-medium">{commission.description}</p>
                          <p className="text-sm text-gray-400">{format(new Date(commission.createdAt), "MMM d, yyyy h:mm a")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-bold text-lg">${commission.commissionAmount}</p>
                          <Badge className={commission.status === 'paid' ? 'bg-emerald-500' : 'bg-yellow-500'}>
                            {commission.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No commissions yet</h3>
                    <p className="text-gray-400">Your commission earnings will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Payout History</CardTitle>
                <CardDescription>View your payment history and update payout settings</CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length > 0 ? (
                  <div className="space-y-3">
                    {payouts.map((payout) => (
                      <div key={payout.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div>
                          <p className="text-white font-medium">${payout.totalAmount}</p>
                          <p className="text-sm text-gray-400">
                            {payout.payoutMethod} • {format(new Date(payout.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge className={payout.status === 'completed' ? 'bg-emerald-500' : 'bg-yellow-500'}>
                          {payout.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No payouts yet</h3>
                    <p className="text-gray-400">Payouts are processed monthly once you reach $50</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
