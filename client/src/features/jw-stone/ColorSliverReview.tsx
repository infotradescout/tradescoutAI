import { useMemo, useState } from "react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";
import { JW_STONE_CATALOG } from "./catalog";
import {
  getColorSliverSrc,
  getColorsForStone,
  getStoneColorLabel,
  getSwatchesForStone,
  type StoneColorId,
} from "./stoneColors";

const SLIVER_VERSION = "sliver-1";

type ReviewRow = {
  id: string;
  name: string;
  sliverSrc: string | null;
  buckets: readonly StoneColorId[];
  swatches: readonly { hex: string; bucket: StoneColorId }[];
};

function withVersion(src: string): string {
  const joiner = src.includes("?") ? "&" : "?";
  return `${src}${joiner}v=${SLIVER_VERSION}`;
}

/**
 * Owner review surface for per-stone face sliver crops.
 * Route: /jw-stone/dev/color-slivers — not a shopper feature.
 */
export default function ColorSliverReview() {
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [missingOnly, setMissingOnly] = useState(false);
  const [query, setQuery] = useState("");

  const rows = useMemo<ReviewRow[]>(() => {
    return JW_STONE_CATALOG.filter((stone) => !stone.anonymous)
      .map((stone) => {
        const sliverSrc = getColorSliverSrc(stone.id);
        return {
          id: stone.id,
          name: stone.displayName || stone.id,
          sliverSrc,
          buckets: getColorsForStone(stone.id),
          swatches: getSwatchesForStone(stone.id),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const bucketOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      for (const bucket of row.buckets) ids.add(bucket);
    }
    return ["all", ...[...ids].sort()];
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (missingOnly && row.sliverSrc) return false;
      if (bucketFilter !== "all" && !row.buckets.includes(bucketFilter as StoneColorId)) {
        return false;
      }
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.id.includes(q) ||
        row.buckets.some((b) => b.includes(q))
      );
    });
  }, [rows, bucketFilter, missingOnly, query]);

  const withSliver = rows.filter((r) => r.sliverSrc).length;

  return (
    <div
      data-jw-brand
      data-testid="jw-color-sliver-review"
      style={JW_STONE_BRAND_STYLE}
      className="min-h-screen"
    >
      <SEOHelmet
        title="JW Stone — Color sliver review"
        description="Internal review of per-stone face color sliver crops."
        noIndex
      />
      <div
        className="border-b px-4 py-5 sm:px-6"
        style={{ borderColor: jw.secondary, background: jw.surface }}
      >
        <p className="text-xs uppercase tracking-[0.18em]" style={{ color: jw.muted }}>
          Review tool · not a shopper surface
        </p>
        <h1 className="font-editorial mt-1 text-3xl sm:text-4xl" style={{ color: jw.ink }}>
          Color sliver review
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: jw.muted }}>
          Every marketplace stone should show a vertical face crop. Bad crops (hands, sky, clamps,
          wrong stone) are obvious at a glance. Swatches and filter buckets are sampled from these
          slivers.
        </p>
        <p className="mt-2 text-sm" style={{ color: jw.ink }}>
          {withSliver}/{rows.length} slivers present · showing {visible.length}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: jw.muted }}>
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="name, slug, bucket"
              className="min-w-[12rem] rounded border px-2 py-1.5 text-sm"
              style={{ borderColor: jw.secondary, background: jw.background, color: jw.ink }}
              data-testid="jw-sliver-search"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: jw.muted }}>
            Bucket
            <select
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value)}
              className="rounded border px-2 py-1.5 text-sm"
              style={{ borderColor: jw.secondary, background: jw.background, color: jw.ink }}
              data-testid="jw-sliver-bucket-filter"
            >
              {bucketOptions.map((id) => (
                <option key={id} value={id}>
                  {id === "all" ? "All buckets" : getStoneColorLabel(id) || id}
                </option>
              ))}
            </select>
          </label>
          <label
            className="flex items-center gap-2 text-sm"
            style={{ color: jw.ink }}
          >
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
              data-testid="jw-sliver-missing-only"
            />
            Missing sliver only
          </label>
          <a
            href="/jw-stone"
            className="ml-auto text-sm underline-offset-2 hover:underline"
            style={{ color: jw.accent }}
          >
            ← Back to marketplace
          </a>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
        style={{ background: jw.background }}
      >
        {visible.map((row) => (
          <article
            key={row.id}
            data-testid={`jw-sliver-card-${row.id}`}
            className="overflow-hidden rounded-sm border"
            style={{ borderColor: `${jw.secondary}55`, background: jw.surface }}
          >
            <div className="relative aspect-[1/3] w-full overflow-hidden" style={{ background: "#2a2724" }}>
              {row.sliverSrc ? (
                <img
                  src={withVersion(row.sliverSrc)}
                  alt={`${row.name} face sliver`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-full items-center justify-center px-2 text-center text-xs"
                  style={{ color: "#c9c4bb" }}
                >
                  Missing sliver
                </div>
              )}
            </div>
            <div className="space-y-1.5 p-2">
              <h2 className="font-editorial text-sm leading-tight" style={{ color: jw.ink }}>
                {row.name}
              </h2>
              <p className="truncate font-mono text-[10px]" style={{ color: jw.muted }}>
                {row.id}
              </p>
              <div className="flex flex-wrap gap-1">
                {row.buckets.length ? (
                  row.buckets.map((bucket) => (
                    <span
                      key={bucket}
                      className="rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
                      style={{ background: `${jw.accent}33`, color: jw.ink }}
                    >
                      {getStoneColorLabel(bucket) || bucket}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px]" style={{ color: jw.muted }}>
                    No buckets
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {row.swatches.slice(0, 5).map((swatch) => (
                  <span
                    key={`${row.id}-${swatch.hex}`}
                    title={`${swatch.hex} · ${swatch.bucket}`}
                    className="h-3 w-3 rounded-sm border"
                    style={{ background: swatch.hex, borderColor: `${jw.secondary}66` }}
                  />
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
