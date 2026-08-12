import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  DraftingCompass,
  Layers3,
  Ruler,
  Save,
  Sparkles,
} from "lucide-react";
import {
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity,
} from "@shared/steelHomePackagesProfile";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";
import BuildingDesigner from "./steel-home-project-tools/BuildingDesigner";
import CabinetDesigner from "./steel-home-project-tools/CabinetDesigner";
import CountertopDesigner from "./steel-home-project-tools/CountertopDesigner";
import SteelHomeProjectReview from "./steel-home-project-tools/SteelHomeProjectReview";
import {
  clearSteelHomeProjectDraft,
  createEmptySteelHomeProjectDraft,
  loadSteelHomeProjectDraft,
  reconcileSteelHomeProjectDraft,
  saveSteelHomeProjectDraft,
  type SteelHomeProjectDraft,
} from "./steel-home-project-tools/projectModel";

type Props = {
  requestHref: string;
  laborRequestHref: string;
  platformBaseHref?: string;
};

type LinkVariant = "primary" | "outline" | "light" | "dark";

const TOOL_TARGETS = {
  building: "#building-designer",
  countertops: "#countertop-designer",
  cabinets: "#cabinet-designer",
} as const;

const TOOL_ICONS = {
  building: DraftingCompass,
  countertops: Sparkles,
  cabinets: Layers3,
} as const;

