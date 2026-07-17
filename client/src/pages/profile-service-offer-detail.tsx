import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, Clock3, ShieldCheck, UserRound } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ShareButton } from "@/components/ShareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  buildProfileServiceOfferPath,
  createProfileServiceOfferShareMetadata,
  listProfileOfferImageUrls,
  normalizeProfileOfferId,
} from "@shared/profileOfferShare";

type PublicProfileServiceOffer = {
  id: string;
  sellerUserId: string;
  title: string;
  description?: string | null;
  offerType: "service";
  price: number;
  currency: string;
  serviceCategory?: string | null;
  serviceDurationMinutes?: number | null;
  fulfillmentMode: string;
  metadata?: {
    imageUrls?: string[];
    images?: string[];
  };
};

function formatMoney(value: unknown, currency = "USD"): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

export default function ProfileServiceOfferDetail() {
  const { offerId: rawOfferId } = useParams<{ offerId: string }>();
  const offerId = normalizeProfileOfferId(rawOfferId);
  const servicePath = buildProfileServiceOfferPath(offerId);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [startingJob, setStartingJob] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const {
    data: offer,
    isLoading,
    isError,
  } = useQuery<PublicProfileServiceOffer>({
    queryKey: ["/api/profile-offers", offerId, "public-service"],
    enabled: Boolean(offerId),
    queryFn: async () => {
      const response = await fetch(
        `/api/profile-offers/${encodeURIComponent(offerId || "")}/public`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Service offer not found");
      const data = await response.json();
      return data.offer;
    },
  });

  const images = useMemo(() => (offer ? listProfileOfferImageUrls(offer.metadata) : []), [offer]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setCreatedRequestId(null);
  }, [offerId]);

  if (isLoading) {
    return (
      <main className="bg-app text-primary min-h-[70vh] px-4 py-10">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-10 w-48 rounded bg-white/10" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-[4/3] rounded-2xl bg-white/10" />
            <div className="space-y-4">
              <div className="h-10 rounded bg-white/10" />
              <div className="h-7 w-36 rounded bg-white/10" />
              <div className="h-32 rounded bg-white/10" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!offerId || !servicePath || isError || !offer) {
    return (
      <main className="bg-app text-primary min-h-[70vh] px-4 py-16">
        <Card className="mx-auto max-w-xl text-center">
          <CardContent className="space-y-4 p-8">
            <BriefcaseBusiness className="mx-auto h-12 w-12 opacity-60" />
            <h1 className="text-2xl font-bold">This service is not available</h1>
            <p className="text-sm opacity-75">
              It may have been paused, removed, or made unavailable by the provider.
            </p>
            <Button asChild variant="outline">
              <Link href="/community-feed">Return to TradeScout</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const shareMetadata = createProfileServiceOfferShareMetadata({
    offer,
    origin: getCanonicalAppOrigin(),
  });
  const selectedImage = images[selectedImageIndex] || images[0];
  const viewerId = String((user as any)?.id || (user as any)?.claims?.sub || "");
  const viewerIsSeller = Boolean(viewerId && viewerId === offer.sellerUserId);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: offer.title,
    description: shareMetadata?.description || offer.description || undefined,
    image: images,
    serviceType: offer.serviceCategory || undefined,
    offers: {
      "@type": "Offer",
      price: Number(offer.price).toFixed(2),
      priceCurrency: offer.currency || "USD",
      availability: "https://schema.org/InStock",
      url: shareMetadata?.canonical || servicePath,
    },
  };

  const startProtectedJob = async () => {
    if (!user) {
      navigate(`/pre-scout-setup?mode=create&next=${encodeURIComponent(servicePath)}`);
      return;
    }
    if (viewerIsSeller || startingJob || createdRequestId) return;

    setStartingJob(true);
    try {
      const response = await fetch(`/api/profile-offers/${encodeURIComponent(offer.id)}/purchase`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 1 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Unable to start this job");
      }

      const requestId = data?.workRequest?.id ? String(data.workRequest.id) : null;
      setCreatedRequestId(requestId || "created");
      toast({
        title: "Job draft created",
        description:
          "TradeScout created a private guided request. No contact details or payment were released.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to start this job",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setStartingJob(false);
    }
  };

  return (
    <main className="bg-app text-primary min-h-[70vh] px-4 py-8 md:py-12">
      <SEOHelmet
        title={`${offer.title} | Service`}
        description={shareMetadata?.description || offer.description || undefined}
        canonical={shareMetadata?.canonical || servicePath}
        ogType="product"
        ogImage={shareMetadata?.imageUrl || undefined}
        structuredData={structuredData}
      />

      <div className="mx-auto max-w-6xl">
        <Button asChild variant="ghost" className="mb-5">
          <Link href={`/profile/${encodeURIComponent(offer.sellerUserId)}`}>
            <ArrowLeft className="h-4 w-4" />
            Provider profile
          </Link>
        </Button>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <section className="space-y-3" aria-label="Service photos">
            <div className="ts-card flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border-subtle">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={offer.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-60">
                  <BriefcaseBusiness className="h-16 w-16" />
                  <span>No service photo available</span>
                </div>
              )}
            </div>
            {images.length > 1 ? (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 transition ${
                      selectedImageIndex === index
                        ? "border-ts-orange"
                        : "border-transparent opacity-75 hover:opacity-100"
                    }`}
                    aria-label={`View service photo ${index + 1}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>Service</Badge>
                {offer.serviceCategory ? (
                  <Badge variant="outline">{offer.serviceCategory}</Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{offer.title}</h1>
              <p className="text-3xl font-bold text-ts-orange">
                {formatMoney(offer.price, offer.currency)}
              </p>
              {offer.serviceDurationMinutes ? (
                <p className="flex items-center gap-2 text-sm opacity-75">
                  <Clock3 className="h-4 w-4" />
                  About {offer.serviceDurationMinutes} minutes
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <ShareButton
                destination={servicePath}
                title={offer.title}
                text={shareMetadata?.description || offer.description || offer.title}
                variant="default"
              />
              <Button asChild variant="outline">
                <Link href={`/profile/${encodeURIComponent(offer.sellerUserId)}`}>
                  <UserRound className="h-4 w-4" />
                  View provider profile
                </Link>
              </Button>
            </div>

            {offer.description ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <h2 className="text-lg font-semibold">About this service</h2>
                  <p className="whitespace-pre-wrap text-sm leading-6 opacity-85">
                    {offer.description}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-ts-orange/30 bg-ts-orange/10">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ts-orange" />
                  <div>
                    <h2 className="font-semibold">Protected from the first step</h2>
                    <p className="mt-1 text-sm opacity-80">
                      Starting this service creates a private draft request for your review. It does
                      not release contact details, charge payment, or route the job automatically.
                    </p>
                  </div>
                </div>
                {createdRequestId ? (
                  <Button asChild className="w-full sm:w-auto">
                    <Link href="/direct-connect">Open Direct Connect</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={startProtectedJob}
                    disabled={viewerIsSeller || startingJob}
                    className="w-full sm:w-auto"
                  >
                    {viewerIsSeller
                      ? "This is your service"
                      : startingJob
                        ? "Creating private draft…"
                        : "Start protected job"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
