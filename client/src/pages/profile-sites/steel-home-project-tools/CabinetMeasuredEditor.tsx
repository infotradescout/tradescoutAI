import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import type { SteelHomeCabinetDesign } from "./projectModel";
import CabinetThreePreview from "./CabinetThreePreview";
import {
  CABINET_PLANNER_STARTS,
  applyCabinetPlannerStart,
  buildCabinetPlannerRequestBrief,
  cabinetPlannerExtensionFromLegacy,
  cabinetWallLengthIn,
  createBlankCabinetPlannerExtension,
  createCabinetPlannerModule,
  createCabinetShellItem,
  getCabinetModuleBounds,
  getCabinetPlannerDiagnostics,
  isCabinetPlannerRequestReady,
  reconcileCabinetPlannerExtension,
  snapCabinetInches,
  type CabinetPlacementSurface,
  type CabinetPlannerExtensionV1,
  type CabinetPlannerModule,
  type CabinetPlannerStart,
  type CabinetPlannerView,
  type CabinetShellItem,
  type CabinetShellItemKind,
  type CabinetWallId,
  type CabinetModuleKind,
} from "./cabinetPlannerModel";

export type CabinetDesignerProps = {
  design: SteelHomeCabinetDesign;
  onChange: (design: SteelHomeCabinetDesign) => void;
  onRequest: (planner?: CabinetPlannerExtensionV1) => void;
  plannerExtension?: CabinetPlannerExtensionV1 | null;
  onPlannerExtensionChange?: (planner: CabinetPlannerExtensionV1) => void;
};

const FIELD_CLASS =
  "min-h-11 w-full rounded-xl border border-[#18312f]/20 bg-white px-3 text-sm text-[#18312f] outline-none focus:border-[#a94f2e] focus:ring-2 focus:ring-[#a94f2e]/20";
const WALLS: readonly CabinetWallId[] = ["north", "east", "south", "west"];
const SURFACES: readonly CabinetPlacementSurface[] = [...WALLS, "floor"];
const MODULE_CHOICES: readonly { kind: CabinetModuleKind; label: string }[] = [
  { kind: "base-cabinet", label: "Base 30 × 24" },
  { kind: "wall-cabinet", label: "Wall 30 × 12" },
  { kind: "tall-cabinet", label: "Tall 24 × 24" },
  { kind: "appliance", label: "Appliance 30 × 30" },
  { kind: "island", label: "Island 36 × 24" },
];
const SHELL_ITEM_CHOICES: readonly { kind: CabinetShellItemKind; label: string }[] = [
  { kind: "door", label: "Door" },
  { kind: "window", label: "Window" },
  { kind: "obstacle", label: "Obstacle" },
  { kind: "water", label: "Water" },
  { kind: "drain", label: "Drain" },
  { kind: "electric", label: "Electric" },
  { kind: "vent", label: "Vent" },
];

function DimensionField({
  label,
  value,
  onChange,
  minimum = 0,
  maximum = 720,
  testId,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  minimum?: number;
  maximum?: number;
  testId?: string;
}) {
  return (
    <label className="space-y-2 text-xs font-bold text-[#18312f]">
      <span>{label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          min={minimum}
          max={maximum}
          step="0.125"
          value={value ?? ""}
          placeholder="Unresolved"
          onChange={(event) => {
            if (!event.target.value) {
              onChange(null);
              return;
            }
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) {
              onChange(snapCabinetInches(Math.min(maximum, Math.max(minimum, parsed))));
            }
          }}
          className={`${FIELD_CLASS} pr-10`}
          data-testid={testId}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.65rem] font-bold text-[#73807c]">
          in
        </span>
      </span>
    </label>
  );
}

function RequiredDimensionField({
  label,
  value,
  onChange,
  minimum = 0,
  maximum = 720,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minimum?: number;
  maximum?: number;
  testId?: string;
}) {
  return (
    <DimensionField
      label={label}
      value={value}
      minimum={minimum}
      maximum={maximum}
      testId={testId}
      onChange={(next) => {
        if (next !== null) onChange(next);
      }}
    />
  );
}

