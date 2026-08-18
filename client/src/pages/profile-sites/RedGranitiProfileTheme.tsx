import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Factory,
  Globe2,
  Mail,
  MapPin,
  Mountain,
  PackageCheck,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import RedGranitiDirectConnectPanel, {
  type RedGranitiContactEntry,
} from "@/pages/profile-sites/RedGranitiDirectConnectPanel";
import { SafeProfileImg } from "@/pages/profile-sites/safeProfileImage";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";
import {
  RED_GRANITI_LOGO_URL,
  RED_GRANITI_PUBLIC_IDENTITY,
  RED_GRANITI_QUARRIES_URL,
} from "@shared/redGranitiProfile";
import {
  JW_STONE_PROFILE_SOCIAL_LOGO_URL,
  JW_STONE_PUBLIC_IDENTITY,
} from "@shared/jwStonePresentation";

type Props = {
  profileSlug: string;
  platformBaseHref?: string;
  profileShareDestination: string;
  hasViewerSession: boolean;
  businessAddress?: string | null;
  trustActions: ReactNode;
  profileItems?: ReactNode;
};

const CAPABILITY_ICONS = [Boxes, PackageCheck, Globe2] as const;

function externalLinkProps() {
  return {
    target: "_blank" as const,
    rel: "noreferrer noopener",
  };
}

