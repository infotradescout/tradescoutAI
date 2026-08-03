import { FirstCutSection } from "./FirstCutSection";

/**
 * Protected JW Stone shell content. Keep imagery, hierarchy, veil, and approved
 * copy stable while the experience below First Cut evolves independently.
 */
export function MarketplaceIntroduction() {
  return (
    <>
      <section
        data-testid="jw-marketplace-hero"
        className="relative isolate min-h-[78vh] overflow-hidden bg-stone-950 text-stone-50"
        aria-labelledby="jw-marketplace-title"
      >
        <img
          src="/images/businesses/jw-stone/video/hero-poster.jpg"
          alt="Natural stone presented by JW Stone"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
        <div className="mx-auto flex min-h-[78vh] max-w-7xl items-end px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">
              JW Stone · A new way to discover stone
            </p>
            <h1
              id="jw-marketplace-title"
              className="mt-6 max-w-4xl font-editorial text-6xl leading-[0.9] sm:text-7xl lg:text-8xl"
            >
              Natural stone, selected at the source.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-200 sm:text-xl">
              Search the full collection or ask JW Stone about your project.
            </p>
            <a
              href="#choose-buyer"
              className="mt-9 inline-flex min-h-12 items-center bg-stone-100 px-6 font-bold text-stone-950 hover:bg-white"
            >
              Begin your selection
            </a>
          </div>
        </div>
      </section>

      <FirstCutSection />
    </>
  );
}
