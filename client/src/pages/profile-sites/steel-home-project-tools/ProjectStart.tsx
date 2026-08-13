import type { LucideIcon } from "lucide-react";
import { Check, HardHat, Hammer, House, UsersRound } from "lucide-react";
import { PROJECT_ROLE_OPTIONS, type SteelHomeProjectDraft } from "./projectModel";
import ProjectDetailsFields from "./ProjectDetailsFields";

type Props = {
  draft: SteelHomeProjectDraft;
  onChange: (draft: SteelHomeProjectDraft) => void;
};

const ROLE_ICONS: Record<string, LucideIcon> = {
  "self-contracted": Hammer,
  "has-builder": House,
  "builder-or-contractor": HardHat,
  "whole-build-help": UsersRound,
};

function getRoleCopy(option: (typeof PROJECT_ROLE_OPTIONS)[number]) {
  if (option.value === "self-contracted") {
    return {
      label: "Self-contracted homeowner",
      description: "Plan the packages and list the trades you need.",
    };
  }

  return option;
}

export default function ProjectStart({ draft, onChange }: Props) {
  const update = (values: Partial<SteelHomeProjectDraft>) => onChange({ ...draft, ...values });

  return (
    <section
      id="project-start"
      className="scroll-mt-24 bg-[#f5f1e8]"
      data-testid="steel-home-project-setup"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        <div className="rounded-[1.75rem] border border-[#18312f]/10 bg-white/[0.72] p-5 shadow-[0_18px_55px_rgba(24,49,47,0.08)] sm:p-7">
          <div className="flex flex-col gap-3 border-b border-[#18312f]/10 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a94f2e]">
                Project setup
              </p>
              <h2 className="mt-2 font-editorial text-3xl font-semibold tracking-[-0.035em] text-[#18312f] sm:text-4xl">
                Set up the project.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[#5e6965]">
              Tell us who is managing the build, where the jobsite is, and when you want to start.
            </p>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-bold text-[#18312f]">
              Who is contracting the project?
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {PROJECT_ROLE_OPTIONS.map((option) => {
                const selected = option.value === draft.projectRole;
                const copy = getRoleCopy(option);
                const Icon = ROLE_ICONS[String(option.value)] || House;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ projectRole: option.value })}
                    data-testid={`steel-home-project-role-${option.value}`}
                    className={`flex min-h-[5.25rem] items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] focus-visible:ring-offset-2 ${
                      selected
                        ? "border-[#18312f] bg-[#18312f] text-white"
                        : "border-[#18312f]/[0.14] bg-[#f8f4ec] text-[#18312f] hover:border-[#18312f]/40 hover:bg-white"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                        selected ? "bg-[#f0b392] text-[#18312f]" : "bg-[#e7dfd2]"
                      }`}
                    >
                      {selected ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-5">{copy.label}</span>
                      <span
                        className={`mt-1 block text-xs leading-5 ${
                          selected ? "text-white/70" : "text-[#68736f]"
                        }`}
                      >
                        {copy.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <ProjectDetailsFields draft={draft} onChange={onChange} className="mt-6" />
        </div>
      </div>
    </section>
  );
}
