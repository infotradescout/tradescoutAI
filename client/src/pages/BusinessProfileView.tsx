import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Globe, Phone } from "lucide-react";

type PublicCounty = {
  id: string;
  name: string;
  stateCode: string;
  fips: string;
};

type PublicBusiness = {
  id: string;
  name: string;
  slug: string;
  type: string;
  roleContext: string;
  status: string;
  profile?: {
    tagline?: string;
    description?: string;
    category?: string;
    services?: string[];
    website?: string;
    phone?: string;
    contactPreference?: "call" | "email" | "message";
  };
  counties?: PublicCounty[];
};

export default function BusinessProfileView() {
  const [, params] = useRoute("/business/:slug");
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchBusiness = async () => {
      const slug = params?.slug;
      if (!slug) return;

      try {
        const response = await fetch(`/api/public/businesses/${encodeURIComponent(slug)}`);
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) throw new Error("Failed to fetch business");

        const data = (await response.json()) as PublicBusiness;
        setBusiness(data);
      } catch (error) {
        console.error("Error fetching business:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [params?.slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="ts-surface px-4 py-6 md:px-10 md:py-8 text-white">Loading business profile…</div>
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <Card className="bg-navy-800 border-navy-700 w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-white">Business not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">This business profile may be private or unavailable.</p>
            <Link href="/">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">Back to Scout</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = business.profile || {};

  return (
    <div className="min-h-screen bg-navy-900 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <Card className="bg-navy-800 border-navy-700">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                  <Building2 className="h-5 w-5 text-orange-400" />
                  <span className="text-xs uppercase tracking-[0.18em]">Business Profile</span>
                </div>
                <CardTitle className="text-white text-3xl">{business.name}</CardTitle>
                {profile.tagline ? (
                  <p className="text-gray-300">{profile.tagline}</p>
                ) : null}
              </div>
              {business.type ? <Badge variant="secondary">{business.type}</Badge> : null}
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-gray-300">
              {profile.website ? (
                <a
                  className="inline-flex items-center gap-2 hover:text-white"
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Globe className="h-4 w-4" />
                  Website
                </a>
              ) : null}
              {profile.phone ? (
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {profile.phone}
                </span>
              ) : null}
              {(business.counties && business.counties.length > 0) ? (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {business.counties.slice(0, 3).map((c) => `${c.name} (${c.stateCode})`).join(", ")}
                  {business.counties.length > 3 ? ` +${business.counties.length - 3} more` : ""}
                </span>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {profile.description ? (
              <section className="space-y-2">
                <h2 className="text-white font-semibold">About</h2>
                <p className="text-gray-300 whitespace-pre-wrap">{profile.description}</p>
              </section>
            ) : null}

            {(profile.services && profile.services.length > 0) ? (
              <section className="space-y-2">
                <h2 className="text-white font-semibold">Services</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.services.map((s) => (
                    <Badge key={s} variant="outline" className="border-navy-500 text-gray-200">
                      {s}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="pt-2">
              <Link href="/">
                <Button variant="outline" className="border-navy-500 text-gray-200">
                  Ask Scout about this business
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