export default function RedGranitiProfileTheme({
  profileSlug,
  platformBaseHref = "",
  profileShareDestination,
  trustActions,
  profileItems,
}: Props) {
  const identity = RED_GRANITI_PUBLIC_IDENTITY;
  const [contactOpen, setContactOpen] = useState(false);
  const [contactEntry, setContactEntry] = useState<RedGranitiContactEntry>("choice");
  const jwProfileHref = qualifyPublicProfileItemDestination(
    `/u/${identity.partnership.partnerProfileSlug}`,
    platformBaseHref
  );
  const homeHref = qualifyPublicProfileItemDestination("/", platformBaseHref);
  const pageStyle = {
    ["--red-ink" as string]: "#171313",
    ["--red-ink-soft" as string]: "#2b2323",
    ["--red-mark" as string]: "#d71920",
    ["--red-paper" as string]: "#f4f1ec",
    ["--red-surface" as string]: "#ffffff",
    ["--red-line" as string]: "rgba(23, 19, 19, 0.14)",
  } as CSSProperties;

  const openContact = (entry: RedGranitiContactEntry) => {
    setContactEntry(entry);
    setContactOpen(true);
  };

  return (
    <div
      className="min-h-screen overflow-x-clip bg-[var(--red-paper)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-[var(--red-ink)] sm:pb-0"
      style={pageStyle}
      data-testid="red-graniti-profile-theme"
    >
      <header
        className="sticky z-50 border-b border-black/10 bg-[rgba(244,241,236,0.94)] backdrop-blur-xl"
        style={{ top: "var(--ts-profile-top-offset, 0px)" }}
      >
        <div className="mx-auto flex min-h-20 max-w-[1560px] items-center gap-3 px-4 sm:px-7 lg:px-10">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-3"
            aria-label="R.E.D. Graniti profile home"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
              <img
                src={RED_GRANITI_LOGO_URL}
                alt=""
                className="h-10 w-10 rounded-full object-contain"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-black tracking-[-0.02em] sm:text-lg">
                {identity.brandName}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-black/55">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {identity.locationLabel}
              </span>
            </span>
          </a>

          <nav className="ml-auto hidden items-center gap-6 text-sm font-bold text-black/65 xl:flex">
            <a className="transition-colors hover:text-black" href="#company">
              Blocks & slabs
            </a>
            <a className="transition-colors hover:text-black" href="#operations">
              Operations
            </a>
            <a className="transition-colors hover:text-black" href="#quarries">
              Quarries
            </a>
            <a className="transition-colors hover:text-black" href="#partnership">
              First cut
            </a>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-6">
            <ShareButton
              destination={profileShareDestination}
              title={`${identity.brandName} | TradeScout`}
              text={`View ${identity.brandName}'s company profile on TradeScout.`}
              imageUrl={RED_GRANITI_LOGO_URL}
              className="hidden rounded-full border-black/15 bg-white text-black hover:bg-black hover:text-white lg:inline-flex"
            />
            <button
              type="button"
              onClick={() => openContact("choice")}
              data-testid="red-graniti-header-call"
              className="hidden min-h-11 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-black text-black transition-colors hover:bg-black hover:text-white sm:inline-flex"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call JW Stone
            </button>
            <button
              type="button"
              onClick={() => openContact("request")}
              data-testid="red-graniti-header-request"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--red-mark)] px-5 text-sm font-black text-white shadow-lg shadow-red-950/15 transition-transform hover:-translate-y-0.5"
            >
              Start a Request
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden bg-[var(--red-ink)] text-white">
          <SafeProfileImg
            src={identity.quarryHighlights[0].imageUrl}
            alt="R.E.D. Graniti natural stone source"
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 -z-20 h-full w-full object-cover opacity-60"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(90deg, rgba(16,12,12,0.98) 0%, rgba(20,15,15,0.9) 45%, rgba(20,15,15,0.46) 75%, rgba(20,15,15,0.72) 100%), linear-gradient(0deg, rgba(16,12,12,0.96) 0%, rgba(16,12,12,0.08) 58%, rgba(16,12,12,0.5) 100%)",
            }}
          />

          <div className="mx-auto grid min-h-[690px] max-w-[1560px] items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] lg:px-12 lg:py-24">
            <div className="max-w-5xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
                {identity.eyebrow}
              </p>
              <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-7xl xl:text-[6.15rem]">
                {identity.headline}
              </h1>
              <p className="mt-7 max-w-3xl text-base leading-8 text-white/82 sm:text-xl sm:leading-9">
                {identity.summary}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openContact("choice")}
                  data-testid="red-graniti-hero-call"
                  className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-black text-[var(--red-ink)] shadow-xl shadow-black/20 transition-transform hover:-translate-y-0.5"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call JW Stone
                </button>
                <button
                  type="button"
                  onClick={() => openContact("request")}
                  data-testid="red-graniti-hero-request"
                  className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-[var(--red-mark)] px-7 text-sm font-black text-white shadow-xl shadow-black/25 transition-transform hover:-translate-y-0.5"
                >
                  Start a Request
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <a
                  href={identity.officialLinks[0].href}
                  {...externalLinkProps()}
                  className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 text-sm font-black text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-black"
                >
                  Official website
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/20 bg-black/32 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
              <div className="flex items-center gap-4">
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
                  <img
                    src={RED_GRANITI_LOGO_URL}
                    alt={`${identity.brandName} logo`}
                    className="h-full w-full object-contain"
                  />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
                    Massa, Italy
                  </p>
                  <p className="mt-1 text-2xl font-black tracking-[-0.03em]">
                    {identity.legalName}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-4 border-t border-white/15 pt-6 text-sm text-white/75">
                <a
                  href={identity.headquarters.mapUrl}
                  {...externalLinkProps()}
                  className="flex items-start gap-3 transition-colors hover:text-white"
                >
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--red-mark)]" />
                  <span>
                    <strong className="block text-white">{identity.headquarters.label}</strong>
                    <span className="mt-1 block">{identity.headquarters.addressLine1}</span>
                    <span className="block">{identity.headquarters.addressLine2}</span>
                  </span>
                </a>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--red-mark)]" />
                  <span>
                    <strong className="block text-white">More than 50 years in stone</strong>
                    <span className="mt-1 block leading-6">
                      Company-owned quarries, controlled selection, slabs, and worldwide distribution.
                    </span>
                  </span>
                </div>
              </div>
            </aside>
          </div>

          <div className="border-t border-white/10 bg-black/30 backdrop-blur-md">
            <div className="mx-auto grid max-w-[1560px] grid-cols-2 divide-x divide-y divide-white/10 px-5 sm:px-8 lg:grid-cols-4 lg:divide-y-0 lg:px-12">
              {identity.stats.map((stat) => (
                <div key={stat.label} className="px-4 py-6 sm:px-6 lg:py-7">
                  <p className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-white/55">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="company" className="bg-[var(--red-paper)] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1480px]">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] lg:gap-20">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--red-mark)]">
                  Blocks, slabs, and distribution
                </p>
                <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                  Quality begins with control at the source.
                </h2>
                <p className="mt-7 max-w-4xl text-base leading-8 text-black/65 sm:text-lg sm:leading-9">
                  {identity.about}
                </p>
              </div>

              <div className="rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(23,19,19,0.08)] sm:p-9">
                <Mountain className="h-9 w-9 text-[var(--red-mark)]" aria-hidden="true" />
                <p className="mt-7 text-2xl font-black leading-9 tracking-[-0.03em]">
                  “{identity.qualityStatement}”
                </p>
              </div>
            </div>

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {identity.capabilities.map((capability, index) => {
                const Icon = CAPABILITY_ICONS[index] || Building2;
                return (
                  <article
                    key={capability.title}
                    className="group rounded-[1.75rem] border border-black/10 bg-white p-7 shadow-[0_18px_50px_rgba(23,19,19,0.055)] transition-transform hover:-translate-y-1 sm:p-8"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(215,25,32,0.09)] text-[var(--red-mark)]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <p className="mt-8 text-xs font-black uppercase tracking-[0.16em] text-black/40">
                      {capability.shortLabel}
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                      {capability.title}
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-black/60 sm:text-base">
                      {capability.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="operations" className="bg-[var(--red-ink)] px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1480px]">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--red-mark)]">
                  Italian operating footprint
                </p>
                <h2 className="mt-4 text-4xl font-black leading-[1.03] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                  Built for direct selection and dependable supply.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-white/62 sm:text-base">
                Major block yards and a dedicated slab warehouse support the path from quarry
                production to customer delivery.
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {identity.operatingLocations.map((location, index) => (
                <article
                  key={location.label}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-7 backdrop-blur-sm sm:p-8"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--red-mark)] text-white">
                      {index === 2 ? (
                        <Factory className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Building2 className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="text-xs font-black uppercase tracking-[0.15em] text-white/35">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-7 text-2xl font-black tracking-[-0.03em]">
                    {location.label}
                  </h3>
                  <p className="mt-2 text-sm font-bold text-[var(--red-mark)]">{location.location}</p>
                  <p className="mt-4 text-sm leading-7 text-white/62 sm:text-base">
                    {location.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="quarries" className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1480px]">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--red-mark)]">
                  Company-owned quarries
                </p>
                <h2 className="mt-4 text-4xl font-black leading-[1.03] tracking-[-0.045em] sm:text-5xl">
                  Stone sources across nine countries.
                </h2>
              </div>
              <div>
                <p className="max-w-3xl text-base leading-8 text-black/60">
                  R.E.D. Graniti owns quarries across Africa, the Americas, and Northern Europe.
                  Open the official source pages, then contact JW Stone for first-cut planning.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {identity.quarryCountries.map((country) => (
                    <span
                      key={country}
                      className="rounded-full border border-black/10 bg-[var(--red-paper)] px-4 py-2 text-xs font-bold text-black/70"
                    >
                      {country}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {identity.quarryHighlights.map((highlight) => (
                <article
                  key={highlight.id}
                  className="group relative min-h-[430px] overflow-hidden rounded-[1.75rem] bg-[var(--red-ink)] text-white shadow-[0_24px_70px_rgba(23,19,19,0.16)]"
                >
                  <SafeProfileImg
                    src={highlight.imageUrl}
                    alt={`R.E.D. Graniti source region in ${highlight.region}`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-78 transition-transform duration-700 group-hover:scale-105"
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/5" />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">
                      {highlight.region}
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                      {highlight.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-white/72">
                      {highlight.description}
                    </p>
                    <a
                      href={highlight.sourceUrl}
                      {...externalLinkProps()}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white underline decoration-white/35 underline-offset-4"
                    >
                      View official source
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={RED_GRANITI_QUARRIES_URL}
                {...externalLinkProps()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 text-sm font-black transition-colors hover:bg-black hover:text-white"
              >
                Official quarry directory
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => openContact("request")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--red-mark)] px-6 text-sm font-black text-white"
              >
                Ask about a R.E.D. material
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section id="partnership" className="bg-[var(--red-paper)] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[2.25rem] border border-black/10 bg-white shadow-[0_30px_90px_rgba(23,19,19,0.11)]">
            <div className="grid lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
              <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-[var(--red-ink)] p-10 text-white">
                <div aria-hidden="true" className="absolute -left-28 -top-24 h-80 w-80 rounded-full bg-[rgba(215,25,32,0.35)] blur-3xl" />
                <div className="relative flex items-center gap-5 sm:gap-8">
                  <span className="flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-white p-3 shadow-2xl sm:h-32 sm:w-32">
                    <img
                      src={RED_GRANITI_LOGO_URL}
                      alt={`${identity.brandName} logo`}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <ArrowRight className="h-8 w-8 text-[var(--red-mark)]" aria-hidden="true" />
                  <span className="flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-white p-4 shadow-2xl sm:h-32 sm:w-32">
                    <img
                      src={JW_STONE_PROFILE_SOCIAL_LOGO_URL}
                      alt={`${JW_STONE_PUBLIC_IDENTITY.brandName} logo`}
                      className="h-full w-full object-contain"
                    />
                  </span>
                </div>
              </div>

              <div className="p-7 sm:p-10 lg:p-14">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(215,25,32,0.25)] bg-[rgba(215,25,32,0.06)] px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-[var(--red-mark)]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {identity.partnership.relationshipLabel}
                </div>
                <h2 className="mt-6 max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.045em] sm:text-5xl">
                  {identity.partnership.headline}
                </h2>
                <p className="mt-6 max-w-3xl text-base leading-8 text-black/65 sm:text-lg">
                  {identity.partnership.description}
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    ["1", "Choose the R.E.D. material"],
                    ["2", "Share format, size, and quantity"],
                    ["3", "Confirm destination and timing"],
                  ].map(([step, value]) => (
                    <div key={step} className="rounded-2xl border border-black/10 bg-[var(--red-paper)] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--red-mark)]">
                        Step {step}
                      </p>
                      <p className="mt-2 text-sm font-black leading-6">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openContact("choice")}
                    data-testid="red-graniti-partnership-call"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 text-sm font-black text-black transition-colors hover:bg-black hover:text-white"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Call JW Stone
                  </button>
                  <button
                    type="button"
                    onClick={() => openContact("request")}
                    data-testid="red-graniti-partnership-request"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--red-mark)] px-6 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
                  >
                    Start a Request
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <a
                    href={jwProfileHref}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 px-6 text-sm font-black transition-colors hover:bg-black hover:text-white"
                  >
                    View JW Stone
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {profileItems ? (
          <section className="bg-white px-5 py-16 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-[1480px]">{profileItems}</div>
          </section>
        ) : null}

        <section className="bg-white px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="mx-auto grid max-w-[1480px] gap-7 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--red-mark)]">
                Profile actions
              </p>
              <h2 className="mt-4 text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-4xl">
                Save or share R.E.D. Graniti.
              </h2>
            </div>
            <div className="rounded-[1.75rem] border border-black/10 bg-[var(--red-paper)] p-5 sm:p-6">
              {trustActions}
            </div>
          </div>
        </section>

        <section className="bg-[var(--red-ink)] px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto grid max-w-[1480px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.62fr)] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--red-mark)]">
                R.E.D. Graniti headquarters
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                {identity.legalName}
              </h2>
              <a
                href={identity.headquarters.mapUrl}
                {...externalLinkProps()}
                className="mt-7 inline-flex items-start gap-3 text-white/75 transition-colors hover:text-white"
              >
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--red-mark)]" />
                <span>
                  <strong className="block text-white">{identity.headquarters.label}</strong>
                  <span className="mt-1 block">{identity.headquarters.addressLine1}</span>
                  <span className="block">{identity.headquarters.addressLine2}</span>
                </span>
              </a>
              <div className="mt-6 flex flex-col gap-3 text-sm text-white/72">
                <a className="inline-flex items-center gap-3 hover:text-white" href="tel:+39058588471">
                  <Phone className="h-4 w-4 text-[var(--red-mark)]" />
                  {identity.headquarters.phone}
                </a>
                <a className="inline-flex items-center gap-3 hover:text-white" href={`mailto:${identity.headquarters.email}`}>
                  <Mail className="h-4 w-4 text-[var(--red-mark)]" />
                  {identity.headquarters.email}
                </a>
              </div>
              <p className="mt-5 text-sm text-white/45">{identity.legalId}</p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Official R.E.D. Graniti links
              </p>
              <div className="mt-5 divide-y divide-white/10">
                {identity.officialLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    {...externalLinkProps()}
                    className="flex items-center justify-between gap-4 py-4 text-sm font-bold text-white/75 transition-colors hover:text-white"
                  >
                    {link.label}
                    <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openContact("choice")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-black text-white"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call JW Stone
                </button>
                <button
                  type="button"
                  onClick={() => openContact("request")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--red-mark)] px-5 text-sm font-black text-white"
                >
                  Start a Request
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <TradeScoutProfileHandoff
        profileSlug={profileSlug}
        profileName={identity.brandName}
        platformBaseHref={platformBaseHref}
      />

      <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-black/10 bg-[rgba(244,241,236,0.96)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openContact("choice")}
            data-testid="red-graniti-mobile-call"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm font-black text-black"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call JW Stone
          </button>
          <button
            type="button"
            onClick={() => openContact("request")}
            data-testid="red-graniti-mobile-request"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--red-mark)] px-4 text-sm font-black text-white"
          >
            Start a Request
          </button>
        </div>
      </div>

      <RedGranitiDirectConnectPanel
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        initialView={contactEntry}
        platformBaseHref={platformBaseHref}
      />

      <a
        href={homeHref}
        className="sr-only focus:not-sr-only focus:fixed focus:bottom-24 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-black focus:px-4 focus:py-3 focus:text-white"
      >
        Return to TradeScout
      </a>
    </div>
  );
}
