/* eslint-disable no-restricted-syntax -- Catalog color swatches require their measured hex values. */
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Plus, Send, Trash2 } from "lucide-react";
import type { SteelHomeBuildingDesign } from "./projectModel";
import {
  BUILDING_ACCESSORIES,
  BUILDING_ATTACHMENTS,
  BUILDING_CATALOG_REVIEWED_ON,
  BUILDING_COLORS,
  BUILDING_OPENINGS,
  BUILDING_ROOFS,
  BUILDING_SYSTEMS,
  BUILDING_USES,
  getBuildingAccessory,
  getBuildingAttachment,
  getBuildingOpening,
  type BuildingAccessoryTypeId,
  type BuildingAttachmentTypeId,
  type BuildingOpeningTypeId,
  type BuildingSurface,
  type BuildingWall,
} from "./buildingCatalog";
import {
  buildBuildingMeasuredScene,
  buildBuildingPlannerRequest,
  createEmptyBuildingPlannerExtension,
  projectBuildingExtensionToLegacy,
  sanitizeBuildingPlannerExtension,
  type BuildingPlannerExtensionV1,
  type BuildingPlannerRequest,
} from "./buildingPlannerModel";
import BuildingThreePreview from "./BuildingThreePreview";
import { PROJECT_FIELD_CLASS, PROJECT_TEXTAREA_CLASS } from "./ProjectToolControls";

export type BuildingDesignerProps = {
  /** Legacy shell remains for route compatibility; it is updated only after a valid request. */
  design: SteelHomeBuildingDesign;
  onChange: (design: SteelHomeBuildingDesign) => void;
  onRequest: () => void;
  /** Persist this versioned extension beside the legacy draft; omit for local blank-state use. */
  extension?: BuildingPlannerExtensionV1;
  onExtensionChange?: (extension: BuildingPlannerExtensionV1) => void;
  /** Optional structured handoff for integrations that can accept the measured request. */
  onPlannerRequest?: (request: BuildingPlannerRequest) => void;
};

type PlannerUpdater = (
  updater: (current: BuildingPlannerExtensionV1) => BuildingPlannerExtensionV1
) => void;

