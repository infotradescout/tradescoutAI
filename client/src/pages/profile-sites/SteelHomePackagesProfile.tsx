import { useRef } from "react";
import { ArrowDown, ArrowRight, Check, MapPin } from "lucide-react";
import {
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity,
} from "@shared/steelHomePackagesProfile";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";
import SteelHomePackageBuilder, {
  type SteelHomePackageBuilderHandle,
} from "./SteelHomePackageBuilder";
import type {
  SteelHomePackageKey,
  SteelHomeStartingPoint,
} from "./steelHomePackageBuilder";

type Props = {
  requestHref: string;
  laborRequestHref: string;
  platformBaseHref?: string;
};

type ActionButtonProps = {
  onClick: () => void;
  label: string;
  testId?: string;
  variant?: "primary" | "outline" | "light" | "dark";
  className?: string;
};

const startingPointClassName =
  "group flex min-h-56 w-full flex-col bg-[#fbf8f1] p-6 text-left transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#18312f]";

function scrollToSection(href: string) {
  const target = document.getElementById(href.replace(/^#/, ""));
  if (!target) return;

  target.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

function ActionButton({
  onClick,
  label,
  testId,
  variant = "primary",
  className = "",
}: ActionButtonProps) {
  const variantClass = {
    primary:
      "bg-[#c9683d] text-white shadow-[0_16px_45px_rgba(84,35,18,0.3)] hover:bg-[#b55732] focus-visible:ring-white",
    outline:
      "border border-white/45 bg-black/10 text-white hover:border-white hover:bg-white/10 focus-visible:ring-white",
    light:
      "bg-[#f7f2e9] text-[#18312f] shadow-[0_16px_45px_rgba(0,0,0,0.2)] hover:bg-white focus-visible:ring-white",
    dark: "bg-[#18312f] text-white hover:bg-[#264946] focus-visible:ring-[#18312f]",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-center text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variantClass} ${className}`}
      data-testid={testId}
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">{eyebrow}</p>
      <h2 className="mt-4 font-editorial text-4xl font-semibold leading-[0.98] tracking-[-0.035em] text-[#18312f] sm:text-6xl">
        {title}
      </h2>
      {body ? (
        <p className="mt-6 text-base leading-7 text-[#5e6965] sm:text-lg sm:leading-8">{body}</p>
      ) : null}
    </div>
  );
}

export default function SteelHomePackagesProfile({
  requestHref,
  laborRequestHref,
  platformBaseHref = "",
}: Props) {
  const packageBuilderRef = useRef<SteelHomePackageBuilderHandle>(null);

  const startPackage = (options?: {
    packageKey?: SteelHomePackageKey;
    startingPoint?: Exclude<SteelHomeStartingPoint, "">;
  }) => packageBuilderRef.current?.startPackage(options);
  const startLabor = () => packageBuilderRef.current?.startLabor();

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
            aria-label="Steel Home Studio, back to top"
          >
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#a94f2e]">
              TradeScout
            </span>
            <span className="hidden h-4 w-px bg-[#18312f]/25 sm:block" aria-hidden="true" />
            <span className="truncate font-editorial text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              {content.header.label}
            </span>
          </button>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Steel Home Studio">
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

          <ActionButton
            onClick={() => startPackage()}
            label="Start a request"
            testId="steel-home-start-request"
            variant="dark"
            className="hidden min-h-10 px-5 sm:inline-flex"
          />
        </div>
      </header>

      <section
        id="top"
        className="relative isolate flex min-h-[730px] scroll-mt-20 items-end overflow-hidden bg-[#152a29] text-white sm:min-h-[820px]"
        data-testid="steel-home-hero"
      >
        <img
          src={content.hero.image}
          alt={content.hero.imageAlt}
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[58%_center]"
          loading="eager"
          decoding="async"
        />
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,22,22,0.9)_0%,rgba(8,22,22,0.62)_46%,rgba(8,22,22,0.12)_78%),linear-gradient(0deg,rgba(8,22,22,0.72)_0%,transparent_48%)]"
          aria-hidden="true"
        />

        <div className="mx-auto w-full max-w-[1440px] px-4 pb-14 pt-28 sm:px-6 sm:pb-20 lg:px-10 lg:pb-24">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0b392]">
              {content.hero.eyebrow}
            </p>
            <h1 className="mt-6 max-w-4xl font-editorial text-6xl font-semibold leading-[0.86] tracking-[-0.055em] text-white sm:text-8xl lg:text-[7.4rem]">
              {content.hero.headline}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/[0.82] sm:text-xl sm:leading-9">
              {content.hero.body}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionButton
                onClick={() => startPackage()}
                label={content.hero.primaryAction}
                testId="steel-home-start-request"
              />
              <ActionButton
                onClick={() => startPackage({ startingPoint: "plans" })}
                label={content.hero.plansAction}
                testId="steel-home-start-request"
                variant="outline"
              />
              <ActionButton
                onClick={startLabor}
                label={content.hero.laborAction}
                testId="steel-home-labor-request"
                variant="outline"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => scrollToSection("#starting-point")}
            className="mt-12 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/75 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Explore your options
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section
        id="starting-point"
        className="scroll-mt-20 border-b border-[#18312f]/10 bg-[#fbf8f1]"
        data-testid="steel-home-starting"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10 lg:py-0">
          <div className="grid lg:grid-cols-[.8fr_3.2fr]">
            <div className="border-[#18312f]/10 pb-8 lg:border-r lg:py-10 lg:pr-8">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
                {content.startingPoints.eyebrow}
              </p>
              <h2 className="mt-3 font-editorial text-3xl font-semibold tracking-[-0.03em]">
                {content.startingPoints.title}
              </h2>
            </div>
            <div className="grid gap-px overflow-hidden border border-[#18312f]/10 bg-[#18312f]/10 sm:grid-cols-2 lg:grid-cols-4 lg:border-y-0 lg:border-r-0">
              {content.startingPoints.items.map((item) => {
                const testId =
                  item.key === "labor"
                    ? "steel-home-labor-request"
                    : item.key === "ideas"
                      ? undefined
                      : "steel-home-start-request";

                if (item.key === "ideas") {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => scrollToSection("#home-ideas")}
                      className={startingPointClassName}
                    >
                      <span className="text-xs font-bold tracking-[0.18em] text-[#a94f2e]">
                        {item.number}
                      </span>
                      <h3 className="mt-7 text-lg font-bold leading-6 tracking-[-0.02em]">
                        {item.title}
                      </h3>
                      <p className="mt-3 flex-1 text-sm leading-6 text-[#66716d]">{item.body}</p>
                      <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#18312f]">
                        {item.action}
                        <ArrowRight
                          className="h-4 w-4 transition group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (item.key === "labor") {
                        startLabor();
                        return;
                      }
                      startPackage({
                        startingPoint: item.key === "plans" ? "plans" : "three-d",
                      });
                    }}
                    data-testid={testId}
                    className={startingPointClassName}
                  >
                    <span className="text-xs font-bold tracking-[0.18em] text-[#a94f2e]">
                      {item.number}
                    </span>
                    <h3 className="mt-7 text-lg font-bold leading-6 tracking-[-0.02em]">
                      {item.title}
                    </h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-[#66716d]">{item.body}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#18312f]">
                      {item.action}
                      <ArrowRight
                        className="h-4 w-4 transition group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="home-ideas"
        className="scroll-mt-20 bg-[#f5f1e8]"
        data-testid="steel-home-home-ideas"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
          <SectionIntro
            eyebrow={content.inspiration.eyebrow}
            title={content.inspiration.title}
            body={content.inspiration.body}
          />

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.45fr_.8fr] lg:grid-rows-2">
            {content.inspiration.items.map((item, index) => (
              <figure
                key={item.key}
                className={`group relative isolate min-h-[360px] overflow-hidden rounded-[1.75rem] bg-[#243d3a] ${
                  index === 0 ? "lg:row-span-2 lg:min-h-[720px]" : "lg:min-h-0"
                }`}
              >
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/5 to-transparent"
                  aria-hidden="true"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f0b392]">
                    {item.label}
                  </p>
                  <h3 className="mt-2 font-editorial text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                    {item.title}
                  </h3>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-xs leading-5 text-[#75807c]">
            {content.inspiration.note}
          </p>
        </div>
      </section>

      <section
        id="build-your-package"
        className="scroll-mt-20 border-y border-[#18312f]/10 bg-[#fbf8f1]"
        data-testid="steel-home-package"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
          <SectionIntro
            eyebrow={content.package.eyebrow}
            title={content.package.title}
            body={content.package.body}
            centered
          />

          <div className="mt-14">
            <SteelHomePackageBuilder
              ref={packageBuilderRef}
              requestHref={requestHref}
              laborRequestHref={laborRequestHref}
            />
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-20 bg-[#e6e2d8]"
        data-testid="steel-home-process"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
          <SectionIntro eyebrow={content.process.eyebrow} title={content.process.title} />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] border border-[#18312f]/10 bg-[#18312f]/10 md:grid-cols-2 xl:grid-cols-4">
            {content.process.items.map((item, index) => (
              <li key={item.title} className="bg-[#f8f5ee] p-7 sm:p-9">
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
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f0b392]">
              {content.labor.eyebrow}
            </p>
            <h2 className="mt-5 max-w-4xl font-editorial text-5xl font-semibold leading-[0.92] tracking-[-0.045em] sm:text-7xl">
              {content.labor.title}
            </h2>
            <p className="mt-7 max-w-3xl text-base leading-8 text-white/[0.72] sm:text-lg">
              {content.labor.body}
            </p>
            <p className="mt-6 max-w-3xl border-l-2 border-[#c9683d] pl-5 text-sm leading-7 text-white/[0.84] sm:text-base">
              {content.labor.support}
            </p>
            <ActionButton
              onClick={startLabor}
              label={content.labor.action}
              testId="steel-home-labor-request"
              variant="light"
              className="mt-9"
            />
          </div>

          <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.06] p-6 sm:p-9">
            <div className="flex items-center gap-3 border-b border-white/12 pb-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#c9683d]">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f0b392]">
                  Based on your jobsite
                </p>
                <p className="mt-1 text-sm text-white/65">A separate location-aware request</p>
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

      <section className="bg-[#f5f1e8]" data-testid="steel-home-final-action">
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
          <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#d8d1c2] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div
              className="absolute inset-0 -z-10 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(24,49,47,0.42)_1px,transparent_1.5px)] [background-size:24px_24px]"
              aria-hidden="true"
            />
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              {content.finalAction.eyebrow}
            </p>
            <h2 className="mx-auto mt-5 max-w-5xl font-editorial text-5xl font-semibold leading-[0.92] tracking-[-0.045em] sm:text-7xl">
              {content.finalAction.headline}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#596763] sm:text-lg">
              {content.finalAction.body}
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ActionButton
                onClick={() => startPackage()}
                label={content.finalAction.packageAction}
                testId="steel-home-start-request"
                variant="dark"
              />
              <ActionButton
                onClick={startLabor}
                label={content.finalAction.laborAction}
                testId="steel-home-labor-request"
                variant="outline"
                className="border-[#18312f]/40 text-[#18312f] hover:border-[#18312f] hover:bg-white/30 focus-visible:ring-[#18312f]"
              />
            </div>
          </div>

          <aside
            className="mx-auto mt-9 max-w-5xl text-center"
            aria-label="Project disclosure"
            data-testid="steel-home-disclosure"
          >
            <p className="text-xs leading-6 text-[#727c78]">{content.disclosure}</p>
          </aside>
        </div>
      </section>

      <TradeScoutProfileHandoff
        profileSlug={identity.slug}
        profileName={identity.displayLabel}
        platformBaseHref={platformBaseHref}
        className="border-t border-white/10"
      />
    </main>
  );
}
