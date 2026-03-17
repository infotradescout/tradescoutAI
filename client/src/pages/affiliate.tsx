import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Share2,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Check,
  ExternalLink,
  Zap,
  Wallet,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { share, shareToPlatform } from "@/utils/share";
import { SEOHelmet } from "@/components/SEOHelmet";
import { slugifyCountyName } from "@shared/tradeSeo";

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

type ShareEntry = {
  label: string;
  description: string;
  path: string;
  reason: string;
};

export default function AffiliatePage() {
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [newLinkDestination, setNewLinkDestination] = useState("/scout");
  const [newLinkSlug, setNewLinkSlug] = useState("");
  const [newLinkDescription, setNewLinkDescription] = useState("");
  const { user, isAuthenticated } = useAuth();

  // Get affiliate dashboard data - automatically created for all users
  const { data: dashboardData, isLoading } = useQuery<{
    program: AffiliateProgram;
    stats: AffiliateStats;
    referrals: Referral[];
    commissions: Commission[];
    payouts: Payout[];
  } | null>({
    queryKey: ["/api/affiliate/dashboard"],
    retry: false,
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/affiliate/dashboard");
      } catch (error: any) {
        const message = (error?.message as string | undefined) ?? "";
        if (
          message.includes("401") ||
          message.toLowerCase().includes("unauthorized") ||
          message.toLowerCase().includes("not authenticated")
        ) {
          return null;
        }
        throw error;
      }
    },
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
        description: formatUserFacingErrorMessage(error, "Failed to update settings."),
        variant: "destructive",
      });
    },
  });

  const { data: shareLinksData } = useQuery<{ links: any[] }>({
    queryKey: ["/api/affiliate/share-links"],
    enabled: !!isAuthenticated,
    retry: false,
  });

  const createShareLinkMutation = useMutation({
    mutationFn: (data: { destination: string; slug?: string; description?: string }) =>
      apiRequest("POST", "/api/affiliate/share-links", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/share-links"] });
      toast({ title: "Referral link created", description: "Your custom link is ready to share." });
      setNewLinkSlug("");
      setNewLinkDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Could not create link",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const program = dashboardData?.program;
  const stats = dashboardData?.stats;
  const referrals = dashboardData?.referrals || [];
  const commissions = dashboardData?.commissions || [];
  const payouts = dashboardData?.payouts || [];

  // Generate referral link from real affiliate code; default to Scout path for clarity.
  const baseUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.thetradescout.com";
  const affiliateCode = program?.affiliateCode;
  const affiliateLink = affiliateCode
    ? `${baseUrl}/scout?ref=${encodeURIComponent(affiliateCode)}`
    : `${baseUrl}/scout`;

  const currentRole = String(
    user?.activeRole || user?.role || (Array.isArray(user?.roles) ? user.roles[0] : "") || ""
  ).toLowerCase();
  const stateCode = String(user?.stateCode || user?.state || "")
    .trim()
    .toUpperCase();
  const countyName = String(user?.countyName || user?.county || "").trim();
  const countySlug = countyName ? slugifyCountyName(countyName) : "";
  const countyPagePath =
    stateCode && countySlug ? `/county/${stateCode.toLowerCase()}/${countySlug}` : null;
  const normalizedCountyKey = `${countyName.toLowerCase()}|${stateCode.toLowerCase()}`;
  const cumulusCountyPath =
    {
      "mobile county|al": "/tradepartners/cumulus-media/mobile-county-al",
      "escambia county|fl": "/tradepartners/cumulus-media/escambia-county-fl",
      "okaloosa county|fl": "/tradepartners/cumulus-media/okaloosa-county-fl",
    }[normalizedCountyKey] || "/tradepartners/cumulus-media";

  const bestLinksForUser = useMemo<ShareEntry[]>(() => {
    if (
      currentRole.includes("contractor") ||
      currentRole.includes("pro") ||
      currentRole.includes("business")
    ) {
      return [
        {
          label: "Direct Connect",
          description: "Best starting point for service demand and inbound local work.",
          path: "/direct-connect",
          reason: "Best fit for provider-side sharing",
        },
        {
          label: "TradeDeals",
          description: "Useful for promoting partner offers and business-facing opportunities.",
          path: "/tradedeals",
          reason: "Good fit for business audiences",
        },
      ];
    }

    return [
      {
        label: "Scout assistant",
        description: "Best starting point for most people new to TradeScout.",
        path: "/scout",
        reason: "Best fit for general users",
      },
      {
        label: "HomeScout listings",
        description:
          "Good when your audience cares about homes, moves, and local property activity.",
        path: "/homescout-listings",
        reason: "Strong homeowner interest",
      },
    ];
  }, [currentRole]);

  const countyAwareEntries = useMemo<ShareEntry[]>(() => {
    const entries: ShareEntry[] = [];

    if (countyPagePath && countyName && stateCode) {
      entries.push({
        label: `${countyName}, ${stateCode} county page`,
        description:
          "A local-first page people can use to discover what is happening in your area.",
        path: countyPagePath,
        reason: "Most locally relevant share",
      });
    }

    entries.push({
      label: "Community",
      description: "Good for ongoing local engagement and repeat traffic.",
      path: "/community",
      reason: "Brings people back regularly",
    });

    return entries;
  }, [countyName, stateCode, countyPagePath]);

  const bestLinksToday = useMemo<ShareEntry[]>(() => {
    const entries: ShareEntry[] = [
      {
        label: "Exchange marketplace",
        description: "Strong general-purpose link when you want active browsing and conversion.",
        path: "/exchange",
        reason: "Always a strong daily share",
      },
    ];

    entries.push({
      label: countyName && stateCode ? "Cumulus campaign for your market" : "Cumulus campaign",
      description:
        countyName && stateCode
          ? `Use the most relevant Cumulus campaign path for ${countyName}, ${stateCode} when available.`
          : "Share the live Cumulus campaign and RSVP landing page.",
      path: cumulusCountyPath,
      reason: "Best active campaign link today",
    });

    return entries;
  }, [countyName, stateCode, cumulusCountyPath]);

  const bestShareSections = [
    {
      title: "Best links for this user",
      description: "Suggested from your current role and likely audience.",
      entries: bestLinksForUser,
    },
    {
      title:
        countyName && stateCode
          ? `Best links for ${countyName}, ${stateCode}`
          : "Best links for your county",
      description:
        countyName && stateCode
          ? "These lean into the place you actually operate in."
          : "These lean into local visibility and recurring county engagement.",
      entries: countyAwareEntries,
    },
    {
      title: "Best links today",
      description: "These are the most useful current surfaces to push right now.",
      entries: bestLinksToday,
    },
    {
      title: "Best for getting signups",
      description: "Use these when you want a broad, clean starting point for new users.",
      entries: [
        {
          label: "Scout assistant",
          description: "Start with local AI planning and next-step guidance.",
          path: "/scout",
          reason: "Best general starting point",
        },
      ],
    },
    {
      title: "Best for getting buyers and leads",
      description: "Use these when people are ready to shop, hire, or take action.",
      entries: [
        {
          label: "Direct Connect",
          description: "Post requests and connect with local service providers.",
          path: "/direct-connect",
          reason: "High intent for service leads",
        },
        {
          label: "Exchange marketplace",
          description: "Buy, sell, and discover local listings.",
          path: "/exchange",
          reason: "Strong conversion path",
        },
        {
          label: "HomeScout listings",
          description: "Search local properties and home opportunities.",
          path: "/homescout-listings",
          reason: "High-value housing interest",
        },
      ],
    },
    {
      title: "Best campaign links",
      description: "Use these when you want to push offers, promotions, or active campaigns.",
      entries: [
        {
          label: "TradeDeals",
          description: "Share exclusive TradePartner offers.",
          path: "/tradedeals",
          reason: "Good for promotions and partner deals",
        },
        {
          label: "Cumulus campaign",
          description: "Share the Cumulus TradePartner campaign and RSVP landing page.",
          path: "/tradepartners/cumulus-media",
          reason: "Campaign-specific traffic",
        },
      ],
    },
    {
      title: "Best for local and recurring engagement",
      description: "Use these when you want people to return often and stay active locally.",
      entries: [
        {
          label: "Community",
          description: "Local discussions, updates, and neighborhood activity.",
          path: "/community",
          reason: "Great for recurring engagement",
        },
      ],
    },
  ] as const;

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
      <div className="py-24 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-ts-orange/30 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="px-4 py-10">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-6 py-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 max-w-xl">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Share TradeScout, fund your community.
              </h1>
              <p className="text-sm sm:text-base text-white/70">
                Create an account or sign in to see your affiliate dashboard, get your personal
                link, and route a slice of Exchange activity back into the county vaults you care
                about.
              </p>
            </div>
            <div className="mt-3 sm:mt-0 flex flex-col items-start sm:items-end gap-2 text-sm text-white/70">
              <span className="text-xs text-white/60">
                Use the Create account or Log in buttons in the header to get started.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="px-4 py-10">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-6 py-7 flex flex-col gap-3">
            <div className="space-y-2 max-w-xl">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Affiliate dashboard not available yet
              </h1>
              <p className="text-sm sm:text-base text-white/70">
                We couldn&apos;t load your affiliate dashboard data right now. Please try again
                later or contact support if the issue persists.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shareWithRef = async (path: string, label: string) => {
    await share({
      path,
      title: label,
      contextLabel: label,
      affiliateCodeOverride: affiliateCode,
    });
  };

  const buildShareCaption = (entry: ShareEntry) => {
    const localTail = countyName && stateCode ? ` Good fit for ${countyName}, ${stateCode}.` : "";
    return `${entry.label}: ${entry.description} ${entry.reason}.${localTail} Use my TradeScout link here:`;
  };

  const shareEntryWithCaption = async (entry: ShareEntry) => {
    await share({
      path: entry.path,
      title: entry.label,
      text: buildShareCaption(entry),
      contextLabel: entry.label,
      affiliateCodeOverride: affiliateCode,
    });
  };

  const shareEntryToPlatform = async (
    entry: ShareEntry,
    platform: "facebook" | "twitter" | "email"
  ) => {
    await shareToPlatform({
      platform,
      path: entry.path,
      title: entry.label,
      text: buildShareCaption(entry),
      affiliateCodeOverride: affiliateCode,
    });
  };

  const resolveShareUrlForPath = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return affiliateCode
      ? `${baseUrl}${normalizedPath}?ref=${encodeURIComponent(affiliateCode)}`
      : `${baseUrl}${normalizedPath}`;
  };

  return (
    <div className="px-4 py-10">
      <SEOHelmet
        title="Share Hub | Referral Links and Impact Tracking"
        description="Use TradeScout's share hub to copy strategic links, share the right destination, and keep your referral attribution attached."
        canonical="https://www.thetradescout.com/affiliate"
      />
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-ts-orange/20 rounded-lg">
              <Share2 className="w-8 h-8 text-ts-orange" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white">Your Share Hub</h1>
              <p className="text-sm md:text-base text-white/60">
                Every link you share automatically keeps attribution attached and powers the 5/5/5
                impact model
              </p>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-blue-200 font-medium">Automatic Affiliate Program</p>
              <p className="text-blue-300/80 text-sm">
                No signup needed! As a TradeScout member, 5% of platform revenue from your referrals
                goes to you, 5% to your community vaults, and 5% to trade + culinary scholarships.
              </p>
            </div>
            <a
              href="/wallet"
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 transition-colors"
            >
              <Wallet className="w-3 h-3" />
              View Wallet
            </a>
          </div>
        </div>

        {/* Personal invite link & best links to share */}
        <Card className="bg-white/5 border-white/10 mb-8">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-ts-orange" />
                Best links to share
              </CardTitle>
              <CardDescription className="text-white/70">
                Use your default invite link or pick a strategic destination below. Every link keeps
                your affiliate code attached and routes people to the right page.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-ts-orange/20 bg-ts-orange/5 p-3">
              <p className="text-sm font-medium text-white">Default invite link</p>
              <p className="text-xs text-white/60 mt-1">
                This is your cleanest all-purpose share link. It drops people into Scout with your
                affiliate attached.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <Input
                readOnly
                value={affiliateLink}
                className="bg-tsCard/95 border-white/10 text-sm text-white font-mono flex-1"
              />
              <Button
                type="button"
                className="bg-ts-orange hover:bg-ts-orange-dark whitespace-nowrap"
                onClick={() => copyToClipboard(affiliateLink, "Invite link")}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy link
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-white/60">
              <span>Quick share:</span>
              <Button
                type="button"
                variant="outline"
                className="border-white/15 text-white/70 hover:bg-white/5"
                onClick={() => shareWithRef("/scout", "Share Scout")}
              >
                Share Scout
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/15 text-white/70 hover:bg-white/5"
                onClick={() => shareWithRef("/contractors", "Share contractors")}
              >
                Share contractors
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/15 text-white/70 hover:bg-white/5"
                onClick={() => shareWithRef("/community", "Share community")}
              >
                Share community
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/15 text-white/70 hover:bg-white/5"
                onClick={() => shareWithRef("/exchange", "Share Exchange")}
              >
                Share Exchange
              </Button>
            </div>

            <div className="pt-3 border-t border-white/10">
              <div className="mb-3">
                <p className="text-sm font-medium text-white">Best links to share right now</p>
                <p className="text-xs text-white/60 mt-1">
                  These are the most useful surfaces for referrals, discovery, and conversion. We
                  can keep adding more as we expand campaigns and features.
                </p>
              </div>
              <div className="space-y-5">
                {bestShareSections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-xl border border-white/10 bg-black/20 p-3 md:p-4 space-y-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{section.title}</p>
                      <p className="text-xs text-white/60 mt-1">{section.description}</p>
                    </div>
                    <div className="space-y-3">
                      {section.entries.map((entry) => {
                        const entryUrl = resolveShareUrlForPath(entry.path);
                        const entryCaption = buildShareCaption(entry);
                        return (
                          <div
                            key={entry.path}
                            className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">{entry.label}</p>
                                <p className="text-xs text-white/60">{entry.description}</p>
                              </div>
                              <Badge className="bg-white/10 text-white/80 border border-white/15">
                                {entry.path}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="bg-ts-orange/10 text-ts-orange border border-ts-orange/20">
                                {entry.reason}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-white/70 font-mono truncate flex items-center gap-2">
                              <LinkIcon className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{entryUrl}</span>
                            </div>
                            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-1">
                                Suggested caption
                              </p>
                              <p className="text-xs text-white/75">{entryCaption}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/10 text-white/80 hover:bg-white/5"
                                onClick={() => copyToClipboard(entryUrl, `${entry.label} link`)}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Copy
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/10 text-white/80 hover:bg-white/5"
                                onClick={() =>
                                  copyToClipboard(
                                    `${entryCaption} ${entryUrl}`,
                                    `${entry.label} caption`
                                  )
                                }
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Copy caption
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/10 text-white/80 hover:bg-white/5"
                                onClick={() => shareEntryWithCaption(entry)}
                              >
                                <Share2 className="w-4 h-4 mr-2" />
                                Share
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/10 text-white/80 hover:bg-white/5"
                                onClick={() => shareEntryToPlatform(entry, "facebook")}
                              >
                                Facebook
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/10 text-white/80 hover:bg-white/5"
                                onClick={() => shareEntryToPlatform(entry, "email")}
                              >
                                Email
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white/60 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats?.totalReferrals || 0}</div>
              <p className="text-sm text-white/60 mt-1">
                {stats?.convertedReferrals || 0} converted ({stats?.conversionRate || 0}%)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white/60 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">
                ${stats?.totalCommissionEarned || "0.00"}
              </div>
              <p className="text-sm text-white/60 mt-1">Lifetime commissions</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white/60 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Paid Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">
                ${stats?.totalCommissionPaid || "0.00"}
              </div>
              <p className="text-sm text-white/60 mt-1">Total payments received</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white/60 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Commission Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-ts-orange">5%</div>
              <p className="text-sm text-white/60 mt-1">
                Directly to you on platform revenue from your referrals
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Automatic Affiliate Tracking */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-ts-orange/30 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Automatic Affiliate Tracking
            </CardTitle>
            <CardDescription className="text-white/70">
              ANY link you share from TradeScout automatically includes your tracking code - no
              special link needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-white/5 p-6 rounded-lg border border-white/10">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-ts-orange" />
                How It Works
              </h4>
              <p className="text-white/70 mb-4">
                Share any page from TradeScout - the homepage, an Exchange listing, a contractor
                profile, or a county page. Your unique tracking code is automatically attached to
                every URL you share.
              </p>
              <div className="bg-tsCard/95 p-4 rounded border border-white/10">
                <p className="text-white/60 text-sm mb-2">Examples of links you can share:</p>
                <ul className="text-white/70 text-sm space-y-1 font-mono">
                  <li>
                     tradescout.com <span className="text-ts-orange">?ref=your_code</span>
                  </li>
                  <li>
                     tradescout.com/exchange <span className="text-ts-orange">?ref=your_code</span>
                  </li>
                  <li>
                     tradescout.com/county/cook-il{" "}
                    <span className="text-ts-orange">?ref=your_code</span>
                  </li>
                  <li>
                     tradescout.com/contractors{" "}
                    <span className="text-ts-orange">?ref=your_code</span>
                  </li>
                </ul>
                <p className="text-emerald-400 text-xs mt-3">
                  ✓ Tracking code automatically added when you share any link
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 p-4 rounded-lg">
                <h4 className="text-white font-semibold mb-2">5% To You</h4>
                <p className="text-sm text-white/60">
                  Direct affiliate earnings from Exchange activity and platform revenue
                </p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg">
                <h4 className="text-white font-semibold mb-2">5% To Community Vaults</h4>
                <p className="text-sm text-white/60">
                  Automatically routes a matching share back into the community vaults you care
                  about
                </p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg">
                <h4 className="text-white font-semibold mb-2">5% To Trade Schools</h4>
                <p className="text-sm text-white/60">
                  Funds scholarships and training for the next generation of tradespeople
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-white/5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">How It Works</CardTitle>
                <CardDescription>Your automatic affiliate program explained</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="w-12 h-12 bg-ts-orange/20 rounded-lg flex items-center justify-center mb-3">
                      <Share2 className="w-6 h-6 text-ts-orange" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">1. Share ANY Link</h3>
                    <p className="text-white/60 text-sm">
                      Share any page from TradeScout on social media, email, or anywhere online.
                      Your tracking code is automatically added to every URL.
                    </p>
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">2. People Sign Up</h3>
                    <p className="text-white/60 text-sm">
                      When someone joins TradeScout through your link, they're automatically tracked
                      as your referral forever.
                    </p>
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-3">
                      <DollarSign className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">3. 5/5/5 Forever</h3>
                    <p className="text-white/60 text-sm">
                      You earn 5% of platform revenue from your referrals, while another 5% goes to
                      community vaults and 5% to trade + culinary scholarships.
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 p-6 rounded-lg">
                  <h4 className="text-white font-semibold mb-3">Why 5/5/5 is Powerful</h4>
                  <ul className="space-y-2 text-white/70 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Free Platform:</strong> TradeScout is 100% free for contractors - no
                        fees ever - making it easy to refer
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Exchange Revenue:</strong> Every Exchange promotion and transaction
                        generates 5% commission for you and 10% for community impact
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>No Cap:</strong> There's no limit to how much you can earn - the
                        more people you refer, the more you make
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Passive Income:</strong> After sharing once, you continue earning 5%
                        from your referrals indefinitely while also funding communities and
                        scholarships
                      </span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Your Referrals</CardTitle>
                <CardDescription>Track everyone who joined through your link</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 rounded-lg border border-white/10 bg-tsCard/95 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">Custom referral links</p>
                      <p className="text-xs text-white/60">
                        Create clean, memorable links like{" "}
                        <span className="font-mono text-ts-orange">/r/your-slug</span> that redirect
                        to any page with your referral attribution baked in.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-white/60 mb-1">
                        Destination
                      </p>
                      <Input
                        value={newLinkDestination}
                        onChange={(e) => setNewLinkDestination(e.target.value)}
                        placeholder="/exchange"
                        className="bg-black/30 border-white/10 text-white"
                      />
                      <p className="text-[11px] text-white/60 mt-1">
                        Use a site path starting with "/".
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-white/60 mb-1">
                        Slug (optional)
                      </p>
                      <Input
                        value={newLinkSlug}
                        onChange={(e) => setNewLinkSlug(e.target.value)}
                        placeholder="my-town"
                        className="bg-black/30 border-white/10 text-white"
                      />
                      <p className="text-[11px] text-white/60 mt-1">Letters, numbers, dash.</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-white/60 mb-1">
                        Description (optional)
                      </p>
                      <Input
                        value={newLinkDescription}
                        onChange={(e) => setNewLinkDescription(e.target.value)}
                        placeholder="Exchange landing"
                        className="bg-black/30 border-white/10 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewLinkDestination("/scout");
                        setNewLinkSlug("");
                        setNewLinkDescription("");
                      }}
                      className="border-white/10 text-white/70 hover:bg-white/5"
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      onClick={() =>
                        createShareLinkMutation.mutate({
                          destination: newLinkDestination.trim(),
                          slug: newLinkSlug.trim() || undefined,
                          description: newLinkDescription.trim() || undefined,
                        })
                      }
                      disabled={
                        createShareLinkMutation.isPending ||
                        !newLinkDestination.trim().startsWith("/")
                      }
                      className="bg-ts-orange hover:bg-ts-orange-dark"
                    >
                      {createShareLinkMutation.isPending ? "Creating..." : "Create link"}
                    </Button>
                  </div>

                  {(shareLinksData?.links || []).length > 0 ? (
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      {(shareLinksData?.links || []).slice(0, 8).map((l: any) => (
                        <div
                          key={l.id}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm text-white font-mono truncate">
                              {l.shortUrl || `/r/${l.slug}`}
                            </div>
                            <div className="text-[11px] text-white/60 truncate">
                              {l.description || "Custom link"} • {l.destinationUrl}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyToClipboard(String(l.shortUrl || ""), "Referral link")
                              }
                              className="border-white/10 text-white/70 hover:bg-white/5"
                              disabled={!l.shortUrl}
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              Copy
                            </Button>
                            {l.shortUrl ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(String(l.shortUrl), "_blank", "noopener,noreferrer")
                                }
                                className="border-white/10 text-white/70 hover:bg-white/5"
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {referrals.length > 0 ? (
                  <div className="space-y-3">
                    {referrals.map((referral) => (
                      <div
                        key={referral.id}
                        className="flex items-center justify-between p-4 bg-white/10 rounded-lg"
                      >
                        <div>
                          <p className="text-white font-medium">
                            Referral #{referral.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-white/60">
                            {format(new Date(referral.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge
                          className={
                            referral.status === "converted" ? "bg-emerald-500" : "bg-white/10"
                          }
                        >
                          {referral.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-white/60 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No referrals yet</h3>
                    <p className="text-white/60 mb-6">
                      Start sharing your link to earn commissions!
                    </p>
                    <Button
                      onClick={() => shareWithRef("/scout", "Invite link")}
                      className="bg-ts-orange hover:bg-ts-orange-dark"
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
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Commission History</CardTitle>
                <CardDescription>View all commissions earned</CardDescription>
              </CardHeader>
              <CardContent>
                {commissions.length > 0 ? (
                  <div className="space-y-3">
                    {commissions.map((commission) => (
                      <div
                        key={commission.id}
                        className="flex items-center justify-between p-4 bg-white/10 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-white font-medium">{commission.description}</p>
                          <p className="text-sm text-white/60">
                            {format(new Date(commission.createdAt), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-bold text-lg">
                            ${commission.commissionAmount}
                          </p>
                          <Badge
                            className={
                              commission.status === "paid" ? "bg-emerald-500" : "bg-yellow-500"
                            }
                          >
                            {commission.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-white/60 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No commissions yet</h3>
                    <p className="text-white/60">Your commission earnings will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Payout History</CardTitle>
                <CardDescription>
                  View your payment history and update payout settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length > 0 ? (
                  <div className="space-y-3">
                    {payouts.map((payout) => (
                      <div
                        key={payout.id}
                        className="flex items-center justify-between p-4 bg-white/10 rounded-lg"
                      >
                        <div>
                          <p className="text-white font-medium">${payout.totalAmount}</p>
                          <p className="text-sm text-white/60">
                            {payout.payoutMethod} •{" "}
                            {format(new Date(payout.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge
                          className={
                            payout.status === "completed" ? "bg-emerald-500" : "bg-yellow-500"
                          }
                        >
                          {payout.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-white/60 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No payouts yet</h3>
                    <p className="text-white/60">
                      Payouts are processed monthly once you reach $50
                    </p>
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
