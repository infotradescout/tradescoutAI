import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, TrendingUp, Users, DollarSign, Heart, Award, Globe, Target, Zap, Building } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface NationwideMetrics {
  totalCounties: number;
  activeCounties: number;
  totalUsers: number;
  totalContractors: number;
  totalHOAs: number;
  monthlyActiveUsers: number;
  platformRevenue: string;
  foundationDonations: string;
  averageJobValue: string;
  totalJobsCompleted: number;
  customerSatisfactionRate: number;
  contractorRetentionRate: number;
  countyActivationRate: number;
  monthlyGrowthRate: number;
}

interface County {
  fipsCode: string;
  name: string;
  state: string;
  activeContractors: number;
  monthlyJobs: number;
  averageJobValue: string;
  customerRating: number;
  populationServed: number;
  activationDate: string;
}

interface ExpansionPhase {
  phase: string;
  targetCounties: number;
  estimatedTimeframe: string;
  requiredInvestment: string;
  expectedUsers: number;
  expectedContractors: number;
  marketPenetration: string;
  status: string;
}

export default function NationwideExpansion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/nationwide/metrics'],
    queryFn: () => fetch('/api/nationwide/metrics').then(res => res.json())
  });

  const { data: topCounties = [], isLoading: countiesLoading } = useQuery({
    queryKey: ['/api/nationwide/top-counties'],
    queryFn: () => fetch('/api/nationwide/top-counties?limit=10').then(res => res.json())
  });

  const { data: expansionPipeline = [], isLoading: pipelineLoading } = useQuery({
    queryKey: ['/api/nationwide/expansion-pipeline'],
    queryFn: () => fetch('/api/nationwide/expansion-pipeline').then(res => res.json())
  });

  const { data: foundationImpact, isLoading: impactLoading } = useQuery({
    queryKey: ['/api/nationwide/foundation-impact'],
    queryFn: () => fetch('/api/nationwide/foundation-impact').then(res => res.json())
  });

  const { data: affiliatePerformance, isLoading: affiliateLoading } = useQuery({
    queryKey: ['/api/nationwide/affiliate-performance'],
    queryFn: () => fetch('/api/nationwide/affiliate-performance').then(res => res.json())
  });

  if (metricsLoading) {
    return (
      <div className="min-h-screen gradient-bg p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-2 text-slate-400">Loading nationwide metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg p-6" data-testid="nationwide-expansion-page">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">Nationwide Expansion</h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Phase 5: Scaling TradeScout across all 3,142 US counties with community impact and sustainable growth.
          </p>
        </div>

        {/* Key Metrics Dashboard */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card
              className="border-slate-700"
              style={{ backgroundColor: "var(--surface-card)" }}
            >
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-white">{metrics.activeCounties.toLocaleString()}</div>
                <p className="text-xs text-slate-400">Active Counties</p>
                <div className="text-xs text-green-400 mt-1">
                  {metrics.countyActivationRate.toFixed(1)}% coverage
                </div>
              </CardContent>
            </Card>
            
            <Card
              className="border-slate-700"
              style={{ backgroundColor: "var(--surface-card)" }}
            >
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-4 h-4 text-green-400" />
                </div>
                <div className="text-xl font-bold text-white">{metrics.totalUsers.toLocaleString()}</div>
                <p className="text-xs text-slate-400">Total Users</p>
                <div className="text-xs text-green-400 mt-1">
                  +{metrics.monthlyGrowthRate}% monthly
                </div>
              </CardContent>
            </Card>

            <Card
              className="border-slate-700"
              style={{ backgroundColor: "var(--surface-card)" }}
            >
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-xl font-bold text-white">{metrics.totalContractors.toLocaleString()}</div>
                <p className="text-xs text-slate-400">Contractors</p>
                <div className="text-xs text-green-400 mt-1">
                  {metrics.contractorRetentionRate}% retention
                </div>
              </CardContent>
            </Card>

            <Card
              className="border-slate-700"
              style={{ backgroundColor: "var(--surface-card)" }}
            >
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Building className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-xl font-bold text-white">{metrics.totalHOAs.toLocaleString()}</div>
                <p className="text-xs text-slate-400">HOAs Managed</p>
              </CardContent>
            </Card>

            <Card
              className="border-slate-700"
              style={{ backgroundColor: "var(--surface-card)" }}
            >
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="w-4 h-4 text-teal-400" />
                </div>
                <div className="text-lg font-bold text-white">${parseInt(metrics.platformRevenue).toLocaleString()}</div>
                <p className="text-xs text-slate-400">Revenue</p>
                <div className="text-xs text-blue-400 mt-1">
                  ${parseInt(metrics.averageJobValue).toLocaleString()} avg job
                </div>
              </CardContent>
            </Card>

            <Card
              className="border-slate-700"
              style={{ backgroundColor: "var(--surface-card)" }}
            >
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Heart className="w-4 h-4 text-pink-400" />
                </div>
                <div className="text-lg font-bold text-white">${parseInt(metrics.foundationDonations).toLocaleString()}</div>
                <p className="text-xs text-slate-400">Foundation</p>
                <div className="text-xs text-pink-400 mt-1">
                  10% of revenue
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList
            className="grid w-full grid-cols-5"
            style={{ backgroundColor: "var(--surface-frame)" }}
          >
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-500">Overview</TabsTrigger>
            <TabsTrigger value="counties" className="data-[state=active]:bg-purple-500">Top Areas</TabsTrigger>
            <TabsTrigger value="expansion" className="data-[state=active]:bg-purple-500">Expansion</TabsTrigger>
            <TabsTrigger value="foundation" className="data-[state=active]:bg-purple-500">Foundation</TabsTrigger>
            <TabsTrigger value="affiliates" className="data-[state=active]:bg-purple-500">Affiliates</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card
                className="border-slate-700"
                style={{ backgroundColor: "var(--surface-card)" }}
              >
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Target className="w-5 h-5 text-green-400" />
                    <span>Expansion Progress</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">US Area Coverage</span>
                      <span className="text-white">{metrics?.countyActivationRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={metrics?.countyActivationRate || 0} className="h-3" />
                    <p className="text-xs text-slate-400">
                      {metrics?.activeCounties.toLocaleString()} of {metrics?.totalCounties.toLocaleString()} areas active
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-green-500/20 rounded-lg">
                      <div className="text-lg font-bold text-green-400">{metrics?.totalJobsCompleted.toLocaleString()}</div>
                      <p className="text-xs text-green-300">Jobs Completed</p>
                    </div>
                    <div className="text-center p-3 bg-blue-500/20 rounded-lg">
                      <div className="text-lg font-bold text-blue-400">{metrics?.customerSatisfactionRate}</div>
                      <p className="text-xs text-blue-300">Satisfaction Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="border-slate-700"
                style={{ backgroundColor: "var(--surface-card)" }}
              >
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Heart className="w-5 h-5 text-pink-400" />
                    <span>Community Impact</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {foundationImpact && (
                    <>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Total Donated</span>
                          <span className="text-pink-400 font-semibold">${parseInt(foundationImpact.totalDonated).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Scholarships Awarded</span>
                          <span className="text-blue-400 font-semibold">{foundationImpact.scholarshipsAwarded}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Veterans Placed</span>
                          <span className="text-green-400 font-semibold">{foundationImpact.veteranPlacements}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Trade School Partners</span>
                          <span className="text-orange-400 font-semibold">{foundationImpact.tradeSchoolPartnerships}</span>
                        </div>
                      </div>
                      
                      <div className="text-center p-3 bg-purple-500/20 rounded-lg">
                        <div className="text-xl font-bold text-purple-400">{foundationImpact.beneficiariesReached.toLocaleString()}</div>
                        <p className="text-xs text-purple-300">Lives Impacted</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="counties" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                <Award className="w-5 h-5 text-yellow-400" />
                <span>Top Performing Counties</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {topCounties.map((county: County, index: number) => (
                  <Card
                    key={county.fipsCode}
                    className="border-slate-700"
                    style={{ backgroundColor: "var(--surface-card)" }}
                    data-testid={`county-${county.fipsCode}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-white text-lg">{county.name}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                              #{index + 1}
                            </Badge>
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {county.state}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-yellow-400">{county.customerRating}</div>
                          <p className="text-xs text-slate-400">Rating</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="space-y-1">
                          <div className="text-lg font-bold text-orange-400">{county.activeContractors}</div>
                          <p className="text-xs text-slate-400">Contractors</p>
                        </div>
                        <div className="space-y-1">
                          <div className="text-lg font-bold text-green-400">{county.monthlyJobs}</div>
                          <p className="text-xs text-slate-400">Jobs/Month</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Avg Job Value</span>
                          <span className="text-teal-400 font-semibold">${parseInt(county.averageJobValue).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Population Served</span>
                          <span className="text-blue-400 font-semibold">{county.populationServed.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Active Since</span>
                          <span className="text-slate-300">{new Date(county.activationDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="expansion" className="space-y-6">
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <span>Expansion Pipeline</span>
              </h3>
              {expansionPipeline.map((phase: ExpansionPhase, index: number) => (
                <Card
                  key={index}
                  className="border-slate-700"
                  style={{ backgroundColor: "var(--surface-card)" }}
                  data-testid={`expansion-phase-${index}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <CardTitle className="text-white">{phase.phase}</CardTitle>
                        <Badge
                          variant={phase.status === 'in_progress' ? 'default' : 'secondary'}
                          className={phase.status === 'in_progress' ? 'bg-green-500/20 text-green-400' : 'bg-slate-900/40 text-slate-400'}
                        >
                          {phase.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-400">{phase.targetCounties}</div>
                        <p className="text-sm text-slate-400">Counties</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-slate-300">{phase.marketPenetration}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-blue-500/20 rounded-lg">
                        <div className="text-lg font-bold text-blue-400">{phase.estimatedTimeframe}</div>
                        <p className="text-xs text-blue-300">Timeline</p>
                      </div>
                      <div className="text-center p-3 bg-green-500/20 rounded-lg">
                        <div className="text-lg font-bold text-green-400">${parseInt(phase.requiredInvestment).toLocaleString()}</div>
                        <p className="text-xs text-green-300">Investment</p>
                      </div>
                      <div className="text-center p-3 bg-orange-500/20 rounded-lg">
                        <div className="text-lg font-bold text-orange-400">{phase.expectedUsers.toLocaleString()}</div>
                        <p className="text-xs text-orange-300">New Users</p>
                      </div>
                      <div className="text-center p-3 bg-purple-500/20 rounded-lg">
                        <div className="text-lg font-bold text-purple-400">{phase.expectedContractors.toLocaleString()}</div>
                        <p className="text-xs text-purple-300">Contractors</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="foundation" className="space-y-6">
            {foundationImpact && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card
                  className="border-slate-700"
                  style={{ backgroundColor: "var(--surface-card)" }}
                >
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Heart className="w-5 h-5 text-pink-400" />
                      <span>Mike Rowe Works Foundation</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Projects Funded</span>
                        <span className="text-pink-400 font-semibold">{foundationImpact.mikeRoweWorksProjects}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Scholarships</span>
                        <span className="text-blue-400 font-semibold">{foundationImpact.scholarshipsAwarded}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Apprenticeships</span>
                        <span className="text-green-400 font-semibold">{foundationImpact.apprenticeshipsSponsored}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Jobs Created</span>
                        <span className="text-orange-400 font-semibold">{foundationImpact.jobsCreated}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="border-slate-700"
                  style={{ backgroundColor: "var(--surface-card)" }}
                >
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Building className="w-5 h-5 text-teal-400" />
                      <span>Local Community Impact</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Community Projects</span>
                        <span className="text-teal-400 font-semibold">{foundationImpact.communityProjectsFunded}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Local Grants</span>
                        <span className="text-purple-400 font-semibold">{foundationImpact.localImpactGrants}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Avg Grant Size</span>
                        <span className="text-yellow-400 font-semibold">${parseInt(foundationImpact.averageGrantSize).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-r from-pink-500/20 to-teal-500/20 rounded-lg">
                      <div className="text-2xl font-bold text-white">{foundationImpact.beneficiariesReached.toLocaleString()}</div>
                      <p className="text-slate-300">Total Lives Impacted</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="affiliates" className="space-y-6">
            {affiliatePerformance && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card
                    className="border-slate-700"
                    style={{ backgroundColor: "var(--surface-card)" }}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-green-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{affiliatePerformance.totalAffiliates.toLocaleString()}</div>
                      <p className="text-slate-400">Total Affiliates</p>
                    </CardContent>
                  </Card>
                  
                  <Card
                    className="border-slate-700"
                    style={{ backgroundColor: "var(--surface-card)" }}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Zap className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{affiliatePerformance.activeAffiliates.toLocaleString()}</div>
                      <p className="text-slate-400">Active This Month</p>
                    </CardContent>
                  </Card>

                  <Card
                    className="border-slate-700"
                    style={{ backgroundColor: "var(--surface-card)" }}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <DollarSign className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">${parseInt(affiliatePerformance.totalCommissionsPaid).toLocaleString()}</div>
                      <p className="text-slate-400">Commissions Paid</p>
                    </CardContent>
                  </Card>

                  <Card
                    className="border-slate-700"
                    style={{ backgroundColor: "var(--surface-card)" }}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <TrendingUp className="w-6 h-6 text-orange-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">${parseFloat(affiliatePerformance.averageCommissionPerAffiliate).toLocaleString()}</div>
                      <p className="text-slate-400">Avg per Affiliate</p>
                    </CardContent>
                  </Card>
                </div>

                <Card
                  className="border-slate-700"
                  style={{ backgroundColor: "var(--surface-card)" }}
                >
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Award className="w-5 h-5 text-yellow-400" />
                      <span>Top Performing Affiliates</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {affiliatePerformance.topPerformers.map((performer: any, index: number) => (
                        <div key={performer.userId} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                              #{index + 1}
                            </Badge>
                            <div>
                              <div className="font-semibold text-white">{performer.name}</div>
                              <div className="text-sm text-slate-400">{performer.referrals} referrals • {performer.conversionRate}% conversion</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-400">${parseFloat(performer.earnings).toLocaleString()}</div>
                            <div className="text-sm text-slate-400">Earned</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}