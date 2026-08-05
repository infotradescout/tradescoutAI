import { jw } from "./brand";

type NewArrivalBadgeProps = {
  /** Compact chip for dense cards / rail tiles. */
  compact?: boolean;
  className?: string;
};

/** Visible NEW ARRIVAL tag while a stone is inside the 14-day window. */
export function NewArrivalBadge({ compact = false, className = "" }: NewArrivalBadgeProps) {
  return (
    <span
      data-testid="jw-new-arrival-badge"
      className={`inline-block bg-[var(--jw-accent)] font-bold uppercase tracking-wide text-[var(--jw-on-accent)] ${
        compact ? "px-1.5 py-0.5 text-[9px] leading-none" : "px-2 py-1 text-[10px] leading-none"
      } ${className}`}
    >
      NEW ARRIVAL
    </span>
  );
}

/** Shared absolute placement for photo tiles without crowding dense cards. */
export function NewArrivalBadgeOverlay() {
  return (
    <span className={`absolute left-1.5 top-1.5 z-[1] ${jw.border}`}>
      <NewArrivalBadge compact />
    </span>
  );
}
