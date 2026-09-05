import { Link, useRoute } from "wouter";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LOCAL_BUSINESS_DISCOVERY } from "@/lib/popularSearchQueries";
import {
  PENSACOLA_COUNTY_CODE,
  PENSACOLA_CLUSTERS,
  findPensacolaCluster,
} from "@/lib/pensacolaClusters";

export default function PensacolaClusterPage() {
  const [, params] = useRoute("/pensacola/:clusterSlug");
  const cluster = findPensacolaCluster(params?.clusterSlug);

  if (!cluster) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <SEOHelmet
          title="Pensacola Service Hub | TradeScout"
          description="Pensacola service cluster not found. Use the TradeScout Pensacola hub to continue."
          canonical="https://www.thetradescout.com/pensacola"
          noIndex
        />
        <h1 className="text-2xl md:text-3xl font-bold text-white">Pensacola service not found</h1>
        <p className="text-white/70">
          This Pensacola service page does not exist yet. Start from the main Pensacola hub.
        </p>
        <Link href="/pensacola">
          <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
            Go to Pensacola hub
          </Button>
        </Link>
      </div>
    );
  }

  const localRequestHref = LOCAL_BUSINESS_DISCOVERY.pensacolaRequestHref;
  const providerDemandHref = `/direct-connect?county=${PENSACOLA_COUNTY_CODE}&source=pensacola-launch&intent=provider_demand`;
  const applyHref = `/claim-my-business?stateCode=FL&countyFips=${PENSACOLA_COUNTY_CODE}&source=pensacola_cluster`;
  const createAccountHref = `/create-account?source=pensacola-launch&county=${PENSACOLA_COUNTY_CODE}`;

  const canonicalUrl = `https://www.thetradescout.com/pensacola/${cluster.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: `${cluster.title} | TradeScout`,
        description: cluster.summary,
        url: canonicalUrl,
      },
      createBreadcrumbStructuredData([
        { name: "TradeScout", url: "/" },
        { name: "Pensacola", url: "/pensacola" },
        { name: cluster.shortLabel, url: `/pensacola/${cluster.slug}` },
      ]),
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <SEOHelmet
        title={`${cluster.title} | TradeScout`}
        description={`${cluster.summary} Start local demand in Escambia County and create an account to save and track progress.`}
        keywords={`${cluster.shortLabel} pensacola, escambia county ${cluster.shortLabel.toLowerCase()}, tradescout pensacola`}
        canonical={canonicalUrl}
        structuredData={structuredData}
      />

      <section className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ts-orange font-semibold">
          Pensacola Demand Cluster
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white">{cluster.title}</h1>
        <p className="text-white/70 max-w-4xl">{cluster.summary}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={localRequestHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Start local request
            </Button>
          </Link>
          <Link href={createAccountHref}>
            <Button variant="outline" className="border-white/20 text-white">
              Create account to save progress
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-xl font-semibold text-white">What people are trying to solve</h2>
            <p className="text-sm text-white/70">{cluster.consumerIntent}</p>
            <div className="flex flex-wrap gap-2">
              {cluster.searchSignals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85"
                >
                  {signal}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-xl font-semibold text-white">What businesses can do now</h2>
            <p className="text-sm text-white/70">{cluster.providerIntent}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={applyHref}>
                <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                  Onboard in Pensacola
                </Button>
              </Link>
              <Link href={providerDemandHref}>
                <Button variant="outline" className="border-white/20 text-white">
                  View provider demand flow
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Continue this service path</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={cluster.tradeHref}>
            <Button variant="outline" className="border-white/20 text-white">
              Browse this trade in Florida
            </Button>
          </Link>
          <Link href="/pensacola">
            <Button variant="outline" className="border-white/20 text-white">
              Back to Pensacola hub
            </Button>
          </Link>
          <Link href="/find-local-businesses">
            <Button variant="outline" className="border-white/20 text-white">
              Find local businesses
            </Button>
          </Link>
          <Link href="/for-businesses">
            <Button variant="outline" className="border-white/20 text-white">
              For businesses
            </Button>
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Other Pensacola service clusters</h2>
        <div className="flex flex-wrap gap-2">
          {PENSACOLA_CLUSTERS.filter((item) => item.slug !== cluster.slug).map((item) => (
            <Link key={item.slug} href={`/pensacola/${item.slug}`}>
              <a className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:border-ts-orange/50 hover:text-white transition-colors">
                {item.shortLabel}
              </a>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
