import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserBadges } from "@/components/user-badges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USER_TYPES } from "@shared/userTypes";
import { getUserColorScheme } from "@shared/colorPresets";
import { 
  MapPin, Calendar, Building, Award, Star, Settings, 
  Eye, Share2, Edit, ExternalLink, Globe, Copy, Check, Shield
} from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { share } from "@/utils/share";

function getDefaultHomePageLabel(value?: string) {
  if (!value || value === 'llm') return 'Scout';
  const map: Record<string, string> = {
    dashboard: 'My Dashboard',
    marketplace: 'Marketplace',
    'contractor-board': 'Contractor Board',
    profile: 'My Profile',
    community: 'Community',
  };
  return map[value] || 'Scout';
}

type OwnedProfile = {
  id: string;
  slug: string;
  status?: "draft" | "published";
};

const COMMUNITY_BUILDER_BADGE_LABEL = "Community Builder Badge";

export default function ProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) return;

      try {
        const list = (await apiRequest("GET", "/api/profiles")) as OwnedProfile[];

        if (!Array.isArray(list) || list.length === 0) return;

        const activeProfileId = (user as any).activeProfileId as string | undefined;

        let active = activeProfileId
          ? list.find((p) => p.id === activeProfileId)
          : undefined;

        if (!active) {
          active = list.find((p) => (p as any).status === "published") || list[0];
        }

        if (!active?.slug) return;

        if (!cancelled) {
          setProfileSlug(active.slug);
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

  if (!user) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-tsTextMuted">Please log in to view your profile</p>
      </div>
    );
  }

  const displayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || 'TradeScout User';

  const location = user.city && user.state
    ? `${user.city}, ${user.state}`
    : user.city || user.state || 'Location not set';

  const badges = user.badges || [];
  const distinctBadges = badges.filter((b: string) => b !== COMMUNITY_BUILDER_BADGE_LABEL);
  const showBadges = user.preferences?.badges?.show !== false;
  const hasCommunityBuilder = (user.roles || []).includes('community_builder');

  const colorScheme = getUserColorScheme(user.preferences);
  const profileThemeVars = {
    // Scope these to the profile page so we don't globally override the app.
    ['--user-primary' as any]: colorScheme.primary,
    ['--user-secondary' as any]: colorScheme.secondary,
    ['--user-background' as any]: colorScheme.background,
    ['--user-text' as any]: colorScheme.text,
    ['--user-accent' as any]: colorScheme.accent || colorScheme.primary,
    ['--user-border' as any]: colorScheme.border || colorScheme.background,
  } as React.CSSProperties;

  const profileUrl = profileSlug
    ? `${window.location.origin}/p/${profileSlug}`
    : `${window.location.origin}/profile/${user.id}`;
  const isPublic = user.preferences?.profileVisibility === 'public';

  const copyProfileUrl = async () => {
    await share({
      url: profileUrl,
      title: `${displayName}'s TradeScout profile`,
      contextLabel: 'Profile link',
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        ...profileThemeVars,
        backgroundColor: 'var(--user-background)',
        color: 'var(--user-text)',
      }}
    >
      <div className="container mx-auto py-8 space-y-6 max-w-6xl">
        {/* Profile Header */}
        <div
          className="rounded-lg p-8 shadow-lg border"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--user-background) 92%, var(--user-border) 8%)',
            borderColor: 'var(--user-border)',
          }}
        >
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={displayName}
                className="w-32 h-32 rounded-full object-cover border-4"
                style={{ borderColor: 'var(--user-primary)' }}
              />
            ) : (
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold text-white"
                style={{ backgroundColor: 'var(--user-primary)' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-bold text-tsTextMain mb-2 break-words">{displayName}</h1>
                  <div className="flex flex-wrap gap-3 text-sm text-tsTextMuted">
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
                          <span className="text-green-400">Public Profile</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 text-tsTextMuted" />
                          <span>Private Profile</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setLocation('/profile-settings')}
                  variant="outline"
                  className="border hover:text-white"
                  style={{ borderColor: 'var(--user-primary)', color: 'var(--user-primary)' }}
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

              {/* User Types */}
              {user.roles && user.roles.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-tsTextMuted mb-2">User Types</p>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((roleId: string) => {
                      const userType = USER_TYPES[roleId];
                      if (!userType) return null;

                      return (
                        <Badge
                          key={roleId}
                          className="bg-tsAccent text-white px-3 py-1"
                        >
                          {userType.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Share Profile */}
              {isPublic && (
                <div
                  className="border rounded-lg p-4"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--user-background) 90%, var(--user-border) 10%)',
                    borderColor: 'var(--user-border)',
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-tsTextMuted mb-1">Your Public Profile URL</p>
                      <code className="text-sm truncate block" style={{ color: 'var(--user-primary)' }}>
                        {profileUrl}
                      </code>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyProfileUrl}
                        className="border hover:text-white"
                        style={{ borderColor: 'var(--user-primary)', color: 'var(--user-primary)' }}
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
                        onClick={() => window.open(profileUrl, '_blank')}
                        className="text-white"
                        style={{ backgroundColor: 'var(--user-primary)' }}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
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
          <TabsList className="bg-tsCard border border-tsBorder">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="reviews">RECOMMENDATIONS</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* About Section */}
              <Card className="bg-tsCard border-tsBorder">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-tsTextMain">
                    <Building className="h-5 w-5 text-tsAccent" />
                    About
                  </CardTitle>
                  <CardDescription className="text-tsTextMuted">
                    Your professional profile information
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-tsTextMain">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-tsTextMuted">Email</p>
                      <p className="text-sm font-medium">{user.email}</p>
                    </div>
                    {user.phone && (
                      <div>
                        <p className="text-sm text-tsTextMuted">Phone</p>
                        <p className="text-sm font-medium">{user.phone}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-tsTextMuted">Location</p>
                      <p className="text-sm font-medium">{location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Website Features */}
              <Card className="bg-tsCard border-tsBorder">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-tsTextMain">
                    <Globe className="h-5 w-5 text-tsAccent" />
                    Your Profile is Your Website
                  </CardTitle>
                  <CardDescription className="text-tsTextMuted">
                    Your profile replaces the need for a traditional website
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-tsTextMain">
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
                      <span>Public profiles are searchable by Scout</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Share your profile URL instead of a website</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Activity and RECOMMENDATIONS build your reputation</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Preferences */}
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-tsTextMain">
                  <Settings className="h-5 w-5 text-tsAccent" />
                  Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="text-tsTextMain">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-tsTextMuted">Default Home Page</span>
                    <span className="font-medium">
                      {getDefaultHomePageLabel(user.preferences?.defaultHomePage)}
                    </span>
                  </div>
                    <div className="flex justify-between items-center">
                      <span className="text-tsTextMuted">Profile Visibility</span>
                      <span className="font-medium capitalize">
                        {user.preferences?.profileVisibility || 'public'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-tsTextMuted">Color Scheme</span>
                      <span className="font-medium capitalize">
                        {user.preferences?.colorScheme?.preset || 'default'}
                      </span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4 bg-tsAccent text-white hover:bg-tsAccent/90"
                    onClick={() => setLocation('/profile-settings')}
                  >
                    Customize Settings
                  </Button>
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="bg-tsCard border-tsBorder">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-tsTextMain">
                    <Award className="h-5 w-5 text-tsAccent" />
                    Profile Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-tsAccent">{user?.stats?.listings ?? '—'}</div>
                      <div className="text-xs text-tsTextMuted">Listings</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-tsAccent">{user?.stats?.reviews ?? '—'}</div>
                      <div className="text-xs text-tsTextMuted">RECOMMENDATIONS</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-tsAccent flex items-center justify-center gap-1">
                        {user?.stats?.rating ?? '—'} <Star className="h-4 w-4 fill-current" />
                      </div>
                      <div className="text-xs text-tsTextMuted">Rating</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader>
                <CardTitle className="text-tsTextMain">Recent Activity</CardTitle>
                <CardDescription className="text-tsTextMuted">
                  Your activity helps build your professional reputation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-tsTextMuted text-center py-8">
                  No activity yet. Start engaging with the community!
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader>
                <CardTitle className="text-tsTextMain">My Listings</CardTitle>
                <CardDescription className="text-tsTextMuted">
                  Manage your marketplace listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-tsTextMuted text-center py-8">
                  No listings yet. Create your first listing to get started!
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader>
                <CardTitle className="text-tsTextMain">RECOMMENDATIONS</CardTitle>
                <CardDescription className="text-tsTextMuted">
                  RECOMMENDATIONS from other community members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-tsTextMuted text-center py-8">
                  No RECOMMENDATIONS yet. Complete transactions to receive RECOMMENDATIONS!
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Call to Action */}
        {!isPublic && (
          <Card className="bg-gradient-to-r from-tsAccent/20 to-tsAccent/10 border-tsAccent">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-tsAccent rounded-lg">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-tsTextMain mb-2">
                    Make Your Profile Public
                  </h3>
                  <p className="text-sm text-tsTextMuted mb-4">
                    Turn your profile into a public website that can be found by potential clients and Scout.
                    Share your URL instead of maintaining a separate website.
                  </p>
                  <Button
                    onClick={() => setLocation('/profile-settings')}
                    className="bg-tsAccent text-white hover:bg-tsAccent/90"
                  >
                    Enable Public Profile
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
