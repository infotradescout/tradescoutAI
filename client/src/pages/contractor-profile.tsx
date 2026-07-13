import { useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Shield,
  CheckCircle,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RecommendationForm } from "@/components/RecommendationForm";
import type { Contractor, Recommendation } from "@shared/schema";
import { SEOHelmet } from "@/components/SEOHelmet";

interface ContractorProfileData {
  contractor: Contractor;
  recommendations: Recommendation[];
  ratingSummary?: {
    average: number;
    count: number;
  };
  canonicalBusinessProfileSlug?: string | null;
  canonicalBusinessProfileUrl?: string | null;
}

export default function ContractorProfile() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const {
    data: contractorData,
    isLoading,
    error,
  } = useQuery<ContractorProfileData>({
    queryKey: [`/api/contractors/${slug}`],
    enabled: !!slug,
  });

  useEffect(() => {
    const canonicalUrl =
      typeof contractorData?.canonicalBusinessProfileUrl === "string"
        ? contractorData.canonicalBusinessProfileUrl.trim()
        : "";
    if (canonicalUrl) {
      setLocation(canonicalUrl);
    }
  }, [contractorData?.canonicalBusinessProfileUrl, setLocation]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin w-8 h-8 border-4 border-ts-orange/30 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error || !contractorData) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">Business profile not found or failed to load.</p>
            <Link href="/contractors">
              <Button className="mt-4 bg-ts-orange hover:bg-ts-orange-dark">
                Back to Find Local Help
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contractor, recommendations = [], ratingSummary } = contractorData;
  if (contractorData.canonicalBusinessProfileUrl) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin w-8 h-8 border-4 border-ts-orange/30 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }
  const companyInitials =
    contractor.companyName
      ?.split(" ")
      .map((word: string) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CC";

  // SEO data generation
  const breadcrumbItems = [
    { name: "Home", url: "/" },
    { name: "Find Local Help", url: "/contractors" },
    { name: contractor.companyName, url: `/contractors/${slug}` },
  ];

  const contractorStructuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: contractor.companyName,
    description: contractor.about || `Local provider services by ${contractor.companyName}`,
    url: window.location.href,
    address: {
      "@type": "PostalAddress",
      addressCountry: "US",
    },
    priceRange: "$$",
    serviceType: "Local Services",
    areaServed: "Local Area",
  };

  const seoTitle = `${contractor.companyName} - Verified Local Provider | TradeScout`;
  const cvsScoreRaw = (contractor as any)?.cvsScore;
  const cvsScore =
    typeof cvsScoreRaw === "number" && Number.isFinite(cvsScoreRaw) ? cvsScoreRaw : null;
  const seoDescription = `Review ${contractor.companyName} as a local provider on TradeScout. ${cvsScore !== null ? `CVS ${Math.round(cvsScore)}` : "CVS pending"}${contractor.yearsInBusiness ? ` with ${contractor.yearsInBusiness} years experience` : ""}. Contact stays gated through TradeScout.`;
  const directConnectHref = `/direct-connect?intent=hire&targetProviderId=${encodeURIComponent(contractor.id)}&targetName=${encodeURIComponent(contractor.companyName || String(slug || contractor.id))}&contractor=${encodeURIComponent(String(slug || contractor.id))}`;

  return (
    <>
      <SEOHelmet
        title={seoTitle}
        description={seoDescription}
        keywords={`${contractor.companyName}, local provider, local business, verified provider, TradeScout Direct Connect`}
        canonical={`https://www.thetradescout.com/contractors/${slug}`}
        structuredData={contractorStructuredData}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-white/60">
            {breadcrumbItems.map((item, index) => (
              <li key={item.url} className="flex items-center">
                {index > 0 && <span className="mx-2 text-white/60">/</span>}
                {index === breadcrumbItems.length - 1 ? (
                  <span className="text-ts-orange font-medium">{item.name}</span>
                ) : (
                  <Link href={item.url}>
                    <span className="hover:text-white transition-colors cursor-pointer">
                      {item.name}
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
        {/* Profile Header */}
        <Card className="bg-tsCard border-white/10 mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
              <div className="w-24 h-24 bg-ts-orange rounded-xl flex items-center justify-center text-white text-3xl font-bold">
                {companyInitials}
              </div>

              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">{contractor.companyName}</h1>

                {/* Recommendation Statistics */}
                <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-4">
                  <div className="flex items-center space-x-2">
                    <ThumbsUp className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 font-semibold text-lg">
                      {contractor.positiveRecommendations || 0}
                    </span>
                    <span className="text-white/70 text-sm">recommends</span>
                  </div>

                  {(contractor.negativeRecommendations || 0) > 0 && (
                    <div className="flex items-center space-x-2">
                      <ThumbsDown className="h-5 w-5 text-red-400" />
                      <span className="text-red-400 font-semibold text-lg">
                        {contractor.negativeRecommendations}
                      </span>
                      <span className="text-white/70 text-sm">doesn't recommend</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <span className="text-white font-semibold text-lg">
                      Net Score: +
                      {(contractor.positiveRecommendations || 0) -
                        (contractor.negativeRecommendations || 0)}
                    </span>
                    <span className="text-white/70 text-sm">
                      ({contractor.totalRecommendations || 0} total)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {contractor.verifiedLicensed && (
                    <Badge className="bg-green-600 hover:bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Licensed
                    </Badge>
                  )}
                  {contractor.verifiedInsured && (
                    <Badge className="bg-green-600 hover:bg-green-600">
                      <Shield className="h-3 w-3 mr-1" />
                      Insured
                    </Badge>
                  )}
                  {contractor.lastVerified && (
                    <Badge className="bg-blue-600 hover:bg-blue-600">
                      <Calendar className="h-3 w-3 mr-1" />
                      Verified {new Date(contractor.lastVerified).getFullYear()}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col space-y-3">
                <div className="rounded-lg border border-white/10 bg-tsCard/60 px-4 py-3 text-xs text-white/70">
                  <div className="flex items-center gap-2 text-white/70">
                    <ShieldCheck className="h-4 w-4 text-ts-orange" />
                    <span>Contact is protected to prevent spam.</span>
                  </div>
                  <p className="mt-1 text-white/60">
                    Start a request to route work through TradeScout's trust policy.
                  </p>
                </div>

                {isAuthenticated ? (
                  <Button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300"
                    onClick={() => setLocation(directConnectHref)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start a Request
                  </Button>
                ) : (
                  <>
                    <Link
                      href={`/pre-scout-setup?mode=create&next=${encodeURIComponent(directConnectHref)}`}
                    >
                      <Button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 w-full">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Create Account to Connect
                      </Button>
                    </Link>
                    <Link
                      href={`/pre-scout-setup?mode=signin&next=${encodeURIComponent(directConnectHref)}`}
                    >
                      <Button
                        variant="outline"
                        className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white px-6 py-3 w-full"
                      >
                        Sign In
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {contractor.about && (
              <Card className="bg-tsCard border-white/10">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">About</h3>
                  <p className="text-white/70 leading-relaxed">{contractor.about}</p>
                </CardContent>
              </Card>
            )}

            {/* Recent Recommendations */}
            {recommendations.length > 0 && (
              <Card className="bg-tsCard border-white/10">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">Recent Recommendations</h3>
                  <div className="space-y-6">
                    {recommendations.slice(0, 5).map((recommendation: any, index: number) => (
                      <div
                        key={recommendation.id}
                        className={`${index < recommendations.length - 1 ? "border-b border-white/10 pb-6" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {recommendation.recommendationType === "positive" ? (
                              <div className="flex items-center text-green-400">
                                <ThumbsUp className="h-4 w-4 mr-1" />
                                <span className="text-sm font-medium">Recommends</span>
                              </div>
                            ) : (
                              <div className="flex items-center text-red-400">
                                <ThumbsDown className="h-4 w-4 mr-1" />
                                <span className="text-sm font-medium">Does not recommend</span>
                              </div>
                            )}
                            {recommendation.projectType && (
                              <Badge variant="outline" className="text-white/70 border-white/15">
                                {recommendation.projectType}
                              </Badge>
                            )}
                          </div>
                          <span className="text-white/60 text-sm">
                            {new Date(recommendation.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {recommendation.comment && (
                          <p className="text-white/70 mb-2">{recommendation.comment}</p>
                        )}
                        {recommendation.customerName && (
                          <p className="text-white/60 text-sm">- {recommendation.customerName}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendation Form */}
            <RecommendationForm
              contractorId={contractor.id}
              contractorName={contractor.companyName}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Services */}
            <Card className="bg-tsCard border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Services</h3>
                <div className="space-y-2">
                  <div className="flex items-center text-white/70">
                    <CheckCircle className="h-4 w-4 text-ts-orange mr-3" />
                    Residential Services
                  </div>
                  <div className="flex items-center text-white/70">
                    <CheckCircle className="h-4 w-4 text-ts-orange mr-3" />
                    Commercial Services
                  </div>
                  <div className="flex items-center text-white/70">
                    <CheckCircle className="h-4 w-4 text-ts-orange mr-3" />
                    Emergency Repairs
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business Info */}
            <Card className="bg-tsCard border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Business Info</h3>
                <div className="space-y-3">
                  {contractor.yearsInBusiness && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Years in Business</span>
                      <span className="text-white">{contractor.yearsInBusiness}</span>
                    </div>
                  )}

                  {contractor.responseTimeSla && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Response Time</span>
                      <span className="text-white">{contractor.responseTimeSla} hours</span>
                    </div>
                  )}

                  {contractor.licenseNumber && (
                    <div className="flex justify-between">
                      <span className="text-white/60">License #</span>
                      <span className="text-white">{contractor.licenseNumber}</span>
                    </div>
                  )}

                  {contractor.lastVerified && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Last Verified</span>
                      <span className="text-white">
                        {new Date(contractor.lastVerified).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Website Link */}
            {contractor.website && (
              <Card className="bg-tsCard border-white/10">
                <CardContent className="p-6">
                  <a
                    href={contractor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-ts-orange hover:text-ts-orange transition-colors"
                  >
                    <span>Visit Website</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
