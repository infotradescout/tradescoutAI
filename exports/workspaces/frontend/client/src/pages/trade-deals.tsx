import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Shield, Sparkles, MapPin, Clock, Building2, Store, Globe2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CommunityCTA } from "@/components/community/CommunityCTA";

export default function TradeDealsPage() {
  const { user } = useAuth();
  const role = (user as any)?.role as string | undefined;
  const isContractor = (role || "").toLowerCase().includes("contractor");

  return (
    <div className=" px-4 py-8 md:px-8" data-testid="trade-deals-page">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Top: mission + framing */}
        <section className="space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/5 px-3 py-1 text-xs font-medium text-amber-300 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Exclusive by design</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            TradeDeals — Exclusive offers you won&apos;t find anywhere else
          </h1>
          <p className="max-w-2xl text-white/70 text-sm md:text-base">
            Powered by TradeScout sponsors, affiliates, and partners. Every TradeDeal is designed to
            support real projects and real communities – with clear attribution and no spam.
          </p>
          <p className="max-w-2xl text-white/60 text-xs md:text-sm">
            TradeDeals are recommendations, not ads. They appear when Scout or the community
            believes they can genuinely help with what you&apos;re doing – in Direct Connect,
            Community, or elsewhere.
          </p>
        </section>

        {/* Governance + promise */}
        <section className="grid gap-6 md:grid-cols-3">
          <Card className="border-white/10 bg-tsCard/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <Shield className="h-4 w-4 text-amber-400" />
                Connection Without Compromise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-white/70">
              <p>Every TradeDeal is:</p>
              <ul className="list-disc list-inside space-y-1 text-white/70">
                <li>Exclusive to TradeScout – not available elsewhere.</li>
                <li>Time-bound or inventory-bound with clear rules.</li>
                <li>Contextual and project-aware, not generic coupons.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <Building2 className="h-4 w-4 text-sky-400" />
                Who can appear here
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-white/70">
              <p>TradeDeals include:</p>
              <ul className="list-disc list-inside space-y-1 text-white/70">
                <li>National brands and manufacturers</li>
                <li>Regional suppliers and distributors</li>
                <li>Local mom &amp; pops and community partners</li>
                <li>Affiliates, sponsors, and ad partners under review</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <Globe2 className="h-4 w-4 text-emerald-400" />
                How attribution works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-white/70">
              <p>Every eligible activation tracks:</p>
              <ul className="list-disc list-inside space-y-1 text-white/70">
                <li>Referrer and affiliate credit</li>
                <li>Community vault contribution</li>
                <li>Platform impact and ROI</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Featured and project sections use static examples until county deal ingestion is live. */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Featured TradeDeals</h2>
              <p className="text-xs text-white/70">
                Curated, limited placements from vetted sponsors. No open submissions.
              </p>
            </div>
            <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/40 text-[10px] uppercase tracking-wide">
              Curated • Not a marketplace
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <TradeDealCard
              id="example_roofing_supply"
              brand="Example Roofing Supply Co."
              title="Premium shingles for active roof projects"
              description="Exclusive materials pricing for verified roof replacements started in Direct Connect. Limited to approved counties."
              locality="County-qualified • Roofing"
              validity="Through 03/31 or while inventory lasts"
              redemption="Apply to project"
              disableDirectConnect={isContractor}
            />
            <TradeDealCard
              id="regional_plumbing_warehouse"
              brand="Regional Plumbing Warehouse"
              title="Fixture packages for in-progress remodels"
              description="Bundled pricing on mid-range fixtures when tied to an active plumbing remodel request."
              locality="Service radius • Plumbing & remodel"
              validity="Rolling – visible only when Scout detects a matching job"
              redemption="Apply to project"
              disableDirectConnect={isContractor}
            />
            <TradeDealCard
              id="local_lumber_yard"
              brand="Local Lumber & Yard"
              title="Framing lumber for community builds"
              description="Community-backed pricing for projects that route a portion of spend into the local community vault."
              locality="Local partner • Community fund linked"
              validity="Inventory-bound • Limited load counts"
              redemption="Claim through Scout"
              disableDirectConnect={isContractor}
            />
          </div>
        </section>

        {/* Project-based lanes */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Project-based TradeDeals</h2>
              <p className="text-xs text-white/70">
                These lanes only light up when Scout sees an active project in that category.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-xs">
            <ProjectLane
              title="Roofing"
              description="Materials, inspections, and warranties tied to real roof projects."
            />
            <ProjectLane
              title="Plumbing"
              description="Fixtures, leak detection tools, and service bundles for active jobs."
            />
            <ProjectLane
              title="Remodel"
              description="Cabinets, surfaces, and systems for kitchen and bath projects."
            />
            <ProjectLane
              title="Landscaping"
              description="Hardscape, plants, and seasonal maintenance packs for outdoor work."
            />
          </div>
        </section>

        {/* Partners directory summary */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">All Partners Directory</h2>
              <p className="text-xs text-white/70">
                Logos here indicate vetted, contract-backed partners. Full sponsor workflows and
                dashboards live behind Scout and admin tools.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4 text-xs">
            <PartnerBadge label="National brands" icon={Building2} />
            <PartnerBadge label="Regional suppliers" icon={Store} />
            <PartnerBadge label="Local partners" icon={MapPin} />
            <PartnerBadge label="Community sponsors" icon={Shield} />
          </div>
        </section>

        {/* Final positioning sentence */}
        <section className="border-t border-white/10 pt-6 mt-4 text-xs text-white/60">
          <p>
            TradeDeals are exclusive offers from trusted partners, available only through
            TradeScout, designed to support real projects and real communities — without compromise.
          </p>
        </section>
      </div>
    </div>
  );
}

interface TradeDealCardProps {
  id: string;
  brand: string;
  title: string;
  description: string;
  locality: string;
  validity: string;
  redemption: string;
  disableDirectConnect?: boolean;
}

function TradeDealCard({
  id,
  brand,
  title,
  description,
  locality,
  validity,
  redemption,
  disableDirectConnect,
}: TradeDealCardProps) {
  return (
    <Card className="border-white/10 bg-tsCard/95 flex flex-col justify-between">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            {brand}
          </span>
          <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold">
            Exclusive to TradeScout
          </Badge>
        </div>
        <CardTitle className="text-sm text-white leading-snug">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[11px] text-white/70">
        <p className="leading-relaxed">{description}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white/60">
            <MapPin className="h-3 w-3" />
            <span>{locality}</span>
          </div>
          <div className="flex items-center gap-2 text-white/60">
            <Clock className="h-3 w-3" />
            <span>{validity}</span>
          </div>
        </div>
        <p className="text-[10px] text-white/60">
          This offer is exclusive to TradeScout and not available elsewhere. No external coupon
          codes or price comparisons are shown.
        </p>
        <CommunityCTA
          layout="grid"
          source="trade_deal"
          contextId={id}
          canDirectConnect={true}
          disableDirectConnect={disableDirectConnect}
        />
      </CardContent>
    </Card>
  );
}

interface ProjectLaneProps {
  title: string;
  description: string;
}

function ProjectLane({ title, description }: ProjectLaneProps) {
  return (
    <Card className="border-white/10 bg-tsCard/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-[11px] text-white/70 leading-relaxed">{description}</CardContent>
    </Card>
  );
}

interface PartnerBadgeProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function PartnerBadge({ label, icon: Icon }: PartnerBadgeProps) {
  return (
    <Card className="border-white/10 bg-tsCard/95">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
          <Icon className="h-4 w-4 text-white/70" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-white">{label}</p>
          <p className="text-[10px] text-white/60">
            Vetted partners with contract-backed TradeDeals.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
