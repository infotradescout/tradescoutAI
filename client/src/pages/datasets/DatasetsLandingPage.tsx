import { memo } from "react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DatasetsLandingPage = memo(function DatasetsLandingPage() {
  return (
    <>
      <SEOHelmet
        title="Open Datasets | TradeScout"
        description="Public, read-only datasets for trades, counties, cities, and directory discovery."
        keywords="datasets, open data, contractors, trades, counties, cities, TradeScout"
        canonical="https://www.thetradescout.com/datasets"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Open Datasets</CardTitle>
            <p className="text-white/60">
              Read-only discovery datasets for trades, counties, cities, and directories.
            </p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Link href="/datasets/trades">
                <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                  Trades dataset
                </a>
              </Link>
              <Link href="/datasets/counties">
                <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                  Counties dataset
                </a>
              </Link>
              <Link href="/datasets/cities">
                <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                  Cities dataset
                </a>
              </Link>
            </div>

            <div className="mt-4 text-xs text-white/60">
              JSON endpoints live under{" "}
              <span className="text-white/70">/api/public/datasets/*</span> (not indexed by default
              robots rules). These pages are the public browse layer.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
});

export default DatasetsLandingPage;
