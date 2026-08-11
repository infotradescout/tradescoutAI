import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  MapPin,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { STEEL_HOME_PACKAGES_PROFILE_CONTENT as content } from "@shared/steelHomePackagesProfile";
import {
  STEEL_HOME_CABINET_FINISH_OPTIONS,
  STEEL_HOME_CABINET_ROOM_OPTIONS,
  STEEL_HOME_CABINET_STAGE_OPTIONS,
  STEEL_HOME_FEATURED_STONE_IDS,
  STEEL_HOME_LABOR_TRADE_OPTIONS,
  STEEL_HOME_PACKAGE_OPTIONS,
  STEEL_HOME_STARTING_POINT_OPTIONS,
  STEEL_HOME_STONE_DIRECTION_OPTIONS,
  STEEL_HOME_STONE_ROOM_OPTIONS,
  STEEL_HOME_STRUCTURE_FOOTPRINT_OPTIONS,
  STEEL_HOME_STRUCTURE_LEVEL_OPTIONS,
  STEEL_HOME_STRUCTURE_ROOFLINE_OPTIONS,
  STEEL_HOME_TIMING_OPTIONS,
  buildSteelHomeLaborRequestHref,
  buildSteelHomePackageRequestHref,
  clearSteelHomePackageDraft,
  createEmptySteelHomePackageDraft,
  getSteelHomeDraftReadiness,
  loadSteelHomePackageDraft,
  reconcileSteelHomePackageDraft,
  saveSteelHomePackageDraft,
  toggleDraftValue,
  type SteelHomePackageDraft,
  type SteelHomePackageKey,
  type SteelHomeStartingPoint,
} from "./steelHomePackageBuilder";

type Props = {
  requestHref: string;
  laborRequestHref: string;
};

export type SteelHomePackageBuilderHandle = {
  startPackage: (options?: {
    packageKey?: SteelHomePackageKey;
    startingPoint?: Exclude<SteelHomeStartingPoint, "">;
  }) => void;
  startLabor: () => void;
};

const featuredStones = STEEL_HOME_FEATURED_STONE_IDS.map((id) => getCatalogItemById(id)).filter(
  (stone): stone is NonNullable<ReturnType<typeof getCatalogItemById>> => Boolean(stone)
);

const FIELD_CLASS =
  "min-h-12 w-full rounded-xl border border-[#18312f]/20 bg-white px-4 text-sm text-[#18312f] outline-none transition placeholder:text-[#7b8581] focus:border-[#a94f2e] focus:ring-2 focus:ring-[#a94f2e]/20";
const TEXTAREA_CLASS = `${FIELD_CLASS} min-h-28 resize-y py-3 leading-6`;

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function scrollBuilderIntoView(targetId = "steel-home-configurator") {
  if (typeof document === "undefined") return;
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({
    behavior:
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    block: "start",
  });
}

