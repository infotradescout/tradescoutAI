import { ArrowRight, Check } from "lucide-react";
import type {
  JwStone2BuyerType,
  JwStone2ColorDirection,
  JwStone2DiscoveryStage,
  JwStone2DiscoveryState,
  JwStone2FilterOption,
  JwStone2FilterOptions,
} from "@/features/jw-stone-2/types";
import { BUYER_WORKSPACES, buyerLabel } from "./buyerWorkspaces";

type ColorChoice = {
  id: JwStone2ColorDirection;
  label: string;
  count: number;
  image: string;
};

type DiscoveryJourneyProps = {
  state: JwStone2DiscoveryState;
  stage: JwStone2DiscoveryStage;
  colorChoices: readonly ColorChoice[];
  filterOptions: JwStone2FilterOptions;
  resultCount: number;
  onChooseBuyer: (buyer: JwStone2BuyerType) => void;
  onChooseColor: (color: JwStone2ColorDirection) => void;
  onChangeBuyer: () => void;
  onChangeColor: () => void;
  onFilter: (key: keyof JwStone2DiscoveryState, value: string | null) => void;
};

const BUYER_ORDER: readonly JwStone2BuyerType[] = [
  "fabricator",
  "builder",
  "designer",
  "homeowner",
];

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  options: readonly JwStone2FilterOption[];
  onChange: (value: string | null) => void;
}) {
  if (!options.length) return null;
  return (
    <label className="jw2-filter" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value || ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export function DiscoveryJourney({
  state,
  stage,
  colorChoices,
  filterOptions,
  resultCount,
  onChooseBuyer,
  onChooseColor,
  onChangeBuyer,
  onChangeColor,
  onFilter,
}: DiscoveryJourneyProps) {
  return (
    <section className="jw2-discovery" aria-labelledby="jw2-discovery-title">
      <div className="jw2-discovery-intro">
        <p className="jw2-eyebrow">A buying path shaped around you</p>
        <h2 id="jw2-discovery-title">Begin with your point of view.</h2>
        <p>
          Choose how you work, then a color direction. The collection opens only after both choices
          are made.
        </p>
      </div>

      <ol className="jw2-progress" aria-label="Stone discovery progress">
        <li className={state.buyer ? "is-complete" : "is-current"}>
          <span>{state.buyer ? <Check aria-hidden="true" size={14} /> : "1"}</span>
          Buyer
        </li>
        <li className={state.color ? "is-complete" : stage === "color" ? "is-current" : ""}>
          <span>{state.color ? <Check aria-hidden="true" size={14} /> : "2"}</span>
          Color
        </li>
        <li className={stage === "results" ? "is-current" : ""}>
          <span>3</span>
          Workspace
        </li>
      </ol>

      {stage === "buyer" ? (
        <div className="jw2-buyer-choices" aria-label="Choose your buyer type">
          {BUYER_ORDER.map((buyer, index) => {
            const copy = BUYER_WORKSPACES[buyer];
            return (
              <button
                className="jw2-buyer-choice"
                type="button"
                key={buyer}
                onClick={() => onChooseBuyer(buyer)}
              >
                <span>0{index + 1}</span>
                <div>
                  <p>{copy.shortLabel}</p>
                  <h3>{copy.label}</h3>
                  <span>{copy.choiceSummary}</span>
                </div>
                <ArrowRight aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}

      {stage === "color" ? (
        <div className="jw2-color-stage">
          <div className="jw2-stage-selection">
            <span>Your path</span>
            <strong>{buyerLabel(state.buyer)}</strong>
            <button type="button" onClick={onChangeBuyer}>
              Change
            </button>
          </div>
          <div className="jw2-color-choices" aria-label="Choose a color direction">
            {colorChoices.map((choice) => (
              <button
                type="button"
                className="jw2-color-choice"
                key={choice.id}
                onClick={() => onChooseColor(choice.id)}
              >
                <img src={choice.image} alt="" loading="lazy" />
                <span>
                  <strong>{choice.label}</strong>
                  <small>
                    {choice.count} current {choice.count === 1 ? "selection" : "selections"}
                  </small>
                </span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {stage === "results" ? (
        <div className="jw2-results-controls">
          <div className="jw2-current-path">
            <div>
              <span>Workspace</span>
              <strong>{buyerLabel(state.buyer)}</strong>
              <button type="button" onClick={onChangeBuyer}>
                Change
              </button>
            </div>
            <div>
              <span>Color direction</span>
              <strong>{colorChoices.find((choice) => choice.id === state.color)?.label}</strong>
              <button type="button" onClick={onChangeColor}>
                Change
              </button>
            </div>
            <p aria-live="polite">
              {resultCount} matching {resultCount === 1 ? "selection" : "selections"}
            </p>
          </div>
          <div className="jw2-filter-row" aria-label="Refine the collection">
            <FilterSelect
              id="jw2-material-filter"
              label="Material"
              value={state.material}
              options={filterOptions.materials}
              onChange={(value) => onFilter("material", value)}
            />
            <FilterSelect
              id="jw2-finish-filter"
              label="Verified finish"
              value={state.finish}
              options={filterOptions.finishes}
              onChange={(value) => onFilter("finish", value)}
            />
            <FilterSelect
              id="jw2-size-filter"
              label="Size"
              value={state.size}
              options={filterOptions.sizes}
              onChange={(value) => onFilter("size", value)}
            />
            <FilterSelect
              id="jw2-availability-filter"
              label="Availability"
              value={state.availability}
              options={filterOptions.availability}
              onChange={(value) => onFilter("availability", value)}
            />
            <FilterSelect
              id="jw2-translucency-filter"
              label="Translucency"
              value={state.translucency}
              options={filterOptions.translucency}
              onChange={(value) => onFilter("translucency", value)}
            />
            {filterOptions.showOrigin ? (
              <FilterSelect
                id="jw2-origin-filter"
                label="Verified origin"
                value={state.origin}
                options={filterOptions.origins}
                onChange={(value) => onFilter("origin", value)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