function NullableNumberField({
  label,
  value,
  onChange,
  suffix,
  testId,
  min = 0,
  max,
  step = 0.5,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix: string;
  testId?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="space-y-2 text-sm font-bold text-[#18312f]">
      <span>{label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          min={min}
          max={max}
          step={step}
          placeholder="Enter"
          onChange={(event) => {
            if (event.target.value === "") {
              onChange(null);
              return;
            }
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          className={`${PROJECT_FIELD_CLASS} pr-16`}
          data-testid={testId}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#71807b]">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  placeholder,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T | null;
  placeholder: string;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | null) => void;
  testId?: string;
}) {
  return (
    <label className="space-y-2 text-sm font-bold text-[#18312f]">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value ? (event.target.value as T) : null)}
        className={PROJECT_FIELD_CLASS}
        data-testid={testId}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[0.67rem] font-black uppercase tracking-[0.18em] text-[#a94f2e]">{step}</p>
      <h3 className="mt-1 text-lg font-black text-[#18312f]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#65736e]">{description}</p>
    </div>
  );
}

const WALL_OPTIONS: readonly { value: BuildingWall; label: string }[] = [
  { value: "front", label: "Front elevation" },
  { value: "right", label: "Right elevation" },
  { value: "rear", label: "Rear elevation" },
  { value: "left", label: "Left elevation" },
];

function ShellSection({
  planner,
  update,
}: {
  planner: BuildingPlannerExtensionV1;
  update: PlannerUpdater;
}) {
  const setDetail = <Key extends keyof BuildingPlannerExtensionV1["roofDetails"]>(
    key: Key,
    value: BuildingPlannerExtensionV1["roofDetails"][Key]
  ) =>
    update((current) => ({
      ...current,
      roofDetails: { ...current.roofDetails, [key]: value },
    }));
  return (
    <section className="rounded-2xl border border-[#18312f]/10 bg-white p-5">
      <SectionHeading
        step="2 · Measured shell"
        title="Frame, footprint, and roof"
        description="Every number is planning intent. Published frame ranges are guidance, not a promise of availability."
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Structural system"
          value={planner.systemId}
          placeholder="Choose a system"
          options={BUILDING_SYSTEMS.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(systemId) => update((current) => ({ ...current, systemId }))}
          testId="building-system"
        />
        <SelectField
          label="Roof family"
          value={planner.roofId}
          placeholder="Choose a roof"
          options={BUILDING_ROOFS.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(roofId) => update((current) => ({ ...current, roofId }))}
          testId="building-roof"
        />
        <NullableNumberField
          label="Width"
          value={planner.widthFt}
          onChange={(widthFt) => update((current) => ({ ...current, widthFt }))}
          suffix="ft"
          min={1}
          testId="building-width"
        />
        <NullableNumberField
          label="Length"
          value={planner.lengthFt}
          onChange={(lengthFt) => update((current) => ({ ...current, lengthFt }))}
          suffix="ft"
          min={1}
          testId="building-length"
        />
        <NullableNumberField
          label="Eave height"
          value={planner.eaveHeightFt}
          onChange={(eaveHeightFt) => update((current) => ({ ...current, eaveHeightFt }))}
          suffix="ft"
          min={1}
          testId="building-eave-height"
        />
        <NullableNumberField
          label="Roof pitch"
          value={planner.roofPitchRise12}
          onChange={(roofPitchRise12) => update((current) => ({ ...current, roofPitchRise12 }))}
          suffix=":12"
          min={0.25}
          max={12}
          step={0.25}
          testId="building-roof-pitch"
        />
      </div>
      {planner.roofId === "single-slope" ? (
        <div className="mt-4">
          <SelectField
            label="High side"
            value={planner.roofDetails.singleSlopeHighSide}
            placeholder="Choose left or right"
            options={[
              { value: "left", label: "Left elevation" },
              { value: "right", label: "Right elevation" },
            ]}
            onChange={(value) => setDetail("singleSlopeHighSide", value)}
          />
        </div>
      ) : null}
      {planner.roofId === "monitor" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NullableNumberField
            label="Monitor width"
            value={planner.roofDetails.monitorWidthFt}
            onChange={(value) => setDetail("monitorWidthFt", value)}
            suffix="ft"
          />
          <NullableNumberField
            label="Monitor rise above shoulder"
            value={planner.roofDetails.monitorHeightFt}
            onChange={(value) => setDetail("monitorHeightFt", value)}
            suffix="ft"
          />
        </div>
      ) : null}
      {planner.roofId === "gambrel" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NullableNumberField
            label="Break inset from each wall"
            value={planner.roofDetails.gambrelBreakInsetFt}
            onChange={(value) => setDetail("gambrelBreakInsetFt", value)}
            suffix="ft"
          />
          <NullableNumberField
            label="Upper pitch"
            value={planner.roofDetails.secondaryPitchRise12}
            onChange={(value) => setDetail("secondaryPitchRise12", value)}
            suffix=":12"
            step={0.25}
          />
        </div>
      ) : null}
      {planner.roofId === "asymmetrical" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NullableNumberField
            label="Ridge offset from left"
            value={planner.roofDetails.asymmetricalRidgeOffsetFt}
            onChange={(value) => setDetail("asymmetricalRidgeOffsetFt", value)}
            suffix="ft"
          />
          <NullableNumberField
            label="Right plane pitch"
            value={planner.roofDetails.secondaryPitchRise12}
            onChange={(value) => setDetail("secondaryPitchRise12", value)}
            suffix=":12"
            step={0.25}
          />
        </div>
      ) : null}
      {planner.roofId === "hip" ? (
        <label className="mt-4 flex cursor-pointer gap-3 rounded-xl border border-[#18312f]/12 bg-[#f5f7f5] p-4 text-sm text-[#18312f]">
          <input
            type="checkbox"
            checked={planner.roofDetails.hipCenteredEqualPitchAccepted}
            onChange={(event) => setDetail("hipCenteredEqualPitchAccepted", event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#a94f2e]"
          />
          <span>
            <span className="block font-bold">Use a centered, equal-pitch hip for planning</span>
            <span className="mt-1 block text-xs leading-5 text-[#65736e]">
              Final ridge length and framing remain engineering-dependent.
            </span>
          </span>
        </label>
      ) : null}
    </section>
  );
}

