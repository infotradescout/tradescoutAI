import { memo, useState } from 'react';
import { TrendingUp, Users2, DollarSign, Gift, Copy, Check, Crown, BarChart3, Calendar, Link, Mail, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Page, Section } from '@/components/layout/PagePrimitives';

const ReferralDashboard = memo(function ReferralDashboard() {
  const [copyStatus, setCopyStatus] = useState<string>('');
  const { toast } = useToast();

  const referralStats = {
    totalReferrals: 247,
    activeReferrals: 89,
    totalEarnings: 3420.50,
    pendingEarnings: 850.25,
    conversionRate: 23.4,
    tier: 'Gold Ambassador',
    commissionRate: 15,
    nextTierProgress: 68
  };

  const recentReferrals = [
    {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah.j@email.com",
      role: "Homeowner",
      status: "Active",
      joinDate: "2024-03-15",
      earnings: 45.50,
      activity: "Hired 2 contractors"
    },
    {
      id: 2,
      name: "Elite Plumbing Co.",
      email: "contact@eliteplumbing.com",
      role: "Contractor",
      status: "Pending Verification",
      joinDate: "2024-03-12",
      earnings: 0,
      activity: "Registration in progress"
    },
    {
      id: 3,
      name: "Mike Rodriguez",
      email: "mike.r@email.com",
      role: "Helper",
      status: "Active",
      joinDate: "2024-03-08",
      earnings: 23.75,
      activity: "Completed 5 jobs"
    },
    {
      id: 4,
      name: "Jennifer Martinez",
      email: "j.martinez@email.com",
      role: "Realtor",
      status: "Active",
      joinDate: "2024-03-05",
      earnings: 127.50,
      activity: "Listed 3 properties"
    }
  ];

  const tierBenefits = [
    {
      tier: "Standard",
      commission: "10%",
      requirements: "0+ referrals",
      benefits: ["Basic referral tracking", "Standard support", "Monthly reports"],
      current: false
    },
    {
      tier: "Silver",
      commission: "12%",
      requirements: "25+ active referrals",
      benefits: ["Enhanced tracking", "Priority support", "Bi-weekly reports", "Custom referral codes"],
      current: false
    },
    {
      tier: "Gold Ambassador",
      commission: "15%",
      requirements: "100+ active referrals",
      benefits: ["Maximum commission", "Dedicated support", "Real-time analytics", "Personal referral page"],
      current: true
    },
    {
      tier: "Diamond Partner",
      commission: "20%",
      requirements: "500+ active referrals",
      benefits: ["Premium commission", "Account manager", "Custom marketing materials", "API access"],
      current: false
    }
  ];

  const sharingMethods = [
    {
      method: "Direct Link",
      description: "Share your unique referral link anywhere",
      clicks: 1847,
      conversions: 89,
      rate: "4.8%"
    },
    {
      method: "Email Campaigns",
      description: "Send personalized email invitations",
      clicks: 567,
      conversions: 34,
      rate: "6.0%"
    },
    {
      method: "Social Media",
      description: "Share on Facebook, Twitter, LinkedIn",
      clicks: 923,
      conversions: 28,
      rate: "3.0%"
    },
    {
      method: "QR Codes",
      description: "Print-friendly QR codes for offline sharing",
      clicks: 234,
      conversions: 12,
      rate: "5.1%"
    }
  ];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(label);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  return (
    <Page>
      <Section
        title={
          <span className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Referral Dashboard
          </span>
        }
        subtitle="Earn 10-20% commission by referring new users to TradeScout"
      >

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Total Referrals</p>
                  <p className="text-2xl font-bold text-white">{referralStats.totalReferrals}</p>
                  <p className="text-green-400 text-sm">{referralStats.activeReferrals} active</p>
                </div>
                <Users2 className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-400">${referralStats.totalEarnings.toFixed(2)}</p>
                  <p className="text-white/60 text-sm">${referralStats.pendingEarnings.toFixed(2)} pending</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Conversion Rate</p>
                  <p className="text-2xl font-bold text-ts-orange">{referralStats.conversionRate}%</p>
                  <p className="text-green-400 text-sm">+2.1% this month</p>
                </div>
                <TrendingUp className="h-8 w-8 text-ts-orange" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Current Tier</p>
                  <p className="text-xl font-bold text-yellow-400">{referralStats.tier}</p>
                  <p className="text-white/60 text-sm">{referralStats.commissionRate}% commission</p>
                </div>
                <Crown className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-tsCard/50 backdrop-blur-sm">
            <TabsTrigger value="overview" className="data-[state=active]:bg-ts-orange-dark">Overview</TabsTrigger>
            <TabsTrigger value="share" className="data-[state=active]:bg-ts-orange-dark">Share & Earn</TabsTrigger>
            <TabsTrigger value="referrals" className="data-[state=active]:bg-ts-orange-dark">My Referrals</TabsTrigger>
            <TabsTrigger value="tiers" className="data-[state=active]:bg-ts-orange-dark">Tiers & Benefits</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-ts-orange-dark">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Performance Summary */}
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">This Month's Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-white/60">New Referrals</span>
                        <span className="text-white">34 / 50</span>
                      </div>
                      <Progress value={68} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-white/60">Earnings Goal</span>
                        <span className="text-white">$1,247 / $2,000</span>
                      </div>
                      <Progress value={62} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-white/60">Next Tier Progress</span>
                        <span className="text-white">{referralStats.nextTierProgress}%</span>
                      </div>
                      <Progress value={referralStats.nextTierProgress} className="h-2" />
                      <p className="text-white/60 text-xs mt-1">32 more referrals to Diamond Partner</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button className="w-full bg-ts-orange-dark hover:bg-ts-orange-dark justify-start">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Share Referral Link
                    </Button>
                    <Button variant="outline" className="w-full border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20 justify-start">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email Invites
                    </Button>
                    <Button variant="outline" className="w-full border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20 justify-start">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Social Media Post
                    </Button>
                    <Button variant="outline" className="w-full border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20 justify-start">
                      <Gift className="h-4 w-4 mr-2" />
                      Request Payout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="share" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Referral Links */}
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Your Referral Links</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-white/60 text-sm mb-2 block">General Referral Link</label>
                      <div className="flex items-center gap-2">
                        <Input 
                          value="https://tradescout.com/join?ref=MIKE2024" 
                          readOnly 
                          className="bg-tsCard border-white/10 text-white"
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard("https://tradescout.com/join?ref=MIKE2024", "General Link")}
                        >
                          {copyStatus === "General Link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-white/60 text-sm mb-2 block">Contractor Referral Link</label>
                      <div className="flex items-center gap-2">
                        <Input 
                          value="https://tradescout.com/join/contractor?ref=MIKE2024" 
                          readOnly 
                          className="bg-tsCard border-white/10 text-white"
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard("https://tradescout.com/join/contractor?ref=MIKE2024", "Contractor Link")}
                        >
                          {copyStatus === "Contractor Link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-white/60 text-sm mb-2 block">Homeowner Referral Link</label>
                      <div className="flex items-center gap-2">
                        <Input 
                          value="https://tradescout.com/join/homeowner?ref=MIKE2024" 
                          readOnly 
                          className="bg-tsCard border-white/10 text-white"
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard("https://tradescout.com/join/homeowner?ref=MIKE2024", "Homeowner Link")}
                        >
                          {copyStatus === "Homeowner Link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      Generate QR Code
                    </Button>
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      Create Short Links
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Sharing Methods Performance */}
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Sharing Methods Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sharingMethods.map((method, index) => (
                      <div key={index} className="p-4 bg-tsCard/50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-white font-medium">{method.method}</h4>
                            <p className="text-white/60 text-sm">{method.description}</p>
                          </div>
                          <Badge className="bg-green-600 hover:bg-green-700">
                            {method.rate}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-white/60">Clicks: </span>
                            <span className="text-white">{method.clicks}</span>
                          </div>
                          <div>
                            <span className="text-white/60">Conversions: </span>
                            <span className="text-ts-orange">{method.conversions}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="referrals" className="mt-6">
            <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Recent Referrals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentReferrals.map((referral) => (
                    <div key={referral.id} className="p-4 bg-tsCard/50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-white font-medium">{referral.name}</h4>
                            <Badge variant="outline">{referral.role}</Badge>
                            <Badge className={
                              referral.status === 'Active' ? 'bg-green-600 hover:bg-green-700' :
                              referral.status === 'Pending Verification' ? 'bg-yellow-600 hover:bg-yellow-700' :
                              'bg-white/10 hover:bg-white/10'
                            }>
                              {referral.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-white/60">Email: </span>
                              <span className="text-white">{referral.email}</span>
                            </div>
                            <div>
                              <span className="text-white/60">Joined: </span>
                              <span className="text-white">{new Date(referral.joinDate).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className="text-white/60">Activity: </span>
                              <span className="text-white">{referral.activity}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-green-400 font-bold text-lg">
                            ${referral.earnings.toFixed(2)}
                          </div>
                          <div className="text-white/60 text-sm">earned</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tiers" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {tierBenefits.map((tier, index) => (
                <Card key={index} className={`bg-tsCard/50 border-white/10 backdrop-blur-sm ${
                  tier.current ? 'ring-2 ring-ts-orange/70' : ''
                }`}>
                  {tier.current && (
                    <div className="bg-ts-orange-dark text-white text-center py-2 text-sm font-medium">
                      Current Tier
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <CardTitle className="text-white">{tier.tier}</CardTitle>
                    <div className="text-3xl font-bold text-ts-orange">{tier.commission}</div>
                    <p className="text-white/60 text-sm">Commission Rate</p>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-white/60 text-sm mb-2">Requirements:</p>
                        <p className="text-white text-sm">{tier.requirements}</p>
                      </div>

                      <div>
                        <p className="text-white/60 text-sm mb-2">Benefits:</p>
                        <ul className="space-y-1">
                          {tier.benefits.map((benefit, benefitIndex) => (
                            <li key={benefitIndex} className="text-white text-sm flex items-start gap-2">
                              <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {!tier.current && (
                        <Button 
                          className="w-full bg-ts-orange-dark hover:bg-ts-orange-dark"
                          disabled={index <= tierBenefits.findIndex(t => t.current)}
                        >
                          {index <= tierBenefits.findIndex(t => t.current) ? 'Achieved' : 'Unlock Tier'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Monthly Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-ts-orange mb-2">$1,247.50</div>
                      <div className="text-white/60">This Month's Earnings</div>
                      <div className="text-green-400 text-sm">+34% from last month</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-tsCard/50 rounded-lg">
                        <div className="text-xl font-bold text-blue-400">67</div>
                        <div className="text-white/60 text-sm">Link Clicks</div>
                      </div>
                      <div className="text-center p-4 bg-tsCard/50 rounded-lg">
                        <div className="text-xl font-bold text-green-400">23</div>
                        <div className="text-white/60 text-sm">Sign-ups</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Top Performing Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { content: "Contractor Registration Link", clicks: 234, conversions: 12 },
                      { content: "Homeowner Welcome Page", clicks: 189, conversions: 8 },
                      { content: "Social Media Post #1", clicks: 145, conversions: 5 },
                      { content: "Email Campaign - March", clicks: 98, conversions: 7 }
                    ].map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-tsCard/50 rounded-lg">
                        <div>
                          <p className="text-white font-medium text-sm">{item.content}</p>
                          <p className="text-white/60 text-xs">{item.clicks} clicks • {item.conversions} conversions</p>
                        </div>
                        <div className="text-ts-orange font-bold">
                          {Math.round((item.conversions / item.clicks) * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Section>
    </Page>
  );
});

export default ReferralDashboard;