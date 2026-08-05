import { jw } from "./brand";

type StonePaletteProps = {
  colorSwatches: readonly string[];
  pairingSwatches?: readonly string[];
  /** Compact cards vs detail panel. */
  size?: "sm" | "md";
  /** Dark dialog surface uses lighter labels/borders. */
  onDark?: boolean;
  showLabels?: boolean;
};

function SwatchRow({
  hexes,
  size,
  onDark,
  ariaLabel,
}: {
  hexes: readonly string[];
  size: "sm" | "md";
  onDark: boolean;
  ariaLabel: string;
}) {
  const dim = size === "md" ? "h-7 w-7 sm:h-8 sm:w-8" : "h-2.5 w-2.5";
  const border = onDark ? "border-white/25" : jw.border;

  return (
    <div
      className={`flex items-center ${size === "md" ? "gap-2" : "gap-1"}`}
      aria-label={ariaLabel}
    >
      {hexes.map((hex, index) => (
        <span
          key={`${hex}-${index}`}
          className={`inline-block shrink-0 border ${dim} ${border}`}
          style={{ backgroundColor: hex }}
          title={hex}
          aria-label={hex}
        />
      ))}
    </div>
  );
}

/**
 * Photographed stone palette + optional soft "Pairs with" complements.
 */
export function StonePalette({
  colorSwatches,
  pairingSwatches = [],
  size = "sm",
  onDark = false,
  showLabels = false,
}: StonePaletteProps) {
  if (!colorSwatches.length) return null;

  const labelClass = onDark ? "text-xs text-white/55" : `text-[10px] leading-3 ${jw.muted}`;

  return (
    <div className={size === "md" ? "space-y-3" : "space-y-1"}>
      <div>
        {showLabels ? <p className={labelClass}>Colors from photo</p> : null}
        <div className={showLabels ? "mt-2" : undefined}>
          <SwatchRow
            hexes={colorSwatches}
            size={size}
            onDark={onDark}
            ariaLabel={`Colors ${colorSwatches.join(", ")}`}
          />
        </div>
      </div>

      {pairingSwatches.length ? (
        <div>
          <p className={labelClass}>Pairs with</p>
          <div className="mt-1">
            <SwatchRow
              hexes={pairingSwatches}
              size={size}
              onDark={onDark}
              ariaLabel={`Pairs with ${pairingSwatches.join(", ")}`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
