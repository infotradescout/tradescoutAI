import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Hammer,
  HardHat,
  Home,
  HousePlug,
  MapPinned,
  PackagePlus,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { STEEL_HOME_PACKAGES_PROFILE_CONTENT as content } from "@shared/steelHomePackagesProfile";
import {
  ADDITIONAL_PROJECT_SCOPE_OPTIONS,
  PROJECT_ROLE_OPTIONS,
  type SteelHomeProjectDraft,
} from "./projectModel";

type Props = {
  draft: SteelHomeProjectDraft;
  onChange: (draft: SteelHomeProjectDraft) => void;
  onNavigate: (target: string) => void;
};

const ROLE_ICONS: Record<(typeof PROJECT_ROLE_OPTIONS)[number]["value"], LucideIcon> = {
  "owner-builder": Hammer,
  "has-builder": Home,
  "builder-or-contractor": HardHat,
  "whole-build-help": Wrench,
};

const SCOPE_ICONS: Partial<
  Record<(typeof ADDITIONAL_PROJECT_SCOPE_OPTIONS)[number]["value"], LucideIcon>
> = {
  "house-plans-and-layout": ClipboardCheck,
  "windows-and-doors": Home,
  insulation: ShieldCheck,
  "interior-framing-and-drywall": Hammer,
  "plumbing-fixtures": Wrench,
  "electrical-fixtures": HousePlug,
  "mini-split-hvac": HousePlug,
  "tankless-water-heating": Wrench,
  appliances: HousePlug,
  "appliance-protection": ShieldCheck,
  "home-and-systems-protection": ShieldCheck,
  "foundation-and-site-work": HardHat,
  "septic-and-utilities": Wrench,
  "installation-and-trade-support": Hammer,
};

const TOOL_LINKS = [
  {
    label: "Design building + roof",
    detail: "Live exterior concept and planning range",
    target: "#building-designer",
  },
  {
    label: "Choose stone or quartz",
    detail: "Actual photographed surface on your layout",
    target: "#countertop-designer",
  },
  {
    label: "Plan the cabinets",
    detail: "Room layout and cabinet planning range",
    target: "#cabinet-designer",
  },
] as const;

