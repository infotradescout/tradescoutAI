import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgePercent,
  CalendarDays,
  CheckCircle2,
  ImageIcon,
  ShieldCheck,
  Tag,
  UserRound,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ShareButton } from "@/components/ShareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import {
  buildContractorPromoPath,
  createContractorPromoShareMetadata,
  normalizeContractorPromoSlug,
  type PublicContractorPromoDetail,
} from "@shared/contractorPromoShare";

type PublicPromoResponse = {
  promo: PublicContractorPromoDetail;
};

function formatMoney(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function ContractorPromoDetail() {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = normalizeContractorPromoSlug(rawSlug);
  const promoPath = buildContractorPromoPath(slug);
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<PublicPromoResponse>({
    queryKey: ["/api/promo", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const response = await fetch(`/api/promo/${encodeURIComponent(slug || "")}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Promotion not found");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <main className="bg-app text-primary min-h-[70vh] px-4 py-10">
        <div className="mx-auto max-w-5xl animate-pulse space-y-6">
          <div className="h-10 w-44 rounded bg-white/10" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-[4/3] rounded-2xl bg-white/10" />
            <div className="space-y-4">
              <div className="h-10 rounded bg-white/10" />
              <div className="h-24 rounded bg-white/10" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const promo = data?.promo;
  if (!slug || !promoPath || isError || !promo) {
    return (
      <main className="bg-app text-primary min-h-[70vh] px-4 py-16">
        <Card className="mx-auto max-w-xl text-center">
          <CardContent className="space-y-4 p-8">
            <BadgePercent className="mx-auto h-12 w-12 opacity-60" />
            <h1 className="text-2xl font-bold">This promotion is not available</h1>
            <p className="text-sm opacity-75">
              It may have expired, reached its limit, or been paused by the provider.
            </p>
            <Button asChild variant="outline">
              <Link href="/community-feed">Return to TradeScout</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const shareMetadata = createContractorPromoShareMetadata({
    promo,
    provider: promo.provider,
    origin: getCanonicalAppOrigin(),
  });
  const expiresLabel = promo.expiresAt
    ? new Date(promo.expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const directConnectPath = `/direct-connect?intent=hire&targetProviderId=${encodeURIComponent(
    promo.provider.id
  )}&targetName=${encodeURIComponent(promo.provider.companyName)}&contractor=${encodeURIComponent(
    promo.provider.slug
  )}&promo=${encodeURIComponent(promo.slug)}`;

  const continueWithDirectConnect = () => {
    void fetch(`/api/promo/${encodeURIComponent(promo.slug)}/click`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { Accept: "application/json" },
    }).catch(() => undefined);
    navigate(directConnectPath);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: promo.title,
    description: shareMetadata?.description || promo.description,
    image: promo.imageUrl || undefined,
    availability: "https://schema.org/InStock",
    validThrough: promo.expiresAt || undefined,
    seller: {
      "@type": "LocalBusiness",
      name: promo.provider.companyName,
      url: promo.provider.profilePath,
    },
    url: shareMetadata?.canonical || promoPath,
  };

  return (
    <main className="bg-app text-primary min-h-[70vh] px-4 py-8 md:py-12">
      <SEOHelmet
        title={`${promo.title} | Local promotion`}
        description={shareMetadata?.description || promo.description}
        canonical={shareMetadata?.canonical || promoPath}
        ogImage={shareMetadata?.imageUrl || undefined}
        structuredData={structuredData}
      />

      <div className="mx-auto max-w-5xl">
        <Button asChild variant="ghost" className="mb-5">
          <Link href={promo.provider.profilePath}>
            <ArrowLeft className="h-4 w-4" />
            Provider profile
          </Link>
        </Button>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <section className="space-y-3" aria-label="Promotion image">
            <div className="ts-card flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border-subtle">
              {promo.imageUrl ? (
                <img
                  src={promo.imageUrl}
                  alt={promo.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-60">
                  <ImageIcon className="h-16 w-16" />
                  <span>No promotion photo available</span>
                </div>
              )}
            </div>
            {promo.imageSource === "provider" ? (
              <p className="text-center text-xs opacity-60">
                Provider work photo shown because this promotion does not have its own image yet.
              </p>
            ) : null}
          </section>

          <section className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="gap-1">
                  <BadgePercent className="h-3.5 w-3.5" />
                  {promo.discountLabel}
                </Badge>
                {promo.provider.verifiedLicensed ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Licensed
                  </Badge>
                ) : null}
                {promo.provider.verifiedInsured ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Insured
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{promo.title}</h1>
              <p className="text-base leading-7 opacity-80">{promo.description}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ShareButton
                destination={promoPath}
                title={promo.title}
                text={shareMetadata?.description || promo.description}
                variant="default"
              />
              <Button asChild variant="outline">
                <Link href={promo.provider.profilePath}>
                  <UserRound className="h-4 w-4" />
                  {promo.provider.companyName}
                </Link>
              </Button>
            </div>

            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <Tag className="h-4 w-4 text-ts-orange" />
                  Offer details
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 opacity-85">
                  {promo.offerDetails}
                </p>
                {promo.promoCode ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                    Promotion code: <code className="font-semibold">{promo.promoCode}</code>
                  </div>
                ) : null}
                {promo.minimumJobValue ? (
                  <p className="text-sm opacity-70">
                    Minimum qualifying job: {formatMoney(promo.minimumJobValue)}
                  </p>
                ) : null}
                {expiresLabel ? (
                  <p className="flex items-center gap-2 text-sm opacity-70">
                    <CalendarDays className="h-4 w-4" /> Valid through {expiresLabel}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-ts-orange/30 bg-ts-orange/10">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ts-orange" />
                  <div>
                    <h2 className="font-semibold">Connection without compromise</h2>
                    <p className="mt-1 text-sm opacity-80">
                      Continue through Direct Connect to describe what you need and review the next
                      step. Viewing this promotion never releases private contact details.
                    </p>
                  </div>
                </div>
                <Button type="button" onClick={continueWithDirectConnect}>
                  Continue with Direct Connect
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
