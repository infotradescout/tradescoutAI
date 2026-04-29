import { memo } from "react";
import { Link } from "wouter";
import { ArrowRight, MapPinned, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEOHelmet } from "@/components/SEOHelmet";

const CountyHub = memo(function CountyHub() {
  return (
    <div className="bg-tsBg px-4 py-14 text-white sm:px-6 lg:px-8 lg:py-20">
      <SEOHelmet
        title="County Hub | Local County Intelligence and Routing"
        description="Access TradeScout county intelligence and open the county directory to navigate local operational county pages."
        canonical="https://www.thetradescout.com/county-hub"
      />
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-sm font-medium text-ts-orange">
            <MapPinned className="h-4 w-4" />
            County hub
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            County intelligence starts here
          </h1>
          <p className="text-lg leading-relaxed text-white/70">
            Open the county directory to move into real county pages generated from county and state
            data.
          </p>
        </div>

        <Card className="border-white/10 bg-white/[0.04] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-ts-orange" />
              County routing is data-backed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/60">
              This page used to show placeholder content. County pages are now generated from real
              county/state data.
            </p>
            <Link href="/county-directory">
              <Button className="gap-2 bg-ts-orange hover:bg-ts-orange/90 text-black font-semibold">
                Open county directory
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default CountyHub;
