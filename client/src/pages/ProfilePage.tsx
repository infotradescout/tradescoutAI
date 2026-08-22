import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserBadges } from "@/components/user-badges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USER_TYPES } from "@shared/userTypes";
import {
  MapPin,
  Calendar,
  Building,
  Award,
  Settings,
  Eye,
  Share2,
  Edit,
  ExternalLink,
  Globe,
  Copy,
  Check,
  Shield,
  Loader2,
  TrendingUp,
  Clock3,
} from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { share } from "@/utils/share";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Page } from "@/components/layout/PagePrimitives";
import { isBusinessUser } from "@/lib/postOnboardingRoute";

function getDefaultHomePageLabel(value?: string) {
  if (!value || value === "llm") return "Scout";
  const map: Record<string, string> = {
    dashboard: "My Dashboard",
    marketplace: "Marketplace",
    "contractor-board": "Contractor Board",
    profile: "My Profile",
    community: "Community",
  };
  return map[value] || "Scout";
}

type OwnedProfile = {
  id: string;
  slug: string;
  status?: "draft" | "published";
};

type XpLedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  dayKeyUtc: string;
  createdAt: string;
};

type XpMeResponse = {
  userId: string;
  xpTotal: number;
  recentLedger: XpLedgerEntry[];
};

type BadgesMeResponse = {
  userId: string;
  labels?: string[];
  awarded?: Array<{ badgeId: string; awardedAt: string; source?: string | null }>;
};

const COMMUNITY_BUILDER_BADGE_LABEL = "Community Builder Badge";

