import { useLocation } from "wouter";
import ColorSliverReview from "../features/jw-stone/ColorSliverReview";
import JWStoneMarketplace from "../features/jw-stone/JWStoneMarketplace";

/** Owner review gallery for per-stone face color slivers. */
const COLOR_SLIVER_REVIEW_PATH = "/jw-stone/dev/color-slivers";

export default function JWStoneMarketplacePage() {
  const [location] = useLocation();
  const pathOnly = location.split("?")[0]?.replace(/\/+$/, "") || "/";
  if (pathOnly === COLOR_SLIVER_REVIEW_PATH) {
    return <ColorSliverReview />;
  }
  return <JWStoneMarketplace />;
}
