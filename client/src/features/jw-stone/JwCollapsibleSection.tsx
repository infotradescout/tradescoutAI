import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { jw } from "./brand";

type JwCollapsibleSectionProps = {
  id: string;
  testId: string;
  headingId: string;
  title: string;
  /**
   * Optional supporting copy for the non-photo shell only.
   * Never used as an open/close affordance — photo bands show one cue only
   * (chevron + muted Open/Close).
   */
  summary?: string;
  /**
   * Open on first paint only when a caller opts in.
   * Not reactive — later prop flips must not force-open.
   * Color and material browse bands always pass false (shopper must open).
   */
  defaultExpanded?: boolean;
  /** Fires when expanded flips (toggle or hash jump). */
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Full-bleed single photo atmosphere. */
  backgroundSrc?: string;
  backgroundAlt?: string;
  /** Custom atmosphere (e.g. static collage band). Replaces `backgroundSrc` when set. */
  background?: ReactNode;
};

/** Exactly one visible cue per band: muted Open/Close + rotating chevron. */
function SectionToggleCue({
  expanded,
  tone,
  testId,
}: {
  expanded: boolean;
  tone: "light" | "dark";
  testId: string;
}) {
  const label = expanded ? "Close" : "Open";
  const toneClass =
    tone === "dark"
      ? "text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
      : "text-[var(--jw-muted)]";

  return (
    <span
      data-testid={`${testId}-expand-cue`}
      className={`inline-flex shrink-0 flex-col items-center gap-0 ${toneClass}`}
      aria-hidden="true"
    >
      <span className="text-[10px] font-medium tracking-wide sm:text-[11px]">{label}</span>
      <ChevronDown
        data-testid={`${testId}-expand-chevron`}
        className={`h-6 w-6 shrink-0 transition-transform duration-200 sm:h-7 sm:w-7 ${
          expanded ? "rotate-180" : ""
        }`}
        strokeWidth={2.25}
      />
    </span>
  );
}

const photoToggleBase =
  "cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--jw-accent)] focus-visible:ring-inset transition-[filter,transform] duration-150 group-hover:brightness-[1.06] active:brightness-95";

/**
 * Compact full-bleed browse band when collapsed; the body opens on tap.
 * Three collapsed browse choices now fit comfortably beneath the First Cut
 * carousel in one desktop viewport instead of consuming three quarters of it.
 * When expanded, the photo title band stays sticky under the marketplace header
 * so tapping it again can always collapse, even deep in a long inventory list.
 */
export function JwCollapsibleSection({
  id,
  testId,
  headingId,
  title,
  summary,
  defaultExpanded = false,
  onExpandedChange,
  children,
  className = "",
  backgroundSrc,
  backgroundAlt = "",
  background,
}: JwCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = `${testId}-panel`;
  const hasBackground = Boolean(background || backgroundSrc);
  const expandedRef = useRef(expanded);
  const onExpandedChangeRef = useRef(onExpandedChange);
  expandedRef.current = expanded;
  onExpandedChangeRef.current = onExpandedChange;

  const setExpandedAndNotify = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(expandedRef.current) : next;
    if (value === expandedRef.current) return;
    expandedRef.current = value;
    setExpanded(value);
    onExpandedChangeRef.current?.(value);
  };

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === `#${id}`) setExpandedAndNotify(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [id]);

  const toggle = () => setExpandedAndNotify(!expandedRef.current);
  const actionLabel = expanded ? `Close ${title}` : `Open ${title}`;

  if (!hasBackground) {
    return (
      <section
        id={id}
        data-testid={testId}
        data-expanded={expanded ? "true" : "false"}
        aria-labelledby={headingId}
        className={`bg-[var(--jw-bg)] px-5 py-7 sm:px-9 sm:py-9 lg:px-12 ${jw.scrollTarget} ${className}`}
      >
        <div className="mx-auto max-w-[1600px]">
          <button
            type="button"
            data-testid={`${testId}-toggle`}
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={actionLabel}
            onClick={toggle}
            className="group flex w-full cursor-pointer items-start justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--jw-accent)] focus-visible:ring-offset-2"
          >
            <h2
              id={headingId}
              className="min-w-0 font-editorial text-2xl leading-tight text-[var(--jw-ink)] sm:text-3xl"
            >
              {title}
            </h2>
            <SectionToggleCue expanded={expanded} tone="light" testId={testId} />
          </button>
          {summary ? (
            <p className={`mt-2 max-w-xl text-sm leading-6 ${jw.muted}`}>{summary}</p>
          ) : null}

          {expanded ? (
            <div id={panelId} data-testid={panelId} className="mt-5 sm:mt-6">
              {children}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      id={id}
      data-testid={testId}
      data-expanded={expanded ? "true" : "false"}
      aria-labelledby={headingId}
      className={`relative bg-[var(--jw-dark)] ${expanded ? "" : "overflow-hidden"} ${jw.scrollTarget} ${className}`}
    >
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={actionLabel}
        onClick={toggle}
        className={
          expanded
            ? // Compact sticky title band — stays tappable while scrolling long panels.
              // Top offsets clear sticky MarketplaceHeader (h-14 / sm:h-[4.25rem]).
              `group sticky top-14 z-30 flex min-h-14 w-full flex-col justify-end overflow-hidden text-left sm:top-[4.25rem] sm:min-h-[3.75rem] ${photoToggleBase}`
            : `group relative flex min-h-[8.5rem] w-full flex-col justify-end overflow-hidden text-left sm:min-h-[8rem] lg:min-h-[7.5rem] ${photoToggleBase}`
        }
      >
        {background ?? (
          <img
            src={backgroundSrc}
            alt={backgroundAlt}
            aria-hidden={backgroundAlt ? undefined : true}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15 transition-opacity duration-150 group-hover:from-black/70"
          aria-hidden="true"
        />
        <span
          className={
            expanded
              ? "relative z-[1] mx-auto flex w-full max-w-[1600px] items-end justify-between gap-4 px-5 py-3 sm:px-9 sm:py-3.5 lg:px-12"
              : "relative z-[1] mx-auto flex w-full max-w-[1600px] items-end justify-between gap-4 px-5 pb-3 pt-5 sm:px-9 sm:pb-3.5 sm:pt-6 lg:px-12"
          }
        >
          <h2
            id={headingId}
            className={
              expanded
                ? "min-w-0 max-w-3xl font-editorial text-xl leading-tight text-white sm:text-2xl"
                : "min-w-0 max-w-3xl font-editorial text-xl leading-tight text-white sm:text-2xl lg:text-[1.75rem]"
            }
          >
            {title}
          </h2>
          <SectionToggleCue expanded={expanded} tone="dark" testId={testId} />
        </span>
      </button>

      {expanded ? (
        <div
          id={panelId}
          data-testid={panelId}
          className="bg-[var(--jw-bg)] px-5 py-5 sm:px-9 sm:py-7 lg:px-12"
        >
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </div>
      ) : null}
    </section>
  );
}
