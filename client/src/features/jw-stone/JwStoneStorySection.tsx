import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";
import { jw } from "./brand";

const story = JW_STONE_PROFILE_PRESENTATION_BLOCK.data.story;

/**
 * Single bottom composition: source → finished-space inspiration.
 * Quarry photography leads; reference rooms follow. Material-supply copy from
 * the former bridge lives here — one section chrome, no duplicate galleries.
 */
export function JwStoneStorySection() {
  if (!story.images.length) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="h-10 bg-[var(--jw-bg)] sm:h-14"
        data-testid="jw-story-separator"
      />
      <section
        id="jw-story"
        data-testid="jw-marketplace-story"
        aria-labelledby="jw-story-heading"
        className={`border-y border-[var(--jw-border-strong)] bg-[var(--jw-dark)] ${jw.scrollTarget}`}
      >
        <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-9 sm:py-14 lg:px-12 lg:py-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-accent)]">
            {story.eyebrow}
          </p>
          <h2
            id="jw-story-heading"
            className="mt-3 font-editorial text-3xl tracking-tight text-white sm:text-4xl"
          >
            {story.heading}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/90 sm:text-lg">
            JW Stone sources and supplies natural stone through direct quarry relationships and
            coordinates delivery. JW Stone does not template, fabricate, finish, or install
            countertops; those services require a separate independent fabricator.
          </p>

          <ul
            className="scrollbar-hide mt-8 flex max-w-full cursor-grab gap-3 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] active:cursor-grabbing sm:mt-10 sm:gap-4 [&::-webkit-scrollbar]:hidden"
            aria-label="JW Stone quarry and finished-space inspiration"
          >
            {story.images.map((image) => (
              <li
                key={image.src}
                className="w-[82vw] max-w-[36rem] flex-none sm:w-[68vw] md:w-[47vw] lg:w-[37vw]"
              >
                <figure className="overflow-hidden border border-white/15 bg-black shadow-[0_22px_56px_rgba(0,0,0,0.28)]">
                  <span className="relative block aspect-[4/3] sm:aspect-[16/11]">
                    <img
                      src={image.src}
                      alt={image.alt}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </span>
                  <figcaption className="border-t border-white/10 px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/90">
                    {image.label}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
