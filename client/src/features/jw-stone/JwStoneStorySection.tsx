import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";
import { jw } from "./brand";

const story = JW_STONE_PROFILE_PRESENTATION_BLOCK.data.story;

/**
 * Single bottom composition: source → finished space.
 * Quarry leads; finished installs follow. Process copy from the former
 * finished-work bridge lives here — one section chrome, no duplicate galleries.
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
          <p
            id="jw-story-heading"
            className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-accent)]"
          >
            {story.eyebrow}
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/90 sm:text-lg">
            JW Stone handles the entire process — from sourcing through fabrication to delivery —
            with quarry-direct pricing.
          </p>

          <ul
            className="scrollbar-hide mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-10 sm:gap-4 [&::-webkit-scrollbar]:hidden"
            aria-label="JW Stone quarry and finished work"
          >
            {story.images.map((image) => (
              <li
                key={image.src}
                className="w-[85vw] max-w-[36rem] flex-none snap-center sm:w-[70vw] md:w-[48vw] lg:w-[38vw]"
              >
                <figure className="overflow-hidden bg-black">
                  <span className="relative block aspect-[4/3] sm:aspect-[16/11]">
                    <img
                      src={image.src}
                      alt={image.alt}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </span>
                  <figcaption className="border-t border-white/10 px-4 py-3 text-sm font-semibold text-white">
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
