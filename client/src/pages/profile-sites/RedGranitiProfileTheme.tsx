import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  Boxes,
  Building2,
  Factory,
  Globe2,
  Mail,
  MapPin,
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
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";

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
  const [contactEntry, setContactEntry] = useState<RedGranitiContactEntry>("request");
  const jwProfileHref = qualifyPublicProfileItemDestination(
    `/u/${identity.partnership.partnerProfileSlug}`,
    platformBaseHref
  );
  const homeHref = qualifyPublicProfileItemDestination("/", platformBaseHref);
  const pageStyle = {
    ["--red-ink" as string]: "#1c1818",
    ["--red-mark" as string]: "#d71920",
    ["--red-paper" as string]: "#f3f1ed",
    ["--red-surface" as string]: "#ffffff",
    ["--red-line" as string]: "rgba(28, 24, 24, 0.13)",
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
      <main id="top">
        <section
          className="relative h-56 overflow-hidden bg-stone-900 sm:h-64 lg:h-72"
          data-testid="red-graniti-cover"
          aria-label="R.E.D. Graniti quarry cover image"
        >
          <SafeProfileImg
            src={identity.quarryHighlights[0].imageUrl}
            alt="R.E.D. Graniti quarry and natural stone"
            loading="eager"
            fetchPriority="high"
            className="h-full w-full object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent"
          />
        </section>

        <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <section
            className="relative z-10 -mt-14 rounded-2xl border border-[var(--red-line)] bg-white p-5 shadow-[0_18px_55px_rgba(28,24,24,0.12)] sm:-mt-16 sm:p-7"
            data-testid="red-graniti-profile-identity"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white p-2 shadow-md sm:h-28 sm:w-28">
                <img
                  src={RED_GRANITI_LOGO_URL}
                  alt={`${identity.brandName} logo`}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--red-mark)]">
                  {identity.profileLabel}
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                  {identity.brandName}
                </h1>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-black/58">
                  <MapPin className="h-4 w-4 text-[var(--red-mark)]" aria-hidden="true" />
                  {identity.locationLabel}
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-black/66 sm:text-base">
                  {identity.summary}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-black/10 pt-5 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => openContact("call")}
                data-testid="red-graniti-primary-call"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-6 text-sm font-black text-black transition-colors hover:bg-black hover:text-white"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call
              </button>
              <button
                type="button"
                onClick={() => openContact("request")}
                data-testid="red-graniti-primary-request"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--red-mark)] px-6 text-sm font-black text-white transition-opacity hover:opacity-90"
              >
                Start a Request
              </button>
              <ShareButton
                destination={profileShareDestination}
                title={`${identity.brandName} | TradeScout`}
                text={`View ${identity.brandName}'s TradeScout profile.`}
                imageUrl={RED_GRANITI_LOGO_URL}
                className="min-h-12 rounded-full border-black/15 bg-white px-5 text-black hover:bg-black hover:text-white"
              />
              <a
                href={identity.officialLinks[0].href}
                {...externalLinkProps()}
                className="inline-flex min-h-12 items-center justify-center gap-2 px-2 text-sm font-black text-black/65 underline decoration-black/25 underline-offset-4 hover:text-black"
              >
                Official website
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </section>

          <div className="mt-6 grid gap-6 pb-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="space-y-6">
              <section
                id="about"
                className="rounded-2xl border border-[var(--red-line)] bg-white p-6 sm:p-8"
                data-testid="red-graniti-about"
              >
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--red-mark)]">
                  About
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                  About R.E.D. Graniti
                </h2>
                <p className="mt-5 text-base leading-8 text-black/68">{identity.about}</p>
                <p className="mt-4 text-base leading-8 text-black/68">
                  {identity.qualityStatement}
                </p>
              </section>

              <section
                id="business"
                className="rounded-2xl border border-[var(--red-line)] bg-white p-6 sm:p-8"
                data-testid="red-graniti-business-areas"
              >
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--red-mark)]">
                  Business areas
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                  Blocks, slabs and distribution
                </h2>
                <div className="mt-6 divide-y divide-black/10 border-y border-black/10">
                  {identity.capabilities.map((capability, index) => {
                    const Icon = CAPABILITY_ICONS[index] || Building2;
                    return (
                      <article
                        key={capability.title}
                        className="grid gap-4 py-6 sm:grid-cols-[48px_minmax(0,1fr)]"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[var(--red-mark)]">
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="text-xl font-black tracking-[-0.02em]">
                            {capability.title}
                          </h3>
                          <p className="mt-2 text-sm leading-7 text-black/64 sm:text-base">
                            {capability.description}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section
                id="quarries"
                className="rounded-2xl border border-[var(--red-line)] bg-white p-6 sm:p-8"
                data-testid="red-graniti-quarries"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--red-mark)]">
                      Quarry network
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                      Company-owned quarries
                    </h2>
                  </div>
                  <a
                    href={RED_GRANITI_QUARRIES_URL}
                    {...externalLinkProps()}
                    className="inline-flex items-center gap-2 text-sm font-black text-black/65 underline decoration-black/25 underline-offset-4 hover:text-black"
                  >
                    Official quarry directory
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>

                <p className="mt-4 text-sm leading-7 text-black/64 sm:text-base">
                  R.E.D. Graniti reports company-owned quarry operations in {identity.quarryCountries.join(", ")}.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {identity.quarryHighlights.map((highlight) => (
                    <a
                      key={highlight.id}
                      href={highlight.sourceUrl}
                      {...externalLinkProps()}
                      className="group overflow-hidden rounded-xl border border-black/10 bg-[var(--red-paper)]"
                    >
                      <SafeProfileImg
                        src={highlight.imageUrl}
                        alt={`R.E.D. Graniti source region in ${highlight.region}`}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--red-mark)]">
                          {highlight.region}
                        </p>
                        <h3 className="mt-1 text-base font-black leading-6">{highlight.title}</h3>
                      </div>
                    </a>
                  ))}
                </div>
              </section>

              <section
                id="locations"
                className="rounded-2xl border border-[var(--red-line)] bg-white p-6 sm:p-8"
                data-testid="red-graniti-locations"
              >
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--red-mark)]">
                  Locations
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                  Italian offices, yards and warehouse
                </h2>
                <div className="mt-6 divide-y divide-black/10 border-y border-black/10">
                  {identity.operatingLocations.map((location, index) => (
                    <article
                      key={location.label}
                      className="grid gap-4 py-6 sm:grid-cols-[48px_minmax(0,1fr)]"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-[var(--red-mark)]">
                        {index === 2 ? (
                          <Factory className="h-6 w-6" aria-hidden="true" />
                        ) : (
                          <Building2 className="h-6 w-6" aria-hidden="true" />
                        )}
                      </span>
                      <div>
                        <h3 className="text-lg font-black">{location.label}</h3>
                        <p className="mt-1 text-sm font-bold text-[var(--red-mark)]">
                          {location.location}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-black/64">{location.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {profileItems ? (
                <section className="rounded-2xl border border-[var(--red-line)] bg-white p-5 sm:p-7">
                  {profileItems}
                </section>
              ) : null}
            </div>

            <aside className="space-y-6 lg:sticky lg:top-[calc(var(--ts-profile-top-offset,0px)+1rem)]">
              <section
                className="rounded-2xl border border-[var(--red-line)] bg-white p-6"
                data-testid="red-graniti-company-contact"
              >
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--red-mark)]">
                  Company contact
                </p>
                <h2 className="mt-2 text-xl font-black">{identity.legalName}</h2>
                <a
                  href={identity.headquarters.mapUrl}
                  {...externalLinkProps()}
                  className="mt-5 flex items-start gap-3 text-sm leading-6 text-black/66 hover:text-black"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--red-mark)]" />
                  <span>
                    {identity.headquarters.addressLine1}
                    <br />
                    {identity.headquarters.addressLine2}
                  </span>
                </a>
                <a
                  href="tel:+39058588471"
                  className="mt-4 flex items-center gap-3 text-sm font-bold text-black/66 hover:text-black"
                >
                  <Phone className="h-4 w-4 text-[var(--red-mark)]" />
                  {identity.headquarters.phone}
                </a>
                <a
                  href={`mailto:${identity.headquarters.email}`}
                  className="mt-4 flex items-center gap-3 text-sm font-bold text-black/66 hover:text-black"
                >
                  <Mail className="h-4 w-4 text-[var(--red-mark)]" />
                  {identity.headquarters.email}
                </a>
                <p className="mt-5 border-t border-black/10 pt-4 text-xs text-black/45">
                  {identity.legalId}
                </p>
              </section>

              <section
                id="partnership"
                className="rounded-2xl border border-[var(--red-line)] bg-white p-6"
                data-testid="red-graniti-first-cut-relationship"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[var(--red-mark)]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.17em] text-[var(--red-mark)]">
                  {identity.partnership.relationshipLabel}
                </p>
                <h2 className="mt-2 text-xl font-black">First-cut distribution</h2>
                <p className="mt-3 text-sm leading-7 text-black/64">
                  {identity.partnership.description}
                </p>
                <a
                  href={jwProfileHref}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-black text-black/65 underline decoration-black/25 underline-offset-4 hover:text-black"
                >
                  View {JW_STONE_PUBLIC_IDENTITY.brandName}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </section>

              <section className="rounded-2xl border border-[var(--red-line)] bg-white p-6">
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--red-mark)]">
                  Official links
                </p>
                <div className="mt-3 divide-y divide-black/10">
                  {identity.officialLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      {...externalLinkProps()}
                      className="flex items-center justify-between gap-4 py-3.5 text-sm font-bold text-black/64 hover:text-black"
                    >
                      {link.label}
                      <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--red-line)] bg-white p-5">
                {trustActions}
              </section>
            </aside>
          </div>
        </div>
      </main>

      <TradeScoutProfileHandoff
        profileSlug={profileSlug}
        profileName={identity.brandName}
        platformBaseHref={platformBaseHref}
      />

      <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-black/10 bg-[rgba(243,241,237,0.97)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openContact("call")}
            data-testid="red-graniti-mobile-call"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm font-black text-black"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call
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
