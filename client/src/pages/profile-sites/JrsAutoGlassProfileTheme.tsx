import { Link } from "wouter";
import {
  Camera,
  CarFront,
  ChevronRight,
  Clock3,
  FileText,
  MessageCircle,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

const requestDetails = [
  {
    icon: CarFront,
    title: "Exact vehicle",
    body: "Year, make, model, and VIN if available",
  },
  {
    icon: ShieldCheck,
    title: "Which glass",
    body: "Windshield, door, quarter, or back glass",
  },
  {
    icon: Camera,
    title: "Damage",
    body: "Chip or crack size, location, and photos",
  },
  {
    icon: Clock3,
    title: "Job details",
    body: "Camera or sensors, insurance or self-pay, location, and timing",
  },
] as const;

const requestAdvantages = [
  {
    icon: Search,
    title: "Repair or replace?",
    body: "Show the damage so JR's can respond to the actual glass issue instead of a generic category.",
  },
  {
    icon: CarFront,
    title: "Start with the right glass",
    body: "Vehicle and VIN details reduce the back-and-forth required to identify the correct part.",
  },
  {
    icon: MessageCircle,
    title: "No call-center loop",
    body: "Your request opens a protected conversation tied directly to JR's Auto Glass.",
  },
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

export default function JrsAutoGlassProfileTheme({
  directConnectHref,
  hasViewerSession,
  preScoutCreateHref,
  recommendationsDirectory = [],
}: Props) {
  const publicRecommendations = recommendationsDirectory.filter(
    (entry) => entry.recommendationType === "positive"
  );
  const requestHref = hasViewerSession ? directConnectHref : preScoutCreateHref;
  const exitHref = hasViewerSession ? "/direct-connect" : "/";

  return (
    <main className="min-h-screen bg-[#080808] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-[72px] md:px-8">
          <Link
            href={exitHref}
            aria-label={
              hasViewerSession
                ? "Close JR's Auto Glass and return to Direct Connect"
                : "Close JR's Auto Glass and return to TradeScout"
            }
            className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-full border border-white/15 text-white/80 transition-colors hover:border-ts-orange/70 hover:text-ts-orange"
          >
            <X className="h-4.5 w-4.5" />
          </Link>

          <div className="flex items-center gap-2.5" aria-label="JR's Auto Glass">
            <img
              src="/images/businesses/jrs-auto-glass/logo.svg"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 rounded-lg object-contain"
            />
            <div className="leading-none">
              <p className="text-sm font-black uppercase tracking-[0.08em] text-white sm:text-base">
                JR&apos;s
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400 sm:text-[10px]">
                Auto Glass
              </p>
            </div>
          </div>

          <Link
            href={requestHref}
            className="inline-flex min-h-10 items-center justify-center justify-self-end rounded-full bg-ts-orange px-3.5 text-xs font-bold text-white shadow-lg shadow-orange-950/25 transition-colors hover:bg-ts-orange-dark sm:px-5 sm:text-sm"
          >
            <span className="hidden sm:inline">Direct Connect</span>
            <MessageCircle className="h-4 w-4 sm:hidden" />
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-red-600/25">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_76%_34%,rgba(210,15,39,0.24),transparent_25%),radial-gradient(circle_at_18%_80%,rgba(249,115,22,0.10),transparent_25%),linear-gradient(135deg,#151515_0%,#050505_62%)]"
          aria-hidden="true"
        />
        <div
          className="absolute left-[8%] right-[8%] top-[22%] h-[46%] rounded-[50%_50%_18%_18%/70%_70%_18%_18%] border border-white/10"
          aria-hidden="true"
        />
        <div
          className="absolute left-1/2 top-[24%] h-[42%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-red-600/50 to-transparent"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid min-h-[610px] max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.12fr_0.88fr] md:items-center md:px-8 md:py-20">
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-red-500">
              Ponchatoula, Louisiana · Mobile auto glass
            </p>
            <h1 className="max-w-[11ch] text-[3.15rem] font-black uppercase leading-[0.9] tracking-[-0.04em] text-white sm:text-6xl md:text-7xl">
              Skip the national-chain runaround.
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-7 text-zinc-300 md:text-lg">
              Send JR&apos;s your vehicle, glass damage, photos, and timing once. Start with the
              established local business—not a generic national call-center script.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={requestHref}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ts-orange px-7 text-sm font-black text-white shadow-[0_16px_40px_rgba(249,115,22,0.25)] transition-all hover:-translate-y-0.5 hover:bg-ts-orange-dark"
              >
                Direct Connect with JR&apos;s
                <ChevronRight className="h-4 w-4" />
              </Link>
              <a
                href="#request-details"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                See what to send
              </a>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-[430px] items-center justify-center">
            <div className="absolute inset-8 rounded-full bg-red-600/20 blur-3xl" aria-hidden="true" />
            <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black/75 p-7 shadow-2xl shadow-black/60">
              <div className="absolute inset-x-0 top-0 h-1 bg-red-600" />
              <img
                src="/images/businesses/jrs-auto-glass/logo.svg"
                alt="JR's Auto Glass"
                className="aspect-square w-full rounded-2xl object-contain"
              />
              <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                    One useful request
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-300">
                    Windshield replacement · Mobile service
                  </p>
                </div>
                <ShieldCheck className="h-6 w-6 flex-shrink-0 text-ts-orange" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-zinc-950">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-white/10 md:grid-cols-4">
          {["Ponchatoula, Louisiana", "Mobile auto glass", "Windshield replacement", "Protected Direct Connect"].map(
            (fact) => (
              <div
                key={fact}
                className="flex min-h-20 items-center justify-center bg-zinc-950 px-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-zinc-300"
              >
                {fact}
              </div>
            )
          )}
        </div>
      </section>

      <section id="request-details" className="scroll-mt-24 bg-[#0b0b0b] py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-red-500">
              Get a useful first answer
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white md:text-5xl">
              Give JR&apos;s the details the glass job actually depends on.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
              The better the first request, the less time gets wasted repeating vehicle and damage
              information.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {requestDetails.map(({ icon: Icon, title, body }, index) => (
              <article
                key={title}
                className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <span className="absolute right-4 top-3 text-4xl font-black text-white/[0.035]">
                  0{index + 1}
                </span>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/15 text-red-500">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#111111] py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="grid gap-8 md:grid-cols-[0.78fr_1.22fr] md:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-ts-orange">
                TradeScout CV
              </p>
              <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white md:text-5xl">
                Trust built from activity, not stars.
              </h2>
              <p className="mt-4 leading-7 text-zinc-400">
                CVS governs exposure and eligibility using identity, work outcomes,
                recommendations, and platform behavior.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                {
                  title: "Verified intent",
                  body: "Every request starts with the vehicle, the damage, and the work needed.",
                },
                {
                  title: "Work outcomes",
                  body: "Completed TradeScout activity strengthens the business CV over time.",
                },
                {
                  title: "Recommendations",
                  body: "Public recommendations are moderated and tied to TradeScout activity.",
                },
                {
                  title: "Protected connection",
                  body: "Contact opens after acceptance through Direct Connect.",
                },
              ].map((signal) => (
                <article
                  key={signal.title}
                  className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-white/10 bg-black/35 p-5"
                >
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-ts-orange" />
                  <div>
                    <h3 className="font-black text-white">{signal.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{signal.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {publicRecommendations.length > 0 ? (
            <div className="mt-10 border-t border-white/10 pt-9">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
                    Recommendation directory
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    Businesses JR&apos;s recommends
                  </h3>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Approved public TradeScout activity
                </p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {publicRecommendations.slice(0, 6).map((entry) => {
                  const content = (
                    <>
                      <p className="font-black text-white">{entry.contractor.companyName}</p>
                      {entry.projectType ? (
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-ts-orange">
                          {entry.projectType}
                        </p>
                      ) : null}
                      {entry.comment ? (
                        <p className="mt-3 text-sm leading-6 text-zinc-400">{entry.comment}</p>
                      ) : null}
                    </>
                  );

                  return entry.contractor.canonicalBusinessProfileUrl ? (
                    <Link
                      key={entry.id}
                      href={entry.contractor.canonicalBusinessProfileUrl}
                      className="rounded-2xl border border-white/10 bg-black/35 p-5 transition-colors hover:border-ts-orange/45"
                    >
                      {content}
                    </Link>
                  ) : (
                    <article key={entry.id} className="rounded-2xl border border-white/10 bg-black/35 p-5">
                      {content}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-y border-zinc-800 bg-zinc-950 py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-red-500">
              A better first step
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white md:text-5xl">
              Let JR&apos;s see the real job before you chase a generic quote.
            </h2>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {requestAdvantages.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-black/45 p-6">
                <Icon className="h-6 w-6 text-red-500" />
                <h3 className="mt-5 text-xl font-black text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#15100d] py-14 md:py-20">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(249,115,22,0.16),transparent_30%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-[1fr_auto] md:items-center md:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-ts-orange">
              TradeScout Direct Connect
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black uppercase leading-tight tracking-tight text-white md:text-5xl">
              Put the actual glass problem in front of JR&apos;s.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-zinc-300">
              Your contact information stays protected while the request goes to the business
              profile you chose.
            </p>
          </div>
          <Link
            href={requestHref}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ts-orange px-7 text-sm font-black text-white shadow-[0_16px_40px_rgba(249,115,22,0.22)] transition-colors hover:bg-ts-orange-dark"
          >
            Send details to JR&apos;s
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-center text-xs text-zinc-500 sm:flex-row sm:text-left md:px-8">
          <p className="font-bold uppercase tracking-[0.16em] text-zinc-300">
            JR&apos;s Auto Glass
          </p>
          <p className="inline-flex items-center gap-2">
            <FileText className="h-4 w-4 text-ts-orange" />
            Protected contact through TradeScout Direct Connect
          </p>
        </div>
      </footer>
    </main>
  );
}
