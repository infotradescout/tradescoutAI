import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Users2,
  TrendingUp,
  DollarSign,
  MapPin,
  Clock,
  Award,
  Target,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isAdminTier } from "@/lib/roleChecks";

const PlatformAnalytics = memo(function PlatformAnalytics() {
  const [timeRange, setTimeRange] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview");

  const { user } = useAuth();
  const adminRolesAllowed = !!user && (isAdminTier(user.role || "") || user.role === "moderator");

  type ScoutDraftArtifactSummary = {
    draftKind: "promo" | "community";
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
    actionType: "community_notice" | "provider_coordination" | "promotion";
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
    enabled: adminRolesAllowed,
    staleTime: 60 * 1000,
  });

  const outcomeRolesAllowed =
    !!user &&
    [
      "support_agent",
      "content_moderator",
      "territory_manager",
      "contractor_success",
      "content_seo",
      "analytics_specialist",
      "marketing_specialist",
      "moderator",
      "ops_admin",
      "super_admin",
    ].includes(user.role || "");

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

  type AdminStatsResponse = {
    totalUsers: number;
    totalContractors?: number;
    newLeads?: number;
    totalRecommendations?: number;
    totalCommunityPosts?: number;
    roleBreakdown?: {
      homeowner: number;
      contractor: number;
      handyman: number;
      realtor: number;
    };
  };

  type AdminUserSummary = {
    id: string;
    email?: string | null;
    role?: string | null;
    activeRole?: string | null;
    roles?: string[] | null;
    preferences?: Record<string, unknown> | null;
    createdAt?: string | null;
  };

  type CoverageSummary = {
    totalCounties: number;
    unassignedCounties: number;
    partiallyCoveredCounties: number;
    fullyCoveredCounties: number;
    verifiedCoverageRatePercent: number;
    rows: Array<{
      countyName: string;
      stateCode: string;
      territoryManagerCount: number;
      affiliateCount: number;
      coverageStatus: "unassigned" | "partial" | "full";
    }>;
  };

  type ObservabilitySummary = {
    dbPool?: { current?: { active: number; idle: number; waiting: number } };
    http?: {
      total: number;
      statusClasses?: { ["2xx"]?: number; ["4xx"]?: number; ["5xx"]?: number };
    };
  };

  const { data: adminStats } = useQuery<AdminStatsResponse>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/stats"),
    enabled: adminRolesAllowed,
    staleTime: 60 * 1000,
  });

  const { data: adminUsers = [] } = useQuery<AdminUserSummary[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users"),
    enabled: adminRolesAllowed,
    staleTime: 60 * 1000,
  });

  const { data: coverageSummary } = useQuery<CoverageSummary>({
    queryKey: ["/api/admin/geo/coverage", "analytics"],
    queryFn: () => apiRequest("GET", "/api/admin/geo/coverage"),
    enabled: adminRolesAllowed,
    staleTime: 60 * 1000,
  });

  const { data: observabilitySummary } = useQuery<ObservabilitySummary>({
    queryKey: ["/api/admin/observability/summary"],
    queryFn: () => apiRequest("GET", "/api/admin/observability/summary"),
    enabled: adminRolesAllowed,
    staleTime: 30 * 1000,
  });

  if (!adminRolesAllowed) {
    return (
      <div className="h-full bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Admin Access Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/70">This page is restricted to admin roles.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalUsers = adminStats?.totalUsers ?? adminUsers.length;
  const totalContractors =
    adminStats?.totalContractors ??
    (adminStats?.roleBreakdown?.contractor || 0) + (adminStats?.roleBreakdown?.handyman || 0);
  const communityPosts = adminStats?.totalCommunityPosts || 0;
  const marketplaceVolumeToday =
    (moneyMovements?.marketplace.totalStripeVolume || 0) +
    (moneyMovements?.marketplace.totalOffPlatformVolume || 0);
  const httpTotal = observabilitySummary?.http?.total || 0;
  const http2xx = observabilitySummary?.http?.statusClasses?.["2xx"] || 0;
  const successRate = httpTotal > 0 ? (http2xx / httpTotal) * 100 : 0;

  const overviewStats = [
    {
      label: "Total Users",
      value: totalUsers.toLocaleString(),
      change: "Live total",
      trend: "up",
      icon: Users2,
      color: "text-blue-400",
    },
    {
      label: "Active Contractors",
      value: totalContractors.toLocaleString(),
      change: "Contractor + handyman",
      trend: "up",
      icon: Award,
      color: "text-green-400",
    },
    {
      label: "Marketplace Volume (Today)",
      value: formatCurrency(marketplaceVolumeToday),
      change: "Stripe + off-platform",
      trend: "up",
      icon: DollarSign,
      color: "text-purple-400",
    },
    {
      label: "Community Posts",
      value: communityPosts.toLocaleString(),
      change: "All-time",
      trend: "up",
      icon: Target,
      color: "text-ts-orange",
    },
  ];

  const userGrowth = useMemo(() => {
    const isArchivedPlaceholderEmail = (email: string | null | undefined): boolean => {
      const normalized = String(email || "")
        .trim()
        .toLowerCase();
      return normalized.startsWith("archived+") && normalized.endsWith("@thetradescout.invalid");
    };

    const isImportTaggedUser = (u: AdminUserSummary): boolean => {
      const prefs = (u.preferences || {}) as Record<string, unknown>;
      const tags = [
        prefs.importSource,
        prefs.sourceTag,
        prefs.createdBy,
        prefs.archivedReason,
        prefs.accountOrigin,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      if (tags.includes("import")) return true;
      if (tags.includes("admin_import_cleanup")) return true;
      if (prefs.isImportedBusiness === true) return true;
      return false;
    };

    const isBusinessIntentUser = (u: AdminUserSummary): boolean => {
      const prefs = (u.preferences || {}) as Record<string, unknown>;
      const provisional =
        prefs.provisional && typeof prefs.provisional === "object"
          ? (prefs.provisional as Record<string, unknown>)
          : {};
      const directIntent = String(prefs.userIntent || "")
        .trim()
        .toLowerCase();
      const provisionalIntent = String(provisional.userIntent || "")
        .trim()
        .toLowerCase();
      const accountType = String(prefs.accountType || provisional.accountType || "")
        .trim()
        .toLowerCase();
      return (
        directIntent === "business" ||
        provisionalIntent === "business" ||
        accountType === "business" ||
        prefs.isBusiness === true
      );
    };

    const getRoleTokens = (u: AdminUserSummary): Set<string> => {
      const tokens = new Set<string>();
      const addToken = (value: unknown) => {
        const token = String(value || "")
          .trim()
          .toLowerCase();
        if (!token) return;
        if (token === "owner" || token === "head_admin") {
          tokens.add("super_admin");
          return;
        }
        tokens.add(token);
      };
      addToken(u.role);
      addToken(u.activeRole);
      for (const r of Array.isArray(u.roles) ? u.roles : []) addToken(r);
      return tokens;
    };

    const now = new Date();
    const months: Array<{ month: string; homeowners: number; contractors: number; total: number }> =
      [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleString("en-US", { month: "short" });

      let homeowners = 0;
      let contractors = 0;
      let total = 0;

      for (const u of adminUsers) {
        if (isArchivedPlaceholderEmail(u.email)) continue;
        if (isImportTaggedUser(u)) continue;

        const createdAt = u.createdAt ? new Date(u.createdAt) : null;
        if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
        const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
        if (key !== monthKey) continue;
        total += 1;
        const roleSet = getRoleTokens(u);
        const isContractorLike =
          roleSet.has("contractor") ||
          roleSet.has("contractor_user") ||
          roleSet.has("handyman") ||
          roleSet.has("accelerator_member");
        const isAdminLike =
          roleSet.has("super_admin") || roleSet.has("ops_admin") || roleSet.has("moderator");
        const isHomeownerOnly =
          roleSet.has("homeowner") && !isContractorLike && !isAdminLike && !isBusinessIntentUser(u);

        if (isHomeownerOnly) homeowners += 1;
        if (isContractorLike) contractors += 1;
      }

      months.push({ month: monthLabel, homeowners, contractors, total });
    }
    return months;
  }, [adminUsers]);

  const topCounties = useMemo(() => {
    const rows = coverageSummary?.rows || [];
    return [...rows]
      .sort((a, b) => {
        const aCoverage = a.territoryManagerCount + a.affiliateCount;
        const bCoverage = b.territoryManagerCount + b.affiliateCount;
        return bCoverage - aCoverage;
      })
      .slice(0, 5)
      .map((row) => ({
        name: `${row.countyName}, ${row.stateCode}`,
        coverageEntities: row.territoryManagerCount + row.affiliateCount,
        territoryManagers: row.territoryManagerCount,
        affiliates: row.affiliateCount,
        status: row.coverageStatus,
      }));
  }, [coverageSummary]);

  const revenueBreakdown = useMemo(() => {
    const stripe = moneyMovements?.marketplace.totalStripeVolume || 0;
    const offPlatform = moneyMovements?.marketplace.totalOffPlatformVolume || 0;
    const walletCredits = moneyMovements?.wallet.totalCredits || 0;
    const walletDebits = moneyMovements?.wallet.totalDebits || 0;
    const total = stripe + offPlatform + walletCredits + walletDebits;
    const pct = (amount: number) => (total > 0 ? Number(((amount / total) * 100).toFixed(1)) : 0);
    return [
      { source: "Stripe Volume (Today)", amount: stripe, percentage: pct(stripe) },
      { source: "Off-platform Volume (Today)", amount: offPlatform, percentage: pct(offPlatform) },
      { source: "Wallet Credits (Today)", amount: walletCredits, percentage: pct(walletCredits) },
      { source: "Wallet Debits (Today)", amount: walletDebits, percentage: pct(walletDebits) },
    ];
  }, [moneyMovements]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const scoutArtifacts = (scoutDraftSummary?.artifacts || []).reduce<
    Record<"promo" | "community", ScoutDraftArtifactSummary | undefined>
  >(
    (acc, art) => {
      acc[art.draftKind] = art;
      return acc;
    },
    { promo: undefined, community: undefined }
  );

  const winnerLabel = (() => {
    const promo = scoutArtifacts.promo;
    const community = scoutArtifacts.community;
    if (!promo && !community) return "Not enough data yet";
    const promoRate = promo && promo.created > 0 ? promo.published / promo.created : 0;
    const communityRate =
      community && community.created > 0 ? community.published / community.created : 0;
    if (promoRate === 0 && communityRate === 0) return "No publishes yet";
    if (promoRate > communityRate) return "Promotions are currently winning";
    if (communityRate > promoRate) return "Community posts are currently winning";
    return "Flows are performing similarly";
  })();

  const outcomeByType = (outcomeSummary?.byActionType || []).reduce<
    Record<OutcomeSummaryByActionType["actionType"], OutcomeSummaryByActionType | undefined>
  >(
    (acc, item) => {
      acc[item.actionType] = item;
      return acc;
    },
    {
      community_notice: undefined,
      provider_coordination: undefined,
      promotion: undefined,
    }
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
                <p className="text-muted-foreground text-lg">
                  Comprehensive insights into platform performance and growth
                </p>
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
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="money"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Money Movements
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Users
            </TabsTrigger>
            <TabsTrigger
              value="revenue"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Revenue
            </TabsTrigger>
            <TabsTrigger
              value="geography"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Geography
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {overviewStats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <Card key={index} className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/60 text-sm">{stat.label}</p>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                          <p
                            className={`text-sm ${stat.trend === "up" ? "text-green-400" : "text-red-400"}`}
                          >
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
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-ts-orange" />
                    Scout Draft Conversion (last 72h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-white/70">
                    {(["promo", "community"] as const).map((kind) => {
                      const art = scoutArtifacts[kind];
                      const label = kind === "promo" ? "Promotions" : "Community Posts";
                      if (!art) {
                        return (
                          <div key={kind} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{label}</span>
                              <Badge
                                variant="outline"
                                className="text-xs border-white/15 text-white/70"
                              >
                                No data yet
                              </Badge>
                            </div>
                            <p className="text-xs text-white/60">
                              Waiting for Scout-driven drafts to accumulate.
                            </p>
                          </div>
                        );
                      }

                      const publishRate = art.created > 0 ? (art.published / art.created) * 100 : 0;
                      const medianMinutes =
                        art.medianTimeToPublishMs != null
                          ? Math.round(art.medianTimeToPublishMs / 60000)
                          : null;

                      return (
                        <div key={kind} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{label}</span>
                            <Badge
                              variant="outline"
                              className="text-xs border-ts-orange/30 text-ts-orange"
                            >
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
                              {medianMinutes != null ? `${medianMinutes} min` : "—"}
                            </span>
                          </div>
                          {art.topCountiesByPublishRate.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[11px] text-white/60 mb-1">
                                Top counties by publish rate
                              </p>
                              <ul className="space-y-0.5 text-[11px] text-white/70">
                                {art.topCountiesByPublishRate.map((c) => (
                                  <li
                                    key={`${c.stateCode}-${c.countyFips}`}
                                    className="flex justify-between"
                                  >
                                    <span>
                                      {c.countyFips ?? "Unknown"}
                                      {c.stateCode ? `, ${c.stateCode}` : ""}
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
                  <div className="mt-4 text-xs text-white/60">
                    <span className="font-semibold text-white/70">Verdict: </span>
                    {winnerLabel}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Outcome Confirmation Summary */}
            {outcomeSummary && (
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-ts-orange" />
                    Outcome Confirmation (last 72h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-white/70">
                    {(
                      [
                        { key: "community_notice", label: "Community Notices" },
                        { key: "provider_coordination", label: "Provider Coordination" },
                        { key: "promotion", label: "Promotions" },
                      ] as const
                    ).map(({ key, label }) => {
                      const bucket = outcomeByType[key];
                      if (!bucket) {
                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{label}</span>
                              <Badge
                                variant="outline"
                                className="text-xs border-white/15 text-white/70"
                              >
                                No data yet
                              </Badge>
                            </div>
                            <p className="text-xs text-white/60">
                              Waiting for outcome confirmations to accumulate.
                            </p>
                          </div>
                        );
                      }

                      const {
                        initiated,
                        success,
                        pending,
                        failed,
                        medianTimeToOutcomeMs,
                        topCountiesByConfirmationRate,
                      } = bucket;
                      const successRate = initiated > 0 ? (success / initiated) * 100 : 0;
                      const medianMinutes =
                        medianTimeToOutcomeMs != null
                          ? Math.round(medianTimeToOutcomeMs / 60000)
                          : null;

                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{label}</span>
                            <Badge
                              variant="outline"
                              className="text-xs border-green-500/50 text-green-300"
                            >
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
                              {medianMinutes != null ? `${medianMinutes} min` : "—"}
                            </span>
                          </div>
                          {topCountiesByConfirmationRate.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[11px] text-white/60 mb-1">
                                Top counties by confirmation rate
                              </p>
                              <ul className="space-y-0.5 text-[11px] text-white/70">
                                {topCountiesByConfirmationRate.map((c) => (
                                  <li
                                    key={`${c.stateCode}-${c.countyFips}`}
                                    className="flex justify-between"
                                  >
                                    <span>
                                      {c.countyFips ?? "Unknown"}
                                      {c.stateCode ? `, ${c.stateCode}` : ""}
                                    </span>
                                    <span className="font-mono">
                                      {Math.round(c.confirmationRate * 100)}% ({c.confirmed}/
                                      {c.initiated})
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
            <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  User Growth Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userGrowth.map((month, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-tsCard rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-white font-medium w-12">{month.month}</span>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-600 text-white">
                            {month.homeowners} Homeowners
                          </Badge>
                          <Badge className="bg-green-600 text-white">
                            {month.contractors} Contractors
                          </Badge>
                        </div>
                      </div>
                      <div className="text-white font-bold">
                        {month.total.toLocaleString()} Total
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="money" className="space-y-6">
            <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
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
                      <p className="text-sm text-white/70">Wallet Flows (today)</p>
                      <p className="text-xs text-white/60">
                        Credits, debits, and net change across all user wallets.
                      </p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between text-emerald-300">
                          <span>Total Credits</span>
                          <span>${moneyMovements.wallet.totalCredits.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-ts-orange">
                          <span>Total Debits</span>
                          <span>${moneyMovements.wallet.totalDebits.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-white font-semibold border-t border-white/10 pt-1 mt-1">
                          <span>Net Change</span>
                          <span>${moneyMovements.wallet.netChange.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-white/70">Marketplace Volume (today)</p>
                      <p className="text-xs text-white/60">
                        Completed transactions by payment rail.
                      </p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between text-blue-300">
                          <span>Stripe (on-platform)</span>
                          <span>${moneyMovements.marketplace.totalStripeVolume.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-yellow-300">
                          <span>Off-platform / direct</span>
                          <span>
                            ${moneyMovements.marketplace.totalOffPlatformVolume.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-white/70">
                      <p className="font-semibold">How to read this</p>
                      <p className="text-white/60 text-xs">
                        Wallet credits should line up with affiliate commissions, admin adjustments,
                        and incoming payments. Debits should align with marketplace purchases, P2P
                        sends, and any withdrawals. Stripe vs off-platform totals give a quick sense
                        of how much volume is staying fully on-rails.
                      </p>
                      <p className="text-white/60 text-xs mt-2">
                        Date: <span className="font-mono">{moneyMovements.date}</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/60">
                    No money movement data available for today yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users2 className="h-5 w-5" />
                    User Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                      <span className="text-white">Homeowners</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">
                          {(adminStats?.roleBreakdown?.homeowner || 0).toLocaleString()}
                        </span>
                        <Badge className="bg-blue-600">
                          {totalUsers > 0
                            ? `${Math.round(((adminStats?.roleBreakdown?.homeowner || 0) / totalUsers) * 100)}%`
                            : "0%"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                      <span className="text-white">Contractors</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">
                          {totalContractors.toLocaleString()}
                        </span>
                        <Badge className="bg-green-600">
                          {totalUsers > 0
                            ? `${Math.round((totalContractors / totalUsers) * 100)}%`
                            : "0%"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                      <span className="text-white">Daily New Users</span>
                      <span className="text-white font-bold">
                        {userGrowth[userGrowth.length - 1]?.total?.toLocaleString() || "0"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                      <span className="text-white">Leads (last 7d)</span>
                      <span className="text-white font-bold">
                        {(adminStats?.newLeads || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                      <span className="text-white">Current User Base</span>
                      <span className="text-white font-bold">{totalUsers.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
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
                      <div className="w-full bg-tsCard rounded-full h-2">
                        <div
                          className="bg-ts-orange-dark h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="border-ts-orange/30 text-ts-orange">
                          {item.percentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Revenue Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                      <span className="text-white">Wallet Net Change (Today)</span>
                      <span className="text-white font-bold">
                        {formatCurrency(moneyMovements?.wallet.netChange || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                      <span className="text-white">Marketplace Volume / User (Today)</span>
                      <span className="text-white font-bold">
                        {formatCurrency(totalUsers > 0 ? marketplaceVolumeToday / totalUsers : 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-tsCard rounded-lg">
                      <span className="text-white">Total Recommendations</span>
                      <span className="text-white font-bold">
                        {(adminStats?.totalRecommendations || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="geography" className="space-y-6">
            <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Top Areas by Coverage Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topCounties.map((county, index) => (
                    <div key={index} className="p-4 bg-tsCard rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium">{county.name}</h3>
                        <Badge className="bg-ts-orange-dark text-white">#{index + 1}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-white/60">Coverage Entities</p>
                          <p className="text-white font-bold">
                            {county.coverageEntities.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/60">Territory Managers</p>
                          <p className="text-white font-bold">{county.territoryManagers}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/60">Affiliates/Partners</p>
                          <p className="text-white font-bold">{county.affiliates}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-white/60 text-center">
                        Status: {county.status}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Zap className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">
                    {successRate.toFixed(1)}%
                  </div>
                  <div className="text-white/60 text-sm">HTTP 2xx Success Rate</div>
                </CardContent>
              </Card>

              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">
                    {observabilitySummary?.dbPool?.current?.waiting ?? 0}
                  </div>
                  <div className="text-white/60 text-sm">DB Pool Waiting</div>
                </CardContent>
              </Card>

              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <Target className="h-8 w-8 text-green-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">
                    {coverageSummary?.verifiedCoverageRatePercent?.toFixed(1) || "0.0"}%
                  </div>
                  <div className="text-white/60 text-sm">Verified County Coverage</div>
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
