import { jw } from "./brand";

/** Canonical JW marketplace hero — highest-res source in repo (1920×1080). */
const JW_STONE_HERO_VIDEO = "/images/businesses/jw-stone/video/hero.mp4";
const JW_STONE_HERO_POSTER = "/images/businesses/jw-stone/video/hero-poster.jpg";
const JW_STONE_HERO_WIDTH = 1920;
const JW_STONE_HERO_HEIGHT = 1080;

/**
 * Hero image + statement + Browse inventory.
 * Warm ivory panel under the film — no full-hero darken, no heavy shadow.
 */
export function MarketplaceIntroduction() {
  return (
    <section
      data-testid="jw-marketplace-hero"
      className="bg-[var(--jw-bg)]"
      aria-labelledby="jw-marketplace-title"
    >
      <div className="relative flex justify-center bg-[var(--jw-dark)]">
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
          className="block h-auto w-full max-w-[1920px]"
        >
          <source src={JW_STONE_HERO_VIDEO} type="video/mp4" />
        </video>
        {/* Restrained bottom fade only — keeps the film bright. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-[var(--jw-bg)] to-transparent"
          aria-hidden="true"
        />
      </div>
      <div className="mx-auto max-w-[1600px] bg-[var(--jw-bg)] px-5 py-6 sm:px-9 sm:py-7 lg:px-12">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center sm:gap-5">
          <h1
            id="jw-marketplace-title"
            className="font-editorial text-[1.75rem] leading-tight tracking-tight text-[var(--jw-ink)] sm:text-[2rem] md:text-[2.125rem]"
          >
            Natural stone, selected at the source.
          </h1>
          <a
            href="#current-inventory"
            className={`inline-flex min-h-12 w-fit items-center px-5 text-sm ${jw.accentCta}`}
          >
            Browse inventory
          </a>
        </div>
      </div>
    </section>
  );
}
