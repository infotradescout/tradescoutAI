import { ArrowDown, ArrowRight, BadgeCheck, Check, ExternalLink, MapPin } from "lucide-react";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import {
  JW_STONE_MARKETPLACE_PATH,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity,
  buildSteelHomeTradePartnerRequestHref,
} from "@shared/steelHomePackagesProfile";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";

type Props = {
  requestHref: string;
  laborRequestHref: string;
  platformBaseHref?: string;
};

type LinkVariant = "primary" | "outline" | "light" | "dark";

const partnerSectionByCardKey = {
  structure: "#worldwide-steel",
  stone: "#jw-stone",
  cabinets: "#a-plus-cabinets",
} as const;

const featuredStones = content.tradePartners.jwStone.featuredStoneIds
  .map((stoneId) => getCatalogItemById(stoneId))
  .filter((stone): stone is NonNullable<ReturnType<typeof getCatalogItemById>> => Boolean(stone));

function scrollToSection(href: string) {
  const target = document.getElementById(href.replace(/^#/, ""));
  if (!target) return;

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  target.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
}

function actionClass(variant: LinkVariant, className = "") {
  const variantClass = {
    primary:
      "bg-[#c9683d] text-white shadow-[0_16px_45px_rgba(84,35,18,0.26)] hover:bg-[#b55732] focus-visible:ring-[#c9683d]",
    outline:
      "border border-[#18312f]/30 bg-transparent text-[#18312f] hover:border-[#18312f] hover:bg-white/40 focus-visible:ring-[#18312f]",
    light:
      "bg-[#f7f2e9] text-[#18312f] shadow-[0_16px_45px_rgba(0,0,0,0.18)] hover:bg-white focus-visible:ring-white",
    dark: "bg-[#18312f] text-white hover:bg-[#264946] focus-visible:ring-[#18312f]",
  }[variant];

  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-center text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variantClass} ${className}`;
}

function ActionLink({
  href,
  label,
  testId,
  variant = "primary",
  external = false,
  className = "",
}: {
  href: string;
  label: string;
  testId?: string;
  variant?: LinkVariant;
  external?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      data-testid={testId}
      className={actionClass(variant, className)}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
    >
      {label}
      {external ? (
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      )}
    </a>
  );
}

function ScrollButton({
  target,
  label,
  testId,
  variant = "primary",
  className = "",
  down = false,
}: {
  target: string;
  label: string;
  testId?: string;
  variant?: LinkVariant;
  className?: string;
  down?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToSection(target)}
      data-testid={testId}
      className={actionClass(variant, className)}
    >
      {label}
      {down ? (
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  light = false,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  light?: boolean;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-4xl text-center" : "max-w-4xl"}>
      <p
        className={`text-xs font-bold uppercase tracking-[0.22em] ${
          light ? "text-[#f0b392]" : "text-[#a94f2e]"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-4 font-editorial text-4xl font-semibold leading-[0.94] tracking-[-0.04em] sm:text-6xl lg:text-7xl ${
          light ? "text-white" : "text-[#18312f]"
        }`}
      >
        {title}
      </h2>
      {body ? (
        <p
          className={`mt-6 text-base leading-7 sm:text-lg sm:leading-8 ${
            light ? "text-white/70" : "text-[#5e6965]"
          }`}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

function PartnerMark({ number, light = false }: { number: string; light?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.16em] ${
        light
          ? "border-white/20 bg-white/[0.07] text-white/[0.85]"
          : "border-[#18312f]/[0.15] bg-white/[0.55] text-[#18312f]"
      }`}
    >
      <BadgeCheck className="h-4 w-4 text-[#c9683d]" aria-hidden="true" />
      TradePartner {number}
    </div>
  );
}

