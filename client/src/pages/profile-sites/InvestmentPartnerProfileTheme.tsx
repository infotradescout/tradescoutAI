import type { ComponentType, ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  Compass,
  Handshake,
  MapPin,
  MessageCircle,
  Search,
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

type InvestmentProfileData = {
  companyName: string;
  roleLine: string;
  locationLabel: string;
  heroTitle: string;
  heroText: string;
  portraitUrl: string;
  portraitAlt: string;
  architectureImageUrl: string;
  architectureImageAlt: string;
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

function readInvestmentProfile(contentBlocks: unknown): InvestmentProfileData {
  const blocks = Array.isArray(contentBlocks) ? contentBlocks : [];
  const block = blocks.find((entry) => record(entry).type === "investmentProfile");
  const data = record(record(block).data);
  return {
    companyName: text(data.companyName),
    roleLine: text(data.roleLine),
    locationLabel: text(data.locationLabel),
    heroTitle: text(data.heroTitle),
    heroText: text(data.heroText),
    portraitUrl: text(data.portraitUrl),
    portraitAlt: text(data.portraitAlt),
    architectureImageUrl: text(data.architectureImageUrl),
    architectureImageAlt: text(data.architectureImageAlt),
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
  Search,
  ChartNoAxesCombined,
  Handshake,
  Compass,
];

export default function InvestmentPartnerProfileTheme({
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
  const profile = readInvestmentProfile(contentBlocks);
  const companyName = profile.companyName || businessName;
  const roleLine = profile.roleLine || headline?.trim() || "Investment and acquisitions";
  const locationLabel = profile.locationLabel || serviceAreas[0] || "";
  const heroTitle = profile.heroTitle || `${businessName} - disciplined decisions, clearly made.`;
  const heroText = profile.heroText || aboutText?.trim() || headline?.trim() || "";
  const focusAreas =
    profile.focusAreas.length > 0
      ? profile.focusAreas
      : services.map((service, index) => ({
          eyebrow: String(index + 1).padStart(2, "0"),
          title: service,
          body: "Start a focused conversation about this area.",
        }));

  return (
    <div
      className="min-h-screen overflow-hidden bg-[#f3f0e7] text-[#17362f]"
      data-testid="investment-partner-profile"
      style={{ fontFamily: '"Manrope", sans-serif' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap');
        .investment-serif { font-family: "Instrument Serif", serif; }
        .investment-grid { background-image: linear-gradient(rgba(221,205,170,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(221,205,170,.12) 1px, transparent 1px); background-size: 44px 44px; }
        .investment-rise { animation: investment-rise .72s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes investment-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .investment-rise { animation: none; } }
      `}</style>

      <section className="investment-grid relative isolate overflow-hidden bg-[#102e29] text-[#f8f3e7]">
        {profile.architectureImageUrl ? (
          <SafeProfileImg
            src={profile.architectureImageUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-full object-cover opacity-[0.16] mix-blend-luminosity lg:w-[62%]"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(190,144,72,.25),transparent_36%),linear-gradient(90deg,#102e29_0%,rgba(16,46,41,.96)_48%,rgba(16,46,41,.62)_100%)]" />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-4 border-b border-[#ddcdaa]/20 px-5 py-5 sm:px-8">
          <a href={profileShareDestination} className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ddcdaa]/45 text-xs font-extrabold tracking-[0.15em] text-[#ddcdaa]">
              DD
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-[-0.02em]">
                {businessName}
              </span>
              <span className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ddcdaa]/75 sm:block">
                {companyName}
              </span>
            </span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <ShareButton
              destination={profileShareDestination}
              title={`${businessName} | ${companyName}`}
              text={heroText}
              imageUrl={profile.architectureImageUrl || profile.portraitUrl}
              variant="outline"
              label="Share"
              className="hidden min-h-11 border-[#ddcdaa]/35 bg-transparent text-[#f8f3e7] hover:bg-[#f8f3e7]/10 hover:text-white sm:inline-flex"
            />
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#c8954f] px-4 text-sm font-extrabold text-[#102e29] transition hover:bg-[#ddbd82] sm:px-5"
            >
              <MessageCircle className="h-4 w-4" />
              Contact Dean
            </button>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-12 px-5 pb-12 pt-14 sm:px-8 sm:pb-16 sm:pt-20 lg:grid-cols-[minmax(0,1.12fr)_minmax(330px,.68fr)] lg:items-end lg:gap-16 lg:pb-24">
          <div className="investment-rise max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ddcdaa]">
              <span>{roleLine}</span>
              {locationLabel ? (
                <span className="inline-flex items-center gap-1.5 text-[#f8f3e7]/60">
                  <MapPin className="h-3.5 w-3.5" />
                  {locationLabel}
                </span>
              ) : null}
            </div>
            <h1 className="investment-serif mt-6 max-w-4xl text-[3.35rem] leading-[0.92] tracking-[-0.045em] sm:text-7xl lg:text-[6.4rem]">
              {heroTitle}
            </h1>
            {heroText ? (
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#f8f3e7]/72 sm:text-lg sm:leading-8">
                {heroText}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onDirectConnect()}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#f8f3e7] px-5 text-sm font-extrabold text-[#17362f] transition hover:bg-white"
              >
                Start a conversation
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <a
                href="#focus"
                className="inline-flex min-h-12 items-center rounded-full border border-[#ddcdaa]/35 px-5 text-sm font-bold text-[#f8f3e7] transition hover:bg-[#f8f3e7]/10"
              >
                See the acquisition focus
              </a>
            </div>
          </div>

          <div
            className="investment-rise relative mx-auto w-full max-w-md"
            style={{ animationDelay: "120ms" }}
          >
            <div className="absolute -inset-3 rounded-[2rem] border border-[#ddcdaa]/20" />
            <div className="relative overflow-hidden rounded-[1.55rem] border border-[#ddcdaa]/35 bg-[#e7ddc7] p-2 shadow-2xl shadow-black/25">
              {profile.portraitUrl ? (
                <SafeProfileImg
                  src={profile.portraitUrl}
                  fallbackSrcs={profile.architectureImageUrl ? [profile.architectureImageUrl] : []}
                  alt={profile.portraitAlt || businessName}
                  className="aspect-[4/5] w-full rounded-[1.15rem] object-cover object-top"
                />
              ) : (
                <div className="grid aspect-[4/5] place-items-center rounded-[1.15rem] bg-[#d7c49f] text-7xl font-black text-[#17362f]">
                  DD
                </div>
              )}
              <div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/30 bg-[#102e29]/90 p-4 text-[#f8f3e7] backdrop-blur-sm">
                <p className="text-sm font-extrabold">{businessName}</p>
                <p className="mt-1 text-xs leading-5 text-[#f8f3e7]/65">{roleLine}</p>
              </div>
            </div>
          </div>
        </div>

        {profile.process.length > 0 ? (
          <div className="relative z-10 border-t border-[#ddcdaa]/20 bg-black/10">
            <div className="mx-auto grid max-w-7xl sm:grid-cols-2 lg:grid-cols-4">
              {profile.process.map((step, index) => (
                <div
                  key={step.step}
                  className="border-b border-[#ddcdaa]/15 px-5 py-6 sm:border-r sm:px-8 lg:border-b-0"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c8954f]">
                    0{index + 1} / {step.step}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#f8f3e7]/66">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <main>
        <section id="focus" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[.68fr_1.32fr]">
            <div className="lg:sticky lg:top-8 lg:self-start">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#9b6a2d]">
                The acquisition mandate
              </p>
              <h2 className="investment-serif mt-4 text-5xl leading-[0.95] tracking-[-0.035em] sm:text-6xl">
                Make the details earn the decision.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-[#17362f]/68">
                Dean's documented role covers the full acquisition path, from finding an opportunity
                to coordinating the relationships and decisions that move it through the cycle.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-3xl border border-[#17362f]/15 bg-[#17362f]/15 sm:grid-cols-2">
              {focusAreas.map((area, index) => {
                const Icon = focusIcons[index % focusIcons.length];
                return (
                  <article key={`${area.title}-${index}`} className="group bg-[#f8f5ed] p-7 sm:p-8">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a2d]">
                        {area.eyebrow}
                      </p>
                      <Icon className="h-5 w-5 text-[#17362f]/38 transition group-hover:text-[#9b6a2d]" />
                    </div>
                    <h3 className="investment-serif mt-8 text-3xl leading-none">{area.title}</h3>
                    <p className="mt-4 text-sm leading-6 text-[#17362f]/65">{area.body}</p>
                    <button
                      type="button"
                      onClick={() => onDirectConnect(area.title)}
                      className="mt-7 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#17362f]"
                    >
                      Discuss this
                      <ArrowUpRight className="h-4 w-4 text-[#9b6a2d]" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#d8c8a8] px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-[#17362f] text-[#f8f3e7] lg:grid-cols-[.9fr_1.1fr]">
            <div className="relative min-h-[360px] overflow-hidden lg:min-h-[620px]">
              {profile.architectureImageUrl ? (
                <SafeProfileImg
                  src={profile.architectureImageUrl}
                  alt={profile.architectureImageAlt || "Multifamily architecture"}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-[#17362f]/70 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 border-l-2 border-[#d8c8a8] pl-4 text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                Multifamily focus / full-cycle discipline
              </div>
            </div>
            <div className="p-7 sm:p-12 lg:p-16">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d8c8a8]">
                The operator's lens
              </p>
              <h2 className="investment-serif mt-4 text-5xl leading-[0.96] sm:text-6xl">
                Systems thinking, applied to real assets.
              </h2>
              <div className="mt-8 space-y-5 text-sm leading-7 text-[#f8f3e7]/70 sm:text-base">
                {(profile.biography.length > 0 ? profile.biography : [aboutText || heroText])
                  .filter(Boolean)
                  .map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
              </div>
              {profile.principles.length > 0 ? (
                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  {profile.principles.map((principle) => (
                    <div key={principle.title} className="border-t border-[#d8c8a8]/35 pt-4">
                      <p className="text-sm font-extrabold text-[#f8f3e7]">{principle.title}</p>
                      <p className="mt-2 text-xs leading-5 text-[#f8f3e7]/58">{principle.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#9b6a2d]" />
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#9b6a2d]">
                Trust and public record
              </p>
            </div>
            <div className="mt-5 rounded-3xl border border-[#17362f]/15 bg-white/55 p-5 sm:p-7">
              <div data-testid="profile-trust-section" aria-label="Trust and profile actions">
                {trustActions}
              </div>
            </div>
            {profileItems ? <div className="mt-5">{profileItems}</div> : null}
          </div>

          <div className="rounded-3xl border border-[#17362f]/15 bg-[#ebe4d4] p-7 sm:p-9">
            <Building2 className="h-7 w-7 text-[#9b6a2d]" />
            <h2 className="investment-serif mt-6 text-4xl leading-none">Sources and scope</h2>
            {profile.sourceBasis.length > 0 ? (
              <ul className="mt-7 space-y-3">
                {profile.sourceBasis.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between gap-4 border-b border-[#17362f]/15 pb-3 text-sm font-bold"
                    >
                      <span>{source.label}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#9b6a2d] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {profile.disclosure ? (
              <p className="mt-8 text-[11px] leading-5 text-[#17362f]/58">{profile.disclosure}</p>
            ) : null}
          </div>
        </section>

        <section className="bg-[#102e29] px-5 py-14 text-[#f8f3e7] sm:px-8 sm:py-18">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d8c8a8]">
                Start with the opportunity
              </p>
              <h2 className="investment-serif mt-3 max-w-3xl text-5xl leading-[0.95] sm:text-6xl">
                Bring Dean the deal, the question, or the relationship worth building.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#c8954f] px-6 text-sm font-extrabold text-[#102e29] transition hover:bg-[#ddbd82]"
            >
              <MessageCircle className="h-5 w-5" />
              Contact Dean
            </button>
          </div>
        </section>
      </main>

      <TradeScoutProfileHandoff
        profileSlug={profileSlug}
        profileName={businessName}
        platformBaseHref={platformBaseHref}
      />
    </div>
  );
}
