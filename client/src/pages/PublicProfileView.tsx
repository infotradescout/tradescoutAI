import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserColorScheme } from "@shared/colorPresets";
import { USER_TYPES } from "@shared/userTypes";
import { MapPin, Calendar, Eye, Building, Award, Star } from "lucide-react";

interface PublicProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  city?: string;
  state?: string;
  roles?: string[];
  badges?: string[];
  createdAt?: string;
  preferences?: any;
  stats?: {
    listings?: number;
    reviews?: number;
    rating?: number;
  };
}

export default function PublicProfileView() {
  const [, params] = useRoute("/profile/:userId");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!params?.userId) return;

      try {
        const response = await fetch(`/api/users/${params.userId}/public`, {
          credentials: 'include',
        });

        if (response.status === 404) {
          setNotFound(true);
          return;
        }

        if (!response.ok) throw new Error('Failed to fetch profile');

        const data = await response.json();
        setProfile(data);

        // Apply user's custom color scheme to the page
        if (data.preferences?.colorScheme) {
          const colorScheme = getUserColorScheme(data.preferences);
          const root = document.documentElement;
          
          root.style.setProperty('--user-primary', colorScheme.primary);
          root.style.setProperty('--user-secondary', colorScheme.secondary);
          root.style.setProperty('--user-background', colorScheme.background);
          root.style.setProperty('--user-text', colorScheme.text);
          root.style.setProperty('--user-accent', colorScheme.accent || colorScheme.primary);
          root.style.setProperty('--user-border', colorScheme.border || colorScheme.background);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Reset colors when component unmounts
    return () => {
      const root = document.documentElement;
      root.style.removeProperty('--user-primary');
      root.style.removeProperty('--user-secondary');
      root.style.removeProperty('--user-background');
      root.style.removeProperty('--user-text');
      root.style.removeProperty('--user-accent');
      root.style.removeProperty('--user-border');
    };
  }, [params?.userId]);

  if (loading) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-tsTextMuted">Loading profile...</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="container mx-auto py-12 text-center">
        <Eye className="h-12 w-12 text-tsTextMuted mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-tsTextMain mb-2">Profile Not Found</h2>
        <p className="text-tsTextMuted">
          This profile is private or doesn't exist.
        </p>
      </div>
    );
  }

  const displayName = profile.firstName && profile.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile.firstName || 'TradeScout User';

  const location = profile.city && profile.state
    ? `${profile.city}, ${profile.state}`
    : profile.city || profile.state || 'Location not set';

  const badges = profile.badges || [];
  const showBadges = profile.preferences?.badges?.show !== false;
  const hasCommunityBuilder = (profile.roles || []).includes('community_builder');

  return (
    <div 
      className="min-h-screen transition-colors duration-300"
      style={{ 
        backgroundColor: 'var(--user-background, #0a0f1e)',
        color: 'var(--user-text, #f1f5f9)'
      }}
    >
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div 
          className="rounded-lg p-8 shadow-lg border"
          style={{
            backgroundColor: 'var(--user-background, #111827)',
            borderColor: 'var(--user-border, #1e293b)',
          }}
        >
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {profile.profileImageUrl ? (
              <img
                src={profile.profileImageUrl}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover border-4"
                style={{ borderColor: 'var(--user-primary, #f97316)' }}
              />
            ) : (
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-4"
                style={{
                  backgroundColor: 'var(--user-primary, #f97316)',
                  borderColor: 'var(--user-secondary, #fb923c)',
                  color: 'var(--user-background, #0a0f1e)',
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{displayName}</h1>
              <div className="flex flex-wrap gap-3 text-sm opacity-80">
                {location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{location}</span>
                  </div>
                )}
                {profile.createdAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Member since {new Date(profile.createdAt).getFullYear()}</span>
                  </div>
                )}
              </div>

              {/* User Types */}
              {profile.roles && profile.roles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {profile.roles.map((roleId: string) => {
                    const userType = USER_TYPES[roleId];
                    if (!userType) return null;

                    return (
                      <Badge
                        key={roleId}
                        className="px-3 py-1"
                        style={{
                          backgroundColor: 'var(--user-primary, #f97316)',
                          color: 'var(--user-background, #0a0f1e)',
                        }}
                      >
                        {userType.label}
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Badges */}
              {showBadges && (badges.length > 0 || hasCommunityBuilder) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {hasCommunityBuilder && (
                    <Badge
                      className="px-3 py-1"
                      style={{
                        backgroundColor: '#10b981',
                        color: 'var(--user-background, #0a0f1e)',
                      }}
                    >
                      <Award className="h-3 w-3 mr-1" />
                      Community Builder
                    </Badge>
                  )}
                  {badges.map((badge: string) => (
                    <Badge
                      key={badge}
                      className="px-3 py-1"
                      style={{
                        backgroundColor: 'var(--user-primary, #f97316)',
                        color: 'var(--user-background, #0a0f1e)',
                      }}
                    >
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            {profile.stats && (
              <div className="flex gap-6">
                {profile.stats.listings !== undefined && (
                  <div className="text-center">
                    <div 
                      className="text-2xl font-bold"
                      style={{ color: 'var(--user-primary, #f97316)' }}
                    >
                      {profile.stats.listings}
                    </div>
                    <div className="text-sm opacity-70">Listings</div>
                  </div>
                )}
                {profile.stats.reviews !== undefined && (
                  <div className="text-center">
                    <div 
                      className="text-2xl font-bold"
                      style={{ color: 'var(--user-primary, #f97316)' }}
                    >
                      {profile.stats.reviews}
                    </div>
                    <div className="text-sm opacity-70">Reviews</div>
                  </div>
                )}
                {profile.stats.rating !== undefined && (
                  <div className="text-center">
                    <div className="flex items-center gap-1">
                      <span 
                        className="text-2xl font-bold"
                        style={{ color: 'var(--user-primary, #f97316)' }}
                      >
                        {profile.stats.rating.toFixed(1)}
                      </span>
                      <Star 
                        className="h-5 w-5 fill-current"
                        style={{ color: 'var(--user-primary, #f97316)' }}
                      />
                    </div>
                    <div className="text-sm opacity-70">Rating</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content sections based on user types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" style={{ color: 'var(--user-primary, #f97316)' }} />
                About
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                This is a TradeScout community member. Their profile serves as their professional website,
                customized based on their roles and activity on the platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" style={{ color: 'var(--user-primary, #f97316)' }} />
                Verified Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-70">Location</span>
                  <span className="font-medium">{location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">User Types</span>
                  <span className="font-medium">{profile.roles?.length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact CTA */}
        <div 
          className="rounded-lg p-6 text-center"
          style={{
            backgroundColor: 'var(--user-primary, #f97316)',
            color: 'var(--user-background, #0a0f1e)',
          }}
        >
          <h3 className="text-xl font-bold mb-2">
            Interested in connecting with {profile.firstName || 'this user'}?
          </h3>
          <p className="mb-4 opacity-90">
            Send a message or inquiry through TradeScout
          </p>
          <Button 
            size="lg"
            style={{
              backgroundColor: 'var(--user-background, #0a0f1e)',
              color: 'var(--user-text, #f1f5f9)',
            }}
          >
            Send Message
          </Button>
        </div>
      </div>
    </div>
  );
}
