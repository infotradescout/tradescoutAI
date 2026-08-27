import type { ReactNode } from "react";
import {
  Building2,
  Camera,
  ChevronRight,
  CircleDot,
  Clock3,
  Factory,
  Hammer,
  Home,
  MapPin,
  MessageCircle,
  Ruler,
  Settings,
  Truck,
  Wrench,
} from "lucide-react";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";

const services = [
  { icon: Hammer, label: "Custom metal fabrication" },
  { icon: Building2, label: "Structural steel fabrication & installation" },
  { icon: CircleDot, label: "Pipe fabrication & process piping" },
  { icon: Wrench, label: "MIG, TIG, stick & flux-core welding" },
  { icon: Truck, label: "Mobile on-site welding & field service" },
  { icon: Settings, label: "Equipment & heavy machinery repairs" },
  { icon: Factory, label: "Plant maintenance & shutdown support" },
  { icon: Wrench, label: "Industrial maintenance & emergency repair" },
] as const;

const additionalCapabilities = [
  "Aluminum, carbon steel & stainless steel welding",
  "Handrails, stairs & platforms",
  "Skids, frames & custom fabricated components",
  "Welding repairs & modifications",
] as const;

const markets = [
  { icon: Factory, label: "Industrial" },
  { icon: Building2, label: "Commercial" },
  { icon: Home, label: "Residential" },
] as const;

const requestDetails = [
  { icon: Hammer, label: "Fabrication or repair scope" },
  { icon: CircleDot, label: "Material and process" },
  { icon: Ruler, label: "Measurements or drawings" },
  { icon: MapPin, label: "Jobsite or delivery location" },
  { icon: Clock3, label: "Timing or shutdown window" },
  { icon: Camera, label: "Photos of the work" },
] as const;

type RecommendationEntry = {
  id: string;
  recommendationType: "positive" | "negative";
  comment: string;
  projectType: string | null;
  customerName: string;
};

type Props = {
  profileSlug: string;
  platformBaseHref?: string;
  onDirectConnect: () => void;
  hasViewerSession: boolean;
  tradeScoutReturnHref: string;
  recommendationsDirectory?: RecommendationEntry[];
  trustActions: ReactNode;
  profileItems?: ReactNode;
};

const assetRoot = "/images/businesses/pro-fab-specialty-services";
const highFetchPriority = { fetchpriority: "high" } as const;