function UnresolvedPreview({ message }: { message: string }) {
  return (
    <div className="grid h-full min-h-[24rem] place-items-center bg-[#e5ddd0] p-8 text-center">
      <div className="max-w-sm">
        <p className="text-sm font-black text-[#18312f]">Measured geometry unresolved</p>
        <p className="mt-2 text-xs leading-5 text-[#68736f]">{message}</p>
      </div>
    </div>
  );
}

function PlanView({
  planner,
  onSelectModule,
}: {
  planner: CabinetPlannerExtensionV1;
  onSelectModule: (id: string) => void;
}) {
  const width = planner.shell.widthIn;
  const depth = planner.shell.depthIn;
  if (width === null || depth === null) {
    return <UnresolvedPreview message="Enter room width and depth to draw the measured plan." />;
  }
  const scale = Math.min(620 / width, 360 / depth);
  const originX = (760 - width * scale) / 2;
  const originY = (500 - depth * scale) / 2;
  const selected = planner.selectedModuleId;
  const itemLine = (item: CabinetShellItem) => {
    const start = item.offsetIn * scale;
    const extent = item.widthIn * scale;
    if (item.wall === "north") return { x: originX + start, y: originY, width: extent, height: 8 };
    if (item.wall === "south") {
      return {
        x: originX + (width - item.offsetIn - item.widthIn) * scale,
        y: originY + depth * scale - 8,
        width: extent,
        height: 8,
      };
    }
    if (item.wall === "east") {
      return { x: originX + width * scale - 8, y: originY + start, width: 8, height: extent };
    }
    return {
      x: originX,
      y: originY + (depth - item.offsetIn - item.widthIn) * scale,
      width: 8,
      height: extent,
    };
  };

  return (
    <svg
      viewBox="0 0 760 500"
      role="img"
      aria-label={`Measured cabinet plan, ${width} by ${depth} inches`}
      className="h-full min-h-[24rem] w-full bg-[#ede7dd]"
      data-testid="steel-home-cabinet-plan"
    >
      <rect width="760" height="500" fill="#ede7dd" />
      <rect
        x={originX}
        y={originY}
        width={width * scale}
        height={depth * scale}
        fill="#faf8f3"
        stroke="#18312f"
        strokeWidth="5"
      />
      {planner.shellItems.map((item) => {
        const box = itemLine(item);
        return (
          <g key={item.id} data-shell-item={item.id}>
            <rect {...box} fill={item.kind === "obstacle" ? "#9b3f32" : "#4f8c8e"} />
            <title>{`${item.label}: ${item.widthIn} inches on ${item.wall} wall`}</title>
          </g>
        );
      })}
      {planner.modules.map((module) => {
        const bounds = getCabinetModuleBounds(planner, module);
        if (!bounds) return null;
        const x = originX + bounds.x1 * scale;
        const y = originY + bounds.z1 * scale;
        const moduleWidth = Math.max(4, (bounds.x2 - bounds.x1) * scale);
        const moduleDepth = Math.max(4, (bounds.z2 - bounds.z1) * scale);
        return (
          <g
            key={module.id}
            role="button"
            tabIndex={0}
            aria-label={`Select ${module.label}`}
            onClick={() => onSelectModule(module.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectModule(module.id);
              }
            }}
            className="cursor-pointer focus:outline-none"
            data-module={module.id}
          >
            <rect
              x={x}
              y={y}
              width={moduleWidth}
              height={moduleDepth}
              rx="2"
              fill={module.kind === "island" ? "#a94f2e" : "#ac7b4e"}
              stroke={selected === module.id ? "#f4b08c" : "#18312f"}
              strokeWidth={selected === module.id ? 6 : 2}
            />
            {moduleWidth > 46 ? (
              <text
                x={x + moduleWidth / 2}
                y={y + moduleDepth / 2 + 4}
                textAnchor="middle"
                fill="white"
                fontSize="11"
                fontWeight="800"
              >
                {module.label.slice(0, 16)}
              </text>
            ) : null}
          </g>
        );
      })}
      <g fill="#18312f" fontFamily="system-ui, sans-serif" fontWeight="800">
        <text x="380" y={Math.max(20, originY - 14)} textAnchor="middle" fontSize="13">
          NORTH · {width}&quot;
        </text>
        <text
          x="380"
          y={Math.min(490, originY + depth * scale + 24)}
          textAnchor="middle"
          fontSize="13"
        >
          SOUTH · {width}&quot;
        </text>
        <text x="24" y="250" fontSize="13" transform="rotate(-90 24 250)" textAnchor="middle">
          WEST · {depth}&quot;
        </text>
        <text x="736" y="250" fontSize="13" transform="rotate(90 736 250)" textAnchor="middle">
          EAST · {depth}&quot;
        </text>
      </g>
    </svg>
  );
}