export default function ProjectStart({ draft, onChange, onNavigate }: Props) {
  const selectedRole = PROJECT_ROLE_OPTIONS.find((option) => option.value === draft.projectRole);
  const update = (values: Partial<SteelHomeProjectDraft>) => onChange({ ...draft, ...values });
  const toggleScope = (scope: (typeof ADDITIONAL_PROJECT_SCOPE_OPTIONS)[number]["value"]) => {
    const selected = draft.additionalScopes.includes(scope);
    update({
      additionalScopes: selected
        ? draft.additionalScopes.filter((item) => item !== scope)
        : [...draft.additionalScopes, scope],
    });
  };

  return (
    <section
      id="project-start"
      className="scroll-mt-24 bg-[#f5f1e8]"
      data-testid="steel-home-project-start"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,.78fr)_minmax(620px,1.22fr)] xl:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              {content.projectStart.eyebrow}
            </p>
            <h2 className="mt-4 font-editorial text-5xl font-semibold leading-[0.92] tracking-[-0.045em] text-[#18312f] sm:text-7xl">
              {content.projectStart.title}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#5e6965] sm:text-lg">
              {content.projectStart.body}
            </p>

            <div className="mt-9 rounded-[2rem] bg-[#18312f] p-6 text-white shadow-[0_24px_70px_rgba(24,49,47,0.16)] sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f0b392] text-[#18312f]">
                  <MapPinned className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f0b392]">
                    Local review before final price
                  </p>
                  <h3 className="mt-3 font-editorial text-3xl font-semibold tracking-[-0.03em]">
                    The jobsite changes the answer.
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/[0.68]">
                    Structural loads, foundation needs, energy rules, permits, utilities, delivery,
                    and installation are confirmed for the real project location before the final
                    quote. This planning page does not issue code approval or permit drawings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-[#18312f]">How are you building?</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PROJECT_ROLE_OPTIONS.map((option) => {
                const selected = option.value === draft.projectRole;
                const Icon = ROLE_ICONS[option.value];
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ projectRole: option.value })}
                    data-testid={`steel-home-project-role-${option.value}`}
                    className={`group rounded-[1.5rem] border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                      selected
                        ? "border-[#18312f] bg-[#18312f] text-white shadow-[0_18px_50px_rgba(24,49,47,0.16)]"
                        : "border-[#18312f]/10 bg-white/[0.72] text-[#18312f] hover:-translate-y-0.5 hover:border-[#18312f]/35 hover:bg-white"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-full ${
                          selected ? "bg-[#f0b392] text-[#18312f]" : "bg-[#e6ded1]"
                        }`}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      {selected ? (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#18312f]">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-5 block font-editorial text-2xl font-semibold tracking-[-0.025em]">
                      {option.label}
                    </span>
                    <span
                      className={`mt-2 block text-sm leading-6 ${
                        selected ? "text-white/[0.68]" : "text-[#68736f]"
                      }`}
                    >
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 min-h-6 text-sm font-semibold text-[#a94f2e]" aria-live="polite">
              {selectedRole
                ? `${selectedRole.label} added to your plan.`
                : "Choose one path to begin."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {TOOL_LINKS.map((tool) => (
                <button
                  key={tool.target}
                  type="button"
                  onClick={() => onNavigate(tool.target)}
                  className="group rounded-2xl border border-[#18312f]/10 bg-[#ece5d9] p-4 text-left transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-bold text-[#18312f]">
                    {tool.label}
                    <ArrowRight
                      className="h-4 w-4 shrink-0 transition group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[#6b7672]">{tool.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-20 border-t border-[#18312f]/10 pt-16 sm:mt-28 sm:pt-20">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,.7fr)_minmax(600px,1.3fr)] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
                {content.additionalScopes.eyebrow}
              </p>
              <h2 className="mt-4 font-editorial text-5xl font-semibold leading-[0.94] tracking-[-0.045em] text-[#18312f] sm:text-6xl">
                {content.additionalScopes.title}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#5e6965]">
                {content.additionalScopes.body}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#18312f]/10 bg-white p-4">
                <ClipboardCheck className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-2xl font-bold">{draft.additionalScopes.length}</p>
                <p className="mt-1 text-xs leading-5 text-[#68736f]">Added for exact review</p>
              </div>
              <div className="rounded-2xl border border-[#18312f]/10 bg-white p-4">
                <Sparkles className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-2xl font-bold">3</p>
                <p className="mt-1 text-xs leading-5 text-[#68736f]">Working design tools</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-[#18312f]/10 bg-white p-4 sm:col-span-1">
                <CircleDollarSign className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold">No placeholder totals</p>
                <p className="mt-1 text-xs leading-5 text-[#68736f]">Unknown prices stay visible</p>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ADDITIONAL_PROJECT_SCOPE_OPTIONS.map((option) => {
              const selected = draft.additionalScopes.includes(option.value);
              const Icon = SCOPE_ICONS[option.value] || PackagePlus;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleScope(option.value)}
                  data-testid={`steel-home-additional-scope-${option.value}`}
                  className={`group flex min-h-36 items-start gap-4 rounded-[1.5rem] border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                    selected
                      ? "border-[#18312f] bg-[#e0e9e0] shadow-[0_16px_44px_rgba(24,49,47,0.09)]"
                      : "border-[#18312f]/10 bg-white/[0.7] hover:-translate-y-0.5 hover:bg-white"
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                      selected ? "bg-[#18312f] text-white" : "bg-[#ece5d9] text-[#18312f]"
                    }`}
                  >
                    {selected ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#18312f]">{option.label}</span>
                    <span className="mt-2 block text-xs leading-5 text-[#68736f]">
                      {option.description}
                    </span>
                    <span className="mt-3 block text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#a94f2e]">
                      {selected ? "Added to my plan" : "Price after review"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
