import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MessageCircle } from "lucide-react";

type ProfileSections = {
  about?: boolean;
  rolesAndBadges?: boolean;
  stats?: boolean;
  services?: boolean;
  marketplaceListings?: boolean;
  reviews?: boolean;
  communityActivity?: boolean;
  contactCard?: boolean;
};

type PublicProfile = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  roleContext: string;
  contentBlocks: any;
  ctaConfig: any;
  seoMeta: any;
  profileSections?: ProfileSections | null;
};

type PublicBusinessSubset = {
  id: string;
  name: string;
  categories: string[];
  serviceAreas: string[];
  contactEmail?: string;
  contactPhone?: string;
} | null;

type PublicProfileResponse = {
  profile: PublicProfile;
  business: PublicBusinessSubset;
};

export default function ProfileSiteView() {
  const [, params] = useRoute("/p/:slug");
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const slug = params?.slug;
    if (!slug) return;

    const run = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        const response = await fetch(`/api/p/${encodeURIComponent(slug)}`);
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) throw new Error("Failed to fetch profile");

        const json = (await response.json()) as PublicProfileResponse;
        setData(json);
      } catch (e) {
        console.error("Error fetching profile:", e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [params?.slug]);

  if (loading) {
    return (
      <div className=" flex items-center justify-center">
        <div className="ts-surface px-4 py-6 md:px-10 md:py-8 text-white">
          Loading profile site…
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className=" flex items-center justify-center px-4">
        <Card className="bg-navy-800 border-navy-700 w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-white">Profile not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">
              This profile may be private, unpublished, or unavailable.
            </p>
            <Link href="/">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Back to Scout
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, business } = data;
  const profileSections = profile.profileSections || {};
  const showContactCard = profileSections.contactCard !== false;
  const displayName =
    business?.name && business.name.trim().length > 0 ? business.name : profile.displayName;

  return (
    <div className=" py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <Card className="bg-navy-800 border-navy-700">
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-white text-3xl">{displayName}</CardTitle>
                {profile.headline && profileSections.about !== false ? (
                  <p className="text-gray-300">{profile.headline}</p>
                ) : null}
                {profileSections.about !== false ? (
                  <p className="text-gray-400 text-xs uppercase tracking-[0.18em]">
                    {profile.roleContext}
                  </p>
                ) : null}
              </div>
              <Badge variant="secondary">Website Profile</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {business ? (
              <section className="space-y-2">
                <h2 className="text-white font-semibold">Business</h2>
                <div className="text-gray-300 text-sm space-y-1">
                  <div>
                    <span className="text-gray-400">Name:</span> {business.name}
                  </div>
                  <div>
                    <span className="text-gray-400">Categories:</span>{" "}
                    {business.categories.length ? business.categories.join(", ") : "None"}
                  </div>
                  <div>
                    <span className="text-gray-400">Service areas:</span>{" "}
                    {business.serviceAreas.length
                      ? `${business.serviceAreas.length} area(s)`
                      : "None"}
                  </div>
                </div>
              </section>
            ) : null}

            {showContactCard && (
              <section className="space-y-3 pt-2 border-t border-navy-700">
                <h2 className="text-white font-semibold">Contact</h2>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-2 text-sm text-gray-300">
                    {business?.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-orange-400" />
                        <span>{business.contactEmail}</span>
                      </div>
                    )}
                    {business?.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-orange-400" />
                        <span>{business.contactPhone}</span>
                      </div>
                    )}
                    {!business?.contactEmail && !business?.contactPhone && (
                      <p className="text-gray-400">
                        This profile is set up to be contacted through TradeScout.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href="/">
                      <Button
                        variant="outline"
                        className="border-navy-500 text-gray-200 flex items-center gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Ask Scout about this profile</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
