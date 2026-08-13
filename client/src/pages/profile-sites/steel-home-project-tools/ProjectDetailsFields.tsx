import { getAllStates, getCountiesByState } from "@shared/states-counties";
import { PROJECT_TIMING_OPTIONS, type SteelHomeProjectDraft } from "./projectModel";
import { PROJECT_FIELD_CLASS } from "./ProjectToolControls";

type Props = {
  draft: SteelHomeProjectDraft;
  onChange: (draft: SteelHomeProjectDraft) => void;
  className?: string;
};

const STATE_OPTIONS = getAllStates();

export default function ProjectDetailsFields({ draft, onChange, className = "" }: Props) {
  const countyOptions = draft.stateCode ? getCountiesByState(draft.stateCode) : [];
  const update = (values: Partial<SteelHomeProjectDraft>) => onChange({ ...draft, ...values });

  return (
    <fieldset className={className}>
      <legend className="text-sm font-bold text-[#18312f]">Where and when is the project?</legend>
      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm font-bold text-[#18312f] xl:col-span-1">
          <span>Jobsite city, address, or ZIP</span>
          <input
            type="text"
            value={draft.location}
            maxLength={160}
            onChange={(event) => update({ location: event.target.value })}
            placeholder="Where is the jobsite?"
            autoComplete="postal-code"
            className={PROJECT_FIELD_CLASS}
            data-testid="steel-home-project-location"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-[#18312f]">
          <span>State</span>
          <select
            value={draft.stateCode}
            onChange={(event) =>
              update({
                stateCode: event.target.value,
                countyFips: "",
                countyName: "",
              })
            }
            className={PROJECT_FIELD_CLASS}
            data-testid="steel-home-project-state"
          >
            <option value="">Choose state</option>
            {STATE_OPTIONS.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-bold text-[#18312f]">
          <span>County</span>
          <select
            value={draft.countyFips}
            disabled={!draft.stateCode}
            onChange={(event) => {
              const countyFips = event.target.value;
              const county = countyOptions.find((option) => option.fipsCode === countyFips);
              update({ countyFips, countyName: county?.name || "" });
            }}
            className={`${PROJECT_FIELD_CLASS} disabled:cursor-not-allowed disabled:bg-[#ece7de] disabled:text-[#7b8581]`}
            data-testid="steel-home-project-county"
          >
            <option value="">{draft.stateCode ? "Choose county" : "Choose state first"}</option>
            {countyOptions.map((county) => (
              <option key={county.fipsCode} value={county.fipsCode}>
                {county.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-bold text-[#18312f]">
          <span>When do you want to start?</span>
          <select
            value={draft.timing}
            onChange={(event) => update({ timing: event.target.value })}
            className={PROJECT_FIELD_CLASS}
            data-testid="steel-home-project-timing"
          >
            <option value="">Choose a timeframe</option>
            {PROJECT_TIMING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#5e6965]">
        Choose the state and county that match the jobsite entered above.
      </p>
    </fieldset>
  );
}