function ColorSection({
  planner,
  update,
}: {
  planner: BuildingPlannerExtensionV1;
  update: PlannerUpdater;
}) {
  return (
    <section className="rounded-2xl border border-[#18312f]/10 bg-white p-5">
      <SectionHeading
        step="3 · Finish direction"
        title="Exterior colors"
        description="Optional planning direction only. Exact panel profile, coating, match, and availability are confirmed in writing."
      />
      {(["wall", "roof", "trim"] as const).map((surface) => (
        <fieldset key={surface} className="mt-5">
          <legend className="text-sm font-bold capitalize text-[#18312f]">{surface} color</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {BUILDING_COLORS.map((color) => {
              const selected = planner.colors[surface] === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${surface} color: ${color.label}`}
                  title={color.label}
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      colors: { ...current.colors, [surface]: color.id },
                    }))
                  }
                  className={`grid h-11 w-11 place-items-center rounded-full border-2 transition ${
                    selected
                      ? "border-[#18312f]"
                      : "border-white shadow-[0_0_0_1px_rgba(24,49,47,.2)]"
                  }`}
                  style={{ backgroundColor: color.hex }}
                  data-testid={`building-${surface}-color-${color.id}`}
                >
                  {selected ? (
                    <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </section>
  );
}

function OpeningsSection({
  planner,
  update,
  nextId,
}: {
  planner: BuildingPlannerExtensionV1;
  update: PlannerUpdater;
  nextId: () => string;
}) {
  const [typeToAdd, setTypeToAdd] = useState<BuildingOpeningTypeId | null>(null);
  const add = () => {
    if (!typeToAdd) return;
    const catalog = getBuildingOpening(typeToAdd);
    update((current) => ({
      ...current,
      openings: [
        ...current.openings,
        {
          id: nextId(),
          typeId: typeToAdd,
          surface: catalog?.surfaces.length === 1 && catalog.surfaces[0] === "roof" ? "roof" : null,
          widthFt: null,
          heightFt: null,
          offsetFt: null,
          sillHeightFt: null,
          roofXFt: null,
          roofZFt: null,
        },
      ],
    }));
    setTypeToAdd(null);
  };
  const change = (id: string, patch: Partial<BuildingPlannerExtensionV1["openings"][number]>) =>
    update((current) => ({
      ...current,
      openings: current.openings.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  return (
    <section className="rounded-2xl border border-[#18312f]/10 bg-white p-5">
      <SectionHeading
        step="4 · Opening schedule"
        title="Place every opening"
        description="Counts are not enough. Give each door, window, louver, framed opening, hangar opening, or skylight a surface, size, and location."
      />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <SelectField
            label="Opening type"
            value={typeToAdd}
            placeholder="Choose an opening"
            options={BUILDING_OPENINGS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={setTypeToAdd}
            testId="building-opening-type-to-add"
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!typeToAdd}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#18312f] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="building-add-opening"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add opening
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {planner.openings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#18312f]/20 bg-[#f7f8f6] p-4 text-sm text-[#687570]">
            No openings added.
          </p>
        ) : null}
        {planner.openings.map((opening, index) => {
          const catalog = getBuildingOpening(opening.typeId);
          const surfaceOptions = (catalog?.surfaces ?? []).map((surface) => ({
            value: surface,
            label:
              surface === "roof"
                ? "Roof plan"
                : `${surface[0].toUpperCase()}${surface.slice(1)} elevation`,
          }));
          return (
            <article
              key={opening.id}
              className="rounded-xl border border-[#18312f]/12 bg-[#faf9f5] p-4"
              data-testid={`building-opening-row-${index}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#18312f]">{catalog?.label ?? "Opening"}</p>
                  <p className="text-xs text-[#71807b]">Opening {index + 1}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${catalog?.label ?? "opening"}`}
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      openings: current.openings.filter((item) => item.id !== opening.id),
                    }))
                  }
                  className="grid h-10 w-10 place-items-center rounded-full text-[#8a3d28] hover:bg-[#f5e5de]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Surface"
                  value={opening.surface}
                  placeholder="Choose a surface"
                  options={surfaceOptions}
                  onChange={(surface) => change(opening.id, { surface })}
                />
                <NullableNumberField
                  label={opening.surface === "roof" ? "Roof X size" : "Width"}
                  value={opening.widthFt}
                  suffix="ft"
                  onChange={(widthFt) => change(opening.id, { widthFt })}
                />
                <NullableNumberField
                  label={opening.surface === "roof" ? "Roof Z size" : "Height"}
                  value={opening.heightFt}
                  suffix="ft"
                  onChange={(heightFt) => change(opening.id, { heightFt })}
                />
                {opening.surface === "roof" ? (
                  <>
                    <NullableNumberField
                      label="X from left wall"
                      value={opening.roofXFt}
                      suffix="ft"
                      onChange={(roofXFt) => change(opening.id, { roofXFt })}
                    />
                    <NullableNumberField
                      label="Z from front wall"
                      value={opening.roofZFt}
                      suffix="ft"
                      onChange={(roofZFt) => change(opening.id, { roofZFt })}
                    />
                  </>
                ) : (
                  <>
                    <NullableNumberField
                      label="Offset from elevation left"
                      value={opening.offsetFt}
                      suffix="ft"
                      onChange={(offsetFt) => change(opening.id, { offsetFt })}
                    />
                    <NullableNumberField
                      label="Sill above floor"
                      value={opening.sillHeightFt}
                      suffix="ft"
                      onChange={(sillHeightFt) => change(opening.id, { sillHeightFt })}
                    />
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AttachmentsSection({
  planner,
  update,
  nextId,
}: {
  planner: BuildingPlannerExtensionV1;
  update: PlannerUpdater;
  nextId: () => string;
}) {
  const [typeToAdd, setTypeToAdd] = useState<BuildingAttachmentTypeId | null>(null);
  const add = () => {
    if (!typeToAdd) return;
    update((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        {
          id: nextId(),
          typeId: typeToAdd,
          wall: null,
          offsetFt: null,
          widthFt: null,
          projectionFt: null,
          eaveHeightFt: null,
          roofPitchRise12: null,
        },
      ],
    }));
    setTypeToAdd(null);
  };
  const change = (id: string, patch: Partial<BuildingPlannerExtensionV1["attachments"][number]>) =>
    update((current) => ({
      ...current,
      attachments: current.attachments.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  return (
    <section className="rounded-2xl border border-[#18312f]/10 bg-white p-5">
      <SectionHeading
        step="5 · Attachments"
        title="Place attached roofs and additions"
        description="A footprint can be saved before its height is known. The 3D view keeps it footprint-only until eave height and connection pitch are entered."
      />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <SelectField
            label="Attachment type"
            value={typeToAdd}
            placeholder="Choose an attachment"
            options={BUILDING_ATTACHMENTS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={setTypeToAdd}
            testId="building-attachment-type-to-add"
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!typeToAdd}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#18312f] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="building-add-attachment"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add attachment
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {planner.attachments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#18312f]/20 bg-[#f7f8f6] p-4 text-sm text-[#687570]">
            No attachments added.
          </p>
        ) : null}
        {planner.attachments.map((attachment, index) => {
          const catalog = getBuildingAttachment(attachment.typeId);
          const verticalResolved =
            !catalog?.requiresVerticalGeometry ||
            Boolean(attachment.eaveHeightFt && attachment.roofPitchRise12);
          return (
            <article
              key={attachment.id}
              className="rounded-xl border border-[#18312f]/12 bg-[#faf9f5] p-4"
              data-testid={`building-attachment-row-${index}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#18312f]">
                    {catalog?.label ?? "Attachment"}
                  </p>
                  {!verticalResolved ? (
                    <p className="mt-1 text-xs font-semibold text-[#8a3d28]">
                      Footprint only — height and roof connection unresolved
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${catalog?.label ?? "attachment"}`}
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      attachments: current.attachments.filter((item) => item.id !== attachment.id),
                    }))
                  }
                  className="grid h-10 w-10 place-items-center rounded-full text-[#8a3d28] hover:bg-[#f5e5de]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Host wall"
                  value={attachment.wall}
                  placeholder="Choose a wall"
                  options={WALL_OPTIONS}
                  onChange={(wall) => change(attachment.id, { wall })}
                />
                <NullableNumberField
                  label="Offset from elevation left"
                  value={attachment.offsetFt}
                  suffix="ft"
                  onChange={(offsetFt) => change(attachment.id, { offsetFt })}
                />
                <NullableNumberField
                  label="Width along host wall"
                  value={attachment.widthFt}
                  suffix="ft"
                  onChange={(widthFt) => change(attachment.id, { widthFt })}
                />
                <NullableNumberField
                  label="Projection"
                  value={attachment.projectionFt}
                  suffix="ft"
                  onChange={(projectionFt) => change(attachment.id, { projectionFt })}
                />
                {catalog?.requiresVerticalGeometry ? (
                  <>
                    <NullableNumberField
                      label="Attachment eave height"
                      value={attachment.eaveHeightFt}
                      suffix="ft"
                      onChange={(eaveHeightFt) => change(attachment.id, { eaveHeightFt })}
                    />
                    <NullableNumberField
                      label="Attachment roof pitch"
                      value={attachment.roofPitchRise12}
                      suffix=":12"
                      step={0.25}
                      onChange={(roofPitchRise12) => change(attachment.id, { roofPitchRise12 })}
                    />
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AccessoriesSection({
  planner,
  update,
  nextId,
}: {
  planner: BuildingPlannerExtensionV1;
  update: PlannerUpdater;
  nextId: () => string;
}) {
  const [typeToAdd, setTypeToAdd] = useState<BuildingAccessoryTypeId | null>(null);
  const add = () => {
    if (!typeToAdd) return;
    const catalog = getBuildingAccessory(typeToAdd);
    update((current) => ({
      ...current,
      accessories: [
        ...current.accessories,
        {
          id: nextId(),
          typeId: typeToAdd,
          surface: catalog?.placement === "whole-building" ? "whole-building" : null,
          offsetFt: null,
          secondaryOffsetFt: null,
          elevationFt: null,
        },
      ],
    }));
    setTypeToAdd(null);
  };
  const change = (id: string, patch: Partial<BuildingPlannerExtensionV1["accessories"][number]>) =>
    update((current) => ({
      ...current,
      accessories: current.accessories.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  return (
    <section className="rounded-2xl border border-[#18312f]/10 bg-white p-5">
      <SectionHeading
        step="6 · Accessories"
        title="Add quote-review requirements"
        description="Wall and roof choices use exact placement markers, not guessed product geometry. Products, sizes, compatibility, quantities, and availability remain quote-required."
      />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <SelectField
            label="Accessory"
            value={typeToAdd}
            placeholder="Choose an accessory"
            options={BUILDING_ACCESSORIES.map((item) => ({ value: item.id, label: item.label }))}
            onChange={setTypeToAdd}
            testId="building-accessory-type-to-add"
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!typeToAdd}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#18312f] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="building-add-accessory"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add accessory
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {planner.accessories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#18312f]/20 bg-[#f7f8f6] p-4 text-sm text-[#687570]">
            No accessories added.
          </p>
        ) : null}
        {planner.accessories.map((accessory, index) => {
          const catalog = getBuildingAccessory(accessory.typeId);
          const surfaceOptions: { value: BuildingSurface; label: string }[] =
            catalog?.placement === "roof"
              ? [{ value: "roof", label: "Roof" }]
              : catalog?.placement === "wall"
                ? [...WALL_OPTIONS]
                : [{ value: "whole-building", label: "Whole building" }];
          return (
            <article
              key={accessory.id}
              className="rounded-xl border border-[#18312f]/12 bg-[#faf9f5] p-4"
              data-testid={`building-accessory-row-${index}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black text-[#18312f]">{catalog?.label ?? "Accessory"}</p>
                <button
                  type="button"
                  aria-label={`Remove ${catalog?.label ?? "accessory"}`}
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      accessories: current.accessories.filter((item) => item.id !== accessory.id),
                    }))
                  }
                  className="grid h-10 w-10 place-items-center rounded-full text-[#8a3d28] hover:bg-[#f5e5de]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Placement"
                  value={accessory.surface}
                  placeholder="Choose placement"
                  options={surfaceOptions}
                  onChange={(surface) => change(accessory.id, { surface })}
                />
                {catalog?.placement !== "whole-building" ? (
                  <NullableNumberField
                    label={
                      catalog?.placement === "roof"
                        ? "X from left wall"
                        : "Offset from elevation left"
                    }
                    value={accessory.offsetFt}
                    suffix="ft"
                    onChange={(offsetFt) => change(accessory.id, { offsetFt })}
                  />
                ) : null}
                {catalog?.placement === "roof" ? (
                  <NullableNumberField
                    label="Z from front wall"
                    value={accessory.secondaryOffsetFt}
                    suffix="ft"
                    onChange={(secondaryOffsetFt) => change(accessory.id, { secondaryOffsetFt })}
                  />
                ) : null}
                {catalog?.placement === "wall" ? (
                  <NullableNumberField
                    label="Height above floor"
                    value={accessory.elevationFt}
                    suffix="ft"
                    onChange={(elevationFt) => change(accessory.id, { elevationFt })}
                  />
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatReviewDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function BuildingDesigner({
  design,
  onChange,
  onRequest,
  extension,
  onExtensionChange,
  onPlannerRequest,
}: BuildingDesignerProps) {
  const [localExtension, setLocalExtension] = useState(createEmptyBuildingPlannerExtension);
  const idCounter = useRef(1);
  const planner = extension ?? localExtension;
  const scene = useMemo(() => buildBuildingMeasuredScene(planner), [planner]);
  const request = useMemo(() => buildBuildingPlannerRequest(planner), [planner]);
  const updatePlanner = useCallback<PlannerUpdater>(
    (updater) => {
      const next = sanitizeBuildingPlannerExtension(updater(planner));
      if (extension === undefined) setLocalExtension(next);
      onExtensionChange?.(next);
    },
    [extension, onExtensionChange, planner]
  );
  const nextId = useCallback(
    (prefix: "opening" | "attachment" | "accessory") => {
      const used = new Set([
        ...planner.openings.map((item) => item.id),
        ...planner.attachments.map((item) => item.id),
        ...planner.accessories.map((item) => item.id),
      ]);
      let id = `${prefix}-${idCounter.current}`;
      while (used.has(id)) {
        idCounter.current += 1;
        id = `${prefix}-${idCounter.current}`;
      }
      idCounter.current += 1;
      return id;
    },
    [planner.accessories, planner.attachments, planner.openings]
  );
  const blockers = scene.diagnostics.filter((item) => item.severity === "blocker");
  const reviews = scene.diagnostics.filter((item) => item.severity !== "blocker");
  const submit = () => {
    const structuredRequest = buildBuildingPlannerRequest(planner);
    if (!structuredRequest || !scene.requestReady) return;
    onPlannerRequest?.(structuredRequest);
    onChange(projectBuildingExtensionToLegacy(planner, design));
    onRequest();
  };
  const removeUnresolvedReference = (path: string) => {
    updatePlanner((current) => {
      const [collection, id] = path.split(".");
      return {
        ...current,
        openings:
          collection === "openings"
            ? current.openings.filter((item) => item.id !== id)
            : current.openings,
        attachments:
          collection === "attachments"
            ? current.attachments.filter((item) => item.id !== id)
            : current.attachments,
        accessories:
          collection === "accessories"
            ? current.accessories.filter((item) => item.id !== id)
            : current.accessories,
        unresolvedCatalogItems: current.unresolvedCatalogItems.filter((item) => item.path !== path),
      };
    });
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#18312f]/10 bg-[#f7f4ed] shadow-[0_30px_90px_rgba(24,49,47,0.12)]">
      <header className="border-b border-[#18312f]/10 bg-[#18312f] px-5 py-6 text-white sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#e6a386]">
              Metal building planner
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Start with the building you actually need
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
              Place measured geometry for a written-quote conversation. Nothing is preselected, and
              this plan does not promise a product, engineering approval, availability, or price.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#f1b69d]">
              Pricing
            </p>
            <p className="mt-1 text-xl font-black">Quote required</p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(25rem,0.85fr)] xl:p-8">
        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <BuildingThreePreview scene={scene} />
        </div>
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-[#18312f]/10 bg-white p-5">
            <SectionHeading
              step="1 · Intent"
              title="What are you planning?"
              description="Choose the use first. This does not fill dimensions, frame, roof, colors, openings, or accessories for you."
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {BUILDING_USES.map((use) => {
                const selected = planner.useId === use.id;
                return (
                  <button
                    key={use.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updatePlanner((current) => ({ ...current, useId: use.id }))}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-[#18312f] bg-[#edf2ef]"
                        : "border-[#18312f]/12 bg-white hover:border-[#a94f2e]/50"
                    }`}
                    data-testid={`building-use-${use.id}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-black text-[#18312f]">{use.label}</span>
                      {selected ? (
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#a94f2e]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#66746f]">
                      {use.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {planner.unresolvedCatalogItems.length > 0 ? (
            <section
              className="rounded-2xl border border-[#a94f2e]/30 bg-[#fff4ed] p-5"
              data-testid="building-unresolved-catalog"
            >
              <h3 className="font-black text-[#6f301d]">Saved choices need resolution</h3>
              <p className="mt-1 text-sm leading-6 text-[#704a3e]">
                These saved identifiers are not in the current dated catalog. They remain visible
                and block the request; nothing was silently substituted.
              </p>
              <ul className="mt-4 space-y-3">
                {planner.unresolvedCatalogItems.map((item) => (
                  <li
                    key={item.path}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#a94f2e]/20 bg-white p-3"
                  >
                    <span className="text-sm text-[#18312f]">
                      <strong>{item.label}:</strong> {item.savedId}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUnresolvedReference(item.path)}
                      className="min-h-10 rounded-full border border-[#a94f2e]/30 px-4 text-xs font-black text-[#8a3d28]"
                    >
                      Remove saved reference
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <ShellSection planner={planner} update={updatePlanner} />
          <ColorSection planner={planner} update={updatePlanner} />
          <OpeningsSection
            planner={planner}
            update={updatePlanner}
            nextId={() => nextId("opening")}
          />
          <AttachmentsSection
            planner={planner}
            update={updatePlanner}
            nextId={() => nextId("attachment")}
          />
          <AccessoriesSection
            planner={planner}
            update={updatePlanner}
            nextId={() => nextId("accessory")}
          />

          <label className="block space-y-2 text-sm font-bold text-[#18312f]">
            <span>Project notes</span>
            <textarea
              value={planner.notes}
              onChange={(event) =>
                updatePlanner((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Loads, occupancy, interior clearances, future expansion, site access, delivery, or other needs"
              className={PROJECT_TEXTAREA_CLASS}
            />
          </label>

          <section
            className="rounded-2xl border border-[#18312f]/10 bg-[#edf2ef] p-5"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-[#a94f2e]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h3 className="font-black text-[#18312f]">Geometry and review checks</h3>
                {blockers.length > 0 ? (
                  <div className="mt-3" data-testid="building-blockers">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a3d28]">
                      Resolve before request
                    </p>
                    <ul className="mt-2 space-y-1 text-sm leading-5 text-[#70402f]">
                      {blockers.map((item, index) => (
                        <li key={`${item.code}-${item.objectId ?? index}`}>• {item.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p
                    className="mt-2 text-sm font-semibold text-[#315c50]"
                    data-testid="building-no-blockers"
                  >
                    No blocking geometry conflicts detected.
                  </p>
                )}
                <ul className="mt-3 space-y-1 text-xs leading-5 text-[#5d6c67]">
                  {reviews.map((item, index) => (
                    <li key={`${item.code}-${item.objectId ?? index}`}>{item.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {request ? (
            <section
              className="rounded-2xl border border-[#18312f]/10 bg-white p-5"
              data-testid="building-request-schedule"
            >
              <p className="text-[0.67rem] font-black uppercase tracking-[0.18em] text-[#a94f2e]">
                Request schedule
              </p>
              <p className="mt-2 font-black text-[#18312f]">
                {request.shell} · {request.roof}
              </p>
              <p className="mt-1 text-sm text-[#65736e]">
                {request.use} · {request.structuralSystem}
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  ["Openings", request.openings.length],
                  ["Attachments", request.attachments.length],
                  ["Accessories", request.accessories.length],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-xl bg-[#f4f6f3] p-3">
                    <dt className="text-[0.65rem] font-black uppercase text-[#71807b]">{label}</dt>
                    <dd className="mt-1 text-lg font-black text-[#18312f]">{count}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <div className="rounded-2xl border border-[#a94f2e]/20 bg-[#fff8f3] p-5">
            <p className="text-sm font-black text-[#18312f]">Quote required</p>
            <p className="mt-2 text-xs leading-5 text-[#65736e]">
              Catalog baseline reviewed {formatReviewDate(BUILDING_CATALOG_REVIEWED_ON)}. Exact
              dimensions, frame, panels, colors, openings, attachments, accessories, engineering,
              freight, installation, and availability require a written quote.
            </p>
            <button
              type="button"
              disabled={!scene.requestReady}
              aria-disabled={!scene.requestReady}
              onClick={submit}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#a94f2e] px-6 text-sm font-black text-white shadow-[0_15px_35px_rgba(106,43,24,.2)] transition hover:bg-[#8d3e25] disabled:cursor-not-allowed disabled:opacity-45"
              data-testid="steel-home-building-include"
            >
              <Send className="h-4 w-4" aria-hidden="true" /> Include measured building request
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
