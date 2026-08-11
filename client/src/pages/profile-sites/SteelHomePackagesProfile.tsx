import type { ComponentType, SVGProps } from "react";
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  Building2,
  ExternalLink,
  FileCheck2,
  Gem,
  Hammer,
  HardHat,
  Home,
  MapPin,
  Ruler,
  Wrench,
} from "lucide-react";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import {
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity,
} from "@shared/steelHomePackagesProfile";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Props = {
  requestHref: string;
  laborRequestHref: string;
  platformBaseHref?: string;
};

type RequestLinkProps = {
  href: string;
  label: string;
  testId: string;
  variant?: "primary" | "outline" | "light";
  className?: string;
};

const phaseOneIcons: Icon[] = [Building2, Gem, Boxes];
const audienceIcons: Icon[] = [Home, HardHat, Wrench];

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b24d28]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] text-[#142b33] sm:text-5xl">
        {title}
      </h2>
      {body ? <p className="mt-5 text-base leading-7 text-[#51636a] sm:text-lg">{body}</p> : null}
    </div>
  );
}

function RequestLink({
  href,
  label,
  testId,
  variant = "primary",
  className = "",
}: RequestLinkProps) {
  const variantClass =
    variant === "light"
      ? "bg-white text-[#173640] shadow-[0_14px_34px_rgba(0,0,0,0.18)] hover:bg-[#f4f1ea] focus-visible:ring-white"
      : variant === "outline"
        ? "border border-[#142b33]/25 bg-transparent text-[#142b33] hover:border-[#142b33]/55 hover:bg-white/45 focus-visible:ring-[#142b33]"
        : "bg-[#c8562f] text-white shadow-[0_14px_34px_rgba(114,49,27,0.2)] hover:bg-[#a94324] focus-visible:ring-[#142b33]";

  return (
    <a
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-center text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variantClass} ${className}`}
      data-testid={testId}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

export default function SteelHomePackagesProfile({
  requestHref,
  laborRequestHref,
  platformBaseHref = "",
}: Props) {
  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[#f4f1ea] text-[#142b33]"
      data-testid="steel-home-packages-profile"
      data-profile-slug={identity.slug}
      data-release-state={identity.releaseState}
    >
      <header className="border-b border-[#142b33]/10 bg-[#f4f1ea]/95 backdrop-blur-lg">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-[-0.01em] text-[#142b33] sm:text-base">
              {identity.displayLabel}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[#617179]">
              {content.header.audience}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-[#b24d28]/25 bg-[#b24d28]/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#9b4022]">
            {content.header.status}
          </span>
        </div>
      </header>

      <section className="border-b border-[#142b33]/10" data-testid="steel-home-hero">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b24d28]">
              {content.hero.audience}
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.065em] text-[#142b33] sm:text-7xl lg:text-[5.7rem]">
              {content.hero.headline}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#4e626a] sm:text-xl">
              {content.hero.body}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <RequestLink
                href={requestHref}
                label={content.hero.primaryAction}
                testId="steel-home-start-request"
              />
              <RequestLink
                href={laborRequestHref}
                label={content.hero.laborAction}
                testId="steel-home-labor-request"
                variant="outline"
              />
              <a
                href="#available-now"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-black text-[#365963] transition hover:text-[#142b33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#142b33] focus-visible:ring-offset-2"
              >
                {content.hero.secondaryAction}
                <ArrowDown className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-[2rem] border border-[#14333d]/15 bg-[#dce6e1] p-6 shadow-[0_28px_80px_rgba(37,57,61,0.16)] sm:p-9"
            aria-label="Phase 1 supplier overview"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,51,61,0.18)_1px,transparent_1.5px)] bg-[size:24px_24px] opacity-50"
            />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#365963]">
                  Phase 1 package
                </p>
                <Ruler className="h-5 w-5 text-[#b24d28]" />
              </div>
              <div className="mt-9 space-y-3">
                {content.phaseOnePackage.items.map((item, index) => {
                  const Icon = phaseOneIcons[index] || Hammer;
                  return (
                    <div
                      key={item.key}
                      className="grid grid-cols-[44px_1fr] gap-4 rounded-2xl border border-[#14333d]/15 bg-[#f4f1ea]/90 p-4 shadow-[0_10px_24px_rgba(45,68,70,0.08)] sm:p-5"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#173640] text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-black tracking-[-0.02em] text-[#18343d]">{item.title}</p>
                        <p className="mt-1 text-xs font-bold text-[#b24d28]">{item.partner}</p>
                        <p className="mt-1 text-[11px] leading-5 text-[#60757b]">
                          {item.partnerDetail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-7 max-w-md border-l-2 border-[#b24d28] pl-4 text-sm font-semibold leading-6 text-[#47636b]">
                Material purchasing and local labor are kept as separate requests so every quote has
                a clear owner and scope.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="available-now"
        className="scroll-mt-6 border-b border-[#142b33]/10 bg-[#faf8f3]"
        data-testid="steel-home-available-now"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionIntro
            eyebrow="Phase 1"
            title={content.phaseOnePackage.title}
            body={content.phaseOnePackage.intro}
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {content.phaseOnePackage.items.map((item, index) => {
              const Icon = phaseOneIcons[index] || Hammer;
              const actionHref = item.action
                ? item.action.external
                  ? item.action.href
                  : qualifyPublicProfileItemDestination(item.action.href, platformBaseHref)
                : null;

              return (
                <article
                  key={item.key}
                  className="flex min-h-full flex-col rounded-[1.6rem] border border-[#142b33]/12 bg-white p-6 shadow-[0_16px_45px_rgba(34,53,58,0.07)] sm:p-8"
                  data-testid={`steel-home-partner-${item.key}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <Icon className="h-7 w-7 text-[#b24d28]" />
                    <span className="rounded-full bg-[#e7ece8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#365963]">
                      {item.partnerDetail}
                    </span>
                  </div>
                  <p className="mt-8 text-xs font-black uppercase tracking-[0.16em] text-[#b24d28]">
                    {item.partner}
                  </p>
                  <h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.035em] text-[#18343d]">
                    {item.title}
                  </h3>
                  <p className="mt-4 flex-1 text-sm leading-6 text-[#5a6d73]">{item.body}</p>
                  {item.action && actionHref ? (
                    <a
                      href={actionHref}
                      target={item.action.external ? "_blank" : undefined}
                      rel={item.action.external ? "noreferrer" : undefined}
                      className="mt-7 inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[#142b33]/20 px-4 text-sm font-black text-[#18343d] transition hover:border-[#142b33]/45 hover:bg-[#f4f1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#142b33] focus-visible:ring-offset-2"
                    >
                      {item.action.label}
                      {item.action.external ? (
                        <ExternalLink className="h-4 w-4" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </a>
                  ) : (
                    <span className="mt-7 inline-flex min-h-11 items-center self-start rounded-full bg-[#e7ece8] px-4 text-sm font-black text-[#365963]">
                      Included in the package request
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="border-b border-[#142b33]/10 bg-[#e7ece8]"
        data-testid="steel-home-audiences"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionIntro eyebrow="Who this is for" title={content.audiences.title} />
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {content.audiences.items.map((item, index) => {
              const Icon = audienceIcons[index] || Hammer;
              return (
                <article key={item.title} className="border-l-2 border-[#b24d28]/45 pl-5 sm:pl-7">
                  <Icon className="h-6 w-6 text-[#365963]" />
                  <h3 className="mt-7 text-2xl font-black tracking-[-0.035em] text-[#18343d]">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-[#556970]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="border-b border-[#142b33]/10 bg-[#faf8f3]"
        data-testid="steel-home-process"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionIntro eyebrow="How it works" title={content.process.title} />
          <ol className="mt-12 grid gap-px overflow-hidden rounded-[1.75rem] border border-[#142b33]/12 bg-[#142b33]/12 md:grid-cols-2">
            {content.process.items.map((item, index) => (
              <li key={item.title} className="bg-white p-6 sm:p-9">
                <span className="text-xs font-black tracking-[0.18em] text-[#b24d28]">
                  Step {index + 1}
                </span>
                <h3 className="mt-5 text-xl font-black tracking-[-0.03em] text-[#18343d]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#5a6d73]">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#173640] text-white" data-testid="steel-home-labor">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f0a386]">
              Express Direct Connect work request
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              {content.labor.title}
            </h2>
            <p className="mt-7 max-w-3xl text-base leading-8 text-white/75 sm:text-lg">
              {content.labor.body}
            </p>
            <p className="mt-6 max-w-3xl border-l-2 border-[#f0a386] pl-5 text-sm leading-7 text-white/85 sm:text-base">
              {content.labor.support}
            </p>
            <RequestLink
              href={laborRequestHref}
              label={content.labor.action}
              testId="steel-home-labor-request"
              variant="light"
              className="mt-8"
            />
          </div>

          <div className="rounded-[1.75rem] border border-white/15 bg-[#214550] p-7 sm:p-9">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f0a386]">
              Local work can include
            </p>
            <ul className="mt-6 space-y-3">
              {content.labor.examples.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white/90"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#f0a386]" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-6 text-white/60">
              A request can be labor-only. Buying the Phase 1 package is not required.
            </p>
          </div>
        </div>
      </section>

      <section
        className="border-b border-[#142b33]/10 bg-[#faf8f3]"
        data-testid="steel-home-location"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b24d28]">
              Location and code
            </p>
            <MapPin className="mt-7 h-10 w-10 text-[#365963]" />
          </div>
          <div>
            <h2 className="text-3xl font-black leading-[1.02] tracking-[-0.045em] text-[#142b33] sm:text-5xl">
              {content.location.title}
            </h2>
            <p className="mt-6 text-base leading-8 text-[#52666d]">{content.location.body}</p>
            <div className="mt-8 rounded-2xl border border-[#142b33]/14 bg-[#edf1ed] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <FileCheck2 className="mt-0.5 h-6 w-6 shrink-0 text-[#b24d28]" />
                <p className="text-sm font-semibold leading-7 text-[#29454e]">
                  {content.location.responsibility}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f4f1ea]" data-testid="steel-home-final-action">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] bg-[#dce6e1] shadow-[0_28px_80px_rgba(37,57,61,0.13)]">
            <div className="p-6 sm:p-10 lg:p-14">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b24d28]">
                Start a Request
              </p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.055em] text-[#142b33] sm:text-6xl">
                {content.finalAction.headline}
              </h2>

              <div className="mt-10 grid gap-5 lg:grid-cols-2">
                <article className="flex flex-col rounded-[1.5rem] bg-white p-6 sm:p-8">
                  <Building2 className="h-7 w-7 text-[#b24d28]" />
                  <h3 className="mt-6 text-2xl font-black tracking-[-0.035em] text-[#18343d]">
                    {content.finalAction.packageTitle}
                  </h3>
                  <p className="mt-4 flex-1 text-sm leading-6 text-[#5a6d73]">
                    {content.finalAction.packageBody}
                  </p>
                  <RequestLink
                    href={requestHref}
                    label={content.hero.primaryAction}
                    testId="steel-home-start-request"
                    className="mt-7 self-start"
                  />
                </article>

                <article className="flex flex-col rounded-[1.5rem] bg-[#173640] p-6 text-white sm:p-8">
                  <Wrench className="h-7 w-7 text-[#f0a386]" />
                  <h3 className="mt-6 text-2xl font-black tracking-[-0.035em]">
                    {content.finalAction.laborTitle}
                  </h3>
                  <p className="mt-4 flex-1 text-sm leading-6 text-white/70">
                    {content.finalAction.laborBody}
                  </p>
                  <RequestLink
                    href={laborRequestHref}
                    label={content.hero.laborAction}
                    testId="steel-home-labor-request"
                    variant="light"
                    className="mt-7 self-start"
                  />
                </article>
              </div>

              <p className="mt-6 text-sm font-semibold text-[#365963]">
                {content.finalAction.supportingLine}
              </p>
            </div>
          </div>

          <aside
            className="mx-auto mt-10 max-w-5xl text-center"
            aria-label="Project disclosure"
            data-testid="steel-home-disclosure"
          >
            <p className="text-xs leading-6 text-[#66777d]">{content.disclosure}</p>
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