function WallElevation({
  planner,
  wall,
}: {
  planner: CabinetPlannerExtensionV1;
  wall: CabinetWallId;
}) {
  const length = cabinetWallLengthIn(planner, wall);
  const height = planner.shell.heightIn;
  if (length === null || height === null) return null;
  const scale = Math.min(310 / length, 150 / height);
  const originX = (360 - length * scale) / 2;
  const originY = 190;
  const modules = planner.modules.filter((module) => module.surface === wall);
  const items = planner.shellItems.filter((item) => item.wall === wall);
  return (
    <svg
      viewBox="0 0 360 235"
      role="img"
      aria-label={`${wall} wall elevation, ${length} inches wide by ${height} inches high`}
      className="w-full rounded-xl bg-[#f9f6f0]"
      data-testid={`steel-home-cabinet-elevation-${wall}`}
    >
      <rect
        x={originX}
        y={originY - height * scale}
        width={length * scale}
        height={height * scale}
        fill="#eee8dd"
        stroke="#18312f"
        strokeWidth="3"
      />
      {items.map((item) => (
        <rect
          key={item.id}
          x={originX + item.offsetIn * scale}
          y={originY - (item.elevationIn + item.heightIn) * scale}
          width={Math.max(3, item.widthIn * scale)}
          height={Math.max(3, item.heightIn * scale)}
          fill={item.kind === "obstacle" ? "#9b3f32" : "#63a0a4"}
          opacity="0.8"
        />
      ))}
      {modules.map((module) => (
        <g key={module.id}>
          <rect
            x={originX + module.offsetIn * scale}
            y={originY - (module.elevationIn + module.heightIn) * scale}
            width={Math.max(3, module.widthIn * scale)}
            height={Math.max(3, module.heightIn * scale)}
            fill="#a87548"
            stroke="#18312f"
            strokeWidth="2"
          />
          <title>{module.label}</title>
        </g>
      ))}
      <text x="18" y="24" fill="#a94f2e" fontSize="12" fontWeight="900">
        {wall.toUpperCase()} · {length}&quot; × {height}&quot;
      </text>
    </svg>
  );
}

function ElevationView({ planner }: { planner: CabinetPlannerExtensionV1 }) {
  if (
    planner.shell.widthIn === null ||
    planner.shell.depthIn === null ||
    planner.shell.heightIn === null
  ) {
    return (
      <UnresolvedPreview message="Enter all three room measurements to draw every wall elevation." />
    );
  }
  return (
    <div className="grid h-full min-h-[24rem] grid-cols-1 content-center gap-3 overflow-y-auto bg-[#ded6c9] p-3 sm:grid-cols-2">
      {WALLS.map((wall) => (
        <WallElevation key={wall} planner={planner} wall={wall} />
      ))}
      <p className="text-center text-[0.68rem] font-semibold text-[#596965] sm:col-span-2">
        Floor-placed island modules remain visible in plan and 3D; wall elevations show objects
        attached to that wall.
      </p>
    </div>
  );
}

