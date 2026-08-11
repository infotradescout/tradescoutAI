import type { ComponentType, SVGProps } from "react";
import {
  ArrowDown,
  ArrowRight,
  Blocks,
  Boxes,
  Building2,
  FileCheck2,
  Gem,
  Hammer,
  HardHat,
  Home,
  MapPin,
  Ruler,
  Warehouse,
  Wind,
  Wrench,
} from "lucide-react";
import {
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity,
} from "@shared/steelHomePackagesProfile";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Props = {
  requestHref: string;
  platformBaseHref?: string;
};

const capabilityIcons: Icon[] = [Building2, Boxes, Gem];
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

function StartRequestLink({ requestHref, className = "" }: Props & { className?: string }) {
  return (
    <a
      href={requestHref}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#c8562f] px-6 text-sm font-black text-white shadow-[0_14px_34px_rgba(114,49,27,0.2)] transition hover:bg-[#a94324] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#142b33] focus-visible:ring-offset-2 ${className}`}
      data-testid="steel-home-start-request"
    >
      Start a Request
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

export default function SteelHomePackagesProfile({ requestHref, platformBaseHref = "" }: Props) {
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
          <span className="shrink-0 rounded-full border border-[#b24d28]/[0.25] bg-[#b24d28]/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#9b4022]">
            {content.header.status}
          </span>
        </div>
      </header>

      <section className="border-b border-[#142b33]/10" data-testid="steel-home-hero">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
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
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartRequestLink requestHref={requestHref} />
              <a
                href="#available-now"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#142b33]/20 px-6 text-sm font-black text-[#142b33] transition hover:border-[#142b33]/[0.45] hover:bg-white/[0.45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#142b33] focus-visible:ring-offset-2"
              >
                {content.hero.secondaryAction}
                <ArrowDown className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div
            className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-[#14333d]/[0.15] bg-[#dce6e1] p-6 shadow-[0_28px_80px_rgba(37,57,61,0.16)] sm:min-h-[520px] sm:p-9"
            aria-label="Property-to-package planning overview"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(20,51,61,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(20,51,61,.12) 1px,transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="relative flex h-full min-h-[372px] flex-col justify-between sm:min-h-[448px]">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#365963]">
                  Package planning
                </p>
                <Ruler className="h-5 w-5 text-[#b24d28]" />
              </div>

              <div className="my-10 space-y-3">
                {[
                  ["01", "Property", "Location and project conditions"],
                  ["02", "Plan", "What you want to build"],
                  ["03", "Package", "Confirmed supply scope"],
                  ["04", "Handoff", "Customer or builder receives it"],
                ].map(([number, title, detail], index) => (
                  <div
                    key={title}
                    className={`grid grid-cols-[42px_1fr] gap-3 rounded-2xl border px-4 py-4 sm:grid-cols-[52px_1fr] sm:px-5 ${
                      index === 2
                        ? "border-[#b24d28]/[0.35] bg-[#f4f1ea] shadow-[0_12px_30px_rgba(45,68,70,0.1)]"
                        : "border-[#14333d]/[0.12] bg-[#edf2ee]/75"
                    }`}
                  >
                    <span className="text-xs font-black tracking-[0.16em] text-[#b24d28]">
                      {number}
                    </span>
                    <div>
                      <p className="font-black tracking-[-0.02em] text-[#18343d]">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#60757b]">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="max-w-sm text-sm leading-6 text-[#47636b]">
                One request begins with the real property, the real plan, and the role you will have
                in the build.
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
            eyebrow="Available now"
            title={content.currentCapabilities.title}
            body={content.currentCapabilities.intro}
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {content.currentCapabilities.items.map((item, index) => {
              const Icon = capabilityIcons[index] || Blocks;
              return (
                <article
                  key={item.title}
                  className="rounded-[1.6rem] border border-[#142b33]/[0.12] bg-white p-6 shadow-[0_16px_45px_rgba(34,53,58,0.07)] sm:p-8"
                >
                  <Icon className="h-7 w-7 text-[#b24d28]" />
                  <h3 className="mt-8 text-xl font-black leading-tight tracking-[-0.035em] text-[#18343d]">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-[#5a6d73]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#142b33]/10" data-testid="steel-home-paths">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionIntro eyebrow="Housing paths" title={content.housingPaths.title} />
          <div className="mt-12 divide-y divide-[#142b33]/[0.12] border-y border-[#142b33]/[0.12]">
            {content.housingPaths.items.map((item, index) => (
              <article
                key={item.title}
                className="grid gap-4 py-7 sm:grid-cols-[88px_1fr_160px] sm:items-start sm:gap-7 sm:py-9"
              >
                <span className="text-sm font-black tracking-[0.15em] text-[#b24d28]">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="text-2xl font-black tracking-[-0.04em] text-[#18343d] sm:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5a6d73] sm:text-base sm:leading-7">
                    {item.body}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-[#142b33]/[0.15] bg-[#e6ebe7] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#365963] sm:justify-self-end">
                  {item.status}
                </span>
              </article>
            ))}
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
                <article
                  key={item.title}
                  className="border-l-2 border-[#b24d28]/[0.45] pl-5 sm:pl-7"
                >
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
          <ol className="mt-12 grid gap-px overflow-hidden rounded-[1.75rem] border border-[#142b33]/[0.12] bg-[#142b33]/[0.12] md:grid-cols-2">
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

      <section className="bg-[#173640] text-white" data-testid="steel-home-mechanical">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:px-8">
          <div className="relative min-h-[310px] overflow-hidden rounded-[1.75rem] border border-white/[0.12] bg-[#214550] p-7 sm:min-h-[390px] sm:p-9">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.18) 1px,transparent 1px)",
                backgroundSize: "30px 30px",
              }}
            />
            <div className="relative flex h-full min-h-[252px] flex-col justify-between sm:min-h-[318px]">
              <div className="flex gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f4f1ea] text-[#173640]">
                  <Wind className="h-6 w-6" />
                </span>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#c8562f] text-white">
                  <Warehouse className="h-6 w-6" />
                </span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f0a386]">
                  Design preference, not a blanket promise
                </p>
                <p className="mt-4 max-w-sm text-2xl font-black leading-tight tracking-[-0.04em]">
                  Mechanical choices follow the home, climate, utilities, and code.
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f0a386]">
              Space-saving philosophy
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              {content.mechanical.title}
            </h2>
            <p className="mt-7 max-w-3xl text-base leading-8 text-white/[0.72] sm:text-lg">
              {content.mechanical.body}
            </p>
            <p className="mt-6 max-w-3xl border-l-2 border-[#f0a386] pl-5 text-sm leading-7 text-white/[0.84] sm:text-base">
              {content.mechanical.support}
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
            <div className="mt-8 rounded-2xl border border-[#142b33]/[0.14] bg-[#edf1ed] p-5 sm:p-6">
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

      <section
        className="border-b border-[#142b33]/10 bg-[#e7ece8]"
        data-testid="steel-home-home-id"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[180px_1fr] lg:items-start lg:px-8">
          <div>
            <span className="inline-flex rounded-full border border-[#b24d28]/[0.25] bg-[#b24d28]/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#9b4022]">
              {content.homeId.status}
            </span>
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-[-0.045em] text-[#18343d] sm:text-5xl">
              {content.homeId.title}
            </h2>
            <p className="mt-5 max-w-4xl text-base leading-8 text-[#536970]">
              {content.homeId.body}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f4f1ea]" data-testid="steel-home-final-action">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] bg-[#dce6e1] shadow-[0_28px_80px_rgba(37,57,61,0.13)]">
            <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.1fr_.9fr] lg:p-14">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b24d28]">
                  Start a Request
                </p>
                <h2 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.055em] text-[#142b33] sm:text-6xl">
                  {content.finalAction.headline}
                </h2>
                <p className="mt-6 max-w-2xl text-base leading-8 text-[#4e646b]">
                  {content.finalAction.body}
                </p>
                <StartRequestLink requestHref={requestHref} className="mt-8" />
                <p className="mt-4 text-sm font-semibold text-[#365963]">
                  {content.finalAction.supportingLine}
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#365963]">
                    Project interest
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {content.projectInterests.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-5 text-[#4e646b]">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b24d28]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#365963]">
                    Your role
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {content.customerRoles.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-5 text-[#4e646b]">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b24d28]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
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
