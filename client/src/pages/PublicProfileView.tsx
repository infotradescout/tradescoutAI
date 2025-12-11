import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserColorScheme } from "@shared/colorPresets";
import { USER_TYPES } from "@shared/userTypes";
import {
  MapPin,
  Calendar,
  Eye,
  Building,
  Award,
  Star,
  ShoppingBag,
  Users,
} from "lucide-react";

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

interface SellerProductSummary {
  id: string;
  title: string;
  price: string;
  primaryImageUrl?: string;
  city?: string;
  stateCode?: string;
}

interface SellerRatingsSummary {
  average: number;
  count: number;
}

interface CommunityPostSummary {
  id: string;
  title: string;
  createdAt?: string;
  category?: string | null;
}

export default function PublicProfileView() {
  const [, params] = useRoute("/profile/:userId");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<SellerProductSummary[]>([]);
  const [sellerRatings, setSellerRatings] = useState<SellerRatingsSummary | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPostSummary[]>([]);

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

  // Load additional public data tied to this user: handmade offerings, ratings, community posts
  useEffect(() => {
    if (!profile?.id) return;

    const controller = new AbortController();
    const { signal } = controller;

    const loadExtras = async () => {
      const userId = profile.id;

      try {
        // Handmade products (services / offerings)
        try {
          const res = await fetch(`/api/handmade/sellers/${userId}/products`, { signal });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const mapped: SellerProductSummary[] = data.map((p: any) => ({
                id: String(p.id),
                title: String(p.title ?? ""),
                price: String(p.price ?? "0"),
                primaryImageUrl: p.primaryImageUrl || undefined,
                city: p.city || undefined,
                stateCode: p.stateCode || undefined,
              }));
              setSellerProducts(mapped);
            }
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            console.error("Error fetching seller products for profile:", err);
          }
        }

        // Seller ratings (recommendation count + average rating)
        try {
          const res = await fetch(`/api/handmade/sellers/${userId}/ratings`, { signal });
          if (res.ok) {
            const data = await res.json();
            if (typeof data?.average === "number" && typeof data?.count === "number") {
              setSellerRatings({ average: data.average, count: data.count });
            }
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            console.error("Error fetching seller ratings for profile:", err);
          }
        }

        // Community posts authored by this user
        try {
          const res = await fetch(`/api/community/posts?authorId=${encodeURIComponent(userId)}&limit=3`, { signal });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const mapped: CommunityPostSummary[] = data.map((p: any) => ({
                id: String(p.id),
                title: String(p.title ?? ""),
                createdAt: p.createdAt,
                category: p.category ?? null,
              }));
              setCommunityPosts(mapped);
            }
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            console.error("Error fetching community posts for profile:", err);
          }
        }
      } catch (error) {
        console.error("Error loading extra profile data:", error);
      }
    };

    loadExtras();

    return () => {
      controller.abort();
    };
  }, [profile?.id]);

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

  const profileSections = profile.preferences?.profileSections || {};
  const showAbout = profileSections.about !== false;
  const showRolesAndBadges = profileSections.rolesAndBadges !== false;
  const showStats = profileSections.stats !== false;
    const showServices = profileSections.services !== false;
    const showMarketplaceListings = profileSections.marketplaceListings !== false;
    const showReviews = profileSections.reviews !== false;
    const showCommunityActivity = profileSections.communityActivity !== false;
  const showContactCard = profileSections.contactCard !== false;

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
              {showRolesAndBadges && profile.roles && profile.roles.length > 0 && (
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
              {showRolesAndBadges && showBadges && (badges.length > 0 || hasCommunityBuilder) && (
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
            {showStats && profile.stats && (
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

        {/* Content sections based on user types and activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {showAbout && (
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
          )}

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

          {/* Services / offerings */}
          {showServices && sellerProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" style={{ color: 'var(--user-primary, #f97316)' }} />
                  Featured offerings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {sellerProducts.slice(0, 3).map((product) => (
                    <div key={product.id} className="flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.title}</p>
                        {(product.city || product.stateCode) && (
                          <p className="text-xs opacity-70 truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>
                              {[product.city, product.stateCode].filter(Boolean).join(', ')}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="ml-2 text-right">
                        <span className="text-sm font-semibold">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(parseFloat(product.price || '0'))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Marketplace summary (handmade listings) */}
          {showMarketplaceListings && sellerProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" style={{ color: 'var(--user-primary, #f97316)' }} />
                  Marketplace listings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-2">
                  This member has {sellerProducts.length} active handmade offerings listed on TradeScout.
                </p>
                <p className="text-xs opacity-70">
                  Listings and availability are managed by the seller through the Handmade Marketplace.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Reviews / recommendations summary */}
          {showReviews && sellerRatings && sellerRatings.count > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star
                    className="h-5 w-5 fill-current"
                    style={{ color: 'var(--user-primary, #f97316)' }}
                  />
                  Reviews & recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-3 mb-2">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: 'var(--user-primary, #f97316)' }}
                  >
                    {sellerRatings.average.toFixed(1)}
                  </span>
                  <span className="text-sm opacity-80">
                    based on {sellerRatings.count} public recommendations
                  </span>
                </div>
                <p className="text-xs opacity-70">
                  Ratings are calculated from verified purchases and public recommendations on TradeScout.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Community activity */}
          {showCommunityActivity && communityPosts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" style={{ color: 'var(--user-primary, #f97316)' }} />
                  Community activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {communityPosts.slice(0, 3).map((post) => (
                    <div key={post.id} className="flex flex-col">
                      <span className="font-medium truncate">{post.title}</span>
                      <span className="text-xs opacity-70">
                        {post.createdAt
                          ? new Date(post.createdAt).toLocaleDateString()
                          : 'Date not available'}
                        {post.category ? ` • ${post.category}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Contact CTA */}
        {showContactCard && (
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
        )}
      </div>
    </div>
  );
}
