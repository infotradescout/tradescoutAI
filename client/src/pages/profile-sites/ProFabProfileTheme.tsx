import { Link } from "wouter";
import {
  Building2,
  Camera,
  ChevronRight,
  CircleDot,
  Clock3,
  Factory,
  Hammer,
  HardHat,
  Home,
  MapPin,
  MessageCircle,
  Ruler,
  Settings,
  ShieldCheck,
  Truck,
  Wrench,
  X,
} from "lucide-react";

const services = [
  { icon: Hammer, label: "Custom metal fabrication" },
  { icon: Building2, label: "Structural steel fabrication & installation" },
  { icon: CircleDot, label: "Pipe fabrication & process piping" },
  { icon: ShieldCheck, label: "MIG, TIG, stick & flux-core welding" },
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

const reasons = [
  "Quality craftsmanship",
  "Reliable, on-time service",
  "Safety-first approach",
  "Experienced welders & fabricators",
  "Custom solutions for each project",
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
  contractor: {
    companyName: string;
    canonicalBusinessProfileUrl?: string | null;
  };
};

type Props = {
  onDirectConnect: () => void;
  hasViewerSession: boolean;
  recommendationsDirectory?: RecommendationEntry[];
};

const assetRoot = "/images/businesses/pro-fab-specialty-services";

export default function ProFabProfileTheme({
  onDirectConnect,
  hasViewerSession,
  recommendationsDirectory = [],
}: Props) {
  const exitHref = hasViewerSession ? "/direct-connect" : "/";
  const publicRecommendations = recommendationsDirectory.filter(
    (entry) => entry.recommendationType === "positive"
  );

  return (
    <main className="bg-black text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-4xl grid-cols-[44px_1fr_44px] items-center px-2 sm:h-16 sm:grid-cols-[120px_1fr_120px] sm:px-4">
          <Link
            href={exitHref}
            aria-label={
              hasViewerSession
                ? "Close Pro Fab and return to Direct Connect"
                : "Close Pro Fab and return to TradeScout"
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Link>

          <div
            className="flex min-w-0 items-center justify-center gap-2"
            aria-label="Pro Fab Specialty Services LLC"
          >
            <img
              src={`${assetRoot}/logo.svg`}
              alt=""
              aria-hidden="true"
              className="h-9 w-24 flex-none object-contain sm:h-10 sm:w-28"
            />
            <span className="hidden truncate text-[11px] font-black uppercase tracking-[0.08em] text-white sm:inline">
              Pro Fab Specialty Services
            </span>
          </div>

          <button
            type="button"
            onClick={onDirectConnect}
            aria-label="Open TradeScout Direct Connect with Pro Fab"
            className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-full bg-ts-orange text-white transition-colors hover:bg-ts-orange-dark sm:w-auto sm:gap-2 sm:px-4"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden text-xs font-black sm:inline">Direct Connect</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl bg-[#0d0d0d] sm:border-x sm:border-white/10">
        <section aria-label="Pro Fab cover" className="border-b border-white/10 bg-black">
          <img
            src={`${assetRoot}/cover.svg`}
            alt="Pro Fab welding and metal fabrication"
            className="aspect-[5/2] w-full object-cover"
            fetchPriority="high"
          />
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500">
                Welding & metal fabrication
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Pro Fab Specialty Services LLC
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-400">
                <MapPin className="h-4 w-4 flex-none text-red-500" />
                Hammond, Louisiana and surrounding areas
              </p>
            </div>
            <div className="hidden rounded-full border border-red-500/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-400 sm:block">
              Built strong. Welded right.
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Welding and custom metal fabrication for industrial, commercial, and residential
            projects, from one-off repairs to structural steel and complete piping work.
          </p>

          <button
            type="button"
            onClick={onDirectConnect}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ts-orange px-5 text-sm font-black text-white transition-colors hover:bg-ts-orange-dark"
          >
            Request welding or fabrication
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="mt-2 text-center text-[11px] font-medium text-zinc-500">
            Send the project details first. TradeScout offers signup after send.
          </p>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-black text-white">Services</h2>
            <p className="text-xs font-semibold text-zinc-500">Shop and field work</p>
          </div>

          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 sm:grid-cols-4">
            {services.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className={`min-h-32 p-3.5 ${index % 2 === 0 ? "border-r border-white/10" : ""} ${index < 6 ? "border-b border-white/10 sm:border-b-0" : ""} ${index > 0 ? "sm:border-l sm:border-white/10" : ""} sm:[&:nth-child(n+5)]:border-t sm:[&:nth-child(4n+1)]:border-l-0`}
              >
                <Icon className="h-5 w-5 text-red-500" />
                <p className="mt-5 text-sm font-bold leading-5 text-zinc-100">{label}</p>
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

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <h2 className="text-base font-black text-white">Serving</h2>
          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10">
            {markets.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className={`flex min-h-24 flex-col justify-between p-3.5 ${index > 0 ? "border-l border-white/10" : ""}`}
              >
                <Icon className="h-5 w-5 text-red-500" />
                <p className="text-sm font-black text-white">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-red-500" />
            <h2 className="text-base font-black text-white">Why Pro Fab</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {reasons.map((reason) => (
              <div
                key={reason}
                className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3"
              >
                <ShieldCheck className="h-4 w-4 flex-none text-red-500" />
                <p className="text-sm font-semibold text-zinc-300">{reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500">
            Supplied business information
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Capabilities at a glance</h2>
          <figure className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black">
            <img
              src={`${assetRoot}/capabilities.svg`}
              alt="Pro Fab services and capabilities"
              className="h-auto w-full"
              loading="lazy"
            />
          </figure>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <h2 className="text-base font-black text-white">About Pro Fab</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Pro Fab provides custom fabrication, structural steel, process piping, mobile field
            welding, equipment repair, plant maintenance, and emergency repair support. Work is
            scoped to the project specifications, schedule, and budget.
          </p>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ts-orange" />
            <h2 className="text-base font-black text-white">TradeScout Business CV</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Recommendations and completed activity build Pro Fab&apos;s business record on
            TradeScout.
          </p>

          {publicRecommendations.length > 0 ? (
            <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
              {publicRecommendations.slice(0, 6).map((entry) => {
                const content = (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white">{entry.contractor.companyName}</p>
                      {entry.projectType ? (
                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-ts-orange">
                          {entry.projectType}
                        </p>
                      ) : null}
                      {entry.comment ? (
                        <p className="mt-2 text-sm leading-5 text-zinc-400">{entry.comment}</p>
                      ) : null}
                    </div>
                    {entry.contractor.canonicalBusinessProfileUrl ? (
                      <ChevronRight className="h-4 w-4 flex-none text-zinc-500" />
                    ) : null}
                  </>
                );

                return entry.contractor.canonicalBusinessProfileUrl ? (
                  <Link
                    key={entry.id}
                    href={entry.contractor.canonicalBusinessProfileUrl}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-white/5"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={entry.id} className="flex items-center gap-3 p-4">
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3">
              <ShieldCheck className="h-4 w-4 flex-none text-red-500" />
              <p className="text-sm font-semibold text-zinc-300">
                Public business profile active on TradeScout
              </p>
            </div>
          )}
        </section>

        <section id="request-details" className="scroll-mt-20 px-4 py-6 sm:px-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ts-orange">
            TradeScout Direct Connect
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Send Pro Fab the project details.</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {requestDetails.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-sm font-semibold text-zinc-400"
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
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
            Contact information stays protected inside TradeScout until the visitor chooses how to
            connect.
          </p>
        </section>
      </div>
    </main>
  );
}