function StarterChooser({
  onStart,
  onImportLegacy,
}: {
  onStart: (starter: CabinetPlannerStart) => void;
  onImportLegacy?: () => void;
}) {
  return (
    <div className="grid min-h-full place-items-center bg-[#e7dfd2] p-4 sm:p-8">
      <section
        className="w-full max-w-5xl rounded-[1.75rem] border border-[#18312f]/10 bg-[#f8f5ee] p-5 shadow-[0_24px_80px_rgba(65,47,31,.13)] sm:p-8"
        aria-labelledby="cabinet-start-title"
      >
        <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#a94f2e]">
          Cabinet planner
        </p>
        <h2
          id="cabinet-start-title"
          className="mt-2 font-editorial text-3xl font-semibold tracking-[-0.035em] text-[#18312f] sm:text-4xl"
        >
          What are you planning?
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68736f]">
          Every start opens empty. No dimensions, modules, island, style, finish, hardware, or price
          is assumed.
        </p>
        {onImportLegacy ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#a94f2e]/25 bg-[#fff0e8] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[#713d2b]">
              An earlier included cabinet draft is available. Import its recorded dimensions and
              modules as unreviewed geometry; appearance choices will not carry over.
            </p>
            <button
              type="button"
              onClick={onImportLegacy}
              className="min-h-11 shrink-0 rounded-full bg-[#a94f2e] px-4 text-xs font-black text-white"
              data-testid="steel-home-cabinet-import-legacy"
            >
              Import earlier draft
            </button>
          </div>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CABINET_PLANNER_STARTS.map((start) => (
            <button
              key={start.value}
              type="button"
              onClick={() => onStart(start.value)}
              className="min-h-28 rounded-2xl border border-[#18312f]/12 bg-white p-4 text-left transition hover:border-[#a94f2e]/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
              data-testid={`steel-home-cabinet-start-${start.value}`}
            >
              <span className="block text-base font-black text-[#18312f]">{start.label}</span>
              <span className="mt-2 block text-xs leading-5 text-[#68736f]">
                {start.description}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ModuleEditor({
  module,
  onChange,
  onRemove,
}: {
  module: CabinetPlannerModule;
  onChange: (values: Partial<CabinetPlannerModule>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="mt-4 rounded-2xl border border-[#a94f2e]/25 bg-[#fff8f3] p-4"
      data-testid="steel-home-cabinet-module-editor"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black">Selected module</p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-xs font-black text-[#8f3329] hover:bg-[#f8dfd8]"
          aria-label={`Remove ${module.label}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-xs font-bold">
          <span>Label</span>
          <input
            value={module.label}
            maxLength={60}
            onChange={(event) => onChange({ label: event.target.value })}
            className={FIELD_CLASS}
            data-testid="steel-home-cabinet-module-label"
          />
        </label>
        <label className="space-y-2 text-xs font-bold">
          <span>Place on</span>
          <select
            value={module.surface}
            onChange={(event) =>
              onChange({ surface: event.target.value as CabinetPlacementSurface })
            }
            className={FIELD_CLASS}
            data-testid="steel-home-cabinet-module-surface"
          >
            {SURFACES.map((surface) => (
              <option key={surface} value={surface}>
                {surface === "floor" ? "Floor / island" : `${surface} wall`}
              </option>
            ))}
          </select>
        </label>
        <RequiredDimensionField
          label={module.surface === "floor" ? "X from west" : "Offset from wall start"}
          value={module.offsetIn}
          onChange={(offsetIn) => onChange({ offsetIn })}
          testId="steel-home-cabinet-module-offset"
        />
        {module.surface === "floor" ? (
          <RequiredDimensionField
            label="Y from north"
            value={module.roomDepthOffsetIn}
            onChange={(roomDepthOffsetIn) => onChange({ roomDepthOffsetIn })}
            testId="steel-home-cabinet-module-room-depth"
          />
        ) : null}
        <RequiredDimensionField
          label="Width"
          value={module.widthIn}
          minimum={0.125}
          maximum={240}
          onChange={(widthIn) => onChange({ widthIn })}
          testId="steel-home-cabinet-module-width"
        />
        <RequiredDimensionField
          label="Depth"
          value={module.depthIn}
          minimum={0.125}
          maximum={120}
          onChange={(depthIn) => onChange({ depthIn })}
          testId="steel-home-cabinet-module-depth"
        />
        <RequiredDimensionField
          label="Height"
          value={module.heightIn}
          minimum={0.125}
          maximum={240}
          onChange={(heightIn) => onChange({ heightIn })}
          testId="steel-home-cabinet-module-height"
        />
        <RequiredDimensionField
          label="Elevation"
          value={module.elevationIn}
          maximum={240}
          onChange={(elevationIn) => onChange({ elevationIn })}
          testId="steel-home-cabinet-module-elevation"
        />
      </div>
      <p className="mt-3 text-[0.68rem] leading-5 text-[#68736f]">
        All placement and size values snap to 1/8 inch.
      </p>
    </div>
  );
}

function ShellItemEditor({
  item,
  onChange,
  onRemove,
}: {
  item: CabinetShellItem;
  onChange: (values: Partial<CabinetShellItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="mt-4 rounded-2xl border border-[#18312f]/12 bg-[#f7f4ee] p-4"
      data-testid="steel-home-cabinet-shell-item-editor"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black">{item.kind} geometry</p>
        <button
          type="button"
          onClick={onRemove}
          className="grid h-10 w-10 place-items-center rounded-full text-[#8f3329] hover:bg-[#f8dfd8]"
          aria-label={`Remove ${item.label}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-xs font-bold">
          <span>Label</span>
          <input
            value={item.label}
            maxLength={60}
            onChange={(event) => onChange({ label: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="space-y-2 text-xs font-bold">
          <span>Wall</span>
          <select
            value={item.wall}
            onChange={(event) => onChange({ wall: event.target.value as CabinetWallId })}
            className={FIELD_CLASS}
          >
            {WALLS.map((wall) => (
              <option key={wall} value={wall}>
                {wall}
              </option>
            ))}
          </select>
        </label>
        <RequiredDimensionField
          label="Offset from wall start"
          value={item.offsetIn}
          onChange={(offsetIn) => onChange({ offsetIn })}
        />
        <RequiredDimensionField
          label="Width"
          value={item.widthIn}
          minimum={0.125}
          maximum={240}
          onChange={(widthIn) => onChange({ widthIn })}
        />
        <RequiredDimensionField
          label="Height"
          value={item.heightIn}
          minimum={0.125}
          maximum={240}
          onChange={(heightIn) => onChange({ heightIn })}
        />
        <RequiredDimensionField
          label="Elevation"
          value={item.elevationIn}
          maximum={240}
          onChange={(elevationIn) => onChange({ elevationIn })}
        />
      </div>
    </div>
  );
}

export default function CabinetDesigner({
  design,
  onChange,
  onRequest,
  plannerExtension,
  onPlannerExtensionChange,
}: CabinetDesignerProps) {
  const [selectedShellItemId, setSelectedShellItemId] = useState<string | null>(null);
  const idCounter = useRef(0);
  const plannerSource = plannerExtension !== undefined ? plannerExtension : design.planner;
  const planner = useMemo(
    () => reconcileCabinetPlannerExtension(plannerSource ?? createBlankCabinetPlannerExtension()),
    [plannerSource]
  );
  const commit = useCallback(
    (nextInput: CabinetPlannerExtensionV1) => {
      const next = reconcileCabinetPlannerExtension(nextInput);
      if (plannerExtension === undefined) {
        onChange({ ...design, planner: next, notes: next.notes });
      }
      onPlannerExtensionChange?.(next);
    },
    [design, onChange, onPlannerExtensionChange, plannerExtension]
  );
  const commitGeometry = useCallback(
    (nextInput: CabinetPlannerExtensionV1) =>
      commit({ ...nextInput, shell: { ...nextInput.shell, measurementsReviewed: false } }),
    [commit]
  );
  const nextId = (prefix: string) => {
    idCounter.current += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter.current}`;
  };
  const diagnostics = useMemo(() => getCabinetPlannerDiagnostics(planner), [planner]);
  const ready = isCabinetPlannerRequestReady(planner);
  const selectedModule =
    planner.modules.find((module) => module.id === planner.selectedModuleId) || null;
  const selectedShellItem =
    planner.shellItems.find((item) => item.id === selectedShellItemId) || null;
  const shellComplete =
    planner.shell.widthIn !== null &&
    planner.shell.depthIn !== null &&
    planner.shell.heightIn !== null;
  const starter = CABINET_PLANNER_STARTS.find((item) => item.value === planner.starter);
  const selectModule = useCallback(
    (moduleId: string) => commit({ ...planner, selectedModuleId: moduleId }),
    [commit, planner]
  );

  if (!planner.starter) {
    return (
      <section
        id="cabinet-designer"
        className="h-full overflow-y-auto"
        data-testid="steel-home-cabinet-designer"
      >
        <StarterChooser
          onStart={(start) => commit(applyCabinetPlannerStart(planner, start))}
          onImportLegacy={
            design.included ? () => commit(cabinetPlannerExtensionFromLegacy(design)) : undefined
          }
        />
      </section>
    );
  }

  const addModule = (kind: CabinetModuleKind) => {
    const module = createCabinetPlannerModule(kind, nextId("cabinet-module"));
    commitGeometry({
      ...planner,
      modules: [...planner.modules, module],
      selectedModuleId: module.id,
    });
  };
  const updateModule = (moduleId: string, values: Partial<CabinetPlannerModule>) =>
    commitGeometry({
      ...planner,
      modules: planner.modules.map((module) =>
        module.id === moduleId ? { ...module, ...values } : module
      ),
    });
  const removeModule = (moduleId: string) =>
    commitGeometry({
      ...planner,
      modules: planner.modules.filter((module) => module.id !== moduleId),
      selectedModuleId: planner.selectedModuleId === moduleId ? null : planner.selectedModuleId,
    });
  const addShellItem = (kind: CabinetShellItemKind) => {
    const item = createCabinetShellItem(kind, nextId("cabinet-shell"));
    commitGeometry({ ...planner, shellItems: [...planner.shellItems, item] });
    setSelectedShellItemId(item.id);
  };
  const updateShellItem = (itemId: string, values: Partial<CabinetShellItem>) =>
    commitGeometry({
      ...planner,
      shellItems: planner.shellItems.map((item) =>
        item.id === itemId ? { ...item, ...values } : item
      ),
    });
  const removeShellItem = (itemId: string) => {
    commitGeometry({
      ...planner,
      shellItems: planner.shellItems.filter((item) => item.id !== itemId),
    });
    setSelectedShellItemId(null);
  };
  const startRequest = () => {
    if (!ready) return;
    onChange({ ...design, included: true, planner, notes: planner.notes });
    onRequest(planner);
  };

  return (
    <section
      id="cabinet-designer"
      className="h-full overflow-y-auto bg-[#e7dfd2] text-[#18312f] lg:overflow-hidden"
      data-testid="steel-home-cabinet-designer"
    >
      <div className="grid min-h-full lg:h-full lg:grid-cols-[minmax(0,1.18fr)_minmax(25rem,.82fr)]">
        <div className="flex min-h-[31rem] flex-col gap-3 p-3 sm:p-4 lg:min-h-0 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#18312f]/10 bg-white/80 p-2">
            <div className="flex flex-wrap gap-1" aria-label="Cabinet planner views">
              {(["plan", "elevations", "3d"] as CabinetPlannerView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={planner.view === view}
                  onClick={() => commit({ ...planner, view })}
                  className={`min-h-10 rounded-xl px-4 text-xs font-black capitalize ${planner.view === view ? "bg-[#18312f] text-white" : "text-[#53625e] hover:bg-[#18312f]/[.06]"}`}
                  data-testid={`steel-home-cabinet-view-${view}`}
                >
                  {view === "3d" ? "3D" : view}
                </button>
              ))}
            </div>
            <p className="px-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#a94f2e]">
              {starter?.label} · Quote required
            </p>
          </div>
          <div
            className="min-h-[24rem] flex-1 overflow-hidden rounded-[1.4rem] border border-[#18312f]/10 bg-[#eee8dd] shadow-[0_18px_55px_rgba(77,57,38,.12)]"
            data-testid="steel-home-cabinet-preview"
          >
            {planner.view === "plan" ? (
              <PlanView planner={planner} onSelectModule={selectModule} />
            ) : null}
            {planner.view === "elevations" ? <ElevationView planner={planner} /> : null}
            {planner.view === "3d" ? (
              shellComplete ? (
                <CabinetThreePreview planner={planner} onSelectModule={selectModule} />
              ) : (
                <UnresolvedPreview message="Enter room width, depth, and ceiling height to start the orbitable room." />
              )
            ) : null}
          </div>
          <div
            className="grid gap-3 rounded-[1.25rem] border border-[#18312f]/10 bg-white/80 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            data-testid="steel-home-cabinet-live-summary"
            aria-live="polite"
          >
            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#a94f2e]">
                One canonical measured model
              </p>
              <p className="mt-1 text-sm text-[#68736f]">
                {planner.modules.length} modules · {planner.shellItems.length} openings, obstacles,
                or utilities · 1/8-inch grid
              </p>
              <p className="mt-1 text-[0.68rem] font-semibold text-[#68736f]">
                Diagram colors identify object types; no finish or hardware is selected.
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#68736f]">
                Planning status
              </p>
              <p className={`text-lg font-black ${ready ? "text-[#245f50]" : "text-[#8f3329]"}`}>
                {ready ? "Ready for review" : `${diagnostics.length} to resolve`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col border-t border-[#18312f]/10 bg-[#f7f2e9] lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#a94f2e]">
                  Measured cabinet workbench
                </p>
                <h2 className="mt-1 font-editorial text-2xl font-semibold">{starter?.label}</h2>
                <p className="mt-2 text-xs leading-5 text-[#68736f]">
                  Plan, all-wall elevations, 3D, diagnostics, and handoff use the same geometry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (planner.starter && window.confirm("Start this cabinet planner over?"))
                    commit(applyCabinetPlannerStart(planner, planner.starter));
                }}
                className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-black text-[#596965] hover:bg-[#18312f]/[.06]"
                data-testid="steel-home-cabinet-reset"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
              </button>
            </div>

            <section
              className="mt-5 rounded-2xl border border-[#18312f]/12 bg-white p-4"
              aria-labelledby="cabinet-shell-heading"
            >
              <h3 id="cabinet-shell-heading" className="text-sm font-black">
                1. Measured room shell
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#68736f]">
                Leave any unknown dimension unresolved. Nothing is inferred from the selected start.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <DimensionField
                  label="Room width"
                  value={planner.shell.widthIn}
                  minimum={24}
                  onChange={(widthIn) =>
                    commitGeometry({ ...planner, shell: { ...planner.shell, widthIn } })
                  }
                  testId="steel-home-cabinet-primary-wall"
                />
                <DimensionField
                  label="Room depth"
                  value={planner.shell.depthIn}
                  minimum={24}
                  onChange={(depthIn) =>
                    commitGeometry({ ...planner, shell: { ...planner.shell, depthIn } })
                  }
                  testId="steel-home-cabinet-return-wall"
                />
                <DimensionField
                  label="Ceiling height"
                  value={planner.shell.heightIn}
                  minimum={48}
                  maximum={240}
                  onChange={(heightIn) =>
                    commitGeometry({ ...planner, shell: { ...planner.shell, heightIn } })
                  }
                  testId="steel-home-cabinet-ceiling-height"
                />
              </div>
              <button
                type="button"
                disabled={!shellComplete}
                onClick={() =>
                  commit({ ...planner, shell: { ...planner.shell, measurementsReviewed: true } })
                }
                className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-black ${shellComplete ? "bg-[#18312f] text-white" : "cursor-not-allowed bg-[#d9ddd5] text-[#68736f]"}`}
                data-testid="steel-home-cabinet-review-measurements"
              >
                <Check className="h-4 w-4" aria-hidden="true" />{" "}
                {planner.shell.measurementsReviewed
                  ? "Measurements reviewed"
                  : "Review current measurements"}
              </button>
            </section>

            <details className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black [&::-webkit-details-marker]:hidden">
                2. Doors, windows, obstacles, utilities{" "}
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="border-t border-[#18312f]/10 p-4">
                <div className="flex flex-wrap gap-2">
                  {SHELL_ITEM_CHOICES.map((choice) => (
                    <button
                      key={choice.kind}
                      type="button"
                      onClick={() => addShellItem(choice.kind)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[#18312f]/14 bg-[#f8f5ef] px-3 text-xs font-black hover:border-[#a94f2e]"
                      data-testid={`steel-home-cabinet-add-${choice.kind}`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {choice.label}
                    </button>
                  ))}
                </div>
                {planner.shellItems.length ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {planner.shellItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selectedShellItemId === item.id}
                        onClick={() => setSelectedShellItemId(item.id)}
                        className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-black ${selectedShellItemId === item.id ? "bg-[#18312f] text-white" : "bg-[#eee9df]"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#68736f]">No shell objects added.</p>
                )}
                {selectedShellItem ? (
                  <ShellItemEditor
                    item={selectedShellItem}
                    onChange={(values) => updateShellItem(selectedShellItem.id, values)}
                    onRemove={() => removeShellItem(selectedShellItem.id)}
                  />
                ) : null}
              </div>
            </details>

            <details className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black [&::-webkit-details-marker]:hidden">
                3. Cabinet, appliance, and island modules{" "}
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="border-t border-[#18312f]/10 p-4">
                <p className="text-xs leading-5 text-[#68736f]">
                  Adding a labeled starter size is an explicit choice; resize and place it on the
                  1/8-inch grid.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MODULE_CHOICES.map((choice) => (
                    <button
                      key={choice.kind}
                      type="button"
                      onClick={() => addModule(choice.kind)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[#18312f]/14 bg-[#f8f5ef] px-3 text-xs font-black hover:border-[#a94f2e]"
                      data-testid={`steel-home-cabinet-add-${choice.kind}`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {choice.label}
                    </button>
                  ))}
                </div>
                {planner.modules.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {planner.modules.map((module) => (
                      <button
                        key={module.id}
                        type="button"
                        aria-pressed={planner.selectedModuleId === module.id}
                        onClick={() => selectModule(module.id)}
                        className={`min-h-11 rounded-xl border px-3 text-left text-xs font-black ${planner.selectedModuleId === module.id ? "border-[#a94f2e] bg-[#fff0e8]" : "border-[#18312f]/10 bg-[#f8f5ef]"}`}
                      >
                        {module.label}
                        <span className="mt-1 block font-semibold text-[#68736f]">
                          {module.widthIn}&quot; × {module.depthIn}&quot; · {module.surface}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#68736f]">No modules added.</p>
                )}
                {selectedModule ? (
                  <ModuleEditor
                    module={selectedModule}
                    onChange={(values) => updateModule(selectedModule.id, values)}
                    onRemove={() => removeModule(selectedModule.id)}
                  />
                ) : null}
              </div>
            </details>

            {diagnostics.length ? (
              <section
                id="steel-home-cabinet-diagnostics"
                className="mt-5 rounded-2xl border border-[#a1392e]/25 bg-[#fff0ea] p-4"
                role="status"
                data-testid="steel-home-cabinet-diagnostics"
              >
                <div className="flex gap-3">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#a1392e]"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-black text-[#7f2b24]">Resolve before requesting</h3>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-[#7f2b24]">
                      {diagnostics.map((diagnostic, index) => (
                        <li key={`${diagnostic.code}-${diagnostic.objectIds.join("-")}-${index}`}>
                          • {diagnostic.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            ) : null}
            <label className="mt-5 block space-y-2 text-sm font-bold">
              <span>Planning notes (optional)</span>
              <textarea
                value={planner.notes}
                maxLength={500}
                onChange={(event) => commit({ ...planner, notes: event.target.value })}
                placeholder="Storage goals, accessibility, appliance models, or unresolved field conditions"
                className={`${FIELD_CLASS} min-h-28 resize-y py-3 leading-6`}
                data-testid="steel-home-cabinet-notes"
              />
            </label>
            <details className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-xs font-black [&::-webkit-details-marker]:hidden">
                Request brief preview{" "}
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-[#18312f]/10 p-4 text-[0.68rem] leading-5 text-[#596965]">
                {buildCabinetPlannerRequestBrief(planner)}
              </pre>
            </details>
          </div>
          <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-3 border-t border-[#18312f]/12 bg-white px-4 py-3 shadow-[0_-12px_35px_rgba(77,57,38,.1)] sm:px-6">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-[#a94f2e]">
                Cabinet planning · Quote required
              </p>
              <p className="truncate text-xs font-semibold text-[#68736f]">
                Field measurement and product confirmation required
              </p>
            </div>
            <button
              type="button"
              onClick={startRequest}
              disabled={!ready}
              aria-disabled={!ready}
              aria-describedby={!ready ? "steel-home-cabinet-diagnostics" : undefined}
              className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-black ${ready ? "bg-[#a94f2e] text-white hover:bg-[#8f3f25]" : "cursor-not-allowed bg-[#d9ddd5] text-[#596762]"}`}
              data-testid="steel-home-cabinet-include"
            >
              <Send className="h-4 w-4" aria-hidden="true" /> Request cabinet review
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