export default function ProFabProfileTheme({
  profileSlug,
  platformBaseHref = "",
  onDirectConnect,
  hasViewerSession,
  tradeScoutReturnHref,
  recommendationsDirectory = [],
  trustActions,
  profileItems,
}: Props) {
  const publicRecommendations = recommendationsDirectory.filter(
    (entry) => entry.recommendationType === "positive"
  );

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-4xl grid-cols-[44px_1fr_44px] items-center px-2 sm:h-20 sm:grid-cols-[150px_1fr_150px] sm:px-4">
          <span className="inline-flex h-10 w-10" aria-hidden="true" />

          <div className="flex min-w-0 items-center justify-center" aria-label="Pro Fab">
            <img
              src={`${assetRoot}/logo.svg`}
              alt="Pro Fab Specialty Services LLC"
              className="h-11 w-[146px] flex-none object-contain sm:h-14 sm:w-[190px]"
            />
          </div>

          <button
            type="button"
            onClick={onDirectConnect}
            aria-label="Direct Connect with Pro Fab"
            className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-full bg-ts-orange text-white transition-colors hover:bg-ts-orange-dark sm:w-auto sm:gap-2 sm:px-4"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden text-xs font-black sm:inline">Direct Connect</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl bg-[#0d0d0d] sm:border-x sm:border-white/10">
        <section aria-label="Pro Fab cover" className="border-b border-white/10 bg-black">
          <div className="relative h-48 overflow-hidden sm:hidden">
            <img
              src={`${assetRoot}/cover.svg`}
              alt="Pro Fab welding and metal fabrication"
              className="absolute inset-0 h-full w-full object-cover object-right opacity-80"
              {...highFetchPriority}
            />
            <span className="absolute inset-0 bg-[linear-gradient(90deg,#050505_0%,#050505_48%,rgba(5,5,5,0.86)_61%,rgba(5,5,5,0.08)_100%)]" />
            <div className="absolute inset-y-0 left-0 flex w-[62%] flex-col justify-center px-5">
              <p className="text-3xl font-black tracking-[-0.06em] text-white">
                PRO<span className="text-red-600">FAB</span>
              </p>
              <span className="mt-3 h-1 w-24 rounded-full bg-red-600" />
              <p className="mt-3 text-sm font-black uppercase leading-5 text-zinc-100">
                Welding &amp; metal fabrication
              </p>
            </div>
          </div>
          <img
            src={`${assetRoot}/cover.svg`}
            alt="Pro Fab welding and metal fabrication"
            className="hidden aspect-[5/2] w-full object-contain sm:block"
            {...highFetchPriority}
          />
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6 sm:py-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500">
                Welding &amp; metal fabrication
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Pro Fab Specialty Services LLC
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-300">
                <MapPin className="h-4 w-4 flex-none text-red-500" />
                Hammond, Louisiana and surrounding areas
              </p>
            </div>
            <div className="hidden rounded-full border border-red-500/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-400 sm:block">
              Built strong. Welded right.
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
            Welding and custom metal fabrication for industrial, commercial, and residential
            projects, from one-off repairs to structural steel and piping work.
          </p>

          <button
            type="button"
            onClick={onDirectConnect}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-red-500/50 px-5 text-sm font-black text-red-500 transition-colors hover:bg-red-500/10"
          >
            Direct Connect with Pro Fab
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="mt-2 text-center text-[11px] font-medium text-zinc-400">
            Send project details.
          </p>
        </section>

        <section
          aria-label="Trust and profile actions"
          data-testid="profile-trust-section"
          className="border-b border-white/10 px-4 py-5 sm:px-6"
        >
          {trustActions}
        </section>

        <section className="border-b border-white/10 px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black text-white">Services</h2>
            <p className="text-xs font-semibold text-zinc-400">Shop and field work</p>
          </div>

          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 sm:grid-cols-4">
            {services.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className={`min-h-28 p-3.5 ${index % 2 === 0 ? "border-r border-white/10" : ""} ${index < 6 ? "border-b border-white/10" : ""} ${index > 0 ? "sm:border-l sm:border-white/10" : ""} sm:[&:nth-child(n+5)]:border-t sm:[&:nth-child(4n+1)]:border-l-0`}
              >
                <Icon className="h-5 w-5 text-red-500" />
                <p className="mt-4 text-sm font-bold leading-5 text-zinc-100">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {additionalCapabilities.map((capability) => (
              <span
                key={capability}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300"
              >
                {capability}
              </span>
            ))}
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-6 sm:px-6">
          <h2 className="text-lg font-black text-white">Serving</h2>
          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10">
            {markets.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className={`flex min-h-24 flex-col justify-between p-3.5 ${index > 0 ? "border-l border-white/10" : ""}`}
              >
                <Icon className="h-5 w-5 text-red-500" />
                <p className="text-xs font-black text-white sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="hidden border-b border-white/10 px-6 py-7 md:block">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500">
            Supplied business information
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Capabilities at a glance</h2>
          <figure className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black">
            <img
              src={`${assetRoot}/capabilities.svg`}
              alt="Pro Fab services and capabilities"
              className="h-auto w-full object-contain"
              loading="lazy"
            />
          </figure>
        </section>

        <section className="border-b border-white/10 px-4 py-6 sm:px-6">
          <h2 className="text-lg font-black text-white">About Pro Fab</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
            Pro Fab provides custom fabrication, structural steel, process piping, mobile field
            welding, equipment repair, plant maintenance, and emergency repair support. Each request
            starts with the project scope, site, and timing.
          </p>
        </section>

        {publicRecommendations.length > 0 ? (
          <section className="border-b border-white/10 px-4 py-6 sm:px-6">
            <h2 className="text-lg font-black text-white">Customer recommendations</h2>
            <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
              {publicRecommendations.slice(0, 6).map((entry) => (
                <article key={entry.id} className="p-4">
                  <p className="font-bold text-white">{entry.customerName || "Customer"}</p>
                  {entry.projectType ? (
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-ts-orange">
                      {entry.projectType}
                    </p>
                  ) : null}
                  {entry.comment ? (
                    <p className="mt-2 text-sm leading-5 text-zinc-300">{entry.comment}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {profileItems ? (
          <section className="border-b border-white/10 px-4 py-6 sm:px-6">{profileItems}</section>
        ) : null}

        <section id="request-details" className="scroll-mt-20 px-4 py-7 sm:px-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ts-orange">
            TradeScout Direct Connect
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Send Pro Fab the project details.</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {requestDetails.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-sm font-semibold text-zinc-300"
              >
                <Icon className="h-4 w-4 flex-none text-ts-orange" />
                {label}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onDirectConnect}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ts-orange px-5 text-sm font-black text-white transition-colors hover:bg-ts-orange-dark"
          >
            Direct Connect with Pro Fab
            <ChevronRight className="h-4 w-4" />
          </button>
        </section>

        <TradeScoutProfileHandoff
          profileSlug={profileSlug}
          profileName="Pro Fab Specialty Services LLC"
          platformBaseHref={platformBaseHref}
          className="border-t border-white/10"
        />
      </div>
    </main>
  );
}
