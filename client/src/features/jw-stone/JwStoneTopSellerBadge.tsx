import type { JwStoneCatalogItem } from "./types";
import { getJwStoneTopSellerLabel } from "./topSellers";

type Props = {
  stone: Pick<JwStoneCatalogItem, "id" | "shareSlug">;
};

export function JwStoneTopSellerBadge({ stone }: Props) {
  const label = getJwStoneTopSellerLabel(stone);
  if (!label) return null;

  return (
    <span
      data-testid="jw-top-seller-badge"
      className="pointer-events-none absolute left-3 top-3 z-20 inline-flex min-h-8 items-center border border-white/35 bg-[var(--jw-dark)]/90 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_10px_28px_rgba(0,0,0,0.2)] backdrop-blur-md sm:text-[11px]"
    >
      {label}
    </span>
  );
}