function ToggleChip({
  label,
  selected,
  onClick,
  testId,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-testid={testId}
      className={`min-h-11 rounded-full border px-4 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
        selected
          ? "border-[#18312f] bg-[#18312f] text-white"
          : "border-[#18312f]/20 bg-white text-[#3d4d49] hover:border-[#a94f2e]"
      }`}
    >
      {selected ? <Check className="mr-2 inline h-4 w-4" aria-hidden="true" /> : null}
      {label}
    </button>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2 text-sm font-bold text-[#18312f]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      >
        <option value="">Choose one</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ContinueAction({
  ready,
  href,
  label,
  blockedMessage,
  testId,
  light = false,
}: {
  ready: boolean;
  href: string;
  label: string;
  blockedMessage: string;
  testId: string;
  light?: boolean;
}) {
  const baseClass =
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-center text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2";

  return ready ? (
    <a
      href={href}
      data-testid={testId}
      className={`${baseClass} ${
        light
          ? "bg-[#f7f2e9] text-[#18312f] hover:bg-white focus-visible:ring-white"
          : "bg-[#c9683d] text-white hover:bg-[#b55732] focus-visible:ring-[#a94f2e]"
      }`}
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </a>
  ) : (
    <div>
      <button
        type="button"
        disabled
        data-testid={`${testId}-disabled`}
        className={`${baseClass} cursor-not-allowed bg-[#18312f]/12 text-[#18312f]/45`}
      >
        {label}
      </button>
      <p className="mt-2 text-center text-xs leading-5 text-[#6c7773]">{blockedMessage}</p>
    </div>
  );
}

function updatePackageSelection(
  draft: SteelHomePackageDraft,
  packageKey: SteelHomePackageKey
): SteelHomePackageDraft {
  return reconcileSteelHomePackageDraft({
    ...draft,
    packages: toggleDraftValue(draft.packages, packageKey),
  });
}

const SteelHomePackageBuilder = forwardRef<SteelHomePackageBuilderHandle, Props>(
  function SteelHomePackageBuilder({ requestHref, laborRequestHref }, ref) {
    const [draft, setDraft] = useState<SteelHomePackageDraft>(() =>
      loadSteelHomePackageDraft(getBrowserStorage())
    );
    const [saved, setSaved] = useState(false);

    useEffect(() => {
      setSaved(saveSteelHomePackageDraft(getBrowserStorage(), draft));
    }, [draft]);

    useImperativeHandle(
      ref,
      () => ({
        startPackage: (options = {}) => {
          setDraft((current) => {
            const packages = options.packageKey
              ? Array.from(new Set([...current.packages, options.packageKey]))
              : current.packages;
            return reconcileSteelHomePackageDraft({
              ...current,
              packages,
              startingPoint: options.startingPoint || current.startingPoint,
            });
          });
          window.requestAnimationFrame(() => scrollBuilderIntoView());
        },
        startLabor: () => {
          window.requestAnimationFrame(() => scrollBuilderIntoView("steel-home-labor-builder"));
        },
      }),
      []
    );

    const readiness = getSteelHomeDraftReadiness(draft);
    const packageRequestHref = useMemo(
      () => buildSteelHomePackageRequestHref(requestHref, draft),
      [draft, requestHref]
    );
    const laborRequestHrefWithDraft = useMemo(
      () => buildSteelHomeLaborRequestHref(laborRequestHref, draft),
      [draft, laborRequestHref]
    );

    const updateDraft = (updater: (current: SteelHomePackageDraft) => SteelHomePackageDraft) => {
      setDraft((current) => reconcileSteelHomePackageDraft(updater(current)));
    };

    const clearDraft = () => {
      clearSteelHomePackageDraft(getBrowserStorage());
      setDraft(createEmptySteelHomePackageDraft());
      setSaved(false);
    };

    const packageBlockedMessage = readiness.needsLocation
      ? "Add the project city or ZIP to continue."
      : "Choose at least one package item to continue.";
    const laborBlockedMessage = readiness.needsLocation
      ? "Add the project city or ZIP to continue."
      : "Choose at least one labor type to continue.";

    return (
      <div
        id="steel-home-configurator"
        className="scroll-mt-24"
        data-testid="steel-home-configurator"
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="space-y-8">
            <section className="rounded-[1.75rem] border border-[#18312f]/10 bg-[#ede8dc] p-5 sm:p-8">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a94f2e]">
                    Step 1
                  </p>
                  <h3 className="mt-2 font-editorial text-4xl font-semibold tracking-[-0.035em]">
                    Tell us where you are starting.
                  </h3>
                </div>
                <p className="text-xs text-[#6d7874]" aria-live="polite">
                  {saved ? "Your choices are saved in this browser." : "Choices stay on this page."}
                </p>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-3">
                <label className="space-y-2 text-sm font-bold">
                  <span>Project city or ZIP</span>
                  <span className="relative block">
                    <MapPin
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a94f2e]"
                      aria-hidden="true"
                    />
                    <input
                      value={draft.location}
                      onChange={(event) =>
                        updateDraft((current) => ({ ...current, location: event.target.value }))
                      }
                      maxLength={160}
                      placeholder="Hammond, LA or 70451"
                      className={`${FIELD_CLASS} pl-11`}
                      data-testid="steel-home-builder-location"
                    />
                  </span>
                </label>
                <label className="space-y-2 text-sm font-bold">
                  <span>Starting point</span>
                  <select
                    value={draft.startingPoint}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        startingPoint: event.target.value as SteelHomeStartingPoint,
                      }))
                    }
                    className={FIELD_CLASS}
                    data-testid="steel-home-builder-starting-point"
                  >
                    <option value="">Choose one</option>
                    {STEEL_HOME_STARTING_POINT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <SelectField
                  label="Desired timing"
                  value={draft.timing}
                  options={STEEL_HOME_TIMING_OPTIONS}
                  onChange={(timing) => updateDraft((current) => ({ ...current, timing }))}
                />
              </div>
            </section>

            <section aria-labelledby="steel-home-builder-package-heading">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a94f2e]">
                  Step 2
                </p>
                <h3
                  id="steel-home-builder-package-heading"
                  className="mt-2 font-editorial text-4xl font-semibold tracking-[-0.035em]"
                >
                  Choose one, two, or all three.
                </h3>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-3">
                {content.package.items.map((item) => {
                  const packageKey = item.key as SteelHomePackageKey;
                  const selected = draft.packages.includes(packageKey);
                  return (
                    <article
                      key={item.key}
                      className={`group flex min-h-full flex-col overflow-hidden rounded-[1.5rem] border bg-white shadow-[0_18px_55px_rgba(28,47,44,0.08)] transition ${
                        selected
                          ? "border-[#a94f2e] ring-2 ring-[#a94f2e]/20"
                          : "border-[#18312f]/10"
                      }`}
                      data-testid={`steel-home-package-${item.key}`}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#d8d5cc]">
                        <img
                          src={item.image}
                          alt={item.imageAlt}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="absolute left-4 top-4 rounded-full bg-[#18312f]/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <h4 className="font-editorial text-3xl font-semibold tracking-[-0.03em]">
                          {item.title}
                        </h4>
                        <p className="mt-3 flex-1 text-sm leading-6 text-[#65706c]">{item.body}</p>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setDraft((current) => updatePackageSelection(current, packageKey))
                          }
                          className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                            selected
                              ? "bg-[#18312f] text-white"
                              : "border border-[#18312f]/25 text-[#18312f] hover:border-[#a94f2e]"
                          }`}
                          data-testid={`steel-home-builder-toggle-${item.key}`}
                        >
                          {selected ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Added
                            </>
                          ) : (
                            item.action
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {draft.packages.includes("structure") ? (
              <section
                className="rounded-[1.75rem] border border-[#18312f]/10 bg-white p-5 sm:p-8"
                data-testid="steel-home-builder-structure"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a94f2e]">
                  Metal structure
                </p>
                <h3 className="mt-2 font-editorial text-4xl font-semibold tracking-[-0.035em]">
                  Shape the starting quote.
                </h3>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <SelectField
                    label="Building arrangement"
                    value={draft.structure.footprint}
                    options={STEEL_HOME_STRUCTURE_FOOTPRINT_OPTIONS}
                    onChange={(footprint) =>
                      updateDraft((current) => ({
                        ...current,
                        structure: { ...current.structure, footprint },
                      }))
                    }
                  />
                  <label className="space-y-2 text-sm font-bold">
                    <span>Estimated size</span>
                    <input
                      value={draft.structure.sizeEstimate}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          structure: { ...current.structure, sizeEstimate: event.target.value },
                        }))
                      }
                      maxLength={80}
                      placeholder="2,400 sq. ft. plus 900 sq. ft. shop"
                      className={FIELD_CLASS}
                    />
                  </label>
                  <SelectField
                    label="Roofline"
                    value={draft.structure.roofline}
                    options={STEEL_HOME_STRUCTURE_ROOFLINE_OPTIONS}
                    onChange={(roofline) =>
                      updateDraft((current) => ({
                        ...current,
                        structure: { ...current.structure, roofline },
                      }))
                    }
                  />
                  <SelectField
                    label="Levels"
                    value={draft.structure.levels}
                    options={STEEL_HOME_STRUCTURE_LEVEL_OPTIONS}
                    onChange={(levels) =>
                      updateDraft((current) => ({
                        ...current,
                        structure: { ...current.structure, levels },
                      }))
                    }
                  />
                </div>
                <label className="mt-5 block space-y-2 text-sm font-bold">
                  <span>Structure notes</span>
                  <textarea
                    value={draft.structure.notes}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        structure: { ...current.structure, notes: event.target.value },
                      }))
                    }
                    maxLength={400}
                    placeholder="Porches, garage bays, shop doors, exterior colors, or anything else that matters."
                    className={TEXTAREA_CLASS}
                  />
                </label>
              </section>
            ) : null}

            {draft.packages.includes("stone") ? (
              <section
                className="rounded-[1.75rem] border border-[#18312f]/10 bg-white p-5 sm:p-8"
                data-testid="steel-home-builder-stone"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a94f2e]">
                  Natural stone
                </p>
                <h3 className="mt-2 font-editorial text-4xl font-semibold tracking-[-0.035em]">
                  Build a real stone shortlist.
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65706c]">
                  These selections come from the current TradeScout stone collection. Final
                  availability, quantity, finish, and freight are confirmed in writing before the
                  quote is approved.
                </p>

                <fieldset className="mt-7">
                  <legend className="text-sm font-bold">Where will stone be used?</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {STEEL_HOME_STONE_ROOM_OPTIONS.map((room) => (
                      <ToggleChip
                        key={room}
                        label={room}
                        selected={draft.stone.roomUses.includes(room)}
                        onClick={() =>
                          updateDraft((current) => ({
                            ...current,
                            stone: {
                              ...current.stone,
                              roomUses: toggleDraftValue(current.stone.roomUses, room),
                            },
                          }))
                        }
                      />
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6 max-w-md">
                  <SelectField
                    label="Overall color direction"
                    value={draft.stone.direction}
                    options={STEEL_HOME_STONE_DIRECTION_OPTIONS}
                    onChange={(direction) =>
                      updateDraft((current) => ({
                        ...current,
                        stone: { ...current.stone, direction },
                      }))
                    }
                  />
                </div>

                <fieldset className="mt-7">
                  <legend className="text-sm font-bold">Current stone selections</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {featuredStones.map((stone) => {
                      const selected = draft.stone.stoneIds.includes(stone.id);
                      return (
                        <button
                          key={stone.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            updateDraft((current) => ({
                              ...current,
                              stone: {
                                ...current.stone,
                                stoneIds: toggleDraftValue(current.stone.stoneIds, stone.id),
                              },
                            }))
                          }
                          className={`overflow-hidden rounded-2xl border bg-[#f7f3eb] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                            selected
                              ? "border-[#a94f2e] ring-2 ring-[#a94f2e]/20"
                              : "border-[#18312f]/10 hover:border-[#a94f2e]/60"
                          }`}
                          data-testid={`steel-home-stone-${stone.id}`}
                        >
                          <img
                            src={stone.images[0]}
                            alt={`${stone.displayName} natural stone selection`}
                            className="aspect-[4/3] w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <span className="flex items-center justify-between gap-3 p-4">
                            <span>
                              <span className="block font-bold">{stone.displayName}</span>
                              <span className="mt-1 block text-xs text-[#6d7874]">
                                {stone.materialLabel || "Material confirmation included"}
                              </span>
                            </span>
                            {selected ? (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#a94f2e]" />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <label className="mt-6 block space-y-2 text-sm font-bold">
                  <span>Stone notes or another color</span>
                  <textarea
                    value={draft.stone.notes}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        stone: { ...current.stone, notes: event.target.value },
                      }))
                    }
                    maxLength={400}
                    placeholder="Tell us the look, rooms, quantities, or stone you are trying to match."
                    className={TEXTAREA_CLASS}
                  />
                </label>
              </section>
            ) : null}

            {draft.packages.includes("cabinets") ? (
              <section
                className="rounded-[1.75rem] border border-[#18312f]/10 bg-white p-5 sm:p-8"
                data-testid="steel-home-builder-cabinets"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a94f2e]">
                  Cabinets
                </p>
                <h3 className="mt-2 font-editorial text-4xl font-semibold tracking-[-0.035em]">
                  Build the room list once.
                </h3>
                <fieldset className="mt-7">
                  <legend className="text-sm font-bold">Which rooms need cabinets?</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {STEEL_HOME_CABINET_ROOM_OPTIONS.map((room) => (
                      <ToggleChip
                        key={room}
                        label={room}
                        selected={draft.cabinets.rooms.includes(room)}
                        onClick={() =>
                          updateDraft((current) => ({
                            ...current,
                            cabinets: {
                              ...current.cabinets,
                              rooms: toggleDraftValue(current.cabinets.rooms, room),
                            },
                          }))
                        }
                      />
                    ))}
                  </div>
                </fieldset>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <SelectField
                    label="Finish direction"
                    value={draft.cabinets.finishDirection}
                    options={STEEL_HOME_CABINET_FINISH_OPTIONS}
                    onChange={(finishDirection) =>
                      updateDraft((current) => ({
                        ...current,
                        cabinets: { ...current.cabinets, finishDirection },
                      }))
                    }
                  />
                  <SelectField
                    label="Design starting point"
                    value={draft.cabinets.designStage}
                    options={STEEL_HOME_CABINET_STAGE_OPTIONS}
                    onChange={(designStage) =>
                      updateDraft((current) => ({
                        ...current,
                        cabinets: { ...current.cabinets, designStage },
                      }))
                    }
                  />
                </div>
                <label className="mt-5 block space-y-2 text-sm font-bold">
                  <span>Cabinet notes</span>
                  <textarea
                    value={draft.cabinets.notes}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        cabinets: { ...current.cabinets, notes: event.target.value },
                      }))
                    }
                    maxLength={400}
                    placeholder="Island size, pantry goals, appliance layout, storage needs, or finish ideas."
                    className={TEXTAREA_CLASS}
                  />
                </label>
              </section>
            ) : null}

            <section
              id="steel-home-labor-builder"
              className="scroll-mt-24 rounded-[1.75rem] bg-[#18312f] p-5 text-white sm:p-8"
              data-testid="steel-home-builder-labor"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f0b392]">
                Optional local labor
              </p>
              <h3 className="mt-2 font-editorial text-4xl font-semibold tracking-[-0.035em]">
                Add the people needed at the jobsite.
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
                This creates a separate location-based Direct Connect request. It does not attach a
                material company or send the customer away from TradeScout.
              </p>
              <fieldset className="mt-6">
                <legend className="text-sm font-bold">What labor do you need?</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STEEL_HOME_LABOR_TRADE_OPTIONS.map((trade) => {
                    const selected = draft.labor.trades.includes(trade);
                    return (
                      <button
                        key={trade}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          updateDraft((current) => ({
                            ...current,
                            labor: {
                              ...current.labor,
                              trades: toggleDraftValue(current.labor.trades, trade),
                            },
                          }))
                        }
                        className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                          selected
                            ? "border-[#f0b392] bg-[#f0b392] text-[#18312f]"
                            : "border-white/20 bg-white/[0.06] text-white hover:border-white/55"
                        }`}
                      >
                        {selected ? <Check className="mr-2 inline h-4 w-4" aria-hidden="true" /> : null}
                        {trade}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="mt-6 block space-y-2 text-sm font-bold">
                <span>Labor notes</span>
                <textarea
                  value={draft.labor.notes}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      labor: { ...current.labor, notes: event.target.value },
                    }))
                  }
                  maxLength={400}
                  placeholder="Crew size, bid-only request, schedule, site conditions, or other work."
                  className="min-h-28 w-full resize-y rounded-xl border border-white/20 bg-white/[0.07] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/45 focus:border-[#f0b392] focus:ring-2 focus:ring-[#f0b392]/25"
                />
              </label>
              <div className="mt-6 max-w-sm">
                <ContinueAction
                  ready={readiness.laborReady}
                  href={laborRequestHrefWithDraft}
                  label="Review local labor request"
                  blockedMessage={laborBlockedMessage}
                  testId="steel-home-builder-labor-continue"
                  light
                />
              </div>
            </section>
          </div>

          <aside className="rounded-[1.75rem] border border-[#18312f]/10 bg-white p-6 shadow-[0_22px_65px_rgba(28,47,44,0.1)] xl:sticky xl:top-24">
            <div className="flex items-center justify-between gap-4 border-b border-[#18312f]/10 pb-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#18312f] text-white">
                  <PackageCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a94f2e]">
                    Your package
                  </p>
                  <p className="mt-1 text-sm text-[#68736f]">
                    {draft.packages.length} of 3 material groups
                  </p>
                </div>
              </div>
            </div>

            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-bold">Project location</dt>
                <dd className="mt-1 text-[#68736f]">{draft.location || "Not added yet"}</dd>
              </div>
              <div>
                <dt className="font-bold">Materials</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {STEEL_HOME_PACKAGE_OPTIONS.map((option) => (
                    <span
                      key={option.value}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        draft.packages.includes(option.value)
                          ? "bg-[#18312f] text-white"
                          : "bg-[#18312f]/7 text-[#77817d]"
                      }`}
                    >
                      {option.label}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-bold">Local labor</dt>
                <dd className="mt-1 text-[#68736f]">
                  {draft.labor.trades.length
                    ? draft.labor.trades.join(", ")
                    : "Not added yet"}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-[#18312f]/10 pt-6">
              <ContinueAction
                ready={readiness.packageReady}
                href={packageRequestHref}
                label="Review package request"
                blockedMessage={packageBlockedMessage}
                testId="steel-home-builder-package-continue"
              />
            </div>

            <button
              type="button"
              onClick={clearDraft}
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-bold text-[#68736f] transition hover:bg-[#18312f]/5 hover:text-[#18312f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
              data-testid="steel-home-builder-clear"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear this package
            </button>
          </aside>
        </div>
      </div>
    );
  }
);

SteelHomePackageBuilder.displayName = "SteelHomePackageBuilder";

export default SteelHomePackageBuilder;