function formatActivityReason(reason: string) {
  const cleaned = String(reason || "")
    .trim()
    .replace(/[._-]+/g, " ");
  if (!cleaned) return "Activity event";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default function ProfilePage() {
  const { user, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<OwnedProfile["status"]>(undefined);
  const [businessSlug, setBusinessSlug] = useState<string | null>(null);
  const [activatingPublic, setActivatingPublic] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) return;

      try {
        const shouldAttemptBusinessProfile = isBusinessUser(user as any, null);
        if (shouldAttemptBusinessProfile) {
          try {
            const business = (await apiRequest("GET", "/api/business-profile/me")) as {
              slug?: string | null;
              visibility?: "public" | "private";
            };
            if (!cancelled && business?.slug) {
              setBusinessSlug(String(business.slug));
            }
          } catch {
            if (!cancelled) {
              setBusinessSlug(null);
            }
          }
        } else if (!cancelled) {
          setBusinessSlug(null);
        }

        const list = (await apiRequest("GET", "/api/profiles")) as OwnedProfile[];

        if (!Array.isArray(list) || list.length === 0) return;

        const activeProfileId = (user as any).activeProfileId as string | undefined;

        let active = activeProfileId ? list.find((p) => p.id === activeProfileId) : undefined;

        if (!active) {
          active = list.find((p) => (p as any).status === "published") || list[0];
        }

        if (!active?.slug) return;

        if (!cancelled) {
          setProfileSlug(active.slug);
          setProfileStatus(active.status);
        }
      } catch (error) {
        console.error("Error loading profile site slug for share URL:", error);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const {
    data: xpData,
    isLoading: xpLoading,
    error: xpError,
  } = useQuery<XpMeResponse>({
    queryKey: ["/api/xp/me"],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      return (await apiRequest("GET", "/api/xp/me")) as XpMeResponse;
    },
    staleTime: 60 * 1000,
  });

  const { data: badgesData } = useQuery<BadgesMeResponse>({
    queryKey: ["/api/badges/me"],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      return (await apiRequest("GET", "/api/badges/me")) as BadgesMeResponse;
    },
    staleTime: 60 * 1000,
  });

  if (!user) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-white/60">Please log in to view your profile</p>
      </div>
    );
  }

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || "TradeScout User";

  const location =
    user.city && user.state
      ? `${user.city}, ${user.state}`
      : user.city || user.state || "Location not set";

  const badges =
    Array.isArray(badgesData?.labels) && badgesData.labels.length > 0
      ? badgesData.labels
      : user.badges || [];
  let distinctBadges = badges.filter((b: string) => b !== COMMUNITY_BUILDER_BADGE_LABEL);

  // Add Admin/Staff badges for authority labeling (not verification)
  const roleLabels: string[] = [];
  if (
    user.isAdmin ||
    (Array.isArray(user.roles) &&
      user.roles.some((r: string) => String(r).toLowerCase() === "admin"))
  ) {
    roleLabels.push("Admin");
  }
  if (
    Array.isArray(user.roles) &&
    user.roles.some((r: string) => String(r).toLowerCase() === "staff")
  ) {
    roleLabels.push("Staff");
  }
  // Only add if not already present
  distinctBadges = [...distinctBadges, ...roleLabels.filter((l) => !distinctBadges.includes(l))];
  const showBadges = user.preferences?.badges?.show !== false;
  const hasCommunityBuilder = (user.roles || []).includes("community_builder");

  const profileThemeVars = {
    // Keep the in-app "My Profile" surface aligned with the active site theme.
    // Public profile pages still use user-controlled profile palette settings.
    ["--user-primary" as any]: "var(--theme-accent-primary)",
    ["--user-secondary" as any]: "var(--theme-accent-secondary)",
    ["--user-background" as any]: "var(--surface-app-bg)",
    ["--user-text" as any]: "var(--text-primary)",
    ["--user-accent" as any]: "var(--theme-accent-primary)",
    ["--user-border" as any]: "var(--border-primary)",
  } as React.CSSProperties;

  const profileUrl =
    profileSlug && profileStatus === "published"
      ? `${getCanonicalAppOrigin()}/u/${encodeURIComponent(profileSlug)}`
      : businessSlug
        ? `${getCanonicalAppOrigin()}/business/${encodeURIComponent(businessSlug)}`
        : `${getCanonicalAppOrigin()}/profile/${user.id}`;
  const isPublic = user.preferences?.profileVisibility === "public";

  const copyProfileUrl = async () => {
    await share({
      url: profileUrl,
      title: businessSlug
        ? `${displayName}'s TradeScout business page`
        : `${displayName}'s TradeScout profile`,
      contextLabel: businessSlug ? "Business page link" : "Profile link",
      suppressRef: true,
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enablePublicProfile = async () => {
    if (activatingPublic) return;
    setActivatingPublic(true);

    try {
      const result = (await apiRequest("PATCH", "/api/users/profile-visibility", {
        profileVisibility: "public",
        proceedUnverified: true,
      })) as { profileSlug?: string | null };

      const newSlug = result?.profileSlug ? String(result.profileSlug) : null;
      if (newSlug) {
        setProfileSlug(newSlug);
      }

      await refetch();
      toast({
        title: "Profile is now public",
        description: "Your public profile is live. Customize it to make it yours.",
      });
      // Navigate to the profile editor so the user can customize their new public page
      if (newSlug) {
        setLocation(`/u/${newSlug}/edit`);
      }
    } catch (error) {
      toast({
        title: "Could not make profile public",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setActivatingPublic(false);
    }
  };

  return (
    <div
      className="transition-colors duration-300"
      style={{
        ...profileThemeVars,
        backgroundColor: "var(--user-background)",
        color: "var(--user-text)",
      }}
    >
      <Page className="max-w-6xl">
        {/* Profile Header */}
        <div
          className="rounded-lg p-8 shadow-lg border"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--user-background) 92%, var(--user-border) 8%)",
            borderColor: "var(--user-border)",
          }}
        >
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={displayName}
                className="w-32 h-32 rounded-full object-cover border-4"
                style={{ borderColor: "var(--user-primary)" }}
              />
            ) : (
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold text-white"
                style={{ backgroundColor: "var(--user-primary)" }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2 break-words">{displayName}</h1>
                  <div className="flex flex-wrap gap-3 text-sm text-white/60">
                    {location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{location}</span>
                      </div>
                    )}
                    {user.createdAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Member since {new Date(user.createdAt).getFullYear()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      {isPublic ? (
                        <>
                          <Globe className="h-4 w-4 text-green-400" />
                          <span className="text-green-400">
                            {businessSlug ? "Public Business Page" : "Public Profile"}
                          </span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 text-white/60" />
                          <span>Private Profile</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setLocation("/profile-settings")}
                  variant="outline"
                  className="border hover:text-white"
                  style={{ borderColor: "var(--user-primary)", color: "var(--user-primary)" }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </div>

              {showBadges && (badges.length > 0 || hasCommunityBuilder) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <UserBadges
                    badges={[
                      ...(hasCommunityBuilder ? [COMMUNITY_BUILDER_BADGE_LABEL] : []),
                      ...distinctBadges,
                    ]}
                    size="md"
                    maxVisible={4}
                  />
                </div>
              )}

              {/* Roles are used for capabilities and layout only; no public-facing chips here. */}

              {/* Share Profile */}
              {isPublic && (
                <div
                  className="border rounded-lg p-4"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--user-background) 90%, var(--user-border) 10%)",
                    borderColor: "var(--user-border)",
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 mb-1">
                        {businessSlug ? "Your Public Business Page URL" : "Your Public Profile URL"}
                      </p>
                      <code
                        className="text-sm truncate block"
                        style={{ color: "var(--user-primary)" }}
                      >
                        {profileUrl}
                      </code>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyProfileUrl}
                        className="border hover:text-white"
                        style={{ borderColor: "var(--user-primary)", color: "var(--user-primary)" }}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => window.open(profileUrl, "_blank")}
                        className="text-white"
                        style={{ backgroundColor: "var(--user-primary)" }}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        {businessSlug ? "View Business Page" : "View Profile"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-tsCard border border-white/10">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="reviews">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* About Section */}
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Building className="h-5 w-5 text-ts-orange" />
                    About
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Your professional profile information
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-white">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-white/60">Email</p>
                      <p className="text-sm font-medium">{user.email}</p>
                    </div>
                    {user.phone && (
                      <div>
                        <p className="text-sm text-white/60">Phone</p>
                        <p className="text-sm font-medium">{user.phone}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-white/60">Location</p>
                      <p className="text-sm font-medium">{location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Website Features */}
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Globe className="h-5 w-5 text-ts-orange" />
                    {businessSlug
                      ? "Your Business Page Is Your Website"
                      : "Your Profile is Your Website"}
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    {businessSlug
                      ? "Your public TradeScout business page replaces the need for a traditional website"
                      : "Your profile replaces the need for a traditional website"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-white">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Custom color schemes that match your brand</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Automatic layout based on your user types</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Eligible published profiles can appear in Scout search</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Share your profile URL instead of a website</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Activity and recommendations build your reputation</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Preferences */}
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Settings className="h-5 w-5 text-ts-orange" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-white">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Default Home Page</span>
                      <span className="font-medium">
                        {getDefaultHomePageLabel(user.preferences?.defaultHomePage)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Profile Visibility</span>
                      <span className="font-medium capitalize">
                        {user.preferences?.profileVisibility || "public"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Color Scheme</span>
                      <span className="font-medium capitalize">
                        {user.preferences?.colorScheme?.preset || "default"}
                      </span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4 bg-ts-orange text-white hover:bg-ts-orange/90"
                    onClick={() => setLocation("/profile-settings")}
                  >
                    Customize Settings
                  </Button>
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Award className="h-5 w-5 text-ts-orange" />
                    Profile Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-ts-orange flex items-center justify-center gap-1">
                        {xpLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : typeof xpData?.xpTotal === "number" ? (
                          xpData.xpTotal
                        ) : (
                          "—"
                        )}
                      </div>
                      <div className="text-xs text-white/60">Activity Points</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-ts-orange">
                        {user?.stats?.reviews ?? "—"}
                      </div>
                      <div className="text-xs text-white/60">Recommendations</div>
                    </div>
                  </div>
                  {xpError ? (
                    <p className="mt-3 text-center text-xs text-white/50">
                      Activity points are temporarily unavailable.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="bg-tsCard border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Recent Activity</CardTitle>
                <CardDescription className="text-white/60">
                  Your activity helps build your professional reputation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {xpLoading ? (
                  <div className="flex items-center justify-center py-8 text-white/60">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading activity...
                  </div>
                ) : xpData?.recentLedger && xpData.recentLedger.length > 0 ? (
                  <div className="space-y-3">
                    {xpData.recentLedger.slice(0, 12).map((entry) => {
                      const createdAt = new Date(entry.createdAt);
                      const isValidDate = !Number.isNaN(createdAt.getTime());
                      return (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between gap-3 rounded-md border border-white/10 bg-black/20 p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">
                              {formatActivityReason(entry.reason)}
                            </p>
                            <p className="mt-1 text-xs text-white/50 flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {isValidDate
                                ? createdAt.toLocaleString()
                                : String(entry.dayKeyUtc || "Unknown date")}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-emerald-400">
                              {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/60 text-center py-8">
                    No activity yet. Start engaging with the community!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card className="bg-tsCard border-white/10">
              <CardHeader>
                <CardTitle className="text-white">My Listings</CardTitle>
                <CardDescription className="text-white/60">
                  Manage your marketplace listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/60 text-center py-8">
                  No listings yet. Create your first listing to get started!
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card className="bg-tsCard border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Recommendations</CardTitle>
                <CardDescription className="text-white/60">
                  Recommendations from other community members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/60 text-center py-8">
                  No recommendations yet. Complete transactions to receive recommendations.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Call to Action */}
        {!isPublic && (
          <Card className="bg-gradient-to-r from-ts-orange/20 to-ts-orange/10 border-ts-orange">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-ts-orange rounded-lg">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Make Your Profile Public
                  </h3>
                  <p className="text-sm text-white/60 mb-4">
                    Turn your profile into a public website that can be found by potential clients
                    and Scout. Share your URL instead of maintaining a separate website.
                  </p>
                  <Button
                    onClick={enablePublicProfile}
                    disabled={activatingPublic}
                    className="bg-ts-orange text-white hover:bg-ts-orange/90"
                  >
                    {activatingPublic ? "Activating..." : "Enable Public Profile"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </Page>
    </div>
  );
}
