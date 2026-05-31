import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  MapPin,
  Star,
  Clock,
  Calculator,
  Users,
  ChevronRight,
  Zap,
  Target,
  Award,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import { AdDisplay, useUserLocation } from "@/components/AdDisplay";
import { InteractiveCountyMap } from "@/components/InteractiveCountyMap";
import { sanitizeAreaLabel } from "@/lib/copyHelpers";
import { FirstUseGuidanceCard } from "@/components/guidance/FirstUseGuidanceCard";
import { FirstUsefulStepLauncher } from "@/components/guidance/FirstUsefulStepLauncher";
import {
  DIRECT_CONNECT_GUIDANCE_TEXT,
  HOMEID_GUIDANCE_TEXT,
  SCOUT_GUIDANCE_TEXT,
  TRADE_SCOUT_PRODUCT_EXPLANATION,
} from "@/lib/firstUseGuidance";

export default function Home() {
  const { user } = useAuth();
  const userLocation = useUserLocation();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const { data: vaultSnapshot, isLoading: vaultLoading } = useQuery({
    queryKey: ["/api/vaults/my-county"],
    queryFn: async () => {
      const res = await fetch("/api/vaults/my-county");
      if (res.status === 400) return null;
      if (!res.ok) throw new Error("Failed to load vault");
      return res.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const countyLabel = vaultSnapshot?.county
    ? `${sanitizeAreaLabel(vaultSnapshot.county.name)}, ${vaultSnapshot.county.stateCode}`
    : user?.county && user?.state
      ? `${sanitizeAreaLabel(user.county)}, ${user.state}`
      : "Your area";

  return (
    <ScrollArea
      className="h-full"
      headerHeight={80}
      pageHeight={window.innerHeight - 80}
      scrollToTop={false}
    >
      <div className="max-w-7xl mx-auto ts-surface px-4 sm:px-6 lg:px-8 py-6 md:py-12">
        <div className="mb-5 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Welcome back, {user?.firstName || "User"}
          </h1>
          <p className="text-white/70">Here's what's happening in your area</p>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-2.5 md:mb-6">
          <Card className="border-ts-orange/30 bg-tsCard">
            <CardContent className="p-3.5 md:p-5">
              <p className="text-sm text-white/80">{TRADE_SCOUT_PRODUCT_EXPLANATION}</p>
            </CardContent>
          </Card>
          <FirstUsefulStepLauncher />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FirstUseGuidanceCard
              title="Scout is your discovery page."
              description={SCOUT_GUIDANCE_TEXT}
            />
            <FirstUseGuidanceCard
              title="HomeID keeps your home history organized."
              description={HOMEID_GUIDANCE_TEXT}
            />
            <FirstUseGuidanceCard
              title="Direct Connect prepares your request."
              description={DIRECT_CONNECT_GUIDANCE_TEXT}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          <Card className="bg-gradient-to-r from-slate-800 to-navy-700 border-white/10 card-enhanced">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-white/60">Community Vault</p>
                  <h2 className="text-xl font-semibold text-white">{countyLabel}</h2>
                </div>
                <Badge className="bg-ts-orange text-white">Local Impact</Badge>
              </div>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-4">
                <div>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    {vaultLoading
                      ? "Loading..."
                      : formatCurrency(vaultSnapshot?.vault?.currentBalance ?? 0)}
                  </p>
                  <p className="text-sm text-white/60">Local reinvestment balance</p>
                  <div className="mt-3 text-sm text-green-400 flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      Last 30d inflow: {formatCurrency(vaultSnapshot?.last30dInflow ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  {vaultSnapshot?.sourcesBreakdown &&
                  Object.keys(vaultSnapshot.sourcesBreakdown).length > 0 ? (
                    Object.entries(vaultSnapshot.sourcesBreakdown).map(([source, amount]) => (
                      <Badge
                        key={source}
                        variant="outline"
                        className="border-white/15 text-white/70"
                      >
                        {source.replace(/_/g, " ")} - {formatCurrency(amount as number)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-white/60">No contributions yet</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10 card-enhanced">
            <CardContent className="p-4 md:p-6 h-full flex flex-col justify-between">
              <div>
                <p className="text-sm text-white/70 mb-1">Transparency</p>
                <h2 className="text-xl font-semibold text-white mb-2">See where dollars go</h2>
                <p className="text-white/60 text-sm">
                  Track TradeScout contributions flowing back into your county across Exchange fees,
                  contractor programs, and Community Builders donations.
                </p>
              </div>
              <div className="flex items-center space-x-3 pt-4 flex-wrap gap-2">
                <Button asChild className="bg-ts-orange hover:bg-ts-orange-dark">
                  <Link href="/foundation">Open Community Builders</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/15 text-white hover:border-ts-orange/30"
                >
                  <Link href="/community-builder/dashboard">Community Builder badge</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                >
                  <a
                    href="https://buy.stripe.com/cNi28r74reaSg392IV8N200"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Donate to Builder Fund
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
          <Link href="/direct-connect">
            <Card className="bg-tsCard border-white/10 card-enhanced cursor-pointer">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-ts-orange/20 rounded-lg flex items-center justify-center glow-orange">
                      <ClipboardList className="h-6 w-6 text-ts-orange" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Open Direct Connect</h3>
                      <p className="text-white/60 text-sm">
                        Start and manage Direct Connect requests
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/60" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/contractors">
            <Card className="bg-tsCard border-white/10 card-enhanced cursor-pointer">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-ts-orange/20 rounded-lg flex items-center justify-center glow-orange">
                      <MapPin className="h-6 w-6 text-ts-orange" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Find Local Help</h3>
                      <p className="text-white/60 text-sm">
                        Search verified local providers in your area
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/60" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/quote">
            <Card className="bg-tsCard border-white/10 card-enhanced cursor-pointer">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-ts-orange/20 rounded-lg flex items-center justify-center glow-orange">
                      <Calculator className="h-6 w-6 text-ts-orange" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Get Estimate</h3>
                      <p className="text-white/60 text-sm">Calculate project estimates</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/60" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Platform Statistics */}
        <div className="mb-5 md:mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Platform Updates</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-tsCard border-white/10 text-center card-enhanced">
              <CardContent className="p-4">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Zap className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-white">100%</p>
                <p className="text-sm text-white/60">Loading Speed</p>
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10 text-center card-enhanced">
              <CardContent className="p-4">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Target className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">Enhanced</p>
                <p className="text-sm text-white/60">User Experience</p>
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10 text-center card-enhanced">
              <CardContent className="p-4">
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Award className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-white">New</p>
                <p className="text-sm text-white/60">Visual Design</p>
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10 text-center card-enhanced">
              <CardContent className="p-4">
                <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Users className="h-4 w-4 text-ts-orange" />
                </div>
                <p className="text-2xl font-bold text-white">Fixed</p>
                <p className="text-sm text-white/60">TypeScript Issues</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                  <div>
                    <p className="text-white font-medium">Roof Replacement Estimate</p>
                    <p className="text-white/60 text-sm">Requested 2 days ago</p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                  <div>
                    <p className="text-white font-medium">Plumbing Repair</p>
                    <p className="text-white/60 text-sm">Completed 1 week ago</p>
                  </div>
                  <Badge className="bg-green-600">Completed</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Top Contractors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-ts-orange rounded-lg flex items-center justify-center text-white font-bold">
                    AC
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Apex Construction</p>
                    <div className="flex items-center space-x-2">
                      <div className="flex text-yellow-400">
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                      </div>
                      <span className="text-white/60 text-sm">4.9 (42 recommendations)</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    Licensed
                  </Badge>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-ts-orange rounded-lg flex items-center justify-center text-white font-bold">
                    EP
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Elite Plumbing Co.</p>
                    <div className="flex items-center space-x-2">
                      <div className="flex text-yellow-400">
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4" />
                      </div>
                      <span className="text-white/60 text-sm">4.7 (28 recommendations)</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    Licensed
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Location-aware Advertisement - DISABLED TEMPORARILY */}
        {/* <div className="mt-6 md:mt-8">
          <AdDisplay className="max-w-2xl mx-auto" userLocation={userLocation} />
        </div> */}

        {/* Interactive County Map */}
        <div className="mt-8 md:mt-12">
          <InteractiveCountyMap variant="homeowner" showTitle={true} className="max-w-full" />
        </div>
      </div>
    </ScrollArea>
  );
}
