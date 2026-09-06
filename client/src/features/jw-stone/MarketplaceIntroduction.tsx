import "./JWStoneMarketplace.exact-surfaces.css";
import { IranianOnyxFeature } from "@/components/IranianOnyxFeature";
import { stoneShareDestination } from "./marketplaceRoutes";

/** Canonical JW marketplace hero — highest-res source in repo (1920×1080). */
const JW_STONE_HERO_VIDEO = "/images/businesses/jw-stone/video/hero.mp4";
const JW_STONE_HERO_POSTER = "/images/businesses/jw-stone/video/hero-poster.jpg";
const JW_STONE_HERO_WIDTH = 1920;
const JW_STONE_HERO_HEIGHT = 1080;

/** Hero film + the approved headline. Supporting subtext is not shown. */
export function MarketplaceIntroduction({ onExploreOnyx }: { onExploreOnyx?: () => void } = {}) {
  return (
    <section
      data-testid="jw-marketplace-hero"
      className="bg-[var(--jw-bg)]"
      aria-labelledby="jw-marketplace-title"
    >
      <p data-testid="jw-marketplace-local-description" className="sr-only">
        Natural stone slabs for fabricators, builders, designers, architects, and homeowners in
        Pensacola and across the Gulf Coast.
      </p>
      <div className="relative flex h-[42svh] justify-center overflow-hidden bg-[var(--jw-dark)] sm:h-[44svh] lg:h-[46svh]">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={JW_STONE_HERO_POSTER}
          width={JW_STONE_HERO_WIDTH}
          height={JW_STONE_HERO_HEIGHT}
          aria-hidden="true"
          className="block h-full w-full max-w-[1920px] object-cover"
        >
          <source src={JW_STONE_HERO_VIDEO} type="video/mp4" />
        </video>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-[var(--jw-bg)] to-transparent"
          aria-hidden="true"
        />
      </div>
      <div className="mx-auto max-w-[1600px] bg-[var(--jw-bg)] px-5 py-3 sm:px-9 sm:py-4 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1
            id="jw-marketplace-title"
            className="font-editorial text-[1.5rem] leading-tight tracking-tight text-[var(--jw-ink)] sm:text-[1.75rem] md:text-[1.875rem]"
          >
            Natural stone, selected at the source.
          </h1>
        </div>
      </div>
      <IranianOnyxFeature
        href={stoneShareDestination("honey-onyx")}
        onExplore={onExploreOnyx}
        label="Explore Honey Onyx"
      />
    </section>
  );
}
