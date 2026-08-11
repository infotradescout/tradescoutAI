import type { ComponentType, ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  ChartNoAxesCombined,
  CircleCheck,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { SafeProfileImg } from "@/pages/profile-sites/safeProfileImage";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";

type Props = {
  profileSlug: string;
  platformBaseHref?: string;
  businessName: string;
  headline?: string | null;
  contentBlocks: unknown;
  services: string[];
  serviceAreas: string[];
  aboutText?: string | null;
  profileShareDestination: string;
  onDirectConnect: (serviceName?: string) => void;
  trustActions: ReactNode;
  profileItems?: ReactNode;
};

type FocusArea = { eyebrow: string; title: string; body: string };
type ProcessStep = { step: string; detail: string };
type Principle = { title: string; body: string };
type SourceLink = { label: string; url: string };

type FinancialAdvisorProfileData = {
  companyName: string;
  roleLine: string;
  locationLabel: string;
  heroTitle: string;
  heroText: string;
  portraitUrl: string;
  portraitAlt: string;
  focusAreas: FocusArea[];
  process: ProcessStep[];
  biography: string[];
  principles: Principle[];
  sourceBasis: SourceLink[];
  disclosure: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cards<T extends Record<string, string>>(
  value: unknown,
  keys: Array<keyof T>
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => record(item))
    .map((item) =>
      Object.fromEntries(keys.map((key) => [key, text(item[String(key)])])) as T
    )
    .filter((item) => keys.every((key) => Boolean(item[key])));
}

function safeSourceUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function readFinancialAdvisorProfile(contentBlocks: unknown): FinancialAdvisorProfileData {
  const blocks = Array.isArray(contentBlocks) ? contentBlocks : [];
  const block = blocks.find((entry) => record(entry).type === "financialAdvisorProfile");
  const data = record(record(block).data);
  return {
    companyName: text(data.companyName),
    roleLine: text(data.roleLine),
    locationLabel: text(data.locationLabel),
    heroTitle: text(data.heroTitle),
    heroText: text(data.heroText),
    portraitUrl: text(data.portraitUrl),
    portraitAlt: text(data.portraitAlt),
    focusAreas: cards<FocusArea>(data.focusAreas, ["eyebrow", "title", "body"]),
    process: cards<ProcessStep>(data.process, ["step", "detail"]),
    biography: Array.isArray(data.biography)
      ? data.biography.map(text).filter(Boolean)
      : [],
    principles: cards<Principle>(data.principles, ["title", "body"]),
    sourceBasis: cards<SourceLink>(data.sourceBasis, ["label", "url"])
      .map((source) => ({ ...source, url: safeSourceUrl(source.url) }))
      .filter((source) => source.url),
    disclosure: text(data.disclosure),
  };
}

const focusIcons: Array<ComponentType<{ className?: string }>> = [
  CalendarClock,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ShieldCheck,
];

export default function FinancialAdvisorProfileTheme({
  profileSlug,
  platformBaseHref = "",
  businessName,
  headline,
  contentBlocks,
  services,
  serviceAreas,
  aboutText,
  profileShareDestination,
  onDirectConnect,
  trustActions,
  profileItems,
}: Props) {
  const profile = readFinancialAdvisorProfile(contentBlocks);
  const companyName = profile.companyName || "Financial Planning";
  const roleLine = profile.roleLine || headline?.trim() || "Financial Advisor";
  const locationLabel = profile.locationLabel || serviceAreas[0] || "";
  const heroTitle = profile.heroTitle || "Build wealth with intention. Protect the life around it.";
  const heroText = profile.heroText || aboutText?.trim() || headline?.trim() || "";
  const focusAreas =
    profile.focusAreas.length > 0
      ? profile.focusAreas
      : services.map((service, index) => ({
          eyebrow: String(index + 1).padStart(2, "0"),
          title: service,
          body: "Start a focused conversation about this planning priority.",
        }));

  return (
    <div
      className="min-h-screen overflow-hidden bg-[#f4f0e6] text-[#18362f]"
      data-testid="financial-advisor-profile"
      style={{ fontFamily: '"Sora", sans-serif' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Sora:wght@300;400;500;600;700&display=swap');
        .advisor-serif { font-family: "Cormorant Garamond", serif; }
        .advisor-grid { background-image: linear-gradient(rgba(219,190,119,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(219,190,119,.1) 1px, transparent 1px); background-size: 48px 48px; }
        .advisor-rise { animation: advisor-rise .75s cubic-bezier(.2,.7,.2,1) both; }
        .advisor-orbit { animation: advisor-orbit 18s linear infinite; }
        @keyframes advisor-rise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes advisor-orbit { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .advisor-rise, .advisor-orbit { animation: none; } }
      `}</style>

      <section className="advisor-grid relative isolate overflow-hidden bg-[#0d2f2a] text-[#fbf7ed]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_79%_24%,rgba(207,165,83,.28),transparent_27%),radial-gradient(circle_at_12%_90%,rgba(74,132,112,.28),transparent_32%),linear-gradient(115deg,rgba(5,25,22,.1),rgba(5,25,22,.72))]" />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-4 border-b border-[#dbbe77]/20 px-5 py-5 sm:px-8">
          <a href={profileShareDestination} className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#dbbe77]/50 text-xs font-bold tracking-[0.16em] text-[#dbbe77]">
              DD
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-[-0.02em]">{businessName}</span>
              <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.2em] text-[#dbbe77]/75 sm:block">
                {roleLine}
              </span>
            </span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <ShareButton
              destination={profileShareDestination}
              title={`${businessName} | ${roleLine}`}
              text={heroText}
              imageUrl={profile.portraitUrl}
              variant="outline"
              label="Share"
              className="hidden min-h-11 border-[#dbbe77]/35 bg-transparent text-[#fbf7ed] hover:bg-white/10 hover:text-white sm:inline-flex"
            />
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#d5ac5a] px-4 text-sm font-bold text-[#0d2f2a] transition hover:bg-[#efd38f] sm:px-5"
            >
              <MessageCircle className="h-4 w-4" />
              Contact Dean
            </button>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-14 px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(330px,.72fr)] lg:items-center lg:gap-20 lg:pb-28">
          <div className="advisor-rise max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#dbbe77]">
              <span>{roleLine}</span>
              {locationLabel ? (
                <span className="inline-flex items-center gap-1.5 text-[#fbf7ed]/58">
                  <MapPin className="h-3.5 w-3.5" />
                  {locationLabel}
                </span>
              ) : null}
            </div>
            <h1 className="advisor-serif mt-7 max-w-4xl text-[3.7rem] font-medium leading-[0.88] tracking-[-0.045em] sm:text-7xl lg:text-[6.5rem]">
              {heroTitle}
            </h1>
            {heroText ? (
              <p className="mt-7 max-w-2xl text-base font-light leading-7 text-[#fbf7ed]/72 sm:text-lg sm:leading-8">{heroText}</p>
            ) : null}
            <div className="mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onDirectConnect()}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#fbf7ed] px-5 text-sm font-bold text-[#17362f] transition hover:bg-white"
              >
                Start a conversation
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <a
                href="#planning-focus"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#dbbe77]/35 px-5 text-sm font-semibold text-[#fbf7ed] transition hover:bg-white/10"
              >
                Explore planning priorities
                <ArrowDownRight className="h-4 w-4 text-[#dbbe77]" />
              </a>
            </div>
          </div>

          <div className="advisor-rise relative mx-auto w-full max-w-[430px]" style={{ animationDelay: "120ms" }}>
            <div className="advisor-orbit absolute -inset-8 rounded-full border border-dashed border-[#dbbe77]/25" />
            <div className="absolute -inset-3 rounded-[45%_45%_1.75rem_1.75rem] border border-[#dbbe77]/25" />
            <div className="relative overflow-hidden rounded-[45%_45%_1.4rem_1.4rem] border border-[#dbbe77]/45 bg-[#e8dcc0] p-2 shadow-2xl shadow-black/30">
              {profile.portraitUrl ? (
                <SafeProfileImg
                  src={profile.portraitUrl}
                  alt={profile.portraitAlt || businessName}
                  className="aspect-[4/5] w-full rounded-[44%_44%_1rem_1rem] object-cover object-top"
                />
              ) : (
                <div className="grid aspect-[4/5] place-items-center rounded-[44%_44%_1rem_1rem] bg-[#d8c18e] text-7xl font-bold text-[#17362f]">DD</div>
              )}
              <div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/25 bg-[#0d2f2a]/92 p-4 text-[#fbf7ed] backdrop-blur-sm">
                <p className="text-sm font-semibold">{businessName}</p>
                <p className="mt-1 text-xs leading-5 text-[#fbf7ed]/62">{roleLine}</p>
              </div>
            </div>
          </div>
        </div>

        {profile.process.length > 0 ? (
          <div className="relative z-10 border-t border-[#dbbe77]/20 bg-black/10">
            <div className="mx-auto grid max-w-7xl sm:grid-cols-2 lg:grid-cols-4">
              {profile.process.map((step, index) => (
                <div key={step.step} className="border-b border-[#dbbe77]/15 px-5 py-6 sm:border-r sm:px-8 lg:border-b-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d5ac5a]">0{index + 1} / {step.step}</p>
                  <p className="mt-2 text-sm font-light leading-6 text-[#fbf7ed]/66">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <main>
        <section id="planning-focus" className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="pointer-events-none absolute right-0 top-4 select-none text-[9rem] font-bold leading-none text-[#17362f]/[0.035] sm:text-[15rem]">04</div>
          <div className="relative grid gap-10 lg:grid-cols-[.66fr_1.34fr]">
            <div className="lg:sticky lg:top-8 lg:self-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#936627]">Planning priorities</p>
              <h2 className="advisor-serif mt-4 text-5xl font-medium leading-[0.92] tracking-[-0.035em] sm:text-6xl">
                One life. One business. One connected plan.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-[#17362f]/65">
                Financial decisions overlap. Dean's work brings four essential planning conversations into the same view.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {focusAreas.map((area, index) => {
                const Icon = focusIcons[index % focusIcons.length];
                return (
                  <article key={`${area.title}-${index}`} className="group relative overflow-hidden rounded-[1.75rem] border border-[#17362f]/12 bg-[#fbf8f0] p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#17362f]/10 sm:p-8">
                    <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-[#d5ac5a]/10 transition group-hover:bg-[#d5ac5a]/18" />
                    <div className="relative flex items-center justify-between gap-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#936627]">{area.eyebrow}</p>
                      <Icon className="h-5 w-5 text-[#17362f]/45" />
                    </div>
                    <h3 className="advisor-serif relative mt-8 text-3xl font-semibold leading-none">{area.title}</h3>
                    <p className="relative mt-4 text-sm leading-6 text-[#17362f]/64">{area.body}</p>
                    <button
                      type="button"
                      onClick={() => onDirectConnect(area.title)}
                      className="relative mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#17362f]"
                    >
                      Discuss this
                      <ArrowUpRight className="h-4 w-4 text-[#936627]" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#d9c79f] px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-[#17362f] text-[#fbf7ed] lg:grid-cols-[.85fr_1.15fr]">
            <div className="relative min-h-[420px] overflow-hidden bg-[#0d2f2a] p-8 sm:p-12 lg:min-h-[610px] lg:p-14">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(213,172,90,.18),transparent_46%)]" />
              <div className="absolute inset-10 rounded-full border border-[#d5ac5a]/20" />
              <div className="absolute inset-20 rounded-full border border-[#d5ac5a]/20" />
              <div className="absolute inset-32 rounded-full border border-[#d5ac5a]/25" />
              <div className="relative flex h-full min-h-[350px] flex-col justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d5ac5a]">A connected financial picture</p>
                <div className="space-y-4">
                  {["What are you building?", "What must it support?", "What needs protection?"].map((question, index) => (
                    <div key={question} className="flex items-center gap-3 border-b border-[#d5ac5a]/20 pb-4">
                      <span className="text-xs font-semibold text-[#d5ac5a]">0{index + 1}</span>
                      <span className="advisor-serif text-2xl font-medium sm:text-3xl">{question}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-7 sm:p-12 lg:p-16">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d9c79f]">The conversation</p>
              <h2 className="advisor-serif mt-4 text-5xl font-medium leading-[0.94] sm:text-6xl">
                Financial planning should feel personal, not prepackaged.
              </h2>
              <div className="mt-8 space-y-5 text-sm font-light leading-7 text-[#fbf7ed]/70 sm:text-base">
                {(profile.biography.length > 0 ? profile.biography : [aboutText || heroText]).filter(Boolean).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {profile.principles.length > 0 ? (
                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  {profile.principles.map((principle) => (
                    <div key={principle.title} className="border-t border-[#d9c79f]/35 pt-4">
                      <p className="text-sm font-semibold text-[#fbf7ed]">{principle.title}</p>
                      <p className="mt-2 text-xs leading-5 text-[#fbf7ed]/58">{principle.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <div className="flex items-center gap-3">
              <CircleCheck className="h-5 w-5 text-[#936627]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#936627]">Trust and profile details</p>
            </div>
            <div className="mt-5 rounded-3xl border border-[#17362f]/15 bg-white/55 p-5 sm:p-7">
              <div data-testid="profile-trust-section" aria-label="Trust and profile actions">{trustActions}</div>
            </div>
            {profileItems ? <div className="mt-5">{profileItems}</div> : null}
          </div>

          <div className="rounded-3xl border border-[#17362f]/15 bg-[#ebe2cf] p-7 sm:p-9">
            <ShieldCheck className="h-7 w-7 text-[#936627]" />
            <h2 className="advisor-serif mt-6 text-4xl font-semibold leading-none">Clear scope. No guesswork.</h2>
            <p className="mt-5 text-sm leading-6 text-[#17362f]/65">
              Start with a conversation about your priorities. Confirm services, professional affiliations, registrations, and availability directly with Dean before acting.
            </p>
            {profile.sourceBasis.length > 0 ? (
              <ul className="mt-7 space-y-3">
                {profile.sourceBasis.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-4 border-b border-[#17362f]/15 pb-3 text-sm font-semibold">
                      <span>{source.label}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#936627] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {profile.disclosure ? <p className="mt-8 text-[11px] leading-5 text-[#17362f]/55">{profile.disclosure}</p> : null}
          </div>
        </section>

        <section className="advisor-grid bg-[#0d2f2a] px-5 py-14 text-[#fbf7ed] sm:px-8 sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d9c79f]">Start with what matters</p>
              <h2 className="advisor-serif mt-3 max-w-3xl text-5xl font-medium leading-[0.92] sm:text-6xl">
                Bring Dean the goal, the concern, or the decision you need to make clearer.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#d5ac5a] px-6 text-sm font-bold text-[#0d2f2a] transition hover:bg-[#efd38f]"
            >
              <MessageCircle className="h-5 w-5" />
              Contact Dean
            </button>
          </div>
        </section>
      </main>

      <TradeScoutProfileHandoff profileSlug={profileSlug} profileName={businessName} platformBaseHref={platformBaseHref} />
    </div>
  );
}
