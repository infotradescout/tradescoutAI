import { useEffect, useRef, useState, type ReactNode } from "react";
import { jw } from "./brand";

type JwCollapsibleSectionProps = {
  id: string;
  testId: string;
  headingId: string;
  title: string;
  /** Optional — luxury collapsed rows use heading only (no tutorial microcopy). */
  summary?: string;
  /** Open on first paint when deep-link filters / hash warrant it. */
  defaultExpanded?: boolean;
  /** Fires when expanded flips (toggle, hash jump, or defaultExpanded open). */
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Full-bleed single photo atmosphere. */
  backgroundSrc?: string;
  backgroundAlt?: string;
  /** Custom atmosphere (e.g. static collage band). Replaces `backgroundSrc` when set. */
  background?: ReactNode;
};

/**
 * Luxury section shell: ~25svh full-bleed photo row when collapsed; body opens on tap.
 * When expanded, the photo title band stays sticky under the marketplace header so
 * tapping it again can always collapse — even deep in a long inventory list.
 * Re-opens from hash matches on `#id` (menu / hero jump links).
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

  useEffect(() => {
    if (defaultExpanded) setExpandedAndNotify(true);
  }, [defaultExpanded]);

  const toggle = () => setExpandedAndNotify(!expandedRef.current);

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
            onClick={toggle}
            className="group w-full text-left"
          >
            <h2
              id={headingId}
              className="min-w-0 font-editorial text-2xl leading-tight text-[var(--jw-ink)] sm:text-3xl"
            >
              {title}
            </h2>
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
        onClick={toggle}
        className={
          expanded
            ? // Compact sticky title band — stays tappable while scrolling long panels.
              // top offsets clear sticky MarketplaceHeader (h-14 / sm:h-[4.25rem]).
              "group sticky top-14 z-30 flex min-h-14 w-full flex-col justify-end overflow-hidden text-left sm:top-[4.25rem] sm:min-h-[3.75rem]"
            : "group relative flex min-h-[25svh] w-full flex-col justify-end overflow-hidden text-left"
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
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15"
          aria-hidden="true"
        />
        <span
          className={
            expanded
              ? "relative z-[1] mx-auto w-full max-w-[1600px] px-5 py-3 sm:px-9 sm:py-3.5 lg:px-12"
              : "relative z-[1] mx-auto w-full max-w-[1600px] px-5 pb-5 pt-8 sm:px-9 sm:pb-6 sm:pt-10 lg:px-12"
          }
        >
          <h2
            id={headingId}
            className={
              expanded
                ? "max-w-3xl font-editorial text-xl leading-tight text-white sm:text-2xl"
                : "max-w-3xl font-editorial text-2xl leading-tight text-white sm:text-3xl lg:text-4xl"
            }
          >
            {title}
          </h2>
          {!expanded && summary ? (
            <p className="mt-1.5 max-w-xl text-sm leading-5 text-white/80">{summary}</p>
          ) : null}
        </span>
      </button>

      {expanded ? (
        <div
          id={panelId}
          data-testid={panelId}
          className="bg-[var(--jw-bg)] px-5 py-7 sm:px-9 sm:py-9 lg:px-12"
        >
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </div>
      ) : null}
    </section>
  );
}
