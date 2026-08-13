import { Check, ChevronDown, Hammer, HousePlus } from "lucide-react";
import {
  ADDITIONAL_PROJECT_SCOPE_OPTIONS,
  LOCAL_LABOR_OPTIONS,
  type AdditionalProjectScope,
  type SteelHomeProjectDraft,
} from "./projectModel";
import { PROJECT_TEXTAREA_CLASS } from "./ProjectToolControls";

type Props = {
  draft: SteelHomeProjectDraft;
  onChange: (draft: SteelHomeProjectDraft) => void;
};

type NeedGroup = {
  label: string;
  detail: string;
  values: readonly AdditionalProjectScope[];
};

const NEED_GROUPS: readonly NeedGroup[] = [
  {
    label: "Plans, site, and shell",
    detail: "House plans, foundation, windows, doors, and insulation.",
    values: [
      "house-plans-and-layout",
      "foundation-and-site-work",
      "windows-and-doors",
      "insulation",
    ],
  },
  {
    label: "Interior build-out",
    detail: "Framing, drywall, interior doors, trim, and flooring.",
    values: ["interior-framing-and-drywall", "interior-doors-and-trim", "flooring"],
  },
  {
    label: "Home systems",
    detail: "Plumbing, electrical, heating, cooling, hot water, and appliances.",
    values: [
      "plumbing-fixtures",
      "electrical-fixtures",
      "mini-split-hvac",
      "tankless-water-heating",
      "appliances",
    ],
  },
  {
    label: "Utilities, warranties, and installation",
    detail: "Septic, utility connections, service plans, and installation work.",
    values: [
      "septic-and-utilities",
      "appliance-protection",
      "home-and-systems-protection",
      "installation-and-trade-support",
    ],
  },
] as const;

const SCOPE_BY_VALUE = new Map(
  ADDITIONAL_PROJECT_SCOPE_OPTIONS.map((option) => [option.value, option] as const)
);

function selectionTestId(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function WholeHomePlanner({ draft, onChange }: Props) {
  const update = (values: Partial<SteelHomeProjectDraft>) => onChange({ ...draft, ...values });

  const toggleScope = (scope: AdditionalProjectScope) => {
    const selected = draft.additionalScopes.includes(scope);
    update({
      additionalScopes: selected
        ? draft.additionalScopes.filter((item) => item !== scope)
        : [...draft.additionalScopes, scope],
    });
  };

  const toggleTrade = (trade: string) => {
    const selected = draft.labor.trades.includes(trade);
    update({
      labor: {
        ...draft.labor,
        trades: selected
          ? draft.labor.trades.filter((item) => item !== trade)
          : [...draft.labor.trades, trade],
      },
    });
  };

  return (
    <section
      id="whole-home-planner"
      className="scroll-mt-24 bg-[#eee7dc]"
      data-testid="steel-home-whole-home"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        <div className="rounded-[1.75rem] border border-[#18312f]/10 bg-[#fbf8f1] p-5 shadow-[0_18px_55px_rgba(24,49,47,0.07)] sm:p-7">
          <div className="flex flex-col gap-3 border-b border-[#18312f]/10 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a94f2e]">
                Whole Home
              </p>
              <h2 className="mt-2 font-editorial text-3xl font-semibold tracking-[-0.035em] text-[#18312f] sm:text-4xl">
                Add the rest of the home.
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <p className="max-w-lg text-sm leading-6 text-[#5e6965]">
                Choose the other parts of the home you want quoted.
              </p>
              <span className="shrink-0 rounded-full bg-[#18312f] px-3 py-1.5 text-xs font-bold text-white">
                {draft.additionalScopes.length} selected
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {NEED_GROUPS.map((group, index) => {
              const selectedCount = group.values.filter((value) =>
                draft.additionalScopes.includes(value)
              ).length;

              return (
                <details
                  key={group.label}
                  open={index === 0 || selectedCount > 0}
                  className="group rounded-2xl border border-[#18312f]/[0.14] bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7dfd2] text-[#18312f]">
                      <HousePlus className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#18312f]">{group.label}</span>
                        {selectedCount > 0 ? (
                          <span className="rounded-full bg-[#dfe8df] px-2 py-0.5 text-[0.68rem] font-bold text-[#18312f]">
                            {selectedCount} chosen
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#68736f]">
                        {group.detail}
                      </span>
                    </span>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-[#68736f] transition group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>

                  <div className="grid gap-2 border-t border-[#18312f]/10 p-3 sm:grid-cols-2">
                    {group.values.map((value) => {
                      const option = SCOPE_BY_VALUE.get(value);
                      if (!option) return null;
                      const selected = draft.additionalScopes.includes(value);

                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleScope(value)}
                          data-testid={`steel-home-additional-scope-${value}`}
                          className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                            selected
                              ? "border-[#18312f] bg-[#e0e9e0] text-[#18312f]"
                              : "border-[#18312f]/10 bg-[#f8f4ec] text-[#41514d] hover:border-[#18312f]/35 hover:bg-white"
                          }`}
                        >
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                              selected ? "bg-[#18312f] text-white" : "bg-[#18312f]/10"
                            }`}
                          >
                            {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                          </span>
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="mt-6 grid gap-5 border-t border-[#18312f]/10 pt-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
            <fieldset>
              <legend className="flex items-center gap-2 text-sm font-bold text-[#18312f]">
                <Hammer className="h-4 w-4 text-[#a94f2e]" aria-hidden="true" />
                Local trade help
              </legend>
              <p className="mt-1 text-xs leading-5 text-[#68736f]">
                Select the work you want local trade help with.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {LOCAL_LABOR_OPTIONS.map((trade) => {
                  const selected = draft.labor.trades.includes(trade);
                  return (
                    <button
                      key={trade}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleTrade(trade)}
                      data-testid={`steel-home-labor-${selectionTestId(trade)}`}
                      className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                        selected
                          ? "border-[#18312f] bg-[#18312f] text-white"
                          : "border-[#18312f]/[0.15] bg-white text-[#41514d] hover:border-[#18312f]/40"
                      }`}
                    >
                      {trade}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="block space-y-2 text-sm font-bold text-[#18312f]">
              <span>Notes for the project</span>
              <textarea
                value={draft.labor.notes}
                maxLength={240}
                onChange={(event) =>
                  update({ labor: { ...draft.labor, notes: event.target.value } })
                }
                placeholder="Access, schedule, completed work, or anything else we should know."
                className={PROJECT_TEXTAREA_CLASS}
                data-testid="steel-home-labor-notes"
              />
              <span className="block text-right text-xs font-normal text-[#7a8581]">
                {draft.labor.notes.length}/240
              </span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
