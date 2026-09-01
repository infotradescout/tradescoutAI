import type { ComponentType, ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Calendar,
  CalendarClock,
  CircleCheck,
  Clock3,
  HeartHandshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";

import { ShareButton } from "@/components/ShareButton";
import { ProfileBookingRequestDialog } from "@/components/profile/ProfileBookingRequestDialog";
import { SafeProfileImg } from "@/pages/profile-sites/safeProfileImage";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";

type FinancialProfessionalBooking = {
  profileId: string;
  profileName: string;
  timezone: string;
  pricingRows: Array<{
    id: string;
    name: string;
    priceLabel: string;
    description?: string;
  }>;
  paidBookings: boolean;
  bookingPriceUsd: number;
  bookingCategory: string;
  bookingStateCode: string;
  hasViewerSession: boolean;
  viewerCanManage: boolean;
  signInHref: string;
  platformBaseHref: string;
  calendarVisibility: "public" | "private";
  slots: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  pricingTableEnabled: boolean;
};

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
  booking?: FinancialProfessionalBooking;
};

type FocusArea = { eyebrow: string; title: string; body: string };
type Principle = { title: string; body: string };
type SourceLink = { label: string; url: string };

type FinancialProfessionalProfileData = {
  companyName: string;
  roleLine: string;
  locationLabel: string;
  heroTitle: string;
  heroText: string;
  portraitUrl: string;
  portraitAlt: string;
  focusAreas: FocusArea[];
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

function cards<T extends Record<string, string>>(value: unknown, keys: Array<keyof T>): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => record(item))
    .map(
      (item) =>
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

function readFinancialProfessionalProfile(
  contentBlocks: unknown
): FinancialProfessionalProfileData {
  const blocks = Array.isArray(contentBlocks) ? contentBlocks : [];
  const block = blocks.find(
    (entry) => record(entry).type === "financialProfessionalProfile"
  );
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
  BriefcaseBusiness,
  HeartHandshake,
  CalendarClock,
  ShieldCheck,
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function FinancialProfessionalProfileTheme({
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
  booking,
}: Props) {
  const profile = readFinancialProfessionalProfile(contentBlocks);
  const companyName = profile.companyName || businessName;
  const roleLine = profile.roleLine || headline?.trim() || "Financial professional";
  const locationLabel = profile.locationLabel || serviceAreas[0] || "";
  const heroTitle = profile.heroTitle || "Clarify the priorities behind the numbers.";
  const heroText = profile.heroText || aboutText?.trim() || headline?.trim() || "";
  const focusAreas =
    profile.focusAreas.length > 0
      ? profile.focusAreas
      : services.slice(0, 4).map((service, index) => ({
          eyebrow: String(index + 1).padStart(2, "0"),
          title: service,
          body: "Start a focused conversation and confirm the available scope before acting.",
        }));
  const bookingAction = booking ? (
    <ProfileBookingRequestDialog
      profileId={booking.profileId}
      profileName={booking.profileName}
      timezone={booking.timezone}
      pricingRows={booking.pricingRows}
      paidBookings={booking.paidBookings}
      bookingPriceUsd={booking.bookingPriceUsd}
      bookingCategory={booking.bookingCategory}
      bookingStateCode={booking.bookingStateCode}
      hasViewerSession={booking.hasViewerSession}
      viewerCanManage={booking.viewerCanManage}
      signInHref={booking.signInHref}
      platformBaseHref={booking.platformBaseHref}
    />
  ) : undefined;
  const bookingDetailsVisible = Boolean(
    booking &&
      ((booking.calendarVisibility === "public" && booking.slots.length > 0) ||
        (booking.pricingTableEnabled && booking.pricingRows.length > 0))
  );
  const bookingDetails = bookingDetailsVisible && booking ? (
    <div className="rounded-3xl border border-[#17362f]/15 bg-[#f8f3e8] p-6 text-[#17362f] sm:p-8">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#916425]">
        <Calendar className="h-4 w-4" />
        Booking details
      </p>
      {booking.calendarVisibility === "public" && booking.slots.length > 0 ? (
        <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {booking.slots.slice(0, 14).map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[#17362f]/12 px-4 py-3"
            >
              <span className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-[#916425]" />
                {DAY_NAMES[slot.dayOfWeek] || "Day"}
              </span>
              <span>
                {slot.startTime}–{slot.endTime}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {booking.pricingTableEnabled && booking.pricingRows.length > 0 ? (
        <div className="mt-5 divide-y divide-[#17362f]/12 border-y border-[#17362f]/12 text-sm">
          {booking.pricingRows.slice(0, 10).map((row) => (
            <div key={row.id} className="flex justify-between gap-4 py-3">
              <span>{row.name}</span>
              <span className="font-black">{row.priceLabel}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-5 text-xs leading-5 text-[#17362f]/60">
        A request is not confirmed until the profile owner accepts it.
      </p>
    </div>
  ) : undefined;

  return (
    <div
      className="min-h-full overflow-hidden bg-[#f3efe5] text-[#16332d]"
      data-testid="financial-professional-profile"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}
    >
      <section className="relative isolate overflow-hidden bg-[#0d2e29] text-[#fbf7ee]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(211,174,94,.26),transparent_26%),radial-gradient(circle_at_12%_92%,rgba(79,139,119,.24),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(218,190,123,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(218,190,123,.08)_1px,transparent_1px)] bg-[size:48px_48px]" />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-4 border-b border-[#dabe7b]/20 px-5 py-5 sm:px-8">
          <a href={profileShareDestination} className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#dabe7b]/55 text-xs font-bold tracking-[0.15em] text-[#dabe7b]">
              DD
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{businessName}</span>
              <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.2em] text-[#dabe7b]/80 sm:block">
                {roleLine} · {companyName}
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
              className="hidden min-h-11 border-[#dabe7b]/35 bg-transparent text-[#fbf7ee] hover:bg-white/10 hover:text-white sm:inline-flex"
            />
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#d8ad55] px-4 text-sm font-bold text-[#0d2e29] transition hover:bg-[#ebcc89] sm:px-5"
            >
              <MessageCircle className="h-4 w-4" />
              Contact Dean
            </button>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-14 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,.72fr)] lg:items-center lg:gap-20">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#dabe7b]">
              <span>{roleLine}</span>
              {locationLabel ? (
                <span className="inline-flex items-center gap-1.5 text-[#fbf7ee]/60">
                  <MapPin className="h-3.5 w-3.5" />
                  {locationLabel}
                </span>
              ) : null}
            </div>
            <h1 className="mt-7 max-w-4xl font-serif text-[3.55rem] font-medium leading-[0.9] tracking-[-0.045em] sm:text-7xl lg:text-[6rem]">
              {heroTitle}
            </h1>
            {heroText ? (
              <p className="mt-7 max-w-2xl text-base font-light leading-7 text-[#fbf7ee]/72 sm:text-lg sm:leading-8">
                {heroText}
              </p>
            ) : null}
            <div className="mt-9 flex flex-wrap items-center gap-3" id="booking">
              {bookingAction}
              <button
                type="button"
                onClick={() => onDirectConnect()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#dabe7b]/40 px-5 text-sm font-semibold text-[#fbf7ee] transition hover:bg-white/10"
              >
                Start a protected conversation
                <ArrowUpRight className="h-4 w-4 text-[#dabe7b]" />
              </button>
              <a
                href="#focus"
                className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-[#fbf7ee]/72 transition hover:text-white"
              >
                Explore focus areas
                <ArrowDownRight className="h-4 w-4 text-[#dabe7b]" />
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="absolute -inset-7 rounded-full border border-dashed border-[#dabe7b]/25" />
            <div className="relative overflow-hidden rounded-[44%_44%_1.5rem_1.5rem] border border-[#dabe7b]/45 bg-[#dfcd9f] p-2 shadow-2xl shadow-black/30">
              {profile.portraitUrl ? (
                <SafeProfileImg
                  src={profile.portraitUrl}
                  alt={profile.portraitAlt || businessName}
                  className="aspect-[4/5] w-full rounded-[43%_43%_1rem_1rem] object-cover object-top"
                />
              ) : (
                <div className="grid aspect-[4/5] place-items-center rounded-[43%_43%_1rem_1rem] bg-[radial-gradient(circle_at_50%_24%,#f2e6c9,#c9ae6d)] text-7xl font-bold text-[#17362f]">
                  DD
                </div>
              )}
              <div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/25 bg-[#0d2e29]/92 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold">{businessName}</p>
                <p className="mt-1 text-xs leading-5 text-[#fbf7ee]/65">{companyName}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section id="focus" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[.65fr_1.35fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#916425]">
                Conversation areas
              </p>
              <h2 className="mt-4 font-serif text-5xl font-medium leading-[0.94] tracking-[-0.035em] sm:text-6xl">
                Start with context. Confirm the scope.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-[#17362f]/65">
                These are discussion topics from Dean's public presentation, not promises of a
                product, service, qualification, or result.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {focusAreas.map((area, index) => {
                const Icon = focusIcons[index % focusIcons.length];
                return (
                  <article
                    key={`${area.title}-${index}`}
                    className="group relative overflow-hidden rounded-[1.75rem] border border-[#17362f]/12 bg-[#fbf8f0] p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#17362f]/10 sm:p-8"
                  >
                    <div className="relative flex items-center justify-between gap-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#916425]">
                        {area.eyebrow}
                      </p>
                      <Icon className="h-5 w-5 text-[#17362f]/45" />
                    </div>
                    <h3 className="relative mt-8 font-serif text-3xl font-semibold leading-none">
                      {area.title}
                    </h3>
                    <p className="relative mt-4 text-sm leading-6 text-[#17362f]/64">
                      {area.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => onDirectConnect(area.title)}
                      className="relative mt-7 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#17362f]"
                    >
                      Discuss through Direct Connect
                      <ArrowUpRight className="h-4 w-4 text-[#916425]" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {bookingDetails ? (
          <section className="border-y border-[#17362f]/10 bg-[#e4d5b4] px-5 py-12 sm:px-8">
            <div className="mx-auto max-w-7xl">{bookingDetails}</div>
          </section>
        ) : null}

        <section className="bg-[#17362f] px-5 py-16 text-[#fbf7ee] sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d8bd7d]">
                Public background
              </p>
              <h2 className="mt-4 font-serif text-5xl font-medium leading-[0.94] sm:text-6xl">
                A working-life perspective on financial priorities.
              </h2>
              <div className="mt-8 space-y-5 text-sm font-light leading-7 text-[#fbf7ee]/70 sm:text-base">
                {(profile.biography.length > 0 ? profile.biography : [aboutText || heroText])
                  .filter(Boolean)
                  .map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
              </div>
            </div>

            <div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {profile.principles.map((principle) => (
                <div key={principle.title} className="border-t border-[#d8bd7d]/35 py-5">
                  <p className="text-sm font-semibold">{principle.title}</p>
                  <p className="mt-2 text-xs leading-5 text-[#fbf7ee]/58">{principle.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <div className="flex items-center gap-3">
              <CircleCheck className="h-5 w-5 text-[#916425]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#916425]">
                Trust and profile details
              </p>
            </div>
            <div className="mt-5 rounded-3xl border border-[#17362f]/15 bg-white/55 p-5 sm:p-7">
              <div data-testid="profile-trust-section" aria-label="Trust and profile actions">
                {trustActions}
              </div>
            </div>
            {profileItems ? <div className="mt-5">{profileItems}</div> : null}
          </div>

          <div className="rounded-3xl border border-[#17362f]/15 bg-[#ebe2cf] p-7 sm:p-9">
            <ShieldCheck className="h-7 w-7 text-[#916425]" />
            <h2 className="mt-6 font-serif text-4xl font-semibold leading-none">
              Verify before you act.
            </h2>
            <p className="mt-5 text-sm leading-6 text-[#17362f]/65">
              Use Direct Connect to request current service details, disclosures, credentials,
              terms, and availability from Dean.
            </p>
            {profile.sourceBasis.length > 0 ? (
              <ul className="mt-7 space-y-3">
                {profile.sourceBasis.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between gap-4 border-b border-[#17362f]/15 pb-3 text-sm font-semibold"
                    >
                      <span>{source.label}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#916425] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {profile.disclosure ? (
              <p className="mt-8 text-[11px] leading-5 text-[#17362f]/55">
                {profile.disclosure}
              </p>
            ) : null}
          </div>
        </section>

        <section className="bg-[#0d2e29] px-5 py-14 text-[#fbf7ee] sm:px-8 sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d8bd7d]">
                Intent before contact
              </p>
              <h2 className="mt-3 max-w-3xl font-serif text-5xl font-medium leading-[0.94] sm:text-6xl">
                Bring the question. Keep the next step clear.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#d8ad55] px-6 text-sm font-bold text-[#0d2e29] transition hover:bg-[#ebcc89]"
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