function FactList({ items, light = false }: { items: readonly string[]; light?: boolean }) {
  return (
    <ul className="mt-7 grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <li
          key={item}
          className={`flex min-h-20 items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6 ${
            light
              ? "border-white/[0.12] bg-white/[0.06] text-white/[0.85]"
              : "border-[#18312f]/10 bg-white/60 text-[#41514d]"
          }`}
        >
          <Check className="mt-1 h-4 w-4 shrink-0 text-[#c9683d]" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function SteelHomePackagesProfile({
  requestHref,
  laborRequestHref,
  platformBaseHref = "",
}: Props) {
  const worldwideRequestHref = buildSteelHomeTradePartnerRequestHref(
    requestHref,
    "worldwide-steel-buildings"
  );
  const jwStoneRequestHref = buildSteelHomeTradePartnerRequestHref(
    requestHref,
    "jw-stone-logistics"
  );
  const aPlusRequestHref = buildSteelHomeTradePartnerRequestHref(requestHref, "a-plus-cabinets");
  const jwStoneCollectionHref = qualifyPublicProfileItemDestination(
    JW_STONE_MARKETPLACE_PATH,
    platformBaseHref
  );

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[#f5f1e8] pt-[72px] text-[#18312f]"
      data-testid="steel-home-packages-profile"
      data-profile-slug={identity.slug}
      data-release-state={identity.releaseState}
    >
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#18312f]/10 bg-[#f7f3eb]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={() => scrollToSection("#top")}
            className="flex min-w-0 items-baseline gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18312f]"
            aria-label="Steel Home TradePartners, back to top"
          >
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#a94f2e]">
              TradeScout
            </span>
            <span className="hidden h-4 w-px bg-[#18312f]/25 sm:block" aria-hidden="true" />
            <span className="truncate font-editorial text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              {content.header.label}
            </span>
          </button>

          <nav className="hidden items-center gap-6 xl:flex" aria-label="Steel Home TradePartners">
            {content.header.navigation.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => scrollToSection(item.href)}
                className="text-sm font-semibold text-[#41514d] transition hover:text-[#a94f2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18312f]"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <ScrollButton
            target="#tradepartners"
            label="Meet the partners"
            testId="steel-home-header-partners"
            variant="dark"
            className="hidden min-h-10 px-5 sm:inline-flex"
          />
        </div>
      </header>

      <section
        id="top"
        className="scroll-mt-20 bg-[#132827] text-white"
        data-testid="steel-home-hero"
      >
        <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-16 lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0b392]">
              {content.hero.eyebrow}
            </p>
            <h1 className="mt-6 font-editorial text-6xl font-semibold leading-[0.85] tracking-[-0.055em] text-white sm:text-8xl lg:text-[6.9rem]">
              {content.hero.headline}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/75 sm:text-xl sm:leading-9">
              {content.hero.body}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ScrollButton
                target="#tradepartners"
                label={content.hero.primaryAction}
                testId="steel-home-hero-partners"
                down
              />
              <ActionLink
                href={laborRequestHref}
                label={content.hero.laborAction}
                testId="steel-home-hero-labor"
                variant="light"
              />
            </div>
          </div>

          <div className="grid min-h-[620px] grid-cols-2 grid-rows-2 gap-3 sm:min-h-[700px]">
            {content.hero.visuals.map((visual, index) => (
              <button
                key={visual.key}
                type="button"
                onClick={() => scrollToSection(partnerSectionByCardKey[visual.key])}
                className={`group relative isolate overflow-hidden rounded-[1.6rem] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b392] ${
                  index === 0 ? "col-span-2 sm:col-span-1 sm:row-span-2" : "col-span-1"
                }`}
                data-testid={`steel-home-hero-partner-${visual.key}`}
              >
                <img
                  src={visual.image}
                  alt={visual.imageAlt}
                  className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
                <span
                  className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
                  aria-hidden="true"
                />
                <span className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <span className="block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#f0b392]">
                    {visual.label}
                  </span>
                  <span className="mt-2 flex items-end justify-between gap-3 font-editorial text-2xl font-semibold leading-none text-white sm:text-3xl">
                    {visual.title}
                    <ArrowRight
                      className="h-5 w-5 shrink-0 transition group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        id="tradepartners"
        className="scroll-mt-20 border-b border-[#18312f]/10 bg-[#f5f1e8]"
        data-testid="steel-home-partners"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
          <SectionIntro
            eyebrow={content.partnerIntro.eyebrow}
            title={content.partnerIntro.title}
            body={content.partnerIntro.body}
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {content.tradePartners.cards.map((partner) => (
              <article
                key={partner.partnerKey}
                className="group overflow-hidden rounded-[1.8rem] border border-[#18312f]/10 bg-[#fbf8f1] shadow-[0_20px_70px_rgba(24,49,47,0.07)]"
                data-testid={`steel-home-tradepartner-${partner.partnerKey}`}
              >
                <button
                  type="button"
                  onClick={() => scrollToSection(partnerSectionByCardKey[partner.key])}
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e]"
                >
                  <span className="relative block aspect-[4/3] overflow-hidden">
                    <img
                      src={partner.image}
                      alt={partner.imageAlt}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="absolute left-5 top-5">
                      <PartnerMark number={partner.number} light />
                    </span>
                  </span>
                  <span className="block p-6 sm:p-7">
                    <span className="block text-xs font-bold uppercase tracking-[0.2em] text-[#a94f2e]">
                      {partner.label}
                    </span>
                    <span className="mt-3 block font-editorial text-4xl font-semibold leading-none tracking-[-0.035em]">
                      {partner.title}
                    </span>
                    <span className="mt-4 block text-sm leading-6 text-[#66716d]">
                      {partner.body}
                    </span>
                    <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold">
                      {partner.action}
                      <ArrowRight
                        className="h-4 w-4 transition group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="worldwide-steel"
        className="scroll-mt-20 bg-[#fbf8f1]"
        data-testid="steel-home-worldwide"
      >
        <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:gap-16 lg:px-10">
          <figure className="relative overflow-hidden rounded-[2rem] bg-[#263c3a] shadow-[0_24px_80px_rgba(24,49,47,0.14)]">
            <img
              src={content.tradePartners.worldwide.image}
              alt={content.tradePartners.worldwide.imageAlt}
              className="aspect-[4/5] h-full w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/[0.85] to-transparent px-6 pb-6 pt-24 text-xs leading-5 text-white/75 sm:px-8 sm:pb-8">
              Structure inspiration shown for the Worldwide Steel Buildings scope.
            </figcaption>
          </figure>

          <div>
            <PartnerMark number={content.tradePartners.worldwide.number} />
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              {content.tradePartners.worldwide.eyebrow}
            </p>
            <h2 className="mt-3 font-editorial text-5xl font-semibold leading-[0.9] tracking-[-0.045em] sm:text-7xl">
              {content.tradePartners.worldwide.name}
            </h2>
            <h3 className="mt-6 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">
              {content.tradePartners.worldwide.headline}
            </h3>
            <p className="mt-5 text-base leading-8 text-[#5e6965] sm:text-lg">
              {content.tradePartners.worldwide.body}
            </p>

            <FactList items={content.tradePartners.worldwide.facts} />

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionLink
                href={worldwideRequestHref}
                label={content.tradePartners.worldwide.requestAction}
                testId="steel-home-worldwide-request"
              />
              <ActionLink
                href={content.tradePartners.worldwide.designerHref}
                label={content.tradePartners.worldwide.designerAction}
                testId="steel-home-worldwide-designer"
                variant="dark"
                external
              />
            </div>

            <a
              href={content.tradePartners.worldwide.galleryHref}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="steel-home-worldwide-gallery"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#a94f2e] underline decoration-[rgba(169,79,46,0.35)] underline-offset-4 transition hover:decoration-[#a94f2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
            >
              {content.tradePartners.worldwide.galleryAction}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>

            <p className="mt-7 border-l-2 border-[#c9683d] pl-5 text-sm leading-7 text-[#63706c]">
              {content.tradePartners.worldwide.scopeNote}
            </p>
          </div>
        </div>
      </section>

      <section
        id="jw-stone"
        className="scroll-mt-20 bg-[#17201f] text-white"
        data-testid="steel-home-jw-stone"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[.84fr_1.16fr] lg:items-end">
            <div>
              <PartnerMark number={content.tradePartners.jwStone.number} light />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-[#f0b392]">
                {content.tradePartners.jwStone.eyebrow}
              </p>
              <h2 className="mt-3 font-editorial text-5xl font-semibold leading-[0.9] tracking-[-0.045em] sm:text-7xl">
                {content.tradePartners.jwStone.name}
              </h2>
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-[-0.025em] sm:text-3xl">
                {content.tradePartners.jwStone.headline}
              </h3>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/[0.68] sm:text-lg">
                {content.tradePartners.jwStone.body}
              </p>
            </div>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredStones.map((stone) => {
              const stoneHref = qualifyPublicProfileItemDestination(
                `${JW_STONE_MARKETPLACE_PATH}/stones/${encodeURIComponent(stone.shareSlug || stone.id)}`,
                platformBaseHref
              );

              return (
                <a
                  key={stone.id}
                  href={stoneHref}
                  data-testid={`steel-home-jw-stone-${stone.id}`}
                  className="group overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.05] transition hover:-translate-y-1 hover:border-[#f0b392]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b392]"
                >
                  <span className="block aspect-[3/4] overflow-hidden bg-[#2a3432]">
                    <img
                      src={stone.images[0]}
                      alt={`${stone.publicLabel} from the JW Stone Logistics collection`}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span className="block p-5">
                    <span className="block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#f0b392]">
                      {stone.materialLabel || "Natural stone"}
                    </span>
                    <span className="mt-2 flex items-end justify-between gap-3 font-editorial text-2xl font-semibold leading-none text-white">
                      {stone.publicLabel}
                      <ArrowRight
                        className="h-4 w-4 shrink-0 transition group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </a>
              );
            })}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ActionLink
              href={jwStoneCollectionHref}
              label={content.tradePartners.jwStone.collectionAction}
              testId="steel-home-jw-stone-collection"
              variant="light"
            />
            <ActionLink
              href={jwStoneRequestHref}
              label={content.tradePartners.jwStone.requestAction}
              testId="steel-home-jw-stone-request"
              variant="primary"
            />
          </div>
          <p className="mt-7 max-w-5xl border-l-2 border-[#c9683d] pl-5 text-sm leading-7 text-white/60">
            {content.tradePartners.jwStone.scopeNote}
          </p>
        </div>
      </section>

      <section
        id="a-plus-cabinets"
        className="scroll-mt-20 bg-[#e7dfd1]"
        data-testid="steel-home-a-plus"
      >
        <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[.94fr_1.06fr] lg:items-center lg:gap-16 lg:px-10">
          <div className="order-2 lg:order-1">
            <PartnerMark number={content.tradePartners.aPlusCabinets.number} />
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              {content.tradePartners.aPlusCabinets.eyebrow}
            </p>
            <h2 className="mt-3 font-editorial text-5xl font-semibold leading-[0.9] tracking-[-0.045em] sm:text-7xl">
              {content.tradePartners.aPlusCabinets.name}
            </h2>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#4b5b57]">
              <MapPin className="h-4 w-4 text-[#c9683d]" aria-hidden="true" />
              {content.tradePartners.aPlusCabinets.location}
            </p>
            <h3 className="mt-7 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">
              {content.tradePartners.aPlusCabinets.headline}
            </h3>
            <p className="mt-5 text-base leading-8 text-[#5e6965] sm:text-lg">
              {content.tradePartners.aPlusCabinets.body}
            </p>

            <FactList items={content.tradePartners.aPlusCabinets.facts} />

            <ActionLink
              href={aPlusRequestHref}
              label={content.tradePartners.aPlusCabinets.requestAction}
              testId="steel-home-a-plus-request"
              className="mt-9"
            />
            <p className="mt-7 border-l-2 border-[#c9683d] pl-5 text-sm leading-7 text-[#63706c]">
              {content.tradePartners.aPlusCabinets.scopeNote}
            </p>
          </div>

          <figure className="order-1 overflow-hidden rounded-[2rem] bg-[#cbbca7] shadow-[0_24px_80px_rgba(75,55,36,0.14)] lg:order-2">
            <img
              src={content.tradePartners.aPlusCabinets.image}
              alt={content.tradePartners.aPlusCabinets.imageAlt}
              className="aspect-[5/4] h-full w-full object-cover lg:aspect-[4/5]"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="border-t border-[#18312f]/10 bg-[#f4eee4] px-5 py-4 text-xs leading-5 text-[#68736f]">
              {content.tradePartners.aPlusCabinets.imageNote}
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="bg-[#f5f1e8]" data-testid="steel-home-integration">
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
          <SectionIntro
            eyebrow={content.integration.eyebrow}
            title={content.integration.title}
            centered
          />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[1.8rem] border border-[#18312f]/10 bg-[#18312f]/10 md:grid-cols-3">
            {content.integration.items.map((item, index) => (
              <li key={item.title} className="bg-[#fbf8f1] p-7 sm:p-9">
                <span className="font-editorial text-4xl font-semibold text-[#a94f2e]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-8 text-xl font-bold leading-7 tracking-[-0.025em]">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-[#66716d]">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="local-labor"
        className="scroll-mt-20 bg-[#18312f] text-white"
        data-testid="steel-home-labor"
      >
        <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:px-10">
          <div>
            <SectionIntro
              eyebrow={content.labor.eyebrow}
              title={content.labor.title}
              body={content.labor.body}
              light
            />
            <p className="mt-6 max-w-3xl border-l-2 border-[#c9683d] pl-5 text-sm leading-7 text-white/[0.82] sm:text-base">
              {content.labor.support}
            </p>
            <ActionLink
              href={laborRequestHref}
              label={content.labor.action}
              testId="steel-home-labor-request"
              variant="light"
              className="mt-9"
            />
          </div>

          <div className="rounded-[1.75rem] border border-white/[0.12] bg-white/[0.06] p-6 sm:p-9">
            <div className="flex items-center gap-3 border-b border-white/[0.12] pb-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#c9683d]">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f0b392]">
                  Based on the jobsite
                </p>
                <p className="mt-1 text-sm text-white/[0.65]">A separate location-aware request</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {content.labor.examples.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-white/[0.88]"
                >
                  <Check className="h-4 w-4 shrink-0 text-[#f0b392]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <aside
        className="border-b border-[#18312f]/10 bg-[#eee8dc]"
        aria-label="TradePartner scope disclosure"
        data-testid="steel-home-disclosure"
      >
        <div className="mx-auto max-w-5xl px-4 py-9 text-center sm:px-6">
          <p className="text-xs leading-6 text-[#68736f]">{content.disclosure}</p>
        </div>
      </aside>

      <TradeScoutProfileHandoff
        profileSlug={identity.slug}
        profileName={identity.displayLabel}
        platformBaseHref={platformBaseHref}
        className="border-t border-white/10"
      />
    </main>
  );
}
