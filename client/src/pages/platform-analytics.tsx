import { memo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users2, TrendingUp, DollarSign, MapPin, Calendar, Clock, Award, Target, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

const PlatformAnalytics = memo(function PlatformAnalytics() {
  const [timeRange, setTimeRange] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview");

  const { user } = useAuth();

  type ScoutDraftArtifactSummary = {
    draftKind: 'promo' | 'community';
    created: number;
    viewed: number;
    published: number;
    medianTimeToPublishMs: number | null;
    topCountiesByPublishRate: Array<{
      stateCode: string | null;
      countyFips: string | null;
      created: number;
      published: number;
      publishRate: number;
    }>;
  };

  type ScoutDraftSummaryResponse = {
    from: string;
    to: string;
    artifacts: ScoutDraftArtifactSummary[];
  };

  type OutcomeSummaryByActionType = {
    actionType: 'community_notice' | 'provider_coordination' | 'promotion';
    initiated: number;
    success: number;
    pending: number;
    failed: number;
    medianTimeToOutcomeMs: number | null;
    topCountiesByConfirmationRate: Array<{
      stateCode: string | null;
      countyFips: string | null;
      initiated: number;
      confirmed: number;
      confirmationRate: number;
    }>;
  };

  type OutcomeSummaryResponse = {
    from: string;
    to: string;
    byActionType: OutcomeSummaryByActionType[];
  };

  const { data: moneyMovements } = useQuery<{
    date: string;
    wallet: { totalCredits: number; totalDebits: number; netChange: number };
    marketplace: { totalStripeVolume: number; totalOffPlatformVolume: number };
  }>({
    queryKey: ["/api/admin/money-movements/daily"],
    queryFn: () => apiRequest("GET", "/api/admin/money-movements/daily"),
    staleTime: 60 * 1000,
  });

  const outcomeRolesAllowed = !!user && [
    'support_agent',
    'content_moderator',
    'territory_manager',
    'contractor_success',
    'content_seo',
    'analytics_specialist',
    'marketing_specialist',
    'moderator',
    'ops_admin',
    'super_admin',
    'head_admin',
  ].includes(user.role || '');

  const { data: scoutDraftSummary } = useQuery<ScoutDraftSummaryResponse>({
    queryKey: ["/api/analytics/scout-drafts/summary"],
    queryFn: () => apiRequest("GET", "/api/analytics/scout-drafts/summary"),
    enabled: outcomeRolesAllowed,
    staleTime: 30 * 1000,
  });

  const { data: outcomeSummary } = useQuery<OutcomeSummaryResponse>({
    queryKey: ["/api/analytics/outcomes/summary"],
    queryFn: () => apiRequest("GET", "/api/analytics/outcomes/summary"),
    enabled: outcomeRolesAllowed,
    staleTime: 30 * 1000,
  });

  const overviewStats = [
    { label: "Total Users", value: "12,847", change: "+8.2%", trend: "up", icon: Users2, color: "text-blue-400" },
    { label: "Active Contractors", value: "3,429", change: "+12.1%", trend: "up", icon: Award, color: "text-green-400" },
    { label: "Platform Revenue", value: "$127,340", change: "+15.7%", trend: "up", icon: DollarSign, color: "text-purple-400" },
    { label: "Successful Projects", value: "8,934", change: "+9.8%", trend: "up", icon: Target, color: "text-orange-400" }
  ];

  const userGrowth = [
    { month: "Jan", homeowners: 820, contractors: 145, total: 965 },
    { month: "Feb", homeowners: 1240, contractors: 189, total: 1429 },
    { month: "Mar", homeowners: 1680, contractors: 234, total: 1914 },
    { month: "Apr", homeowners: 2100, contractors: 298, total: 2398 },
    { month: "May", homeowners: 2640, contractors: 367, total: 3007 },
    { month: "Jun", homeowners: 3180, contractors: 445, total: 3625 }
  ];

  const topCounties = [
    { name: "Los Angeles, CA", users: 2847, contractors: 423, projects: 1268 },
    { name: "Orange, CA", users: 1934, contractors: 298, projects: 876 },
    { name: "San Diego, CA", users: 1678, contractors: 234, projects: 654 },
    { name: "Cook, IL", users: 1456, contractors: 189, projects: 543 },
    { name: "Harris, TX", users: 1298, contractors: 167, projects: 478 }
  ];

  const revenueBreakdown = [
    { source: "Accelerator Memberships", amount: 45280, percentage: 35.6 },
    { source: "Connection Generation Fees", amount: 38520, percentage: 30.2 },
    { source: "Transaction Fees", amount: 25680, percentage: 20.2 },
    { source: "Premium Features", amount: 12740, percentage: 10.0 },
    { source: "Advertising Revenue", amount: 5120, percentage: 4.0 }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const scoutArtifacts = (scoutDraftSummary?.artifacts || []).reduce<Record<'promo' | 'community', ScoutDraftArtifactSummary | undefined>>(
    (acc, art) => {
      acc[art.draftKind] = art;
      return acc;
    },
    { promo: undefined, community: undefined },
  );

  const winnerLabel = (() => {
    const promo = scoutArtifacts.promo;
    const community = scoutArtifacts.community;
    if (!promo && !community) return 'Not enough data yet';
    const promoRate = promo && promo.created > 0 ? promo.published / promo.created : 0;
    const communityRate = community && community.created > 0 ? community.published / community.created : 0;
    if (promoRate === 0 && communityRate === 0) return 'No publishes yet';
    if (promoRate > communityRate) return 'Promotions are currently winning';
    if (communityRate > promoRate) return 'Community posts are currently winning';
    return 'Flows are performing similarly';
  })();

  const outcomeByType = (outcomeSummary?.byActionType || []).reduce<Record<OutcomeSummaryByActionType['actionType'], OutcomeSummaryByActionType | undefined>>(
    (acc, item) => {
      acc[item.actionType] = item;
      return acc;
    },
    {
      community_notice: undefined,
      provider_coordination: undefined,
      promotion: undefined,
    },
  );

  return (
    <div className="h-full bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-4xl font-bold text-foreground">Platform Analytics</h1>
                <p className="text-muted-foreground text-lg">Comprehensive insights into platform performance and growth</p>
              </div>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 bg-input border-input text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted border-border">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
            <TabsTrigger value="money" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Money Movements</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Users</TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Revenue</TabsTrigger>
            <TabsTrigger value="geography" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Geography</TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {overviewStats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <Card key={index} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">{stat.label}</p>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                          <p className={`text-sm ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                            {stat.change} from last period
                          </p>
                        </div>
                        <IconComponent className={`h-8 w-8 ${stat.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Scout Draft Funnel */}
            {scoutDraftSummary && (
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-400" />
                    Scout Draft Conversion (last 72h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-200">
                    {(['promo', 'community'] as const).map((kind) => {
                      const art = scoutArtifacts[kind];
                      const label = kind === 'promo' ? 'Promotions' : 'Community Posts';
                      if (!art) {
                        return (
                          <div key={kind} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{label}</span>
                              <Badge variant="outline" className="text-xs border-gray-500 text-gray-300">
                                No data yet
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400">Waiting for Scout-driven drafts to accumulate.</p>
                          </div>
                        );
                      }

                      const publishRate = art.created > 0 ? (art.published / art.created) * 100 : 0;
                      const medianMinutes = art.medianTimeToPublishMs != null
                        ? Math.round(art.medianTimeToPublishMs / 60000)
                        : null;

                      return (
                        <div key={kind} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{label}</span>
                            <Badge variant="outline" className="text-xs border-orange-500/40 text-orange-300">
                              {publishRate.toFixed(1)}% publish rate
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span>Created</span>
                            <span className="font-mono">{art.created}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Viewed</span>
                            <span className="font-mono">{art.viewed}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Published</span>
                            <span className="font-mono">{art.published}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Median time-to-publish</span>
                            <span className="font-mono">
                              {medianMinutes != null ? `${medianMinutes} min` : '—'}
                            </span>
                          </div>
                          {art.topCountiesByPublishRate.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[11px] text-gray-400 mb-1">Top counties by publish rate</p>
                              <ul className="space-y-0.5 text-[11px] text-gray-300">
                                {art.topCountiesByPublishRate.map((c) => (
                                  <li key={`${c.stateCode}-${c.countyFips}`} className="flex justify-between">
                                    <span>
                                      {c.countyFips ?? 'Unknown'}
                                      {c.stateCode ? `, ${c.stateCode}` : ''}
                                    </span>
                                    <span className="font-mono">
                                      {Math.round(c.publishRate * 100)}% ({c.published}/{c.created})
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-xs text-gray-400">
                    <span className="font-semibold text-gray-200">Verdict: </span>
                    {winnerLabel}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Outcome Confirmation Summary */}
            {outcomeSummary && (
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-400" />
                    Outcome Confirmation (last 72h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-200">
                    {([
                      { key: 'community_notice', label: 'Community Notices' },
                      { key: 'provider_coordination', label: 'Provider Coordination' },
                      { key: 'promotion', label: 'Promotions' },
                    ] as const).map(({ key, label }) => {
                      const bucket = outcomeByType[key];
                      if (!bucket) {
                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{label}</span>
                              <Badge variant="outline" className="text-xs border-gray-500 text-gray-300">
                                No data yet
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400">
                              Waiting for outcome confirmations to accumulate.
                            </p>
                          </div>
                        );
                      }

                      const { initiated, success, pending, failed, medianTimeToOutcomeMs, topCountiesByConfirmationRate } = bucket;
                      const successRate = initiated > 0 ? (success / initiated) * 100 : 0;
                      const medianMinutes = medianTimeToOutcomeMs != null
                        ? Math.round(medianTimeToOutcomeMs / 60000)
                        : null;

                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{label}</span>
                            <Badge variant="outline" className="text-xs border-green-500/50 text-green-300">
                              {successRate.toFixed(1)}% confirmed
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span>Initiated</span>
                            <span className="font-mono">{initiated}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Success</span>
                            <span className="font-mono">{success}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Pending</span>
                            <span className="font-mono">{pending}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Failed</span>
                            <span className="font-mono">{failed}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Median time-to-outcome</span>
                            <span className="font-mono">
                              {medianMinutes != null ? `${medianMinutes} min` : '—'}
                            </span>
                          </div>
                          {topCountiesByConfirmationRate.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[11px] text-gray-400 mb-1">Top counties by confirmation rate</p>
                              <ul className="space-y-0.5 text-[11px] text-gray-300">
                                {topCountiesByConfirmationRate.map((c) => (
                                  <li key={`${c.stateCode}-${c.countyFips}`} className="flex justify-between">
                                    <span>
                                      {c.countyFips ?? 'Unknown'}
                                      {c.stateCode ? `, ${c.stateCode}` : ''}
                                    </span>
                                    <span className="font-mono">
                                      {Math.round(c.confirmationRate * 100)}% ({c.confirmed}/{c.initiated})
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Growth Chart */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  User Growth Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userGrowth.map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-white font-medium w-12">{month.month}</span>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-600 text-white">{month.homeowners} Homeowners</Badge>
                          <Badge className="bg-green-600 text-white">{month.contractors} Contractors</Badge>
                        </div>
                      </div>
                      <div className="text-white font-bold">{month.total.toLocaleString()} Total</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="money" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Daily Money Movements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {moneyMovements ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <p className="text-sm text-gray-300">Wallet Flows (today)</p>
                      <p className="text-xs text-gray-400">Credits, debits, and net change across all user wallets.</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between text-emerald-300">
                          <span>Total Credits</span>
                          <span>${moneyMovements.wallet.totalCredits.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-orange-300">
                          <span>Total Debits</span>
                          <span>${moneyMovements.wallet.totalDebits.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-100 font-semibold border-t border-navy-600 pt-1 mt-1">
                          <span>Net Change</span>
                          <span>${moneyMovements.wallet.netChange.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-gray-300">Marketplace Volume (today)</p>
                      <p className="text-xs text-gray-400">Completed transactions by payment rail.</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between text-blue-300">
                          <span>Stripe (on-platform)</span>
                          <span>${moneyMovements.marketplace.totalStripeVolume.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-yellow-300">
                          <span>Off-platform / direct</span>
                          <span>${moneyMovements.marketplace.totalOffPlatformVolume.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-gray-300">
                      <p className="font-semibold">How to read this</p>
                      <p className="text-gray-400 text-xs">
                        Wallet credits should line up with affiliate commissions, admin adjustments, and incoming payments.
                        Debits should align with marketplace purchases, P2P sends, and any withdrawals. Stripe vs off-platform
                        totals give a quick sense of how much volume is staying fully on-rails.
                      </p>
                      <p className="text-gray-400 text-xs mt-2">
                        Date: <span className="font-mono">{moneyMovements.date}</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No money movement data available for today yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users2 className="h-5 w-5" />
                    User Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Homeowners</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">9,418</span>
                        <Badge className="bg-blue-600">73.3%</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Contractors</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">3,429</span>
                        <Badge className="bg-green-600">26.7%</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Daily Active Users</span>
                      <span className="text-white font-bold">3,247</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Weekly Active Users</span>
                      <span className="text-white font-bold">8,934</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Monthly Active Users</span>
                      <span className="text-white font-bold">12,847</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Revenue Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {revenueBreakdown.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white">{item.source}</span>
                        <span className="text-white font-bold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="w-full bg-navy-700 rounded-full h-2">
                        <div 
                          className="bg-orange-600 h-2 rounded-full" 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="border-orange-600 text-orange-400">
                          {item.percentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Revenue Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Monthly Recurring Revenue</span>
                      <span className="text-white font-bold">$89,450</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Average Revenue Per User</span>
                      <span className="text-white font-bold">$9.92</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-navy-700 rounded-lg">
                      <span className="text-white">Customer Lifetime Value</span>
                      <span className="text-white font-bold">$347</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="geography" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Top Areas by User Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topCounties.map((county, index) => (
                    <div key={index} className="p-4 bg-navy-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium">{county.name}</h3>
                        <Badge className="bg-orange-600 text-white">#{index + 1}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-gray-400">Total Users</p>
                          <p className="text-white font-bold">{county.users.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-400">Contractors</p>
                          <p className="text-white font-bold">{county.contractors}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-400">Projects</p>
                          <p className="text-white font-bold">{county.projects}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Zap className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">98.7%</div>
                  <div className="text-gray-400 text-sm">Platform Uptime</div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">1.2s</div>
                  <div className="text-gray-400 text-sm">Avg Response Time</div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Target className="h-8 w-8 text-green-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">92.3%</div>
                  <div className="text-gray-400 text-sm">Success Rate</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default PlatformAnalytics;