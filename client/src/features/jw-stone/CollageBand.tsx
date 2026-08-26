export type CollageStrip = Readonly<{
  src: string;
  alt: string;
}>;

type CollageBandProps = {
  strips: readonly CollageStrip[];
  testId: string;
  /** Cache-bust query for face crop assets. */
  version?: string;
};

/**
 * Static full-bleed band of vertical stone-face strips.
 * Decorative only (pointer-events none) so the parent collapsible owns tap-to-expand.
 */
export function CollageBand({ strips, testId, version = "face-1" }: CollageBandProps) {
  if (!strips.length) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid={testId}
      aria-hidden="true"
    >
      <div className="absolute inset-0 flex">
        {strips.map((strip) => (
          <div key={strip.src} className="relative min-w-0 flex-1 overflow-hidden">
            <img
              src={`${strip.src}?v=${version}`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
