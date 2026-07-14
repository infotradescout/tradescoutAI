import { Link } from "wouter";
import {
  Camera,
  CarFront,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";

const services = [
  { icon: CarFront, label: "Windshield replacement" },
  { icon: Wrench, label: "Rock chip repair" },
  { icon: MapPin, label: "Mobile service" },
  { icon: ShieldCheck, label: "Auto glass installation" },
] as const;

const requestDetails = [
  { icon: CarFront, label: "Year, make, model, and VIN" },
  { icon: ShieldCheck, label: "Which glass is damaged" },
  { icon: Camera, label: "Damage photos and location" },
  { icon: Clock3, label: "Timing and vehicle location" },
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
  directConnectHref: string;
  hasViewerSession: boolean;
  preScoutCreateHref: string;
  recommendationsDirectory?: RecommendationEntry[];
};

const assetRoot = "/images/businesses/jrs-auto-glass";

export default function JrsAutoGlassProfileTheme({
  directConnectHref,
  hasViewerSession,
  preScoutCreateHref,
  recommendationsDirectory = [],
}: Props) {
  const requestHref = hasViewerSession ? directConnectHref : preScoutCreateHref;
  const exitHref = hasViewerSession ? "/direct-connect" : "/";
  const publicRecommendations = recommendationsDirectory.filter(
    (entry) => entry.recommendationType === "positive"
  );

  return (
    <main className="bg-[#090909] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-[72px] md:px-6">
          <Link
            href={exitHref}
            aria-label={
              hasViewerSession
                ? "Close JR's Auto Glass and return to Direct Connect"
                : "Close JR's Auto Glass and return to TradeScout"
            }
            className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-full border border-white/15 text-white/80 transition-colors hover:border-ts-orange hover:text-ts-orange"
          >
            <X className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-2.5" aria-label="JR's Auto Glass">
            <img
              src={`${assetRoot}/logo.webp`}
              alt=""
              aria-hidden="true"
              className="h-9 w-24 object-contain sm:w-28"
            />
            <span className="hidden text-xs font-black uppercase tracking-[0.14em] text-white md:inline">
              JR&apos;s Auto Glass
            </span>
          </div>

          <Link
            href={requestHref}
            className="inline-flex min-h-10 items-center justify-center justify-self-end rounded-full bg-ts-orange px-3.5 text-xs font-black text-white transition-colors hover:bg-ts-orange-dark sm:px-5 sm:text-sm"
          >
            <span className="hidden sm:inline">Direct Connect</span>
            <MessageCircle className="h-4 w-4 sm:hidden" />
          </Link>
        </div>
      </header>

      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-5xl md:px-6 md:pt-6">
          <div className="relative overflow-hidden bg-black md:rounded-t-3xl md:border md:border-white/10">
            <img
              src={`${assetRoot}/cover.webp`}
              alt="JR's Auto Glass"
              className="aspect-[1122/270] w-full object-cover"
            />
          </div>

          <div className="relative z-10 mx-4 -mt-5 grid gap-5 rounded-2xl border border-white/10 bg-[#151515] p-5 shadow-2xl shadow-black/50 sm:-mt-8 sm:grid-cols-[auto_1fr_auto] sm:items-center md:mx-8 md:p-6">
            <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl border border-red-600/55 bg-black p-2 sm:h-24 sm:w-32">
              <img
                src={`${assetRoot}/logo.webp`}
                alt="JR's Auto Glass logo"
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                Mobile auto glass
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                JR&apos;s Auto Glass
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-400">
                <MapPin className="h-4 w-4 text-red-500" />
                Ponchatoula, Louisiana
              </p>
            </div>

            <Link
              href={requestHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ts-orange px-6 text-sm font-black text-white transition-colors hover:bg-ts-orange-dark"
            >
              Request auto glass service
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-6 md:py-8">
        <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 md:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Services</p>
              <h2 className="mt-1 text-2xl font-black text-white">Auto glass, wherever the vehicle is</h2>
            </div>
            <p className="hidden text-sm font-semibold text-zinc-500 sm:block">All makes and models</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {services.map(({ icon: Icon, label }) => (
              <article key={label} className="rounded-xl border border-white/10 bg-black/35 p-4">
                <Icon className="h-5 w-5 text-red-500" />
                <p className="mt-4 text-sm font-black leading-5 text-white">{label}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 md:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Recent work</p>
              <h2 className="mt-1 text-2xl font-black text-white">Damage in. Clear glass out.</h2>
            </div>
            <p className="hidden text-sm text-zinc-500 sm:block">Windshield replacement</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-xl border border-white/10 bg-black">
              <img src={`${assetRoot}/before.webp`} alt="Damaged windshield before service" className="w-full" />
            </figure>
            <figure className="overflow-hidden rounded-xl border border-white/10 bg-black">
              <img src={`${assetRoot}/after.webp`} alt="Replaced windshield after service" className="w-full" />
            </figure>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-2xl border border-white/10 bg-[#121212] p-5 md:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">About JR&apos;s</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">
              The shop comes to you.
            </h2>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Mobile auto glass repair and installation serving Ponchatoula and surrounding areas.
              Start the request with the real vehicle and damage details so JR&apos;s can respond to
              the actual job.
            </p>
          </article>

          <article id="request-details" className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#121212] p-5 md:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-ts-orange">Direct Connect request</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Send the useful details once.</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {requestDetails.map(({ icon: Icon, label }) => (
                <div key={label} className="flex gap-3 rounded-xl bg-black/35 p-3.5">
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-ts-orange" />
                  <p className="text-sm font-semibold leading-5 text-zinc-300">{label}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#121212] p-5 md:p-6">
          <div className="grid gap-6 md:grid-cols-[0.72fr_1.28fr] md:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ts-orange">TradeScout CV</p>
              <h2 className="mt-2 text-2xl font-black text-white">A trust record built from real activity.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Work outcomes, recommendations, and platform behavior strengthen the business CV.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {["Claimed business", "Verified-intent requests", "Contact opens after acceptance"].map((signal) => (
                <div key={signal} className="flex gap-2.5 rounded-xl border border-white/10 bg-black/35 p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-ts-orange" />
                  <p className="text-sm font-bold leading-5 text-zinc-200">{signal}</p>
                </div>
              ))}
            </div>
          </div>

          {publicRecommendations.length > 0 ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-black text-white">Businesses JR&apos;s recommends</h3>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Approved TradeScout recommendations
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {publicRecommendations.slice(0, 6).map((entry) => {
                  const card = (
                    <>
                      <p className="font-black text-white">{entry.contractor.companyName}</p>
                      {entry.projectType ? (
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-ts-orange">
                          {entry.projectType}
                        </p>
                      ) : null}
                      {entry.comment ? <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.comment}</p> : null}
                    </>
                  );

                  return entry.contractor.canonicalBusinessProfileUrl ? (
                    <Link
                      key={entry.id}
                      href={entry.contractor.canonicalBusinessProfileUrl}
                      className="rounded-xl border border-white/10 bg-black/35 p-4 hover:border-ts-orange/50"
                    >
                      {card}
                    </Link>
                  ) : (
                    <article key={entry.id} className="rounded-xl border border-white/10 bg-black/35 p-4">
                      {card}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-orange-500/25 bg-[#1b120d] p-5 md:p-6">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ts-orange">TradeScout Direct Connect</p>
              <h2 className="mt-2 text-2xl font-black text-white">Put the glass problem in front of JR&apos;s.</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Contact stays protected and opens after the request is accepted.
              </p>
            </div>
            <Link
              href={requestHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ts-orange px-6 text-sm font-black text-white transition-colors hover:bg-ts-orange-dark"
            >
              Direct Connect with JR&apos;s
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10 bg-black py-7">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 text-center text-xs text-zinc-500 sm:flex-row sm:text-left md:px-6">
          <img src={`${assetRoot}/logo.webp`} alt="JR's Auto Glass" className="h-8 w-28 object-contain" />
          <p className="inline-flex items-center gap-2">
            <FileText className="h-4 w-4 text-ts-orange" />
            Protected contact through TradeScout Direct Connect
          </p>
        </div>
      </footer>
    </main>
  );
}
