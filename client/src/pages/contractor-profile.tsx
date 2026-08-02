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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RecommendationForm } from "@/components/RecommendationForm";
import type { Contractor, Recommendation } from "@shared/schema";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ShareButton } from "@/components/ShareButton";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";
import {
  buildContractorPhotoShareSearch,
  createContractorPhotoShareMetadata,
  listContractorProjectPhotos,
} from "@shared/contractorPhotoShare";

type PublicContractorRecommendation = Pick<
  Recommendation,
  "id" | "recommendationType" | "comment" | "projectType" | "customerName" | "createdAt"
>;

interface ContractorProfileData {
  contractor: Contractor;
  recommendations: PublicContractorRecommendation[];
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

  const contractor = contractorData?.contractor;
  const projectPhotos = listContractorProjectPhotos(contractor?.photos);
  const requestedGallerySlug =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("gallery")
      : null;
  const profileCanonical = slug
    ? `https://www.thetradescout.com/contractors/${encodeURIComponent(slug)}`
    : "https://www.thetradescout.com/contractors";
  const photoShareMeta =
    contractor && slug && typeof window !== "undefined"
      ? createContractorPhotoShareMetadata({
          contractorName: contractor.companyName,
          contractorUrl: profileCanonical,
          assetOrigin: window.location.origin,
          photos: contractor.photos,
          itemSlug: requestedGallerySlug,
        })
      : null;

  useEffect(() => {
    const canonicalUrl =
      typeof contractorData?.canonicalBusinessProfileUrl === "string"
        ? contractorData.canonicalBusinessProfileUrl.trim()
        : "";
    if (canonicalUrl && !photoShareMeta) {
      setLocation(canonicalUrl);
    }
  }, [contractorData?.canonicalBusinessProfileUrl, photoShareMeta, setLocation]);

  useEffect(() => {
    if (!photoShareMeta?.itemSlug) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`contractor-project-photo-${photoShareMeta.itemSlug}`)
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [photoShareMeta?.itemSlug]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin w-8 h-8 border-4 border-ts-orange/30 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error || !contractorData || !contractor) {
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

  const { recommendations = [] } = contractorData;
  if (contractorData.canonicalBusinessProfileUrl && !photoShareMeta) {
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

  const profileDescription = `Review ${contractor.companyName} as a local provider on TradeScout, including available verification, work history, and community recommendation evidence${contractor.yearsInBusiness ? ` from ${contractor.yearsInBusiness} years in business` : ""}.`;
  const contractorStructuredData = photoShareMeta
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "LocalBusiness",
            name: contractor.companyName,
            description: profileDescription,
            url: profileCanonical,
            image: projectPhotos[0]?.imageUrl,
            address: { "@type": "PostalAddress", addressCountry: "US" },
            serviceType: "Local Services",
            areaServed: "Local Area",
          },
          {
            "@type": "ImageObject",
            name: photoShareMeta.itemTitle,
            description: photoShareMeta.description,
            contentUrl: photoShareMeta.imageUrl,
            url: photoShareMeta.canonical,
          },
        ],
      }
    : {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: contractor.companyName,
        description: profileDescription,
        url: profileCanonical,
        image: projectPhotos[0]?.imageUrl,
        address: {
          "@type": "PostalAddress",
          addressCountry: "US",
        },
        serviceType: "Local Services",
        areaServed: "Local Area",
      };

  const seoTitle =
    photoShareMeta?.title || `${contractor.companyName} - Verified Local Provider | TradeScout`;
  const seoDescription = photoShareMeta?.description || profileDescription;
  const seoImage = photoShareMeta?.imageUrl || projectPhotos[0]?.imageUrl;
  const seoCanonical = photoShareMeta?.canonical || profileCanonical;
  const directConnectHref = `/direct-connect?intent=hire&targetProviderId=${encodeURIComponent(contractor.id)}&targetName=${encodeURIComponent(contractor.companyName || String(slug || contractor.id))}&contractor=${encodeURIComponent(String(slug || contractor.id))}`;

  return (
    <>
      <SEOHelmet
        title={seoTitle}
        description={seoDescription}
        keywords={`${contractor.companyName}, local provider, local business, verified provider, TradeScout Direct Connect`}
        canonical={seoCanonical}
        ogType={photoShareMeta ? "article" : "profile"}
        ogImage={seoImage}
        structuredData={contractorStructuredData}
        preserveCanonicalQuery={Boolean(photoShareMeta)}
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
                <ShareButton
                  destination={`/contractors/${encodeURIComponent(String(slug || contractor.slug))}`}
                  title={`${contractor.companyName} on TradeScout`}
                  text={`View ${contractor.companyName}'s public local provider profile on TradeScout.`}
                  className="border-white/20 text-white hover:bg-white/10"
                  label="Share profile"
                />
                {isAuthenticated ? (
                  <Button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300"
                    onClick={() => setLocation(directConnectHref)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Direct Connect
                  </Button>
                ) : (
                  <>
                    <Link
                      href={`/pre-scout-setup?mode=create&next=${encodeURIComponent(directConnectHref)}`}
                    >
                      <Button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 w-full">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Direct Connect
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

            {/* Project photos are individually shareable with exact social previews. */}
            {projectPhotos.length > 0 && (
              <Card className="bg-tsCard border-white/10">
                <CardContent className="p-6">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-white">Project Photos</h2>
                      <p className="mt-1 text-sm text-white/60">
                        Work examples shared by this local provider.
                      </p>
                    </div>
                    {photoShareMeta ? (
                      <Badge className="bg-ts-orange text-white">Shared image</Badge>
                    ) : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {projectPhotos.map((photo) => {
                      const isSharedPhoto = photo.slug === photoShareMeta?.itemSlug;
                      return (
                        <article
                          id={`contractor-project-photo-${photo.slug}`}
                          key={photo.slug}
                          className={`scroll-mt-24 overflow-hidden rounded-xl border bg-black/20 transition-shadow ${
                            isSharedPhoto
                              ? "border-ts-orange ring-2 ring-ts-orange/40 shadow-lg"
                              : "border-white/10"
                          }`}
                        >
                          <a href={photo.imageUrl} target="_blank" rel="noreferrer">
                            <img
                              src={photo.imageUrl}
                              alt={photo.imageAlt}
                              className="aspect-[4/3] w-full object-cover"
                              loading="lazy"
                            />
                          </a>
                          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div>
                              <h3 className="font-medium text-white">{photo.title}</h3>
                              {isSharedPhoto ? (
                                <p className="mt-1 text-xs text-ts-orange">Shared image</p>
                              ) : null}
                            </div>
                            <ShareButton
                              destination={`/contractors/${encodeURIComponent(String(slug || contractor.slug))}${buildContractorPhotoShareSearch(photo.slug)}`}
                              title={`${photo.title} by ${contractor.companyName}`}
                              text={`View ${photo.title} from ${contractor.companyName} on TradeScout.`}
                              className="border-white/20 text-white hover:bg-white/10"
                            />
                          </div>
                        </article>
                      );
                    })}
                  </div>
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
      <TradeScoutProfileHandoff
        profileSlug={String(slug || contractor.id)}
        profileName={contractor.companyName}
      />
    </>
  );
}