function scrollToSection(target: string) {
  const element = document.getElementById(target.replace(/^#/, ""));
  if (!element) return;
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
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

export default function SteelHomePackagesProfile({
  requestHref,
  laborRequestHref,
  platformBaseHref = "",
}: Props) {
  const [draft, setDraft] = useState<SteelHomeProjectDraft>(() =>
    createEmptySteelHomeProjectDraft()
  );
  const [storageReady, setStorageReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const skipNextSave = useRef(false);

  useEffect(() => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    setDraft(loadSteelHomeProjectDraft(storage));
    setStorageReady(true);
    setSaved(Boolean(storage));
  }, []);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaved(saveSteelHomeProjectDraft(window.localStorage, draft));
  }, [draft, storageReady]);

  const updateDraft = useCallback((nextDraft: SteelHomeProjectDraft) => {
    setSaved(false);
    setDraft(reconcileSteelHomeProjectDraft(nextDraft));
  }, []);

  const updateBuilding = useCallback((building: SteelHomeProjectDraft["building"]) => {
    setSaved(false);
    setDraft((current) => reconcileSteelHomeProjectDraft({ ...current, building }));
  }, []);

  const updateCountertops = useCallback((countertops: SteelHomeProjectDraft["countertops"]) => {
    setSaved(false);
    setDraft((current) => reconcileSteelHomeProjectDraft({ ...current, countertops }));
  }, []);

  const updateCabinets = useCallback((cabinets: SteelHomeProjectDraft["cabinets"]) => {
    setSaved(false);
    setDraft((current) => reconcileSteelHomeProjectDraft({ ...current, cabinets }));
  }, []);

  const resetDraft = useCallback(() => {
    const confirmed =
      typeof window === "undefined" ||
      typeof window.confirm !== "function" ||
      window.confirm("Reset the building, countertop, cabinet, and labor planning draft?");
    if (!confirmed) return;

    skipNextSave.current = true;
    if (typeof window !== "undefined") clearSteelHomeProjectDraft(window.localStorage);
    setDraft(createEmptySteelHomeProjectDraft());
    setSaved(true);
  }, []);

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
            aria-label="Steel Home Project Tools, back to top"
          >
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#a94f2e]">
              TradeScout
            </span>
            <span className="hidden h-4 w-px bg-[#18312f]/25 sm:block" aria-hidden="true" />
            <span className="truncate font-editorial text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              {content.header.label}
            </span>
          </button>

          <nav className="hidden items-center gap-6 xl:flex" aria-label="Project tools">
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
            target="#project-review"
            label="Review project"
            testId="steel-home-header-review"
            variant="dark"
            className="hidden sm:inline-flex"
          />
        </div>
      </header>

      <section
        id="top"
        className="relative scroll-mt-24 overflow-hidden bg-[#18312f] text-white"
        data-testid="steel-home-hero"
      >
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#c9683d]/[0.35] blur-3xl" />
          <div className="absolute right-0 top-0 h-[34rem] w-[34rem] rounded-full bg-[#78958d]/[0.35] blur-3xl" />
        </div>
        <div className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-[1440px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,.82fr)_minmax(520px,1.18fr)] lg:items-center lg:px-10">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0b392]">
              {content.hero.eyebrow}
            </p>
            <h1 className="mt-6 font-editorial text-[clamp(3.7rem,7.4vw,8rem)] font-semibold leading-[0.82] tracking-[-0.055em]">
              {content.hero.headline}
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-white/[0.72] sm:text-xl">
              {content.hero.body}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ScrollButton
                target="#project-tools"
                label={content.hero.primaryAction}
                testId="steel-home-hero-tools"
                variant="light"
                down
              />
              <ScrollButton
                target="#project-review"
                label={content.hero.reviewAction}
                testId="steel-home-hero-review"
                variant="outline"
                className="border-white/30 text-white hover:border-white hover:bg-white/10 focus-visible:ring-white"
              />
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/60">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#f0b392]" aria-hidden="true" />
                Working live visuals
              </span>
              <span className="inline-flex items-center gap-2">
                <Ruler className="h-4 w-4 text-[#f0b392]" aria-hidden="true" />
                Measurements carried forward
              </span>
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4 text-[#f0b392]" aria-hidden="true" />
                Draft saved in this browser
              </span>
            </div>
          </div>

          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
            aria-label="Available project tools"
          >
            {content.hero.visuals.map((visual, index) => {
              const target = TOOL_TARGETS[visual.key];
              return (
                <button
                  key={visual.key}
                  type="button"
                  onClick={() => scrollToSection(target)}
                  data-testid={`steel-home-hero-tool-${visual.key}`}
                  className={`group relative min-h-[16rem] overflow-hidden rounded-[2rem] border border-white/10 text-left shadow-[0_24px_80px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b392] ${
                    index === 0 ? "sm:col-span-2 lg:col-span-6" : "lg:col-span-3"
                  }`}
                >
                  <img
                    src={visual.image}
                    alt={visual.imageAlt}
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                    decoding="async"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-6">
                    <span className="block text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#f0b392]">
                      {visual.label}
                    </span>
                    <span className="mt-2 flex items-end justify-between gap-4">
                      <span className="font-editorial text-3xl font-semibold tracking-[-0.03em] text-white">
                        {visual.title}
                      </span>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#18312f] transition group-hover:translate-x-1">
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="project-tools"
        className="scroll-mt-24 bg-[#f5f1e8]"
        data-testid="steel-home-tools-intro"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              {content.toolIntro.eyebrow}
            </p>
            <h2 className="mt-4 font-editorial text-5xl font-semibold leading-[0.92] tracking-[-0.045em] text-[#18312f] sm:text-7xl">
              {content.toolIntro.title}
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[#5e6965] sm:text-lg">
              {content.toolIntro.body}
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {content.tools.cards.map((tool) => {
              const Icon = TOOL_ICONS[tool.key];
              return (
                <button
                  key={tool.key}
                  type="button"
                  onClick={() => scrollToSection(TOOL_TARGETS[tool.key])}
                  data-testid={`steel-home-tool-card-${tool.key}`}
                  className="group rounded-[2rem] border border-[#18312f]/10 bg-white/[0.65] p-6 text-left transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_22px_70px_rgba(24,49,47,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] sm:p-8"
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#18312f] text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-editorial text-4xl font-semibold text-[#18312f]/20">
                      {tool.number}
                    </span>
                  </span>
                  <span className="mt-7 block text-xs font-black uppercase tracking-[0.16em] text-[#a94f2e]">
                    {tool.label}
                  </span>
                  <span className="mt-2 block font-editorial text-3xl font-semibold tracking-[-0.03em]">
                    {tool.title}
                  </span>
                  <span className="mt-4 block text-sm leading-7 text-[#68736f]">{tool.body}</span>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#18312f]">
                    {tool.action}
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
      </section>

      <BuildingDesigner design={draft.building} onChange={updateBuilding} />
      <CountertopDesigner design={draft.countertops} onChange={updateCountertops} />
      <CabinetDesigner design={draft.cabinets} onChange={updateCabinets} />
      <SteelHomeProjectReview
        draft={draft}
        requestHref={requestHref}
        laborRequestHref={laborRequestHref}
        saved={saved}
        onChange={updateDraft}
        onReset={resetDraft}
      />

      <TradeScoutProfileHandoff
        profileSlug={identity.slug}
        profileName={identity.displayLabel}
        itemName="Steel-home project tools"
        platformBaseHref={platformBaseHref}
      />
    </main>
  );
}
